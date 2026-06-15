import { useEffect, useState } from 'react';
import { dbService } from '../db';
import { Customer } from '../types';
import { useNotification } from './NotificationContext';
import { Users, Clock, AlertTriangle, MessageSquare, Phone, MapPin, Calendar, RefreshCw } from 'lucide-react';

export default function Reminders() {
  const { showError } = useNotification();
  const [inactiveCustomers, setInactiveCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [inactivityDays, setInactivityDays] = useState(15); // default 15 days as requested

  const fetchInactive = async () => {
    setLoading(true);
    try {
      const list = await dbService.getInactiveCustomers(inactivityDays);
      setInactiveCustomers(list);
    } catch (err: any) {
      console.error("Error loaded inactive records:", err);
      showError("Error loading inactive records", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInactive();
  }, [inactivityDays]);

  // Construct a personalized Bengali greeting message
  const launchWhatsAppReminder = (customer: Customer) => {
    const formattedPhone = customer.phone.trim();
    
    // Format last purchase date
    const dStr = customer.last_order_date 
      ? new Date(customer.last_order_date).toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' })
      : "কিছুদিন আগে";

    const customText = `আসসালামু আলাইকুম প্রিয় ${customer.name}, 🌾\n\nকৃষক বাজার (Krishok Bazar) থেকে আপনার শেষ অর্ডার ছিল প্রায় ${inactivityDays} দিনেরও বেশি আগে (${dStr} তারিখে)।\n\nআশাকরি আমাদের তাজা শাকসবজি ও খামারি পণ্যগুলো আপনার পছন্দ হয়েছিল। আমাদের সংগ্রহশালায় এখন নতুন এবং তরতাজা শীতকালীন/গ্রীষ্মকালীন পণ্য এসেছে।\n\nপুনরায় অর্ডার করতে চাইলে আজই আমাদের সাথে যোগাযোগ করুন অথবা অপারেটরের সাথে কথা বলুন।\n\nধন্যবাদ ও শুভেচ্ছান্তে,\nকৃষক বাজার টিম।`;
    
    const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(customText)}`;
    window.open(waUrl, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-6 h-6 text-emerald-600" />
            গ্রাহক অলসতা রিমাইন্ডার (Customer Inactivity Analyzer)
          </h2>
          <p className="text-xs text-slate-500 font-sans">Locate, audit, and prompt dormant customers whose last recorded transaction exceeds 15 days.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-semibold">
            <span className="text-slate-500 font-sans">Threshold:</span>
            <select
              value={inactivityDays}
              onChange={(e) => setInactivityDays(Number(e.target.value))}
              className="bg-transparent focus:outline-hidden text-slate-800 font-bold border-none py-0 pr-6 pl-1"
            >
              <option value={7}>7 Days</option>
              <option value={15}>15 Days</option>
              <option value={30}>30 Days</option>
              <option value={60}>60 Days</option>
            </select>
          </div>

          <button
            onClick={fetchInactive}
            className="p-2.5 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-emerald-600 border-t-transparent" />
        </div>
      ) : inactiveCustomers.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-12 text-center">
          <Users className="w-12 h-12 text-slate-350 mx-auto mb-3" />
          <h3 className="text-slate-900 font-bold">All customers are highly active! 🎉</h3>
          <p className="text-slate-500 text-xs max-w-sm mx-auto mt-1">
            Excellent! No customer profile has exceeded the default {inactivityDays}-day inactivity benchmark threshold.
          </p>
        </div>
      ) : (
        /* Inactive customers layout list */
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-250 p-4 rounded-xl text-xs text-amber-900 flex gap-2.5 leading-relaxed font-sans">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Detected {inactiveCustomers.length} Dormant Customers:</span> These profiles have had zero transactions in the last {inactivityDays} days. Click <b>"Send reminder"</b> to automatically prompt them on WhatsApp with a prefilled greeting message.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {inactiveCustomers.map((cust) => {
              // Calculate elapsed days
              const diffMs = Math.abs(new Date().getTime() - new Date(cust.last_order_date!).getTime());
              const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

              return (
                <div
                  key={cust.id}
                  className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all duration-150 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <h4 className="font-bold text-slate-930 line-clamp-1">{cust.name}</h4>
                      <span className="bg-rose-50 text-rose-700 text-[10px] font-bold font-mono px-2 py-0.5 rounded-sm shrink-0">
                        {diffDays} Days Inactive
                      </span>
                    </div>

                    <div className="space-y-1 text-xs text-slate-600 font-sans">
                      <div className="flex items-center gap-1.5 font-mono">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        {cust.phone}
                      </div>
                      {cust.address && (
                        <div className="flex items-center gap-1.5 line-clamp-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {cust.address}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Last purchase: {new Date(cust.last_order_date!).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => launchWhatsAppReminder(cust)}
                    className="w-full mt-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-2 cursor-pointer shadow-xs shadow-emerald-600/5 transition-all duration-150"
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> Send Reminder on WhatsApp
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
