import { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  X, 
  Camera, 
  QrCode, 
  Sparkles, 
  CheckCircle, 
  AlertCircle, 
  Smartphone, 
  HelpCircle, 
  Volume2, 
  RotateCw,
  FileText,
  BadgeInfo
} from 'lucide-react';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (data: {
    phone?: string;
    name?: string;
    address?: string;
    amount?: number;
    notes?: string;
    rawText: string;
  }) => void;
}

export default function BarcodeScannerModal({ isOpen, onClose, onScanSuccess }: BarcodeScannerModalProps) {
  const [cameras, setCameras] = useState<any[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [activeFacingMode, setActiveFacingMode] = useState<'environment' | 'user'>('environment');
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  
  // Scanned preview state to let user review before applying
  const [scannedResult, setScannedResult] = useState<any | null>(null);

  const qrScannerRef = useRef<Html5Qrcode | null>(null);

  // Play a satisfying synthetic web-audio beep
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      // 1100Hz frequency is highly audible and professional
      osc.frequency.setValueAtTime(1100, ctx.currentTime); 
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {
      console.warn("Web Audio beep not allowed/supported:", e);
    }
  };

  // Helper code parser
  const parseScannedText = (text: string) => {
    const trimmed = text.trim();
    
    // 1. Check if valid JSON formatted Order Invoice
    try {
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        const parsed = JSON.parse(trimmed);
        if (parsed.phone || parsed.amount || parsed.name) {
          return {
            type: 'invoice',
            label: 'রিসিপ্ট/বুকিং কিউআর কোড (Invoice/Order QR Code)',
            payload: {
              phone: parsed.phone || '',
              name: parsed.name || '',
              address: parsed.address || '',
              amount: parsed.amount ? Number(parsed.amount) : undefined,
              notes: parsed.notes || `Scanned from QR code Invoice`
            }
          };
        }
      }
    } catch (ex) {
      // Ignored - move to other formats
    }

    // 2. Check if text is purely the customer phone number (Bangladeshi formats)
    const phoneNoSpaces = trimmed.replace(/[\s-]/g, '');
    const phoneRegex = /(^(01)[3-9]\d{8}$)|(^\+?8801[3-9]\d{8}$)/;
    if (phoneRegex.test(phoneNoSpaces)) {
      // Extract clean 11 digit number
      const cleanPhone = phoneNoSpaces.endsWith(phoneNoSpaces.slice(-11)) ? phoneNoSpaces.slice(-11) : phoneNoSpaces;
      return {
        type: 'phone',
        label: 'গ্রাহক মোবাইল নম্বর (Customer Phone Barcode/QR)',
        payload: {
          phone: cleanPhone,
          notes: `কৃষক প্রোডাক্ট স্ক্যানার দিয়ে স্ক্যানকৃত`
        }
      };
    }

    // 3. Check if text matches generic Product SKU with metadata (e.g. TOM-500, KB-POTATO-150)
    const bdtPriceMatch = trimmed.match(/(?:[A-Za-z-]+)[-_](\d+)/);
    if (bdtPriceMatch && bdtPriceMatch[1]) {
      const parsedAmount = Number(bdtPriceMatch[1]);
      return {
        type: 'product_sku',
        label: 'পণ্য ট্যাগ ও দাম (Farmer Product Label Code)',
        payload: {
          amount: parsedAmount,
          notes: `প্রোডাক্ট কোড: ${trimmed}`
        }
      };
    }

    // 4. Default parsed text as a general numeric Order Amount or notes fallback
    if (/^\d{2,5}$/.test(trimmed)) {
      return {
        type: 'amount',
        label: 'অর্ডার মূল্য ট্যাগ (Numeric Price/Amount)',
        payload: {
          amount: Number(trimmed),
          notes: `ট্যাগ মূল্য ৳${trimmed} সরাসরি অন্তর্ভুক্ত`
        }
      };
    }

    // Fallback plain payload
    return {
      type: 'raw',
      label: 'সাধারণ তথ্য (Plain text Barcode)',
      payload: {
        notes: `বারকোড ডাটা: ${trimmed}`
      }
    };
  };

  const handleScanMatched = (text: string) => {
    playBeep();
    const result = parseScannedText(text);
    setScannedResult({
      rawText: text,
      type: result.type,
      label: result.label,
      payload: result.payload
    });
  };

  const handleApplyResult = () => {
    if (scannedResult) {
      onScanSuccess({
        ...scannedResult.payload,
        rawText: scannedResult.rawText
      });
      onClose();
    }
  };

  // Initialize and list cameras
  useEffect(() => {
    if (!isOpen) return;

    // Reset results on scan initial open
    setScannedResult(null);
    setScannerError(null);
    setIsReady(false);
    setScanning(false);

    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          // Prefer back/environmental camera if found
          const backCam = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment'));
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
        } else {
          setCameras([]);
        }
        setIsReady(true);
      })
      .catch((err) => {
        console.warn("Cameras discovery issue or blocked permission", err);
        setCameras([]);
        setIsReady(true); // Allow interactive troubleshooting / text inputs
      });
  }, [isOpen]);

  // Handle actual QR/Barcode scanner loop
  useEffect(() => {
    if (!isOpen || !isReady) return;

    const html5Qrcode = new Html5Qrcode("applet-qr-scanner-viewport");
    qrScannerRef.current = html5Qrcode;

    const config = {
      fps: 10,
      // Scanning box sizing
      qrbox: (width: number, height: number) => {
        const boxSize = Math.min(width * 0.75, height * 0.75, 260);
        return { width: boxSize, height: boxSize };
      }
    };

    const startScanner = async () => {
      try {
        setScannerError(null);
        setScanning(true);
        
        // Start streaming with selected camera OR fallback facingMode
        if (selectedCameraId) {
          await html5Qrcode.start(
            selectedCameraId,
            config,
            (decodedText) => {
              handleScanMatched(decodedText);
            },
            () => {
              // Verbose frame failures - ignored silently
            }
          );
        } else {
          await html5Qrcode.start(
            { facingMode: activeFacingMode },
            config,
            (decodedText) => {
              handleScanMatched(decodedText);
            },
            () => {
              // Frame mismatch - ignored
            }
          );
        }
      } catch (err: any) {
        console.error("Failed to boot web camera capture", err);
        setScannerError(err.message || "ক্যামেরা সচল করা সম্ভব হয়নি। অনুগ্রহ করে ব্রাউজার ক্যামেরা পারমিশন চেক করুন।");
        setScanning(false);
      }
    };

    startScanner();

    // Cleanup hook on model close
    return () => {
      if (html5Qrcode.isScanning) {
        html5Qrcode.stop()
          .then(() => {
            html5Qrcode.clear();
          })
          .catch((err) => console.log("Minor cleanup mismatch:", err));
      }
    };
  }, [isOpen, isReady, selectedCameraId, activeFacingMode]);

  const toggleFacingMode = () => {
    setSelectedCameraId('');
    setActiveFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-bento overflow-hidden border border-slate-200 animate-slide-up">
        {/* Banner header */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <QrCode className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400 font-mono">Camera Scanner</h3>
              <p className="text-sm font-bold text-slate-800">পণ্য বারকোড ও কিউআর স্ক্যানার</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 px-2.5 bg-slate-100 hover:bg-slate-200/80 rounded-lg text-slate-500 hover:text-slate-800 transition-colors text-xs font-bold font-sans cursor-pointer"
          >
            বন্ধ করুন (Esc)
          </button>
        </div>

        {/* Scanner view section */}
        <div className="p-5 space-y-4">
          {/* Main video viewport */}
          <div className="relative overflow-hidden rounded-xl bg-slate-950 aspect-video flex flex-col items-center justify-center border-2 border-dashed border-slate-700/50">
            <div id="applet-qr-scanner-viewport" className="w-full h-full object-cover" />
            
            {/* Loading state overlays */}
            {!scanning && !scannerError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 text-white p-4 text-center">
                <Camera className="w-8 h-8 text-slate-450 animate-pulse mb-2 text-emerald-400" />
                <p className="text-xs font-bold font-sans">ক্যামেরা শুরু হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...</p>
              </div>
            )}

            {/* Error fallback advice panel */}
            {scannerError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 text-white p-5 text-center">
                <AlertCircle className="w-8 h-8 text-rose-500 mb-2" />
                <h4 className="text-xs font-bold uppercase text-rose-450 font-sans tracking-wide">Camera Inaccessible</h4>
                <p className="text-[11px] leading-relaxed text-slate-350 mt-1 max-w-xs">
                  {scannerError.includes("Permission") 
                    ? "ক্যামেরা ব্যবহারের অনুমতি দেওয়া হয়নি। অনুগ্রহ করে গুগল ক্রোম বা সাফারি ব্রাউজারে সাইটটির 'Camera Permission' সচল করুন।" 
                    : scannerError}
                </p>
                <div className="mt-3 flex gap-2">
                  <button 
                    onClick={() => { setScannerError(null); setIsReady(false); setTimeout(() => setIsReady(true), 200); }} 
                    className="px-3 py-1.5 bg-slate-850 border border-slate-700 rounded-lg text-[10px] hover:bg-slate-800 transition-all cursor-pointer font-bold"
                  >
                    পুনরায় চেষ্টা করুন (Retry)
                  </button>
                </div>
              </div>
            )}

            {/* Scanning graphic target HUD overlay */}
            {scanning && !scannedResult && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {/* Aiming visual scanner laser target */}
                <div className="w-44 h-44 border-2 border-emerald-500 rounded-lg relative overflow-hidden">
                  <div className="absolute inset-x-0 h-0.5 bg-emerald-400 animate-pulse top-1/2 -translate-y-1/2 shadow-xs" />
                  {/* Corner indicator lines */}
                  <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-400" />
                  <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-400" />
                  <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-400" />
                  <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-400" />
                </div>
                <div className="absolute bottom-3 inset-x-0 text-center">
                  <span className="px-2.5 py-1 bg-black/70 text-[9px] text-emerald-400 rounded-full font-mono uppercase tracking-wider font-extrabold animate-pulse">
                    Scanning LIVE Viewport
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Quick controls section */}
          {cameras.length > 1 && (
            <div className="flex justify-between items-center bg-slate-50 p-2.5 rounded-xl border border-slate-150">
              <span className="text-[11px] text-slate-500 font-bold flex items-center gap-1.5 leading-relaxed">
                <RotateCw className="w-3.5 h-3.5 text-slate-400" />
                একাধিক ক্যামেরা পাওয়া গেছে:
              </span>
              <div className="flex gap-1.5">
                {cameras.map((cam, idx) => (
                  <button
                    key={cam.id}
                    onClick={() => setSelectedCameraId(cam.id)}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md border transition-all cursor-pointer ${
                      selectedCameraId === cam.id 
                        ? 'bg-emerald-600 text-white border-emerald-600' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    ক্যামেরা {idx + 1}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* SIMULATED BARCODE/QR TESTING DEPLOYMENT PANEL FOR DEMONSTRATIONS */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-250">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Manual Code Simulation (Testing Fallback)</span>
              <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold font-mono">Demo mode</span>
            </div>
            <div className="flex gap-2">
              <input 
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="মেইল বা ফোন নম্বর বা JSON এন্ট্রি দিয়ে টেস্ট করুন..." 
                className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-800"
              />
              <button 
                type="button"
                onClick={() => { if (manualCode) handleScanMatched(manualCode); }}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer"
              >
                টেস্ট ফিল করুন
              </button>
            </div>
            {/* Quick pre-sets */}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button 
                type="button"
                onClick={() => handleScanMatched("01931355398")}
                className="text-[9px] px-2 py-0.5 bg-slate-200/60 hover:bg-slate-200 text-slate-600 rounded font-bold"
              >
                📱 Phone pres
              </button>
              <button 
                type="button"
                onClick={() => handleScanMatched('{"phone":"01712345678","name":"Anwar Hossain","amount":2750,"address":"Dhaka","notes":"Fresh Organic Potato QR"}')}
                className="text-[9px] px-2 py-0.5 bg-slate-200/60 hover:bg-slate-200 text-slate-600 rounded font-bold"
              >
                📋 JSON Invoice pres
              </button>
              <button 
                type="button"
                onClick={() => handleScanMatched("KB-TOMATO-1250")}
                className="text-[9px] px-2 py-0.5 bg-slate-200/60 hover:bg-slate-200 text-slate-600 rounded font-bold"
              >
                🏷️ Sku Tag pres
              </button>
            </div>
          </div>

          {/* Results parsing HUD & Confirmation panel */}
          {scannedResult && (
            <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-4 space-y-3.5 animate-fade-in">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shrink-0">
                  <CheckCircle className="w-3.5 h-3.5" />
                </span>
                <div>
                  <h4 className="text-xs font-extrabold text-emerald-900 leading-none">{scannedResult.label}</h4>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">রড ডাটা (Raw): "{scannedResult.rawText}"</p>
                </div>
              </div>

              {/* Parsed entries parameters breakdown list */}
              <div className="grid grid-cols-2 gap-2 pb-1.5 border-t border-emerald-100 pt-3">
                {scannedResult.payload.phone && (
                  <div className="bg-white/80 p-2 border border-emerald-100/50 rounded-lg">
                    <span className="block text-[10px] font-bold text-slate-400">গ্রাহক ফোন (Phone)</span>
                    <span className="text-xs font-bold text-slate-800 font-sans">{scannedResult.payload.phone}</span>
                  </div>
                )}
                {scannedResult.payload.name && (
                  <div className="bg-white/80 p-2 border border-emerald-100/50 rounded-lg">
                    <span className="block text-[10px] font-bold text-slate-400">গ্রাহক নাম (Name)</span>
                    <span className="text-xs font-bold text-slate-800">{scannedResult.payload.name}</span>
                  </div>
                )}
                {scannedResult.payload.amount !== undefined && (
                  <div className="bg-white/80 p-2 border border-emerald-100/50 rounded-lg col-span-2">
                    <span className="block text-[10px] font-bold text-slate-400">অর্ডার মূল্য (Amount BDT)</span>
                    <span className="text-sm font-extrabold text-emerald-750 font-mono">৳{scannedResult.payload.amount.toLocaleString()} BDT</span>
                  </div>
                )}
                {scannedResult.payload.address && (
                  <div className="bg-white/80 p-2 border border-emerald-100/50 rounded-lg col-span-2">
                    <span className="block text-[10px] font-bold text-slate-400">ডেলিভারি ঠিকানা (Address)</span>
                    <span className="text-xs font-semibold text-slate-700">{scannedResult.payload.address}</span>
                  </div>
                )}
                {scannedResult.payload.notes && (
                  <div className="bg-white/80 p-2 border border-emerald-100/50 rounded-lg col-span-2 flex items-start gap-1">
                    <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="block text-[10px] font-bold text-slate-400">মন্তব্য (Notes)</span>
                      <span className="text-[11px] leading-relaxed text-slate-600">{scannedResult.payload.notes}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action layout button */}
              <button
                type="button"
                onClick={handleApplyResult}
                className="w-full inline-flex justify-center items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg active:scale-98 transition-all cursor-pointer font-sans"
              >
                নিশ্চিত করুন এবং অর্ডার ফর্মে বসান (Apply details)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
