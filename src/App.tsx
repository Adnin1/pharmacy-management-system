import { useState, useEffect } from 'react';
import type { UserRole, PharmacySettings } from './types/pharmacy';
import { db } from './services/db';
import { Navbar, type NavTab } from './components/Navbar';
import { POSView } from './components/POSView';
import { InventoryView } from './components/InventoryView';
import { BatchTrackerView } from './components/BatchTrackerView';
import { PrescriptionView } from './components/PrescriptionView';
import { CustomersView } from './components/CustomersView';
import { SuppliersView } from './components/SuppliersView';
import { ReportsView } from './components/ReportsView';
import { AuditLogsView } from './components/AuditLogsView';
import { SettingsView } from './components/SettingsView';

export function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('pos');
  const [role, setRole] = useState<UserRole>('admin');
  const [settings, setSettings] = useState<PharmacySettings>(db.getSettings());
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [expiringCount, setExpiringCount] = useState<number>(0);

  // Compute live badges
  const computeAlerts = () => {
    const meds = db.getMedicines();
    const batches = db.getBatches();

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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const cashierName = role === 'admin' ? 'Adnin Sadat (Admin)' : role === 'pharmacist' ? 'Pharmacist On Duty' : 'Counter Cashier';

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        role={role}
        onRoleChange={setRole}
        settings={settings}
        lowStockCount={lowStockCount}
        expiringCount={expiringCount}
      />

      {/* Main Workspace Body */}
      <main className="flex-1 pb-10">
        {currentTab === 'pos' && (
          <POSView settings={settings} cashierName={cashierName} />
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
        {currentTab === 'audit' && (
          <AuditLogsView settings={settings} />
        )}
        {currentTab === 'settings' && (
          <SettingsView settings={settings} onUpdateSettings={setSettings} />
        )}
      </main>
    </div>
  );
}

export default App;
