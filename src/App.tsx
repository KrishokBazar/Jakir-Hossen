import { useEffect, useState } from 'react';
import { dbService, isSupabaseConfigured } from './db';
import { Profile } from './types';
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
import CofounderWorkspace from './components/CofounderWorkspace';
import OfficeWorkspace from './components/OfficeWorkspace';
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
  RefreshCw
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingOperatorsCount, setPendingOperatorsCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);

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
