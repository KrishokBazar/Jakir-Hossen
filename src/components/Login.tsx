import { useState, FormEvent, useEffect } from 'react';
import { dbService } from '../db';
import { Leaf, LogIn, UserPlus, Phone, Lock, User, MapPin, CheckCircle, Loader2, ShieldAlert, BadgeInfo, Eye, EyeOff } from 'lucide-react';
import { constructWhatsAppAdminNotificationUrl } from '../utils/whatsapp';

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [loginRole, setLoginRole] = useState<'operator' | 'admin'>('operator');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  // Login State
  const [loginId, setLoginId] = useState(() => {
    return localStorage.getItem('savedOperatorPhone') || '';
  });
  const [loginPassword, setLoginPassword] = useState(() => {
    return localStorage.getItem('savedOperatorPassword') || '';
  });

  // Register State
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regAddress, setRegAddress] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [registeredSuccess, setRegisteredSuccess] = useState(false);

  // Real-time listener for already registered operator pending approval
  const [pendingApprovalPhone, setPendingApprovalPhone] = useState<string | null>(null);
  const [pendingApprovalPassword, setPendingApprovalPassword] = useState<string>('');

  // Monitor newly registered operator approval status in real-time
  useEffect(() => {
    if (!registeredSuccess || !regPhone) return;

    const unsubscribe = dbService.subscribeProfile(regPhone, async (profile) => {
      if (profile && profile.approved) {
        setLoading(true);
        const { error: authError } = await dbService.signIn(regPhone, regPassword);
        setLoading(false);
        if (!authError) {
          onLoginSuccess();
        } else {
          setError(authError);
        }
      }
    });

    return () => unsubscribe();
  }, [registeredSuccess, regPhone, regPassword, onLoginSuccess]);

  // Monitor existing unapproved operators trying to login
  useEffect(() => {
    if (!pendingApprovalPhone) return;

    const unsubscribe = dbService.subscribeProfile(pendingApprovalPhone, async (profile) => {
      if (profile && profile.approved) {
        setLoading(true);
        const { error: authError } = await dbService.signIn(pendingApprovalPhone, pendingApprovalPassword);
        setLoading(false);
        if (!authError) {
          onLoginSuccess();
        } else {
          setError(authError);
          setPendingApprovalPhone(null);
        }
      }
    });

    return () => unsubscribe();
  }, [pendingApprovalPhone, pendingApprovalPassword, onLoginSuccess]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!loginId || !loginPassword) {
      setError("অনুগ্ৰহ করে সব তথ্য পূরণ করুন।");
      return;
    }

    setLoading(true);
    setError(null);

    const { error: authError } = await dbService.signIn(loginId, loginPassword);

    if (authError) {
      if (authError.includes('Approval pending') || authError.includes('approve') || authError.includes('অনুমোদন')) {
        const cleanPhone = loginId.trim();
        setPendingApprovalPhone(cleanPhone);
        setPendingApprovalPassword(loginPassword);
        localStorage.setItem('savedOperatorPhone', cleanPhone);
        localStorage.setItem('savedOperatorPassword', loginPassword);
      }
      setError(authError);
      setLoading(false);
      return;
    }

    if (loginRole === 'operator') {
      localStorage.setItem('savedOperatorPhone', loginId.trim());
      localStorage.setItem('savedOperatorPassword', loginPassword);
    }

    setLoading(false);
    onLoginSuccess();
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    if (!regName || !regPhone || !regAddress || !regPassword) {
      setError("নিবন্ধনের জন্য সব তথ্য প্রদান করা আবশ্যক।");
      return;
    }

    if (regPhone.trim().length < 11) {
      setError("১১ অঙ্কের সঠিক মোবাইল নম্বর প্রদান করুন।");
      return;
    }

    setLoading(true);
    setError(null);

    const { success, error: regError } = await dbService.signUpOperator(
      regName,
      regPhone,
      regAddress,
      regPassword
    );

    setLoading(false);

    if (!success) {
      setError(regError || "অপারেটর নিবন্ধন ব্যর্থ হয়েছে।");
      return;
    }

    // Save registered credentials so they are preloaded and visible automatically
    localStorage.setItem('savedOperatorPhone', regPhone.trim());
    localStorage.setItem('savedOperatorPassword', regPassword);
    setLoginId(regPhone.trim());
    setLoginPassword(regPassword);

    setRegisteredSuccess(true);
    try {
      const waUrl = constructWhatsAppAdminNotificationUrl(regName, regPhone, regAddress);
      window.open(waUrl, '_blank');
    } catch (e) {
      console.warn("Popup blocked automatically redirecting on click", e);
    }
  };

  const getWhatsAppMessageUrl = () => {
    return constructWhatsAppAdminNotificationUrl(regName, regPhone, regAddress);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-green-100 via-emerald-50/30 to-white text-slate-800 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-emerald-100 text-emerald-600 mb-4 shadow-sm ring-4 ring-emerald-50">
          <Leaf className="h-9 w-9 stroke-[1.5]" />
        </div>
        <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
          কৃষক বাজার
        </h2>
        <p className="mt-2 text-sm text-emerald-800 font-bold tracking-wide">
          Krishok Bazar — internal Operations Portal
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl border border-emerald-100/80 sm:px-10 relative overflow-hidden">
          
          {/* TOP TAB CONTROL - Clearly separating Admin and Operator Workflows */}
          {!registeredSuccess && (
            <div className="flex bg-slate-50 border border-slate-100 rounded-xl p-1 mb-6">
              <button
                type="button"
                onClick={() => {
                  setLoginRole('operator');
                  setError(null);
                  setIsRegister(false);
                  setPendingApprovalPhone(null);
                }}
                className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all outline-none ${
                  loginRole === 'operator'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <User className="w-4 h-4" />
                অপারেটর (Operator)
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginRole('admin');
                  setError(null);
                  setIsRegister(false);
                  setPendingApprovalPhone(null);
                }}
                className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all outline-none ${
                  loginRole === 'admin'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <BadgeInfo className="w-4 h-4" />
                এডমিন (Admin)
              </button>
            </div>
          )}

          {error && !pendingApprovalPhone && (
            <div className="mb-5 bg-rose-50 border border-rose-200 text-rose-800 text-xs p-4 rounded-xl flex items-start gap-2.5 shadow-xs">
              <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="font-semibold">{error}</div>
            </div>
          )}

          {pendingApprovalPhone && (
            <div className="mb-5 bg-amber-55/70 border border-amber-250 text-amber-900 text-xs p-4 rounded-xl flex items-start gap-2.5 shadow-xs leading-relaxed">
              <Loader2 className="h-5 w-5 text-amber-600 shrink-0 mt-0.5 animate-spin" />
              <div>
                <h4 className="font-bold text-amber-955 mb-0.5">🔔 লাইভ ট্র্যাকিং সক্রিয়!</h4>
                অপারেটর মোবাইল নম্বর <span className="font-mono font-bold text-slate-800 bg-amber-100/50 px-1 rounded-sm">{pendingApprovalPhone}</span> এর জন্য এডমিন অনুমোদনের অপেক্ষা করা হচ্ছে। এডমিন ড্যাশবোর্ড থেকে অনুমোদন প্রদান করা মাত্রই পেজটি রিফ্রেশ বা ডবল ক্লিক ছাড়াই সোজা ড্যাশবোর্ডে লিংক হবে।
              </div>
            </div>
          )}

          {registeredSuccess ? (
            <div className="text-center py-4 flex flex-col items-center">
              {/* Registration Notification Message */}
              <div className="mb-5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-4 rounded-xl flex items-start gap-2.5 text-left leading-relaxed">
                <CheckCircle className="h-6 w-6 text-emerald-600 shrink-0" />
                <div>
                  <h4 className="font-bold text-sm text-emerald-900 mb-1">🔔 নোটিফিকেশন: নিবন্ধন অনুরোধ জমা হয়েছে!</h4>
                  আপনার কৃষক বাজার গ্রামীণ অপারেটর অ্যাকাউন্টটি সিস্টেমে সাফল্যের সাথে নিবন্ধিত হয়েছে এবং এডমিনের কাছে অনতিবিলম্বে অনুমোদনের জন্য সংকেত পাঠানো হয়েছে।
                </div>
              </div>

              <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-emerald-100 text-emerald-600 mb-4 animate-pulse">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-700" />
              </div>

              <h3 className="text-lg font-bold text-slate-900 mb-2">অনুমোদনের জন্য অপেক্ষা করা হচ্ছে</h3>
              <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto mb-6">
                এডমিন আপনার অ্যাকাউন্ট অনুমোদন করা মাত্রই এই স্ক্রীনটি পরিবর্তন হবে এবং আপনি স্বয়ংক্রিয়ভাবে সরাসরি আপনার ড্যাশবোর্ডে প্রবেশ করবেন। আপনার কোনো বাটন চাপার প্রয়োজন নেই।
              </p>

              <div className="w-full bg-slate-50 rounded-xl p-4 mb-6 border border-slate-100 flex flex-col items-center gap-2">
                <div className="text-xs text-slate-500">
                  নিবন্ধিত মোবাইল: <span className="font-mono font-bold text-slate-800">{regPhone}</span>
                </div>
                <div className="text-xs text-slate-500">
                  নিবন্ধনের নাম: <span className="font-bold text-slate-800">{regName}</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-2 max-w-xs text-center leading-normal">
                  অনতিবিলম্বে অনুমোদনের জন্য নিচের বোতাম চেপে ওয়াটসঅ্যাপে এডমিনকে বার্তা প্রেরণ করুন।
                </p>
              </div>
              
              <a
                href={getWhatsAppMessageUrl()}
                target="_blank"
                rel="noreferrer"
                className="w-full inline-flex justify-center items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md active:scale-[0.98] transition-all cursor-pointer"
              >
                মেসেজ দিয়ে এডমিনকে জানান (WhatsApp)
              </a>

              <button
                type="button"
                onClick={() => {
                  setRegisteredSuccess(false);
                  setIsRegister(false);
                  setRegName('');
                  setRegPhone('');
                  setRegAddress('');
                  setRegPassword('');
                  setPendingApprovalPhone(null);
                }}
                className="mt-6 text-xs font-bold text-slate-500 hover:text-emerald-700 transition-colors cursor-pointer"
              >
                লগইন স্ক্রিনে ফিরে যান
              </button>
            </div>
          ) : (
            <form onSubmit={isRegister ? handleRegister : handleLogin} className="space-y-4">
              {loginRole === 'admin' ? (
                // ADMIN WORKFLOW
                <>
                  <div className="bg-slate-50/50 rounded-xl p-3 mb-2 border border-slate-100 flex items-start gap-2">
                    <BadgeInfo className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-slate-500 leading-normal">
                      কৃষক বাজার এডমিন প্যানেল — শুধুমাত্র নির্ধারিত এডমিনদের ব্যবহারের জন্য। কোনো অপারেটর এখানে নিবন্ধন করতে পারবেন না।
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Admin ID / Email (এডমিন ইমেল বা আইডি)
                    </label>
                    <div className="relative rounded-md">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <User className="h-5 w-5" />
                      </div>
                      <input
                        type="text"
                        value={loginId}
                        onChange={(e) => setLoginId(e.target.value)}
                        placeholder="riktazhossain@gmail.com"
                        className="block w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Password (পাসওয়ার্ড)
                    </label>
                    <div className="relative rounded-md">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Lock className="h-5 w-5" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="block w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                // OPERATOR WORKFLOWS
                <>
                  {isRegister ? (
                    <>
                      {/* Operator Register Forms */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                          Full Name (নাম)
                        </label>
                        <div className="relative rounded-md">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <User className="h-5 w-5" />
                          </div>
                          <input
                            type="text"
                            value={regName}
                            onChange={(e) => setRegName(e.target.value)}
                            placeholder="Zakir Hossain"
                            className="block w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                          Operator Mobile ID (মোবাইল নম্বর)
                        </label>
                        <div className="relative rounded-md">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <Phone className="h-5 w-5" />
                          </div>
                          <input
                            type="text"
                            value={regPhone}
                            onChange={(e) => setRegPhone(e.target.value)}
                            placeholder="01931355398"
                            className="block w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-990 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all"
                            required
                          />
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500 leading-normal">
                          নিবন্ধনের পরে লগইন করার জন্য এই নম্বরটি আপনার ইউজার আইডি হিসেবে ব্যবহৃত হবে।
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                          Operator Address (ঠিকানা)
                        </label>
                        <div className="relative rounded-md">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <MapPin className="h-5 w-5" />
                          </div>
                          <input
                            type="text"
                            value={regAddress}
                            onChange={(e) => setRegAddress(e.target.value)}
                            placeholder="Satkhira, Khulna"
                            className="block w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                          Set Security Password (পাসওয়ার্ড)
                        </label>
                        <div className="relative rounded-md">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <Lock className="h-5 w-5" />
                          </div>
                          <input
                            type={showPassword ? "text" : "password"}
                            value={regPassword}
                            onChange={(e) => setRegPassword(e.target.value)}
                            placeholder="••••••••"
                            className="block w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Operator Login Forms */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                          Operator Phone ID (অপারেটর মোবাইল নম্বর)
                        </label>
                        <div className="relative rounded-md">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <Phone className="h-5 w-5" />
                          </div>
                          <input
                            type="text"
                            value={loginId}
                            onChange={(e) => setLoginId(e.target.value)}
                            placeholder="যেমন: 01712345678"
                            className="block w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                          Password (পাসওয়ার্ড)
                        </label>
                        <div className="relative rounded-md">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <Lock className="h-5 w-5" />
                          </div>
                          <input
                            type={showPassword ? "text" : "password"}
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            placeholder="••••••••"
                            className="block w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm transition-all"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full flex justify-center items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 cursor-pointer disabled:opacity-50 transition-all shadow-md ${
                    loginRole === 'admin' 
                      ? 'bg-slate-800 hover:bg-slate-700 focus:ring-slate-500' 
                      : 'bg-emerald-600 hover:bg-emerald-500 focus:ring-emerald-500'
                  }`}
                >
                  {loading ? (
                    <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : isRegister ? (
                    <>
                      <UserPlus className="h-4 w-4" />
                      অপারেটর নতুন নিবন্ধন করুন
                    </>
                  ) : (
                    <>
                      <LogIn className="h-4 w-4" />
                      {loginRole === 'admin' ? 'এডমিন লগইন করুন (Admin Login)' : 'অপারেটর লগইন করুন (Operator Login)'}
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {!registeredSuccess && loginRole === 'operator' && (
            <div className="mt-6 flex flex-col items-center justify-center gap-2 border-t border-slate-100 pt-5 text-center">
              <p className="text-sm text-slate-500">
                {isRegister
                  ? "ইতিমধ্যে অ্যাকাউন্ট রেজিস্টার করা আছে?"
                  : "আপনি কি একজন নতুন গ্রামীণ অপারেটর?"}
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsRegister(!isRegister);
                  setError(null);
                  setPendingApprovalPhone(null);
                }}
                className="text-sm font-bold text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer"
              >
                {isRegister ? "লগইন করুন (Sign In)" : "অপারেটর নিবন্ধন করুন (Register Account)"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
