import React from 'react';
import type { Sale, PharmacySettings } from '../types/pharmacy';
import { Printer, X, CheckCircle, ShieldCheck } from 'lucide-react';

interface ReceiptModalProps {
  sale: Sale;
  settings: PharmacySettings;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ sale, settings, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto no-print-backdrop">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        {/* Header toolbar (hidden when printing) */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white no-print">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <span className="font-semibold text-sm">Sale Completed</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-lg text-xs font-semibold shadow transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print 80mm</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* The Printable 80mm Thermal Receipt */}
        <div id="printable-receipt" className="p-6 bg-white font-mono text-xs text-slate-900 leading-relaxed">
          {/* Pharmacy Header */}
          <div className="text-center pb-3 border-b border-dashed border-slate-300">
            <div className="flex justify-center mb-1">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold text-sm">
                Rx
              </span>
            </div>
            <h2 className="font-black text-sm uppercase tracking-wide text-slate-900">{settings.pharmacyName}</h2>
            <p className="text-[10px] text-slate-500 font-sans">{settings.tagline}</p>
            <p className="text-[10px] text-slate-600 font-sans mt-0.5">{settings.address}</p>
            <p className="text-[10px] text-slate-700 font-sans">Hotline: {settings.hotline}</p>
            <div className="flex justify-center gap-2 text-[9px] text-slate-500 font-sans mt-1">
              <span>BIN: {settings.vatRegNo}</span>
              <span>•</span>
              <span>TL: {settings.tradeLicenseNo}</span>
            </div>
          </div>

          {/* Invoice Meta */}
          <div className="py-2.5 border-b border-dashed border-slate-300 text-[11px] space-y-0.5">
            <div className="flex justify-between font-bold">
              <span>Invoice: {sale.invoiceNumber}</span>
              <span>{sale.paymentMethod.toUpperCase()}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Date: {new Date(sale.createdAt).toLocaleDateString('en-GB')}</span>
              <span>Time: {new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div className="flex justify-between text-slate-700">
              <span>Customer: {sale.customerName}</span>
              {sale.customerPhone && <span>{sale.customerPhone}</span>}
            </div>
            {sale.doctorName && (
              <div className="text-[10px] text-emerald-800 bg-emerald-50 p-1 rounded font-sans">
                Prescribed by: {sale.doctorName} (BMDC: {sale.doctorBmdc || 'N/A'})
              </div>
            )}
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>Cashier: {sale.cashierName}</span>
              <span className="text-emerald-700 font-semibold flex items-center gap-0.5">
                <ShieldCheck className="w-3 h-3 inline" /> Verified
              </span>
            </div>
          </div>

          {/* Items Table */}
          <div className="py-2.5 border-b border-dashed border-slate-300">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 text-[10px] text-slate-500 uppercase">
                  <th className="py-1 font-semibold">Item & Batch</th>
                  <th className="py-1 text-center font-semibold">Qty</th>
                  <th className="py-1 text-right font-semibold">Price</th>
                  <th className="py-1 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sale.items.map((item, idx) => (
                  <tr key={idx} className="text-[11px]">
                    <td className="py-1 pr-1">
                      <div className="font-bold text-slate-900">{item.medicineName}</div>
                      <div className="text-[9px] text-slate-500">
                        B:{item.batchNumber} | Exp:{item.expiryDate.slice(0, 7)}
                      </div>
                    </td>
                    <td className="py-1 text-center whitespace-nowrap">{item.quantity}</td>
                    <td className="py-1 text-right whitespace-nowrap">{settings.currency}{item.unitPrice.toFixed(2)}</td>
                    <td className="py-1 text-right font-bold whitespace-nowrap">{settings.currency}{item.totalPrice.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Breakdown */}
          <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
            <div className="flex justify-between text-slate-700">
              <span>Subtotal</span>
              <span>{settings.currency}{sale.subtotal.toFixed(2)}</span>
            </div>
            {sale.discountAmount > 0 && (
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Discount</span>
                <span>-{settings.currency}{sale.discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-700">
              <span>VAT ({sale.vatPercent}%)</span>
              <span>+{settings.currency}{sale.vatAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-black text-slate-900 pt-1 border-t border-slate-200">
              <span>NET PAYABLE</span>
              <span>{settings.currency}{sale.grandTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-800 pt-1">
              <span>Amount Paid</span>
              <span className="font-semibold">{settings.currency}{sale.paidAmount.toFixed(2)}</span>
            </div>
            {sale.changeAmount > 0 && (
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>Change Returned</span>
                <span>{settings.currency}{sale.changeAmount.toFixed(2)}</span>
              </div>
            )}
            {sale.dueAmount > 0 && (
              <div className="flex justify-between text-rose-700 font-black">
                <span>DUE BALANCE</span>
                <span>{settings.currency}{sale.dueAmount.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Barcode & Footer Notice */}
          <div className="pt-3 text-center space-y-2">
            {/* Barcode simulation */}
            <div className="flex flex-col items-center">
              <div className="h-7 w-48 bg-slate-900 flex items-center justify-center text-white text-[9px] tracking-widest font-mono">
                |||| ||||| |||| || |||||| ||||
              </div>
              <span className="text-[9px] text-slate-500 font-mono tracking-wider mt-0.5">{sale.invoiceNumber}</span>
            </div>
            <p className="text-[9px] text-slate-500 font-sans leading-tight">
              {settings.invoiceFooterMsg}
            </p>
            <p className="text-[8px] text-slate-400 font-sans">
              Powered by MedCare PMS • www.medcarepharmacy.com.bd
            </p>
          </div>
        </div>

        {/* Modal footer buttons (hidden when printing) */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-3 no-print">
          <button
            onClick={handlePrint}
            className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-semibold rounded-xl text-sm shadow transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Receipt</span>
          </button>
          <button
            onClick={onClose}
            className="py-2.5 px-5 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-xl text-sm border border-slate-300 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
