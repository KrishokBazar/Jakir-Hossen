import { useEffect, useState, FormEvent } from 'react';
import { dbService } from '../db';
import { CostSettings, Profile, Order } from '../types';
import { useNotification } from './NotificationContext';
import { Sliders, HelpCircle, Save, TrendingUp, AlertCircle, RefreshCw, BarChart2, DollarSign, Palette, Database, Activity } from 'lucide-react';

interface CostSettingsProps {
  user: Profile;
}

export default function CostSettingsView({ user }: CostSettingsProps) {
  const { showError, showNotification } = useNotification();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<CostSettings | null>(null);

  // Form Fields
  const [percent, setPercent] = useState(40);
  const [delivery, setDelivery] = useState(50);
  const [otherFixed, setOtherFixed] = useState(0);
  const [theme, setTheme] = useState<'green' | 'blue' | 'purple' | 'orange' | 'charcoal'>('green');

  // Financial Stats
  const [orders, setOrders] = useState<Order[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Manual sync states
  const [manualSync, setManualSync] = useState<boolean>(() => {
    return localStorage.getItem('kb_manual_sync_enabled') === 'true';
  });
  const [syncing, setSyncing] = useState<boolean>(false);
  const [lastSynced, setLastSynced] = useState<string | null>(() => {
    return localStorage.getItem('kb_last_synced_time') || null;
  });

  const handleToggleManualSync = (enabled: boolean) => {
    setManualSync(enabled);
    localStorage.setItem('kb_manual_sync_enabled', enabled ? 'true' : 'false');
    showNotification(
      enabled ? "ম্যানুয়াল সিঙ্ক সক্রিয়" : "লাইভ সিঙ্ক সক্রিয়",
      enabled 
        ? "রিয়েল-টাইম লাইভ আপডেট নিষ্ক্রিয় করা হয়েছে। এখন থেকে ম্যানুয়ালি সিঙ্ক করতে হবে।" 
        : "স্বয়ংক্রিয় রিয়েল-টাইম লাইভ আপডেট পুনরায় চালু করা হয়েছে।",
      "success"
    );
  };

  const handleForceSync = async () => {
    setSyncing(true);
    try {
      await dbService.forceSyncAllActive();
      const nowStr = new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastSynced(nowStr);
      localStorage.setItem('kb_last_synced_time', nowStr);
      showNotification("সিঙ্ক সফল", "ডাটাবেজের সাথে সফলভাবে সকল তথ্য সিঙ্ক করা হয়েছে!", "success");
    } catch (err: any) {
      showError("সিঙ্ক করতে সমস্যা হয়েছে", err);
    } finally {
      setSyncing(false);
    }
  };

  const loadSettingsData = async () => {
    setLoading(true);
    try {
      const data = await dbService.getCostSettings();
      setSettings(data);
      setPercent(data.product_cost_percent);
      setDelivery(data.default_delivery_cost);
      setOtherFixed(data.other_fixed_cost);
      setTheme(data.theme || 'green');

      const ords = await dbService.getOrders();
      setOrders(ords);
    } catch (err) {
      console.error("Error reading cost settings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettingsData();
  }, []);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    try {
      await dbService.updateCostSettings(
        {
          product_cost_percent: percent,
          default_delivery_cost: delivery,
          other_fixed_cost: otherFixed,
          theme: theme,
        },
        user.id
      );

      localStorage.setItem('branch_theme', theme);
      window.dispatchEvent(new Event('local-theme-updated'));

      setSaveSuccess(true);
      showNotification("Success", "Settings update cataloged successfully!", "success");
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      showError("Error saving settings", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  // Financial Accounting Calculations
  const grossSales = orders.reduce((sum, o) => {
    const isReturn = o.status === 'return';
    const rawAmt = Math.abs(Number(o.amount) || 0);
    const signedAmt = isReturn ? -rawAmt : rawAmt;
    return sum + signedAmt;
  }, 0);

  const totalProductCosts = orders.reduce((sum, o) => sum + o.product_cost, 0);
  const totalDeliveryCosts = orders.reduce((sum, o) => sum + o.delivery_cost, 0);
  const totalOtherCosts = orders.reduce((sum, o) => sum + o.other_costs, 0);
  const aggregateExpense = totalProductCosts + totalDeliveryCosts + totalOtherCosts;
  
  const netEarnings = orders.reduce((sum, o) => sum + o.profit, 0);

  // Calculate percentages
  const productCostPercent = grossSales > 0 ? (totalProductCosts / grossSales) * 100 : 0;
  const deliveryCostPercent = grossSales > 0 ? (totalDeliveryCosts / grossSales) * 100 : 0;
  const remainingMarginPercent = grossSales > 0 ? (netEarnings / grossSales) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Sliders className="w-6 h-6 text-emerald-600" />
            খরচ এবং মূল্য সেটিংস (Default Cost Coefficient Setup)
          </h2>
          <p className="text-xs text-slate-500">Configure global pre-fill costs for operator transaction entries & review fiscal yields.</p>
        </div>
        <button
          onClick={loadSettingsData}
          className="p-2.5 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Configuration Card */}
        <div className="lg:col-span-1 space-y-6">
          <form onSubmit={handleSave} className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2 flex items-center gap-1.5">
              Cost Settings Coefficients
            </h3>

            {saveSuccess && (
              <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs p-2.5 rounded-lg font-medium animate-fade-in-down">
                ✓ Cost metrics synchronized with Supabase database successfully.
              </div>
            )}

            {/* Product cost percentage */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1">
                  Product Weight (Percent %)
                </label>
                <span className="text-[10px] text-slate-400 font-bold">Of Gross Sales</span>
              </div>
              <div className="relative rounded-md shadow-xs">
                <input
                  type="number"
                  value={percent}
                  onChange={(e) => setPercent(parseFloat(e.target.value) || 0)}
                  className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-sm focus:ring-1 focus:ring-emerald-500 font-mono"
                  placeholder="e.g., 40"
                  min="0"
                  max="100"
                  required
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400 text-xs font-bold">%</div>
              </div>
              <p className="mt-1 text-[10px] text-slate-450 leading-normal">
                If order is 2,000৳ and setting is 40%, product cost auto-fills to 800৳.
              </p>
            </div>

            {/* Standard Delivery Benchmark */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Default Logistics Cost (৳ BDT)
              </label>
              <div className="relative rounded-md shadow-xs">
                <input
                  type="number"
                  value={delivery}
                  onChange={(e) => setDelivery(parseFloat(e.target.value) || 0)}
                  className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-sm focus:ring-1 focus:ring-emerald-500 font-mono"
                  placeholder="e.g., 50"
                  min="0"
                  required
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400 text-xs">BDT</div>
              </div>
              <p className="mt-1 text-[10px] text-slate-450 leading-normal">
                Default flat delivery cost pre-filled onto new operator orders.
              </p>
            </div>

            {/* Default Other Carrying Cost */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Default Carrying / Other Costs (৳ BDT)
              </label>
              <div className="relative rounded-md shadow-xs">
                <input
                  type="number"
                  value={otherFixed}
                  onChange={(e) => setOtherFixed(parseFloat(e.target.value) || 0)}
                  className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-sm focus:ring-1 focus:ring-emerald-500 font-mono"
                  placeholder="e.g., 20"
                  min="0"
                  required
                />
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400 text-xs text-slate-400">BDT</div>
              </div>
              <p className="mt-1 text-[10px] text-slate-450">
                Default backup overhead costs (carrying, wrapping, etc.).
              </p>
            </div>

            {/* Company Branding / Branch Color Scheme Accent Settings */}
            <div className="border-t border-slate-100 pt-4">
              <label className="block text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                <Palette className="w-4 h-4 text-emerald-600 shrink-0" />
                কোম্পানি ব্র্যান্ডিং থিম (Branch Branding Theme)
              </label>
              
              <div className="grid grid-cols-5 gap-2">
                {[
                  { value: 'green', name: 'সবুজ', label: 'Default', bg: 'bg-emerald-600' },
                  { value: 'blue', name: 'নীল', label: 'Royal', bg: 'bg-blue-600' },
                  { value: 'purple', name: 'বেগুনী', label: 'Crimson', bg: 'bg-purple-600' },
                  { value: 'orange', name: 'সোনালী', label: 'Golden', bg: 'bg-orange-600' },
                  { value: 'charcoal', name: 'ধূসর', label: 'Slate', bg: 'bg-slate-700' },
                ].map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setTheme(item.value as any)}
                    className={`flex flex-col items-center p-2 rounded-xl border text-center transition-all cursor-pointer ${
                      theme === item.value 
                        ? 'border-emerald-600 bg-emerald-50/40 ring-1 ring-emerald-500 shadow-3xs' 
                        : 'border-slate-200 bg-slate-50/55 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full ${item.bg} block shadow-3xs border border-white shrink-0`} />
                    <span className="text-[10px] font-bold text-slate-800 mt-1 block truncate leading-none">{item.name}</span>
                    <span className="text-[8px] text-slate-450 block mt-0.5 truncate leading-none uppercase tracking-wider">{item.label}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-slate-450 leading-relaxed">
                স্থানীয় শাখার ব্র্যান্ড ডিজাইনের সাথে সামঞ্জস্য রাখতে সমগ্র সিস্টেমের রঙ ও থিম পরিবর্তন করতে সাহায্য করবে।
              </p>
            </div>

            {/* Submit Button */}
            <div className="border-t border-slate-100 pt-4.5">
              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 hover:border-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" /> Synchronize Coefficients
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Manual Database Sync Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2 flex items-center gap-1.5">
              <Database className="w-4 h-4 text-amber-500 shrink-0" />
              ম্যানুয়াল ডাটাবেজ সিঙ্ক (Manual DB Sync)
            </h3>

            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-800">ম্যানুয়াল সিঙ্ক মোড সক্রিয় করুন</p>
                <p className="text-[10px] text-slate-450 leading-relaxed">
                  ধীরগতির নেটওয়ার্কে লাইভ আপডেট পিছিয়ে থাকলে লাইভ সিঙ্ক বন্ধ করে এই মোড অন করুন।
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleToggleManualSync(!manualSync)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  manualSync ? 'bg-amber-500' : 'bg-slate-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    manualSync ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {manualSync ? (
              <div className="bg-amber-50/50 border border-amber-100 p-3.5 rounded-lg space-y-3">
                <div className="flex items-center gap-2 text-amber-800 text-xs font-medium">
                  <Activity className="w-4 h-4 text-amber-600 animate-pulse shrink-0" />
                  <span>ম্যানুয়াল সিঙ্ক মোড রানিং আছে</span>
                </div>
                
                <p className="text-[10px] text-amber-700 leading-normal">
                  সিস্টেমের কোনো তথ্য স্বয়ংক্রিয়ভাবে আপডেট হবে না। ডাটাবেজ থেকে নতুন ডাটা লোড করতে নিচের বাটনটি ব্যবহার করুন।
                </p>

                <button
                  type="button"
                  onClick={handleForceSync}
                  disabled={syncing}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-xs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'ডাটাবেজ থেকে তথ্য আনা হচ্ছে...' : 'এখনই ডাটা সিঙ্ক করুন (Force Sync)'}
                </button>

                {lastSynced && (
                  <p className="text-[9px] text-slate-450 text-center font-mono">
                    সর্বশেষ সফল সিঙ্ক: <span className="font-bold">{lastSynced}</span>
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-slate-50/70 border border-slate-100 p-3.5 rounded-lg space-y-2">
                <div className="flex items-center gap-2 text-slate-750 text-xs font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 -ml-4" />
                  <span>স্বয়ংক্রিয় লাইভ সিঙ্ক সক্রিয়</span>
                </div>
                <p className="text-[10px] text-slate-450 leading-relaxed">
                  ডাটাবেজে কোনো পরিবর্তন হলেই তা তাৎক্ষণিকভাবে স্বয়ংক্রিয়ভাবে আপনার স্ক্রিনে আপডেট হয়ে যাচ্ছে।
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Consolidated Financial Yield statement (Admin Audit) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900 text-white p-5 rounded-xl border border-slate-800 shadow-xs">
            <h3 className="font-bold font-sans text-sm border-b border-slate-800 pb-2 text-white mb-4 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-emerald-400" />
              Consolidated Financial Profit & Loss Audit
            </h3>

            {orders.length === 0 ? (
              <div className="text-center py-10">
                <AlertCircle className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400 font-sans">No order logs in database. Financial sheets await operator entries.</p>
              </div>
            ) : (
              <div className="space-y-6 font-mono text-xs">
                {/* Visual grid of indicators */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-800/60">
                    <div className="text-[10px] text-slate-400 uppercase font-sans font-semibold mb-1">Gross Yield</div>
                    <div className="text-sm font-bold text-emerald-400">৳{grossSales.toLocaleString()}</div>
                  </div>
                  <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-800/60">
                    <div className="text-[10px] text-slate-400 uppercase font-sans font-semibold mb-1">Agg Expenses</div>
                    <div className="text-sm font-bold text-amber-450">৳{aggregateExpense.toLocaleString()}</div>
                  </div>
                  <div className="bg-slate-800/40 p-3 rounded-lg border border-slate-800/60">
                    <div className="text-[10px] text-slate-400 uppercase font-sans font-semibold mb-1">Net Earnings</div>
                    <div className={`text-sm font-extrabold ${netEarnings >= 0 ? 'text-emerald-400' : 'text-rose-450'}`}>
                      ৳{netEarnings.toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Vertical Ledgers */}
                <div className="space-y-2 border-t border-slate-800/60 pt-4 font-sans text-slate-300">
                  <div className="flex justify-between items-center text-[11px] uppercase tracking-wider text-slate-450 mb-1 font-mono">
                    <span>Fiscal Breakdown item</span>
                    <span>Proportion ratio</span>
                  </div>

                  {/* Product cost share */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-mono">
                      <span>1. Payments to Farmers (সবজি ক্রয়মূল্য)</span>
                      <span className="font-bold">৳{totalProductCosts.toLocaleString()} ({(productCostPercent).toFixed(1)}%)</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${productCostPercent || 0}%` }} />
                    </div>
                  </div>

                  {/* Delivery / Logistics share */}
                  <div className="space-y-1 mt-3">
                    <div className="flex justify-between text-xs font-mono">
                      <span>2. Logistical/Delivery Costs (ডেলিভারি খরচ)</span>
                      <span className="font-bold">৳{totalDeliveryCosts.toLocaleString()} ({(deliveryCostPercent).toFixed(1)}%)</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${deliveryCostPercent || 0}%` }} />
                    </div>
                  </div>

                  {/* Net Profit share */}
                  <div className="space-y-1 mt-3">
                    <div className="flex justify-between text-xs font-mono">
                      <span>3. Net Operational Profit (পরিচালনা মুনাফা)</span>
                      <span className={`font-bold ${netEarnings >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ৳{netEarnings.toLocaleString()} ({(remainingMarginPercent).toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className={`h-1.5 rounded-full ${netEarnings >= 0 ? 'bg-emerald-450' : 'bg-rose-500'}`} 
                        style={{ width: `${netEarnings >= 0 ? (remainingMarginPercent || 0) : 0}%` }} 
                      />
                    </div>
                  </div>
                </div>

                {/* Additional audit info */}
                <div className="mt-4 bg-slate-800/40 p-3 rounded-lg border border-slate-800/40 text-[10px] text-slate-400 font-sans leading-relaxed">
                  * All calculations are computed instantly upon order cataloging (calculated as Net Profit = Amount - [Merchant Product Cost + Delivery Cost + Other Handled Overheads]). Overrides and return voids are dynamically reflected.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
