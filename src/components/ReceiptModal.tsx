import React, { useState } from 'react';
import type { Sale, PharmacySettings } from '../types/pharmacy';
import { Printer, X, CheckCircle, ShieldCheck } from 'lucide-react';

interface ReceiptModalProps {
  sale: Sale;
  settings: PharmacySettings;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ sale, settings, onClose }) => {
  const [format, setFormat] = useState<'80mm' | '58mm' | 'a4'>(
    settings.receiptPrintFormat || '80mm'
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto no-print-backdrop">
      <div
        className={`relative bg-white rounded-2xl shadow-2xl w-full overflow-hidden border border-slate-200 transition-all ${
          format === 'a4' ? 'max-w-4xl' : format === '58mm' ? 'max-w-xs' : 'max-w-md'
        }`}
      >
        {/* Header toolbar (hidden when printing) */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white no-print">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <span className="font-semibold text-sm">Sale Completed</span>
          </div>

          {/* Format Switcher Pills */}
          <div className="flex items-center space-x-1 bg-slate-800 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setFormat('80mm')}
              className={`px-2.5 py-1 rounded font-semibold transition-all ${
                format === '80mm' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              80mm Thermal
            </button>
            <button
              onClick={() => setFormat('58mm')}
              className={`px-2.5 py-1 rounded font-semibold transition-all ${
                format === '58mm' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              58mm Mobile
            </button>
            <button
              onClick={() => setFormat('a4')}
              className={`px-2.5 py-1 rounded font-semibold transition-all ${
                format === 'a4' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              A4 Tax Invoice
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-lg text-xs font-semibold shadow transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* PRINTABLE RECEIPT CONTENT */}
        <div className="max-h-[80vh] overflow-y-auto">
          {format === 'a4' ? (
            /* ==================== A4 / A5 OFFICIAL TAX INVOICE ==================== */
            <div id="printable-receipt" className="p-8 bg-white font-sans text-xs text-slate-900 leading-relaxed space-y-6">
              {/* Invoice Header */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="w-9 h-9 rounded-xl bg-emerald-600 text-white font-bold flex items-center justify-center text-base">
                      Rx
                    </span>
                    <div>
                      <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">{settings.pharmacyName}</h1>
                      <p className="text-xs text-slate-500">{settings.tagline}</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 mt-2">{settings.address}</p>
                  <p className="text-xs text-slate-600">Hotline: {settings.hotline} • Email: {settings.email}</p>
                  <p className="text-xs text-slate-700 font-semibold">
                    Drug License: {settings.drugLicenseNo || 'DL-DHK-2024-8841'} • BIN/VAT Reg: {settings.vatRegNo} • Trade Lic: {settings.tradeLicenseNo}
                  </p>
                </div>

                <div className="text-right">
                  <div className="inline-block px-3 py-1 bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded">
                    OFFICIAL RETAIL TAX INVOICE
                  </div>
                  <p className="font-mono font-bold text-sm text-slate-900 mt-2">
                    Invoice #: {sale.invoiceNumber}
                  </p>
                  <p className="text-xs text-slate-500">
                    Date: {new Date(sale.createdAt).toLocaleDateString('en-GB')} {new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-xs text-slate-600 font-semibold uppercase">
                    Payment: {sale.paymentMethod}
                  </p>
                </div>
              </div>

              {/* Patient & Doctor Context */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Billed To (Customer / Patient):</span>
                  <span className="text-sm font-bold text-slate-900">{sale.customerName}</span>
                  {sale.customerPhone && <p className="text-xs text-slate-600">Phone: {sale.customerPhone}</p>}
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">Prescribing Physician:</span>
                  <span className="text-sm font-bold text-slate-900">{sale.doctorName || 'Over-the-Counter (OTC)'}</span>
                  {sale.doctorBmdc && <p className="text-xs text-slate-600">BMDC Reg No: {sale.doctorBmdc}</p>}
                  <p className="text-xs text-slate-500">Cashier: {sale.cashierName}</p>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <table className="w-full text-left border border-slate-300 text-xs">
                  <thead className="bg-slate-100 border-b border-slate-300 text-slate-800">
                    <tr>
                      <th className="p-2 border-r border-slate-300 text-center">SL</th>
                      <th className="p-2 border-r border-slate-300">Medicine & Generic Name</th>
                      <th className="p-2 border-r border-slate-300">Batch No</th>
                      <th className="p-2 border-r border-slate-300">Expiry</th>
                      <th className="p-2 border-r border-slate-300 text-center">Unit</th>
                      <th className="p-2 border-r border-slate-300 text-center">Qty</th>
                      <th className="p-2 border-r border-slate-300 text-right">MRP ({settings.currency})</th>
                      <th className="p-2 border-r border-slate-300 text-right">Disc %</th>
                      <th className="p-2 text-right">Total ({settings.currency})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {sale.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-2 text-center border-r border-slate-300">{idx + 1}</td>
                        <td className="p-2 border-r border-slate-300">
                          <div className="font-bold text-slate-900">{item.medicineName}</div>
                          <div className="text-[10px] text-slate-500 italic">{item.genericName}</div>
                        </td>
                        <td className="p-2 font-mono border-r border-slate-300">{item.batchNumber}</td>
                        <td className="p-2 font-mono border-r border-slate-300">{item.expiryDate.slice(0, 7)}</td>
                        <td className="p-2 text-center uppercase border-r border-slate-300">{item.unitType}</td>
                        <td className="p-2 text-center font-bold border-r border-slate-300">{item.quantity}</td>
                        <td className="p-2 text-right border-r border-slate-300">{item.unitPrice.toFixed(2)}</td>
                        <td className="p-2 text-right border-r border-slate-300">{item.discountPercent}%</td>
                        <td className="p-2 text-right font-bold text-slate-900">{item.totalPrice.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Summary */}
              <div className="flex justify-end">
                <div className="w-72 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span className="font-bold">{settings.currency}{sale.subtotal.toFixed(2)}</span>
                  </div>
                  {sale.discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Discount Amount:</span>
                      <span className="font-bold">-{settings.currency}{sale.discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600">
                    <span>VAT ({sale.vatPercent}%):</span>
                    <span className="font-bold">+{settings.currency}{sale.vatAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t-2 border-slate-900">
                    <span>Net Payable:</span>
                    <span className="text-emerald-700">{settings.currency}{sale.grandTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-700 pt-1">
                    <span>Amount Paid:</span>
                    <span className="font-bold">{settings.currency}{sale.paidAmount.toFixed(2)}</span>
                  </div>
                  {sale.changeAmount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-bold">
                      <span>Change Returned:</span>
                      <span>{settings.currency}{sale.changeAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {sale.dueAmount > 0 && (
                    <div className="flex justify-between text-rose-700 font-black">
                      <span>Due Balance:</span>
                      <span>{settings.currency}{sale.dueAmount.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer & Signature Blocks */}
              <div className="pt-12 grid grid-cols-2 gap-8 text-center text-xs">
                <div className="border-t border-slate-400 pt-2">
                  <p className="font-bold text-slate-800">Customer / Receiver Signature</p>
                  <p className="text-[10px] text-slate-500">I have received all medicines in good condition.</p>
                </div>
                <div className="border-t border-slate-400 pt-2">
                  <p className="font-bold text-slate-800">Registered Pharmacist Signature</p>
                  <p className="text-[10px] text-slate-500">Dispensed under DGDA pharmacy regulations.</p>
                </div>
              </div>
            </div>
          ) : (
            /* ==================== 80mm & 58mm THERMAL POS RECEIPT ==================== */
            <div
              id="printable-receipt"
              className={`p-5 bg-white font-mono leading-relaxed mx-auto ${
                format === '58mm' ? 'text-[10px] max-w-[240px]' : 'text-xs max-w-sm'
              }`}
            >
              {/* Pharmacy Header */}
              <div className="text-center pb-3 border-b border-dashed border-slate-300">
                <div className="flex justify-center mb-1">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
                    Rx
                  </span>
                </div>
                <h2 className="font-black text-sm uppercase tracking-wide text-slate-900">{settings.pharmacyName}</h2>
                <p className="text-[10px] text-slate-500 font-sans">{settings.tagline}</p>
                <p className="text-[10px] text-slate-600 font-sans mt-0.5">{settings.address}</p>
                <p className="text-[10px] text-slate-700 font-sans">Hotline: {settings.hotline}</p>
                <div className="flex justify-center gap-1.5 text-[9px] text-slate-500 font-sans mt-1 flex-wrap">
                  <span>DL: {settings.drugLicenseNo || 'DL-DHK-2024-8841'}</span>
                  <span>•</span>
                  <span>BIN: {settings.vatRegNo}</span>
                </div>
              </div>

              {/* Invoice Meta */}
              <div className="py-2 border-b border-dashed border-slate-300 text-[11px] space-y-0.5">
                <div className="flex justify-between font-bold">
                  <span>Inv: {sale.invoiceNumber}</span>
                  <span className="uppercase">{sale.paymentMethod}</span>
                </div>
                <div className="flex justify-between text-slate-600 text-[10px]">
                  <span>Date: {new Date(sale.createdAt).toLocaleDateString('en-GB')}</span>
                  <span>{new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="flex justify-between text-slate-700 text-[10px]">
                  <span>Cust: {sale.customerName}</span>
                  {sale.customerPhone && <span>{sale.customerPhone}</span>}
                </div>
                {sale.doctorName && (
                  <div className="text-[9px] text-emerald-800 bg-emerald-50 p-1 rounded font-sans">
                    Dr: {sale.doctorName} {sale.doctorBmdc ? `(${sale.doctorBmdc})` : ''}
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
              <div className="py-2 border-b border-dashed border-slate-300">
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
                      <tr key={idx} className="text-[10px]">
                        <td className="py-1 pr-1">
                          <div className="font-bold text-slate-900 leading-tight">{item.medicineName}</div>
                          <div className="text-[8px] text-slate-500">
                            B:{item.batchNumber} | Exp:{item.expiryDate.slice(0, 7)} ({item.unitType})
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
              <div className="py-2 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
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
                <div className="flex justify-between text-xs font-black text-slate-900 pt-1 border-t border-slate-200">
                  <span>NET PAYABLE</span>
                  <span>{settings.currency}{sale.grandTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-800 pt-0.5">
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
              <div className="pt-2 text-center space-y-1.5">
                <div className="flex flex-col items-center">
                  <div className="h-6 w-40 bg-slate-900 flex items-center justify-center text-white text-[8px] tracking-widest font-mono">
                    |||| ||||| |||| || |||||| ||||
                  </div>
                  <span className="text-[8px] text-slate-500 font-mono tracking-wider mt-0.5">{sale.invoiceNumber}</span>
                </div>
                <p className="text-[9px] text-slate-500 font-sans leading-tight">
                  {settings.invoiceFooterMsg}
                </p>
                <p className="text-[8px] text-slate-400 font-sans">
                  MedCare PMS • Bangladesh Pharmacy ERP
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal footer buttons (hidden when printing) */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex gap-3 no-print">
          <button
            onClick={handlePrint}
            className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-semibold rounded-xl text-xs shadow transition-all cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print {format.toUpperCase()} Invoice</span>
          </button>
          <button
            onClick={onClose}
            className="py-2.5 px-5 bg-white hover:bg-slate-100 text-slate-700 font-semibold rounded-xl text-xs border border-slate-300 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
