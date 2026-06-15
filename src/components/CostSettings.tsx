import { useEffect, useState, FormEvent } from 'react';
import { dbService } from '../db';
import { CostSettings, Profile, Order } from '../types';
import { useNotification } from './NotificationContext';
import { Sliders, HelpCircle, Save, TrendingUp, AlertCircle, RefreshCw, BarChart2, DollarSign } from 'lucide-react';

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

  // Financial Stats
  const [orders, setOrders] = useState<Order[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const loadSettingsData = async () => {
    setLoading(true);
    try {
      const data = await dbService.getCostSettings();
      setSettings(data);
      setPercent(data.product_cost_percent);
      setDelivery(data.default_delivery_cost);
      setOtherFixed(data.other_fixed_cost);

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
        },
        user.id
      );

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
        <div className="lg:col-span-1">
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
