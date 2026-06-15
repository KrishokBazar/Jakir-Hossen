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
  ClipboardList
} from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingOperatorsCount, setPendingOperatorsCount] = useState(0);

  // Load session or check user status
  useEffect(() => {
    const user = dbService.getCurrentUser();
    if (user) {
      setCurrentUser(user);
    }
    
    // Check pending operators if admin in the background
    if (user && user.role === 'admin') {
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

  const handleLoginSuccess = () => {
    const user = dbService.getCurrentUser();
    setCurrentUser(user);
    setCurrentTab('dashboard');
    if (user && user.role === 'admin') {
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

  const isAdmin = currentUser.role === 'admin';

  // Navigation Links Definition
  const navigationItems = [
    { id: 'dashboard', name: 'ড্যাশবোর্ড (Dashboard)', icon: Grid, roleRequired: 'all' },
    { id: 'order_entry', name: 'অর্ডার এন্ট্রি (Add Order)', icon: PlusCircle, roleRequired: 'all' },
    { id: 'customers', name: 'গ্রাহক তালিকা (Customers)', icon: Users, roleRequired: 'all' },
    { id: 'farmers', name: 'কৃষক তালিকা (Farmers)', icon: Leaf, roleRequired: 'all' },
    { id: 'operators', name: 'অপারেটর অনুমোদন (Operators)', icon: UserCheck, roleRequired: 'admin', badge: pendingOperatorsCount },
    { id: 'cost_settings', name: 'খরচ সেটিংস (Cost Settings)', icon: Sliders, roleRequired: 'admin' },
    { id: 'staff_costs', name: 'কর্মচারী এবং খরচ (Staff & Cost)', icon: Coins, roleRequired: 'all' },
    { id: 'operations_log', name: 'দৈনিক অপারেশন লগ (Daily Log)', icon: ClipboardList, roleRequired: 'all' },
    { id: 'reports', name: 'রিপোর্ট সমূহ (Reports)', icon: FileText, roleRequired: 'all' },
    { id: 'reminders', name: 'অলস গ্রাহক রিমাইন্ডার (Reminders)', icon: Clock, roleRequired: 'all' },
  ];

  // Helper to filter nav items based on user role authorization
  const visibleNavs = navigationItems.filter(
    (item) => item.roleRequired === 'all' || (item.roleRequired === 'admin' && isAdmin)
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
        </main>
      </div>
    </div>
  );
}
