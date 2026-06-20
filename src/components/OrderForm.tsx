import { useEffect, useState, FormEvent, useRef, ChangeEvent } from 'react';
import { dbService } from '../db';
import { CostSettings, Customer, Profile } from '../types';
import { useNotification } from './NotificationContext';
import { ShoppingCart, Phone, User, MapPin, DollarSign, FileText, CheckCircle, Smartphone, QrCode, Camera, Navigation, Compass, Locate, Loader2, Mic, MicOff, Image, X, UploadCloud } from 'lucide-react';
import BarcodeScannerModal from './BarcodeScannerModal';
import { compressImage } from '../utils/imageCompressor';

interface OrderFormProps {
  user: Profile;
  onSuccessRedirect: () => void;
}

export default function OrderForm({ user, onSuccessRedirect }: OrderFormProps) {
  const { showError, showNotification } = useNotification();
  const [loading, setLoading] = useState(false);
  const [loadingDefaults, setLoadingDefaults] = useState(true);
  const [costDefaults, setCostDefaults] = useState<CostSettings | null>(null);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  
  // Form values
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [status, setStatus] = useState<'delivery' | 'return'>('delivery');
  const [productCostStr, setProductCostStr] = useState('');
  const [deliveryCostStr, setDeliveryCostStr] = useState('');
  const [otherCostsStr, setOtherCostsStr] = useState('');
  const [notes, setNotes] = useState('');

  // Image Upload and Compression states
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState<number>(-1);
  const [isDragging, setIsDragging] = useState(false);

  const handlePhotoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showNotification("ত্রুটি", "অনুগ্রহ করে শুধু ছবি আপলোড করুন।", "error");
      return;
    }

    try {
      setUploadProgress(10);
      
      const timer1 = setTimeout(() => setUploadProgress(35), 100);
      const timer2 = setTimeout(() => setUploadProgress(65), 250);
      const timer3 = setTimeout(() => setUploadProgress(85), 450);

      const compressedBase64 = await compressImage(file, 640, 640, 0.7);
      
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      
      setUploadProgress(100);
      setTimeout(() => {
        setPhotoUrl(compressedBase64);
        setUploadProgress(-1);
        showNotification("সফল", "ছবি সফলভাবে সংকোচিত ও যুক্ত করা হয়েছে।", "success");
      }, 300);

    } catch (err: any) {
      setUploadProgress(-1);
      showNotification("ত্রুটি", "ছবি প্রসেস করতে ত্রুটি হয়েছে।", "error");
      console.error(err);
    }
  };

  // Scanner and Device integration parameters
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  
  // Geolocation Traceability state parameters
  const [gpsCoords, setGpsCoords] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
    timestamp: number;
  } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Web Speech API Integration parameters and states
  const [activeDictationField, setActiveDictationField] = useState<string | null>(null);
  const [speechLang, setSpeechLang] = useState<'bn-BD' | 'en-US'>('bn-BD');
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
    }
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // Silent catch
        }
      }
    };
  }, []);

  const convertBengaliToEnglishNumerals = (str: string): string => {
    const bDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    let out = str;
    for (let i = 0; i < 10; i++) {
      out = out.replace(new RegExp(bDigits[i], 'g'), String(i));
    }
    return out;
  };

  const extractDigits = (str: string): string => {
    const converted = convertBengaliToEnglishNumerals(str);
    const matched = converted.match(/\d+(\.\d+)?/);
    return matched ? matched[0] : '';
  };

  const toggleSpeechRecognition = (fieldName: string) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showNotification(
        "ভয়েস অসমর্থিত", 
        "আপনার ব্রাউজার বা ডিভাইসে ভয়েস ইনপুট সমর্থিত নয়। অনুগ্রহ করে গুগল ক্রোম ব্রাউজার ব্যবহার করুন।", 
        "error"
      );
      return;
    }

    if (activeDictationField === fieldName) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore
        }
      }
      setActiveDictationField(null);
      return;
    }

    // Stop active dictations
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {
        // Ignore
      }
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = speechLang;

      rec.onstart = () => {
        setActiveDictationField(fieldName);
        showNotification(
          "ভয়েস রেকর্ড শুরু হয়েছে", 
          speechLang === 'bn-BD' ? "অনুগ্রহ করে কথা বলুন..." : "Speak now...", 
          "info",
          2000
        );
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          const finalVal = transcript.trim();
          if (fieldName === 'phone') {
            const parsedDigitsOnly = convertBengaliToEnglishNumerals(finalVal).replace(/\D/g, '');
            setPhone(parsedDigitsOnly);
            showNotification("প্রাপ্ত ফোন নম্বর", parsedDigitsOnly, "success");
          } else if (fieldName === 'name') {
            setName(finalVal);
            showNotification("প্রাপ্ত নাম", finalVal, "success");
          } else if (fieldName === 'address') {
            setAddress(finalVal);
            showNotification("প্রাপ্ত ঠিকানা", finalVal, "success");
          } else if (fieldName === 'amount') {
            const digits = extractDigits(finalVal);
            if (digits) {
              handleAmountChange(digits);
              showNotification("প্রাপ্ত টাকা", `৳${digits}`, "success");
            } else {
              showNotification("রিড ব্যর্থ", `কোনো সংখ্যা খুঁজে পাওয়া যায়নি: "${finalVal}"`, "error");
            }
          } else if (fieldName === 'notes') {
            setNotes(prev => prev ? `${prev} | ${finalVal}` : finalVal);
            showNotification("নোট যুক্ত করা হয়েছে", finalVal, "success");
          }
        }
      };

      rec.onerror = (event: any) => {
        console.warn("Speech engine error code:", event.error);
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          showNotification(
            "ডিকটেশন রেকর্ড সাময়িকভাবে বাধাগ্রস্ত হয়েছে", 
            `মাইক পারমিশন দিন। ত্রুটি: ${event.error}`, 
            "error"
          );
        }
        setActiveDictationField(null);
      };

      rec.onend = () => {
        setActiveDictationField(null);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      console.error("Critical voice api error:", err);
      setActiveDictationField(null);
    }
  };

  const captureGpsLocation = () => {
    if (!navigator.geolocation) {
      setGpsError("আপনার ব্রাউজারে জিপিএস সুবিধা সমর্থিত নয় (Geolocation not supported).");
      showNotification("জিপিএস ত্রুটি", "আপনার ব্রাউজার বা ডিভাইসে জিপিএস লোকেশন রিড করা অবরুদ্ধ।", "error");
      return;
    }

    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        });
        setGpsLoading(false);
        showNotification(
          "জিপিএস লোকেশন কো-অর্ডিনেট সংগৃহীত",
          `অর্ডার লোকেশন সফলভাবে ট্র্যাকড (নির্ভুলতা: ±${position.coords.accuracy.toFixed(1)}m)`,
          "success",
          4000
        );
      },
      (error) => {
        console.warn("GPS tracking error:", error);
        setGpsLoading(false);
        let msg = "লোকেশন ক্যাচ করা সম্ভব হয়নি।";
        if (error.code === error.PERMISSION_DENIED) {
          msg = "জিপিএস ব্যবহারের অনুমতি দেওয়া হয়নি। অনুগ্রহ করে ব্রাউজার সেটিংস থেকে লোকেশন পারমিশন সচল করুন।";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg = "ডিভাইসের জিপিএস সংকেত পাওয়া যায়নি। অনুগ্রহ করে ঘরের বাইরে ট্রাই করুণ।";
        } else if (error.code === error.TIMEOUT) {
          msg = "লোকেশন ট্র্যাক করতে সময়সীমা অতিক্রম হয়েছে। দয়া করে পুনরায় চেষ্টা করুন।";
        }
        setGpsError(msg);
        showNotification("লোকেশন ইরর", msg, "error", 6000);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  };

  // Statuses
  const [existingCustomerMatched, setExistingCustomerMatched] = useState<Customer | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleScanSuccess = (data: {
    phone?: string;
    name?: string;
    address?: string;
    amount?: number;
    notes?: string;
    rawText: string;
  }) => {
    if (data.phone) {
      setPhone(data.phone.trim());
    }
    if (data.name) {
      setName(data.name.trim());
    }
    if (data.address) {
      setAddress(data.address.trim());
    }
    if (data.amount !== undefined) {
      handleAmountChange(String(data.amount));
    }
    if (data.notes) {
      setNotes(prev => {
        const addition = data.notes?.trim() || '';
        if (!prev) return addition;
        if (prev.includes(addition)) return prev;
        return `${prev} | ${addition}`;
      });
    }
  };

  // Load configuration and existing customer phone numbers
  useEffect(() => {
    async function init() {
      try {
        const defaults = await dbService.getCostSettings();
        setCostDefaults(defaults);
        setDeliveryCostStr(String(defaults.default_delivery_cost));
        setOtherCostsStr(String(defaults.other_fixed_cost));

        const customers = await dbService.getCustomers();
        setAllCustomers(customers);
      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        setLoadingDefaults(false);
      }
    }
    init();
  }, []);

  // Monitor phone input to see if it matches an existing profile
  useEffect(() => {
    const cleanPhone = phone.trim();
    if (cleanPhone.length >= 8) {
      const matched = allCustomers.find(
        (c) => c.phone.replace(/[\s-]/g, '') === cleanPhone.replace(/[\s-]/g, '')
      );
      if (matched) {
        setExistingCustomerMatched(matched);
        setName(matched.name);
        setAddress(matched.address || '');
      } else {
        setExistingCustomerMatched(null);
      }
    } else {
      setExistingCustomerMatched(null);
    }
  }, [phone, allCustomers]);

  // Handle automatic product cost approximation based on order amount change
  const handleAmountChange = (val: string) => {
    setAmountStr(val);
    const numAmt = parseFloat(val);
    if (!isNaN(numAmt) && costDefaults) {
      // Calculate automated product cost approximation (percent) if present
      const approx = (numAmt * costDefaults.product_cost_percent) / 100;
      setProductCostStr(String(Math.round(approx)));
    } else {
      setProductCostStr('');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanPhone = phone.trim();
    const cleanName = name.trim();
    const cleanAddress = address.trim();
    const amountVal = parseFloat(amountStr);
    const productCostVal = parseFloat(productCostStr) || 0;
    const deliveryCostVal = parseFloat(deliveryCostStr) || 0;
    const otherCostsVal = parseFloat(otherCostsStr) || 0;

    if (!cleanPhone || !cleanName) {
      setErrorMsg("Please provide customer phone and name.");
      return;
    }

    if (isNaN(amountVal) || amountVal <= 0) {
      setErrorMsg("Please provide a valid numeric order amount.");
      return;
    }

    setLoading(true);

    let gpsLocationStr = '';
    if (gpsCoords) {
      gpsLocationStr = `Lat: ${gpsCoords.latitude.toFixed(6)}, Lon: ${gpsCoords.longitude.toFixed(6)}, Acc: ${gpsCoords.accuracy.toFixed(1)}m`;
    }

    try {
      await dbService.addOrder(
        {
          customerName: cleanName,
          customerPhone: cleanPhone,
          customerAddress: cleanAddress,
          amount: amountVal,
          status,
          product_cost: productCostVal,
          delivery_cost: deliveryCostVal,
          other_costs: otherCostsVal,
          notes: notes.trim() || undefined,
          gps_location: gpsLocationStr || undefined,
          photo_url: photoUrl || undefined,
        },
        user.id
      );

      setSubmitSuccess(true);
      if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        try {
          window.navigator.vibrate([100, 50, 100]); // Snappy double haptic pulse to confirm successful submission
        } catch (e) {
          console.warn("Vibration feedback not supported or blocked by user preference:", e);
        }
      }
      showNotification("Success", "অর্ডারটি সফলভাবে ডাটাবেজে অন্তর্ভুক্ত করা হয়েছে!", "success");
      
      // Clear form inputs
      setPhone('');
      setName('');
      setAddress('');
      setAmountStr('');
      setProductCostStr(costDefaults ? String(Math.round((0 * costDefaults.product_cost_percent)/100)) : '');
      setDeliveryCostStr(costDefaults ? String(costDefaults.default_delivery_cost) : '');
      setOtherCostsStr(costDefaults ? String(costDefaults.other_fixed_cost) : '');
      setNotes('');
      setGpsCoords(null);
      setGpsError(null);
      setExistingCustomerMatched(null);

      // Refresh customers register for subsequent inserts
      const customers = await dbService.getCustomers();
      setAllCustomers(customers);

    } catch (err: any) {
      setErrorMsg(err.message || "Failed to catalog order, please check database settings.");
      showError("অর্ডার এন্ট্রি ব্যর্থ হয়েছে (Order entry failed)", err);
    } finally {
      setLoading(false);
    }
  };

  // Immediate calculations preview
  const previewAmount = parseFloat(amountStr) || 0;
  const previewProduct = parseFloat(productCostStr) || 0;
  const previewDelivery = parseFloat(deliveryCostStr) || 0;
  const previewOther = parseFloat(otherCostsStr) || 0;
  const previewTotalCost = previewProduct + previewDelivery + previewOther;
  const previewProfit = status === 'delivery' 
    ? previewAmount - previewTotalCost 
    : -previewAmount - previewTotalCost;

  if (loadingDefaults) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <ShoppingCart className="w-6 h-6 text-emerald-600" />
          নতুন অর্ডার এন্ট্রি (Add New Order Log)
        </h2>
        <p className="text-xs text-slate-500">Record customer collections, status, and actual profitability margins immediately.</p>
      </div>

      {submitSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 p-4 rounded-xl flex items-start gap-3 shadow-xs">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-bold">সফলভাবে অর্ডার সংরক্ষিত হয়েছে!</span> Order cataloged successfully, cost matrices resolved, and customer metrics incremented automatically.
            <div className="mt-2.5 flex gap-4">
              <button 
                onClick={() => setSubmitSuccess(false)}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-900 cursor-pointer"
              >
                Enter Another Order
              </button>
              <button 
                onClick={onSuccessRedirect}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer font-semibold"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500/20 text-rose-700 p-4 rounded-xl text-sm">
          <span className="font-bold">Error:</span> {errorMsg}
        </div>
      )}

      {/* Main Order Entry Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        
        {/* Customer Profile Section */}
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
              <Smartphone className="w-4 h-4" /> 1. Customer Information
            </h3>
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/40 rounded-xl text-xs font-bold transition-all duration-200 shadow-3xs active:scale-98 cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>পণ্য বারকোড/কিউআর স্ক্যান করুন (Scan Code)</span>
            </button>
          </div>

          {/* Voice Configuration Panel */}
          {speechSupported && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-emerald-50/40 border border-emerald-100/60 rounded-xl px-4 py-2.5 mb-5 text-xs gap-3">
              <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                <span className="flex h-2 w-2 relative shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>ভয়েস ডিকটেশন সচল (Hands-free Voice Input Active)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-[11px] font-medium">ইনপুট ভাষা (Mic Lang):</span>
                <div className="bg-white border border-slate-200 p-0.5 rounded-lg flex shadow-3xs">
                  <button
                    type="button"
                    onClick={() => setSpeechLang('bn-BD')}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                      speechLang === 'bn-BD' 
                        ? 'bg-emerald-600 text-white shadow-3xs' 
                        : 'text-slate-605 text-slate-600 hover:text-slate-900 bg-transparent'
                    }`}
                  >
                    বাংলা (Bangla)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSpeechLang('en-US')}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                      speechLang === 'en-US' 
                        ? 'bg-emerald-600 text-white shadow-3xs' 
                        : 'text-slate-605 text-slate-600 hover:text-slate-900 bg-transparent'
                    }`}
                  >
                    English
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Phone */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                Phone Number <span className="text-rose-500">*</span>
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g., 01931355398"
                  className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-1.5 focus:ring-emerald-500 text-sm font-sans"
                  required
                />
                {speechSupported && (
                  <button
                    type="button"
                    onClick={() => toggleSpeechRecognition('phone')}
                    className={`px-3 border rounded-lg transition-all duration-200 cursor-pointer flex items-center justify-center shrink-0 active:scale-95 ${
                      activeDictationField === 'phone'
                        ? 'bg-rose-500 border-rose-550 text-white animate-pulse'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                    title="Speak Phone Number"
                  >
                    {activeDictationField === 'phone' ? (
                      <MicOff className="w-4 h-4" />
                    ) : (
                      <Mic className="w-4 h-4 text-emerald-600" />
                    )}
                  </button>
                )}
              </div>
              {existingCustomerMatched ? (
                <p className="mt-1.5 text-xs text-emerald-600 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-md w-fit">
                  ✓ Existing profile found: customer account will link.
                </p>
              ) : (
                phone.trim().length >= 8 && (
                  <p className="mt-1.5 text-xs text-slate-500 flex items-center gap-1">
                    ℹ New customer: a new profile will be created automatically.
                  </p>
                )
              )}
            </div>

            {/* Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                Customer Name <span className="text-rose-500">*</span>
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Anisur Rahman"
                  disabled={!!existingCustomerMatched}
                  className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg disabled:opacity-60 disabled:bg-slate-50 text-slate-800 focus:outline-hidden focus:ring-1.5 focus:ring-emerald-500 text-sm w-full"
                  required
                />
                {speechSupported && !existingCustomerMatched && (
                  <button
                    type="button"
                    onClick={() => toggleSpeechRecognition('name')}
                    className={`px-3 border rounded-lg transition-all duration-200 cursor-pointer flex items-center justify-center shrink-0 active:scale-95 ${
                      activeDictationField === 'name'
                        ? 'bg-rose-500 border-rose-550 text-white animate-pulse'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                    title="Speak Customer Name"
                  >
                    {activeDictationField === 'name' ? (
                      <MicOff className="w-4 h-4" />
                    ) : (
                      <Mic className="w-4 h-4 text-emerald-600" />
                    )}
                  </button>
                )}
              </div>
              {existingCustomerMatched && (
                <p className="mt-1 text-[11px] text-slate-400">
                  Name locked because phone matched an existing profile. To edit, visit the Customer directory.
                </p>
              )}
            </div>

            {/* Address */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                Delivery Address
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={!!existingCustomerMatched}
                  placeholder="e.g., Satkhira, Khulna Road, Bangladesh"
                  className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg disabled:opacity-60 disabled:bg-slate-50 text-slate-808 text-slate-800 focus:outline-hidden focus:ring-1.5 focus:ring-emerald-500 text-sm w-full"
                />
                {speechSupported && !existingCustomerMatched && (
                  <button
                    type="button"
                    onClick={() => toggleSpeechRecognition('address')}
                    className={`px-3 border rounded-lg transition-all duration-200 cursor-pointer flex items-center justify-center shrink-0 active:scale-95 ${
                      activeDictationField === 'address'
                        ? 'bg-rose-500 border-rose-550 text-white animate-pulse'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                    title="Speak Delivery Address"
                  >
                    {activeDictationField === 'address' ? (
                      <MicOff className="w-4 h-4" />
                    ) : (
                      <Mic className="w-4 h-4 text-emerald-600" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* GPS Geolocation verification */}
            <div className="md:col-span-2 bg-slate-50 border border-slate-200/60 p-4 rounded-xl space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-805 text-slate-800 flex items-center gap-1.5">
                    <Navigation className="w-4 h-4 text-emerald-600 animate-pulse" />
                    traceability GPS ট্র্যাকিং (Order Location Verification)
                  </label>
                  <p className="text-[11px] text-slate-500 leading-normal max-w-md mt-0.5">
                    সঠিক সরবরাহ পয়েন্ট ট্র্যাকিং এর জন্য এবং কৃষকের অর্ডারের সত্যতা নিশ্চিতকরণে অর্ডারটি নেওয়ার সময় জিপিএস জেনারেট করুন।
                  </p>
                </div>
                
                <button
                  type="button"
                  onClick={captureGpsLocation}
                  disabled={gpsLoading}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 min-w-[140px] justify-center cursor-pointer select-none active:scale-98 ${
                    gpsCoords 
                      ? 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-250' 
                      : 'bg-emerald-600 hover:bg-emerald-550 hover:bg-emerald-500 text-white shadow-xs'
                  }`}
                >
                  {gpsLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                      <span>লোডিং...</span>
                    </>
                  ) : gpsCoords ? (
                    <>
                      <Locate className="w-3.5 h-3.5 text-emerald-600" />
                      <span>রিলোকেট (Recapture)</span>
                    </>
                  ) : (
                    <>
                      <Compass className="w-3.5 h-3.5 text-emerald-100" />
                      <span>জিপিএস ট্র্যাক করুন</span>
                    </>
                  )}
                </button>
              </div>

              {gpsError && (
                <p className="text-[10px] text-rose-700 bg-rose-50 px-2.5 py-2 rounded-lg border border-rose-100/50 flex items-start gap-1 justify-start">
                  ⚠️ <span>{gpsError}</span>
                </p>
              )}

              {gpsCoords && (
                <div className="bg-white border border-emerald-200/50 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-3xs">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full border border-emerald-100 bg-emerald-50 flex items-center justify-center shrink-0">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <div className="text-left leading-normal">
                      <span className="block text-[9px] uppercase font-bold text-emerald-800 tracking-wider font-mono">Location Logged Successfully</span>
                      <div className="flex flex-wrap gap-x-3.5 gap-y-0.5 text-xs font-mono font-medium text-slate-700 mt-0.5">
                        <span>Lat: <strong>{gpsCoords.latitude.toFixed(6)}</strong></span>
                        <span>Lon: <strong>{gpsCoords.longitude.toFixed(6)}</strong></span>
                        <span>Accuracy: <strong className="text-emerald-700">±{gpsCoords.accuracy.toFixed(1)}m</strong></span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setGpsCoords(null); setGpsError(null); }}
                    className="text-[11px] text-rose-600 hover:text-rose-700 hover:underline font-bold sm:px-2 py-1 cursor-pointer select-none"
                  >
                    মুছে ফেলুন (Clear)
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Transaction Economics Section */}
        <div className="p-5 space-y-4">
          <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2 flex items-center gap-1">
            <DollarSign className="w-4 h-4" /> 2. Order Details & Expense Ledger
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Status (Delivery / Return) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Order Status <span className="text-rose-500">*</span>
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'delivery' | 'return')}
                className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-1.5 focus:ring-emerald-500 text-sm"
              >
                <option value="delivery">Delivery (বিক্রয়)</option>
                <option value="return">Return (ফেরত)</option>
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Order Amount (BDT) <span className="text-rose-500">*</span>
              </label>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  value={amountStr}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="e.g., 2500"
                  className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-1.5 focus:ring-emerald-500 text-sm font-mono"
                  required
                />
                {speechSupported && (
                  <button
                    type="button"
                    onClick={() => toggleSpeechRecognition('amount')}
                    className={`px-3 border rounded-lg transition-all duration-200 cursor-pointer flex items-center justify-center shrink-0 active:scale-95 ${
                      activeDictationField === 'amount'
                        ? 'bg-rose-500 border-rose-550 text-white animate-pulse'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                    title="Speak Amount"
                  >
                    {activeDictationField === 'amount' ? (
                      <MicOff className="w-4 h-4" />
                    ) : (
                      <Mic className="w-4 h-4 text-emerald-600" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Product Cost */}
            <div>
              <div className="flex justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Product Cost (সবজি/পণ্য মূল্য)
                </label>
                {costDefaults && (
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1.5 rounded-sm">
                    {costDefaults.product_cost_percent}% default
                  </span>
                )}
              </div>
              <input
                type="number"
                value={productCostStr}
                onChange={(e) => setProductCostStr(e.target.value)}
                placeholder="e.g., 1000"
                className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-1.5 focus:ring-emerald-500 text-sm font-mono"
              />
            </div>

            {/* Delivery Cost */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Delivery Cost (ডেলিভারি খরচ)
              </label>
              <input
                type="number"
                value={deliveryCostStr}
                onChange={(e) => setDeliveryCostStr(e.target.value)}
                placeholder="e.g., 50"
                className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-1.5 focus:ring-emerald-500 text-sm font-mono"
              />
            </div>

            {/* Other Cost */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Other Costs (অন্যান্য খরচ)
              </label>
              <input
                type="number"
                value={otherCostsStr}
                onChange={(e) => setOtherCostsStr(e.target.value)}
                placeholder="e.g., 20"
                className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-1.5 focus:ring-emerald-500 text-sm font-mono"
              />
            </div>

            {/* Notes */}
            <div className="md:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                Operator Notes (ঐচ্ছিক মন্তব্য)
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Farmer paid instantly, quality checked"
                  className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-1.5 focus:ring-emerald-500 text-sm w-full"
                />
                {speechSupported && (
                  <button
                    type="button"
                    onClick={() => toggleSpeechRecognition('notes')}
                    className={`px-3 border rounded-lg transition-all duration-200 cursor-pointer flex items-center justify-center shrink-0 active:scale-95 ${
                      activeDictationField === 'notes'
                        ? 'bg-rose-500 border-rose-550 text-white animate-pulse'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                    title="Speak Notes"
                  >
                    {activeDictationField === 'notes' ? (
                      <MicOff className="w-4 h-4" />
                    ) : (
                      <Mic className="w-4 h-4 text-emerald-600" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Receipt/Voucher Image Upload Field with Client-side Compression & Visual Progress Bar */}
            <div className="md:col-span-3 mt-1.5">
              <label className="block text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-emerald-600" />
                <span>Order Receipt or Delivery Photo (অর্ডার রশিদ অথবা ছবি)</span>
              </label>

              {/* Upload States */}
              {uploadProgress > -1 ? (
                /* Compression in Progress Block */
                <div className="border border-emerald-100 bg-emerald-50/40 rounded-xl p-5 text-center flex flex-col items-center justify-center space-y-4 shadow-xs transition-all duration-300">
                  <div className="bg-emerald-100 text-emerald-600 p-2.5 rounded-full animate-bounce">
                    <UploadCloud className="w-6 h-6" />
                  </div>
                  
                  <div className="w-full max-w-sm space-y-2">
                    <div className="flex justify-between items-center text-xs text-emerald-800 font-medium font-sans">
                      <span className="animate-pulse">পদ্ধতি সচল: ছবি সংকোচন ও লোড হচ্ছে...</span>
                      <span className="font-mono bg-emerald-100 px-2 py-0.5 rounded-full text-[10px]">{uploadProgress}%</span>
                    </div>

                    {/* Progress Bar Container */}
                    <div className="w-full bg-slate-200/80 h-2.5 rounded-full overflow-hidden shadow-inner border border-emerald-100">
                      <div 
                        className="bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-500 h-full rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>

                    <p className="text-[10px] text-slate-500 font-sans italic pt-1">
                      (Client-side compression runs automatically to safe Firestore database document limit)
                    </p>
                  </div>
                </div>
              ) : photoUrl ? (
                /* Compressed Image Preview Card */
                <div className="relative border border-slate-200 bg-slate-50/50 rounded-xl p-4 flex flex-col sm:flex-row items-center gap-4.5 group transition-all duration-300">
                  <div className="relative w-28 h-28 shrink-0 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shadow-xs">
                    <img 
                      src={photoUrl} 
                      alt="Order receipt thumbnail" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoUrl('');
                        showNotification("ছবি সরানো হয়েছে", "রশিদ বা ডেলিভারি ছবি বাতিল করা হয়েছে।", "info");
                      }}
                      className="absolute top-1 right-1 p-1 bg-rose-600/90 hover:bg-rose-600 text-white rounded-full shadow-md backdrop-blur-xs transition-colors duration-200 hover:scale-105 active:scale-95 cursor-pointer"
                      title="Remove Photo"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex-1 space-y-1.5 text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-start gap-1.5 text-emerald-700 font-bold text-xs bg-emerald-50 px-2 py-1 rounded-md inline-flex">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>সংকুচিত ছবি যুক্ত হয়েছে</span>
                    </div>
                    <p className="text-xs text-slate-600">
                      আপনার অর্ডার ফাইলের সাথে একটি রশিদের ছবি সফলভাবে সংযুক্ত করা হয়েছে। মূল ফর্মটি সংরক্ষণ করলে এটি ডেটাবেজে সংরক্ষিত হবে।
                    </p>
                    <p className="text-[10px] font-mono text-slate-400">
                      Payload safe check: ~{(photoUrl.length / 1024).toFixed(1)} KB (Firestore limit safe)
                    </p>
                  </div>
                </div>
              ) : (
                /* Drag & Drop File Upload Input */
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    const files = e.dataTransfer.files;
                    if (files && files.length > 0) {
                      handlePhotoUpload(files[0]);
                    }
                  }}
                  className={`border-2 border-dashed rounded-xl p-6.5 text-center flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
                    isDragging
                      ? 'border-emerald-500 bg-emerald-50/50 scale-[0.99] shadow-inner'
                      : 'border-slate-200 hover:border-emerald-400 bg-white hover:bg-slate-50/40'
                  }`}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files && files.length > 0) {
                        handlePhotoUpload(files[0]);
                      }
                    }}
                    id="order-photo-uploader"
                    className="hidden"
                  />
                  <label htmlFor="order-photo-uploader" className="cursor-pointer space-y-2.5 flex flex-col items-center">
                    <div className="bg-slate-100 text-slate-500 p-3 rounded-full group-hover:text-emerald-600 group-hover:bg-emerald-50 transition-colors duration-200">
                      <UploadCloud className="w-6 h-6 text-slate-400" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-slate-800">
                        ক্লিক করুন অথবা ছবি এখানে ড্র্যাগ ও ড্রপ করুন
                      </p>
                      <p className="text-[10px] text-slate-400">
                        PNG, JPG, JPEG (কম্প্রেস করে ১ মেগাবাইটের ভেতরে রাখা হবে)
                      </p>
                    </div>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Automatic Yield Preview Widget */}
          {previewAmount > 0 && (
            <div className="bg-slate-900 text-white rounded-xl p-4.5 mt-2.5 font-mono text-xs flex flex-wrap justify-between items-center gap-4">
              <div className="space-y-1">
                <div className="text-slate-400 font-sans text-[11px] uppercase tracking-wider">Economics Simulation</div>
                <div className="text-sm font-bold flex gap-4">
                  <span>Gross: <span className="text-emerald-400">৳{previewAmount.toLocaleString()}</span></span>
                  <span>Total cost: <span className="text-amber-400">৳{previewTotalCost.toLocaleString()}</span></span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-slate-400 font-sans text-[11px] uppercase tracking-wider">Net Profit Yield</div>
                <div className={`text-base font-extrabold ${previewProfit >= 0 ? 'text-emerald-400' : 'text-rose-450'}`}>
                  ৳{previewProfit.toLocaleString()}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onSuccessRedirect}
            className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg cursor-pointer disabled:opacity-50 inline-flex items-center gap-2"
          >
            {loading ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : "Save Order Record (সংরক্ষণ)"}
          </button>
        </div>
      </form>

      {/* Barcode/QR Code Multi-format Scanner Modal */}
      <BarcodeScannerModal 
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
      />
    </div>
  );
}
