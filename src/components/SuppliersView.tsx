import React, { useState, useEffect, useMemo } from 'react';
import type { Supplier, Purchase, Medicine, PharmacySettings } from '../types/pharmacy';
import { db } from '../services/db';
import { sound } from '../utils/audio';
import { 
  Truck, 
  Plus, 
  Search, 
  X, 
  PackagePlus,
  Trash2
} from 'lucide-react';

interface SuppliersViewProps {
  settings: PharmacySettings;
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({ settings }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [search, setSearch] = useState('');

  // Modals
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [isNewPurchaseOpen, setIsNewPurchaseOpen] = useState(false);
  const [payingSupplier, setPayingSupplier] = useState<Supplier | null>(null);
  const [payAmount, setPayAmount] = useState<string>('');

  // New Supplier form
  const [supForm, setSupForm] = useState({
    companyName: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    paymentTerms: 'Credit 30 Days',
  });

  // Purchase Order Form State
  const [poSupplierId, setPoSupplierId] = useState('');
  const [poItems, setPoItems] = useState<{
    medicineId: string;
    medicineName: string;
    batchNumber: string;
    manufacturingDate: string;
    expiryDate: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    sellingPrice: number;
  }[]>([]);
  const [poPaidAmount, setPoPaidAmount] = useState<string>('0');

  const refresh = () => {
    setSuppliers(db.getSuppliers());
    setPurchases(db.getPurchases());
    setMedicines(db.getMedicines());
  };

  useEffect(() => {
    refresh();
    const unsub = db.subscribe(refresh);
    return () => unsub();
  }, []);

  const totalPayable = useMemo(() => {
    return suppliers.reduce((sum, s) => sum + s.balancePayable, 0);
  }, [suppliers]);

  const filtered = useMemo(() => {
    return suppliers.filter((s) => {
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return (
        s.companyName.toLowerCase().includes(q) ||
        s.contactPerson.toLowerCase().includes(q) ||
        s.phone.includes(q)
      );
    });
  }, [suppliers, search]);

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!supForm.companyName || !supForm.phone) {
      alert('Please enter Supplier Company Name and Phone.');
      return;
    }

    db.addSupplier(supForm);
    setIsAddSupplierOpen(false);
    setSupForm({
      companyName: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      paymentTerms: 'Credit 30 Days',
    });
  };

  const handlePaySupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingSupplier) return;
    const amount = parseFloat(payAmount) || 0;
    if (amount <= 0 || amount > payingSupplier.balancePayable) {
      alert('Please enter a valid payment amount.');
      return;
    }

    db.paySupplier(payingSupplier.id, amount);
    sound.playCheckoutSuccess();
    setPayingSupplier(null);
    setPayAmount('');
  };

  // Add line item to PO
  const addPoLine = () => {
    if (medicines.length === 0) return;
    const med = medicines[0];
    setPoItems([
      ...poItems,
      {
        medicineId: med.id,
        medicineName: med.name,
        batchNumber: `B-${Date.now().toString().slice(-4)}`,
        manufacturingDate: new Date().toISOString().slice(0, 10),
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        quantity: 100,
        unitCost: 10,
        totalCost: 1000,
        sellingPrice: 15,
      },
    ]);
  };

  const updatePoItem = (index: number, updates: Partial<(typeof poItems)[0]>) => {
    setPoItems((prev) => {
      const next = [...prev];
      const item = { ...next[index], ...updates };

      if (updates.medicineId) {
        const m = medicines.find((x) => x.id === updates.medicineId);
        if (m) item.medicineName = m.name;
      }

      item.totalCost = item.quantity * item.unitCost;
      next[index] = item;
      return next;
    });
  };

  const removePoItem = (index: number) => {
    setPoItems((prev) => prev.filter((_, i) => i !== index));
  };

  const poTotalAmount = useMemo(() => {
    return poItems.reduce((acc, i) => acc + i.totalCost, 0);
  }, [poItems]);

  const handleCreatePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!poSupplierId) {
      alert('Please select a supplier.');
      return;
    }
    if (poItems.length === 0) {
      alert('Please add at least one medicine item to the purchase order.');
      return;
    }

    const sup = suppliers.find((s) => s.id === poSupplierId);
    if (!sup) return;

    const paid = parseFloat(poPaidAmount) || 0;
    const due = Math.max(0, poTotalAmount - paid);

    db.createPurchase({
      supplierId: sup.id,
      supplierName: sup.companyName,
      purchaseDate: new Date().toISOString(),
      items: poItems,
      totalAmount: poTotalAmount,
      paidAmount: paid,
      dueAmount: due,
      status: 'received',
    });

    sound.playCheckoutSuccess();
    setIsNewPurchaseOpen(false);
    setPoItems([]);
    setPoPaidAmount('0');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Truck className="w-6 h-6 text-emerald-600" />
            <span>Pharma Suppliers & Inward Procurement (GRN)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage pharmaceutical company distributors, record purchase orders, stock inward batches, and track accounts payable.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => {
              if (suppliers.length > 0) setPoSupplierId(suppliers[0].id);
              if (poItems.length === 0) addPoLine();
              setIsNewPurchaseOpen(true);
            }}
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-xl shadow transition-all cursor-pointer"
          >
            <PackagePlus className="w-4 h-4" />
            <span>Stock Inward / New PO</span>
          </button>

          <button
            onClick={() => setIsAddSupplierOpen(true)}
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Supplier</span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search supplier company, contact person, or phone..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase">Registered Suppliers</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{suppliers.length}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Pharma manufacturers & distributors</p>
        </div>

        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 shadow-sm">
          <span className="text-xs font-bold text-amber-700 uppercase">Accounts Payable (Outstanding)</span>
          <div className="text-2xl font-black text-amber-900 mt-1">
            {settings.currency}{totalPayable.toFixed(2)}
          </div>
          <p className="text-[11px] text-amber-600 mt-0.5">Pending payments to suppliers</p>
        </div>

        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-sm">
          <span className="text-xs font-bold text-emerald-700 uppercase">Stock Inward Orders</span>
          <div className="text-2xl font-black text-emerald-900 mt-1">
            {purchases.length}
          </div>
          <p className="text-[11px] text-emerald-600 mt-0.5">Total procurement receipts</p>
        </div>
      </div>

      {/* Suppliers Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Supplier Company</th>
                <th className="py-3 px-4">Representative & Contact</th>
                <th className="py-3 px-4">Address</th>
                <th className="py-3 px-4">Terms</th>
                <th className="py-3 px-4 text-right">Total Purchased</th>
                <th className="py-3 px-4 text-right">Balance Payable</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-slate-900 text-sm">
                    {s.companyName}
                  </td>

                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-800">{s.contactPerson}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{s.phone}</div>
                    <div className="text-[10px] text-slate-400">{s.email}</div>
                  </td>

                  <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                    {s.address}
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-medium">
                      {s.paymentTerms}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                    {settings.currency}{s.totalPurchased.toFixed(2)}
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-xs ${
                        s.balancePayable > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {settings.currency}{s.balancePayable.toFixed(2)}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    {s.balancePayable > 0 ? (
                      <button
                        onClick={() => {
                          setPayingSupplier(s);
                          setPayAmount(s.balancePayable.toString());
                        }}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow cursor-pointer"
                      >
                        Pay Supplier
                      </button>
                    ) : (
                      <span className="text-[11px] text-emerald-700 font-semibold">Settled</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* REGISTER SUPPLIER MODAL */}
      {isAddSupplierOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Register Pharma Supplier</h3>
              <button onClick={() => setIsAddSupplierOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Company / Manufacturer Name *</label>
                <input
                  type="text"
                  required
                  value={supForm.companyName}
                  onChange={(e) => setSupForm({ ...supForm, companyName: e.target.value })}
                  placeholder="e.g. Square Pharmaceuticals Ltd."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Representative / Contact Person</label>
                <input
                  type="text"
                  value={supForm.contactPerson}
                  onChange={(e) => setSupForm({ ...supForm, contactPerson: e.target.value })}
                  placeholder="e.g. Mr. Jahangir Alam"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={supForm.phone}
                  onChange={(e) => setSupForm({ ...supForm, phone: e.target.value })}
                  placeholder="e.g. 01711-001122"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Official Email</label>
                <input
                  type="email"
                  value={supForm.email}
                  onChange={(e) => setSupForm({ ...supForm, email: e.target.value })}
                  placeholder="e.g. sales@squaregroup.com"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Office / Depot Address</label>
                <input
                  type="text"
                  value={supForm.address}
                  onChange={(e) => setSupForm({ ...supForm, address: e.target.value })}
                  placeholder="e.g. Mohakhali C/A, Dhaka"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Payment Terms</label>
                <input
                  type="text"
                  value={supForm.paymentTerms}
                  onChange={(e) => setSupForm({ ...supForm, paymentTerms: e.target.value })}
                  placeholder="e.g. Credit 30 Days / Cash"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddSupplierOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow cursor-pointer"
                >
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NEW PURCHASE / STOCK INWARD MODAL */}
      {isNewPurchaseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Goods Receive Note (GRN) & Stock Inward</h3>
                <p className="text-xs text-slate-400">Receive pharmaceutical stock and automatically generate FEFO batches.</p>
              </div>
              <button onClick={() => setIsNewPurchaseOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePurchase} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Select Supplier *</label>
                  <select
                    required
                    value={poSupplierId}
                    onChange={(e) => setPoSupplierId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>{s.companyName}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Purchase / Inward Date</label>
                  <input
                    type="date"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              {/* Items Table */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">Inward Medicine Items</span>
                  <button
                    type="button"
                    onClick={addPoLine}
                    className="inline-flex items-center space-x-1 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
                      <tr>
                        <th className="py-2 px-3">Medicine</th>
                        <th className="py-2 px-3">Batch No</th>
                        <th className="py-2 px-3">Expiry Date</th>
                        <th className="py-2 px-3 text-center">Quantity</th>
                        <th className="py-2 px-3 text-right">Cost Price</th>
                        <th className="py-2 px-3 text-right">Selling MRP</th>
                        <th className="py-2 px-3 text-right">Total Cost</th>
                        <th className="py-2 px-2 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {poItems.map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3">
                            <select
                              value={item.medicineId}
                              onChange={(e) => updatePoItem(idx, { medicineId: e.target.value })}
                              className="w-44 py-1 px-2 bg-slate-50 border border-slate-200 rounded font-semibold text-slate-800"
                            >
                              {medicines.map((m) => (
                                <option key={m.id} value={m.id}>{m.name} ({m.strength})</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="text"
                              value={item.batchNumber}
                              onChange={(e) => updatePoItem(idx, { batchNumber: e.target.value })}
                              className="w-24 py-1 px-2 bg-slate-50 border border-slate-200 rounded font-mono"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <input
                              type="date"
                              value={item.expiryDate}
                              onChange={(e) => updatePoItem(idx, { expiryDate: e.target.value })}
                              className="py-1 px-2 bg-slate-50 border border-slate-200 rounded"
                            />
                          </td>
                          <td className="py-2 px-3 text-center">
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updatePoItem(idx, { quantity: parseInt(e.target.value) || 1 })}
                              className="w-16 text-center py-1 px-1 bg-slate-50 border border-slate-200 rounded font-bold"
                            />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              step="any"
                              value={item.unitCost}
                              onChange={(e) => updatePoItem(idx, { unitCost: parseFloat(e.target.value) || 0 })}
                              className="w-20 text-right py-1 px-1 bg-slate-50 border border-slate-200 rounded"
                            />
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              step="any"
                              value={item.sellingPrice}
                              onChange={(e) => updatePoItem(idx, { sellingPrice: parseFloat(e.target.value) || 0 })}
                              className="w-20 text-right py-1 px-1 bg-slate-50 border border-slate-200 rounded font-bold text-slate-900"
                            />
                          </td>
                          <td className="py-2 px-3 text-right font-black text-slate-900">
                            {settings.currency}{item.totalCost.toFixed(2)}
                          </td>
                          <td className="py-2 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => removePoItem(idx)}
                              className="text-slate-400 hover:text-rose-600 p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals & Payment */}
              <div className="p-4 bg-slate-50 rounded-xl space-y-3">
                <div className="flex justify-between items-center text-sm font-black">
                  <span>Total Purchase Invoice Value:</span>
                  <span className="text-emerald-700">{settings.currency}{poTotalAmount.toFixed(2)}</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Amount Paid Immediately</label>
                    <input
                      type="number"
                      step="any"
                      value={poPaidAmount}
                      onChange={(e) => setPoPaidAmount(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Due / Accounts Payable</label>
                    <div className="px-3 py-2 bg-slate-200/80 rounded-xl font-bold text-slate-800">
                      {settings.currency}{Math.max(0, poTotalAmount - (parseFloat(poPaidAmount) || 0)).toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewPurchaseOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow cursor-pointer"
                >
                  Receive Stock & Update Inventory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAY SUPPLIER MODAL */}
      {payingSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Disburse Supplier Payment</h3>
                <p className="text-xs text-slate-400">Supplier: {payingSupplier.companyName}</p>
              </div>
              <button onClick={() => setPayingSupplier(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePaySupplier} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex justify-between items-center">
                <span className="font-bold text-amber-800">Outstanding Payable:</span>
                <span className="font-black text-sm text-amber-900">
                  {settings.currency}{payingSupplier.balancePayable.toFixed(2)}
                </span>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Amount to Pay *</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setPayingSupplier(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow cursor-pointer"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
