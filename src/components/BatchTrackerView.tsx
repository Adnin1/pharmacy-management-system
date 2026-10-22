import React, { useState, useEffect, useMemo } from 'react';
import type { Batch, Medicine, PharmacySettings } from '../types/pharmacy';
import { db } from '../services/db';
import { 
  CalendarClock, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Trash2, 
  Search 
} from 'lucide-react';

interface BatchTrackerViewProps {
  settings: PharmacySettings;
}

export const BatchTrackerView: React.FC<BatchTrackerViewProps> = ({ settings }) => {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [filterMode, setFilterMode] = useState<'all' | 'expired' | '30' | '60' | '90'>('all');
  const [search, setSearch] = useState('');

  const refresh = () => {
    setBatches(db.getBatches());
    setMedicines(db.getMedicines());
  };

  useEffect(() => {
    refresh();
    const unsub = db.subscribe(refresh);
    return () => unsub();
  }, []);

  const medicineMap = useMemo(() => {
    const map = new Map<string, Medicine>();
    medicines.forEach((m) => map.set(m.id, m));
    return map;
  }, [medicines]);

  // Enhanced batch list with remaining days and urgency classification
  const analyzedBatches = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return batches
      .filter((b) => b.quantityInStock > 0)
      .map((b) => {
        const med = medicineMap.get(b.medicineId);
        const exp = new Date(b.expiryDate);
        exp.setHours(0, 0, 0, 0);
        const diffMs = exp.getTime() - today.getTime();
        const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        let urgency: 'expired' | 'critical' | 'warning' | 'safe' = 'safe';
        if (daysRemaining < 0) {
          urgency = 'expired';
        } else if (daysRemaining <= 30) {
          urgency = 'critical';
        } else if (daysRemaining <= 90) {
          urgency = 'warning';
        }

        return {
          ...b,
          medicine: med,
          daysRemaining,
          urgency,
        };
      })
      .sort((a, b) => a.daysRemaining - b.daysRemaining); // FEFO order
  }, [batches, medicineMap]);

  // Filtered
  const filtered = useMemo(() => {
    return analyzedBatches.filter((b) => {
      let matchFilter = true;
      if (filterMode === 'expired') matchFilter = b.urgency === 'expired';
      else if (filterMode === '30') matchFilter = b.daysRemaining <= 30;
      else if (filterMode === '60') matchFilter = b.daysRemaining <= 60;
      else if (filterMode === '90') matchFilter = b.daysRemaining <= 90;

      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        b.batchNumber.toLowerCase().includes(q) ||
        b.medicine?.name.toLowerCase().includes(q) ||
        b.medicine?.genericName.toLowerCase().includes(q) ||
        b.medicine?.rackLocation.toLowerCase().includes(q);

      return matchFilter && matchSearch;
    });
  }, [analyzedBatches, filterMode, search]);

  // Counts
  const counts = useMemo(() => {
    return {
      expired: analyzedBatches.filter((b) => b.urgency === 'expired').length,
      critical: analyzedBatches.filter((b) => b.urgency === 'critical').length,
      warning: analyzedBatches.filter((b) => b.urgency === 'warning').length,
      safe: analyzedBatches.filter((b) => b.urgency === 'safe').length,
    };
  }, [analyzedBatches]);

  // Quarantine or discard expired batch
  const handleDisposeBatch = (batch: Batch, medName: string) => {
    if (window.confirm(`Quarantine and write-off Batch ${batch.batchNumber} of ${medName}? This will set remaining stock to 0 and log an audit incident.`)) {
      db.updateBatch(batch.id, {
        quantityInStock: 0,
        status: 'quarantine',
      });
      db.logAction('BATCH_DISPOSAL', `Quarantined and disposed batch ${batch.batchNumber} of ${medName} (${batch.quantityInStock} units expired).`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <CalendarClock className="w-6 h-6 text-rose-600" />
          <span>FEFO (First Expire, First Out) Batch & Expiry Tracker</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Strict regulatory tracking of pharmaceutical batch lifespans. Ensures earliest expiring medicines are dispensed first.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => setFilterMode('expired')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterMode === 'expired'
              ? 'bg-rose-50 border-rose-400 ring-2 ring-rose-400/20'
              : 'bg-white border-slate-200 hover:border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-700 uppercase">Already Expired</span>
            <AlertTriangle className="w-5 h-5 text-rose-600" />
          </div>
          <div className="text-2xl font-black text-rose-800 mt-2">{counts.expired}</div>
          <p className="text-[11px] text-rose-600 mt-1">Immediate disposal required</p>
        </div>

        <div
          onClick={() => setFilterMode('30')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterMode === '30'
              ? 'bg-orange-50 border-orange-400 ring-2 ring-orange-400/20'
              : 'bg-white border-slate-200 hover:border-orange-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-orange-700 uppercase">Within 30 Days</span>
            <Clock className="w-5 h-5 text-orange-600" />
          </div>
          <div className="text-2xl font-black text-orange-800 mt-2">{counts.critical}</div>
          <p className="text-[11px] text-orange-600 mt-1">Critical FEFO priority</p>
        </div>

        <div
          onClick={() => setFilterMode('90')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterMode === '90'
              ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-400/20'
              : 'bg-white border-slate-200 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 uppercase">30 - 90 Days</span>
            <CalendarClock className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-800 mt-2">{counts.warning}</div>
          <p className="text-[11px] text-amber-600 mt-1">Upcoming expiry warning</p>
        </div>

        <div
          onClick={() => setFilterMode('all')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            filterMode === 'all'
              ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-400/20'
              : 'bg-white border-slate-200 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 uppercase">All Active Batches</span>
            <CheckCircle className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-800 mt-2">{analyzedBatches.length}</div>
          <p className="text-[11px] text-emerald-600 mt-1">In FEFO rotation sequence</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search batch number, medicine name, or rack..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
          />
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto">
          {[
            { id: 'all', label: 'All Batches' },
            { id: 'expired', label: 'Expired' },
            { id: '30', label: '< 30 Days' },
            { id: '60', label: '< 60 Days' },
            { id: '90', label: '< 90 Days' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilterMode(item.id as typeof filterMode)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                filterMode === item.id
                  ? 'bg-slate-900 text-white shadow'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Batches Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Batch Number</th>
                <th className="py-3 px-4">Medicine & Formulation</th>
                <th className="py-3 px-4">Rack Location</th>
                <th className="py-3 px-4">Expiry Date</th>
                <th className="py-3 px-4 text-center">Days Remaining</th>
                <th className="py-3 px-4 text-center">Remaining Stock</th>
                <th className="py-3 px-4 text-right">MRP Rate</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((b) => {
                return (
                  <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {b.batchNumber}
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 text-sm">{b.medicine?.name || 'Unknown'}</div>
                      <div className="text-[11px] text-slate-500 italic">{b.medicine?.genericName}</div>
                      <div className="text-[10px] text-slate-400">{b.medicine?.manufacturer}</div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[11px] font-mono">
                        {b.medicine?.rackLocation || 'N/A'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      {b.expiryDate}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                          b.urgency === 'expired'
                            ? 'bg-rose-100 text-rose-800'
                            : b.urgency === 'critical'
                            ? 'bg-orange-100 text-orange-800'
                            : b.urgency === 'warning'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {b.urgency === 'expired'
                          ? `Expired (${Math.abs(b.daysRemaining)}d ago)`
                          : `${b.daysRemaining} days left`}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center font-bold text-slate-900">
                      {b.quantityInStock} {b.medicine?.unit || 'units'}
                    </td>

                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      {settings.currency}{b.sellingPrice.toFixed(2)}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {b.urgency === 'expired' && (
                        <button
                          onClick={() => handleDisposeBatch(b, b.medicine?.name || 'Item')}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Dispose</span>
                        </button>
                      )}
                      {b.urgency !== 'expired' && (
                        <span className="text-[11px] font-semibold text-emerald-700 flex items-center justify-end gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> In Circulation
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
