import { useState, useEffect } from 'react';
import type { UserRole, PharmacySettings, CashShift } from './types/pharmacy';
import { db } from './services/db';
import { Navbar, type NavTab } from './components/Navbar';
import { POSView } from './components/POSView';
import { InventoryView } from './components/InventoryView';
import { BatchTrackerView } from './components/BatchTrackerView';
import { PrescriptionView } from './components/PrescriptionView';
import { CustomersView } from './components/CustomersView';
import { SuppliersView } from './components/SuppliersView';
import { ReportsView } from './components/ReportsView';
import { ReturnsView } from './components/ReturnsView';
import { AuditLogsView } from './components/AuditLogsView';
import { SettingsView } from './components/SettingsView';
import { ShiftManagementModal } from './components/ShiftManagementModal';

export function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('pos');
  const [role, setRole] = useState<UserRole>('admin');
  const [settings, setSettings] = useState<PharmacySettings>(db.getSettings());
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [expiringCount, setExpiringCount] = useState<number>(0);
  const [totalMedicinesCount, setTotalMedicinesCount] = useState<number>(0);
  const [openShift, setOpenShift] = useState<CashShift | null>(null);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState<boolean>(false);
  const [isAutoSeeding, setIsAutoSeeding] = useState<boolean>(false);
  const [seedProgress, setSeedProgress] = useState<number>(0);

  // Compute live badges
  const computeAlerts = () => {
    const meds = db.getMedicines();
    const batches = db.getBatches();
    setTotalMedicinesCount(meds.length);
    setOpenShift(db.getCurrentOpenShift());

    // Low stock
    const low = meds.filter((m) => {
      const stock = db.getMedicineStock(m.id);
      return stock <= m.reorderLevel;
    }).length;
    setLowStockCount(low);

    // Near expiry or expired (< 60 days)
    const thresholdDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    const exp = batches.filter((b) => {
      if (b.quantityInStock <= 0) return false;
      const d = new Date(b.expiryDate);
      return d <= thresholdDate;
    }).length;
    setExpiringCount(exp);
  };

  useEffect(() => {
    computeAlerts();
    const unsub = db.subscribe(() => {
      setSettings(db.getSettings());
      computeAlerts();
    });

    // Auto-seed the full 35,000+ MedEx & DGDA national catalog on fresh launch
    const autoSeedCatalog = async () => {
      try {
        await db.whenReady();
        const currentCount = db.getMedicines().length;
        if (currentCount < 1000) {
          setIsAutoSeeding(true);
          await db.autoSeedIfEmpty((p) => setSeedProgress(p));
          computeAlerts();
        }
      } catch (err) {
        console.warn('Auto-seed notice:', err);
      } finally {
        setIsAutoSeeding(false);
      }
    };

    autoSeedCatalog();
    return () => unsub();
  }, []);

  // Keyboard shortcut listener (F1 - F7)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        setCurrentTab('pos');
      } else if (e.key === 'F2') {
        e.preventDefault();
        setCurrentTab('inventory');
      } else if (e.key === 'F3') {
        e.preventDefault();
        setCurrentTab('expiry');
      } else if (e.key === 'F4') {
        e.preventDefault();
        setCurrentTab('prescriptions');
      } else if (e.key === 'F5') {
        e.preventDefault();
        setCurrentTab('customers');
      } else if (e.key === 'F6') {
        e.preventDefault();
        setCurrentTab('suppliers');
      } else if (e.key === 'F7') {
        e.preventDefault();
        setCurrentTab('reports');
      } else if (e.key === 'F8') {
        e.preventDefault();
        setCurrentTab('returns');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const cashierName = role === 'admin' ? 'Adnin Sadat (Admin)' : role === 'pharmacist' ? 'Pharmacist On Duty' : 'Counter Cashier';

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Auto-seeding top notification banner */}
      {isAutoSeeding && (
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-4 py-2 border-b border-indigo-500/30 shadow-lg flex items-center justify-between text-xs z-50">
          <div className="flex items-center space-x-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="font-bold text-emerald-300">
              Auto-Seeding 35,000+ Bangladesh National Medicines (MedEx & DGDA)...
            </span>
            <span className="text-slate-400 font-mono text-[11px] hidden sm:inline">
              Loading active batches, cold chain flags, and unit retail prices ({seedProgress}%)
            </span>
          </div>
          <div className="w-28 bg-slate-800 rounded-full h-1.5 overflow-hidden border border-slate-700">
            <div
              className="bg-emerald-400 h-1.5 transition-all duration-300 rounded-full"
              style={{ width: `${Math.max(5, seedProgress)}%` }}
            />
          </div>
        </div>
      )}

      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        role={role}
        onRoleChange={setRole}
        settings={settings}
        lowStockCount={lowStockCount}
        expiringCount={expiringCount}
        totalMedicinesCount={totalMedicinesCount}
        openShift={openShift}
        onOpenShiftModal={() => setIsShiftModalOpen(true)}
      />

      {/* Main Workspace Body */}
      <main className="flex-1 pb-10">
        {currentTab === 'pos' && (
          <POSView 
            settings={settings} 
            cashierName={cashierName}
            onOpenShiftModal={() => setIsShiftModalOpen(true)}
            onNavigateToReturns={() => setCurrentTab('returns')}
          />
        )}
        {currentTab === 'inventory' && (
          <InventoryView settings={settings} />
        )}
        {currentTab === 'expiry' && (
          <BatchTrackerView settings={settings} />
        )}
        {currentTab === 'prescriptions' && (
          <PrescriptionView settings={settings} />
        )}
        {currentTab === 'customers' && (
          <CustomersView settings={settings} />
        )}
        {currentTab === 'suppliers' && (
          <SuppliersView settings={settings} />
        )}
        {currentTab === 'reports' && (
          <ReportsView settings={settings} />
        )}
        {currentTab === 'returns' && (
          <ReturnsView settings={settings} />
        )}
        {currentTab === 'audit' && (
          <AuditLogsView settings={settings} />
        )}
        {currentTab === 'settings' && (
          <SettingsView settings={settings} onUpdateSettings={setSettings} />
        )}
      </main>

      {/* Shift & Cash Register Modal */}
      <ShiftManagementModal
        isOpen={isShiftModalOpen}
        onClose={() => setIsShiftModalOpen(false)}
        settings={settings}
        cashierName={cashierName}
      />
    </div>
  );
}

export default App;
