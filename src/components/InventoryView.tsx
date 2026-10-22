import React, { useState, useEffect, useMemo } from 'react';
import type { 
  Medicine, 
  PharmacySettings, 
  TherapeuticCategory, 
  DosageForm 
} from '../types/pharmacy';
import { db } from '../services/db';
import { 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  Layers, 
  X
} from 'lucide-react';

interface InventoryViewProps {
  settings: PharmacySettings;
}

export const InventoryView: React.FC<InventoryViewProps> = ({ settings }) => {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');

  // Modals
  const [isAddMedicineOpen, setIsAddMedicineOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [viewingBatchesMed, setViewingBatchesMed] = useState<Medicine | null>(null);
  const [isAddBatchOpen, setIsAddBatchOpen] = useState(false);

  // New Medicine Form State
  const [medForm, setMedForm] = useState({
    name: '',
    genericName: '',
    category: 'Analgesic & Antipyretic' as TherapeuticCategory,
    dosageForm: 'Tablet' as DosageForm,
    strength: '',
    manufacturer: '',
    unit: 'Pcs',
    unitsPerBox: 100,
    reorderLevel: 50,
    rackLocation: 'Rack A-1',
    description: '',
    requiresPrescription: false,
    isAntibiotic: false,
    isNarcotic: false,
    barcode: '',
  });

  // New Batch Form State
  const [batchForm, setBatchForm] = useState({
    batchNumber: '',
    manufacturingDate: new Date().toISOString().slice(0, 10),
    expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    purchasePrice: 0,
    sellingPrice: 0,
    quantityInStock: 100,
  });

  const refresh = () => {
    setMedicines(db.getMedicines());
  };

  useEffect(() => {
    refresh();
    const unsub = db.subscribe(refresh);
    return () => unsub();
  }, []);

  const categories = useMemo(() => {
    const set = new Set(medicines.map((m) => m.category));
    return ['All', ...Array.from(set)];
  }, [medicines]);

  // Filtered medicines
  const filtered = useMemo(() => {
    return medicines.filter((m) => {
      const matchCat = selectedCategory === 'All' || m.category === selectedCategory;
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.genericName.toLowerCase().includes(q) ||
        m.manufacturer.toLowerCase().includes(q) ||
        m.rackLocation.toLowerCase().includes(q) ||
        m.barcode.includes(q);

      const totalStock = db.getMedicineStock(m.id);
      let matchStock = true;
      if (stockFilter === 'low') {
        matchStock = totalStock > 0 && totalStock <= m.reorderLevel;
      } else if (stockFilter === 'out') {
        matchStock = totalStock <= 0;
      }

      return matchCat && matchSearch && matchStock;
    });
  }, [medicines, selectedCategory, search, stockFilter]);

  const handleSaveMedicine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!medForm.name || !medForm.genericName) {
      alert('Please fill in Medicine Name and Generic Name.');
      return;
    }

    if (editingMedicine) {
      db.updateMedicine(editingMedicine.id, medForm);
      setEditingMedicine(null);
    } else {
      const newMed = db.addMedicine({
        ...medForm,
        barcode: medForm.barcode || `8901${Date.now().toString().slice(-8)}`,
      });

      // Optionally auto-create initial batch if stock price given
      if (batchForm.sellingPrice > 0 && batchForm.quantityInStock > 0) {
        db.addBatch({
          medicineId: newMed.id,
          batchNumber: batchForm.batchNumber || `B-${Date.now().toString().slice(-4)}`,
          manufacturingDate: batchForm.manufacturingDate,
          expiryDate: batchForm.expiryDate,
          purchasePrice: batchForm.purchasePrice,
          sellingPrice: batchForm.sellingPrice,
          quantityInStock: batchForm.quantityInStock,
        });
      }
      setIsAddMedicineOpen(false);
    }
    // reset
    setMedForm({
      name: '',
      genericName: '',
      category: 'Analgesic & Antipyretic',
      dosageForm: 'Tablet',
      strength: '',
      manufacturer: '',
      unit: 'Pcs',
      unitsPerBox: 100,
      reorderLevel: 50,
      rackLocation: 'Rack A-1',
      description: '',
      requiresPrescription: false,
      isAntibiotic: false,
      isNarcotic: false,
      barcode: '',
    });
  };

  const handleDeleteMedicine = (med: Medicine) => {
    if (window.confirm(`Are you sure you want to delete ${med.name}? This will remove it from the catalog.`)) {
      db.deleteMedicine(med.id);
    }
  };

  const handleAddBatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingBatchesMed) return;

    if (!batchForm.batchNumber || batchForm.sellingPrice <= 0 || batchForm.quantityInStock <= 0) {
      alert('Please enter valid batch number, selling price, and quantity.');
      return;
    }

    db.addBatch({
      medicineId: viewingBatchesMed.id,
      batchNumber: batchForm.batchNumber,
      manufacturingDate: batchForm.manufacturingDate,
      expiryDate: batchForm.expiryDate,
      purchasePrice: batchForm.purchasePrice,
      sellingPrice: batchForm.sellingPrice,
      quantityInStock: batchForm.quantityInStock,
    });

    setIsAddBatchOpen(false);
    setBatchForm({
      batchNumber: '',
      manufacturingDate: new Date().toISOString().slice(0, 10),
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      purchasePrice: 0,
      sellingPrice: 0,
      quantityInStock: 100,
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-5">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">Medicine Catalog & Inventory</h1>
          <p className="text-xs text-slate-500">
            Total {medicines.length} registered pharmaceutical formulations across {categories.length - 1} categories.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingMedicine(null);
            setIsAddMedicineOpen(true);
          }}
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add New Medicine</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search medicine by name, generic, barcode, or rack..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3 flex rounded-xl border border-slate-200 overflow-hidden bg-slate-50 p-0.5 text-xs">
            <button
              onClick={() => setStockFilter('all')}
              className={`flex-1 py-1.5 font-semibold rounded-lg transition-all cursor-pointer ${
                stockFilter === 'all' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStockFilter('low')}
              className={`flex-1 py-1.5 font-semibold rounded-lg transition-all cursor-pointer ${
                stockFilter === 'low' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500'
              }`}
            >
              Low Stock
            </button>
            <button
              onClick={() => setStockFilter('out')}
              className={`flex-1 py-1.5 font-semibold rounded-lg transition-all cursor-pointer ${
                stockFilter === 'out' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-500'
              }`}
            >
              Out of Stock
            </button>
          </div>
        </div>
      </div>

      {/* Table view */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Medicine & Generic</th>
                <th className="py-3 px-4">Dosage / Strength</th>
                <th className="py-3 px-4">Manufacturer</th>
                <th className="py-3 px-4 text-center">Location</th>
                <th className="py-3 px-4 text-center">In Stock</th>
                <th className="py-3 px-4 text-right">MRP Rate</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((med) => {
                const totalStock = db.getMedicineStock(med.id);
                const batches = db.getBatchesForMedicine(med.id);
                const fefoBatch = batches[0];
                const isOutOfStock = totalStock <= 0;
                const isLowStock = totalStock > 0 && totalStock <= med.reorderLevel;

                return (
                  <tr key={med.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-2">
                        <div>
                          <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                            {med.name}
                            {med.isAntibiotic && (
                              <span className="text-[9px] px-1.5 py-0.2 bg-purple-100 text-purple-700 rounded font-semibold">
                                Antibiotic
                              </span>
                            )}
                            {med.requiresPrescription && !med.isAntibiotic && (
                              <span className="text-[9px] px-1.5 py-0.2 bg-blue-100 text-blue-700 rounded font-semibold">
                                Rx
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 italic">{med.genericName}</div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">BC: {med.barcode}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-medium text-slate-800">{med.dosageForm}</span>
                      <div className="text-[11px] text-slate-500">{med.strength}</div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600">
                      {med.manufacturer}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-mono font-medium">
                        {med.rackLocation}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          isOutOfStock
                            ? 'bg-rose-100 text-rose-700'
                            : isLowStock
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {totalStock} {med.unit}
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {batches.length} {batches.length === 1 ? 'batch' : 'batches'}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap font-bold text-slate-900">
                      {settings.currency}
                      {fefoBatch ? fefoBatch.sellingPrice.toFixed(2) : '0.00'}
                      <div className="text-[10px] text-slate-400 font-normal">per {med.unit}</div>
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => setViewingBatchesMed(med)}
                          title="Manage Batches"
                          className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Layers className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingMedicine(med);
                            setMedForm({
                              name: med.name,
                              genericName: med.genericName,
                              category: med.category,
                              dosageForm: med.dosageForm,
                              strength: med.strength,
                              manufacturer: med.manufacturer,
                              unit: med.unit,
                              unitsPerBox: med.unitsPerBox,
                              reorderLevel: med.reorderLevel,
                              rackLocation: med.rackLocation,
                              description: med.description || '',
                              requiresPrescription: med.requiresPrescription,
                              isAntibiotic: med.isAntibiotic,
                              isNarcotic: med.isNarcotic,
                              barcode: med.barcode,
                            });
                            setIsAddMedicineOpen(true);
                          }}
                          title="Edit Medicine"
                          className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteMedicine(med)}
                          title="Delete Medicine"
                          className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT MEDICINE MODAL */}
      {isAddMedicineOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingMedicine ? `Edit ${editingMedicine.name}` : 'Register New Medicine Formulation'}
              </h3>
              <button
                onClick={() => setIsAddMedicineOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMedicine} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Brand Name *</label>
                  <input
                    type="text"
                    required
                    value={medForm.name}
                    onChange={(e) => setMedForm({ ...medForm, name: e.target.value })}
                    placeholder="e.g. Napa Extra, Seclo, Maxpro"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Generic Name *</label>
                  <input
                    type="text"
                    required
                    value={medForm.genericName}
                    onChange={(e) => setMedForm({ ...medForm, genericName: e.target.value })}
                    placeholder="e.g. Paracetamol + Caffeine, Omeprazole"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Category</label>
                  <select
                    value={medForm.category}
                    onChange={(e) => setMedForm({ ...medForm, category: e.target.value as TherapeuticCategory })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  >
                    <option value="Analgesic & Antipyretic">Analgesic & Antipyretic</option>
                    <option value="Anti-ulcerant & PPI">Anti-ulcerant & PPI</option>
                    <option value="Antibiotic & Antimicrobial">Antibiotic & Antimicrobial</option>
                    <option value="Antihistamine & Allergy">Antihistamine & Allergy</option>
                    <option value="Respiratory & Asthma">Respiratory & Asthma</option>
                    <option value="Cardiovascular & Antihypertensive">Cardiovascular & Antihypertensive</option>
                    <option value="Antidiabetic">Antidiabetic</option>
                    <option value="Multivitamin & Supplement">Multivitamin & Supplement</option>
                    <option value="Gastrointestinal & Antispasmodic">Gastrointestinal & Antispasmodic</option>
                    <option value="Dermatological & Topical">Dermatological & Topical</option>
                    <option value="Ophthalmic">Ophthalmic</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Dosage Form</label>
                  <select
                    value={medForm.dosageForm}
                    onChange={(e) => setMedForm({ ...medForm, dosageForm: e.target.value as DosageForm })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  >
                    <option value="Tablet">Tablet</option>
                    <option value="Capsule">Capsule</option>
                    <option value="Syrup">Syrup</option>
                    <option value="Suspension">Suspension</option>
                    <option value="Injection">Injection</option>
                    <option value="Ointment">Ointment</option>
                    <option value="Eye Drops">Eye Drops</option>
                    <option value="Inhaler">Inhaler</option>
                    <option value="IV Fluid">IV Fluid</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Strength</label>
                  <input
                    type="text"
                    value={medForm.strength}
                    onChange={(e) => setMedForm({ ...medForm, strength: e.target.value })}
                    placeholder="e.g. 500mg, 20mg, 100ml"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Manufacturer / Pharma Company</label>
                  <input
                    type="text"
                    value={medForm.manufacturer}
                    onChange={(e) => setMedForm({ ...medForm, manufacturer: e.target.value })}
                    placeholder="e.g. Square, Beximco, Incepta"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Rack / Shelf Location</label>
                  <input
                    type="text"
                    value={medForm.rackLocation}
                    onChange={(e) => setMedForm({ ...medForm, rackLocation: e.target.value })}
                    placeholder="e.g. Rack A-1, Drawer 3"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Barcode / SKU</label>
                  <input
                    type="text"
                    value={medForm.barcode}
                    onChange={(e) => setMedForm({ ...medForm, barcode: e.target.value })}
                    placeholder="Auto-generated if empty"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Unit</label>
                  <input
                    type="text"
                    value={medForm.unit}
                    onChange={(e) => setMedForm({ ...medForm, unit: e.target.value })}
                    placeholder="Pcs, Bottle, Tube"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Units per Box</label>
                  <input
                    type="number"
                    min="1"
                    value={medForm.unitsPerBox}
                    onChange={(e) => setMedForm({ ...medForm, unitsPerBox: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Reorder Alert Level</label>
                  <input
                    type="number"
                    min="1"
                    value={medForm.reorderLevel}
                    onChange={(e) => setMedForm({ ...medForm, reorderLevel: parseInt(e.target.value) || 10 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>
              </div>

              {/* Regulatory & Prescription checkboxes */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-6">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={medForm.requiresPrescription}
                    onChange={(e) => setMedForm({ ...medForm, requiresPrescription: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-semibold text-slate-700">Requires Prescription (Rx)</span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={medForm.isAntibiotic}
                    onChange={(e) => setMedForm({ ...medForm, isAntibiotic: e.target.checked, requiresPrescription: e.target.checked ? true : medForm.requiresPrescription })}
                    className="rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span className="font-semibold text-slate-700">Antibiotic Regulation</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddMedicineOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  {editingMedicine ? 'Update Medicine' : 'Save Formulation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW & MANAGE BATCHES MODAL */}
      {viewingBatchesMed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">
                  Batches & Stock Inward: {viewingBatchesMed.name}
                </h3>
                <p className="text-xs text-slate-400">
                  {viewingBatchesMed.genericName} • {viewingBatchesMed.strength} • Location: {viewingBatchesMed.rackLocation}
                </p>
              </div>
              <button
                onClick={() => setViewingBatchesMed(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Active Batches (FEFO Order)
                </span>
                <button
                  onClick={() => setIsAddBatchOpen(true)}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg cursor-pointer shadow"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Batch / Stock In</span>
                </button>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Batch No</th>
                      <th className="py-2.5 px-3">Mfg Date</th>
                      <th className="py-2.5 px-3">Expiry Date</th>
                      <th className="py-2.5 px-3 text-right">Cost Price</th>
                      <th className="py-2.5 px-3 text-right">Selling Price</th>
                      <th className="py-2.5 px-3 text-center">In Stock</th>
                      <th className="py-2.5 px-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {db.getBatchesForMedicine(viewingBatchesMed.id, true).map((b) => {
                      const isExpired = new Date(b.expiryDate) < new Date();
                      return (
                        <tr key={b.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{b.batchNumber}</td>
                          <td className="py-2.5 px-3 text-slate-600">{b.manufacturingDate}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">{b.expiryDate}</td>
                          <td className="py-2.5 px-3 text-right text-slate-600">{settings.currency}{b.purchasePrice.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">{settings.currency}{b.sellingPrice.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-900">{b.quantityInStock}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                isExpired
                                  ? 'bg-rose-100 text-rose-700'
                                  : b.quantityInStock === 0
                                  ? 'bg-slate-200 text-slate-600'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {isExpired ? 'Expired' : b.quantityInStock === 0 ? 'Depleted' : 'Active'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ADD BATCH SUB-FORM */}
              {isAddBatchOpen && (
                <form onSubmit={handleAddBatch} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
                  <h4 className="font-bold text-slate-800">Add New Inward Batch</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="font-semibold block mb-1">Batch Number *</label>
                      <input
                        type="text"
                        required
                        value={batchForm.batchNumber}
                        onChange={(e) => setBatchForm({ ...batchForm, batchNumber: e.target.value })}
                        placeholder="e.g. NP-26B04"
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="font-semibold block mb-1">Mfg Date</label>
                      <input
                        type="date"
                        value={batchForm.manufacturingDate}
                        onChange={(e) => setBatchForm({ ...batchForm, manufacturingDate: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="font-semibold block mb-1">Expiry Date *</label>
                      <input
                        type="date"
                        required
                        value={batchForm.expiryDate}
                        onChange={(e) => setBatchForm({ ...batchForm, expiryDate: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="font-semibold block mb-1">Cost / Purchase Rate</label>
                      <input
                        type="number"
                        step="any"
                        value={batchForm.purchasePrice || ''}
                        onChange={(e) => setBatchForm({ ...batchForm, purchasePrice: parseFloat(e.target.value) || 0 })}
                        placeholder="0.00"
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="font-semibold block mb-1">MRP / Selling Price *</label>
                      <input
                        type="number"
                        step="any"
                        required
                        value={batchForm.sellingPrice || ''}
                        onChange={(e) => setBatchForm({ ...batchForm, sellingPrice: parseFloat(e.target.value) || 0 })}
                        placeholder="0.00"
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="font-semibold block mb-1">Quantity Inward *</label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={batchForm.quantityInStock}
                        onChange={(e) => setBatchForm({ ...batchForm, quantityInStock: parseInt(e.target.value) || 1 })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAddBatchOpen(false)}
                      className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold shadow cursor-pointer"
                    >
                      Save Batch
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
