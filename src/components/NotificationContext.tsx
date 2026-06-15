import { createContext, useContext, useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Info, 
  ChevronDown, 
  ChevronUp, 
  Terminal,
  ShieldAlert
} from 'lucide-react';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  duration?: number;
  technicalDetails?: any; // Parsed Firestore error info
}

interface NotificationContextType {
  showNotification: (title: string, message: string, type: NotificationType, duration?: number) => void;
  showError: (title: string, error: any, customMessage?: string) => void;
  dismissNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [expandedDetailsId, setExpandedDetailsId] = useState<string | null>(null);

  const showNotification = (title: string, message: string, type: NotificationType, duration = 6000) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newNotification: Notification = { id, title, message, type, duration };
    
    setNotifications((prev) => [...prev, newNotification]);

    if (duration > 0) {
      setTimeout(() => {
        dismissNotification(id);
      }, duration);
    }
  };

  const showError = (title: string, error: any, customMessage?: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    let message = customMessage || error?.message || String(error);
    let parsedDetails: any = null;

    // Check if error message is a FirestoreErrorInfo JSON string
    if (error?.message) {
      try {
        const parsed = JSON.parse(error.message);
        if (parsed && typeof parsed === 'object' && ('operationType' in parsed || 'error' in parsed)) {
          parsedDetails = parsed;
          // Set a friendly description
          if (parsed.error && parsed.error.includes('insufficient permissions')) {
            message = "অনুমতি অস্বীকৃত (Permission Denied): আপনার এই অ্যাকশনটি সম্পন্ন করার নির্দিষ্ট অধিকার বা এডমিন অনুমতি নেই।";
          } else {
            message = parsed.error || "ডাটাবেজ অপারেশনে সমস্যা হয়েছে।";
          }
        }
      } catch (e) {
        // Not JSON, continue with original message
      }
    } else if (typeof error === 'string') {
      try {
        const parsed = JSON.parse(error);
        if (parsed && typeof parsed === 'object' && ('operationType' in parsed || 'error' in parsed)) {
          parsedDetails = parsed;
          if (parsed.error && parsed.error.includes('insufficient permissions')) {
            message = "অনুমতি অস্বীকৃত (Permission Denied): আপনার এই কার্যকারিতা সম্পন্ন করার নির্দিষ্ট রোল বা অনুমতি নেই।";
          } else {
            message = parsed.error || "ডাটাবেজ অপারেশনে সমস্যা হয়েছে।";
          }
        }
      } catch (e) {
        // Not JSON
      }
    }

    const newNotification: Notification = {
      id,
      title,
      message,
      type: 'error',
      duration: parsedDetails ? 12000 : 7000, // Keep firebase errors visible longer
      technicalDetails: parsedDetails
    };

    setNotifications((prev) => [...prev, newNotification]);
  };

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    setExpandedDetailsId((prev) => (prev === id ? null : prev));
  };

  const toggleDetails = (id: string) => {
    setExpandedDetailsId((prev) => (prev === id ? null : id));
  };

  return (
    <NotificationContext.Provider value={{ showNotification, showError, dismissNotification }}>
      {children}
      
      {/* Toast Notification Stack Container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 max-w-sm w-full font-sans">
        <AnimatePresence>
          {notifications.map((notif) => {
            const isExpanded = expandedDetailsId === notif.id;
            
            return (
              <motion.div
                key={notif.id}
                id={`toast-${notif.id}`}
                layout
                initial={{ opacity: 0, y: 50, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.95 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className={`bg-white border-2 rounded-xl shadow-xl overflow-hidden ${
                  notif.type === 'success' ? 'border-emerald-500' :
                  notif.type === 'error' ? 'border-rose-500' :
                  notif.type === 'warning' ? 'border-amber-500' :
                  'border-sky-500'
                }`}
              >
                <div className="p-4 flex items-start gap-3">
                  {/* Status Icon */}
                  <div className="shrink-0 mt-0.5">
                    {notif.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                    {notif.type === 'error' && <XCircle className="w-5 h-5 text-rose-500" />}
                    {notif.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-500" />}
                    {notif.type === 'info' && <Info className="w-5 h-5 text-sky-500" />}
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-extrabold text-slate-900 tracking-tight">
                      {notif.title}
                    </h4>
                    <p className="text-[11px] leading-relaxed text-slate-600 mt-1 font-medium font-bengali">
                      {notif.message}
                    </p>

                    {/* Firestore/Technical Details Link */}
                    {notif.technicalDetails && (
                      <button
                        onClick={() => toggleDetails(notif.id)}
                        className="mt-2.5 flex items-center gap-1 text-[10px] font-bold text-rose-600 hover:text-rose-700 hover:underline select-none cursor-pointer"
                      >
                        <Terminal className="w-3.5 h-3.5" />
                        <span>কারিগরি তথ্য (Technical Info)</span>
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}
                  </div>

                  {/* Dismiss Button */}
                  <button
                    onClick={() => dismissNotification(notif.id)}
                    className="shrink-0 p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Expanded Technical Details Panel */}
                <AnimatePresence>
                  {isExpanded && notif.technicalDetails && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      className="bg-slate-950 border-t border-slate-800 font-mono text-[9px] text-emerald-400 overflow-hidden"
                    >
                      <div className="p-3 space-y-2 border-t-2 border-slate-800">
                        <div className="flex items-center gap-1.5 text-rose-400 font-bold border-b border-slate-800 pb-1 mb-1.5 uppercase tracking-wide">
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
                          Security Log Analysis
                        </div>
                        <div>
                          <span className="text-slate-500 block">Firebase Operation:</span>
                          <span className="text-sky-300 font-semibold">{String(notif.technicalDetails.operationType || 'N/A').toUpperCase()}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Target Collection/Doc:</span>
                          <span className="text-amber-300 font-semibold">{notif.technicalDetails.path || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Auth User ID:</span>
                          <span className="text-slate-300">{notif.technicalDetails.authInfo?.userId || 'GUEST'}</span>
                        </div>
                        {notif.technicalDetails.authInfo?.email && (
                          <div>
                            <span className="text-slate-500 block">Auth Email:</span>
                            <span className="text-slate-300">{notif.technicalDetails.authInfo?.email}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-slate-500 block">Internal Error Msg:</span>
                          <span className="text-rose-400 whitespace-pre-wrap">{notif.technicalDetails.error || 'N/A'}</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  );
}
