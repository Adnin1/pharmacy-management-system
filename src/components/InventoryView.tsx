import React, { useState, useEffect, useMemo } from 'react';
import type { 
  Medicine, 
  PharmacySettings, 
  TherapeuticCategory, 
  DosageForm,
  SpecialSegment,
  MedicineType
} from '../types/pharmacy';
import { db } from '../services/db';
import { 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  Layers, 
  X,
  Snowflake,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Filter
} from 'lucide-react';

interface InventoryViewProps {
  settings: PharmacySettings;
}

const SPECIAL_SEGMENTS: SpecialSegment[] = [
  'All',
  'Antimicrobial',
  'Biotech',
  'Hematology',
  'Hormone',
  'Imported',
  'mAb',
  'Oncology',
  'OTC',
  'Probiotics',
  'Vaccine',
  'Herbal'
];

export const InventoryView: React.FC<InventoryViewProps> = ({ settings }) => {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedSegment, setSelectedSegment] = useState<SpecialSegment>('All');
  const [onlyColdChain, setOnlyColdChain] = useState<boolean>(false);
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');

  // Modals
  const [isAddMedicineOpen, setIsAddMedicineOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [viewingBatchesMed, setViewingBatchesMed] = useState<Medicine | null>(null);
  const [isAddBatchOpen, setIsAddBatchOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);

  // Bulk Import state
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState<{ success?: number; error?: string } | null>(null);

  // New Medicine Form State
  const [medForm, setMedForm] = useState({
    name: '',
    genericName: '',
    category: 'Analgesic & Antipyretic' as TherapeuticCategory,
    specialSegment: 'All' as SpecialSegment,
    medicineType: 'Allopathic' as MedicineType,
    drugClass: '',
    dosageForm: 'Tablet' as DosageForm,
    strength: '',
    manufacturer: '',
    unit: 'Pcs',
    unitsPerBox: 100,
    reorderLevel: 50,
    rackLocation: 'Rack A-1',
    isColdChain: false,
    packSize: '',
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
      const matchSegment = 
        selectedSegment === 'All' || 
        m.specialSegment === selectedSegment || 
        (selectedSegment === 'Herbal' && (m.medicineType === 'Herbal' || m.specialSegment === 'Herbal'));
      const matchCold = !onlyColdChain || !!m.isColdChain;

      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.genericName.toLowerCase().includes(q) ||
        m.manufacturer.toLowerCase().includes(q) ||
        m.rackLocation.toLowerCase().includes(q) ||
        (m.drugClass && m.drugClass.toLowerCase().includes(q)) ||
        m.barcode.includes(q);

      const totalStock = db.getMedicineStock(m.id);
      let matchStock = true;
      if (stockFilter === 'low') {
        matchStock = totalStock > 0 && totalStock <= m.reorderLevel;
      } else if (stockFilter === 'out') {
        matchStock = totalStock <= 0;
      }

      return matchCat && matchSegment && matchCold && matchSearch && matchStock;
    });
  }, [medicines, selectedCategory, selectedSegment, onlyColdChain, search, stockFilter]);

  const handleSaveMedicine = (e: React.FormEvent) => {
    e.preventDefault();
    if (!medForm.name || !medForm.genericName) {
      alert('Please fill in Medicine Name and Generic Name.');
      return;
    }

    if (editingMedicine) {
      db.updateMedicine(editingMedicine.id, {
        ...medForm,
        rackLocation: medForm.isColdChain && !medForm.rackLocation.includes('Cold') 
          ? `Cold Storage (2°C - 8°C)` 
          : medForm.rackLocation
      });
      setEditingMedicine(null);
    } else {
      const newMed = db.addMedicine({
        ...medForm,
        rackLocation: medForm.isColdChain && !medForm.rackLocation.includes('Cold') 
          ? `Cold Storage (2°C - 8°C)` 
          : medForm.rackLocation,
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
      specialSegment: 'All',
      medicineType: 'Allopathic',
      drugClass: '',
      dosageForm: 'Tablet',
      strength: '',
      manufacturer: '',
      unit: 'Pcs',
      unitsPerBox: 100,
      reorderLevel: 50,
      rackLocation: 'Rack A-1',
      isColdChain: false,
      packSize: '',
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

  // Download sample CSV template
  const downloadSampleCsv = () => {
    const csvHeader = 'name,genericName,category,specialSegment,medicineType,dosageForm,strength,manufacturer,unit,unitsPerBox,packSize,sellingPrice,purchasePrice,isColdChain,requiresPrescription,isAntibiotic,rackLocation,drugClass\n';
    const sampleRows = [
      'Napa Extra,Paracetamol + Caffeine,Analgesic & Antipyretic,OTC,Allopathic,Tablet,500mg + 65mg,Beximco Pharmaceuticals Ltd,Pcs,240,24 x 10s Strip,3.00,2.55,false,false,false,Rack A-1,Anilide derivative',
      'Ceftron IV/IM,Ceftriaxone Sodium,Antibiotic & Antimicrobial,Antimicrobial,Allopathic,Injection,1g Vial,Square Pharmaceuticals PLC,Vial,1,1 Vial/Box,190.00,161.50,false,true,true,Rack C-3,Third-generation Cephalosporin',
      'Insulatard Penfill,Human Isophane Insulin,Biotech & Hormones,Biotech,Allopathic,Injection,100 IU/ml,Novo Nordisk / Square,Cartridge,5,5 x 3ml Cartridge,480.00,410.00,true,true,false,Cold Storage (2°C - 8°C),Intermediate-acting Insulin',
      'Herbicough,Adhatoda vasica + Glycyrrhiza glabra,Herbal & Nutraceutical,Herbal,Herbal,Syrup,100 ml,Square Herbal & Nutraceuticals,Bottle,1,100 ml PET Bottle,85.00,72.25,false,false,false,Rack H-1,Ayurvedic Cough Expectorant',
      'Rituxirel,Rituximab,Oncology & Chemotherapy,mAb,Biochemical,Injection,500mg/50ml,Reliance Life Sciences / Incepta,Vial,1,50ml Single-use Vial,34500.00,29500.00,true,true,false,Cold Storage (2°C - 8°C),Anti-CD20 Monoclonal Antibody'
    ].join('\n');

    const blob = new Blob([csvHeader + sampleRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'medex_arogga_catalog_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Bulk Import Executor
  const handleBulkImport = () => {
    if (!importText.trim()) {
      setImportStatus({ error: 'Please paste CSV or JSON data or choose a file.' });
      return;
    }

    try {
      let parsedItems: any[] = [];
      const trimmed = importText.trim();

      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        // Parse JSON
        parsedItems = JSON.parse(trimmed);
      } else {
        // Parse CSV
        const lines = trimmed.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
        if (lines.length < 2) {
          throw new Error('CSV must contain a header row and at least one data row.');
        }

        const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
        for (let i = 1; i < lines.length; i++) {
          const values: string[] = [];
          let current = '';
          let inQuotes = false;
          for (let c = 0; c < lines[i].length; c++) {
            const ch = lines[i][c];
            if (ch === '"') {
              inQuotes = !inQuotes;
            } else if (ch === ',' && !inQuotes) {
              values.push(current.trim());
              current = '';
            } else {
              current += ch;
            }
          }
          values.push(current.trim());

          const rowObj: any = {};
          headers.forEach((header, idx) => {
            let val = values[idx] ? values[idx].replace(/^["']|["']$/g, '') : '';
            if (val === 'true') (rowObj as any)[header] = true;
            else if (val === 'false') (rowObj as any)[header] = false;
            else if (!isNaN(Number(val)) && val !== '') (rowObj as any)[header] = Number(val);
            else (rowObj as any)[header] = val;
          });

          if (rowObj.name && rowObj.genericName) {
            parsedItems.push(rowObj);
          }
        }
      }

      if (parsedItems.length === 0) {
        throw new Error('No valid medicine rows found to import.');
      }

      // Map to db requirements
      const formattedMeds = parsedItems.map((item) => ({
        name: item.name || 'Unnamed Medicine',
        genericName: item.genericName || 'Generic Formulation',
        category: (item.category || 'Analgesic & Antipyretic') as TherapeuticCategory,
        specialSegment: (item.specialSegment || 'OTC') as SpecialSegment,
        medicineType: (item.medicineType || (item.specialSegment === 'Herbal' ? 'Herbal' : 'Allopathic')) as MedicineType,
        drugClass: item.drugClass || '',
        dosageForm: (item.dosageForm || 'Tablet') as DosageForm,
        strength: item.strength || '',
        manufacturer: item.manufacturer || 'General Pharma BD',
        unit: item.unit || 'Pcs',
        unitsPerBox: Number(item.unitsPerBox) || 100,
        reorderLevel: Number(item.reorderLevel) || 50,
        rackLocation: item.rackLocation || (item.isColdChain ? 'Cold Storage (2°C - 8°C)' : 'Rack General'),
        isColdChain: !!item.isColdChain,
        packSize: item.packSize || '',
        description: item.description || '',
        requiresPrescription: !!item.requiresPrescription,
        isAntibiotic: !!item.isAntibiotic,
        isNarcotic: !!item.isNarcotic,
        barcode: item.barcode || `890${Date.now().toString().slice(-7)}`,
        sellingPrice: Number(item.sellingPrice) || 15,
        purchasePrice: Number(item.purchasePrice) || 12,
        quantityInStock: Number(item.quantityInStock) || 100,
      }));

      const count = db.importBulkMedicines(formattedMeds);
      setImportStatus({ success: count });
      refresh();
      setTimeout(() => {
        setIsBulkImportOpen(false);
        setImportText('');
        setImportStatus(null);
      }, 1500);
    } catch (err: any) {
      setImportStatus({ error: err.message || 'Failed to parse import data. Please check format.' });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      setImportText(content);
    };
    reader.readAsText(file);
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

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setImportText('');
              setImportStatus(null);
              setIsBulkImportOpen(true);
            }}
            className="inline-flex items-center space-x-2 px-3.5 py-2.5 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 active:scale-95 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm"
          >
            <Upload className="w-4 h-4 text-sky-600" />
            <span>Bulk Import (MedEx/Arogga)</span>
          </button>

          <button
            onClick={() => {
              setEditingMedicine(null);
              setMedForm({
                name: '',
                genericName: '',
                category: 'Analgesic & Antipyretic',
                specialSegment: 'All',
                medicineType: 'Allopathic',
                drugClass: '',
                dosageForm: 'Tablet',
                strength: '',
                manufacturer: '',
                unit: 'Pcs',
                unitsPerBox: 100,
                reorderLevel: 50,
                rackLocation: 'Rack A-1',
                isColdChain: false,
                packSize: '',
                description: '',
                requiresPrescription: false,
                isAntibiotic: false,
                isNarcotic: false,
                barcode: '',
              });
              setIsAddMedicineOpen(true);
            }}
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Medicine</span>
          </button>
        </div>
      </div>

      {/* MedEx Special Segments Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
          <Filter className="w-3 h-3" /> Segments:
        </span>
        {SPECIAL_SEGMENTS.map((seg) => (
          <button
            key={seg}
            onClick={() => setSelectedSegment(seg)}
            className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              selectedSegment === seg
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {seg}
          </button>
        ))}
        <button
          onClick={() => setOnlyColdChain(!onlyColdChain)}
          className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
            onlyColdChain
              ? 'bg-cyan-600 text-white shadow-sm'
              : 'bg-white border border-cyan-200 text-cyan-700 hover:bg-cyan-50'
          }`}
        >
          <Snowflake className="w-3 h-3" />
          <span>Cold Chain (2°C-8°C)</span>
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
              placeholder="Search medicine by name, generic, class, barcode, or rack..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none cursor-pointer"
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
                <th className="py-3 px-4">Dosage / Pack</th>
                <th className="py-3 px-4">Manufacturer & Class</th>
                <th className="py-3 px-4 text-center">Segment / Storage</th>
                <th className="py-3 px-4 text-center">In Stock</th>
                <th className="py-3 px-4 text-right">MRP Rate</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No medicines match the selected filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((med) => {
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
                            <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
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
                              {med.medicineType === 'Herbal' && (
                                <span className="text-[9px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded font-semibold">
                                  Herbal
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
                        {med.packSize && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{med.packSize}</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">
                        <div className="font-medium text-slate-800">{med.manufacturer}</div>
                        {med.drugClass && (
                          <div className="text-[10px] text-slate-500 font-normal">{med.drugClass}</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center gap-1">
                          {med.specialSegment && (
                            <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-semibold">
                              {med.specialSegment}
                            </span>
                          )}
                          {med.isColdChain ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-cyan-50 border border-cyan-200 text-cyan-800 rounded text-[10px] font-bold">
                              <Snowflake className="w-2.5 h-2.5 text-cyan-600" />
                              2°C-8°C Cold Chain
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {med.rackLocation}
                            </span>
                          )}
                        </div>
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
                                specialSegment: med.specialSegment || 'All',
                                medicineType: med.medicineType || 'Allopathic',
                                drugClass: med.drugClass || '',
                                dosageForm: med.dosageForm,
                                strength: med.strength,
                                manufacturer: med.manufacturer,
                                unit: med.unit,
                                unitsPerBox: med.unitsPerBox,
                                reorderLevel: med.reorderLevel,
                                rackLocation: med.rackLocation,
                                isColdChain: !!med.isColdChain,
                                packSize: med.packSize || '',
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
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* BULK IMPORT MODAL (MEDEX / AROGGA SYNC) */}
      {isBulkImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-sky-400" />
                <div>
                  <h3 className="font-bold text-sm">Bulk Import Medicines (MedEx & Arogga Sync)</h3>
                  <p className="text-[11px] text-slate-400">Import catalog in CSV or JSON format with automatic FEFO batch creation</p>
                </div>
              </div>
              <button
                onClick={() => setIsBulkImportOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-sky-50 border border-sky-100 rounded-xl">
                <div>
                  <span className="font-bold text-sky-900 block">MedEx & Arogga Catalog Synchronizer</span>
                  <span className="text-sky-700 text-[11px]">Download our standardized CSV template, fill in your drug list, and upload below.</span>
                </div>
                <button
                  onClick={downloadSampleCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-bold transition-colors cursor-pointer shadow-sm self-start sm:self-auto"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Sample CSV</span>
                </button>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Upload CSV / JSON File
                </label>
                <input
                  type="file"
                  accept=".csv, .json, text/csv, application/json"
                  onChange={handleFileUpload}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Or Paste CSV / JSON Data Directly:
                </label>
                <textarea
                  rows={8}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={`name,genericName,category,specialSegment,medicineType,dosageForm,strength,manufacturer,unit,unitsPerBox,packSize,sellingPrice,purchasePrice,isColdChain,requiresPrescription,isAntibiotic,rackLocation,drugClass\nNapa Extra,Paracetamol + Caffeine,Analgesic & Antipyretic,OTC,Allopathic,Tablet,500mg + 65mg,Beximco Pharmaceuticals Ltd,Pcs,240,24 x 10s Strip,3.00,2.55,false,false,false,Rack A-1,Anilide derivative`}
                  className="w-full p-3 font-mono text-[11px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>

              {importStatus?.error && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span className="font-semibold">{importStatus.error}</span>
                </div>
              )}

              {typeof importStatus?.success === 'number' && (
                <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span className="font-bold">Successfully imported {importStatus.success} medicines into the system catalog!</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBulkImportOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkImport}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold shadow-md shadow-sky-600/20 cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Upload className="w-4 h-4" />
                  <span>Execute Bulk Import</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                className="text-slate-400 hover:text-white cursor-pointer"
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
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none cursor-pointer"
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
                    <option value="Oncology & Chemotherapy">Oncology & Chemotherapy</option>
                    <option value="Biotech & Hormones">Biotech & Hormones</option>
                    <option value="Vaccine & Immunological">Vaccine & Immunological</option>
                    <option value="Herbal & Nutraceutical">Herbal & Nutraceutical</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Special Segment (MedEx)</label>
                  <select
                    value={medForm.specialSegment}
                    onChange={(e) => setMedForm({ ...medForm, specialSegment: e.target.value as SpecialSegment })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none cursor-pointer"
                  >
                    {SPECIAL_SEGMENTS.map((seg) => (
                      <option key={seg} value={seg}>{seg}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Medicine Type</label>
                  <select
                    value={medForm.medicineType}
                    onChange={(e) => setMedForm({ ...medForm, medicineType: e.target.value as MedicineType })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none cursor-pointer"
                  >
                    <option value="Allopathic">Allopathic</option>
                    <option value="Herbal">Herbal</option>
                    <option value="Nutraceutical">Nutraceutical</option>
                    <option value="Biochemical">Biochemical</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Dosage Form</label>
                  <select
                    value={medForm.dosageForm}
                    onChange={(e) => setMedForm({ ...medForm, dosageForm: e.target.value as DosageForm })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none cursor-pointer"
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
                    <option value="Suppository">Suppository</option>
                    <option value="Pre-filled Syringe">Pre-filled Syringe</option>
                    <option value="Powder for Suspension">Powder for Suspension</option>
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

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Drug Class</label>
                  <input
                    type="text"
                    value={medForm.drugClass}
                    onChange={(e) => setMedForm({ ...medForm, drugClass: e.target.value })}
                    placeholder="e.g. Cephalosporin, PPI, NSAID"
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
                  <label className="font-bold text-slate-700 block mb-1">Rack / Storage Location</label>
                  <input
                    type="text"
                    value={medForm.rackLocation}
                    onChange={(e) => setMedForm({ ...medForm, rackLocation: e.target.value })}
                    placeholder="e.g. Rack A-1, Cold Storage (2°C - 8°C)"
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

              <div className="grid grid-cols-4 gap-3">
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
                  <label className="font-bold text-slate-700 block mb-1">Pack Size Spec</label>
                  <input
                    type="text"
                    value={medForm.packSize}
                    onChange={(e) => setMedForm({ ...medForm, packSize: e.target.value })}
                    placeholder="e.g. 10 x 10s Strip"
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

              {/* Regulatory, Cold Chain & Prescription checkboxes */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 gap-3">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={medForm.requiresPrescription}
                    onChange={(e) => setMedForm({ ...medForm, requiresPrescription: e.target.checked })}
                    className="rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                  />
                  <span className="font-semibold text-slate-700">Requires Prescription (Rx)</span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={medForm.isAntibiotic}
                    onChange={(e) => setMedForm({ ...medForm, isAntibiotic: e.target.checked, requiresPrescription: e.target.checked ? true : medForm.requiresPrescription })}
                    className="rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                  />
                  <span className="font-semibold text-slate-700">Antibiotic Regulation</span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={medForm.isColdChain}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setMedForm({
                        ...medForm,
                        isColdChain: checked,
                        rackLocation: checked && !medForm.rackLocation.includes('Cold') ? 'Cold Storage (2°C - 8°C)' : medForm.rackLocation
                      });
                    }}
                    className="rounded text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                  />
                  <span className="font-semibold text-cyan-800 flex items-center gap-1">
                    <Snowflake className="w-3.5 h-3.5 text-cyan-600" />
                    Cold Chain (2°C - 8°C Refrigeration)
                  </span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={medForm.isNarcotic}
                    onChange={(e) => setMedForm({ ...medForm, isNarcotic: e.target.checked, requiresPrescription: e.target.checked ? true : medForm.requiresPrescription })}
                    className="rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                  <span className="font-semibold text-slate-700">Narcotic / Controlled (Schedule G)</span>
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
