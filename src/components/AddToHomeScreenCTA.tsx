import { useState, useEffect } from 'react';
import { safeStorage } from '../utils/storage';
import { 
  Smartphone, 
  ArrowDownToLine, 
  X, 
  Sparkles, 
  CheckCircle, 
  Share, 
  PlusSquare, 
  Info,
  PhoneCall
} from 'lucide-react';

// Extend window interface for TS deep binding of the installer event
declare global {
  interface Window {
    deferredAppletInstallPrompt?: any;
  }
}

export default function AddToHomeScreenCTA() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [deviceOS, setDeviceOS] = useState<'ios' | 'android' | 'other'>('other');
  const [activeStepTab, setActiveStepTab] = useState<'safari' | 'chrome'>('chrome');

  useEffect(() => {
    // 1. Check if already running in standalone/installed mode
    const checkPwaMode = () => {
      const isPwa = window.matchMedia('(display-mode: standalone)').matches || 
                    (window.navigator as any).standalone === true;
      setIsStandalone(isPwa);
    };
    checkPwaMode();

    // 2. Check dismissal status from safe storage
    const dismissalTime = safeStorage.getItem('pwa_cta_dismissed_time');
    if (dismissalTime) {
      const diffMs = Date.now() - Number(dismissalTime);
      const days = diffMs / (1000 * 60 * 60 * 24);
      if (days < 3) {
        setIsDismissed(true); // Suppress banner if dismissed within the last 3 days
      }
    }

    // 3. Detect Device OS
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setDeviceOS('ios');
      setActiveStepTab('safari');
    } else if (/android/.test(ua)) {
      setDeviceOS('android');
      setActiveStepTab('chrome');
    } else {
      setDeviceOS('other');
    }

    // 4. Capture browser install events
    const handleBeforePrompt = (e: Event) => {
      e.preventDefault();
      // Store event on state and on the global window to share with alternative views
      setDeferredPrompt(e);
      window.deferredAppletInstallPrompt = e;
      console.log("PWA Modular CTA: Captured 'beforeinstallprompt' event.");
    };

    // Check if the event was already stored on window by other files
    if (window.deferredAppletInstallPrompt) {
      setDeferredPrompt(window.deferredAppletInstallPrompt);
    }

    window.addEventListener('beforeinstallprompt', handleBeforePrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforePrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    const promptToUse = deferredPrompt || window.deferredAppletInstallPrompt;
    if (!promptToUse) return;
    
    promptToUse.prompt();
    const { outcome } = await promptToUse.userChoice;
    console.log(`PWA Modular CTA: User selection outcome: ${outcome}`);
    
    if (outcome === 'accepted') {
      setIsStandalone(true);
    }
    
    // Clear prompt state
    setDeferredPrompt(null);
    window.deferredAppletInstallPrompt = null;
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    safeStorage.setItem('pwa_cta_dismissed_time', String(Date.now()));
  };

  // If already installed or dismissed, do not display the banner.
  if (isStandalone || isDismissed) {
    return null;
  }

  return (
    <div className="w-full bg-white border-2 border-emerald-500/20 rounded-2xl shadow-bento overflow-hidden mb-6 animate-fade-in relative">
      {/* Upper accent bar */}
      <div className="h-2 w-full bg-gradient-to-r from-emerald-600 via-teal-500 to-green-500" />
      
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="absolute top-4 right-4 p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600 cursor-pointer"
        title="Dismiss suggestion for now"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-5 justify-between">
          <div className="flex-1 min-w-0 max-w-2xl">
            <div className="flex items-center gap-2 mb-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100">
                <Sparkles className="w-4.5 h-4.5 text-emerald-600 animate-pulse" />
              </span>
              <span className="text-xs uppercase tracking-wider font-bold text-emerald-700 font-mono">Mobile Integration Portal</span>
            </div>
            
            <h2 className="text-base sm:text-lg font-extrabold text-slate-800 tracking-tight leading-snug">
              কৃষক বাজার পোর্টালটি আপনার ফোনে অ্যাপ হিসেবে ব্যবহার করুন!
              <span className="block text-xs sm:text-sm font-semibold text-slate-500 mt-1">
                Install Krishok Bazar as a native-like app on any Android or Apple device
              </span>
            </h2>
            
            <p className="text-xs text-slate-600 leading-relaxed mt-2.5">
              ব্রাউজার বার ছাড়াও Krishok Bazar পোর্টালটি সম্পূর্ণ সিকিউরড মোডে সরাসরি এবং রিয়েল-টাইমে চলবে। কোনো ধরনের ফাইল ডাউনলোড ছাড়াই আপনার মোবাইলের হোম স্ক্রিনে যুক্ত করে নিন।
            </p>
          </div>

          <div className="w-full lg:w-auto flex flex-col sm:flex-row gap-3 self-stretch lg:self-auto shrink-0 justify-end">
            {(deferredPrompt || window.deferredAppletInstallPrompt) ? (
              <button
                onClick={handleInstallClick}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs tracking-wider uppercase rounded-bento shadow-md hover:shadow-lg active:scale-98 transition-all duration-200 cursor-pointer"
              >
                <ArrowDownToLine className="w-4.5 h-4.5" />
                ফোনে সরাসরি ইনস্টল করুন (Direct Install)
              </button>
            ) : (
              <div className="flex-1 sm:flex-none">
                {/* Platform chooser triggers help panel below */}
                <div className="flex rounded-bento border border-slate-200 p-0.5 bg-slate-50/70">
                  <button
                    onClick={() => setActiveStepTab('safari')}
                    className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeStepTab === 'safari' 
                        ? 'bg-white text-slate-800 shadow-xs border border-slate-100' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    🍎 Apple/Safari
                  </button>
                  <button
                    onClick={() => setActiveStepTab('chrome')}
                    className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeStepTab === 'chrome' 
                        ? 'bg-white text-emerald-800 shadow-xs border border-slate-100' 
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    🤖 Android/Chrome
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Instructional Guides */}
        {!(deferredPrompt || window.deferredAppletInstallPrompt) && (
          <div className="mt-5 bg-slate-50 border border-slate-200/60 rounded-xl p-4 sm:p-5 text-xs text-slate-705 leading-relaxed">
            {activeStepTab === 'safari' ? (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-center gap-2 font-bold text-slate-800 border-b border-slate-200 pb-2">
                  <Smartphone className="w-4 h-4 text-emerald-600" />
                  <span>আইফোন বা আইপ্যাড (iOS Safari) এর জন্য নিয়ম:</span>
                </div>
                
                <ol className="list-decimal list-inside space-y-2.5 text-slate-600 pl-1">
                  <li>
                    নিচের ব্রাউজার বারে থাকা <span className="inline-flex items-center gap-1 font-bold text-slate-850 px-1.5 py-0.5 bg-white border border-slate-200 rounded-md shadow-2xs"><Share className="w-3 h-3 text-emerald-600" /> শেয়ার বোতাম (Share Button)</span> ট্যাপ করুন।
                  </li>
                  <li>
                    মেনুটি একটু স্ক্রোল করে নিচের দিকে যান এবং <span className="inline-flex items-center gap-1 font-bold text-slate-850 px-1.5 py-0.5 bg-white border border-slate-200 rounded-md shadow-2xs"><PlusSquare className="w-3 h-3 text-emerald-600" /> Add to Home Screen</span> অপশনটি বেছে নিন।
                  </li>
                  <li>
                    সবশেষে ডান পাশের কোণে থাকা <span className="font-bold text-emerald-700 font-mono">Add</span> ট্যাপ করুন।
                  </li>
                </ol>

                <div className="pt-2 text-[11px] text-slate-500 italic flex items-center gap-1 bg-white p-2 rounded-lg border border-slate-100">
                  <Info className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>সাফারি ছাড়া অন্য ব্রাউজারে &apos;Add to Home Screen&apos; ফিচারটি আইফোনে কাজ নাও করতে পারে।</span>
                </div>
              </div>
            ) : (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-center gap-2 font-bold text-slate-800 border-b border-slate-200 pb-2">
                  <Smartphone className="w-4 h-4 text-emerald-600" />
                  <span>এন্ড্রয়েড ফোন (Chrome / Opera) এর জন্য নিয়ম:</span>
                </div>

                <ol className="list-decimal list-inside space-y-2.5 text-slate-600 pl-1">
                  <li>
                    ক্রোম ব্রাউজারের উপরে ডান কোণে থাকা <span className="font-bold text-slate-850 bg-white px-1.5 py-0.5 border border-slate-200 rounded">৩-ডট (More Options)</span> মেনুতে চাপ দিন।
                  </li>
                  <li>
                    সেখান থেকে <span className="font-bold text-slate-850 bg-white px-1.5 py-0.5 border border-slate-200 rounded">Install App</span> অথবা <span className="font-bold text-slate-850 bg-white px-1.5 py-0.5 border border-slate-200 rounded">Add to Home Screen</span> ট্যাপ করুন।
                  </li>
                  <li>
                    ইনস্টলেশন সফল হওয়ার সাথে সাথে ফোনে সরাসরি অ্যাপ লোড হয়ে যাবে।
                  </li>
                </ol>

                <div className="pt-2 text-[11px] text-slate-500 italic flex items-center gap-1 bg-white p-2 rounded-lg border border-slate-100">
                  <Info className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>কোনো সমস্যা হলে ক্রোম ব্রাউজারটি গুগল প্লে স্টোর থেকে আপডেট করে পুনরায় চেষ্টা করুন।</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
