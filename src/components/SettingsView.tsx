import React, { useState } from 'react';
import type { PharmacySettings } from '../types/pharmacy';
import { db } from '../services/db';
import { sound } from '../utils/audio';
import { 
  Settings, 
  Save, 
  Download, 
  Upload, 
  RotateCcw, 
  Building2, 
  Receipt,
  FileCheck
} from 'lucide-react';

interface SettingsViewProps {
  settings: PharmacySettings;
  onUpdateSettings: (settings: PharmacySettings) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, onUpdateSettings }) => {
  const [form, setForm] = useState<PharmacySettings>({ ...settings });
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    db.updateSettings(form);
    onUpdateSettings(form);
    sound.playCheckoutSuccess();
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleExportBackup = () => {
    const json = db.exportFullBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `medcare_pms_backup_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    sound.playCheckoutSuccess();
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = db.importFullBackup(content);
        if (success) {
          sound.playCheckoutSuccess();
          alert('System successfully restored from backup file!');
          window.location.reload();
        } else {
          sound.playWarning();
          alert('Invalid backup file format.');
        }
      }
    };
    reader.readAsText(file);
  };

  const handleFactoryReset = () => {
    if (window.confirm('Are you sure you want to restore the default demo dataset? This will replace any custom changes.')) {
      db.resetToDemoData();
      sound.playCheckoutSuccess();
      window.location.reload();
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Settings className="w-6 h-6 text-emerald-600" />
          <span>Pharmacy Configuration & System Controls</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Configure business details, receipt printing parameters, tax policies, and database backup / restore.
        </p>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2 animate-bounce">
          <FileCheck className="w-4 h-4 text-emerald-600" />
          <span>Pharmacy configuration saved successfully!</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5 text-xs">
        <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
          <Building2 className="w-4 h-4 text-emerald-600" />
          <span>Pharmacy Store Identity & Legal Information</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Pharmacy Trade Name *</label>
            <input
              type="text"
              required
              value={form.pharmacyName}
              onChange={(e) => setForm({ ...form, pharmacyName: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Tagline / Slogan</label>
            <input
              type="text"
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Customer Service Hotline *</label>
            <input
              type="text"
              required
              value={form.hotline}
              onChange={(e) => setForm({ ...form, hotline: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Official Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="font-bold text-slate-700 block mb-1">Store Address</label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Trade License No.</label>
            <input
              type="text"
              value={form.tradeLicenseNo}
              onChange={(e) => setForm({ ...form, tradeLicenseNo: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-700 focus:outline-none"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">VAT Reg No. / BIN</label>
            <input
              type="text"
              value={form.vatRegNo}
              onChange={(e) => setForm({ ...form, vatRegNo: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-700 focus:outline-none"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Currency Symbol</label>
            <input
              type="text"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none"
            />
          </div>
        </div>

        <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3 pt-3">
          <Receipt className="w-4 h-4 text-emerald-600" />
          <span>Billing & 80mm Receipt Layout</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Default VAT Rate (%)</label>
            <input
              type="number"
              min="0"
              max="50"
              value={form.defaultVatRate}
              onChange={(e) => setForm({ ...form, defaultVatRate: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Low-Stock Alert Window (Days)</label>
            <input
              type="number"
              min="10"
              max="365"
              value={form.lowStockThresholdDays}
              onChange={(e) => setForm({ ...form, lowStockThresholdDays: parseInt(e.target.value) || 60 })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="font-bold text-slate-700 block mb-1">Invoice Receipt Footer Notice</label>
          <textarea
            rows={3}
            value={form.invoiceFooterMsg}
            onChange={(e) => setForm({ ...form, invoiceFooterMsg: e.target.value })}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none"
          />
        </div>

        <div className="flex justify-end pt-3">
          <button
            type="submit"
            className="inline-flex items-center space-x-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold rounded-xl shadow cursor-pointer transition-all"
          >
            <Save className="w-4 h-4" />
            <span>Save Configuration</span>
          </button>
        </div>
      </form>

      {/* Backup & Data Persistence Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-xs">
        <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
          <Download className="w-4 h-4 text-emerald-600" />
          <span>Database Backup & Restoration</span>
        </h2>

        <p className="text-slate-500">
          Export your complete pharmacy catalog, batches, customer ledgers, sales history, and audit logs into a portable JSON backup archive.
        </p>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExportBackup}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow cursor-pointer transition-all"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export Database JSON</span>
          </button>

          <label className="inline-flex items-center space-x-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl border border-slate-300 shadow-sm cursor-pointer transition-all">
            <Upload className="w-4 h-4 text-slate-500" />
            <span>Import / Restore JSON</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              className="hidden"
            />
          </label>

          <button
            onClick={handleFactoryReset}
            className="inline-flex items-center space-x-2 px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl border border-rose-200 cursor-pointer transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset Demo Data</span>
          </button>
        </div>
      </div>
    </div>
  );
};
