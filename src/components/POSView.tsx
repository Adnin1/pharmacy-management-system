import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { 
  Medicine, 
  Customer, 
  Doctor, 
  CartItem, 
  PaymentMethod, 
  PharmacySettings, 
  Sale, 
  SpecialSegment, 
  HeldSale,
  CashShift
} from '../types/pharmacy';
import { db } from '../services/db';
import { sound } from '../utils/audio';
import { ReceiptModal } from './ReceiptModal';
import { checkDrugInteractions } from '../services/clinicalRules';
import confetti from 'canvas-confetti';
import { 
  Search, 
  Scan, 
  Trash2, 
  Plus, 
  Minus, 
  Stethoscope, 
  CreditCard, 
  Banknote, 
  Smartphone, 
  AlertCircle, 
  AlertTriangle,
  Receipt, 
  FileCheck, 
  Tag, 
  PauseCircle, 
  PlayCircle, 
  ThermometerSnowflake,
  RotateCcw,
  DollarSign
} from 'lucide-react';

interface POSViewProps {
  settings: PharmacySettings;
  cashierName: string;
  onOpenShiftModal?: () => void;
  onNavigateToReturns?: () => void;
}

export const POSView: React.FC<POSViewProps> = ({ 
  settings, 
  cashierName,
  onOpenShiftModal,
  onNavigateToReturns,
}) => {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
  
  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSegment, setSelectedSegment] = useState<SpecialSegment>('All');
  
  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [vatPercent, setVatPercent] = useState<number>(settings.defaultVatRate);
  
  // Checkout modal
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isHeldModalOpen, setIsHeldModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountPaidInput, setAmountPaidInput] = useState<string>('');
  const [saleNotes, setSaleNotes] = useState('');
  
  // Completed sale receipt
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [currentShift, setCurrentShift] = useState<CashShift | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync DB records
  const refreshData = () => {
    setMedicines(db.getMedicines());
    setCustomers(db.getCustomers());
    setDoctors(db.getDoctors());
    setHeldSales(db.getHeldSales());
    setCurrentShift(db.getCurrentOpenShift());
  };

  useEffect(() => {
    refreshData();
    const unsubscribe = db.subscribe(refreshData);
    return () => unsubscribe();
  }, []);

  // Medex Special Segments
  const specialSegments: { id: SpecialSegment; label: string; color: string }[] = [
    { id: 'All', label: 'All Segments', color: 'bg-slate-900 text-white' },
    { id: 'Antimicrobial', label: 'Antimicrobial', color: 'bg-purple-600 text-white' },
    { id: 'Biotech', label: 'Biotech & Insulin', color: 'bg-cyan-600 text-white' },
    { id: 'Hematology', label: 'Hematology', color: 'bg-red-600 text-white' },
    { id: 'Hormone', label: 'Hormones', color: 'bg-amber-600 text-white' },
    { id: 'Imported', label: 'Imported (Foreign)', color: 'bg-blue-600 text-white' },
    { id: 'mAb', label: 'mAb (Biologics)', color: 'bg-indigo-600 text-white' },
    { id: 'Oncology', label: 'Oncology (Cancer)', color: 'bg-rose-600 text-white' },
    { id: 'OTC', label: 'OTC / Non-Rx', color: 'bg-emerald-600 text-white' },
    { id: 'Probiotics', label: 'Probiotics', color: 'bg-teal-600 text-white' },
    { id: 'Vaccine', label: 'Vaccines', color: 'bg-sky-600 text-white' },
    { id: 'Herbal', label: 'Herbal & Natural', color: 'bg-green-700 text-white' },
  ];

  // Filtered medicines by Special Segment & Query
  const filteredMedicines = useMemo(() => {
    return medicines.filter((m) => {
      const matchSegment = selectedSegment === 'All' || m.specialSegment === selectedSegment;
      const q = searchQuery.toLowerCase().trim();
      if (!q) return matchSegment;
      const matchSearch =
        m.name.toLowerCase().includes(q) ||
        m.genericName.toLowerCase().includes(q) ||
        m.barcode.includes(q) ||
        m.rackLocation.toLowerCase().includes(q) ||
        m.manufacturer.toLowerCase().includes(q) ||
        (m.drugClass && m.drugClass.toLowerCase().includes(q));
      return matchSegment && matchSearch;
    });
  }, [medicines, selectedSegment, searchQuery]);

  const displayedMedicines = useMemo(() => filteredMedicines.slice(0, 60), [filteredMedicines]);

  // Add medicine to cart with FEFO batch selection
  const addToCart = (med: Medicine) => {
    const batches = db.getBatchesForMedicine(med.id);
    if (!batches || batches.length === 0) {
      sound.playWarning();
      alert(`No stock available for ${med.name}. Please inward stock via Procurement.`);
      return;
    }

    const fefoBatch = batches[0]; // Earliest expiry batch

    setCart((prevCart) => {
      const existingIdx = prevCart.findIndex(
        (item) => item.medicine.id === med.id && item.batch.id === fefoBatch.id
      );

      if (existingIdx !== -1) {
        const item = prevCart[existingIdx];
        if (item.quantity + 1 > fefoBatch.quantityInStock) {
          sound.playWarning();
          alert(`Cannot add more. Only ${fefoBatch.quantityInStock} units remaining in Batch ${fefoBatch.batchNumber}.`);
          return prevCart;
        }

        const newQty = item.quantity + 1;
        const total = (newQty * item.unitPrice * (100 - item.discountPercent)) / 100;
        const updated = [...prevCart];
        updated[existingIdx] = { ...item, quantity: newQty, total };
        sound.playScanBeep();
        return updated;
      }

      sound.playScanBeep();
      const newItem: CartItem = {
        medicine: med,
        batch: fefoBatch,
        quantity: 1,
        unitType: 'piece',
        unitPrice: fefoBatch.sellingPrice,
        costPrice: fefoBatch.purchasePrice,
        discountPercent: 0,
        total: fefoBatch.sellingPrice,
      };
      return [newItem, ...prevCart];
    });
  };

  const updateCartItemBatch = (index: number, newBatchId: string) => {
    setCart((prevCart) => {
      const updated = [...prevCart];
      const item = updated[index];
      const allBatches = db.getBatchesForMedicine(item.medicine.id);
      const newBatch = allBatches.find((b) => b.id === newBatchId);
      if (!newBatch) return prevCart;

      const qty = Math.min(item.quantity, newBatch.quantityInStock);
      const total = (qty * newBatch.sellingPrice * (100 - item.discountPercent)) / 100;

      updated[index] = {
        ...item,
        batch: newBatch,
        quantity: qty,
        unitPrice: newBatch.sellingPrice,
        costPrice: newBatch.purchasePrice,
        total,
      };
      return updated;
    });
  };

  const updateCartQuantity = (index: number, delta: number) => {
    setCart((prevCart) => {
      const updated = [...prevCart];
      const item = updated[index];
      const newQty = item.quantity + delta;

      if (newQty <= 0) {
        return updated.filter((_, i) => i !== index);
      }

      if (newQty > item.batch.quantityInStock) {
        sound.playWarning();
        alert(`Cannot add more. Only ${item.batch.quantityInStock} units in Batch ${item.batch.batchNumber}.`);
        return prevCart;
      }

      const total = (newQty * item.unitPrice * (100 - item.discountPercent)) / 100;
      updated[index] = { ...item, quantity: newQty, total };
      return updated;
    });
  };

  const setCartItemUnitType = (index: number, newType: 'piece' | 'strip' | 'box') => {
    setCart((prevCart) => {
      const updated = [...prevCart];
      const item = updated[index];
      const unitsPerBox = item.medicine.unitsPerBox > 1 ? item.medicine.unitsPerBox : 1;
      const stripUnits = item.medicine.unitsPerBox >= 10 ? 10 : 1;
      const multiplier = newType === 'box' ? unitsPerBox : (newType === 'strip' ? stripUnits : 1);
      const unitPrice = item.batch.sellingPrice * multiplier;

      const total = (item.quantity * unitPrice * (100 - item.discountPercent)) / 100;
      updated[index] = {
        ...item,
        unitType: newType,
        unitPrice,
        total,
      };
      return updated;
    });
  };

  // Clinical CDSS Drug-Drug Interaction detection
  const interactions = useMemo(() => {
    if (settings.enableDrugInteractionAlerts === false) return [];
    return checkDrugInteractions(
      cart.map((item) => ({
        id: item.medicine.id,
        name: item.medicine.name,
        genericName: item.medicine.genericName,
      }))
    );
  }, [cart, settings.enableDrugInteractionAlerts]);

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  // Subtotal & Totals calculations
  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.total, 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    return Number(((subtotal * discountPercent) / 100).toFixed(2));
  }, [subtotal, discountPercent]);

  const taxableAmount = Math.max(0, subtotal - discountAmount);

  const vatAmount = useMemo(() => {
    return Number(((taxableAmount * vatPercent) / 100).toFixed(2));
  }, [taxableAmount, vatPercent]);

  const grandTotal = useMemo(() => {
    return Number((taxableAmount + vatAmount).toFixed(2));
  }, [taxableAmount, vatAmount]);

  // Hold current order
  const handleHoldSale = () => {
    if (cart.length === 0) return;
    db.holdCurrentSale({
      customer: selectedCustomer,
      doctor: selectedDoctor,
      items: cart,
      subtotal,
    });
    sound.playCheckoutSuccess();
    setCart([]);
    setSelectedCustomer(null);
    setSelectedDoctor(null);
  };

  // Recall held order
  const handleRecallSale = (held: HeldSale) => {
    setCart(held.items);
    setSelectedCustomer(held.customer);
    setSelectedDoctor(held.doctor);
    db.removeHeldSale(held.id);
    setIsHeldModalOpen(false);
    sound.playScanBeep();
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (filteredMedicines.length > 0) {
        addToCart(filteredMedicines[0]);
        setSearchQuery('');
      }
    }
  };

  const handleOpenCheckout = () => {
    if (cart.length === 0) {
      sound.playWarning();
      alert('Cart is empty. Please add medicines before proceeding.');
      return;
    }
    setAmountPaidInput(grandTotal.toString());
    setIsCheckoutOpen(true);
  };

  const handleFinalizeSale = () => {
    const paid = parseFloat(amountPaidInput) || 0;

    if (paymentMethod !== 'due' && paid <= 0) {
      sound.playWarning();
      alert('Please enter a valid amount paid or select Due payment.');
      return;
    }

    if (paymentMethod === 'due' && !selectedCustomer) {
      sound.playWarning();
      alert('Please select or register a customer for Credit/Due sale.');
      return;
    }

    try {
      const sale = db.processSale({
        cartItems: cart,
        customer: selectedCustomer,
        doctor: selectedDoctor,
        discountAmount,
        vatPercent,
        paymentMethod,
        paidAmount: paid,
        notes: saleNotes,
        cashierName,
      });

      sound.playCheckoutSuccess();
      try {
        confetti({
          particleCount: 75,
          spread: 60,
          origin: { y: 0.6 },
        });
      } catch {
        // ignore
      }

      setCart([]);
      setSelectedCustomer(null);
      setSelectedDoctor(null);
      setDiscountPercent(0);
      setSaleNotes('');
      setIsCheckoutOpen(false);

      setCompletedSale(sale);
    } catch (err) {
      sound.playWarning();
      console.error(err);
      alert('Error finalizing sale. Please try again.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 grid grid-cols-1 lg:grid-cols-12 gap-5 select-none">
      {/* LEFT COLUMN: Medex Special Segments & Product Catalog (7 cols) */}
      <div className="lg:col-span-7 flex flex-col space-y-3.5">
        {/* Search & Barcode input bar */}
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200/80 flex items-center space-x-3">
          <div className="relative flex-1">
            <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search by Medicine, Generic, Drug Class, Barcode or Rack... (Press Enter to add)"
              className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 font-medium transition-all"
            />
          </div>
          <div className="flex items-center space-x-2 text-slate-400 border-l border-slate-200 pl-3">
            <Scan className="w-5 h-5 text-emerald-600" />
            <span className="text-xs font-mono hidden sm:inline text-slate-500">Scanner Ready</span>
          </div>
        </div>

        {/* Medex Special Segments Bar */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
          {specialSegments.map((seg) => (
            <button
              key={seg.id}
              onClick={() => setSelectedSegment(seg.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                selectedSegment === seg.id
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/30 ring-2 ring-emerald-500/20'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {seg.label}
            </button>
          ))}
        </div>

        {/* Medicines Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 overflow-y-auto max-h-[calc(100vh-230px)] pr-1">
          {displayedMedicines.map((med) => {
            const batches = db.getBatchesForMedicine(med.id);
            const totalStock = batches.reduce((sum, b) => sum + b.quantityInStock, 0);
            const fefoBatch = batches[0];
            const isOutOfStock = totalStock <= 0;
            const isLowStock = totalStock > 0 && totalStock <= med.reorderLevel;

            return (
              <div
                key={med.id}
                onClick={() => !isOutOfStock && addToCart(med)}
                className={`group relative p-3.5 bg-white rounded-2xl border transition-all duration-200 flex flex-col justify-between ${
                  isOutOfStock
                    ? 'border-slate-200 opacity-60 cursor-not-allowed bg-slate-50'
                    : 'border-slate-200/90 hover:border-emerald-400 hover:shadow-md hover:-translate-y-0.5 cursor-pointer'
                }`}
              >
                <div>
                  {/* Top tags */}
                  <div className="flex items-center justify-between gap-1 mb-1.5 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md">
                      {med.dosageForm} • {med.strength}
                    </span>
                    {med.isColdChain && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-cyan-100 text-cyan-800 rounded-md flex items-center gap-1">
                        <ThermometerSnowflake className="w-3 h-3" /> 2°C–8°C
                      </span>
                    )}
                    {med.specialSegment && med.specialSegment !== 'All' && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-md">
                        {med.specialSegment}
                      </span>
                    )}
                  </div>

                  {/* Brand & Generic Name */}
                  <h3 className="font-bold text-slate-900 group-hover:text-emerald-600 text-sm transition-colors leading-snug">
                    {med.name}
                  </h3>
                  <p className="text-xs text-slate-500 italic mt-0.5 line-clamp-1">{med.genericName}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{med.manufacturer}</p>
                  {med.packSize && (
                    <p className="text-[9px] text-slate-400 font-mono mt-0.5">Pack: {med.packSize}</p>
                  )}
                </div>

                {/* Stock & FEFO Expiry Info */}
                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-slate-900 text-sm">
                      {settings.currency}
                      {fefoBatch ? fefoBatch.sellingPrice.toFixed(2) : '0.00'}
                      <span className="text-[10px] font-normal text-slate-400 ml-0.5">/{med.unit}</span>
                    </div>
                    {fefoBatch && (
                      <div className="text-[10px] text-emerald-700 font-mono">
                        Exp: {fefoBatch.expiryDate.slice(0, 7)}
                      </div>
                    )}
                  </div>

                  <div className="text-right">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isOutOfStock
                          ? 'bg-rose-100 text-rose-700'
                          : isLowStock
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {isOutOfStock ? 'Out of Stock' : `${totalStock} in stock`}
                    </span>
                    <div className="text-[9px] text-slate-400 mt-0.5">{med.rackLocation}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {filteredMedicines.length > displayedMedicines.length && (
          <div className="mt-2 text-center text-[11px] text-slate-400 bg-slate-50 py-1.5 rounded-xl border border-slate-200">
            Showing top {displayedMedicines.length} of {filteredMedicines.length} matching items. Type in search bar to filter instantly.
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: POS Billing Cart & Transaction Manager (5 cols) */}
      <div className="lg:col-span-5 flex flex-col space-y-3">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 overflow-hidden flex flex-col h-[calc(100vh-120px)]">
          {/* Header Customer, Doctor & Held Orders Selector */}
          <div className="p-3.5 bg-slate-50 border-b border-slate-200 space-y-2.5">
            {/* Shift Status & Quick Returns Header Bar */}
            <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-200/60">
              <button
                type="button"
                onClick={onOpenShiftModal}
                className="flex items-center space-x-1.5 px-2 py-0.5 rounded-lg bg-white border border-slate-200 hover:border-slate-300 text-[11px] font-semibold text-slate-700 transition-all cursor-pointer"
              >
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                {currentShift ? (
                  <span>
                    Shift <strong className="font-mono text-emerald-700">{currentShift.shiftNumber}</strong> (৳{currentShift.expectedCash.toFixed(0)})
                  </span>
                ) : (
                  <span className="text-amber-700 font-bold">Register Closed • Open Float</span>
                )}
              </button>

              {onNavigateToReturns && (
                <button
                  type="button"
                  onClick={onNavigateToReturns}
                  className="flex items-center space-x-1 text-rose-600 hover:text-rose-700 font-bold text-[11px] hover:underline cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Sales Return & Claims</span>
                </button>
              )}
            </div>

            {/* Customer Picker & Recall Button */}
            <div className="flex items-center space-x-2">
              <div className="flex-1">
                <select
                  value={selectedCustomer?.id || ''}
                  onChange={(e) => {
                    const cust = customers.find((c) => c.id === e.target.value) || null;
                    setSelectedCustomer(cust);
                  }}
                  className="w-full text-xs font-medium py-1.5 px-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">Walk-in Customer (General)</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone}) {c.dueBalance > 0 ? `• Due: ৳${c.dueBalance.toFixed(0)}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Recall Held Orders Pill */}
              {heldSales.length > 0 && (
                <button
                  onClick={() => setIsHeldModalOpen(true)}
                  className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center space-x-1 cursor-pointer animate-pulse"
                >
                  <PlayCircle className="w-3.5 h-3.5" />
                  <span>Held ({heldSales.length})</span>
                </button>
              )}
            </div>

            {/* Doctor / Prescription Selector */}
            <div className="flex items-center space-x-2">
              <Stethoscope className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={selectedDoctor?.id || ''}
                onChange={(e) => {
                  const doc = doctors.find((d) => d.id === e.target.value) || null;
                  setSelectedDoctor(doc);
                }}
                className="w-full text-xs font-medium py-1.5 px-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="">No Doctor Tagged (OTC)</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.bmdcNumber}) - {d.specialization}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 divide-y divide-slate-100">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <Receipt className="w-12 h-12 text-slate-300 mb-2 stroke-1" />
                <p className="font-semibold text-slate-600 text-sm">Cart is Empty</p>
                <p className="text-xs text-slate-400 mt-1 max-w-[200px]">
                  Click products from the catalog or scan barcodes to begin billing.
                </p>
              </div>
            ) : (
              cart.map((item, idx) => {
                const availableBatches = db.getBatchesForMedicine(item.medicine.id);

                return (
                  <div key={`${item.medicine.id}-${item.batch.id}-${idx}`} className="pt-2 first:pt-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 pr-2">
                        <div className="flex items-center space-x-1.5 flex-wrap">
                          <h4 className="font-bold text-slate-900 text-xs">{item.medicine.name}</h4>
                          <span className="text-[10px] text-slate-500">({item.medicine.strength})</span>
                          {item.medicine.isColdChain && (
                            <span className="text-[9px] px-1 bg-cyan-100 text-cyan-800 rounded font-bold">
                              ❄ Cold Chain
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 italic">{item.medicine.genericName}</p>

                        {/* FEFO Batch selector & Unit toggler */}
                        <div className="flex items-center space-x-2 mt-1.5">
                          <select
                            value={item.batch.id}
                            onChange={(e) => updateCartItemBatch(idx, e.target.value)}
                            className="text-[10px] bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 font-mono text-slate-700"
                          >
                            {availableBatches.map((b) => (
                              <option key={b.id} value={b.id}>
                                Batch: {b.batchNumber} (Exp: {b.expiryDate.slice(0, 7)}) [{b.quantityInStock} left]
                              </option>
                            ))}
                          </select>

                          {/* 3-Way Unit Selector: Pcs | Strip (10s) | Box */}
                          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-[9px] font-bold">
                            <button
                              type="button"
                              onClick={() => setCartItemUnitType(idx, 'piece')}
                              className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                                item.unitType === 'piece'
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'text-slate-600 hover:text-slate-900'
                              }`}
                            >
                              Pcs
                            </button>
                            {item.medicine.unitsPerBox >= 10 && (
                              <button
                                type="button"
                                onClick={() => setCartItemUnitType(idx, 'strip')}
                                className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                                  item.unitType === 'strip'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                Strip (10s)
                              </button>
                            )}
                            {item.medicine.unitsPerBox > 1 && (
                              <button
                                type="button"
                                onClick={() => setCartItemUnitType(idx, 'box')}
                                className={`px-1.5 py-0.5 rounded transition-all cursor-pointer ${
                                  item.unitType === 'box'
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                Box ({item.medicine.unitsPerBox})
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Line Total & Remove button */}
                      <div className="text-right">
                        <span className="font-black text-xs text-slate-900">
                          {settings.currency}{item.total.toFixed(2)}
                        </span>
                        <div>
                          <button
                            onClick={() => removeFromCart(idx)}
                            className="text-slate-400 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Stepper controls */}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[11px] text-slate-500">
                        {settings.currency}{item.unitPrice.toFixed(2)} / {item.unitType}
                      </span>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => updateCartQuantity(idx, -1)}
                          className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 font-bold active:scale-95 transition-all cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-8 text-center font-bold text-xs text-slate-800">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateCartQuantity(idx, 1)}
                          className="w-6 h-6 rounded-lg bg-emerald-100 hover:bg-emerald-200 flex items-center justify-center text-emerald-800 font-bold active:scale-95 transition-all cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Clinical CDSS Drug-Drug Interaction Warning Alert Banner */}
          {interactions.length > 0 && (
            <div className="p-3 bg-rose-50 border-t border-rose-200 space-y-2">
              <div className="flex items-center space-x-1.5 text-rose-800">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-bold text-xs uppercase tracking-tight">
                  Clinical Alert: {interactions.length} Severe Drug Interaction(s)
                </span>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {interactions.map((inter) => (
                  <div
                    key={inter.id}
                    className="p-2 bg-white rounded-lg border border-rose-200 text-[10px] space-y-1 shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{inter.drugs[0]} + {inter.drugs[1]}</span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                          inter.severity === 'major'
                            ? 'bg-rose-100 text-rose-800'
                            : inter.severity === 'moderate'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {inter.severity} Risk
                      </span>
                    </div>
                    <p className="text-slate-700 leading-tight">{inter.description}</p>
                    <p className="text-emerald-800 font-semibold leading-tight">
                      💡 Rx Advice: {inter.management}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cart Footer: Financial Calculations & Checkout */}
          <div className="p-3.5 bg-slate-50 border-t border-slate-200 space-y-2">
            {/* Discount & Tax inputs */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center space-x-1.5 bg-white px-2 py-1.5 rounded-xl border border-slate-200">
                <Tag className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-500 text-[11px]">Disc %</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={discountPercent || ''}
                  onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                  placeholder="0"
                  className="w-12 text-right font-bold text-slate-800 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between bg-white px-2 py-1.5 rounded-xl border border-slate-200">
                <span className="text-slate-500 text-[11px]">VAT ({vatPercent}%)</span>
                <button
                  onClick={() => setVatPercent((prev) => (prev > 0 ? 0 : settings.defaultVatRate))}
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded cursor-pointer ${
                    vatPercent > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {vatPercent > 0 ? 'Applied' : 'Exempt'}
                </button>
              </div>
            </div>

            {/* Calculations Breakdown */}
            <div className="space-y-1 text-xs text-slate-600 pt-1">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{settings.currency}{subtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Discount ({discountPercent}%)</span>
                  <span>-{settings.currency}{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>VAT Amount</span>
                <span>+{settings.currency}{vatAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-black text-slate-900 pt-1 border-t border-slate-200">
                <span>Payable Total</span>
                <span className="text-emerald-700">{settings.currency}{grandTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex space-x-2 pt-1">
              <button
                onClick={handleHoldSale}
                disabled={cart.length === 0}
                title="Hold Bill (Park sale and serve another customer)"
                className="py-2.5 px-3 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 font-semibold rounded-xl text-xs border border-slate-200 transition-all flex items-center gap-1 cursor-pointer"
              >
                <PauseCircle className="w-3.5 h-3.5 text-amber-500" />
                <span>Hold</span>
              </button>

              <button
                onClick={() => setCart([])}
                disabled={cart.length === 0}
                className="py-2.5 px-3 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-600 font-semibold rounded-xl text-xs border border-slate-200 transition-all cursor-pointer"
              >
                Clear
              </button>

              <button
                onClick={handleOpenCheckout}
                disabled={cart.length === 0}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-98 disabled:opacity-40 text-white font-bold rounded-xl text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                <span>Pay {settings.currency}{grandTotal.toFixed(2)}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* HELD SALES MODAL (RECALL ORDER) */}
      {isHeldModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Parked / Held Customer Orders</h3>
                <p className="text-xs text-slate-400">{heldSales.length} orders currently on hold</p>
              </div>
              <button onClick={() => setIsHeldModalOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                ✕
              </button>
            </div>

            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-3 text-xs">
              {heldSales.map((h) => (
                <div key={h.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex justify-between items-center font-bold">
                    <span>{h.customer ? h.customer.name : 'Walk-in Customer'}</span>
                    <span className="text-emerald-700">{settings.currency}{h.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex justify-between">
                    <span>Held at: {new Date(h.heldAt).toLocaleTimeString()}</span>
                    <span>{h.items.length} items</span>
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                    <button
                      onClick={() => db.removeHeldSale(h.id)}
                      className="px-3 py-1 bg-white border border-slate-300 text-rose-600 rounded-lg font-semibold cursor-pointer"
                    >
                      Discard
                    </button>
                    <button
                      onClick={() => handleRecallSale(h)}
                      className="px-4 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow cursor-pointer"
                    >
                      Resume Bill
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CHECKOUT & PAYMENT MODAL */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Payment & Checkout</h3>
                <p className="text-xs text-slate-400">Total Due: {settings.currency}{grandTotal.toFixed(2)}</p>
              </div>
              <span className="font-black text-lg text-emerald-400">
                {settings.currency}{grandTotal.toFixed(2)}
              </span>
            </div>

            <div className="p-5 space-y-4">
              {/* Payment Method Selector */}
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                  Select Payment Method
                </label>
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => setPaymentMethod('cash')}
                    className={`py-2 px-1 text-center rounded-xl text-xs font-semibold flex flex-col items-center gap-1 border transition-all cursor-pointer ${
                      paymentMethod === 'cash'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Banknote className="w-4 h-4" />
                    <span>Cash</span>
                  </button>

                  <button
                    onClick={() => setPaymentMethod('bkash')}
                    className={`py-2 px-1 text-center rounded-xl text-xs font-semibold flex flex-col items-center gap-1 border transition-all cursor-pointer ${
                      paymentMethod === 'bkash'
                        ? 'bg-pink-50 border-pink-500 text-pink-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Smartphone className="w-4 h-4 text-pink-600" />
                    <span>bKash</span>
                  </button>

                  <button
                    onClick={() => setPaymentMethod('nagad')}
                    className={`py-2 px-1 text-center rounded-xl text-xs font-semibold flex flex-col items-center gap-1 border transition-all cursor-pointer ${
                      paymentMethod === 'nagad'
                        ? 'bg-orange-50 border-orange-500 text-orange-700'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Smartphone className="w-4 h-4 text-orange-600" />
                    <span>Nagad</span>
                  </button>

                  <button
                    onClick={() => setPaymentMethod('due')}
                    className={`py-2 px-1 text-center rounded-xl text-xs font-semibold flex flex-col items-center gap-1 border transition-all cursor-pointer ${
                      paymentMethod === 'due'
                        ? 'bg-amber-50 border-amber-500 text-amber-800'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <AlertCircle className="w-4 h-4 text-amber-600" />
                    <span>Credit / Due</span>
                  </button>
                </div>
              </div>

              {/* Amount paid input & quick denomination buttons */}
              {paymentMethod !== 'due' && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <label className="font-bold text-slate-600">Amount Tendered / Paid</label>
                    <span className="text-slate-400">Total: {settings.currency}{grandTotal.toFixed(2)}</span>
                  </div>

                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                      {settings.currency}
                    </span>
                    <input
                      type="number"
                      step="any"
                      value={amountPaidInput}
                      onChange={(e) => setAmountPaidInput(e.target.value)}
                      placeholder="0.00"
                      className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                  </div>

                  {/* Quick Cash Buttons */}
                  <div className="flex gap-2">
                    {[100, 500, 1000].map((val) => (
                      <button
                        key={val}
                        onClick={() => setAmountPaidInput(val.toString())}
                        className="flex-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                      >
                        +{val}
                      </button>
                    ))}
                    <button
                      onClick={() => setAmountPaidInput(grandTotal.toString())}
                      className="flex-1 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-lg text-xs font-bold transition-all cursor-pointer"
                    >
                      Exact
                    </button>
                  </div>

                  {/* Return Change calculation */}
                  {parseFloat(amountPaidInput) > grandTotal && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                      <span className="font-bold text-emerald-800">Change to Return:</span>
                      <span className="font-black text-sm text-emerald-900">
                        {settings.currency}
                        {(parseFloat(amountPaidInput) - grandTotal).toFixed(2)}
                      </span>
                    </div>
                  )}

                  {parseFloat(amountPaidInput) < grandTotal && parseFloat(amountPaidInput) > 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs">
                      <span className="font-bold text-amber-800">Remaining Balance (Due):</span>
                      <span className="font-black text-sm text-amber-900">
                        {settings.currency}
                        {(grandTotal - parseFloat(amountPaidInput)).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Due Notice */}
              {paymentMethod === 'due' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
                  <div className="flex items-center space-x-1.5 text-amber-800 font-bold text-xs">
                    <AlertCircle className="w-4 h-4" />
                    <span>Credit / Due Sale</span>
                  </div>
                  <p className="text-[11px] text-amber-700">
                    Full amount of {settings.currency}{grandTotal.toFixed(2)} will be debited to{' '}
                    <strong>{selectedCustomer?.name || 'Customer'}</strong>'s ledger.
                  </p>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  Transaction Notes / Prescription Ref
                </label>
                <input
                  type="text"
                  value={saleNotes}
                  onChange={(e) => setSaleNotes(e.target.value)}
                  placeholder="e.g. bKash TrxID, Doctor prescription ref, or customer note..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs border border-slate-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleFinalizeSale}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold rounded-xl text-sm shadow transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <FileCheck className="w-4 h-4" />
                <span>Confirm & Generate Invoice</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPLETED SALE RECEIPT MODAL */}
      {completedSale && (
        <ReceiptModal
          sale={completedSale}
          settings={settings}
          onClose={() => setCompletedSale(null)}
        />
      )}
    </div>
  );
};
