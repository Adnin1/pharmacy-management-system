export type DosageForm = 
  | 'Tablet' 
  | 'Capsule' 
  | 'Syrup' 
  | 'Suspension' 
  | 'Injection' 
  | 'Ointment' 
  | 'Eye Drops' 
  | 'Inhaler' 
  | 'IV Fluid'
  | 'Suppository'
  | 'Pre-filled Syringe'
  | 'Powder for Suspension';

export type TherapeuticCategory = 
  | 'Analgesic & Antipyretic'
  | 'Anti-ulcerant & PPI'
  | 'Antibiotic & Antimicrobial'
  | 'Antihistamine & Allergy'
  | 'Respiratory & Asthma'
  | 'Cardiovascular & Antihypertensive'
  | 'Antidiabetic'
  | 'Multivitamin & Supplement'
  | 'Gastrointestinal & Antispasmodic'
  | 'Dermatological & Topical'
  | 'Ophthalmic'
  | 'Oncology & Chemotherapy'
  | 'Biotech & Hormones'
  | 'Vaccine & Immunological'
  | 'Herbal & Nutraceutical';

export type SpecialSegment = 
  | 'All'
  | 'Antimicrobial'
  | 'Biotech'
  | 'Hematology'
  | 'Hormone'
  | 'Imported'
  | 'mAb'
  | 'Oncology'
  | 'OTC'
  | 'Probiotics'
  | 'Vaccine'
  | 'Herbal';

export type MedicineType = 'Allopathic' | 'Herbal' | 'Nutraceutical' | 'Biochemical';

export interface Medicine {
  id: string;
  name: string;
  genericName: string;
  category: TherapeuticCategory;
  specialSegment?: SpecialSegment;
  medicineType?: MedicineType;
  drugClass?: string;
  dosageForm: DosageForm;
  strength: string;
  manufacturer: string;
  unit: string; // e.g. 'Pcs', 'Strip', 'Bottle', 'Vial', 'Canister'
  unitsPerBox: number;
  reorderLevel: number;
  rackLocation: string; // e.g. 'Rack A-1', 'Cold Storage (2°C - 8°C)', 'Locked Narcotic Shelf'
  isColdChain?: boolean; // Requires 2°C - 8°C refrigeration
  packSize?: string;
  description?: string;
  requiresPrescription: boolean;
  isAntibiotic: boolean;
  isNarcotic: boolean;
  barcode: string;
  createdAt: string;
  updatedAt: string;
}

export type BatchStatus = 'active' | 'quarantine' | 'expired' | 'depleted';

export interface Batch {
  id: string;
  medicineId: string;
  batchNumber: string;
  manufacturingDate: string; // YYYY-MM-DD
  expiryDate: string; // YYYY-MM-DD
  purchasePrice: number; // Cost per unit
  sellingPrice: number; // MRP per unit
  quantityInStock: number;
  status: BatchStatus;
  supplierId?: string;
}

export interface CartItem {
  medicine: Medicine;
  batch: Batch;
  quantity: number;
  unitType: 'piece' | 'strip' | 'box';
  unitPrice: number;
  costPrice: number;
  discountPercent: number;
  total: number;
}

export type PaymentMethod = 'cash' | 'bkash' | 'nagad' | 'card' | 'due';

export interface SaleItem {
  medicineId: string;
  medicineName: string;
  genericName: string;
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  unitType: 'piece' | 'strip' | 'box';
  unitPrice: number;
  costPrice: number;
  discountPercent: number;
  totalPrice: number;
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  doctorName?: string;
  doctorBmdc?: string;
  items: SaleItem[];
  subtotal: number;
  discountAmount: number;
  vatPercent: number;
  vatAmount: number;
  grandTotal: number;
  paidAmount: number;
  changeAmount: number;
  dueAmount: number;
  paymentMethod: PaymentMethod;
  cashierName: string;
  notes?: string;
  status: 'completed' | 'returned' | 'partial_return';
}

export interface HeldSale {
  id: string;
  heldAt: string;
  customer: Customer | null;
  doctor: Doctor | null;
  items: CartItem[];
  subtotal: number;
  notes?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  totalSpent: number;
  dueBalance: number;
  creditLimit: number;
  createdAt: string;
  lastVisit: string;
}

export interface Doctor {
  id: string;
  name: string;
  bmdcNumber: string;
  specialization: string;
  hospitalOrChamber: string;
  phone?: string;
  prescriptionCount: number;
}

export interface Supplier {
  id: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  totalPurchased: number;
  balancePayable: number;
  paymentTerms: string;
}

export interface PurchaseItem {
  medicineId: string;
  medicineName: string;
  batchNumber: string;
  manufacturingDate: string;
  expiryDate: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  sellingPrice: number;
}

export interface Purchase {
  id: string;
  purchaseInvoiceNumber: string;
  supplierId: string;
  supplierName: string;
  purchaseDate: string;
  items: PurchaseItem[];
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: 'received' | 'pending';
  notes?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  ipAddress?: string;
}

export interface PharmacySettings {
  pharmacyName: string;
  tagline: string;
  hotline: string;
  address: string;
  email: string;
  tradeLicenseNo: string;
  vatRegNo: string;
  currency: string;
  defaultVatRate: number;
  invoiceFooterMsg: string;
  lowStockThresholdDays: number;
}

export type UserRole = 'admin' | 'pharmacist' | 'cashier';

export interface User {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  email: string;
}
