import React, { useState, useEffect } from 'react';
import type { CashShift, PharmacySettings } from '../types/pharmacy';
import { db } from '../services/db';
import { sound } from '../utils/audio';
import { 
  X, 
  DollarSign, 
  Clock, 
  ShieldCheck, 
  AlertCircle, 
  Printer, 
  CheckCircle2, 
  History, 
  TrendingUp, 
  TrendingDown,
  ArrowRight
} from 'lucide-react';

interface ShiftManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: PharmacySettings;
  cashierName: string;
}

export const ShiftManagementModal: React.FC<ShiftManagementModalProps> = ({
  isOpen,
  onClose,
  settings,
  cashierName,
}) => {
  const [activeShift, setActiveShift] = useState<CashShift | null>(null);
  const [pastShifts, setPastShifts] = useState<CashShift[]>([]);
  const [viewTab, setViewTab] = useState<'current' | 'history'>('current');

  // Open shift form
  const [openingFloatInput, setOpeningFloatInput] = useState<string>('2000');
  const [cashierInput, setCashierInput] = useState<string>(cashierName);

  // Close shift form
  const [actualCashInput, setActualCashInput] = useState<string>('');
  const [closingNotes, setClosingNotes] = useState<string>('');
  const [closedZReportShift, setClosedZReportShift] = useState<CashShift | null>(null);

  const refreshShifts = () => {
    const current = db.getCurrentOpenShift();
    setActiveShift(current);
    const all = db.getCashShifts();
    setPastShifts(all.filter((s) => s.status === 'closed'));

    if (current) {
      setActualCashInput(current.expectedCash.toString());
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshShifts();
      setCashierInput(cashierName);
      setClosedZReportShift(null);
    }
  }, [isOpen, cashierName]);

  if (!isOpen) return null;

  const handleOpenShift = (e: React.FormEvent) => {
    e.preventDefault();
    const floatAmount = parseFloat(openingFloatInput) || 0;
    if (floatAmount < 0) {
      sound.playWarning();
      alert('Opening float cannot be negative.');
      return;
    }

    const shift = db.openCashShift(cashierInput.trim() || cashierName, floatAmount);
    sound.playScanBeep();
    setActiveShift(shift);
    setActualCashInput(shift.expectedCash.toString());
  };

  const handleCloseShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeShift) return;

    const counted = parseFloat(actualCashInput);
    if (isNaN(counted) || counted < 0) {
      sound.playWarning();
      alert('Please enter a valid physical cash count.');
      return;
    }

    const closed = db.closeCashShift(counted, closingNotes);
    if (closed) {
      sound.playCheckoutSuccess();
      setClosedZReportShift(closed);
      refreshShifts();
    }
  };

  const handlePrintZReport = () => {
    window.print();
  };

  const countedVal = parseFloat(actualCashInput) || 0;
  const expectedVal = activeShift ? activeShift.expectedCash : 0;
  const liveDiscrepancy = countedVal - expectedVal;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto no-print-backdrop">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white no-print">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight">Cash Drawer & Shift Management</h3>
              <p className="text-[11px] text-slate-400">Day Open Float, Day Close Reconciliation & Z-Report</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="bg-slate-800 p-0.5 rounded-lg flex text-xs">
              <button
                type="button"
                onClick={() => setViewTab('current')}
                className={`px-3 py-1 rounded-md font-semibold transition-all ${
                  viewTab === 'current' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Current Shift
              </button>
              <button
                type="button"
                onClick={() => setViewTab('history')}
                className={`px-3 py-1 rounded-md font-semibold transition-all ${
                  viewTab === 'history' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                History ({pastShifts.length})
              </button>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[80vh] overflow-y-auto">
          {viewTab === 'history' ? (
            /* History view */
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Past Closed Shifts & Z-Reports</h4>
              {pastShifts.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <History className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-semibold">No past closed shifts recorded.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pastShifts.map((s) => (
                    <div
                      key={s.id}
                      className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50/50 flex items-center justify-between transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-xs text-slate-900">{s.shiftNumber}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-200 text-slate-700 font-medium">
                            {s.cashierName}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {new Date(s.openedAt).toLocaleDateString('en-GB')} •{' '}
                          {new Date(s.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                          →{' '}
                          {s.closedAt
                            ? new Date(s.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            : 'N/A'}
                        </p>
                      </div>

                      <div className="text-right space-y-1">
                        <div className="text-xs font-bold text-slate-900">
                          Expected: {settings.currency}{s.expectedCash.toFixed(2)}
                        </div>
                        <div className="text-[11px]">
                          Actual Counted:{' '}
                          <span className="font-bold">
                            {settings.currency}{(s.actualCashCounted ?? s.expectedCash).toFixed(2)}
                          </span>{' '}
                          {s.discrepancy !== undefined && s.discrepancy !== 0 && (
                            <span
                              className={`font-bold ml-1 ${
                                s.discrepancy > 0 ? 'text-blue-600' : 'text-rose-600'
                              }`}
                            >
                              ({s.discrepancy > 0 ? `+${s.discrepancy.toFixed(2)}` : s.discrepancy.toFixed(2)})
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setClosedZReportShift(s);
                            setViewTab('current');
                          }}
                          className="text-[11px] text-emerald-600 font-bold hover:underline inline-flex items-center space-x-1"
                        >
                          <span>View Z-Report</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : closedZReportShift ? (
            /* Z-Report View */
            <div className="space-y-5">
              <div className="flex items-center justify-between no-print bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                <div className="flex items-center space-x-2 text-emerald-800">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="font-bold text-xs">Shift Successfully Closed & Reconciled</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handlePrintZReport}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Z-Report</span>
                  </button>
                  <button
                    onClick={() => {
                      setClosedZReportShift(null);
                      refreshShifts();
                    }}
                    className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50"
                  >
                    Done
                  </button>
                </div>
              </div>

              {/* Printable Z-Report Slip */}
              <div id="printable-z-report" className="p-6 bg-white border border-dashed border-slate-300 rounded-xl font-mono text-xs leading-relaxed max-w-md mx-auto">
                <div className="text-center pb-3 border-b border-dashed border-slate-300">
                  <h3 className="font-black text-sm uppercase text-slate-900">{settings.pharmacyName}</h3>
                  <p className="text-[10px] text-slate-500 font-sans">{settings.address}</p>
                  <p className="text-[10px] text-slate-600 font-sans font-bold mt-1">OFFICIAL POS CASH RECONCILIATION</p>
                  <div className="inline-block px-2 py-0.5 mt-1 bg-slate-900 text-white text-[10px] font-bold rounded">
                    Z-REPORT SLIP
                  </div>
                </div>

                <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Report No:</span>
                    <span className="font-bold">{closedZReportShift.shiftNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Cashier / Staff:</span>
                    <span className="font-bold">{closedZReportShift.cashierName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Opened At:</span>
                    <span>{new Date(closedZReportShift.openedAt).toLocaleString('en-GB')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Closed At:</span>
                    <span>
                      {closedZReportShift.closedAt
                        ? new Date(closedZReportShift.closedAt).toLocaleString('en-GB')
                        : new Date().toLocaleString('en-GB')}
                    </span>
                  </div>
                </div>

                <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1.5 text-[11px]">
                  <div className="flex justify-between text-slate-700">
                    <span>1. Opening Cash Float</span>
                    <span className="font-bold">{settings.currency}{closedZReportShift.openingFloat.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span>2. Gross Cash Sales (+)</span>
                    <span className="font-bold">+{settings.currency}{closedZReportShift.cashSales.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-rose-700">
                    <span>3. Cash Returns & Refunds (-)</span>
                    <span className="font-bold">-{settings.currency}{closedZReportShift.cashRefunds.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-slate-900 pt-1 border-t border-slate-200">
                    <span>4. Net System Expected Cash</span>
                    <span>{settings.currency}{closedZReportShift.expectedCash.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-black text-sm text-slate-900 pt-1">
                    <span>5. Actual Cash Counted</span>
                    <span className="text-emerald-700">
                      {settings.currency}{(closedZReportShift.actualCashCounted ?? closedZReportShift.expectedCash).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-xs pt-1 border-t border-slate-200">
                    <span>Cash Discrepancy (5 - 4):</span>
                    <span
                      className={
                        (closedZReportShift.discrepancy || 0) === 0
                          ? 'text-emerald-600'
                          : (closedZReportShift.discrepancy || 0) > 0
                          ? 'text-blue-600'
                          : 'text-rose-600'
                      }
                    >
                      {(closedZReportShift.discrepancy || 0) === 0
                        ? '0.00 (Balanced)'
                        : (closedZReportShift.discrepancy || 0) > 0
                        ? `+${settings.currency}${closedZReportShift.discrepancy?.toFixed(2)} (Over)`
                        : `-${settings.currency}${Math.abs(closedZReportShift.discrepancy || 0).toFixed(2)} (Short)`}
                    </span>
                  </div>
                  {closedZReportShift.notes && (
                    <div className="pt-2 text-[10px] text-slate-500 font-sans italic">
                      Notes: {closedZReportShift.notes}
                    </div>
                  )}
                </div>

                <div className="pt-8 grid grid-cols-2 gap-4 text-center text-[10px] font-sans">
                  <div className="border-t border-slate-400 pt-1">
                    <span className="text-slate-600 font-medium">Cashier Signature</span>
                  </div>
                  <div className="border-t border-slate-400 pt-1">
                    <span className="text-slate-600 font-medium">Supervisor / Auditor</span>
                  </div>
                </div>
              </div>
            </div>
          ) : !activeShift ? (
            /* Open Shift Form */
            <form onSubmit={handleOpenShift} className="space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 space-y-1">
                  <p className="font-bold">Register is Currently Closed</p>
                  <p>
                    Open the cash drawer by specifying the starting cash float (change money). All subsequent cash sales and returns will be tracked under this shift.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Cashier / Pharmacist On Duty
                  </label>
                  <input
                    type="text"
                    required
                    value={cashierInput}
                    onChange={(e) => setCashierInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Opening Cash Float ({settings.currency})
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">
                      {settings.currency}
                    </span>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      required
                      value={openingFloatInput}
                      onChange={(e) => setOpeningFloatInput(e.target.value)}
                      placeholder="e.g. 2000"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Standard petty cash amount stored in drawer for customer change.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-white font-bold rounded-xl text-sm shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Open Shift & Unlock POS Drawer</span>
                </button>
              </div>
            </form>
          ) : (
            /* Active Shift Overview & Close Form */
            <div className="space-y-5">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 animate-ping" />
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-xs text-emerald-950">Active Shift: {activeShift.shiftNumber}</span>
                      <span className="px-1.5 py-0.2 bg-emerald-200 text-emerald-800 rounded text-[10px] font-bold">
                        OPEN
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-700">
                      Cashier: <span className="font-semibold">{activeShift.cashierName}</span> • Opened at{' '}
                      {new Date(activeShift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Live Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[11px] text-slate-500 block">Opening Float</span>
                  <span className="text-sm font-black text-slate-900">
                    {settings.currency}{activeShift.openingFloat.toFixed(2)}
                  </span>
                </div>

                <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                  <span className="text-[11px] text-emerald-700 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-emerald-600" /> Cash Sales
                  </span>
                  <span className="text-sm font-black text-emerald-900">
                    +{settings.currency}{activeShift.cashSales.toFixed(2)}
                  </span>
                </div>

                <div className="p-3 bg-rose-50/60 border border-rose-200 rounded-xl">
                  <span className="text-[11px] text-rose-700 flex items-center gap-1">
                    <TrendingDown className="w-3 h-3 text-rose-600" /> Cash Refunds
                  </span>
                  <span className="text-sm font-black text-rose-900">
                    -{settings.currency}{activeShift.cashRefunds.toFixed(2)}
                  </span>
                </div>

                <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl">
                  <span className="text-[11px] text-indigo-700 font-semibold block">Expected in Drawer</span>
                  <span className="text-sm font-black text-indigo-900">
                    {settings.currency}{activeShift.expectedCash.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Day Close Reconciliation Form */}
              <form onSubmit={handleCloseShift} className="border-t border-slate-200 pt-4 space-y-4">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Day Close & Physical Cash Count
                </h4>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Physical Cash Counted in Drawer ({settings.currency})
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-sm">
                      {settings.currency}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={actualCashInput}
                      onChange={(e) => setActualCashInput(e.target.value)}
                      placeholder="Count notes and coins..."
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    />
                  </div>

                  {/* Discrepancy Live Alert */}
                  {actualCashInput !== '' && (
                    <div
                      className={`mt-2 p-2.5 rounded-xl text-xs font-medium flex items-center justify-between ${
                        liveDiscrepancy === 0
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : liveDiscrepancy > 0
                          ? 'bg-blue-50 text-blue-800 border border-blue-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}
                    >
                      <div className="flex items-center space-x-1.5">
                        <Clock className="w-4 h-4 shrink-0" />
                        <span>
                          {liveDiscrepancy === 0
                            ? 'Drawer is perfectly balanced (No discrepancy).'
                            : liveDiscrepancy > 0
                            ? `Drawer has an overage of +${settings.currency}${liveDiscrepancy.toFixed(2)}`
                            : `Drawer has a shortage of -${settings.currency}${Math.abs(liveDiscrepancy).toFixed(2)}`}
                        </span>
                      </div>
                      <span className="font-bold">
                        {liveDiscrepancy > 0 ? `+${liveDiscrepancy.toFixed(2)}` : liveDiscrepancy.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Closing Notes / Variance Explanation (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={closingNotes}
                    onChange={(e) => setClosingNotes(e.target.value)}
                    placeholder="e.g. ৳50 rounded change given to customer, verified with evening supervisor."
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  />
                </div>

                <div className="pt-2 flex space-x-2">
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Close Shift & Generate Official Z-Report</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
