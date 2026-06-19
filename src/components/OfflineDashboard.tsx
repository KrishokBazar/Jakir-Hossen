import { useState, useEffect } from 'react';
import { getCachedData, getOfflineMutations, syncOfflineMutations } from '../utils/offlineSync';
import { Order, Customer } from '../types';
import { 
  WifiOff, 
  Search, 
  Database, 
  RefreshCw, 
  Navigation, 
  CheckCircle, 
  ArrowLeftRight, 
  PlusCircle, 
  Smartphone,
  MapPin,
  Clock,
  User,
  Activity
} from 'lucide-react';
import { useNotification } from './NotificationContext';

interface OfflineDashboardProps {
  onBackToOnline?: () => void;
  onNavigateToOrder?: () => void;
}

export default function OfflineDashboard({ onBackToOnline, onNavigateToOrder }: OfflineDashboardProps) {
  const [cachedOrders, setCachedOrders] = useState<Order[]>([]);
  const [cachedCustomers, setCachedCustomers] = useState<Customer[]>([]);
  const [pendingMutationsCount, setPendingMutationsCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'orders' | 'customers'>('orders');
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const { showNotification } = useNotification();

  const loadOfflineData = async () => {
    setLoading(true);
    try {
      const orders = await getCachedData<Order[]>('orders');
      const customers = await getCachedData<Customer[]>('customers');
      const mutations = await getOfflineMutations();

      if (orders) setCachedOrders(orders);
      if (customers) setCachedCustomers(customers);
      setPendingMutationsCount(mutations.length);
    } catch (err) {
      console.error("Failed to load offline cached data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOfflineData();

    // Set up a small interval/listener to refresh pending sync counts
    const interval = setInterval(async () => {
      try {
        const mutations = await getOfflineMutations();
        setPendingMutationsCount(mutations.length);
      } catch (e) {
        // Silent catch
      }
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const triggerForceSync = async () => {
    if (!navigator.onLine) {
      showNotification(
        "ডিভাইস এখনো অফলাইন",
        "সিঙ্ক করার জন্য অনুগ্রহ করে আপনার ইন্টারনেট সংযোগটি সচল করুন।",
        "error"
      );
      return;
    }

    setIsSyncing(true);
    try {
      showNotification("ম্যানুয়াল সিঙ্ক শুরু", "পেন্ডিং ডাটা ক্লাউডে পাঠানোর চেষ্টা করা হচ্ছে...", "info");
      const code = await syncOfflineMutations();
      if (code > 0) {
        showNotification("সিঙ্ক সম্পন্ন হয়েছে", `${code} টি ডাটা সার্ভারে সফলভাবে পাঠানো হয়েছে।`, "success");
        if (onBackToOnline) onBackToOnline();
      } else {
        showNotification("সিঙ্ক করার জন্য কোনো নতুন তথ্য সংরক্ষিত নেই।", "", "info");
      }
      loadOfflineData();
    } catch (err) {
      showNotification("সিঙ্ক ব্যর্থ হয়েছে", "অনুগ্রহ করে সংযোগ পরীক্ষা করে পুনরায় ট্রাই করুন।", "error");
    } finally {
      setIsSyncing(false);
    }
  };

  // Filters
  const filteredOrders = cachedOrders.filter(order => {
    const q = searchQuery.toLowerCase();
    return (
      order.customer_name.toLowerCase().includes(q) ||
      order.customer_phone.includes(q) ||
      (order.customer_address && order.customer_address.toLowerCase().includes(q)) ||
      (order.notes && order.notes.toLowerCase().includes(q)) ||
      (order.gps_location && order.gps_location.toLowerCase().includes(q))
    );
  });

  const filteredCustomers = cachedCustomers.filter(cust => {
    const q = customerSearchQuery.toLowerCase();
    return (
      cust.name.toLowerCase().includes(q) ||
      cust.phone.includes(q) ||
      (cust.address && cust.address.toLowerCase().includes(q))
    );
  });

  return (
    <div className="bg-white rounded-2xl border border-rose-100 shadow-xl overflow-hidden font-sans">
      {/* Offline Status Header Banner */}
      <div className="bg-gradient-to-r from-rose-50 to-orange-50 border-b border-rose-100 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/20 shrink-0">
            <WifiOff className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              অফলাইন ক্যাশ ড্যাশবোর্ড (Offline Vault Dashboard)
            </h1>
            <p className="text-xs text-rose-700 font-medium leading-relaxed mt-1">
              ডিভাইসটি বর্তমানে ইন্টারনেট সংযোগহীন। আপনার ফোন বা ব্রাউজার মেমোরিতে (IndexedDB) সম্পূর্ণ সুরক্ষিতভাবে ক্যাশ করা ডাটা প্রদর্শন করা হচ্ছে।
            </p>
          </div>
        </div>

        {/* Dynamic Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={loadOfflineData}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer shadow-3xs"
          >
            <Activity className="w-3.5 h-3.5 text-slate-500" />
            <span>ক্যাশ রিলোড করুন (Reload Cache)</span>
          </button>

          {onNavigateToOrder && (
            <button
              type="button"
              onClick={onNavigateToOrder}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer shadow-sm"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>নতুন অফলাইন অর্ডার (New order)</span>
            </button>
          )}

          <button
            type="button"
            onClick={triggerForceSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>সার্ভারে সিঙ্ক করুন (Force Sync)</span>
          </button>
        </div>
      </div>

      {/* Metrics Cards row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 border-b border-slate-100 bg-slate-50/40">
        <div className="p-4 flex items-center gap-3 border-r border-slate-100">
          <div className="h-9 w-9 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center shrink-0 font-bold">
            <ArrowLeftRight className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-mono">Pending Syncs</div>
            <div className="text-lg font-bold text-orange-700 font-mono mt-0.5">
              {pendingMutationsCount} <span className="text-xs font-sans text-slate-500">এন্ট্রি পেন্ডিং</span>
            </div>
          </div>
        </div>

        <div className="p-4 flex items-center gap-3 border-r border-slate-100">
          <div className="h-9 w-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-mono">Cached Orders</div>
            <div className="text-lg font-bold text-slate-800 font-mono mt-0.5">
              {cachedOrders.length} <span className="text-xs font-sans text-slate-500">টি অর্ডার</span>
            </div>
          </div>
        </div>

        <div className="p-4 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 font-bold">
            <Smartphone className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-mono">Cached Customers</div>
            <div className="text-lg font-bold text-slate-800 font-mono mt-0.5">
              {cachedCustomers.length} <span className="text-xs font-sans text-slate-500">টি প্রোফাইল</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation tabs for vault browsing */}
      <div className="border-b border-slate-100 flex items-center justify-between px-6 bg-white shrink-0">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveSubTab('orders')}
            className={`py-4 px-2 text-xs font-bold font-sans tracking-wide border-b-2 transition-all cursor-pointer ${
              activeSubTab === 'orders' 
                ? 'border-rose-500 text-rose-600' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            অর্ডার হিস্টোরি ক্যাশ ({filteredOrders.length})
          </button>
          <button
            onClick={() => setActiveSubTab('customers')}
            className={`py-4 px-2 text-xs font-bold font-sans tracking-wide border-b-2 transition-all cursor-pointer ${
              activeSubTab === 'customers' 
                ? 'border-rose-500 text-rose-600' 
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            গ্রাহক তালিকা ক্যাশ ({filteredCustomers.length})
          </button>
        </div>

        <span className="text-[10px] uppercase font-mono font-bold text-slate-400 flex items-center gap-1">
          <Database className="w-3.5 h-3.5" /> local storage browsing
        </span>
      </div>

      {/* Inner View content */}
      <div className="p-6">
        {activeSubTab === 'orders' ? (
          <div>
            {/* Search filter input */}
            <div className="relative mb-5 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="গ্রাহকের নাম, মোবাইল, ঠিকানা বা রিমার্কস বা জিপিএস দিয়ে সার্চ করুন..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1.5 focus:ring-rose-500 transition-all font-sans text-slate-800"
              />
            </div>

            {loading ? (
              <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-rose-500" />
                <span>অফলাইন ক্যাশ লোড করা হচ্ছে...</span>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                কোনো ম্যাচিং অফলাইন অর্ডার পাওয়া যায়নি।
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredOrders.map((ord) => (
                  <div 
                    key={ord.id} 
                    className="p-4 bg-white border border-slate-200/80 rounded-xl hover:shadow-xs transition-shadow flex flex-col justify-between gap-3 "
                  >
                    <div>
                      {/* Flex header */}
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100/60 pb-2">
                        <div className="text-left">
                          <span className="block text-xs font-bold text-slate-800">{ord.customer_name}</span>
                          <span className="text-[10px] font-mono text-slate-400">{ord.customer_phone}</span>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-extrabold ${
                            ord.status === 'delivery' ? 'bg-emerald-50 text-emerald-700 border border-emerald-105' : 'bg-rose-50 text-rose-700 border border-rose-105'
                          }`}>
                            {ord.status}
                          </span>
                          <span className="text-xs font-bold text-slate-850 text-slate-900 font-mono">
                            {ord.amount < 0 ? `-৳${Math.abs(ord.amount).toLocaleString()}` : `৳${ord.amount.toLocaleString()}`}
                          </span>
                        </div>
                      </div>

                      {/* Info lines */}
                      <div className="space-y-1.5 mt-2.5 text-[11px] text-slate-600">
                        {ord.customer_address && (
                          <div className="flex items-start gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <span>{ord.customer_address}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          <Clock className="w-3.5 h-3.5 shrink-0" />
                          <span>তারিখ: {new Date(ord.order_date).toLocaleString('bn-BD')}</span>
                        </div>

                        {ord.notes && (
                          <div className="text-[10px] bg-slate-50 p-2 rounded-lg border border-slate-100 italic font-medium text-slate-500 max-h-16 overflow-y-auto">
                            "{ord.notes}"
                          </div>
                        )}

                        {ord.gps_location && (
                          <div className="flex items-center gap-1.5 text-[10px] text-emerald-700 bg-emerald-50/80 px-2 py-1 rounded-lg border border-emerald-100/60 font-mono font-medium">
                            <Navigation className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span className="truncate" title={ord.gps_location}>GPS: {ord.gps_location}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-slate-150/50 pt-2 flex items-center justify-between text-[10px] text-slate-400">
                      <span>অর্ডার লাভ: <strong className={ord.profit >= 0 ? "text-emerald-600 font-mono font-bold" : "text-rose-600 font-mono font-bold"}>৳{ord.profit.toLocaleString()}</strong></span>
                      {ord.operator_name && (
                        <span>প্রবেশকারী: <strong className="text-slate-600">{ord.operator_name}</strong></span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            {/* Customer Search input */}
            <div className="relative mb-5 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={customerSearchQuery}
                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                placeholder="গ্রাহকের নাম, মোবাইল বা ঠিকানা দিয়ে সার্চ করুন..."
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-1.5 focus:ring-rose-500 transition-all font-sans text-slate-800"
              />
            </div>

            {loading ? (
              <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-rose-500" />
                <span>গ্রাহক তালিকা লোড করা হচ্ছে...</span>
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                কোনো ম্যাচিং অফলাইন গ্রাহক পাওয়া যায়নি।
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {filteredCustomers.map((cust) => (
                  <div key={cust.id} className="p-4 bg-white border border-slate-200/70 rounded-xl flex flex-col justify-between gap-2.5">
                    <div className="flex items-start gap-2.5">
                      <div className="h-8.5 w-8.5 rounded-full bg-slate-100 text-slate-705 text-slate-800 font-bold flex items-center justify-center border border-slate-200 shrink-0 text-xs select-none">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="text-left leading-normal">
                        <h4 className="text-xs font-bold text-slate-800">{cust.name}</h4>
                        <span className="text-[10px] font-mono text-slate-400 block">{cust.phone}</span>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-500 space-y-1">
                      {cust.address && (
                        <p className="flex items-start gap-1 font-sans">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span>{cust.address}</span>
                        </p>
                      )}
                      
                      <div className="flex items-center justify-between text-[10px] bg-slate-50 p-1.5 rounded-lg border border-slate-100 font-mono">
                        <span>অর্ডার সংখ্যা: <strong>{cust.total_orders || 0}</strong></span>
                        <span>মোট খরচ: <strong className="text-emerald-700">৳{(cust.total_spent || 0).toLocaleString()}</strong></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
