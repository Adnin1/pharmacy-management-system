import React, { useState, useEffect, useMemo } from 'react';
import type { 
  Sale, 
  SaleReturn, 
  DamageWasteItem, 
  PharmacySettings, 
  Medicine, 
  Batch,
  Supplier
} from '../types/pharmacy';
import { db } from '../services/db';
import { sound } from '../utils/audio';
import { 
  RotateCcw, 
  FileText, 
  Search, 
  Printer, 
  CheckCircle2, 
  Building2, 
  ShieldAlert, 
  X,
  FileCheck2
} from 'lucide-react';

interface ReturnsViewProps {
  settings: PharmacySettings;
}

export const ReturnsView: React.FC<ReturnsViewProps> = ({ settings }) => {
  const [activeTab, setActiveTab] = useState<'customer_returns' | 'company_claims'>('customer_returns');

  // Customer returns state
  const [sales, setSales] = useState<Sale[]>([]);
  const [returns, setReturns] = useState<SaleReturn[]>([]);
  const [searchInvoice, setSearchInvoice] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  const [returnReasons, setReturnReasons] = useState<Record<string, string>>({});
  const [refundMethod, setRefundMethod] = useState<'cash' | 'credit_note' | 'bkash' | 'nagad'>('cash');
  const [returnNotes, setReturnNotes] = useState('');
  const [activePrintReturn, setActivePrintReturn] = useState<SaleReturn | null>(null);

  // Company claims state
  const [damageRecords, setDamageRecords] = useState<DamageWasteItem[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // New damage claim form
  const [claimMedId, setClaimMedId] = useState('');
  const [claimBatchId, setClaimBatchId] = useState('');
  const [claimQty, setClaimQty] = useState<number>(1);
  const [claimReason, setClaimReason] = useState<'expired' | 'damaged' | 'broken' | 'recalled'>('expired');
  const [claimAction, setClaimAction] = useState<'returned_to_company' | 'discarded'>('returned_to_company');
  const [claimSupplierName, setClaimSupplierName] = useState('');
  const [claimNotes, setClaimNotes] = useState('');
  const [activePrintChallan, setActivePrintChallan] = useState<DamageWasteItem | null>(null);

  const refreshData = () => {
    setSales(db.getSales());
    setReturns(db.getSaleReturns());
    setDamageRecords(db.getDamageWasteRecords());
    setMedicines(db.getMedicines());
    setBatches(db.getBatches());
    setSuppliers(db.getSuppliers());
  };

  useEffect(() => {
    refreshData();
    const unsub = db.subscribe(refreshData);
    return () => unsub();
  }, []);

  // Filtered sales for lookup
  const filteredSales = useMemo(() => {
    const q = searchInvoice.trim().toLowerCase();
    if (!q) return sales.slice(0, 10);
    return sales.filter(
      (s) =>
        s.invoiceNumber.toLowerCase().includes(q) ||
        s.customerName.toLowerCase().includes(q) ||
        (s.customerPhone && s.customerPhone.includes(q))
    ).slice(0, 15);
  }, [sales, searchInvoice]);

  // Handle selecting a sale for return
  const handleSelectSale = (sale: Sale) => {
    setSelectedSale(sale);
    const initialQtys: Record<string, number> = {};
    const initialReasons: Record<string, string> = {};
    sale.items.forEach((item) => {
      initialQtys[item.batchId] = 0;
      initialReasons[item.batchId] = 'Doctor changed prescription';
    });
    setReturnQuantities(initialQtys);
    setReturnReasons(initialReasons);
  };

  // Calculate live return refund total
  const calculatedRefundTotal = useMemo(() => {
    if (!selectedSale) return 0;
    let sum = 0;
    selectedSale.items.forEach((item) => {
      const q = returnQuantities[item.batchId] || 0;
      sum += q * item.unitPrice;
    });
    return Number(sum.toFixed(2));
  }, [selectedSale, returnQuantities]);

  // Submit Customer Return
  const handleProcessCustomerReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSale) return;

    const itemsToReturn = selectedSale.items
      .filter((item) => (returnQuantities[item.batchId] || 0) > 0)
      .map((item) => {
        const qty = returnQuantities[item.batchId];
        return {
          medicineId: item.medicineId,
          medicineName: item.medicineName,
          genericName: item.genericName,
          batchId: item.batchId,
          batchNumber: item.batchNumber,
          quantity: qty,
          unitPrice: item.unitPrice,
          totalRefund: Number((qty * item.unitPrice).toFixed(2)),
          reason: returnReasons[item.batchId] || 'Doctor changed prescription',
        };
      });

    if (itemsToReturn.length === 0) {
      sound.playWarning();
      alert('Please specify a return quantity of at least 1 item.');
      return;
    }

    try {
      const saleReturn = db.processSaleReturn({
        originalSaleId: selectedSale.id,
        originalInvoiceNumber: selectedSale.invoiceNumber,
        customerId: selectedSale.customerId,
        customerName: selectedSale.customerName,
        customerPhone: selectedSale.customerPhone,
        items: itemsToReturn,
        refundMethod,
        cashierName: 'On-Duty Pharmacist',
        notes: returnNotes,
      });

      sound.playCheckoutSuccess();
      setActivePrintReturn(saleReturn);
      setSelectedSale(null);
      setReturnQuantities({});
      setReturnNotes('');
    } catch (err) {
      sound.playWarning();
      console.error(err);
      alert('Failed to process sale return.');
    }
  };

  // Batches for chosen claim medicine
  const availableBatchesForClaim = useMemo(() => {
    if (!claimMedId) return [];
    return batches.filter((b) => b.medicineId === claimMedId && b.quantityInStock > 0);
  }, [claimMedId, batches]);

  // Submit Company Claim
  const handleProcessCompanyClaim = (e: React.FormEvent) => {
    e.preventDefault();
    const med = medicines.find((m) => m.id === claimMedId);
    const batch = batches.find((b) => b.id === claimBatchId);

    if (!med || !batch) {
      sound.playWarning();
      alert('Please select a valid medicine and batch.');
      return;
    }

    if (claimQty <= 0 || claimQty > batch.quantityInStock) {
      sound.playWarning();
      alert(`Invalid quantity. Only ${batch.quantityInStock} units in stock.`);
      return;
    }

    const challanNumber = `CHL-${Date.now().toString().slice(-6)}`;
    const totalLoss = Number((claimQty * batch.purchasePrice).toFixed(2));

    try {
      const record = db.recordDamageWaste({
        medicineId: med.id,
        medicineName: med.name,
        genericName: med.genericName,
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate,
        quantity: claimQty,
        unitCost: batch.purchasePrice,
        totalLoss,
        reason: claimReason,
        action: claimAction,
        supplierName: claimSupplierName || med.manufacturer,
        challanNumber,
        reportedBy: 'Chief Pharmacist',
      });

      sound.playCheckoutSuccess();
      setActivePrintChallan(record);
      setClaimMedId('');
      setClaimBatchId('');
      setClaimQty(1);
      setClaimNotes('');
    } catch (err) {
      sound.playWarning();
      console.error(err);
      alert('Failed to process claim.');
    }
  };

  const handlePrintSlip = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 select-none">
      {/* Page Header */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-500 text-white flex items-center justify-center shadow-md shadow-rose-500/20">
            <RotateCcw className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Returns & Company Claims
            </h1>
            <p className="text-xs text-slate-500">
              Customer Sales Returns, FEFO Restocking, Credit Slips & Pharma MPO Expiry Challans
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setActiveTab('customer_returns')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'customer_returns'
                ? 'bg-white text-slate-900 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
            <span>Customer Sales Returns ({returns.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('company_claims')}
            className={`px-4 py-2 rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeTab === 'company_claims'
                ? 'bg-white text-slate-900 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-indigo-500" />
            <span>MPO Expiry Challans ({damageRecords.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: CUSTOMER SALES RETURNS */}
      {activeTab === 'customer_returns' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: Search Invoice & Select Items (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
              <h2 className="text-sm font-black text-slate-900 flex items-center space-x-2">
                <Search className="w-4 h-4 text-emerald-600" />
                <span>Step 1: Lookup Original Sales Invoice</span>
              </h2>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchInvoice}
                  onChange={(e) => setSearchInvoice(e.target.value)}
                  placeholder="Type Invoice number (e.g. INV-2026-1001), Customer name, or Phone..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>

              {/* Recent/Matched Invoices List */}
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {filteredSales.map((sale) => {
                  const isSelected = selectedSale?.id === sale.id;
                  return (
                    <div
                      key={sale.id}
                      onClick={() => handleSelectSale(sale)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-xs ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/50 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-slate-900">{sale.invoiceNumber}</span>
                          <span className="text-slate-400">•</span>
                          <span className="font-semibold text-slate-700">{sale.customerName}</span>
                          {sale.customerPhone && <span className="text-slate-400">({sale.customerPhone})</span>}
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {new Date(sale.createdAt).toLocaleDateString('en-GB')} • {sale.items.length} items •{' '}
                          Method: {sale.paymentMethod.toUpperCase()}
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="font-bold text-slate-900">
                          {settings.currency}{sale.grandTotal.toFixed(2)}
                        </span>
                        {isSelected && (
                          <span className="block text-[10px] text-emerald-700 font-bold">Selected ✓</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selected Sale Return Items Configuration */}
            {selectedSale && (
              <form onSubmit={handleProcessCustomerReturn} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      Step 2: Select Items & Return Quantities
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Invoice: <span className="font-mono font-bold text-slate-800">{selectedSale.invoiceNumber}</span> | Customer: {selectedSale.customerName}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedSale(null)}
                    className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <div className="space-y-3">
                  {selectedSale.items.map((item) => {
                    const retQty = returnQuantities[item.batchId] || 0;
                    return (
                      <div
                        key={item.batchId}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2 text-xs"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-bold text-slate-900">{item.medicineName}</h4>
                            <p className="text-[10px] text-slate-500 italic">
                              Batch: {item.batchNumber} • Exp: {item.expiryDate.slice(0, 7)} • Sold: {item.quantity} {item.unitType}s
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-slate-900">
                              {settings.currency}{item.unitPrice.toFixed(2)} / unit
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200/60">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                              Return Quantity (Max: {item.quantity})
                            </label>
                            <input
                              type="number"
                              min="0"
                              max={item.quantity}
                              value={retQty}
                              onChange={(e) => {
                                const val = Math.min(item.quantity, Math.max(0, parseInt(e.target.value) || 0));
                                setReturnQuantities((prev) => ({ ...prev, [item.batchId]: val }));
                              }}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                              Reason for Return
                            </label>
                            <select
                              value={returnReasons[item.batchId] || ''}
                              onChange={(e) =>
                                setReturnReasons((prev) => ({ ...prev, [item.batchId]: e.target.value }))
                              }
                              className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            >
                              <option value="Doctor changed prescription">Doctor changed prescription</option>
                              <option value="Patient recovered / excess">Patient recovered / excess</option>
                              <option value="Adverse reaction / allergy">Adverse reaction / allergy</option>
                              <option value="Wrong medicine purchased">Wrong medicine purchased</option>
                              <option value="Damaged / broken strip">Damaged / broken strip</option>
                            </select>
                          </div>
                        </div>

                        {retQty > 0 && (
                          <div className="text-right text-[11px] font-bold text-rose-700">
                            Refund Subtotal: {settings.currency}{(retQty * item.unitPrice).toFixed(2)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Refund Method & Submission */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Total Net Refund:</span>
                    <span className="text-base font-black text-rose-600">
                      {settings.currency}{calculatedRefundTotal.toFixed(2)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {(['cash', 'credit_note', 'bkash', 'nagad'] as const).map((m) => (
                      <button
                        type="button"
                        key={m}
                        onClick={() => setRefundMethod(m)}
                        className={`py-2 px-3 rounded-lg font-bold border transition-all cursor-pointer ${
                          refundMethod === m
                            ? 'bg-rose-600 text-white border-rose-600 shadow'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {m === 'credit_note' ? 'Credit Note / Due' : m.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  <div>
                    <input
                      type="text"
                      placeholder="Optional return notes or approval comments..."
                      value={returnNotes}
                      onChange={(e) => setReturnNotes(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={calculatedRefundTotal <= 0}
                    className="w-full py-3 bg-rose-600 hover:bg-rose-500 active:scale-98 disabled:opacity-40 text-white font-bold rounded-xl text-xs shadow-md shadow-rose-600/20 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm Return & Restock Batch Quantity</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* RIGHT: Processed Returns Log & Print (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-3">
              <h3 className="text-sm font-black text-slate-900 flex items-center space-x-2">
                <FileCheck2 className="w-4 h-4 text-rose-600" />
                <span>Processed Sales Returns ({returns.length})</span>
              </h3>

              {returns.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <RotateCcw className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-semibold">No sales returns processed yet.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto">
                  {returns.map((ret) => (
                    <div
                      key={ret.id}
                      className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50/50 space-y-2 text-xs transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-900">{ret.returnInvoiceNumber}</span>
                        <span className="font-bold text-rose-600">
                          {settings.currency}{ret.totalRefundAmount.toFixed(2)}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 space-y-0.5">
                        <p>Original Inv: <span className="font-mono text-slate-700">{ret.originalInvoiceNumber}</span></p>
                        <p>Customer: {ret.customerName} • Refund: <span className="font-semibold uppercase">{ret.refundMethod}</span></p>
                        <p className="text-[10px] text-slate-400">{new Date(ret.createdAt).toLocaleString('en-GB')}</p>
                      </div>

                      <div className="pt-1 flex items-center justify-between border-t border-slate-200/60">
                        <span className="text-[10px] text-slate-500">{ret.items.length} item(s) restocked</span>
                        <button
                          type="button"
                          onClick={() => setActivePrintReturn(ret)}
                          className="text-[11px] font-bold text-emerald-600 hover:underline flex items-center space-x-1 cursor-pointer"
                        >
                          <Printer className="w-3 h-3" />
                          <span>Print Credit Slip</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: COMPANY CLAIMS & MPO RETURN CHALLAN */}
      {activeTab === 'company_claims' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: New Claim / Damage Write-Off Form (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <form onSubmit={handleProcessCompanyClaim} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                <Building2 className="w-5 h-5 text-indigo-600" />
                <div>
                  <h3 className="text-sm font-black text-slate-900">New Company Expiry Claim</h3>
                  <p className="text-[11px] text-slate-500">Record damage/expiry and generate MPO Challan</p>
                </div>
              </div>

              {/* Medicine Select */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Select Medicine from Inventory
                </label>
                <select
                  required
                  value={claimMedId}
                  onChange={(e) => {
                    setClaimMedId(e.target.value);
                    setClaimBatchId('');
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                >
                  <option value="">-- Choose Medicine --</option>
                  {medicines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.strength}) - {m.manufacturer}
                    </option>
                  ))}
                </select>
              </div>

              {/* Batch Select */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Select Batch (In Stock)
                </label>
                <select
                  required
                  disabled={!claimMedId}
                  value={claimBatchId}
                  onChange={(e) => setClaimBatchId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-50"
                >
                  <option value="">-- Choose Batch --</option>
                  {availableBatchesForClaim.map((b) => (
                    <option key={b.id} value={b.id}>
                      Batch: {b.batchNumber} (Exp: {b.expiryDate.slice(0, 7)}) [Stock: {b.quantityInStock} pcs, TP: ৳{b.purchasePrice}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity & Reason */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Return Qty (Units)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={claimQty}
                    onChange={(e) => setClaimQty(parseInt(e.target.value) || 1)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Reason
                  </label>
                  <select
                    value={claimReason}
                    onChange={(e) => setClaimReason(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  >
                    <option value="expired">Expired (মেয়াদোত্তীর্ণ)</option>
                    <option value="damaged">Damaged (ভাঙা/নষ্ট)</option>
                    <option value="broken">Broken Vial/Bottle</option>
                    <option value="recalled">Recalled by DGDA</option>
                  </select>
                </div>
              </div>

              {/* Action & Manufacturer */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Disposal Action
                  </label>
                  <select
                    value={claimAction}
                    onChange={(e) => setClaimAction(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  >
                    <option value="returned_to_company">Return to Company Depot</option>
                    <option value="discarded">Incinerate / Discard</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Pharma Manufacturer / Depot
                  </label>
                  <input
                    type="text"
                    list="supplier-options"
                    placeholder="e.g. Square Pharmaceuticals"
                    value={claimSupplierName}
                    onChange={(e) => setClaimSupplierName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  />
                  <datalist id="supplier-options">
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.companyName} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Notes / Challan Remarks
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Handed over to Area MPO for credit adjustment."
                  value={claimNotes}
                  onChange={(e) => setClaimNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                />
              </div>

              <button
                type="submit"
                disabled={!claimMedId || !claimBatchId}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 active:scale-98 disabled:opacity-40 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Submit Write-Off & Print MPO Challan</span>
              </button>
            </form>
          </div>

          {/* RIGHT: Company Damage & Expiry Claims Log (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900 flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 text-indigo-600" />
                  <span>Company Claims & Damage Register ({damageRecords.length})</span>
                </h3>
                <span className="text-xs text-slate-500">
                  Total Claim Value: <span className="font-bold text-rose-600">
                    {settings.currency}
                    {damageRecords.reduce((s, r) => s + r.totalLoss, 0).toFixed(2)}
                  </span>
                </span>
              </div>

              {damageRecords.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Building2 className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-semibold">No company return claims recorded yet.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto">
                  {damageRecords.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50/50 space-y-2 text-xs transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-900">{item.medicineName}</span>
                          <span className="text-slate-400 ml-1.5 font-mono text-[10px]">
                            [Batch: {item.batchNumber}]
                          </span>
                        </div>
                        <span className="font-bold text-rose-600">
                          {settings.currency}{item.totalLoss.toFixed(2)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                        <p>Pharma: <span className="font-semibold text-slate-700">{item.supplierName || 'N/A'}</span></p>
                        <p>Challan: <span className="font-mono text-slate-800">{item.challanNumber || 'N/A'}</span></p>
                        <p>Quantity: <span className="font-bold text-slate-800">{item.quantity} units</span></p>
                        <p>Reason: <span className="uppercase text-amber-700 font-semibold">{item.reason}</span></p>
                      </div>

                      <div className="pt-1 flex items-center justify-between border-t border-slate-200/60">
                        <span className="text-[10px] text-slate-400">
                          {new Date(item.reportedAt).toLocaleDateString('en-GB')} by {item.reportedBy}
                        </span>
                        <button
                          type="button"
                          onClick={() => setActivePrintChallan(item)}
                          className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center space-x-1 cursor-pointer"
                        >
                          <Printer className="w-3 h-3" />
                          <span>Print MPO Challan</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PRINTABLE CUSTOMER CREDIT NOTE */}
      {activePrintReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto no-print-backdrop">
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white no-print">
              <span className="font-bold text-xs">Customer Return Credit Slip</span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handlePrintSlip}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Slip</span>
                </button>
                <button
                  onClick={() => setActivePrintReturn(null)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6 bg-white font-mono text-xs leading-relaxed max-w-sm mx-auto">
              <div className="text-center pb-3 border-b border-dashed border-slate-300">
                <h3 className="font-black text-sm uppercase text-slate-900">{settings.pharmacyName}</h3>
                <p className="text-[10px] text-slate-500 font-sans">{settings.address}</p>
                <div className="inline-block px-2 py-0.5 mt-1 bg-rose-600 text-white text-[10px] font-bold rounded">
                  SALES RETURN CREDIT SLIP
                </div>
              </div>

              <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Return No:</span>
                  <span className="font-bold">{activePrintReturn.returnInvoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Original Inv:</span>
                  <span>{activePrintReturn.originalInvoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer:</span>
                  <span className="font-bold">{activePrintReturn.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date:</span>
                  <span>{new Date(activePrintReturn.createdAt).toLocaleString('en-GB')}</span>
                </div>
              </div>

              <div className="py-2.5 border-b border-dashed border-slate-300">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="text-slate-500 text-[10px] uppercase border-b border-slate-200">
                      <th className="py-1">Item</th>
                      <th className="py-1 text-center">Qty</th>
                      <th className="py-1 text-right">Refund</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activePrintReturn.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="py-1 pr-1 font-semibold">{it.medicineName}</td>
                        <td className="py-1 text-center">{it.quantity}</td>
                        <td className="py-1 text-right font-bold">{settings.currency}{it.totalRefund.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
                <div className="flex justify-between font-black text-sm text-slate-900">
                  <span>TOTAL REFUNDED</span>
                  <span className="text-rose-600">{settings.currency}{activePrintReturn.totalRefundAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Method:</span>
                  <span className="font-bold uppercase">{activePrintReturn.refundMethod}</span>
                </div>
              </div>

              <div className="pt-6 grid grid-cols-2 gap-4 text-center text-[10px] font-sans">
                <div className="border-t border-slate-400 pt-1">
                  <span className="text-slate-600">Customer Signature</span>
                </div>
                <div className="border-t border-slate-400 pt-1">
                  <span className="text-slate-600">Pharmacist Signature</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PRINTABLE OFFICIAL MPO RETURN CHALLAN */}
      {activePrintChallan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto no-print-backdrop">
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white no-print">
              <span className="font-bold text-sm">Official MPO Return Challan</span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handlePrintSlip}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Challan</span>
                </button>
                <button
                  onClick={() => setActivePrintChallan(null)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Formal A4 Style Challan Document */}
            <div id="printable-mpo-challan" className="p-8 bg-white font-sans text-xs text-slate-900 leading-relaxed space-y-5">
              <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">{settings.pharmacyName}</h2>
                  <p className="text-[11px] text-slate-600">{settings.address}</p>
                  <p className="text-[11px] text-slate-600">Drug License No: {settings.drugLicenseNo || 'DL-DHK-2024-8841'}</p>
                  <p className="text-[11px] text-slate-600">Hotline: {settings.hotline}</p>
                </div>
                <div className="text-right">
                  <div className="inline-block px-3 py-1 bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded">
                    COMPANY RETURN CHALLAN
                  </div>
                  <p className="font-mono font-bold text-sm text-slate-900 mt-2">
                    Challan #: {activePrintChallan.challanNumber}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Date: {new Date(activePrintChallan.reportedAt).toLocaleDateString('en-GB')}
                  </p>
                </div>
              </div>

              {/* Destination Pharma Company Details */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">To Pharmaceutical Depot / MPO:</span>
                  <span className="font-bold text-sm text-slate-900">{activePrintChallan.supplierName || 'Pharma Depot'}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold">Claim Reason:</span>
                  <span className="font-bold text-rose-700 uppercase">{activePrintChallan.reason}</span>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <table className="w-full text-left border border-slate-300 text-xs">
                  <thead className="bg-slate-100 border-b border-slate-300 text-slate-700">
                    <tr>
                      <th className="p-2 border-r border-slate-300">SL</th>
                      <th className="p-2 border-r border-slate-300">Item Description</th>
                      <th className="p-2 border-r border-slate-300">Batch No</th>
                      <th className="p-2 border-r border-slate-300">Expiry Date</th>
                      <th className="p-2 text-center border-r border-slate-300">Claim Qty</th>
                      <th className="p-2 text-right border-r border-slate-300">Unit TP ({settings.currency})</th>
                      <th className="p-2 text-right">Total TP Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr>
                      <td className="p-2 text-center border-r border-slate-300">1</td>
                      <td className="p-2 border-r border-slate-300">
                        <span className="font-bold">{activePrintChallan.medicineName}</span>
                        <span className="block text-[10px] text-slate-500 italic">{activePrintChallan.genericName}</span>
                      </td>
                      <td className="p-2 font-mono border-r border-slate-300">{activePrintChallan.batchNumber}</td>
                      <td className="p-2 font-mono border-r border-slate-300">{activePrintChallan.expiryDate}</td>
                      <td className="p-2 text-center font-bold border-r border-slate-300">{activePrintChallan.quantity}</td>
                      <td className="p-2 text-right border-r border-slate-300">{activePrintChallan.unitCost.toFixed(2)}</td>
                      <td className="p-2 text-right font-bold">{settings.currency}{activePrintChallan.totalLoss.toFixed(2)}</td>
                    </tr>
                  </tbody>
                  <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-bold">
                    <tr>
                      <td colSpan={6} className="p-2 text-right uppercase">Net Total Claim Value:</td>
                      <td className="p-2 text-right text-rose-700 font-black">
                        {settings.currency}{activePrintChallan.totalLoss.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Acknowledgement and Signatures */}
              <div className="pt-16 grid grid-cols-3 gap-6 text-center text-xs">
                <div className="border-t border-slate-400 pt-1">
                  <p className="font-bold text-slate-800">Prepared By</p>
                  <p className="text-[10px] text-slate-500">{activePrintChallan.reportedBy}</p>
                </div>
                <div className="border-t border-slate-400 pt-1">
                  <p className="font-bold text-slate-800">Pharmacist In-Charge</p>
                  <p className="text-[10px] text-slate-500">Official Seal & Sign</p>
                </div>
                <div className="border-t border-slate-400 pt-1">
                  <p className="font-bold text-slate-800">MPO / Depot Receiver</p>
                  <p className="text-[10px] text-slate-500">Name, Sign & Date</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
