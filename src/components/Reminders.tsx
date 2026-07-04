import { useState } from 'react';
import { Customer } from '../types';
import { useWhatsAppNotification } from './WhatsAppNotificationContext';
import { 
  Users, 
  Clock, 
  AlertTriangle, 
  MessageSquare, 
  Phone, 
  MapPin, 
  Calendar, 
  RefreshCw, 
  CheckCircle2, 
  X, 
  Trash2,
  Share2
} from 'lucide-react';

export default function Reminders() {
  const {
    inactiveCustomers,
    loadingInactive: loading,
    inactivityDays,
    setInactivityDays,
    refreshInactiveCustomers,
    sentReminders,
    launchWhatsAppReminder,
    clearReminderHistory,
    templates
  } = useWhatsAppNotification();

  const [selectedReminderCustomer, setSelectedReminderCustomer] = useState<Customer | null>(null);
  const [reminderText, setReminderText] = useState('');

  // Format a relative time string for Bengalis
  const getRelativeTimeString = (isoString: string) => {
    const sentTime = new Date(isoString).getTime();
    const diffMs = Date.now() - sentTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'এইমাত্র';
    if (diffMins < 60) return `${diffMins} মিনিট আগে`;
    if (diffHours < 24) return `${diffHours} ঘণ্টা আগে`;
    return `${diffDays} দিন আগে`;
  };

  const handleOpenReminderModal = (cust: Customer) => {
    const diffMs = Math.abs(new Date().getTime() - new Date(cust.last_order_date!).getTime());
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    const dStr = cust.last_order_date 
      ? new Date(cust.last_order_date).toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' })
      : "কিছুদিন আগে";

    // Use default inactivity reminder template from centralized store or fallback
    const inactivityTemplate = templates.find(t => t.id === 'inactivity_reminder') || templates[0];
    let templateText = inactivityTemplate.text;

    // Dynamically replace placeholders
    templateText = templateText
      .replace(/{name}/g, cust.name)
      .replace(/{days}/g, String(diffDays))
      .replace(/{date}/g, dStr);

    setReminderText(templateText);
    setSelectedReminderCustomer(cust);
  };

  const handleSendReminder = () => {
    if (!selectedReminderCustomer) return;
    launchWhatsAppReminder(selectedReminderCustomer, reminderText);
    setSelectedReminderCustomer(null);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-6 h-6 text-emerald-600" />
            গ্রাহক অলসতা রিমাইন্ডার (Customer Inactivity Analyzer)
          </h2>
          <p className="text-xs text-slate-500 font-sans">Locate, audit, and prompt dormant customers whose last recorded transaction exceeds the threshold.</p>
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
            onClick={refreshInactiveCustomers}
            title="রিফ্রেশ করুন (Refresh list)"
            className="p-2.5 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer bg-white transition-all duration-150"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>

          {Object.keys(sentReminders).length > 0 && (
            <button
              onClick={clearReminderHistory}
              title="রিমাইন্ডার পাঠানোর ইতিহাস মুছুন"
              className="py-2 px-3 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 bg-white font-bold rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1 shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>ইতিহাস মুছুন ({Object.keys(sentReminders).length})</span>
            </button>
          )}
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
              const wasReminded = !!sentReminders[cust.id];

              return (
                <div
                  key={cust.id}
                  className={`bg-white p-5 rounded-xl border transition-all duration-150 flex flex-col justify-between ${
                    wasReminded ? 'border-emerald-200 bg-emerald-50/10 shadow-xs shadow-emerald-500/5' : 'border-slate-200 shadow-xs hover:border-slate-300'
                  }`}
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
                        <a 
                          href={`tel:${cust.phone}`} 
                          className="text-emerald-600 hover:text-emerald-800 underline font-mono font-bold"
                          title="সরাসরি কল দিন (Call)"
                        >
                          {cust.phone}
                        </a>
                      </div>
                      {cust.address && (
                        <div className="flex items-center gap-1.5 line-clamp-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          {cust.address}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Last purchase: {new Date(cust.last_order_date!).toLocaleDateString('bn-BD')}</span>
                      </div>
                    </div>

                    {wasReminded && (
                      <div className="mt-2 text-[11px] font-bold text-emerald-700 flex items-center gap-1 bg-emerald-50/50 p-2 rounded-lg border border-emerald-100">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>রিমাইন্ডার পাঠানো হয়েছে ({getRelativeTimeString(sentReminders[cust.id])})</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleOpenReminderModal(cust)}
                    className={`w-full mt-4 py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-all duration-150 ${
                      wasReminded 
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100' 
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/5'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" /> 
                    {wasReminded ? "আবার রিমাইন্ডার পাঠান (Resend)" : "রিমাইন্ডার পাঠান (Send Reminder)"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Customizable Reminder Modal */}
      {selectedReminderCustomer && (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-emerald-100 max-w-lg w-full overflow-hidden flex flex-col relative animate-fade-in-down">
            
            {/* Modal Header */}
            <div className="bg-emerald-600 text-white p-4 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-white/10 shrink-0">
                <MessageSquare className="w-6 h-6 text-emerald-250" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-extrabold text-sm tracking-wide">রিমাইন্ডার মেসেজ কাস্টমাইজ করুন</h3>
                <p className="text-[10px] text-emerald-100 font-semibold tracking-wider uppercase mt-0.5">Customize WhatsApp Message</p>
              </div>
              <button 
                onClick={() => setSelectedReminderCustomer(null)}
                className="p-1 hover:bg-emerald-700 rounded-lg text-emerald-100/80 hover:text-white cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 leading-relaxed font-sans">
                <div className="flex justify-between font-bold mb-1">
                  <span>গ্রাহকের নাম: {selectedReminderCustomer.name}</span>
                  <span className="font-mono text-slate-600">{selectedReminderCustomer.phone}</span>
                </div>
                {selectedReminderCustomer.address && (
                  <p className="text-slate-500">ঠিকানা: {selectedReminderCustomer.address}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                  হোয়াটসঅ্যাপ মেসেজ (Editable text)
                </label>
                <textarea
                  value={reminderText}
                  onChange={(e) => setReminderText(e.target.value)}
                  rows={8}
                  className="w-full text-xs p-3 border border-slate-250 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 leading-relaxed font-sans"
                  placeholder="রিমাইন্ডার মেসেজটি এখানে লিখুন..."
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-100 flex gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedReminderCustomer(null)}
                className="flex-1 py-2.5 text-slate-600 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 bg-white font-bold rounded-lg text-xs transition-all cursor-pointer text-center active:scale-95"
              >
                বাতিল (Cancel)
              </button>
              <button
                type="button"
                onClick={handleSendReminder}
                className="flex-1 py-2.5 text-white bg-emerald-600 hover:bg-emerald-500 font-bold rounded-lg text-xs transition-all shadow-md shadow-emerald-900/10 cursor-pointer text-center active:scale-95 flex items-center justify-center gap-1"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>হোয়াটসঅ্যাপে পাঠান</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
