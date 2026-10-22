import React, { useState, useEffect, useMemo } from 'react';
import type { Sale, Doctor, PharmacySettings } from '../types/pharmacy';
import { db } from '../services/db';
import { 
  FileText, 
  Stethoscope, 
  Plus, 
  Search, 
  X
} from 'lucide-react';

interface PrescriptionViewProps {
  settings: PharmacySettings;
}

export const PrescriptionView: React.FC<PrescriptionViewProps> = ({ settings }) => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'antibiotics' | 'doctors'>('all');

  // Add doctor modal
  const [isAddDoctorOpen, setIsAddDoctorOpen] = useState(false);
  const [docForm, setDocForm] = useState({
    name: '',
    bmdcNumber: '',
    specialization: '',
    hospitalOrChamber: '',
    phone: '',
  });

  const refresh = () => {
    setSales(db.getSales());
    setDoctors(db.getDoctors());
  };

  useEffect(() => {
    refresh();
    const unsub = db.subscribe(refresh);
    return () => unsub();
  }, []);

  // Filter sales with doctor / prescription info
  const prescriptionSales = useMemo(() => {
    return sales.filter((s) => {
      const hasRx = s.doctorName || s.items.some((i) => {
        const med = db.getMedicineById(i.medicineId);
        return med?.requiresPrescription || med?.isAntibiotic;
      });

      if (!hasRx) return false;

      if (filterType === 'antibiotics') {
        const hasAntibiotic = s.items.some((i) => {
          const med = db.getMedicineById(i.medicineId);
          return med?.isAntibiotic;
        });
        if (!hasAntibiotic) return false;
      }

      const q = search.toLowerCase().trim();
      if (!q) return true;

      return (
        s.invoiceNumber.toLowerCase().includes(q) ||
        s.customerName.toLowerCase().includes(q) ||
        (s.doctorName && s.doctorName.toLowerCase().includes(q)) ||
        (s.doctorBmdc && s.doctorBmdc.toLowerCase().includes(q))
      );
    });
  }, [sales, filterType, search]);

  const handleAddDoctor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docForm.name || !docForm.bmdcNumber) {
      alert('Please enter Doctor Name and BMDC Number.');
      return;
    }

    db.addDoctor(docForm);
    setIsAddDoctorOpen(false);
    setDocForm({
      name: '',
      bmdcNumber: '',
      specialization: '',
      hospitalOrChamber: '',
      phone: '',
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-6 h-6 text-emerald-600" />
            <span>Prescription Registry & Antibiotic Compliance</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Statutory registry of prescribed drugs, BMDC practitioner registration verification, and antibiotic stewardship logs.
          </p>
        </div>

        <button
          onClick={() => setIsAddDoctorOpen(true)}
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-xl shadow transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Register New Doctor</span>
        </button>
      </div>

      {/* Tabs & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Doctor BMDC, Patient, or Invoice..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterType === 'all' ? 'bg-slate-900 text-white shadow' : 'bg-slate-100 text-slate-600'
            }`}
          >
            All Prescriptions ({prescriptionSales.length})
          </button>
          <button
            onClick={() => setFilterType('antibiotics')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterType === 'antibiotics' ? 'bg-purple-600 text-white shadow' : 'bg-purple-50 text-purple-700'
            }`}
          >
            Antibiotic Logs
          </button>
          <button
            onClick={() => setFilterType('doctors')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterType === 'doctors' ? 'bg-emerald-600 text-white shadow' : 'bg-slate-100 text-slate-600'
            }`}
          >
            Registered Doctors ({doctors.length})
          </button>
        </div>
      </div>

      {/* DOCTORS DIRECTORY TAB */}
      {filterType === 'doctors' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {doctors.map((doc) => (
            <div key={doc.id} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm leading-tight">{doc.name}</h3>
                  <span className="inline-block text-[10px] font-mono font-bold px-1.5 py-0.2 bg-emerald-50 text-emerald-700 rounded border border-emerald-200 mt-0.5">
                    BMDC: {doc.bmdcNumber}
                  </span>
                </div>
              </div>
              <div className="text-xs text-slate-600 pt-2 border-t border-slate-100 space-y-1">
                <div><strong>Spec:</strong> {doc.specialization}</div>
                <div><strong>Chamber:</strong> {doc.hospitalOrChamber}</div>
                {doc.phone && <div><strong>Phone:</strong> {doc.phone}</div>}
                <div className="pt-1 text-[11px] font-bold text-slate-900">
                  Total Prescriptions Dispensed: <span className="text-emerald-700">{doc.prescriptionCount}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* PRESCRIPTION DISPENSE LOGS TABLE */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">Date & Invoice</th>
                  <th className="py-3 px-4">Patient / Customer</th>
                  <th className="py-3 px-4">Prescribing Doctor</th>
                  <th className="py-3 px-4">BMDC Reg No.</th>
                  <th className="py-3 px-4">Prescribed Medicines Dispensed</th>
                  <th className="py-3 px-4 text-right">Invoice Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {prescriptionSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-bold font-mono text-slate-900">{sale.invoiceNumber}</div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(sale.createdAt).toLocaleDateString('en-GB')} {new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{sale.customerName}</div>
                      <div className="text-[11px] text-slate-400">{sale.customerPhone || 'Walk-in'}</div>
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      {sale.doctorName || <span className="text-slate-400 italic">OTC / Patient Request</span>}
                    </td>

                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-700">
                      {sale.doctorBmdc || '—'}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        {sale.items.map((item, idx) => {
                          const med = db.getMedicineById(item.medicineId);
                          return (
                            <div key={idx} className="flex items-center space-x-1.5 text-xs">
                              <span className="font-bold text-slate-900">{item.medicineName}</span>
                              <span className="text-slate-500">({item.quantity} {item.unitType})</span>
                              {med?.isAntibiotic && (
                                <span className="text-[9px] font-bold px-1.5 py-0.2 bg-purple-100 text-purple-700 rounded">
                                  Antibiotic
                                </span>
                              )}
                              <span className="text-[10px] text-slate-400 font-mono">B:{item.batchNumber}</span>
                            </div>
                          );
                        })}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right font-black text-slate-900">
                      {settings.currency}{sale.grandTotal.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REGISTER DOCTOR MODAL */}
      {isAddDoctorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Register Medical Practitioner</h3>
              <button onClick={() => setIsAddDoctorOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddDoctor} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Doctor Name *</label>
                <input
                  type="text"
                  required
                  value={docForm.name}
                  onChange={(e) => setDocForm({ ...docForm, name: e.target.value })}
                  placeholder="e.g. Prof. Dr. A. K. Azad"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">BMDC Registration Number *</label>
                <input
                  type="text"
                  required
                  value={docForm.bmdcNumber}
                  onChange={(e) => setDocForm({ ...docForm, bmdcNumber: e.target.value })}
                  placeholder="e.g. A-39201"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Specialization</label>
                <input
                  type="text"
                  value={docForm.specialization}
                  onChange={(e) => setDocForm({ ...docForm, specialization: e.target.value })}
                  placeholder="e.g. Cardiology, Chest, Pediatrics"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Hospital / Chamber Name</label>
                <input
                  type="text"
                  value={docForm.hospitalOrChamber}
                  onChange={(e) => setDocForm({ ...docForm, hospitalOrChamber: e.target.value })}
                  placeholder="e.g. Square Hospital / Labaid Diagnostic"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={docForm.phone}
                  onChange={(e) => setDocForm({ ...docForm, phone: e.target.value })}
                  placeholder="e.g. 01711-000000"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddDoctorOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow cursor-pointer"
                >
                  Save Doctor Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
