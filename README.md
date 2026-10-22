# 💊 MedCare Pharmacy Management System (PMS)

An enterprise-grade, commercial **Pharmacy Management & Point-of-Sale (POS) System** engineered with React 19, TypeScript, Tailwind CSS, and transactional FEFO batch tracking. Designed specifically for retail pharmacies, hospital dispensaries, and pharmaceutical chain stores.

---

## 🌟 Key Highlights & Modules

### 1. 🛒 High-Speed Point of Sale (POS) Billing
- **Instant Barcode & Name Lookup:** Ultra-fast debounced search across Brand Name, Generic Name, Barcode SKU, and Shelf/Rack location.
- **Synthesized POS Audio Engine:** Native Web Audio API barcode beeps, checkout chimes, and warning alerts without external audio file dependencies.
- **FEFO Batch Auto-Selection:** Automatically pulls from the earliest expiring active batch in stock to minimize medication wastage.
- **Strip & Box Conversions:** Dynamic quantity and pricing conversion between individual pieces and whole blister boxes.
- **Multi-Channel Payments:** Supports Cash (with automatic return change calculation and quick denomination tenders), bKash, Nagad, Card, and Credit / Due sales.
- **80mm Thermal Receipt Generator:** Pixel-perfect printable POS receipt with customer details, batch numbers, expiry dates, VAT calculation, and barcode simulation.

### 2. 📦 Pharmaceutical Inventory & Catalog
- Pre-seeded with over **28+ real pharmaceutical formulations** spanning 10 therapeutic categories (Analgesics, PPIs, Antibiotics, Antihistamines, Respiratory, Antidiabetic, Cardiovascular, Multivitamins, Gastro, Topicals, Eye Drops).
- Multi-batch tracking with cost price, retail MRP, manufacturing date, expiry date, and storage location (Rack/Shelf/Fridge).
- Real-time stock status badges: `In Stock`, `Low Stock`, and `Out of Stock`.

### 3. ⏳ FEFO Expiry & Batch Lifecycle Tracker
- Color-coded urgency levels:
  - 🔴 **Expired:** Immediate quarantine and disposal write-off.
  - 🟠 **Critical (< 30 Days):** High priority FEFO liquidation.
  - 🟡 **Warning (30 – 90 Days):** Advance notice for supplier returns.
  - 🟢 **Safe (> 90 Days):** Healthy inventory circulation.
- One-click batch disposal with automated regulatory audit logging.

### 4. 🩺 Prescription Registry & Antibiotic Stewardship
- Formal log of prescribed medicines linked with doctor BMDC registration numbers.
- Regulatory filtering for restricted antibiotics and prescription-only medications.
- Registered medical practitioner directory.

### 5. 👥 Customer Directory & Khata (Credit Ledger)
- Customer profiles with purchase history and credit limits.
- Instant due collection modal with receipt logging and real-time balance adjustment.

### 6. 🚚 Supplier Procurement & Goods Receive Note (GRN)
- Supplier directory with contact persons, company details, and accounts payable balances.
- Stock inward purchase orders that automatically generate new FEFO batches and increment inventory.
- Supplier payment recording.

### 7. 📊 Financial Intelligence & Business Reports
- Real-time gross profit and profit margin calculation ($Revenue - Cost - VAT$).
- Top grossing medicines and revenue distribution by payment channel.
- One-click **Export to CSV** for accounting and tax compliance.

### 8. 🛡️ Security, RBAC & Audit Trail
- Role-based views: **Admin**, **Pharmacist**, and **Cashier**.
- Immutable audit log capturing stock adjustments, price edits, POS sales, and disposals.
- Portable JSON backup export & restore.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 18+ (Tested on Node.js 20 & 26)
- npm 9+

### Installation
```bash
# Clone the repository
git clone https://github.com/Adnin1/pharmacy-management-system.git

# Enter the directory
cd pharmacy-management-system

# Install dependencies
npm install

# Start development server
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Automated Testing

Run the Vitest automated test suite:
```bash
npx vitest run
```
All unit tests verify:
- Initial database seeding
- FEFO batch ordering invariants
- POS checkout & stock decrement calculations
- Customer due balances and collections
- Database backup JSON export & restore

---

## 🐳 Docker Deployment

Run the multi-stage production Docker container:
```bash
docker compose up -d --build
```
Access the application at [http://localhost:3000](http://localhost:3000).

---

## ⌨️ Keyboard Shortcuts
| Shortcut | Action |
|---|---|
| `F1` | Open POS Billing Workstation |
| `F2` | Open Medicine Catalog & Inventory |
| `F3` | Open FEFO Expiry Tracker |
| `F4` | Open Prescription & Antibiotic Register |
| `F5` | Open Customers & Due Ledger |
| `F6` | Open Supplier Procurement (GRN) |
| `F7` | Open Financial Analytics & Reports |
| `Enter` (in search) | Add first search result directly to cart |

---

## 📄 License
MIT License. Built for commercial pharmacy management.
