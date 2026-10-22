import React, { useState, useEffect, useMemo } from 'react';
import type { AuditLog, PharmacySettings } from '../types/pharmacy';
import { db } from '../services/db';
import { Search, ShieldAlert } from 'lucide-react';

interface AuditLogsViewProps {
  settings: PharmacySettings;
}

export const AuditLogsView: React.FC<AuditLogsViewProps> = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState('');

  const refresh = () => {
    setLogs(db.getAuditLogs());
  };

  useEffect(() => {
    refresh();
    const unsub = db.subscribe(refresh);
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return (
        l.action.toLowerCase().includes(q) ||
        l.details.toLowerCase().includes(q) ||
        l.userName.toLowerCase().includes(q)
      );
    });
  }, [logs, search]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-emerald-600" />
          <span>Security & Regulatory Audit Trail</span>
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Tamper-evident system activity log tracking inventory write-offs, price edits, POS invoices, and antibiotic dispensing.
        </p>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search audit actions, users, or details..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action Event</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Event Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4 font-mono text-slate-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleDateString('en-GB')}{' '}
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </td>

                  <td className="py-3.5 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-800">
                      {log.action}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 font-semibold text-slate-800 whitespace-nowrap">
                    {log.userName}
                  </td>

                  <td className="py-3.5 px-4 text-slate-600">
                    {log.details}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
