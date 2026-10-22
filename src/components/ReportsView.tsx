import React, { useState, useEffect, useMemo } from 'react';
import type { Sale, PharmacySettings } from '../types/pharmacy';
import { db } from '../services/db';
import { 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Package, 
  Download, 
  Award,
  ArrowUpRight
} from 'lucide-react';

interface ReportsViewProps {
  settings: PharmacySettings;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ settings }) => {
  const [sales, setSales] = useState<Sale[]>([]);

  const refresh = () => {
    setSales(db.getSales());
  };

  useEffect(() => {
    refresh();
    const unsub = db.subscribe(refresh);
    return () => unsub();
  }, []);

  // Financial aggregates
  const financialSummary = useMemo(() => {
    let totalRevenue = 0;
    let totalCost = 0;
    let totalVat = 0;
    let totalDiscount = 0;

    sales.forEach((s) => {
      totalRevenue += s.grandTotal;
      totalVat += s.vatAmount;
      totalDiscount += s.discountAmount;

      s.items.forEach((item) => {
        totalCost += item.costPrice * item.quantity;
      });
    });

    const grossProfit = Math.max(0, totalRevenue - totalCost - totalVat);
    const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalCost,
      totalVat,
      totalDiscount,
      grossProfit,
      profitMargin,
    };
  }, [sales]);

  // Top selling medicines
  const topSelling = useMemo(() => {
    const map = new Map<string, { name: string; quantity: number; revenue: number }>();

    sales.forEach((s) => {
      s.items.forEach((item) => {
        const existing = map.get(item.medicineId) || { name: item.medicineName, quantity: 0, revenue: 0 };
        existing.quantity += item.quantity;
        existing.revenue += item.totalPrice;
        map.set(item.medicineId, existing);
      });
    });

    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [sales]);

  // Export CSV
  const handleExportCSV = () => {
    const headers = ['Invoice Number', 'Date', 'Customer', 'Doctor', 'Payment Method', 'Items Count', 'Subtotal', 'Discount', 'VAT', 'Grand Total', 'Paid', 'Due'];
    const rows = sales.map((s) => [
      s.invoiceNumber,
      new Date(s.createdAt).toLocaleDateString('en-GB'),
      s.customerName,
      s.doctorName || 'N/A',
      s.paymentMethod,
      s.items.length,
      s.subtotal.toFixed(2),
      s.discountAmount.toFixed(2),
      s.vatAmount.toFixed(2),
      s.grandTotal.toFixed(2),
      s.paidAmount.toFixed(2),
      s.dueAmount.toFixed(2),
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `medcare_sales_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-emerald-600" />
            <span>Financial Analytics & Business Reports</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time profit & loss accounting, revenue breakdown, and inventory movement analytics.
          </p>
        </div>

        <button
          onClick={handleExportCSV}
          className="inline-flex items-center space-x-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-bold rounded-xl shadow transition-all cursor-pointer"
        >
          <Download className="w-4 h-4 text-emerald-400" />
          <span>Export Sales CSV</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center text-slate-500 text-xs font-bold uppercase">
            <span>Total Sales Revenue</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {settings.currency}{financialSummary.totalRevenue.toFixed(2)}
          </div>
          <p className="text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-0.5">
            <ArrowUpRight className="w-3.5 h-3.5" /> Across {sales.length} customer invoices
          </p>
        </div>

        <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-sm">
          <div className="flex justify-between items-center text-emerald-800 text-xs font-bold uppercase">
            <span>Gross Profit</span>
            <Award className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-2xl font-black text-emerald-900 mt-2">
            {settings.currency}{financialSummary.grossProfit.toFixed(2)}
          </div>
          <p className="text-[11px] text-emerald-700 font-bold mt-1">
            Margin: {financialSummary.profitMargin.toFixed(1)}% of revenue
          </p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center text-slate-500 text-xs font-bold uppercase">
            <span>Collected VAT (5%)</span>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {settings.currency}{financialSummary.totalVat.toFixed(2)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Ready for NBR statutory filing</p>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center text-slate-500 text-xs font-bold uppercase">
            <span>Total Discounts Given</span>
            <Package className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {settings.currency}{financialSummary.totalDiscount.toFixed(2)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Customer loyalty savings</p>
        </div>
      </div>

      {/* Analytics Breakdown & Top 5 Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Top Selling Medicines */}
        <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Award className="w-4 h-4 text-emerald-600" />
            <span>Top Grossing Medicines</span>
          </h3>

          <div className="space-y-3">
            {topSelling.map((med, idx) => (
              <div key={idx} className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center space-x-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
                    #{idx + 1}
                  </span>
                  <div>
                    <h4 className="font-bold text-slate-900">{med.name}</h4>
                    <p className="text-[10px] text-slate-500">{med.quantity} units dispensed</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-slate-900 text-sm">
                    {settings.currency}{med.revenue.toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sales by Payment Method */}
        <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-900">Revenue by Payment Channel</h3>
          <div className="space-y-2.5 text-xs">
            {['cash', 'bkash', 'nagad', 'due'].map((pm) => {
              const channelTotal = sales
                .filter((s) => s.paymentMethod === pm)
                .reduce((sum, s) => sum + s.grandTotal, 0);
              const percentage = financialSummary.totalRevenue > 0
                ? ((channelTotal / financialSummary.totalRevenue) * 100).toFixed(1)
                : '0';

              return (
                <div key={pm} className="p-3 bg-slate-50 rounded-xl space-y-1.5">
                  <div className="flex justify-between font-bold text-slate-800">
                    <span className="uppercase">{pm}</span>
                    <span>{settings.currency}{channelTotal.toFixed(2)} ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        pm === 'cash'
                          ? 'bg-emerald-500'
                          : pm === 'bkash'
                          ? 'bg-pink-500'
                          : pm === 'nagad'
                          ? 'bg-orange-500'
                          : 'bg-amber-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
