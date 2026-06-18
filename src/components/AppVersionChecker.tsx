import { useEffect, useState, useCallback, useRef } from 'react';
import { RefreshCw, ArrowUpCircle, Sparkles, CheckCircle2, ShieldAlert } from 'lucide-react';

interface VersionConfig {
  version: string;
  buildTime: string;
}

export default function AppVersionChecker() {
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [buildTime, setBuildTime] = useState<string | null>(null);
  const [isNewUpdate, setIsNewUpdate] = useState(false);
  const [autoReloadCountdown, setAutoReloadCountdown] = useState<number | null>(null);
  const [lastCheckTime, setLastCheckTime] = useState<string>('');
  const pollIntervalRef = useRef<any>(null);
  const countdownIntervalRef = useRef<any>(null);

  // Fetch version info helper with cache-busting
  const fetchVersion = useCallback(async (): Promise<VersionConfig | null> => {
    try {
      const response = await fetch(`/version.json?cb=${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.debug("Failed to fetch app version.json:", error);
    }
    return null;
  }, []);

  // Initialize version tracking
  useEffect(() => {
    // Immediate initial check
    fetchVersion().then((data) => {
      if (data && data.version) {
        setCurrentVersion(data.version);
        setLatestVersion(data.version);
        setBuildTime(data.buildTime);
        setLastCheckTime(new Date().toLocaleTimeString());
      }
    });

    // Setup periodic polling every 20 seconds, to ensure instant-reaction PWA updates
    pollIntervalRef.current = setInterval(async () => {
      const data = await fetchVersion();
      setLastCheckTime(new Date().toLocaleTimeString());
      
      if (data && data.version) {
        setLatestVersion(data.version);
        setBuildTime(data.buildTime);
      }
    }, 20000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [fetchVersion]);

  // Handle version comparison & changes
  useEffect(() => {
    if (currentVersion && latestVersion && currentVersion !== latestVersion) {
      setIsNewUpdate(true);
      
      // Attempt to programmatically trigger Service Worker updates so newer assets cache immediately
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.update();
            console.log("SW: Force triggered update check upon new version discovery.");
          }
        });
      }

      // Initialize an safe auto-reload timer (e.g. 5 minutes) to ensure stale screens eventually refresh
      if (autoReloadCountdown === null) {
        setAutoReloadCountdown(300); // 5 minutes (300 seconds)
      }
    }
  }, [currentVersion, latestVersion]);

  // Handle countdown interval if active
  useEffect(() => {
    if (isNewUpdate && autoReloadCountdown !== null) {
      if (autoReloadCountdown <= 0) {
        // Countdown completed, reload safely
        handleForceReload();
        return;
      }

      countdownIntervalRef.current = setTimeout(() => {
        setAutoReloadCountdown((prev) => (prev !== null ? prev - 1 : null));
      }, 1000);

      return () => {
        if (countdownIntervalRef.current) clearTimeout(countdownIntervalRef.current);
      };
    }
  }, [isNewUpdate, autoReloadCountdown]);

  // Perform a clean, hard reload of the application
  const handleForceReload = () => {
    // Clear all cache stores safely to bypass stale storage before reload
    if ('caches' in window) {
      caches.keys().then((names) => {
        for (const name of names) {
          caches.delete(name);
        }
      }).catch(() => {});
    }
    
    // Unregister legacy Service Workers
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      }).catch(() => {});
    }

    // Force refresh with cash bust
    setTimeout(() => {
      window.location.reload();
    }, 200);
  };

  if (!isNewUpdate) {
    // Development helper indicator (rendered unobtrusively inside admin profiles)
    return null;
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:max-w-md z-50 animate-bounce">
      <div className="bg-slate-900 border-2 border-amber-500 rounded-2xl p-4 shadow-2xl text-white font-sans overflow-hidden relative">
        
        {/* Amber glowing background accent */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/20 rounded-full blur-2xl pointer-events-none -mr-10 -mt-10 animate-pulse" />
        
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-550 flex items-center justify-center shrink-0">
            <RefreshCw className="w-5 h-5 text-amber-500 animate-spin" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
              <p className="font-extrabold text-sm text-slate-100">নতুন আপডেট এসেছে! (Update Live)</p>
            </div>
            
            <p className="text-slate-300 text-xs mt-1 leading-snug">
              আপনার গিটহাব (GitHub) কোড পরিবর্তনটি সফলভাবে অ্যাপ্লিকেশনে লাইভ হয়েছে। পরিবর্তনগুলো সক্রিয় করতে রিফ্রেশ করুন।
            </p>

            {/* Timestamps */}
            {buildTime && (
              <p className="text-[9px] text-slate-400 font-mono mt-1">
                বিল্ড সময় (Build Time): {new Date(buildTime).toLocaleString('bn-BD', { hour12: true })}
              </p>
            )}

            <div className="mt-3.5 flex items-center justify-between gap-3">
              <span className="text-[10px] text-amber-400 font-mono font-semibold">
                {autoReloadCountdown !== null ? `স্বয়ংক্রিয় রিলোড: ${Math.floor(autoReloadCountdown / 60)}মি. ${autoReloadCountdown % 60}সে.` : 'আপডেট পেন্ডিং'}
              </span>
              
              <button
                onClick={handleForceReload}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-extrabold rounded-xl text-xs transition-all shadow-md shadow-amber-950/20 active:scale-95 cursor-pointer flex items-center gap-1 shrink-0"
              >
                <ArrowUpCircle className="w-3.5 h-3.5" /> এখনই রিলোড করুন
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
