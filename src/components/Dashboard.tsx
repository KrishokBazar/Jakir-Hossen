import { useEffect, useState } from 'react';
import { dbService } from '../db';
import { DailyStat, Profile } from '../types';
import { useNotification } from './NotificationContext';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { 
  DollarSign, 
  ShoppingCart, 
  TrendingUp, 
  RotateCcw, 
  Sliders, 
  Users, 
  PlusCircle, 
  FileText, 
  Activity,
  ArrowRight,
  Coins,
  Leaf
} from 'lucide-react';

interface DashboardProps {
  user: Profile;
  onNavigate: (tab: string) => void;
  pendingOperatorsCount: number;
}

export default function Dashboard({ user, onNavigate, pendingOperatorsCount }: DashboardProps) {
  const { showError, showNotification } = useNotification();
  const [loading, setLoading] = useState(true);
  const [operatorsList, setOperatorsList] = useState<Profile[]>([]);
  const [stats, setStats] = useState<{
    todaySales: number;
    todayProfit: number;
    todayOrders: number;
    todayReturns: number;
    weekSales: number;
    monthSales: number;
    costBreakdown: {
      product: number;
      delivery: number;
      other: number;
    };
    chartData: DailyStat[];
  } | null>(null);

  useEffect(() => {
    let unsubscribeOps = () => {};
    if (user.role === 'admin') {
      unsubscribeOps = dbService.subscribeOperators(
        (ops) => {
          setOperatorsList(ops);
        },
        (err) => {
          console.error("Error subscribing to operators on dashboard:", err);
        }
      );
    }

    const unsubscribeStats = dbService.subscribeStats(
      (liveStats) => {
        setStats(liveStats);
        setLoading(false);
      },
      (err) => {
        console.error("Error loading stats:", err);
        showError("Error loading dashboard stats", err);
        setLoading(false);
      }
    );
    return () => {
      unsubscribeOps();
      unsubscribeStats();
    };
  }, [user, showError]);

  if (loading || !stats) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  const defaultAdminKeyPresent = !dbService.getCurrentUser()?.phone && !dbService.getCurrentUser()?.email;

  return (
    <div className="space-y-6">
      {/* Banner / Header */}
      <div className="bg-bento-primary border-l-8 border-bento-accent text-white p-7 rounded-bento shadow-bento overflow-hidden relative">
        <div className="relative z-10">
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white mb-2">
            স্বাগতম, {user.name}! 🌟
          </h2>
          <p className="max-w-2xl text-xs sm:text-sm text-white/85 leading-relaxed font-sans font-semibold">
            এটি অ্যাডমিন এবং অপারেটরদের জন্য কৃষক বাজারের একটি সুরক্ষিত অভ্যন্তরীণ তথ্য ড্যাশবোর্ড। এখান থেকে নিরাপদভাবে লজিস্টিকস হিসাব, কৃষকদের পেমেন্ট সংগ্রহ, লাভের মার্জিন বিশ্লেষণ এবং গ্রামীণ অর্ডারসমূহ সফলভাবে পরিচালনা করা যাবে।
          </p>
        </div>
        <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-10 flex items-center justify-end pr-8 pointer-events-none">
          <Activity className="w-48 h-48 stroke-[1]" />
        </div>
      </div>

      {/* Grid of Key Numerical Analytics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Today Sales */}
        <div className="bg-bento-card p-5 rounded-bento border border-bento-border shadow-bento flex items-center justify-between transition-all duration-205 hover:-translate-y-0.5">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-bento-muted uppercase tracking-wider mb-0.5">আজকের মোট বিক্রয়</p>
            <p className="text-2xl font-extrabold text-bento-primary tracking-tight font-mono">
              ৳{stats.todaySales.toLocaleString()}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-bento-muted">
              <span>এই সপ্তাহে:</span>
              <span className="font-bold text-bento-primary-light">৳{stats.weekSales.toLocaleString()}</span>
            </div>
          </div>
          <div className="bg-bento-primary/10 text-bento-primary p-3.5 rounded-bento">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Total Today Profit */}
        <div className="bg-bento-card p-5 rounded-bento border border-bento-border shadow-bento flex items-center justify-between transition-all duration-205 hover:-translate-y-0.5">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-bento-muted uppercase tracking-wider mb-0.5">আজকের নীট লাভ</p>
            <p className={`text-2xl font-extrabold tracking-tight font-mono ${stats.todayProfit >= 0 ? 'text-bento-success' : 'text-bento-danger'}`}>
              ৳{stats.todayProfit.toLocaleString()}
            </p>
            <div className="flex items-center gap-1.5 text-xs text-bento-muted">
              <span>এই মাসে:</span>
              <span className="font-bold text-bento-primary-light">৳{stats.monthSales.toLocaleString()}</span>
            </div>
          </div>
          <div className={`p-3.5 rounded-bento ${stats.todayProfit >= 0 ? 'bg-bento-success/10 text-bento-success' : 'bg-bento-danger/10 text-bento-danger'}`}>
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Total Today Orders */}
        <div className="bg-bento-card p-5 rounded-bento border border-bento-border shadow-bento flex items-center justify-between transition-all duration-205 hover:-translate-y-0.5">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-bento-muted uppercase tracking-wider mb-0.5">আজকের অর্ডার সংখ্যা</p>
            <p className="text-2xl font-extrabold text-bento-primary tracking-tight font-mono">
              {stats.todayOrders} টি
            </p>
            <div className="text-xs text-bento-muted font-sans font-semibold">ডেলিভারি সম্পন্ন</div>
          </div>
          <div className="bg-blue-500/10 text-blue-600 p-3.5 rounded-bento">
            <ShoppingCart className="w-6 h-6" />
          </div>
        </div>

        {/* Total Returns */}
        <div className="bg-bento-card p-5 rounded-bento border border-bento-border shadow-bento flex items-center justify-between transition-all duration-205 hover:-translate-y-0.5">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-bento-muted uppercase tracking-wider mb-0.5">আজকের ফেরত সংখ্যা</p>
            <p className="text-2xl font-extrabold text-bento-primary tracking-tight font-mono">
              {stats.todayReturns} টি
            </p>
            <div className="text-xs text-bento-danger font-sans font-semibold">ফেরতকৃত বা সমন্বিত</div>
          </div>
          <div className="bg-bento-danger/10 text-bento-danger p-3.5 rounded-bento">
            <RotateCcw className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-sans">
        {/* Chart Card */}
        <div className="bg-bento-card p-5 rounded-bento border border-bento-border shadow-bento lg:col-span-2 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-bento-primary uppercase tracking-wider">৭ দিনের বিক্রয় ও লাভ চিত্র</h3>
              <p className="text-xs text-bento-muted font-sans">সাপ্তাহিক মোট বিক্রয় বনাম নীট লাভের গ্রাফ</p>
            </div>
            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-bento-primary-light rounded-xs inline-block" />
                <span className="text-bento-muted font-sans">মোট বিক্রয়</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 bg-bento-accent rounded-xs inline-block" />
                <span className="text-bento-muted font-sans font-semibold">নীট লাভ</span>
              </div>
            </div>
          </div>
          
          <div className="w-full h-64 md:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={stats.chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={(tick) => {
                    const parts = tick.split('-');
                    return parts.length >= 3 ? `${parts[2]}/${parts[1]}` : tick;
                  }}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip 
                  formatter={(value: any) => [`৳${Number(value).toLocaleString()}`]}
                  contentStyle={{ backgroundColor: '#1b4332', border: 'none', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                  labelStyle={{ fontWeight: 'bold', color: '#ffb703' }}
                />
                <Bar dataKey="sales" fill="#40916c" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="profit" fill="#ffb703" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expenses/Costs Breakdown & Fast Links */}
        <div className="space-y-6">
          {/* Quick Links Menu */}
          <div className="bg-bento-card p-5 rounded-bento border border-bento-border shadow-bento">
            <h3 className="text-sm font-bold text-bento-primary uppercase tracking-wider mb-4">দ্রুত কাজের মেনু</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => onNavigate('order_entry')}
                className="flex flex-col items-center gap-2 p-4 rounded-bento border border-dashed border-bento-primary-light/35 bg-bento-bg hover:bg-bento-primary-light/5 hover:border-bento-primary-light text-left transition-all duration-200 text-bento-primary cursor-pointer"
              >
                <PlusCircle className="w-5 h-5 text-bento-primary-light" />
                <span className="text-xs font-bold font-sans">অর্ডার এন্ট্রি</span>
              </button>

              <button
                onClick={() => onNavigate('customers')}
                className="flex flex-col items-center gap-2 p-4 rounded-bento border border-dashed border-bento-border bg-bento-bg hover:bg-bento-primary-light/5 hover:border-bento-primary-light text-left transition-all duration-200 text-bento-primary cursor-pointer"
              >
                <Users className="w-5 h-5 text-bento-muted" />
                <span className="text-xs font-bold font-sans font-semibold">গ্রাহক তালিকা</span>
              </button>

              <button
                onClick={() => onNavigate(user.role === 'admin' ? 'operators' : 'dashboard')}
                disabled={user.role !== 'admin'}
                className="flex flex-col items-center gap-2 p-4 rounded-bento border border-dashed border-bento-border bg-bento-bg hover:bg-bento-primary-light/5 hover:border-bento-primary-light disabled:opacity-45 disabled:pointer-events-none transition-all duration-200 text-bento-primary cursor-pointer relative"
              >
                {pendingOperatorsCount > 0 && (
                  <span className="absolute top-2 right-2 bg-bento-danger text-white text-[10px] h-4.5 min-w-4.5 px-1.5 rounded-full flex items-center justify-center font-bold font-mono">
                    {pendingOperatorsCount}
                  </span>
                )}
                <Users className="w-5 h-5 text-bento-primary-light" />
                <span className="text-xs font-bold font-sans font-semibold">অপারেটর অনুমোদন</span>
              </button>

              <button
                onClick={() => onNavigate(user.role === 'admin' ? 'cost_settings' : 'dashboard')}
                disabled={user.role !== 'admin'}
                className="flex flex-col items-center gap-2 p-4 rounded-bento border border-dashed border-bento-border bg-bento-bg hover:bg-bento-primary-light/5 hover:border-bento-primary-light disabled:opacity-45 disabled:pointer-events-none transition-all duration-200 text-bento-primary cursor-pointer"
              >
                <Sliders className="w-5 h-5 text-bento-accent" />
                <span className="text-xs font-bold font-sans font-semibold">খরচ সেটিংস</span>
              </button>

              <button
                onClick={() => onNavigate('staff_costs')}
                className="flex flex-col items-center justify-center gap-2 p-3.5 rounded-bento border border-dashed border-emerald-300/40 bg-emerald-50/10 hover:bg-emerald-500/5 hover:border-emerald-500 transition-all duration-200 text-bento-primary cursor-pointer col-span-2"
              >
                <Coins className="w-5 h-5 text-emerald-600" />
                <span className="text-xs font-bold font-sans font-semibold">কর্মচারী ও খরচ খাতা (Staff & Cost Center)</span>
              </button>

              <button
                onClick={() => onNavigate('farmers')}
                className="flex flex-col items-center justify-center gap-2 p-3.5 rounded-bento border border-dashed border-emerald-500/30 bg-emerald-50/5 hover:bg-emerald-500/10 hover:border-emerald-500 transition-all duration-200 text-bento-primary cursor-pointer col-span-2"
              >
                <Leaf className="w-5 h-5 text-emerald-600 animate-pulse" />
                <span className="text-xs font-bold font-sans font-semibold">কৃষক তালিকা ও পণ্য খাতা (Farmers & Produce Ledger)</span>
              </button>
            </div>
          </div>

          {/* Cumulative Costs Statement */}
          <div className="bg-bento-card p-5 rounded-bento border border-bento-border shadow-bento">
            <h3 className="text-sm font-bold text-bento-primary uppercase tracking-wider mb-1">ব্যয় ও খরচের বিশ্লেষণ</h3>
            <p className="text-xs text-bento-muted mb-4 font-sans font-semibold">ব্যবসায়িক মোট পুঞ্জীভূত উৎপাদন ও লজিস্টিকস খরচ</p>
            
            <div className="space-y-4 font-mono">
              {/* Product Cost */}
              <div>
                <div className="flex justify-between text-xs text-bento-text mb-1">
                  <span className="font-sans font-semibold">কৃষক মূল্য পেমেন্ট (Farmer Payments)</span>
                  <span className="font-bold">৳{stats.costBreakdown.product.toLocaleString()}</span>
                </div>
                <div className="w-full bg-bento-bg rounded-full h-2">
                  <div 
                    className="bg-bento-primary-light h-2 rounded-full" 
                    style={{ 
                      width: `${
                        stats.costBreakdown.product + stats.costBreakdown.delivery + stats.costBreakdown.other === 0
                          ? 0 
                          : (stats.costBreakdown.product / (stats.costBreakdown.product + stats.costBreakdown.delivery + stats.costBreakdown.other)) * 100
                      }%` 
                    }}
                  />
                </div>
              </div>

              {/* Delivery Cost */}
              <div>
                <div className="flex justify-between text-xs text-bento-text mb-1">
                  <span className="font-sans font-semibold">ডেলিভারি ও লজিস্টিকস খরচ (Logistics)</span>
                  <span className="font-bold">৳{stats.costBreakdown.delivery.toLocaleString()}</span>
                </div>
                <div className="w-full bg-bento-bg rounded-full h-2">
                  <div 
                    className="bg-bento-accent h-2 rounded-full" 
                    style={{ 
                      width: `${
                        stats.costBreakdown.product + stats.costBreakdown.delivery + stats.costBreakdown.other === 0
                          ? 0 
                          : (stats.costBreakdown.delivery / (stats.costBreakdown.product + stats.costBreakdown.delivery + stats.costBreakdown.other)) * 100
                      }%` 
                    }}
                  />
                </div>
              </div>

              {/* Other Cost */}
              <div>
                <div className="flex justify-between text-xs text-bento-text mb-1">
                  <span className="font-sans font-semibold">অন্যান্য পরিবহন ও ওভারহেড (Overheads)</span>
                  <span className="font-bold">৳{stats.costBreakdown.other.toLocaleString()}</span>
                </div>
                <div className="w-full bg-bento-bg rounded-full h-2">
                  <div 
                    className="bg-bento-primary h-2 rounded-full" 
                    style={{ 
                      width: `${
                        stats.costBreakdown.product + stats.costBreakdown.delivery + stats.costBreakdown.other === 0
                          ? 0 
                          : (stats.costBreakdown.other / (stats.costBreakdown.product + stats.costBreakdown.delivery + stats.costBreakdown.other)) * 100
                      }%` 
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {user.role === 'admin' && (
        <div className="bg-bento-card p-5 rounded-bento border border-bento-border shadow-bento font-sans mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 border-b border-bento-border pb-3">
            <div>
              <h3 className="text-sm font-bold text-bento-primary uppercase tracking-wider">অপারেটর তালিকা ও নিয়ন্ত্রণ প্যানেল (Operators Hub)</h3>
              <p className="text-xs text-bento-muted mt-0.5 font-sans font-semibold">অপারেটরদের নিবন্ধন অনুমোদন স্থিতি ও বিস্তারিত তথ্য অ্যাক্সেস করুন</p>
            </div>
            <button
              onClick={() => onNavigate('operators')}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-bento-primary hover:bg-bento-primary-light rounded-lg shadow-sm transition-all cursor-pointer"
            >
              বিস্তারিত যান <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {operatorsList.length === 0 ? (
              <p className="text-xs text-slate-400 p-4 text-center col-span-full">কোনো অপারেটর রেকর্ড পাওয়া যায়নি।</p>
            ) : (
              operatorsList.map((op) => (
                <div 
                  key={op.id} 
                  className={`p-4 rounded-bento border transition-all ${
                    !op.approved 
                      ? 'border-amber-200 bg-amber-50/50 hover:bg-amber-100/50' 
                      : 'border-bento-border bg-bento-bg hover:bg-bento-border/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800">{op.name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                      op.approved 
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                        : 'bg-amber-100 text-amber-800 border border-amber-200 animate-pulse'
                    }`}>
                      {op.approved ? 'Approved (অনুমোদিত)' : 'Pending (অপেক্ষমান)'}
                    </span>
                  </div>
                  <div className="space-y-1 text-slate-500 text-[11px] font-mono">
                    <p>📞 মোবাইল: {op.phone}</p>
                    {op.address && <p>🏠 ঠিকানা: {op.address}</p>}
                    <p>⏰ নিবন্ধিত: {op.created_at ? new Date(op.created_at).toLocaleDateString('bn-BD') : 'N/A'}</p>
                  </div>
                  
                  {!op.approved && (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={async () => {
                          try {
                            await dbService.approveOperator(op.id);
                            showNotification("অনুমোদিত!", `অপারেটর ${op.name} এর প্রোফাইল সফলভাবে অনুমোদন করা হয়েছে।`, "success");
                          } catch (err: any) {
                            showError("অনুমোদন করতে ত্রুটি", err);
                          }
                        }}
                        className="flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-sm cursor-pointer text-center transition-all"
                      >
                        অনুমোদন করুন
                      </button>
                      <a
                        href={`https://wa.me/8801931355398?text=${encodeURIComponent(
                          `আসসালামু আলাইকুম, আমি অপারেটর ${op.name} (মোবাইল: ${op.phone}) এর প্রোফাইল অনুমোদন করেছি।`
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                        className="py-1.5 px-2.5 rounded-lg text-xs border border-emerald-200 text-emerald-700 bg-white hover:bg-emerald-50 cursor-pointer text-center flex items-center justify-center font-bold font-sans transition-all"
                      >
                        WhatsApp
                      </a>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
