import React, { useState, useEffect, useMemo } from 'react';
import type { Customer, Sale, PharmacySettings } from '../types/pharmacy';
import { db } from '../services/db';
import { sound } from '../utils/audio';
import { 
  Users, 
  UserPlus, 
  Search, 
  History, 
  X
} from 'lucide-react';

interface CustomersViewProps {
  settings: PharmacySettings;
}

export const CustomersView: React.FC<CustomersViewProps> = ({ settings }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [search, setSearch] = useState('');
  const [dueOnly, setDueOnly] = useState(false);

  // Modals
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [collectingCust, setCollectingCust] = useState<Customer | null>(null);
  const [collectionAmount, setCollectionAmount] = useState<string>('');
  const [collectionNotes, setCollectionNotes] = useState<string>('');
  const [viewHistoryCust, setViewHistoryCust] = useState<Customer | null>(null);

  // Customer form
  const [custForm, setCustForm] = useState({
    name: '',
    phone: '',
    address: '',
    creditLimit: 5000,
  });

  const refresh = () => {
    setCustomers(db.getCustomers());
    setSales(db.getSales());
  };

  useEffect(() => {
    refresh();
    const unsub = db.subscribe(refresh);
    return () => unsub();
  }, []);

  const totalDueReceivables = useMemo(() => {
    return customers.reduce((sum, c) => sum + c.dueBalance, 0);
  }, [customers]);

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      if (dueOnly && c.dueBalance <= 0) return false;
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.address && c.address.toLowerCase().includes(q))
      );
    });
  }, [customers, dueOnly, search]);

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!custForm.name || !custForm.phone) {
      alert('Please fill customer Name and Phone number.');
      return;
    }

    db.addCustomer(custForm);
    setIsAddCustomerOpen(false);
    setCustForm({ name: '', phone: '', address: '', creditLimit: 5000 });
  };

  const handleCollectDue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectingCust) return;
    const amount = parseFloat(collectionAmount) || 0;
    if (amount <= 0 || amount > collectingCust.dueBalance) {
      alert('Please enter a valid payment amount less than or equal to current due.');
      return;
    }

    db.collectCustomerDue(collectingCust.id, amount, collectionNotes);
    sound.playCheckoutSuccess();
    setCollectingCust(null);
    setCollectionAmount('');
    setCollectionNotes('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" />
            <span>Customer Directory & Khata (Credit Ledger)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage regular customer accounts, track credit limits, and collect due payments with receipt records.
          </p>
        </div>

        <button
          onClick={() => setIsAddCustomerOpen(true)}
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold rounded-xl shadow transition-all cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Register New Customer</span>
        </button>
      </div>

      {/* KPI Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-500 uppercase">Total Registered</span>
          <div className="text-2xl font-black text-slate-900 mt-1">{customers.length}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Active retail customers</p>
        </div>

        <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 shadow-sm">
          <span className="text-xs font-bold text-rose-700 uppercase">Total Due Receivables</span>
          <div className="text-2xl font-black text-rose-900 mt-1">
            {settings.currency}{totalDueReceivables.toFixed(2)}
          </div>
          <p className="text-[11px] text-rose-600 mt-0.5">Outstanding customer credit</p>
        </div>

        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-sm">
          <span className="text-xs font-bold text-emerald-700 uppercase">Customers with Zero Due</span>
          <div className="text-2xl font-black text-emerald-900 mt-1">
            {customers.filter((c) => c.dueBalance === 0).length}
          </div>
          <p className="text-[11px] text-emerald-600 mt-0.5">Clean settlement status</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer name, phone, or address..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none"
          />
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setDueOnly(false)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              !dueOnly ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            All Customers ({customers.length})
          </button>
          <button
            onClick={() => setDueOnly(true)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              dueOnly ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700'
            }`}
          >
            Due Only ({customers.filter((c) => c.dueBalance > 0).length})
          </button>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold text-[10px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Customer Details</th>
                <th className="py-3 px-4">Contact Phone</th>
                <th className="py-3 px-4">Address</th>
                <th className="py-3 px-4 text-right">Lifetime Spent</th>
                <th className="py-3 px-4 text-right">Credit Limit</th>
                <th className="py-3 px-4 text-right">Due Balance</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-900 text-sm">{c.name}</div>
                    <div className="text-[10px] text-slate-400">
                      Member since {new Date(c.createdAt).toLocaleDateString('en-GB')}
                    </div>
                  </td>

                  <td className="py-3.5 px-4 font-mono font-medium text-slate-800">
                    {c.phone}
                  </td>

                  <td className="py-3.5 px-4 text-slate-600">
                    {c.address || '—'}
                  </td>

                  <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                    {settings.currency}{c.totalSpent.toFixed(2)}
                  </td>

                  <td className="py-3.5 px-4 text-right text-slate-600">
                    {settings.currency}{c.creditLimit.toFixed(2)}
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-xs ${
                        c.dueBalance > 0 ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {settings.currency}{c.dueBalance.toFixed(2)}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end space-x-2">
                      {c.dueBalance > 0 && (
                        <button
                          onClick={() => {
                            setCollectingCust(c);
                            setCollectionAmount(c.dueBalance.toString());
                          }}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow cursor-pointer"
                        >
                          Collect Due
                        </button>
                      )}
                      <button
                        onClick={() => setViewHistoryCust(c)}
                        title="View Invoices"
                        className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      >
                        <History className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* COLLECT DUE MODAL */}
      {collectingCust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Collect Due Payment</h3>
                <p className="text-xs text-slate-400">Customer: {collectingCust.name} ({collectingCust.phone})</p>
              </div>
              <button onClick={() => setCollectingCust(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCollectDue} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex justify-between items-center">
                <span className="font-bold text-rose-800">Current Outstanding Due:</span>
                <span className="font-black text-sm text-rose-900">
                  {settings.currency}{collectingCust.dueBalance.toFixed(2)}
                </span>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Amount Collecting *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                    {settings.currency}
                  </span>
                  <input
                    type="number"
                    step="any"
                    required
                    value={collectionAmount}
                    onChange={(e) => setCollectionAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Notes / Payment Ref</label>
                <input
                  type="text"
                  value={collectionNotes}
                  onChange={(e) => setCollectionNotes(e.target.value)}
                  placeholder="e.g. Cash received by cashier, money receipt #412"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCollectingCust(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow cursor-pointer"
                >
                  Record Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REGISTER CUSTOMER MODAL */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="font-bold text-sm">Register New Customer</h3>
              <button onClick={() => setIsAddCustomerOpen(false)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Customer Full Name *</label>
                <input
                  type="text"
                  required
                  value={custForm.name}
                  onChange={(e) => setCustForm({ ...custForm, name: e.target.value })}
                  placeholder="e.g. Mr. Rafiqul Islam"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Mobile Number *</label>
                <input
                  type="text"
                  required
                  value={custForm.phone}
                  onChange={(e) => setCustForm({ ...custForm, phone: e.target.value })}
                  placeholder="e.g. 01711-223344"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Delivery / Home Address</label>
                <input
                  type="text"
                  value={custForm.address}
                  onChange={(e) => setCustForm({ ...custForm, address: e.target.value })}
                  placeholder="e.g. Road 8, House 14, Dhanmondi, Dhaka"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Credit Limit ({settings.currency})</label>
                <input
                  type="number"
                  value={custForm.creditLimit}
                  onChange={(e) => setCustForm({ ...custForm, creditLimit: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddCustomerOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow cursor-pointer"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOMER HISTORY DRAWER / MODAL */}
      {viewHistoryCust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">Purchase Invoices: {viewHistoryCust.name}</h3>
                <p className="text-xs text-slate-400">Phone: {viewHistoryCust.phone}</p>
              </div>
              <button onClick={() => setViewHistoryCust(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 max-h-[70vh] overflow-y-auto space-y-3 text-xs">
              {sales.filter((s) => s.customerId === viewHistoryCust.id).length === 0 ? (
                <p className="text-center text-slate-400 py-6">No previous invoices found for this customer.</p>
              ) : (
                sales
                  .filter((s) => s.customerId === viewHistoryCust.id)
                  .map((sale) => (
                    <div key={sale.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex justify-between items-center font-bold">
                        <span className="font-mono text-slate-900">{sale.invoiceNumber}</span>
                        <span className="text-emerald-700">{settings.currency}{sale.grandTotal.toFixed(2)}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex justify-between">
                        <span>Date: {new Date(sale.createdAt).toLocaleDateString('en-GB')}</span>
                        <span className="uppercase">{sale.paymentMethod}</span>
                      </div>
                      <div className="border-t border-slate-200 pt-1.5 space-y-0.5">
                        {sale.items.map((i, idx) => (
                          <div key={idx} className="flex justify-between text-[11px] text-slate-700">
                            <span>{i.medicineName} x {i.quantity}</span>
                            <span>{settings.currency}{i.totalPrice.toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
