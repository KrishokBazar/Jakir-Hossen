import { useEffect, useState } from 'react';
import { dbService, isSupabaseConfigured } from './db';
import { Profile, RSGSMemo } from './types';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import OrderForm from './components/OrderForm';
import Customers from './components/Customers';
import Operators from './components/Operators';
import CostSettingsView from './components/CostSettings';
import Reports from './components/Reports';
import Reminders from './components/Reminders';
import StaffCosts from './components/StaffCosts';
import Farmers from './components/Farmers';
import DailyOperationsLog from './components/DailyOperationsLog';
import LiveChat from './components/LiveChat';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { LocalQRCode } from './components/LocalQRCode';
import CofounderWorkspace from './components/CofounderWorkspace';
import OfficeWorkspace from './components/OfficeWorkspace';
import RSGSMemoSystem from './components/RSGSMemoSystem';
import FloatingChat from './components/FloatingChat';
import AppVersionChecker from './components/AppVersionChecker';
import NetworkStatusNotifier from './components/NetworkStatusNotifier';
import OfflineDashboard from './components/OfflineDashboard';
import { getOfflineMutations } from './utils/offlineSync';
import { isAdmin as isUserAdmin } from './utils/auth';

import { 
  Leaf, 
  LogOut, 
  Menu, 
  X, 
  Grid, 
  PlusCircle, 
  Users, 
  UserCheck, 
  Sliders, 
  FileText, 
  Clock, 
  ShieldCheck,
  User,
  Info,
  Coins,
  ClipboardList,
  MessageSquare,
  Briefcase,
  Target,
  WifiOff,
  Cloud,
  Check,
  RefreshCw,
  Building2,
  Download,
  AlertCircle,
  Printer
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingOperatorsCount, setPendingOperatorsCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);

  // Invoice verification portal states
  const [verifyInvoiceId, setVerifyInvoiceId] = useState<string | null>(null);
  const [verifiedMemo, setVerifiedMemo] = useState<RSGSMemo | null>(null);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationAttempted, setVerificationAttempted] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfDownloadMessage, setPdfDownloadMessage] = useState<{ type: 'success' | 'error' | 'info' | null, text: string }>({ type: null, text: '' });

  // Downloads the invoice PDF to the user's device from the verification portal
  const handleDownloadVerifiedPDF = async () => {
    if (!verifiedMemo) return;
    
    const element = document.getElementById('verified-invoice-pdf-area');
    
    // Detailed console logging diagnostic block to capture exact element state
    console.log('=== PDF Capture Element Diagnostic ===');
    console.log('Target Element ID: verified-invoice-pdf-area');
    if (element) {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      console.log('Element found in DOM: YES');
      console.log('Bounding Rect (Viewport Relative):', {
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left,
        bottom: rect.bottom,
        right: rect.right
      });
      console.log('Client/Offset dimensions:', {
        clientWidth: element.clientWidth,
        clientHeight: element.clientHeight,
        offsetWidth: element.offsetWidth,
        offsetHeight: element.offsetHeight,
        scrollWidth: element.scrollWidth,
        scrollHeight: element.scrollHeight
      });
      console.log('Computed Styles:', {
        display: style.display,
        position: style.position,
        visibility: style.visibility,
        opacity: style.opacity,
        transform: style.transform,
        zIndex: style.zIndex,
        overflow: style.overflow
      });

      // Traverse ancestors to check for hidden container issues
      let parent = element.parentElement;
      while (parent) {
        const pStyle = window.getComputedStyle(parent);
        if (pStyle.display === 'none' || pStyle.visibility === 'hidden' || parseFloat(pStyle.opacity) === 0) {
          console.warn('Hidden Ancestor Found! html2canvas might fail or produce a blank image:', {
            tagName: parent.tagName,
            id: parent.id,
            className: parent.className,
            display: pStyle.display,
            visibility: pStyle.visibility,
            opacity: pStyle.opacity
          });
        }
        parent = parent.parentElement;
      }
    } else {
      console.error('Element found in DOM: NO! verified-invoice-pdf-area is missing from the document tree.');
    }
    console.log('=======================================');

    if (!element) {
      setPdfDownloadMessage({ type: 'error', text: 'রসিদ ভিউ পাওয়া যায়নি।' });
      return;
    }

    setIsGeneratingPDF(true);
    setPdfDownloadMessage({ type: 'info', text: 'অফিশিয়াল পিডিএফ রসিদ প্রস্তুত করা হচ্ছে...' });
    try {
      // Small delay to ensure any dynamic assets/images are fully rendered
      await new Promise((resolve) => setTimeout(resolve, 400));

      const canvas = await html2canvas(element, {
        scale: 2, // 2x density for extra high class crispness
        useCORS: true,
        logging: true, // Enable html2canvas internal logs for deeper debugging
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgWidth = 210; // A4 size width in mm
      const pageHeight = 297; // A4 size height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Calculate centering offset to make it look exactly like an official document centered on A4 sheet
      let yOffset = 0;
      if (imgHeight < pageHeight) {
        yOffset = (pageHeight - imgHeight) / 2;
      }

      pdf.addImage(imgData, 'PNG', 0, yOffset, imgWidth, imgHeight);
      
      const pdfBlob = pdf.output('blob');
      if (pdfBlob) {
        const url = URL.createObjectURL(pdfBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `RSGS_Invoice_${verifiedMemo.id}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        setPdfDownloadMessage({ type: 'success', text: 'পিডিএফ রসিদ সফলভাবে ডাউনলোড হয়েছে।' });
        setTimeout(() => setPdfDownloadMessage({ type: null, text: '' }), 4500);
      }
    } catch (err) {
      console.error('Error generating PDF:', err);
      setPdfDownloadMessage({ type: 'error', text: 'পিডিএফ ফাইল তৈরি করতে ব্যর্থ হয়েছে।' });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Parse URL query parameter on load for invoice verification
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyId = params.get('verify');
    if (verifyId) {
      setVerifyInvoiceId(verifyId);
      setVerificationLoading(true);
      dbService.getRSGSMemo(verifyId)
        .then((memo) => {
          setVerifiedMemo(memo);
          setVerificationLoading(false);
          setVerificationAttempted(true);
        })
        .catch((err) => {
          console.error("Verification error:", err);
          setVerificationLoading(false);
          setVerificationAttempted(true);
        });
    }
  }, []);

  // Global Intercept and Modal Hook for WhatsApp redirections (Ensures non-disruptive confirmation)
  useEffect(() => {
    const originalOpen = window.open;
    
    // Intercept programmatic window.open transitions
    window.open = (url: string | URL | undefined, target?: string, features?: string) => {
      if (url) {
        const urlStr = url.toString();
        if (urlStr.includes('wa.me') || urlStr.includes('whatsapp.com/send')) {
          setWhatsappUrl(urlStr);
          return null; // Suppress immediate browser redirection/popup blocker
        }
      }
      return originalOpen(url, target, features);
    };

    // Intercept standard <a href="https://wa.me/..."> elements layout-wide
    const handleGlobalClick = (e: MouseEvent) => {
      let element = e.target as HTMLElement | null;
      while (element) {
        if (element.tagName === 'A') {
          const href = (element as HTMLAnchorElement).href;
          if (href && (href.includes('wa.me') || href.includes('whatsapp.com/send'))) {
            e.preventDefault();
            e.stopPropagation();
            setWhatsappUrl(href);
            return;
          }
        }
        element = element.parentElement;
      }
    };

    window.addEventListener('click', handleGlobalClick, true);

    return () => {
      window.open = originalOpen;
      window.removeEventListener('click', handleGlobalClick, true);
    };
  }, []);

  // Connection monitoring
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
      // Automatically trigger Offline Dashboard view - disabled as requested by user
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Poll for offline mutations pending sync to keep the sync indicator up to date
  useEffect(() => {
    const checkPendingMutations = async () => {
      try {
        const mutations = await getOfflineMutations();
        setPendingSyncCount(mutations.length);
      } catch (err) {
        console.error("Error fetching pending offline mutations count:", err);
      }
    };

    // Perform check immediately
    checkPendingMutations();

    // Set short periodic timer
    const interval = setInterval(checkPendingMutations, 3000);
    return () => clearInterval(interval);
  }, []);

  // Load session or check user status
  useEffect(() => {
    const user = dbService.getCurrentUser();
    if (user) {
      setCurrentUser(user);
      if (user.role === 'cofounder') {
        setCurrentTab('cofounder');
      }
    }
    
    // Check pending operators if admin in the background
    if (user && isUserAdmin(user)) {
      const fetchCount = async () => {
        try {
          const ops = await dbService.getOperators();
          const count = ops.filter((op) => !op.approved && op.role === 'operator').length;
          setPendingOperatorsCount(count);
        } catch (e) {
          console.error("Failed to fetch count of pending operators", e);
        }
      };
      fetchCount();
    }
  }, []);

  // Synchronous theme loading of company / branch branding
  useEffect(() => {
    // 1. Instantly load theme from localStorage if cached
    const cachedTheme = localStorage.getItem('branch_theme') || 'green';
    const applyThemeClass = (themeName: string) => {
      // Remove other theme classes
      document.documentElement.classList.remove('theme-blue', 'theme-purple', 'theme-orange', 'theme-charcoal');
      if (themeName !== 'green') {
        document.documentElement.classList.add(`theme-${themeName}`);
      }
    };
    applyThemeClass(cachedTheme);

    // 2. Fetch latest theme from Firestore if active session exists
    const fetchLatestTheme = async () => {
      try {
        const settings = await dbService.getCostSettings();
        if (settings && settings.theme) {
          applyThemeClass(settings.theme);
          localStorage.setItem('branch_theme', settings.theme);
        }
      } catch (err) {
        console.warn("Could not fetch remote branch branding theme:", err);
      }
    };
    
    fetchLatestTheme();
    
    // Listen for custom storage events or local theme changes
    const handleThemeChange = () => {
      const updatedTheme = localStorage.getItem('branch_theme') || 'green';
      applyThemeClass(updatedTheme);
    };
    window.addEventListener('local-theme-updated', handleThemeChange);
    return () => window.removeEventListener('local-theme-updated', handleThemeChange);
  }, []);

  // Request browser Notification permission on load
  useEffect(() => {
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission()
          .then((permission) => {
            console.log('Browser system notification permission on load setup status:', permission);
          })
          .catch((err) => {
            console.warn('Permission query for system desktop notifications failed:', err);
          });
      }
    }
  }, []);

  const handleLoginSuccess = () => {
    const user = dbService.getCurrentUser();
    setCurrentUser(user);
    if (user && user.role === 'cofounder') {
      setCurrentTab('cofounder');
    } else {
      setCurrentTab('dashboard');
    }
    if (user && isUserAdmin(user)) {
      // Fetch operators list to evaluate counts
      dbService.getOperators().then((ops) => {
        const count = ops.filter((op) => !op.approved && op.role === 'operator').length;
        setPendingOperatorsCount(count);
      });
    }
  };

  const handleSignOut = () => {
    dbService.signOut();
    setCurrentUser(null);
  };

  const updatePendingCount = (count: number) => {
    setPendingOperatorsCount(count);
  };

  // Render Public Invoice Verification Portal
  if (verifyInvoiceId) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans select-none selection:bg-indigo-500/30">
        {/* Abstract futuristic glowing backgrounds */}
        <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-[250px] h-[250px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="w-full max-w-lg bg-slate-950/60 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6 relative animate-fade-in-down">
          {/* Header */}
          <div className="text-center space-y-2 pb-5 border-b border-slate-800">
            <div className="inline-flex items-center justify-center p-3 bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20 mb-1">
              <ShieldCheck className="w-8 h-8 animate-pulse" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center justify-center gap-1.5">
              <span>RSGS Verification Portal</span>
            </h1>
            <p className="text-[10px] text-slate-450 font-extrabold uppercase tracking-widest">Official Document Authentication System</p>
          </div>

          {/* Verification Process States */}
          {verificationLoading ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-4">
              <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin" />
              <p className="text-xs font-bold text-slate-400 animate-pulse">ডাটাবেজ থেকে রসিদ যাচাই করা হচ্ছে...</p>
              <p className="text-[9px] text-slate-500 font-mono">Loading records securely from firestore...</p>
            </div>
          ) : verificationAttempted && verifiedMemo ? (
            // Invoice verified successfully!
            <div className="space-y-5">
              {/* Media print custom CSS styling injection for verification portal */}
              <style>{`
                @media print {
                  /* Set absolute pristine print background */
                  body {
                    background: #ffffff !important;
                    color: #000000 !important;
                    font-size: 11pt;
                    margin: 0 !important;
                    padding: 0 !important;
                  }
                  
                  /* Hide all elements by default on paper */
                  body * {
                    visibility: hidden !important;
                  }

                  /* Force display none on non-print items like buttons, back link, etc. */
                  button,
                  .no-print,
                  header,
                  nav,
                  footer {
                    display: none !important;
                  }

                  /* Overwrite visibility for ONLY the printable verified invoice wrapper and its entire tree */
                  #verified-invoice-pdf-area, 
                  #verified-invoice-pdf-area * {
                    visibility: visible !important;
                  }

                  /* Position the invoice beautifully at the absolute top-left corner of the page */
                  #verified-invoice-pdf-area {
                    display: block !important;
                    position: absolute !important;
                    left: 0 !important;
                    top: 0 !important;
                    width: 100% !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    border: none !important;
                    box-shadow: none !important;
                    background: #ffffff !important;
                  }

                  /* Set precise paper margins and dimension size rules */
                  @page {
                    size: A4 portrait;
                    margin: 15mm 15mm 15mm 15mm;
                  }
                }
              `}</style>

              {/* Verified Badge */}
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-start gap-3">
                <span className="p-1.5 bg-emerald-500 text-slate-950 rounded-lg shrink-0 mt-0.5">
                  <Check className="w-4 h-4 font-black" />
                </span>
                <div>
                  <h4 className="text-xs font-black text-emerald-400">মেমোটি সফলভাবে যাচাই করা হয়েছে!</h4>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">এই মানি রিসিটটি RSGS Global Solution Group-এর অফিশিয়াল ডাটাবেজের সাথে হুবহু মিলেছে।</p>
                </div>
              </div>

              {/* Memo Verified Details Grid */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">মেমো নং / Invoice No</span>
                    <span className="font-mono font-bold text-indigo-400 text-sm mt-0.5 block">{verifiedMemo.id}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">ইস্যুর তারিখ / Date</span>
                    <span className="font-bold text-white text-sm mt-0.5 block">
                      {new Date(verifiedMemo.created_at).toLocaleDateString('bn-BD')}
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-3">
                  <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">গ্রাহক / ছাত্রের নাম (Client Name)</span>
                  <span className="font-black text-white text-sm mt-0.5 block">{verifiedMemo.client_name}</span>
                  {verifiedMemo.student_id && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-[9px] font-bold mt-1.5 font-mono">
                      Student ID: {verifiedMemo.student_id}
                    </span>
                  )}
                </div>

                <div className="border-t border-slate-800 pt-3">
                  <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">সেবা / কোর্সের বিবরণ (Service)</span>
                  <span className="font-bold text-slate-350 text-xs mt-0.5 block">{verifiedMemo.service_type}</span>
                </div>

                <div className="border-t border-slate-800 pt-3 grid grid-cols-3 gap-2.5 text-center">
                  <div className="bg-slate-950/40 p-2 rounded-lg border border-slate-800/60">
                    <span className="text-[8px] font-extrabold text-slate-500 uppercase block">মোট ফি (Total)</span>
                    <span className="font-mono font-extrabold text-white text-xs mt-0.5 block">৳{verifiedMemo.total_amount.toLocaleString('bn-BD')}</span>
                  </div>
                  <div className="bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/10">
                    <span className="text-[8px] font-extrabold text-emerald-500/80 uppercase block">পরিশোধিত (Paid)</span>
                    <span className="font-mono font-extrabold text-emerald-400 text-xs mt-0.5 block">৳{verifiedMemo.advanced_amount.toLocaleString('bn-BD')}</span>
                  </div>
                  <div className={`p-2 rounded-lg border ${
                    verifiedMemo.due_amount > 0 ? 'bg-rose-500/5 border-rose-500/10' : 'bg-emerald-500/5 border-emerald-500/10'
                  }`}>
                    <span className={`text-[8px] font-extrabold uppercase block ${verifiedMemo.due_amount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>বকেয়া (Due)</span>
                    <span className={`font-mono font-extrabold text-xs mt-0.5 block ${verifiedMemo.due_amount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      ৳{verifiedMemo.due_amount.toLocaleString('bn-BD')}
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-800 pt-3 flex items-center justify-between text-[10px]">
                  <span className="text-slate-500 font-semibold">অপারেটর: {verifiedMemo.created_by_name}</span>
                  <span className="inline-flex items-center gap-1 text-emerald-400 font-extrabold bg-emerald-500/10 px-2 py-0.5 rounded-full text-[9px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>Active Record</span>
                  </span>
                </div>
              </div>

              {/* PDF & Direct Print buttons */}
              <div className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={handleDownloadVerifiedPDF}
                    disabled={isGeneratingPDF}
                    className={`py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer select-none border border-slate-850 ${
                      isGeneratingPDF 
                        ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed w-full'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 active:scale-[0.98] w-full'
                    }`}
                  >
                    {isGeneratingPDF ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>পিডিএফ তৈরি হচ্ছে...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>পিডিএফ ডাউনলোড</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => window.print()}
                    disabled={isGeneratingPDF}
                    className="w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer select-none border border-slate-700 bg-slate-800 hover:bg-slate-750 text-slate-200 active:scale-[0.98] hover:text-indigo-400"
                  >
                    <Printer className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>সরাসরি প্রিন্ট করুন (Print)</span>
                  </button>
                </div>

                {/* Status Messages for PDF download */}
                {pdfDownloadMessage.type && (
                  <div className={`p-2.5 rounded-lg border text-[10px] font-bold flex items-center gap-1.5 animate-fade-in ${
                    pdfDownloadMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                    pdfDownloadMessage.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                    'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                  }`}>
                    {pdfDownloadMessage.type === 'success' && <Check className="w-3.5 h-3.5 shrink-0 text-emerald-500" />}
                    {pdfDownloadMessage.type === 'error' && <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-500" />}
                    {pdfDownloadMessage.type === 'info' && <RefreshCw className="w-3.5 h-3.5 shrink-0 text-indigo-400 animate-spin" />}
                    <span>{pdfDownloadMessage.text}</span>
                  </div>
                )}
              </div>

              {/* Institution footer card */}
              <div className="bg-slate-900/40 border border-slate-800/80 p-4 rounded-xl text-[10px] text-slate-450 leading-relaxed font-semibold">
                <p className="font-extrabold text-white mb-1 flex items-center gap-1.5 text-[11px]">
                  <Building2 className="w-4 h-4 text-indigo-400" />
                  <span>RSGS Global Solution Group</span>
                </p>
                <p>সৈয়দ প্লাজা (২য় তলা), রাজ্জাক প্লাজা সংলগ্ন, ঢাকা।</p>
                <p>হোয়াটসঅ্যাপ: ০১৭৪৮৫২৪৩৮১ | ওয়েব: www.rsgs.global</p>
              </div>
            </div>
          ) : (
            // Memo verification failed!
            <div className="space-y-5">
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex items-start gap-3">
                <span className="p-1.5 bg-rose-500 text-slate-950 rounded-lg shrink-0 mt-0.5">
                  <X className="w-4 h-4 font-black" />
                </span>
                <div>
                  <h4 className="text-xs font-black text-rose-400">রসিদটি খুঁজে পাওয়া যায়নি!</h4>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">অনুগ্রহ করে রসিদের উপরে থাকা কিউআর কোডটি আবারো সঠিকভাবে স্ক্যান করুন অথবা সঠিক মেমো নং টাইপ করুন।</p>
                </div>
              </div>

              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="space-y-1.5">
                  <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block">মেমো নং / Invoice No</span>
                  <input 
                    type="text" 
                    value={verifyInvoiceId || ''}
                    onChange={(e) => setVerifyInvoiceId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-bold text-white font-mono uppercase focus:outline-hidden focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <button
                  onClick={() => {
                    if (!verifyInvoiceId) return;
                    setVerificationLoading(true);
                    dbService.getRSGSMemo(verifyInvoiceId)
                      .then((memo) => {
                        setVerifiedMemo(memo);
                        setVerificationLoading(false);
                        setVerificationAttempted(true);
                      })
                      .catch((err) => {
                        console.error("Verification error:", err);
                        setVerificationLoading(false);
                        setVerificationAttempted(true);
                      });
                  }}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  আবারো যাচাই করুন
                </button>
              </div>
            </div>
          )}

          {/* Link back to Main Portal */}
          <div className="text-center pt-2">
            <button
              onClick={() => {
                // Clear query parameter and reload
                window.history.pushState({}, '', window.location.pathname);
                setVerifyInvoiceId(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <span>কর্মচারী লগইন পোর্টালে ফিরে যান (Main Portal)</span>
              <span>&rarr;</span>
            </button>
          </div>
        </div>

        {/* Offscreen element for generating PDF */}
        {verifiedMemo && (
          <div 
            className="fixed left-0 top-0 opacity-0 pointer-events-none -z-50 overflow-hidden" 
            style={{ width: '800px', height: 'auto' }}
          >
            <div 
              id="verified-invoice-pdf-area" 
              className="bg-white p-10 border border-slate-200 rounded-lg font-sans text-slate-800 relative overflow-hidden"
              style={{ width: '800px' }}
            >
              {/* Subtle company-branded semi-transparent watermark */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden opacity-[0.045]">
                <div className="transform -rotate-[35deg] text-center space-y-2">
                  <p className="text-6xl font-black tracking-widest uppercase text-slate-900 font-sans">
                    RSGS GLOBAL
                  </p>
                  <p className="text-xl font-extrabold tracking-wider uppercase text-indigo-900 font-sans">
                    OFFICIAL INVOICE
                  </p>
                  <p className="text-[10px] font-mono font-black tracking-widest text-slate-700">
                    SECURE SYSTEM VERIFIED • NON-TAMPERABLE
                  </p>
                </div>
              </div>

              {/* Invoice Stamp Header */}
              <div className="flex justify-between items-start border-b-2 border-slate-200 pb-6">
                {/* Company Left Panel */}
                <div className="space-y-1.5">
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-1">
                    <span>RSGS Global Solution Group</span>
                  </h2>
                  <p className="text-[10px] text-slate-500 font-extrabold tracking-widest uppercase">Digital Agency & Tech Training Institute</p>
                  <div className="text-[10px] text-slate-450 leading-relaxed font-semibold">
                    <p>সৈয়দ প্লাজা (২য় তলা), রাজ্জাক প্লাজা সংলগ্ন, ঢাকা (Syed Plaza 2nd Floor, Adjacent to Razzak Plaza, Dhaka)</p>
                    <p>হোয়াটসঅ্যাপ / মোবাইল: ০১৭৪৮৫২৪৩৮১ (WhatsApp / Cell: +8801748524381)</p>
                    <p>ইমেইল: support@rsgs.global | ওয়েব: www.rsgs.global</p>
                  </div>
                </div>

                {/* Title Right Panel */}
                <div className="text-right space-y-1">
                  <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-extrabold rounded-md uppercase tracking-wider">
                    {verifiedMemo.memo_type === 'customer' ? 'Customer Memo' : 'Student Memo'}
                  </span>
                  <h1 className="text-xl font-black text-slate-900 tracking-tight mt-1.5">মানি রিসিট / মেমো</h1>
                  <p className="text-xs font-bold text-indigo-600 font-mono">Invoice NO: {verifiedMemo.id}</p>
                  <p className="text-[10px] text-slate-450 font-bold">
                    Date: {new Date(verifiedMemo.created_at).toLocaleDateString('bn-BD')} ({new Date(verifiedMemo.created_at).toLocaleDateString('en-US')})
                  </p>
                </div>
              </div>

              {/* Client Metadata details */}
              <div className="grid grid-cols-2 gap-6 my-6 text-xs bg-slate-50 p-4.5 rounded-xl border border-slate-100">
                <div className="space-y-1.5">
                  <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">বিল প্রাপক (Invoiced To)</p>
                  <p className="text-sm font-black text-slate-900">{verifiedMemo.client_name}</p>
                  {verifiedMemo.memo_type === 'student' && verifiedMemo.student_id && (
                    <div className="mt-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-100">
                        ID / Roll: {verifiedMemo.student_id}
                      </span>
                    </div>
                  )}
                  {verifiedMemo.phone && <p className="font-mono text-slate-600 font-semibold">Phone: {verifiedMemo.phone}</p>}
                  {verifiedMemo.address && <p className="text-slate-500 font-semibold">Address: {verifiedMemo.address}</p>}
                </div>
                
                <div className="space-y-1.5 text-right">
                  <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">প্রস্তুতকারক (Issued By)</p>
                  <p className="text-sm font-black text-slate-900">RSGS Billing Portal</p>
                  <p className="text-slate-600 font-semibold">Operator: {verifiedMemo.created_by_name}</p>
                  <p className="text-slate-500 text-[10px] font-bold">সিস্টেম দ্বারা অনুমোদিত এবং সিঙ্কড।</p>
                </div>
              </div>

              {/* Services/Courses Table breakdown */}
              <div className="my-6">
                <p className="text-[10px] text-slate-450 font-extrabold uppercase tracking-widest mb-2.5">অর্ডার বিবরণ (Service / Course Specifications)</p>
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                      <th className="py-2.5 px-3">ক্রমিক (Item)</th>
                      <th className="py-2.5 px-3">সার্ভিস / কোর্সের বিবরণ</th>
                      <th className="py-2.5 px-3 text-center">স্থায়িত্ব (Duration)</th>
                      <th className="py-2.5 px-3 text-right">মূল্য (Price)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-3 px-3 font-mono font-bold">01</td>
                      <td className="py-3 px-3">
                        <p className="font-bold text-slate-900">{verifiedMemo.service_type}</p>
                        {verifiedMemo.notes && <p className="text-[10px] text-slate-450 mt-1 leading-relaxed max-w-md italic">{verifiedMemo.notes}</p>}
                      </td>
                      <td className="py-3 px-3 text-center font-bold text-slate-700">{verifiedMemo.duration}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">৳{verifiedMemo.total_amount.toLocaleString('bn-BD')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Invoice Summary calculation block */}
              <div className="border-t border-slate-200 pt-5 flex justify-end">
                <div className="w-64 space-y-2.5 text-xs">
                  <div className="flex justify-between font-semibold text-slate-600">
                    <span>মোট ফি (Total Amount):</span>
                    <span className="font-mono">৳{verifiedMemo.total_amount.toLocaleString('bn-BD')}</span>
                  </div>
                  
                  <div className="flex justify-between font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                    <span>অগ্রিম প্রদান (Advanced Paid):</span>
                    <span className="font-mono">৳{verifiedMemo.advanced_amount.toLocaleString('bn-BD')}</span>
                  </div>

                  <div className={`flex justify-between font-extrabold px-2 py-1 rounded ${
                    verifiedMemo.due_amount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    <span>বকেয়া পরিমাণ (Remaining Due):</span>
                    <span className="font-mono">৳{verifiedMemo.due_amount.toLocaleString('bn-BD')}</span>
                  </div>
                </div>
              </div>

              {/* Declaration terms / Signatures */}
              <div className="mt-12 pt-6 border-t border-slate-100 grid grid-cols-3 gap-6 text-[9px] text-slate-450 leading-relaxed">
                <div>
                  <p className="font-extrabold uppercase tracking-wider text-slate-500 mb-1">শর্তাবলী / Terms & Conditions</p>
                  <p>১. অগ্রিম প্রদানকৃত ফি কোনো অবস্থাতেই অফেরতযোগ্য।</p>
                  <p>২. বকেয়া পরিশোধ সাপেক্ষে পূর্ণ সেবা চালু থাকবে।</p>
                  <p>৩. এই রসিদটি ডিজিটাল সার্ভার দ্বারা তৈরি এবং সার্ভার থেকে সত্যতা যাচাইযোগ্য।</p>
                </div>

                {/* Verification QR Code Column */}
                <div className="flex flex-col items-center text-center justify-center border-x border-slate-100 px-2 bg-slate-50/50 rounded-lg">
                  <div className="bg-white p-1 border border-slate-200 rounded-md shadow-3xs">
                    <LocalQRCode 
                      text={`${window.location.origin}?verify=${verifiedMemo.id}`}
                      className="w-16 h-16 object-contain"
                    />
                  </div>
                  <p className="mt-1.5 text-[8px] font-black text-indigo-700 tracking-tight flex items-center gap-0.5">
                    <span>রসিদ ভেরিফিকেশন কিউআর</span>
                  </p>
                  <p className="text-[7px] text-slate-400 font-mono mt-0.5 font-bold uppercase">Scan to Verify Invoice</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="flex flex-col items-center justify-end space-y-1">
                    {verifiedMemo.signature_data ? (
                      <img 
                        src={verifiedMemo.signature_data} 
                        alt="Customer Signature" 
                        className="max-h-12 max-w-[120px] object-contain border border-slate-100 rounded p-0.5 bg-white mb-1"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="h-12 w-28 border-b border-slate-200 border-dashed" />
                    )}
                    <p className="text-[10px] font-bold text-slate-600">গ্রাহক / ছাত্রের স্বাক্ষর</p>
                  </div>

                  <div className="flex flex-col items-center justify-end space-y-1">
                    <div className="h-12 w-28 border-b border-slate-200 border-dashed flex items-end justify-center pb-1">
                      <span className="text-[8px] font-mono text-slate-300 font-bold">Authorized</span>
                    </div>
                    <p className="text-[10px] font-bold text-slate-600">কর্তৃপক্ষের স্বাক্ষর</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!currentUser) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  const isAdmin = isUserAdmin(currentUser);
  const isCofounder = currentUser.role === 'cofounder';

  // Navigation Links Definition
  const navigationItems = [
    { id: 'dashboard', name: 'ড্যাশবোর্ড (Dashboard)', icon: Grid, roleRequired: 'all' },
    { id: 'office_workspace', name: 'টার্গেট ও রুটিন (Workspace)', icon: Target, roleRequired: 'all' },
    { id: 'cofounder', name: 'কো-ফাউন্ডার ড্যাশবোর্ড (Cofounder)', icon: Briefcase, roleRequired: 'cofounder_or_admin' },
    { id: 'order_entry', name: 'অর্ডার এন্ট্রি (Add Order)', icon: PlusCircle, roleRequired: 'all' },
    { id: 'customers', name: 'গ্রাহক তালিকা (Customers)', icon: Users, roleRequired: 'all' },
    { id: 'farmers', name: 'কৃষক তালিকা (Farmers)', icon: Leaf, roleRequired: 'all' },
    { id: 'operators', name: 'অপারেটর অনুমোদন (Operators)', icon: UserCheck, roleRequired: 'admin', badge: pendingOperatorsCount },
    { id: 'cost_settings', name: 'খরচ সেটিংস (Cost Settings)', icon: Sliders, roleRequired: 'admin' },
    { id: 'staff_costs', name: 'কর্মচারী এবং খরচ (Staff & Cost)', icon: Coins, roleRequired: 'all' },
    { id: 'operations_log', name: 'দৈনিক অপারেশন লগ (Daily Log)', icon: ClipboardList, roleRequired: 'all' },
    { id: 'reports', name: 'রিপোর্ট সমূহ (Reports)', icon: FileText, roleRequired: 'all' },
    { id: 'reminders', name: 'অলস গ্রাহক রিমাইন্ডার (Reminders)', icon: Clock, roleRequired: 'all' },
    { id: 'live_chat', name: 'লাইভ চ্যাটরুম (Live Chat)', icon: MessageSquare, roleRequired: 'all' },
    { id: 'rsgs_memos', name: 'আরএসজিএস মেমো (RSGS Memos)', icon: FileText, roleRequired: 'all' },
  ];

  // Helper to filter nav items based on user role authorization
  const visibleNavs = navigationItems.filter(
    (item) => 
      item.roleRequired === 'all' || 
      (item.roleRequired === 'admin' && isAdmin) ||
      (item.roleRequired === 'cofounder_or_admin' && (isAdmin || isCofounder))
  );

  return (
    <div className="min-h-screen bg-bento-bg flex flex-col font-sans">
      
      {/* Top Brand Navbar Header */}
      <header className="bg-bento-primary text-white border-b-4 border-bento-accent py-4 px-4 md:px-8 sticky top-0 z-35 flex items-center justify-between shadow-bento">
        <div className="flex items-center gap-3">
          {/* Mobile Hamburguer */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 hover:bg-bento-primary-light/50 rounded-lg text-white md:hidden cursor-pointer transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5.5 h-5.5" /> : <Menu className="w-5.5 h-5.5" />}
          </button>

          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="text-2xl">🌿</div>
            <span className="font-extrabold tracking-tight text-white text-xl">
              KRISHOK BAZAR <span className="hidden sm:inline text-bento-accent font-light text-sm ml-2">| Staff Hub</span>
            </span>
          </div>

          {!isSupabaseConfigured() && (
            <span className="hidden lg:inline-flex items-center gap-1 bg-white/10 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full border border-white/20 select-none anim-pulse">
              <ShieldCheck className="w-3 h-3 text-bento-accent" /> Firestore Real-Time Secured
            </span>
          )}
        </div>

        {/* Visual Sync Status Indicator */}
        <div className="flex items-center gap-1.5">
          {pendingSyncCount > 0 ? (
            <div 
              className="flex items-center gap-1 px-2.5 py-1 md:py-1.5 bg-amber-500/25 border border-amber-400/40 rounded-full text-amber-200 text-[10px] md:text-xs font-bold leading-none select-none duration-100 animate-pulse"
              title={`${pendingSyncCount} টি রেকর্ড অফলাইনে সংরক্ষিত রয়েছে এবং ইন্টারনেট সংযুক্ত হলে স্বয়ংক্রিয়ভাবে ক্লাউডে সিঙ্ক হবে (${pendingSyncCount} pending updates queued locally)`}
            >
              <RefreshCw className="w-3 h-3 md:w-3.5 md:h-3.5 text-amber-300 animate-spin mr-1 shrink-0" />
              <span>
                পেন্ডিং সিঙ্ক: <span className="font-mono bg-amber-900/40 px-1 rounded text-white">{pendingSyncCount}</span>
              </span>
            </div>
          ) : (
            <div 
              className="flex items-center gap-1 px-2.5 py-1 md:py-1.5 bg-emerald-500/20 border border-emerald-400/30 rounded-full text-emerald-200 text-[10px] md:text-xs font-bold leading-none select-none duration-100"
              title="আপনার সব কাজ সুরক্ষিতভাবে সিঙ্কড করা রয়েছে (All data successfully synced on the cloud)"
            >
              <Check className="w-3 h-3 md:w-3.5 md:h-3.5 text-emerald-300 mr-1 shrink-0" />
              <span className="hidden xs:inline">সব সিঙ্কড (Synced)</span>
              <span className="xs:hidden">সংরক্ষিত</span>
            </div>
          )}
        </div>

        {/* User Account Controls */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2.5 text-right">
            <div>
              <p className="text-xs font-bold text-white">{currentUser.name}</p>
              <p className="text-[10px] uppercase tracking-wider text-bento-accent font-mono font-bold flex items-center justify-end gap-1 select-none">
                <ShieldCheck className="w-3 h-3 text-bento-accent" />
                {currentUser.role} Account
              </p>
            </div>
            <div className="h-8.5 w-8.5 rounded-full bg-white/10 text-white flex items-center justify-center border border-white/20 font-bold text-xs select-none">
              {currentUser.name.charAt(0)}
            </div>
          </div>

          <button
            onClick={handleSignOut}
            title="Log out of secure staff system"
            className="p-2 text-white/80 hover:text-bento-accent hover:bg-white/10 rounded-lg cursor-pointer transition-all border border-white/10"
          >
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col md:flex-row relative">
        
        {/* Navigation panel sidebar (Desktop standard) */}
        <nav className="hidden md:block w-64 bg-white border-r border-bento-border py-6 px-4 shrink-0 shadow-bento">
          <div className="space-y-2">
            {visibleNavs.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setCurrentTab(item.id);
                  }}
                  className={`w-full flex items-center justify-between px-4.5 py-3 rounded-bento text-xs font-bold font-sans tracking-wide cursor-pointer select-none transition-all duration-200 border-l-4 ${
                    isActive
                      ? 'bg-bento-primary text-white border-bento-accent shadow-bento'
                      : 'text-bento-muted border-transparent hover:text-bento-primary hover:bg-bento-bg'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-bento-accent' : 'text-slate-400'}`} />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && item.badge > 0 ? (
                    <span className={`h-4.5 min-w-4.5 px-1 rounded-full text-[10px] font-bold font-mono flex items-center justify-center ${
                      isActive ? 'bg-bento-accent text-bento-primary' : 'bg-bento-danger text-white'
                    }`}>
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-8 border-t border-bento-border pt-6">
            <div className="bg-bento-bg border border-bento-border p-4 rounded-bento text-[10px] leading-relaxed text-bento-muted select-none">
              <span className="font-bold underline text-bento-primary block mb-1">Rural Sector Portal</span>
              All catalog actions are linked to secure user audit trials. Make sure to log out when done with the device.
            </div>
          </div>
        </nav>

        {/* Responsive Drawer navigation list (Mobile overlay) */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 bg-slate-950/25 backdrop-blur-xs md:hidden z-40 flex">
            <div className="w-72 bg-white h-full shadow-2xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 border-b border-bento-border mb-5">
                  <span className="font-extrabold text-bento-primary">মেনু (Operations Menu)</span>
                  <button
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-1.5 hover:bg-bento-bg rounded-lg text-bento-muted cursor-pointer"
                  >
                    <X className="w-5 w-5" />
                  </button>
                </div>

                <div className="space-y-1.5">
                  {visibleNavs.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setCurrentTab(item.id);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-3 rounded-bento text-xs font-bold transition-all cursor-pointer border-l-4 ${
                          isActive
                            ? 'bg-bento-primary text-white border-bento-accent shadow-bento'
                            : 'text-bento-muted border-transparent hover:bg-bento-bg'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className={`w-4 h-4 ${isActive ? 'text-bento-accent' : 'text-slate-400'}`} />
                          <span>{item.name}</span>
                        </div>
                        {item.badge && item.badge > 0 ? (
                          <span className={`h-4.5 min-w-4.5 px-1 rounded-full text-[10px] font-bold font-mono flex items-center justify-center ${
                            isActive ? 'bg-bento-accent text-bento-primary' : 'bg-bento-danger text-white'
                          }`}>
                            {item.badge}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Mobile Account display card */}
              <div className="border-t border-bento-border pt-4 text-xs">
                <div className="flex items-center gap-3 bg-bento-bg p-3 rounded-bento border border-bento-border">
                  <div className="h-8 w-8 bg-bento-primary text-white flex items-center justify-center font-bold rounded-full select-none">
                    {currentUser.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-bento-primary">{currentUser.name}</p>
                    <p className="text-[10px] font-semibold text-bento-muted uppercase tracking-widest">{currentUser.role} account</p>
                  </div>
                </div>
                
                <button
                  onClick={handleSignOut}
                  className="w-full mt-3 py-3 bg-bento-danger/10 hover:bg-bento-danger text-bento-danger hover:text-white text-xs font-bold rounded-bento flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" /> Log Out SECURE PORTAL
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Frame Inner Content viewport */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
          {currentTab === 'dashboard' && (
            <Dashboard 
              user={currentUser} 
              onNavigate={(tab) => setCurrentTab(tab)} 
              pendingOperatorsCount={pendingOperatorsCount}
            />
          )}
          {currentTab === 'offline_dashboard' && (
            <OfflineDashboard 
              onBackToOnline={() => setCurrentTab('dashboard')} 
              onNavigateToOrder={() => setCurrentTab('order_entry')} 
            />
          )}
          {currentTab === 'order_entry' && (
            <OrderForm 
              user={currentUser} 
              onSuccessRedirect={() => setCurrentTab('dashboard')} 
            />
          )}
          {currentTab === 'customers' && (
            <Customers user={currentUser} />
          )}
          {currentTab === 'farmers' && (
            <Farmers user={currentUser} />
          )}
          {currentTab === 'operators' && isAdmin && (
            <Operators onApprovalChange={updatePendingCount} />
          )}
          {currentTab === 'cost_settings' && isAdmin && (
            <CostSettingsView user={currentUser} />
          )}
          {currentTab === 'office_workspace' && (
            <OfficeWorkspace user={currentUser} />
          )}
          {currentTab === 'cofounder' && (isAdmin || isCofounder) && (
            <CofounderWorkspace user={currentUser} />
          )}
          {currentTab === 'reports' && (
            <Reports />
          )}
          {currentTab === 'reminders' && (
            <Reminders />
          )}
          {currentTab === 'staff_costs' && (
            <StaffCosts user={currentUser} />
          )}
          {currentTab === 'operations_log' && (
            <DailyOperationsLog user={currentUser} />
          )}
          {currentTab === 'live_chat' && (
            <LiveChat />
          )}
          {currentTab === 'rsgs_memos' && (
            <RSGSMemoSystem user={currentUser} />
          )}
        </main>

        {/* WhatsApp-like floating popup chat widget */}
        <FloatingChat />
        
        {/* Real-time network connection monitoring & sync status overlay */}
        <NetworkStatusNotifier />
        
        {/* Automatic Hot-reloading & live update notifier for PWA/installed modes */}
        <AppVersionChecker />
      </div>

      {/* WhatsApp Redirect Confirmation Pop-up Modal (Ensures clean user decision for all roles) */}
      {whatsappUrl && (() => {
        const { phone, decodedMessage } = (() => {
          try {
            const phoneMatch = whatsappUrl.match(/wa\.me\/([^\/?#\s]+)/) || whatsappUrl.match(/phone=([^\s&]+)/);
            let extractedPhone = phoneMatch ? phoneMatch[1] : '';
            if (extractedPhone.includes('?')) {
              extractedPhone = extractedPhone.split('?')[0];
            }
            let textParam = '';
            if (whatsappUrl.includes('?')) {
              const urlObj = new URL(whatsappUrl);
              textParam = urlObj.searchParams.get('text') || '';
            } else if (whatsappUrl.includes('text=')) {
              const textMatch = whatsappUrl.match(/text=([^&]+)/);
              textParam = textMatch ? decodeURIComponent(textMatch[1]) : '';
            }
            return {
              phone: extractedPhone ? `${extractedPhone.startsWith('+') ? '' : '+'}${extractedPhone}` : 'হোয়াটসঅ্যাপ সংযোগ',
              decodedMessage: textParam
            };
          } catch (err) {
            return { phone: 'হোয়াটসঅ্যাপ সংযোগ', decodedMessage: '' };
          }
        })();

        return (
          <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl border border-emerald-100 max-w-md w-full overflow-hidden flex flex-col relative animate-fade-in-down">
              
              {/* Green WhatsApp Branding Top bar */}
              <div className="bg-emerald-600 text-white p-4 flex items-center gap-3">
                <div className="p-2 rounded-xl bg-white/10 shrink-0">
                  <MessageSquare className="w-6 h-6 text-emerald-200" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-extrabold text-sm tracking-wide">হোয়াটসঅ্যাপ চ্যাট নিশ্চিতকরণ</h3>
                  <p className="text-[10px] text-emerald-100 font-semibold tracking-wider uppercase mt-0.5">WhatsApp Redirect Confirmation</p>
                </div>
                <button 
                  onClick={() => setWhatsappUrl(null)}
                  className="p-1 hover:bg-emerald-700 rounded-lg text-emerald-100/80 hover:text-white cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Informative Body Content */}
              <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3 flex gap-2.5 items-start text-xs text-slate-650 leading-relaxed">
                  <span className="text-emerald-700 bg-white shadow-3xs p-1.5 rounded-lg shrink-0 mt-0.5">
                    <Check className="w-4 h-4" />
                  </span>
                  <div>
                    নিরাপদ ও নির্ভরযোগ্য যোগাযোগের জন্য আপনি কৃষক বাজার অ্যাপ্লিকেশন পরিবর্তন করে পরবর্তী ধাপে হোয়াটসঅ্যাপে স্থানান্তরিত হতে চলেছেন।
                  </div>
                </div>

                {/* Recipient Details */}
                <div className="space-y-1">
                  <span className="text-[9px] font-extrabold text-slate-450 uppercase tracking-wider block">প্রাপক ব্যক্তি (Recipient Contact)</span>
                  <div className="font-mono text-xs font-bold text-slate-800 bg-slate-50 border border-slate-100 px-3 py-2 rounded-lg flex items-center gap-1.5 shadow-3xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{phone}</span>
                  </div>
                </div>

                {/* Message preview as a real WhatsApp speech bubble */}
                {decodedMessage ? (
                  <div className="space-y-1">
                    <span className="text-[9px] font-extrabold text-slate-450 uppercase tracking-wider block">বার্তার পূর্বরূপ (Prefilled Message Preview)</span>
                    <div className="bg-[#efeae2]/80 border border-[#e1dbd2] p-3 rounded-xl relative select-none">
                      {/* Chat Bubbles Container */}
                      <div className="relative bg-[#d9fdd3] text-[#303030] border border-[#c4eab0] text-xs font-medium px-3 py-2.5 rounded-xl rounded-tr-none shadow-3xs max-w-[90%] ml-auto leading-relaxed whitespace-pre-wrap">
                        {decodedMessage}
                        {/* Status ticks indicating unsent queue state */}
                        <div className="text-[9px] text-[#8696a0] font-mono font-bold text-right mt-1.5 flex items-center justify-end gap-0.5">
                          <span>প্রস্তুত</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-2 text-center text-xs text-slate-400 font-medium">
                    (কোনো পূর্বপরিকল্পিত মেসেজ নেই, সরাসরি চ্যাট আরম্ভ হবে)
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-100 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setWhatsappUrl(null)}
                  className="flex-1 py-2.5 text-slate-600 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 bg-white font-bold rounded-lg text-xs transition-all cursor-pointer text-center active:scale-95"
                >
                  বাতিল করুন (Cancel)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    // Create a temporary un-interceptable link to bypass our own click handler
                    if (whatsappUrl) {
                      const tempLink = document.createElement('a');
                      tempLink.href = whatsappUrl;
                      tempLink.target = '_blank';
                      tempLink.rel = 'noreferrer';
                      document.body.appendChild(tempLink);
                      tempLink.click();
                      document.body.removeChild(tempLink);
                    }
                    setWhatsappUrl(null);
                  }}
                  className="flex-1 py-2.5 text-white bg-emerald-600 hover:bg-emerald-500 font-bold rounded-lg text-xs transition-all shadow-md shadow-emerald-900/10 cursor-pointer text-center active:scale-95"
                >
                  হোয়াটসঅ্যাপে যান (Proceed)
                </button>
              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
}
