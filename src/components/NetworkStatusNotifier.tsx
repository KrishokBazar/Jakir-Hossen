import { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';
import { useNotification } from './NotificationContext';
import { syncOfflineMutations } from '../utils/offlineSync';

export default function NetworkStatusNotifier() {
  const [isOnline, setIsOnline] = useState<boolean>(() => navigator.onLine);
  const [showSyncing, setShowSyncing] = useState<boolean>(false);
  const [syncStatusText, setSyncStatusText] = useState<string>('ডাটাবেজ সিঙ্ক হচ্ছে...');
  const { showNotification } = useNotification();

  const runSync = async () => {
    if (!navigator.onLine) return;
    setSyncStatusText('পেন্ডিং ডাটা যাচাই করা হচ্ছে...');
    setShowSyncing(true);
    
    try {
      const syncedCount = await syncOfflineMutations((message) => {
        setSyncStatusText(message);
      });
      
      if (syncedCount > 0) {
        showNotification(
          "ডাটাবেজ সিঙ্ক সম্পন্ন হয়েছে (Sync Complete)",
          `${syncedCount} টি অফলাইন এন্ট্রি সাফল্যের সাথে ক্লাউড সার্ভারে সিঙ্ক করা হয়েছে।`,
          "success",
          6000
        );
      }
    } catch (err) {
      console.error("Offline Sync Error during automated run:", err);
    } finally {
      // Add a small delay for positive UI/UX feedback
      setTimeout(() => {
        setShowSyncing(false);
      }, 1500);
    }
  };

  useEffect(() => {
    // Try to sync initially if we're online
    if (navigator.onLine) {
      runSync();
    }

    const handleOnline = () => {
      setIsOnline(true);
      showNotification(
        "ইন্টারনেট সংযুক্ত হয়েছে (Internet Connected)",
        "পোর্টালটি এখন সম্পূর্ণ সক্রিয় এবং ব্যাক-আপ ডাটা স্বয়ংক্রিয়ভাবে সিঙ্ক হচ্ছে।",
        "success",
        5000
      );
      runSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      showNotification(
         "ডিভাইস অফলাইন (Connection Offline)",
         "আপনার ইন্টারনেট সংযোগ বিচ্ছিন্ন হয়েছে। কৃষক বাজার পোর্টালটি অফলাইনে সচল আছে এবং সকল তথ্য ফোনে সুরক্ষিত থাকবে।",
         "warning",
         8000
      );
    };

    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'TRIGGER_OFFLINE_SYNC') {
        console.log("PWA Status Notifier: Service Worker requested offline sync.");
        runSync();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
    };
  }, [showNotification]);

  if (isOnline && !showSyncing) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-4 z-40 max-w-sm w-full md:w-auto animate-bounce font-sans">
      {showSyncing ? (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-emerald-700 text-white rounded-xl shadow-lg border border-emerald-500/30 text-xs font-bold leading-relaxed bg-emerald-600/95 backdrop-blur-md">
          <RefreshCw className="w-4 h-4 animate-spin shrink-0 text-amber-300" />
          <span>{syncStatusText}</span>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 p-3.5 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl shadow-xl w-full">
          <div className="flex items-center gap-2 font-extrabold text-xs">
            <WifiOff className="w-4 h-4 text-rose-600 shrink-0 animate-pulse" />
            <span>ডিভাইস অফলাইন (Offline Mode Enabled)</span>
          </div>
          <p className="text-[10px] text-rose-700 leading-normal font-medium">
            ইন্টারনেট ছাড়াই আপনি নতুন অর্ডার, কৃষক বা খরচ যুক্ত করতে পারবেন। সংযোগ পাওয়া মাত্রই সকল এন্ট্রি সুরক্ষিতভাবে ডাটাবেজে সংরক্ষিত হবে।
          </p>
        </div>
      )}
    </div>
  );
}

