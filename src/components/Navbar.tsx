import React, { useState, useEffect } from 'react';
import { 
  Pill, 
  ShoppingCart, 
  Package, 
  CalendarClock, 
  FileText, 
  Users, 
  Truck, 
  BarChart3, 
  ShieldAlert, 
  Settings, 
  AlertTriangle,
  Clock,
  Maximize2,
  Minimize2,
  UserCheck
} from 'lucide-react';
import type { UserRole, PharmacySettings } from '../types/pharmacy';

export type NavTab = 
  | 'pos' 
  | 'inventory' 
  | 'expiry' 
  | 'prescriptions' 
  | 'customers' 
  | 'suppliers' 
  | 'reports' 
  | 'audit' 
  | 'settings';

interface NavbarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  role: UserRole;
  onRoleChange: (role: UserRole) => void;
  settings: PharmacySettings;
  lowStockCount: number;
  expiringCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  role,
  onRoleChange,
  settings,
  lowStockCount,
  expiringCount,
}) => {
  const [time, setTime] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  const navItems: { id: NavTab; label: string; icon: React.ReactNode; badge?: number; badgeColor?: string; shortcut?: string }[] = [
    { id: 'pos', label: 'POS Billing', icon: <ShoppingCart className="w-4 h-4" />, shortcut: 'F1' },
    { id: 'inventory', label: 'Medicines', icon: <Package className="w-4 h-4" />, badge: lowStockCount > 0 ? lowStockCount : undefined, badgeColor: 'bg-amber-500', shortcut: 'F2' },
    { id: 'expiry', label: 'FEFO Expiry', icon: <CalendarClock className="w-4 h-4" />, badge: expiringCount > 0 ? expiringCount : undefined, badgeColor: 'bg-rose-500', shortcut: 'F3' },
    { id: 'prescriptions', label: 'Rx Register', icon: <FileText className="w-4 h-4" />, shortcut: 'F4' },
    { id: 'customers', label: 'Customers & Due', icon: <Users className="w-4 h-4" />, shortcut: 'F5' },
    { id: 'suppliers', label: 'Procurement', icon: <Truck className="w-4 h-4" />, shortcut: 'F6' },
    { id: 'reports', label: 'Analytics', icon: <BarChart3 className="w-4 h-4" />, shortcut: 'F7' },
    { id: 'audit', label: 'Audit Logs', icon: <ShieldAlert className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <header className="bg-slate-900 text-white shadow-xl sticky top-0 z-40 border-b border-slate-800 select-none no-print">
      {/* Top Banner Bar */}
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between border-b border-slate-800/80 text-xs">
        {/* Brand identity */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shadow-md shadow-emerald-500/20">
            <Pill className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm tracking-tight text-white">{settings.pharmacyName}</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                PRO v5.0
              </span>
            </div>
            <p className="text-[10px] text-slate-400 leading-none">{settings.tagline}</p>
          </div>
        </div>

        {/* Status indicators & Utilities */}
        <div className="flex items-center space-x-4">
          {/* Alerts ticker */}
          {expiringCount > 0 && (
            <button
              onClick={() => onSelectTab('expiry')}
              className="hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 transition-all cursor-pointer animate-pulse"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span className="font-semibold">{expiringCount} Near Expiry / Expired</span>
            </button>
          )}

          {lowStockCount > 0 && (
            <button
              onClick={() => onSelectTab('inventory')}
              className="hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-all cursor-pointer"
            >
              <Package className="w-3.5 h-3.5" />
              <span>{lowStockCount} Low Stock</span>
            </button>
          )}

          {/* Live Clock */}
          <div className="hidden md:flex items-center space-x-1.5 text-slate-300 bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700/60 font-mono">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span>{time}</span>
          </div>

          {/* Role selector dropdown */}
          <div className="flex items-center space-x-1.5 bg-slate-800/80 px-2 py-1 rounded-lg border border-slate-700/60">
            <UserCheck className="w-3.5 h-3.5 text-teal-400" />
            <select
              value={role}
              onChange={(e) => onRoleChange(e.target.value as UserRole)}
              className="bg-transparent text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer"
            >
              <option value="admin" className="bg-slate-900 text-white">Admin (Full Access)</option>
              <option value="pharmacist" className="bg-slate-900 text-white">Pharmacist</option>
              <option value="cashier" className="bg-slate-900 text-white">Cashier (POS Only)</option>
            </select>
          </div>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            title="Toggle Fullscreen"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <nav className="max-w-7xl mx-auto px-4 flex items-center space-x-1 overflow-x-auto py-1 scrollbar-none">
        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`relative flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-700/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
              {item.badge !== undefined && (
                <span className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold text-white ${item.badgeColor || 'bg-slate-600'}`}>
                  {item.badge}
                </span>
              )}
              {item.shortcut && (
                <span className={`text-[9px] px-1 rounded ${isActive ? 'bg-emerald-700 text-emerald-200' : 'bg-slate-800 text-slate-400'} font-mono`}>
                  {item.shortcut}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
};
