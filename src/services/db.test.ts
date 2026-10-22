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
    expect(parsed.version).toBe('2.0');
    expect(parsed.medicines).toBeDefined();
    expect(parsed.batches).toBeDefined();

    const restored = db.importFullBackup(backupJson);
    expect(restored).toBe(true);
  });

  it('supports Hold and Recall orders during active POS billing', () => {
    const napa = db.getMedicineById('med-1')!;
    const batch = db.getBatchesForMedicine('med-1')[0];

    // Hold a sale
    const held = db.holdCurrentSale({
      cartItems: [
        {
          medicine: napa,
          batch,
          quantity: 2,
          unitType: 'piece',
          unitPrice: batch.sellingPrice,
          costPrice: batch.purchasePrice,
          discountPercent: 0,
          total: 2 * batch.sellingPrice,
        },
      ],
      discountAmount: 0,
      vatPercent: 5,
      note: 'Customer went to get prescription copy',
    });

    expect(held).toBeDefined();
    expect(held.id).toMatch(/^held-/);

    const activeHolds = db.getHeldSales();
    expect(activeHolds.some((h) => h.id === held.id)).toBe(true);

    // Remove / Resume held sale
    db.removeHeldSale(held.id);
    const updatedHolds = db.getHeldSales();
    expect(updatedHolds.some((h) => h.id === held.id)).toBe(false);
  });

  it('imports bulk MedEx and Arogga pharmaceutical formulations with active batches', () => {
    const initialCount = db.getMedicines().length;

    const importedCount = db.importBulkMedicines([
      {
        name: 'Herbicough Test',
        genericName: 'Adhatoda vasica Extract',
        category: 'Herbal & Nutraceutical',
        specialSegment: 'Herbal',
        medicineType: 'Herbal',
        drugClass: 'Ayurvedic Expectorant',
        dosageForm: 'Syrup',
        strength: '100 ml',
        manufacturer: 'Square Herbal & Nutraceuticals',
        unit: 'Bottle',
        unitsPerBox: 1,
        reorderLevel: 10,
        rackLocation: 'Rack H-1',
        isColdChain: false,
        requiresPrescription: false,
        isAntibiotic: false,
        isNarcotic: false,
        barcode: '89099887766',
        sellingPrice: 85,
        purchasePrice: 70,
        quantityInStock: 50,
      },
      {
        name: 'Trastuzumab Biosimilar',
        genericName: 'Trastuzumab',
        category: 'Oncology & Chemotherapy',
        specialSegment: 'mAb',
        medicineType: 'Biochemical',
        drugClass: 'Monoclonal Antibody',
        dosageForm: 'Injection',
        strength: '440 mg',
        manufacturer: 'Incepta Pharma',
        unit: 'Vial',
        unitsPerBox: 1,
        reorderLevel: 2,
        rackLocation: 'Cold Storage (2°C - 8°C)',
        isColdChain: true,
        requiresPrescription: true,
        isAntibiotic: false,
        isNarcotic: false,
        barcode: '89011223344',
        sellingPrice: 45000,
        purchasePrice: 38000,
        quantityInStock: 5,
      },
    ]);

    expect(importedCount).toBe(2);
    expect(db.getMedicines().length).toBe(initialCount + 2);

    // Verify cold chain medicine batch exists and has specified price
    const coldMed = db.getMedicines().find((m) => m.name === 'Trastuzumab Biosimilar');
    expect(coldMed).toBeDefined();
    expect(coldMed?.isColdChain).toBe(true);

    const coldBatches = db.getBatchesForMedicine(coldMed!.id);
    expect(coldBatches.length).toBe(1);
    expect(coldBatches[0].sellingPrice).toBe(45000);
    expect(coldBatches[0].quantityInStock).toBe(5);
  });

  it('efficiently handles large-scale pharmaceutical imports with O(1) deduplication', () => {
    const bulkPayload = Array.from({ length: 250 }, (_, i) => ({
      name: `Test Pharma Generic Formulation #${i}`,
      genericName: `Active Chemical Component #${i % 25}`,
      category: 'Antibiotic & Antimicrobial' as const,
      specialSegment: 'Antimicrobial' as const,
      medicineType: 'Allopathic' as const,
      dosageForm: 'Tablet' as const,
      strength: `${(i % 10 + 1) * 100} mg`,
      manufacturer: `Bangladesh Pharma Ltd #${i % 10}`,
      unit: 'Pcs',
      unitsPerBox: 100,
      reorderLevel: 20,
      rackLocation: `Rack ${String.fromCharCode(65 + (i % 6))}-${i % 10}`,
      isColdChain: i % 10 === 0,
      requiresPrescription: true,
      isAntibiotic: true,
      isNarcotic: false,
      sellingPrice: 25.5,
      purchasePrice: 20.0,
      quantityInStock: 200,
    }));

    const imported = db.importBulkMedicines(bulkPayload);
    expect(imported).toBe(250);

    // Re-importing the same payload should result in 0 new imports (strict deduplication)
    const duplicateImport = db.importBulkMedicines(bulkPayload);
    expect(duplicateImport).toBe(0);
  });

  it('processes Customer Sales Return, restocks inventory batch, and issues refund', () => {
    const napa = db.getMedicineById('med-1')!;
    const batch = db.getBatchesForMedicine('med-1')[0];
    const initialBatchStock = batch.quantityInStock;

    // 1. Make initial sale of 10 pieces
    const sale = db.processSale({
      cartItems: [
        {
          medicine: napa,
          batch,
          quantity: 10,
          unitType: 'piece',
          unitPrice: batch.sellingPrice,
          costPrice: batch.purchasePrice,
          discountPercent: 0,
          total: 10 * batch.sellingPrice,
        },
      ],
      discountAmount: 0,
      vatPercent: 0,
      paymentMethod: 'cash',
      paidAmount: 10 * batch.sellingPrice,
      cashierName: 'Adnin Sadat',
    });

    const stockAfterSale = db.getBatchesForMedicine('med-1', true).find((b) => b.id === batch.id)!.quantityInStock;
    expect(stockAfterSale).toBe(initialBatchStock - 10);

    // 2. Process return of 4 pieces
    const saleReturn = db.processSaleReturn({
      originalSaleId: sale.id,
      originalInvoiceNumber: sale.invoiceNumber,
      customerName: 'Return Customer',
      items: [
        {
          medicineId: napa.id,
          medicineName: napa.name,
          genericName: napa.genericName,
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          quantity: 4,
          unitPrice: batch.sellingPrice,
          totalRefund: 4 * batch.sellingPrice,
          reason: 'Doctor changed prescription',
        },
      ],
      refundMethod: 'cash',
      cashierName: 'On-Duty Pharmacist',
    });

    expect(saleReturn).toBeDefined();
    expect(saleReturn.returnInvoiceNumber).toMatch(/^RET-/);
    expect(saleReturn.totalRefundAmount).toBe(4 * batch.sellingPrice);

    // 3. Verify batch was restocked by 4 units
    const stockAfterReturn = db.getBatchesForMedicine('med-1', true).find((b) => b.id === batch.id)!.quantityInStock;
    expect(stockAfterReturn).toBe(stockAfterSale + 4);
  });

  it('reduces customer due balance when return refundMethod is credit_note', () => {
    const customer = db.getCustomers()[0];
    const napa = db.getMedicineById('med-1')!;
    const batch = db.getBatchesForMedicine('med-1')[0];

    // Create due sale
    const sale = db.processSale({
      cartItems: [
        {
          medicine: napa,
          batch,
          quantity: 10,
          unitType: 'piece',
          unitPrice: batch.sellingPrice,
          costPrice: batch.purchasePrice,
          discountPercent: 0,
          total: 10 * batch.sellingPrice,
        },
      ],
      customer,
      discountAmount: 0,
      vatPercent: 0,
      paymentMethod: 'due',
      paidAmount: 0,
      cashierName: 'Adnin Sadat',
    });

    const dueAfterSale = db.getCustomers().find((c) => c.id === customer.id)!.dueBalance;
    const returnVal = 5 * batch.sellingPrice;

    // Return with credit note
    db.processSaleReturn({
      originalSaleId: sale.id,
      originalInvoiceNumber: sale.invoiceNumber,
      customerId: customer.id,
      customerName: customer.name,
      items: [
        {
          medicineId: napa.id,
          medicineName: napa.name,
          genericName: napa.genericName,
          batchId: batch.id,
          batchNumber: batch.batchNumber,
          quantity: 5,
          unitPrice: batch.sellingPrice,
          totalRefund: returnVal,
          reason: 'Excess medicine',
        },
      ],
      refundMethod: 'credit_note',
      cashierName: 'Adnin Sadat',
    });

    const dueAfterReturn = db.getCustomers().find((c) => c.id === customer.id)!.dueBalance;
    expect(dueAfterReturn).toBe(dueAfterSale - returnVal);
  });

  it('manages Cash Drawer Shifts and computes Z-Report discrepancy', () => {
    // 1. Open shift with float of 1500
    const shift = db.openCashShift('Adnin Sadat', 1500);
    expect(shift.status).toBe('open');
    expect(shift.openingFloat).toBe(1500);
    expect(shift.expectedCash).toBe(1500);

    // 2. Perform a cash sale
    const napa = db.getMedicineById('med-1')!;
    const batch = db.getBatchesForMedicine('med-1')[0];
    db.processSale({
      cartItems: [
        {
          medicine: napa,
          batch,
          quantity: 10,
          unitType: 'piece',
          unitPrice: batch.sellingPrice,
          costPrice: batch.purchasePrice,
          discountPercent: 0,
          total: 10 * batch.sellingPrice,
        },
      ],
      discountAmount: 0,
      vatPercent: 0,
      paymentMethod: 'cash',
      paidAmount: 10 * batch.sellingPrice,
      cashierName: 'Adnin Sadat',
    });

    // Verify expected cash increased by sale amount
    const active = db.getCurrentOpenShift()!;
    const expectedWithSale = 1500 + 10 * batch.sellingPrice;
    expect(active.expectedCash).toBe(expectedWithSale);

    // 3. Close shift with physical count (with slight discrepancy)
    const counted = expectedWithSale - 20; // 20 taka short
    const closed = db.closeCashShift(counted, 'Minor coin change shortage');
    expect(closed).toBeDefined();
    expect(closed?.status).toBe('closed');
    expect(closed?.actualCashCounted).toBe(counted);
    expect(closed?.discrepancy).toBe(-20);
    expect(db.getCurrentOpenShift()).toBeNull();
  });

  it('records Damage / Waste write-offs and company return claims', () => {
    const napa = db.getMedicineById('med-1')!;
    const batch = db.getBatchesForMedicine('med-1')[0];
    const initialStock = batch.quantityInStock;

    const record = db.recordDamageWaste({
      medicineId: napa.id,
      medicineName: napa.name,
      genericName: napa.genericName,
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      expiryDate: batch.expiryDate,
      quantity: 15,
      unitCost: batch.purchasePrice,
      totalLoss: 15 * batch.purchasePrice,
      reason: 'expired',
      action: 'returned_to_company',
      supplierName: 'Square Pharmaceuticals Ltd.',
      challanNumber: 'CHL-998822',
      reportedBy: 'Pharmacist Tester',
    });

    expect(record).toBeDefined();
    expect(record.id).toMatch(/^dam-/);

    // Verify batch stock was deducted
    const remaining = db.getBatchesForMedicine('med-1', true).find((b) => b.id === batch.id)!.quantityInStock;
    expect(remaining).toBe(initialStock - 15);

    // Verify record appears in damage waste list
    const list = db.getDamageWasteRecords();
    expect(list.some((r) => r.id === record.id)).toBe(true);
  });

  it('provides whenReady promise and auto-seed capability for 35,000+ master catalog', async () => {
    await expect(db.whenReady()).resolves.toBeUndefined();
    // In node/test environment without window.fetch, autoSeedIfEmpty safely handles environment
    const count = await db.autoSeedIfEmpty();
    expect(typeof count).toBe('number');
  });
});
