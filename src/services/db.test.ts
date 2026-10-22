import { describe, it, expect, beforeEach } from 'vitest';
import { db } from './db';

describe('Pharmacy Management System - Core Database Engine & FEFO Invariants', () => {
  beforeEach(() => {
    // Reset to demo data before each test
    db.resetToDemoData();
  });

  it('initializes with seed medicines and batches', () => {
    const medicines = db.getMedicines();
    const batches = db.getBatches();

    expect(medicines.length).toBeGreaterThanOrEqual(25);
    expect(batches.length).toBeGreaterThanOrEqual(25);

    const napa = db.getMedicineById('med-1');
    expect(napa).toBeDefined();
    expect(napa?.name).toBe('Napa');
    expect(napa?.genericName).toBe('Paracetamol');
  });

  it('strictly enforces FEFO (First Expire First Out) ordering for medicine batches', () => {
    const napaBatches = db.getBatchesForMedicine('med-1');
    expect(napaBatches.length).toBeGreaterThanOrEqual(2);

    // Verify each subsequent batch has an expiry date >= previous batch
    for (let i = 0; i < napaBatches.length - 1; i++) {
      const currentExp = new Date(napaBatches[i].expiryDate).getTime();
      const nextExp = new Date(napaBatches[i + 1].expiryDate).getTime();
      expect(currentExp).toBeLessThanOrEqual(nextExp);
    }
  });

  it('processes atomic POS sales transaction, decrements batch stock, and computes VAT', () => {
    const napa = db.getMedicineById('med-1')!;
    const fefoBatch = db.getBatchesForMedicine('med-1')[0];
    const initialStock = fefoBatch.quantityInStock;

    const sale = db.processSale({
      cartItems: [
        {
          medicine: napa,
          batch: fefoBatch,
          quantity: 10,
          unitType: 'piece',
          unitPrice: fefoBatch.sellingPrice,
          costPrice: fefoBatch.purchasePrice,
          discountPercent: 0,
          total: 10 * fefoBatch.sellingPrice,
        },
      ],
      discountAmount: 0,
      vatPercent: 5,
      paymentMethod: 'cash',
      paidAmount: 50,
      cashierName: 'Adnin Sadat',
    });

    expect(sale).toBeDefined();
    expect(sale.items.length).toBe(1);
    expect(sale.grandTotal).toBe(Number((10 * fefoBatch.sellingPrice * 1.05).toFixed(2)));

    // Verify batch stock was decremented
    const updatedBatches = db.getBatchesForMedicine('med-1', true);
    const updatedBatch = updatedBatches.find((b) => b.id === fefoBatch.id);
    expect(updatedBatch?.quantityInStock).toBe(initialStock - 10);
  });

  it('handles customer credit / due sales and updates customer due balance', () => {
    const customer = db.getCustomers()[0];
    const initialDue = customer.dueBalance;
    const napa = db.getMedicineById('med-1')!;
    const batch = db.getBatchesForMedicine('med-1')[0];

    const sale = db.processSale({
      cartItems: [
        {
          medicine: napa,
          batch,
          quantity: 5,
          unitType: 'piece',
          unitPrice: batch.sellingPrice,
          costPrice: batch.purchasePrice,
          discountPercent: 0,
          total: 5 * batch.sellingPrice,
        },
      ],
      customer,
      discountAmount: 0,
      vatPercent: 0,
      paymentMethod: 'due',
      paidAmount: 0,
      cashierName: 'Adnin Sadat',
    });

    expect(sale.dueAmount).toBe(5 * batch.sellingPrice);

    // Verify customer's dueBalance increased by dueAmount
    const updatedCust = db.getCustomers().find((c) => c.id === customer.id)!;
    expect(updatedCust.dueBalance).toBe(initialDue + sale.dueAmount);

    // Test due collection
    db.collectCustomerDue(customer.id, sale.dueAmount, 'Test settlement');
    const settledCust = db.getCustomers().find((c) => c.id === customer.id)!;
    expect(settledCust.dueBalance).toBe(initialDue);
  });

  it('supports full database backup export and restoration', () => {
    const backupJson = db.exportFullBackup();
    expect(typeof backupJson).toBe('string');

    const parsed = JSON.parse(backupJson);
    expect(parsed.version).toBe('1.0');
    expect(parsed.medicines).toBeDefined();
    expect(parsed.batches).toBeDefined();

    const restored = db.importFullBackup(backupJson);
    expect(restored).toBe(true);
  });
});
