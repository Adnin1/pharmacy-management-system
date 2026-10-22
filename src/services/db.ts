import type { 
  Medicine, 
  Batch, 
  Customer, 
  Doctor, 
  Supplier, 
  Sale, 
  Purchase, 
  PharmacySettings, 
  AuditLog,
  CartItem
} from '../types/pharmacy';
import { 
  initialMedicines, 
  initialBatches, 
  initialCustomers, 
  initialDoctors, 
  initialSuppliers, 
  initialSales, 
  initialSettings, 
  initialAuditLogs 
} from './seedData';

const STORAGE_KEYS = {
  MEDICINES: 'pms_medicines_v1',
  BATCHES: 'pms_batches_v1',
  CUSTOMERS: 'pms_customers_v1',
  DOCTORS: 'pms_doctors_v1',
  SUPPLIERS: 'pms_suppliers_v1',
  SALES: 'pms_sales_v1',
  PURCHASES: 'pms_purchases_v1',
  SETTINGS: 'pms_settings_v1',
  AUDIT_LOGS: 'pms_audit_logs_v1',
};

type Listener = () => void;

class DatabaseService {
  private listeners: Set<Listener> = new Set();
  private memoryStore: Map<string, string> = new Map();

  private isStorageAvailable(): boolean {
    try {
      return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined' && window.localStorage !== null;
    } catch {
      return false;
    }
  }

  private getItem(key: string): string | null {
    if (this.isStorageAvailable()) {
      return window.localStorage.getItem(key);
    }
    return this.memoryStore.get(key) || null;
  }

  private setItem(key: string, value: string): void {
    if (this.isStorageAvailable()) {
      window.localStorage.setItem(key, value);
    } else {
      this.memoryStore.set(key, value);
    }
  }

  private removeItem(key: string): void {
    if (this.isStorageAvailable()) {
      window.localStorage.removeItem(key);
    } else {
      this.memoryStore.delete(key);
    }
  }

  private load<T>(key: string, fallback: T): T {
    try {
      const data = this.getItem(key);
      if (!data) {
        this.setItem(key, JSON.stringify(fallback));
        return fallback;
      }
      return JSON.parse(data) as T;
    } catch {
      return fallback;
    }
  }

  private save<T>(key: string, data: T): void {
    try {
      this.setItem(key, JSON.stringify(data));
      this.notify();
    } catch (e) {
      console.error('Database write error:', e);
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Listener notify error:', err);
      }
    });
  }

  // ===================== SETTINGS =====================
  getSettings(): PharmacySettings {
    return this.load<PharmacySettings>(STORAGE_KEYS.SETTINGS, initialSettings);
  }

  updateSettings(settings: PharmacySettings): void {
    this.save(STORAGE_KEYS.SETTINGS, settings);
    this.logAction('SETTINGS_UPDATE', 'Pharmacy profile and configuration updated.');
  }

  // ===================== MEDICINES =====================
  getMedicines(): Medicine[] {
    return this.load<Medicine[]>(STORAGE_KEYS.MEDICINES, initialMedicines);
  }

  getMedicineById(id: string): Medicine | undefined {
    return this.getMedicines().find((m) => m.id === id);
  }

  addMedicine(medicine: Omit<Medicine, 'id' | 'createdAt' | 'updatedAt'>): Medicine {
    const medicines = this.getMedicines();
    const newMedicine: Medicine = {
      ...medicine,
      id: `med-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    medicines.unshift(newMedicine);
    this.save(STORAGE_KEYS.MEDICINES, medicines);
    this.logAction('MEDICINE_CREATE', `Added medicine: ${newMedicine.name} (${newMedicine.genericName})`);
    return newMedicine;
  }

  updateMedicine(id: string, updates: Partial<Medicine>): Medicine | null {
    const medicines = this.getMedicines();
    const idx = medicines.findIndex((m) => m.id === id);
    if (idx === -1) return null;
    const updated = {
      ...medicines[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    medicines[idx] = updated;
    this.save(STORAGE_KEYS.MEDICINES, medicines);
    this.logAction('MEDICINE_UPDATE', `Updated medicine: ${updated.name}`);
    return updated;
  }

  deleteMedicine(id: string): boolean {
    const medicines = this.getMedicines();
    const target = medicines.find((m) => m.id === id);
    if (!target) return false;
    const filtered = medicines.filter((m) => m.id !== id);
    this.save(STORAGE_KEYS.MEDICINES, filtered);
    this.logAction('MEDICINE_DELETE', `Deleted medicine: ${target.name} [ID: ${id}]`);
    return true;
  }

  // ===================== BATCHES & FEFO =====================
  getBatches(): Batch[] {
    return this.load<Batch[]>(STORAGE_KEYS.BATCHES, initialBatches);
  }

  // FEFO (First Expire First Out) sorting: Returns valid in-stock batches ordered by earliest expiry date
  getBatchesForMedicine(medicineId: string, includeDepleted = false): Batch[] {
    const batches = this.getBatches().filter((b) => b.medicineId === medicineId);
    const valid = includeDepleted ? batches : batches.filter((b) => b.quantityInStock > 0);
    return valid.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
  }

  // Returns total stock for a medicine across all active batches
  getMedicineStock(medicineId: string): number {
    return this.getBatchesForMedicine(medicineId).reduce((sum, b) => sum + b.quantityInStock, 0);
  }

  addBatch(batch: Omit<Batch, 'id' | 'status'>): Batch {
    const batches = this.getBatches();
    const isExpired = new Date(batch.expiryDate) < new Date();
    const newBatch: Batch = {
      ...batch,
      id: `batch-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      status: isExpired ? 'expired' : 'active',
    };
    batches.unshift(newBatch);
    this.save(STORAGE_KEYS.BATCHES, batches);
    this.logAction('BATCH_CREATE', `Added Batch ${newBatch.batchNumber} with ${newBatch.quantityInStock} units. Expiry: ${newBatch.expiryDate}`);
    return newBatch;
  }

  updateBatch(id: string, updates: Partial<Batch>): Batch | null {
    const batches = this.getBatches();
    const idx = batches.findIndex((b) => b.id === id);
    if (idx === -1) return null;
    const updated = { ...batches[idx], ...updates };
    batches[idx] = updated;
    this.save(STORAGE_KEYS.BATCHES, batches);
    return updated;
  }

  // ===================== POS & SALES TRANSACTIONS =====================
  getSales(): Sale[] {
    return this.load<Sale[]>(STORAGE_KEYS.SALES, initialSales);
  }

  // Atomic POS Sale Execution
  processSale(params: {
    cartItems: CartItem[];
    customer?: Customer | null;
    walkInName?: string;
    customerPhone?: string;
    doctor?: Doctor | null;
    discountAmount: number;
    vatPercent: number;
    paymentMethod: 'cash' | 'bkash' | 'nagad' | 'card' | 'due';
    paidAmount: number;
    notes?: string;
    cashierName: string;
  }): Sale {
    const batches = this.getBatches();
    const saleItems = params.cartItems.map((item) => {
      // Find batch and decrement quantity
      const bIdx = batches.findIndex((b) => b.id === item.batch.id);
      if (bIdx !== -1) {
        const remaining = Math.max(0, batches[bIdx].quantityInStock - item.quantity);
        batches[bIdx].quantityInStock = remaining;
        if (remaining === 0) {
          batches[bIdx].status = 'depleted';
        }
      }

      return {
        medicineId: item.medicine.id,
        medicineName: item.medicine.name,
        genericName: item.medicine.genericName,
        batchId: item.batch.id,
        batchNumber: item.batch.batchNumber,
        expiryDate: item.batch.expiryDate,
        quantity: item.quantity,
        unitType: item.unitType,
        unitPrice: item.unitPrice,
        costPrice: item.costPrice,
        discountPercent: item.discountPercent,
        totalPrice: item.total,
      };
    });

    // Save updated batches
    this.save(STORAGE_KEYS.BATCHES, batches);

    // Compute financial totals
    const subtotal = saleItems.reduce((acc, i) => acc + i.totalPrice, 0);
    const taxableAmount = Math.max(0, subtotal - params.discountAmount);
    const vatAmount = Number(((taxableAmount * params.vatPercent) / 100).toFixed(2));
    const grandTotal = Number((taxableAmount + vatAmount).toFixed(2));

    let dueAmount = 0;
    let changeAmount = 0;

    if (params.paymentMethod === 'due') {
      dueAmount = grandTotal;
      changeAmount = 0;
    } else {
      if (params.paidAmount >= grandTotal) {
        changeAmount = Number((params.paidAmount - grandTotal).toFixed(2));
        dueAmount = 0;
      } else {
        dueAmount = Number((grandTotal - params.paidAmount).toFixed(2));
        changeAmount = 0;
      }
    }

    const now = new Date();
    const invCount = this.getSales().length + 1001;
    const invoiceNumber = `INV-${now.getFullYear()}-${invCount}`;

    const newSale: Sale = {
      id: `sale-${Date.now()}`,
      invoiceNumber,
      createdAt: now.toISOString(),
      customerId: params.customer?.id,
      customerName: params.customer?.name || params.walkInName || 'Walk-in Customer',
      customerPhone: params.customer?.phone || params.customerPhone || '',
      doctorName: params.doctor?.name,
      doctorBmdc: params.doctor?.bmdcNumber,
      items: saleItems,
      subtotal,
      discountAmount: params.discountAmount,
      vatPercent: params.vatPercent,
      vatAmount,
      grandTotal,
      paidAmount: params.paymentMethod === 'due' ? 0 : Math.min(params.paidAmount, grandTotal),
      changeAmount,
      dueAmount,
      paymentMethod: params.paymentMethod,
      cashierName: params.cashierName,
      notes: params.notes,
      status: 'completed',
    };

    // Save sale
    const sales = this.getSales();
    sales.unshift(newSale);
    this.save(STORAGE_KEYS.SALES, sales);

    // Update customer stats & due ledger if applicable
    if (params.customer) {
      const customers = this.getCustomers();
      const cIdx = customers.findIndex((c) => c.id === params.customer?.id);
      if (cIdx !== -1) {
        customers[cIdx].totalSpent += grandTotal;
        customers[cIdx].dueBalance += dueAmount;
        customers[cIdx].lastVisit = now.toISOString();
        this.save(STORAGE_KEYS.CUSTOMERS, customers);
      }
    }

    // Update doctor prescription count if applicable
    if (params.doctor) {
      const doctors = this.getDoctors();
      const dIdx = doctors.findIndex((d) => d.id === params.doctor?.id);
      if (dIdx !== -1) {
        doctors[dIdx].prescriptionCount += 1;
        this.save(STORAGE_KEYS.DOCTORS, doctors);
      }
    }

    this.logAction('POS_SALE', `Invoice ${invoiceNumber} created. Total: ৳${grandTotal.toFixed(2)}, Paid: ৳${newSale.paidAmount.toFixed(2)}, Due: ৳${dueAmount.toFixed(2)}.`);

    return newSale;
  }

  // ===================== CUSTOMERS =====================
  getCustomers(): Customer[] {
    return this.load<Customer[]>(STORAGE_KEYS.CUSTOMERS, initialCustomers);
  }

  addCustomer(customer: Omit<Customer, 'id' | 'createdAt' | 'lastVisit' | 'totalSpent' | 'dueBalance'>): Customer {
    const customers = this.getCustomers();
    const newCustomer: Customer = {
      ...customer,
      id: `cust-${Date.now()}`,
      totalSpent: 0,
      dueBalance: 0,
      createdAt: new Date().toISOString(),
      lastVisit: new Date().toISOString(),
    };
    customers.unshift(newCustomer);
    this.save(STORAGE_KEYS.CUSTOMERS, customers);
    this.logAction('CUSTOMER_CREATE', `Registered customer: ${newCustomer.name} (${newCustomer.phone})`);
    return newCustomer;
  }

  collectCustomerDue(customerId: string, amount: number, notes?: string): boolean {
    const customers = this.getCustomers();
    const idx = customers.findIndex((c) => c.id === customerId);
    if (idx === -1) return false;
    customers[idx].dueBalance = Math.max(0, customers[idx].dueBalance - amount);
    this.save(STORAGE_KEYS.CUSTOMERS, customers);
    this.logAction('DUE_COLLECTION', `Collected ৳${amount.toFixed(2)} due from ${customers[idx].name}. ${notes || ''}`);
    return true;
  }

  // ===================== DOCTORS =====================
  getDoctors(): Doctor[] {
    return this.load<Doctor[]>(STORAGE_KEYS.DOCTORS, initialDoctors);
  }

  addDoctor(doctor: Omit<Doctor, 'id' | 'prescriptionCount'>): Doctor {
    const doctors = this.getDoctors();
    const newDoctor: Doctor = {
      ...doctor,
      id: `doc-${Date.now()}`,
      prescriptionCount: 0,
    };
    doctors.unshift(newDoctor);
    this.save(STORAGE_KEYS.DOCTORS, doctors);
    this.logAction('DOCTOR_CREATE', `Added doctor: ${newDoctor.name} (BMDC: ${newDoctor.bmdcNumber})`);
    return newDoctor;
  }

  // ===================== SUPPLIERS & PROCUREMENT =====================
  getSuppliers(): Supplier[] {
    return this.load<Supplier[]>(STORAGE_KEYS.SUPPLIERS, initialSuppliers);
  }

  addSupplier(supplier: Omit<Supplier, 'id' | 'totalPurchased' | 'balancePayable'>): Supplier {
    const suppliers = this.getSuppliers();
    const newSupplier: Supplier = {
      ...supplier,
      id: `sup-${Date.now()}`,
      totalPurchased: 0,
      balancePayable: 0,
    };
    suppliers.unshift(newSupplier);
    this.save(STORAGE_KEYS.SUPPLIERS, suppliers);
    this.logAction('SUPPLIER_CREATE', `Added supplier: ${newSupplier.companyName}`);
    return newSupplier;
  }

  paySupplier(supplierId: string, amount: number, notes?: string): boolean {
    const suppliers = this.getSuppliers();
    const idx = suppliers.findIndex((s) => s.id === supplierId);
    if (idx === -1) return false;
    suppliers[idx].balancePayable = Math.max(0, suppliers[idx].balancePayable - amount);
    this.save(STORAGE_KEYS.SUPPLIERS, suppliers);
    this.logAction('SUPPLIER_PAYMENT', `Paid ৳${amount.toFixed(2)} to supplier: ${suppliers[idx].companyName}. ${notes || ''}`);
    return true;
  }

  getPurchases(): Purchase[] {
    return this.load<Purchase[]>(STORAGE_KEYS.PURCHASES, []);
  }

  createPurchase(purchase: Omit<Purchase, 'id' | 'purchaseInvoiceNumber'>): Purchase {
    const purchases = this.getPurchases();
    const purchaseInvoiceNumber = `PO-${Date.now().toString().slice(-6)}`;
    const newPurchase: Purchase = {
      ...purchase,
      id: `pur-${Date.now()}`,
      purchaseInvoiceNumber,
    };

    // Add batches or increment existing stock
    purchase.items.forEach((item) => {
      this.addBatch({
        medicineId: item.medicineId,
        batchNumber: item.batchNumber,
        manufacturingDate: item.manufacturingDate,
        expiryDate: item.expiryDate,
        purchasePrice: item.unitCost,
        sellingPrice: item.sellingPrice,
        quantityInStock: item.quantity,
        supplierId: purchase.supplierId,
      });
    });

    // Update supplier balance
    const suppliers = this.getSuppliers();
    const sIdx = suppliers.findIndex((s) => s.id === purchase.supplierId);
    if (sIdx !== -1) {
      suppliers[sIdx].totalPurchased += purchase.totalAmount;
      suppliers[sIdx].balancePayable += purchase.dueAmount;
      this.save(STORAGE_KEYS.SUPPLIERS, suppliers);
    }

    purchases.unshift(newPurchase);
    this.save(STORAGE_KEYS.PURCHASES, purchases);
    this.logAction('PURCHASE_RECEIVE', `Received stock for PO ${purchaseInvoiceNumber} from ${purchase.supplierName}. Total: ৳${purchase.totalAmount.toFixed(2)}`);
    return newPurchase;
  }

  // ===================== AUDIT LOGS =====================
  getAuditLogs(): AuditLog[] {
    return this.load<AuditLog[]>(STORAGE_KEYS.AUDIT_LOGS, initialAuditLogs);
  }

  logAction(action: string, details: string, userName = 'Adnin Sadat', userId = 'user-admin'): void {
    const logs = this.getAuditLogs();
    const newLog: AuditLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      userId,
      userName,
      action,
      details,
    };
    logs.unshift(newLog);
    // Keep last 500 audit events
    if (logs.length > 500) logs.pop();
    this.save(STORAGE_KEYS.AUDIT_LOGS, logs);
  }

  // ===================== BACKUP & RESTORE =====================
  exportFullBackup(): string {
    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      settings: this.getSettings(),
      medicines: this.getMedicines(),
      batches: this.getBatches(),
      customers: this.getCustomers(),
      doctors: this.getDoctors(),
      suppliers: this.getSuppliers(),
      sales: this.getSales(),
      purchases: this.getPurchases(),
      auditLogs: this.getAuditLogs(),
    };
    return JSON.stringify(backup, null, 2);
  }

  importFullBackup(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.medicines && parsed.batches && parsed.settings) {
        this.save(STORAGE_KEYS.SETTINGS, parsed.settings);
        this.save(STORAGE_KEYS.MEDICINES, parsed.medicines);
        this.save(STORAGE_KEYS.BATCHES, parsed.batches);
        if (parsed.customers) this.save(STORAGE_KEYS.CUSTOMERS, parsed.customers);
        if (parsed.doctors) this.save(STORAGE_KEYS.DOCTORS, parsed.doctors);
        if (parsed.suppliers) this.save(STORAGE_KEYS.SUPPLIERS, parsed.suppliers);
        if (parsed.sales) this.save(STORAGE_KEYS.SALES, parsed.sales);
        if (parsed.purchases) this.save(STORAGE_KEYS.PURCHASES, parsed.purchases);
        if (parsed.auditLogs) this.save(STORAGE_KEYS.AUDIT_LOGS, parsed.auditLogs);
        this.logAction('BACKUP_RESTORE', 'System restored from JSON backup archive.');
        return true;
      }
      return false;
    } catch (e) {
      console.error('Backup import error:', e);
      return false;
    }
  }

  resetToDemoData(): void {
    this.removeItem(STORAGE_KEYS.MEDICINES);
    this.removeItem(STORAGE_KEYS.BATCHES);
    this.removeItem(STORAGE_KEYS.CUSTOMERS);
    this.removeItem(STORAGE_KEYS.DOCTORS);
    this.removeItem(STORAGE_KEYS.SUPPLIERS);
    this.removeItem(STORAGE_KEYS.SALES);
    this.removeItem(STORAGE_KEYS.PURCHASES);
    this.removeItem(STORAGE_KEYS.SETTINGS);
    this.removeItem(STORAGE_KEYS.AUDIT_LOGS);

    this.save(STORAGE_KEYS.SETTINGS, initialSettings);
    this.save(STORAGE_KEYS.MEDICINES, initialMedicines);
    this.save(STORAGE_KEYS.BATCHES, initialBatches);
    this.save(STORAGE_KEYS.CUSTOMERS, initialCustomers);
    this.save(STORAGE_KEYS.DOCTORS, initialDoctors);
    this.save(STORAGE_KEYS.SUPPLIERS, initialSuppliers);
    this.save(STORAGE_KEYS.SALES, initialSales);
    this.save(STORAGE_KEYS.PURCHASES, []);
    this.save(STORAGE_KEYS.AUDIT_LOGS, initialAuditLogs);

    this.logAction('FACTORY_RESET', 'Database reset to initial factory demo dataset.');
  }
}

export const db = new DatabaseService();
