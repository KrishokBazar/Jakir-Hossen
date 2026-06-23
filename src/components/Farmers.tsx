import { useEffect, useState, FormEvent, SVGProps, ChangeEvent, useRef } from 'react';
import { dbService } from '../db';
import { Farmer, FarmerPayment, FarmerSale, Profile } from '../types';
import { useNotification } from './NotificationContext';
import { canDelete } from '../utils/auth';
import { compressImage } from '../utils/imageCompressor';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { 
  Users, 
  Search, 
  MapPin, 
  Phone, 
  Calendar, 
  Coins, 
  ChevronRight, 
  ChevronDown,
  X, 
  Edit3, 
  Trash2, 
  Plus, 
  ArrowRight,
  Calculator,
  UserCheck,
  Mic,
  MicOff
} from 'lucide-react';

interface FarmersProps {
  user: Profile;
}

export default function Farmers({ user }: FarmersProps) {
  const { showError, showNotification } = useNotification();
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [sales, setSales] = useState<FarmerSale[]>([]);
  const [payments, setPayments] = useState<FarmerPayment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Web Speech API integration states
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speechLang, setSpeechLang] = useState<'bn-BD' | 'en-US'>('bn-BD');
  const [isDictating, setIsDictating] = useState(false);
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

  const toggleSpeech = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showNotification(
        "ভয়েস অসমর্থিত", 
        "আপনার ব্রাউজার বা ডিভাইসে ভয়েস ইনপুট সমর্থিত নয়। অনুগ্রহ করে গুগল ক্রোম ব্রাউজার ব্যবহার করুন।", 
        "error"
      );
      return;
    }

    if (isDictating) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore
        }
      }
      setIsDictating(false);
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = speechLang;

      rec.onstart = () => {
        setIsDictating(true);
        showNotification(
          "ভয়েস সন্ধান শুরু হয়েছে", 
          speechLang === 'bn-BD' ? "কৃষকের নাম বা গ্রাম বলুন..." : "Speak farmer name or village...", 
          "info",
          2500
        );
      };

      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          const query = transcript.trim().replace(/[।.]/g, ''); // Clear punctuation
          setSearchQuery(query);
          showNotification(
            "অনুসন্ধান করা হচ্ছে", 
            `"${query}" এর জন্য সন্ধান করা হচ্ছে`, 
            "success"
          );
        }
      };

      rec.onerror = (event: any) => {
        console.warn("Farmer Search dictate error:", event.error);
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          showNotification(
            "ডিকটেশন রেকর্ড সাময়িকভাবে বাধাগ্রস্ত হয়েছে", 
            `মাইক পারমিশন দিন। ত্রুটি: ${event.error}`, 
            "error"
          );
        }
        setIsDictating(false);
      };

      rec.onend = () => {
        setIsDictating(false);
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      console.error("Farmer Voice search engine load failure:", err);
      setIsDictating(false);
    }
  };

  // Selected Farmer details
  const [selectedFarmer, setSelectedFarmer] = useState<Farmer | null>(null);

  // Modals state
  const [showAddFarmerModal, setShowAddFarmerModal] = useState(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [showAddSaleModal, setShowAddSaleModal] = useState(false);
  const [editingFarmer, setEditingFarmer] = useState<Farmer | null>(null);

  // Farmer form states
  const [farmerName, setFarmerName] = useState('');
  const [farmerPhone, setFarmerPhone] = useState('');
  const [farmerSecondaryPhone, setFarmerSecondaryPhone] = useState('');
  const [farmerVillage, setFarmerVillage] = useState('');
  const [farmerGender, setFarmerGender] = useState<'male' | 'female'>('male');
  const [farmerProducts, setFarmerProducts] = useState('');
  const [farmerCommission, setFarmerCommission] = useState<5 | 10>(10);
  const [initialSales, setInitialSales] = useState<number>(0);
  const [initialPaid, setInitialPaid] = useState<number>(0);
  const [farmerPhotoUrl, setFarmerPhotoUrl] = useState('');
  const [farmerError, setFarmerError] = useState<string | null>(null);

  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const compressedBase64 = await compressImage(file, 500, 500, 0.7);
        setFarmerPhotoUrl(compressedBase64);
      } catch (err: any) {
        showError("ছবি আপলোড করতে ত্রুটি হয়েছে", err);
      }
    }
  };

  // Payment form states
  const [paymentFarmerId, setPaymentFarmerId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [expandedFarmerId, setExpandedFarmerId] = useState<string | null>(null);

  // Sale form states
  const [saleFarmerId, setSaleFarmerId] = useState('');
  const [saleAmount, setSaleAmount] = useState<number>(0);
  const [saleProducts, setSaleProducts] = useState('');
  const [saleCommission, setSaleCommission] = useState<5 | 10>(10);
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [saleError, setSaleError] = useState<string | null>(null);

  const isAdmin = canDelete(user);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteModalConfig, setDeleteModalConfig] = useState<{
    onConfirm: () => void;
    title: string;
    message: string;
    itemName: string;
  }>({
    onConfirm: () => {},
    title: '',
    message: '',
    itemName: ''
  });

  // Load / subscribe to all data
  useEffect(() => {
    setLoading(true);
    const unsubFarmers = dbService.subscribeFarmers(
      (liveFarmers) => setFarmers(liveFarmers),
      (err) => console.error("Error subscribing farmers:", err)
    );

    const unsubPayments = dbService.subscribeFarmerPayments(
      (livePayments) => setPayments(livePayments),
      (err) => console.error("Error subscribing payments:", err)
    );

    const unsubSales = dbService.subscribeFarmerSales(
      (liveSales) => {
        setSales(liveSales);
        setLoading(false);
      },
      (err) => {
        console.error("Error subscribing sales:", err);
        setLoading(false);
      }
    );

    return () => {
      unsubFarmers();
      unsubPayments();
      unsubSales();
    };
  }, []);

  // Set default form values inside modals
  const openAddFarmer = () => {
    setFarmerName('');
    setFarmerPhone('');
    setFarmerSecondaryPhone('');
    setFarmerVillage('');
    setFarmerGender('male');
    setFarmerProducts('');
    setFarmerCommission(10);
    setInitialSales(0);
    setInitialPaid(0);
    setFarmerPhotoUrl('');
    setFarmerError(null);
    setShowAddFarmerModal(true);
  };

  const openAddPayment = (farmer?: Farmer) => {
    setPaymentFarmerId(farmer?.id || farmers[0]?.id || '');
    setPaymentAmount(0);
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentReference('');
    setPaymentNotes('');
    setPaymentError(null);
    setShowAddPaymentModal(true);
  };

  const openAddSale = (farmer?: Farmer) => {
    setSaleFarmerId(farmer?.id || farmers[0]?.id || '');
    setSaleAmount(0);
    setSaleProducts(farmer?.products_sold || '');
    setSaleCommission(farmer?.commission_rate || 10);
    setSaleDate(new Date().toISOString().split('T')[0]);
    setSaleError(null);
    setShowAddSaleModal(true);
  };

  const openEditFarmer = (farmer: Farmer) => {
    setEditingFarmer(farmer);
    setFarmerName(farmer.name);
    setFarmerPhone(farmer.phone);
    setFarmerSecondaryPhone(farmer.secondary_phone || '');
    setFarmerVillage(farmer.village);
    setFarmerGender(farmer.gender);
    setFarmerProducts(farmer.products_sold);
    setFarmerCommission(farmer.commission_rate);
    setFarmerPhotoUrl(farmer.photo_url || '');
    setFarmerError(null);
  };

  // 100% Admin & Operator approval functions
  const handleFarmerSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFarmerError(null);

    const cleanPhone = farmerPhone.trim();
    if (!farmerName.trim() || !cleanPhone || !farmerVillage.trim()) {
      setFarmerError("নাম, মোবাইল নম্বর এবং গ্রামের নাম আবশ্যক।");
      return;
    }

    try {
      // Recalculate profit if any sales are being initialized
      const profitVal = Math.round(initialSales * (farmerCommission / 100));

      const farmerData = {
        id: cleanPhone,
        name: farmerName.trim(),
        phone: cleanPhone,
        secondary_phone: farmerSecondaryPhone.trim() || undefined,
        village: farmerVillage.trim(),
        gender: farmerGender,
        products_sold: farmerProducts.trim() || 'General Produce',
        commission_rate: farmerCommission,
        total_sales: initialSales,
        our_profit: profitVal,
        total_paid: initialPaid,
        payment_count: initialPaid > 0 ? 1 : 0,
        photo_url: farmerPhotoUrl || undefined
      };

      // Check duplicate/merge rule!
      const exists = farmers.find(f => f.id === cleanPhone || (f.phone === cleanPhone && f.name.toLowerCase() === farmerName.trim().toLowerCase()));
      if (exists) {
        const confirmMerge = window.confirm(`"${exists.name}" (${cleanPhone}) নামে একজন কৃষক ইতিমধ্যে সংরক্ষিত আছে। আপনি কি এই নতুন তথ্যটি আগের অ্যাকাউন্টের সাথে যুক্ত (Merge) করতে চান?`);
        if (!confirmMerge) return;
      }

      await dbService.createOrMergeFarmer(farmerData);
      setShowAddFarmerModal(false);

      // If initial paid of Farmer, write a payment doc as well to track history
      if (initialPaid > 0) {
        await dbService.addFarmerPayment({
          id: `fp-init-${cleanPhone}-${Date.now()}`,
          farmer_id: cleanPhone,
          farmer_name: farmerName.trim(),
          farmer_phone: cleanPhone,
          amount: initialPaid,
          payment_date: new Date().toISOString(),
          notes: 'প্রারম্ভিক তহবিল পরিশোধ',
          added_by: user?.name || 'system'
        });
      }

      // If initial sales of Farmer, write a sale doc as well
      if (initialSales > 0) {
        await dbService.addFarmerSale({
          id: `fs-init-${cleanPhone}-${Date.now()}`,
          farmer_id: cleanPhone,
          farmer_name: farmerName.trim(),
          farmer_phone: cleanPhone,
          amount: initialSales,
          products: farmerProducts.trim() || 'General Produce',
          commission_rate: farmerCommission,
          our_profit: profitVal,
          sale_date: new Date().toISOString(),
          added_by: user?.name || 'system'
        });
      }

    } catch (err: any) {
      setFarmerError(err.message || "সংরক্ষণ করতে সমস্যা হয়েছে।");
      showError("সংরক্ষণ করতে ত্রুটি", err);
    }
  };

  const handleFarmerEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingFarmer) return;

    try {
      // Admin/Operator Edit profile
      const profitVal = Math.round(editingFarmer.total_sales * (farmerCommission / 100));
      await dbService.updateFarmer(editingFarmer.id, {
        name: farmerName.trim(),
        phone: farmerPhone.trim(),
        secondary_phone: farmerSecondaryPhone.trim() || undefined,
        village: farmerVillage.trim(),
        gender: farmerGender,
        products_sold: farmerProducts.trim(),
        commission_rate: farmerCommission,
        our_profit: profitVal,
        photo_url: farmerPhotoUrl || undefined
      });

      // Update selected modal details if open
      if (selectedFarmer && selectedFarmer.id === editingFarmer.id) {
        setSelectedFarmer({
          ...selectedFarmer,
          name: farmerName.trim(),
          phone: farmerPhone.trim(),
          secondary_phone: farmerSecondaryPhone.trim() || undefined,
          village: farmerVillage.trim(),
          gender: farmerGender,
          products_sold: farmerProducts.trim(),
          commission_rate: farmerCommission,
          our_profit: profitVal,
          photo_url: farmerPhotoUrl || undefined
        });
      }

      setEditingFarmer(null);
      showNotification("সফল", "কৃষক তথ্য সফলভাবে হালনাগাদ করা হয়েছে।", "success");
    } catch (err: any) {
      showError("হালনাগাদ করতে ব্যর্থ হয়েছে", err);
    }
  };

  const handleFarmerDelete = (id: string, name: string) => {
    if (!isAdmin) {
      showNotification("অনুমতি নেই", "দুঃখিত, শুধুমাত্র অ্যাডমিন ডিলিট করতে পারবেন (Only admin can delete).", "warning");
      return;
    }

    setDeleteModalConfig({
      onConfirm: async () => {
        try {
          await dbService.deleteFarmer(id);
          setSelectedFarmer(null);
          showNotification("সফল", "কৃষক প্রোফাইল ডিলিট করা হয়েছে।", "success");
        } catch (err: any) {
          showError("ডিলিট করতে সমস্যা হয়েছে", err);
        }
      },
      title: "কৃষক প্রোফাইল ডিলিট নিশ্চিতকরণ (Confirm Farmer Profile Delete)",
      message: `আপনি কি নিশ্চিত যে আপনি কৃষক "${name}" এবং তার সমস্ত তথ্য ডিলিট করতে চান? এই একশন রিভার্স করা যাবে না।`,
      itemName: `${name} (ID: ${id})`
    });
    setDeleteModalOpen(true);
  };

  // Payout action
  const handlePaymentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPaymentError(null);

    const fObj = farmers.find(f => f.id === paymentFarmerId);
    if (!fObj) {
      setPaymentError("অনুগ্রহ করে একজন সঠিক কৃষক নির্বাচন করুন।");
      return;
    }

    if (paymentAmount <= 0) {
      setPaymentError("টাকার পরিমাণ অবশ্যই ০ থেকে বেশি হতে হবে।");
      return;
    }

    try {
      await dbService.addFarmerPayment({
        id: `fp-${Date.now()}`,
        farmer_id: fObj.id,
        farmer_name: fObj.name,
        farmer_phone: fObj.phone,
        amount: Number(paymentAmount),
        payment_date: new Date(paymentDate).toISOString(),
        notes: paymentNotes.trim() || undefined,
        reference: paymentReference.trim() || undefined,
        added_by: user.name
      });

      setShowAddPaymentModal(false);
      showNotification("সফল", "টাকা পরিশোধ সফলভাবে রেকর্ড করা হয়েছে।", "success");
    } catch (err: any) {
      setPaymentError(err.message || "টাকা পরিশোধ এড করতে ত্রুটি হয়েছে।");
      showError("পরিশোধে ত্রুটি", err);
    }
  };

  // Farmer Sale Action (goods purchased/re-sold)
  const handleSaleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaleError(null);

    const fObj = farmers.find(f => f.id === saleFarmerId);
    if (!fObj) {
      setSaleError("অনুগ্রহ করে সঠিক কৃষক নির্বাচন করুন।");
      return;
    }

    if (saleAmount <= 0) {
      setSaleError("পণ্য বিক্রয়ের পরিমাণ অবশ্যই ০ থেকে বেশি হতে হবে।");
      return;
    }

    try {
      const computedProfit = Math.round(saleAmount * (saleCommission / 100));

      await dbService.addFarmerSale({
        id: `fs-${Date.now()}`,
        farmer_id: fObj.id,
        farmer_name: fObj.name,
        farmer_phone: fObj.phone,
        amount: Number(saleAmount),
        products: saleProducts.trim() || 'General Produce',
        commission_rate: saleCommission,
        our_profit: computedProfit,
        sale_date: new Date(saleDate).toISOString(),
        added_by: user.name
      });

      setShowAddSaleModal(false);
      showNotification("সফল", "বিক্রয় বা ক্রয় সফলভাবে রেকর্ড করা হয়েছে।", "success");
    } catch (err: any) {
      setSaleError(err.message || "ক্রয়/বিক্রয় এন্ট্রি জমা দিতে ত্রুটি হয়েছে।");
      showError("বিক্রয় এন্ট্রিতে ত্রুটি", err);
    }
  };

  const toggleFarmerExpand = (farmerId: string) => {
    if (expandedFarmerId === farmerId) {
      setExpandedFarmerId(null);
    } else {
      setExpandedFarmerId(farmerId);
      // Reset payment variables for the inline form
      setPaymentAmount(0);
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentReference('');
      setPaymentNotes('');
    }
  };

  const handleInlinePaymentSubmit = async (e: FormEvent, farmer: Farmer) => {
    e.preventDefault();
    if (paymentAmount <= 0) {
      showNotification("ত্রুটি", "টাকার পরিমাণ অবশ্যই ০ থেকে বেশি হতে হবে।", "warning");
      return;
    }

    try {
      await dbService.addFarmerPayment({
        id: `fp-${Date.now()}`,
        farmer_id: farmer.id,
        farmer_name: farmer.name,
        farmer_phone: farmer.phone,
        amount: Number(paymentAmount),
        payment_date: new Date(paymentDate).toISOString(),
        notes: paymentNotes.trim() || undefined,
        reference: paymentReference.trim() || undefined,
        added_by: user.name
      });
      setPaymentAmount(0);
      setPaymentReference('');
      setPaymentNotes('');
      showNotification("সফল", "পেমেন্ট রেকর্ডটি সফলভাবে যোগ করা হয়েছে এবং কৃষক খাতা হালনাগাদ করা হয়েছে।", "success");
    } catch (err: any) {
      showError("সরাসরি পেমেন্ট এন্ট্রি করতে ত্রুটি", err);
    }
  };

  const handleDeletePaymentLog = (paymentId: string) => {
    if (!isAdmin) {
      showNotification("অনুমতি নেই", "দুঃখিত, শুধুমাত্র অ্যাডমিন ডিলিট করতে পারবেন।", "warning");
      return;
    }

    const currentPay = payments.find(p => p.id === paymentId);

    setDeleteModalConfig({
      onConfirm: async () => {
        try {
          await dbService.deleteFarmerPayment(paymentId);
          showNotification("সফল", "পেমেন্ট রেকর্ডটি সফলভাবে মুছে ফেলা হয়েছে।", "success");
        } catch (err: any) {
          showError("মুছে ফেলতে ত্রুটি", err);
        }
      },
      title: "পেমেন্ট রেকর্ড মুছে ফেলা (Delete Payment Record)",
      message: "আপনি কি সত্যিই এই পেমেন্ট রেকর্ডটি মুছে ফেলতে চান? এর ফলে কৃষকের পরিশোধিত হিসাব সমন্বয় করা হবে।",
      itemName: currentPay ? `Payment of ৳${currentPay.amount} on ${new Date(currentPay.payment_date).toLocaleDateString()}` : paymentId
    });
    setDeleteModalOpen(true);
  };

  const handleDeleteSaleLog = (saleId: string) => {
    if (!isAdmin) {
      showNotification("অনুমতি নেই", "দুঃখিত, শুধুমাত্র অ্যাডমিন ডিলিট করতে পারবেন।", "warning");
      return;
    }

    const currentSale = sales.find(s => s.id === saleId);

    setDeleteModalConfig({
      onConfirm: async () => {
        try {
          await dbService.deleteFarmerSale(saleId);
          showNotification("সফল", "বিক্রয় রেকর্ডটি সফলভাবে মুছে ফেলা হয়েছে।", "success");
        } catch (err: any) {
          showError("মুছে ফেলতে ত্রুটি", err);
        }
      },
      title: "বিক্রয় রেকর্ড মুছে ফেলা (Delete Sale Record)",
      message: "আপনি কি সত্যিই এই বিক্রয় রেকর্ডটি মুছে ফেলতে চান? এর ফলে কৃষকের মোট বিক্রি হিসাব সমন্বয় করা হবে।",
      itemName: currentSale ? `${currentSale.product_details} (Amount: ৳${currentSale.sale_amount})` : saleId
    });
    setDeleteModalOpen(true);
  };

  // Filter list by query
  const filteredFarmers = farmers.filter(f => {
    const q = searchQuery.toLowerCase();
    return (
      f.name.toLowerCase().includes(q) ||
      f.phone.includes(q) ||
      (f.secondary_phone && f.secondary_phone.includes(q)) ||
      f.village.toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  // Monthly stats calculations for farmer segment
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const monthlySales = sales
    .filter(s => s.sale_date.startsWith(currentMonth))
    .reduce((sum, s) => sum + s.amount, 0);

  const monthlyProfit = sales
    .filter(s => s.sale_date.startsWith(currentMonth))
    .reduce((sum, s) => sum + s.our_profit, 0);

  const monthlyPayments = payments
    .filter(p => p.payment_date.startsWith(currentMonth))
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">মোট কৃষক (Registered Farmers)</span>
            <h3 className="text-2xl font-bold font-mono text-slate-900 mt-1">{farmers.length} জন</h3>
          </div>
          <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">চলতি মাসের বেচাকেনা (Monthly Sales)</span>
            <h3 className="text-2xl font-bold font-mono text-slate-900 mt-1">৳{monthlySales.toLocaleString()}</h3>
          </div>
          <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Coins className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">চলতি মাসের লভ্যাংশ (Commission Profit)</span>
            <h3 className="text-2xl font-bold font-mono text-emerald-600 mt-1">৳{monthlyProfit.toLocaleString()}</h3>
          </div>
          <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
            <TrendingUpIcon className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">চলতি মাসে পরিশোধ (Monthly Paid out)</span>
            <h3 className="text-2xl font-bold font-mono text-amber-600 mt-1">৳{monthlyPayments.toLocaleString()}</h3>
          </div>
          <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600">
            <Calculator className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Panel Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Coins className="w-5 h-5 text-emerald-600" />
            কৃষক ও উৎপাদন খাতা (Farmer Ledger)
          </h2>
          <p className="text-xs text-slate-500 font-sans">Track suppliers payments, product categories, and commissions automatically.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={openAddFarmer}
            className="px-3.5 py-2 text-xs font-bold font-mono text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" /> নতুন কৃষক যোগ (Add Farmer)
          </button>

          <button
            onClick={() => openAddSale()}
            className="px-3.5 py-2 text-xs font-bold font-mono text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-all"
          >
            <Plus className="w-4 h-4 text-emerald-600" /> নতুন বিক্রয় যোগ
          </button>

          <button
            onClick={() => openAddPayment()}
            className="px-3.5 py-2 text-xs font-bold font-mono text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4 text-emerald-600" /> টাকা পরিশোধ এন্ট্রি
          </button>
        </div>
      </div>

      {/* Search and Table Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Table and Search */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden space-y-4 p-4">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="কৃষকের নাম, মোবাইল নম্বর অথবা গ্রাম দিয়ে খুঁজুন..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-10 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-emerald-500 bg-slate-50/50 font-medium"
              />
              {speechSupported && (
                <button
                  type="button"
                  onClick={toggleSpeech}
                  className={`absolute right-2 top-1.5 py-0.5 px-1.5 rounded transition-all duration-200 cursor-pointer flex items-center justify-center shrink-0 active:scale-95 ${
                    isDictating
                      ? 'bg-rose-500 text-white animate-pulse'
                      : 'text-slate-400 hover:text-emerald-600 hover:bg-slate-100'
                  }`}
                  title={isDictating ? "ভয়েস বন্ধ করুন" : "ভয়েস দিয়ে খুঁজুন (Voice Search)"}
                >
                  {isDictating ? (
                    <MicOff className="w-3.5 h-3.5" />
                  ) : (
                    <Mic className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>
            
            {speechSupported && (
              <div className="flex items-center gap-1 self-start sm:self-center bg-slate-50 border border-slate-200 p-0.5 rounded-lg text-[10px] shrink-0 shadow-3xs select-none">
                <span className="text-slate-400 px-1 font-bold">ভাষা:</span>
                <button
                  type="button"
                  onClick={() => setSpeechLang('bn-BD')}
                  className={`px-2 py-0.5 rounded font-extrabold cursor-pointer transition-all ${
                    speechLang === 'bn-BD'
                      ? 'bg-emerald-600 text-white shadow-3xs'
                      : 'text-slate-500 hover:text-slate-900 bg-transparent'
                  }`}
                >
                  বাংলা
                </button>
                <button
                  type="button"
                  onClick={() => setSpeechLang('en-US')}
                  className={`px-2 py-0.5 rounded font-extrabold cursor-pointer transition-all ${
                    speechLang === 'en-US'
                      ? 'bg-emerald-600 text-white shadow-3xs'
                      : 'text-slate-500 hover:text-slate-900 bg-transparent'
                  }`}
                >
                  En
                </button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            {filteredFarmers.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">কোনো কৃষকের তথ্য পাওয়া যায়নি।</div>
            ) : (
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100">
                    <th className="px-4 py-2.5 text-left font-bold text-slate-500">নাম ও গ্রাম</th>
                    <th className="px-4 py-2.5 text-left font-bold text-slate-500">মোবাইল নম্বর</th>
                    <th className="px-4 py-2.5 text-left font-bold text-slate-500">পণ্য সমূহ</th>
                    <th className="px-4 py-2.5 text-right font-bold text-slate-500">লভ্যাংশ হার</th>
                    <th className="px-4 py-2.5 text-right font-bold text-slate-500">মোট বিক্রি ও আমাদের লাভ</th>
                    <th className="px-4 py-2.5 text-right font-bold text-slate-500">পরিশোধ (বার)</th>
                  </tr>
                </thead>
                {filteredFarmers.map((f) => {
                  const farmerPayments = payments.filter((p) => p.farmer_id === f.id);
                  const farmerSales = sales.filter((s) => s.farmer_id === f.id);
                  
                  const combinedTransactions = [
                    ...farmerPayments.map((p) => ({
                      id: p.id,
                      date: p.payment_date,
                      type: 'payment' as const,
                      amount: p.amount,
                      reference: p.reference || 'N/A',
                      notes: p.notes || '',
                      added_by: p.added_by
                    })),
                    ...farmerSales.map((s) => ({
                      id: s.id,
                      date: s.sale_date,
                      type: 'sale' as const,
                      amount: f.commission_rate === 5 ? Math.round(s.amount * 0.95) : Math.round(s.amount * 0.90), // farmer's share!
                      reference: s.products || 'General Produce',
                      notes: `কমিশন ${s.commission_rate}% (মোট মূল্য: ৳${s.amount.toLocaleString()})`,
                      added_by: s.added_by
                    }))
                  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                  const isExpanded = expandedFarmerId === f.id;

                  return (
                    <tbody key={f.id} className="divide-y divide-slate-100 bg-white">
                      <tr
                        onClick={() => setSelectedFarmer(f)}
                        className={`hover:bg-slate-50/70 transition-all cursor-pointer ${
                          selectedFarmer?.id === f.id ? 'bg-slate-50' : ''
                        } ${isExpanded ? 'bg-slate-50/50' : ''}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFarmerExpand(f.id);
                              }}
                              className="p-1 rounded text-slate-400 hover:bg-slate-200/50 hover:text-slate-600 transition-colors"
                              title="লেনদেনের বিবরণ দেখুন"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>

                            {f.photo_url ? (
                              <img 
                                src={f.photo_url} 
                                alt={f.name} 
                                className="w-8 h-8 rounded-full object-cover border border-slate-200 shadow-sm shrink-0"
                              />
                            ) : (
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ${f.gender === 'female' ? 'bg-pink-400' : 'bg-blue-400'}`}>
                                {f.name.charAt(0).toUpperCase()}
                              </div>
                            )}

                            <div>
                              <div className="font-bold text-slate-950 flex items-center gap-1.5">
                                <span>{f.name}</span>
                                <span className={`text-[10px] px-1 py-0.5 rounded ${f.gender === 'female' ? 'bg-pink-50 text-pink-700' : 'bg-blue-50 text-blue-700'}`}>
                                  {f.gender === 'female' ? 'মহিলা' : 'পুরুষ'}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-450 font-sans flex items-center gap-0.5 mt-0.5">
                                <MapPin className="w-3 h-3" /> {f.village}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 font-mono">
                            <span className="font-semibold text-slate-800">{f.phone}</span>
                            {f.phone && (
                              <a
                                href={`tel:${f.phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="p-1.5 bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-600 rounded-full transition-all duration-150 border border-emerald-100 flex items-center justify-center shrink-0 cursor-pointer shadow-3xs"
                                title={`সরাসরি কল দিন (Call First Num): ${f.phone}`}
                              >
                                <Phone className="w-3.5 h-3.5 fill-current" />
                              </a>
                            )}
                          </div>
                          {f.secondary_phone && (
                            <div className="flex items-center gap-1.5 font-mono mt-1 text-[10px] text-slate-400">
                              <span>২য়: {f.secondary_phone}</span>
                              <a
                                href={`tel:${f.secondary_phone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="p-1 bg-teal-50 hover:bg-teal-600 hover:text-white text-teal-600 rounded-full transition-all duration-150 border border-teal-100 flex items-center justify-center shrink-0 cursor-pointer"
                                title={`২য় নম্বরে কল দিন (Call Second Num): ${f.secondary_phone}`}
                              >
                                <Phone className="w-2.5 h-2.5 fill-current" />
                              </a>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600 max-w-[150px] truncate" title={f.products_sold}>
                          {f.products_sold}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700">
                            {f.commission_rate}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="font-bold text-slate-900">৳{f.total_sales.toLocaleString()}</div>
                          <div className="text-[11px] text-emerald-600 font-bold font-sans">আমাদের লাভ: ৳{f.our_profit.toLocaleString()}</div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="font-bold text-amber-700">৳{f.total_paid.toLocaleString()}</div>
                          <div className="text-[10px] text-slate-400 font-semibold">{f.payment_count} বার পরিশোধ</div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-slate-50/10">
                          <td colSpan={6} className="px-4 py-4 border-t border-b border-slate-100">
                            <div className="space-y-4 rounded-xl border border-slate-200/60 bg-white p-5 shadow-xs">
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                                <div>
                                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                                    <Users className="w-4 h-4 text-emerald-600" />
                                    {f.name} - এর লেনদেন খাতা ও হিসাব (Supplier Ledger)
                                  </h4>
                                  <p className="text-[10px] text-slate-500 mt-0.5 font-sans">
                                    কৃষকের পাওনা হিসাব, প্রদেয় তথ্য এবং সমস্ত লেনদেনের হিস্ট্রি।
                                  </p>
                                </div>

                                <div className="flex flex-wrap gap-3 text-xs font-mono">
                                  <div className="bg-rose-50/50 px-3 py-1.5 rounded-lg border border-rose-100/60">
                                    <span className="text-slate-500 block text-[9px] font-sans font-bold">চলতি বকেয়া / পাওনা (Current Due):</span>
                                    <span className="font-extrabold text-rose-600">৳{Math.max(0, (f.total_sales - f.our_profit) - f.total_paid).toLocaleString()}</span>
                                  </div>
                                  <div className="bg-emerald-50/50 px-3 py-1.5 rounded-lg border border-emerald-100/60">
                                    <span className="text-slate-500 block text-[9px] font-sans font-bold">কৃষকের মোট পাওনা (Total Farmer Share):</span>
                                    <span className="font-extrabold text-emerald-700">৳{Math.max(0, f.total_sales - f.our_profit).toLocaleString()}</span>
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {/* Sub-Table */}
                                <div className="md:col-span-2 space-y-2">
                                  <h5 className="font-bold text-slate-700 text-[10px] uppercase tracking-wider flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5 text-emerald-600" /> লেনদেনের বিবরণী তালিকা (Sub-Table)
                                  </h5>
                                  
                                  <div className="overflow-x-auto border border-slate-100 rounded-lg max-h-72 overflow-y-auto">
                                    <table className="min-w-full divide-y divide-slate-100 text-[11px] font-sans">
                                      <thead className="bg-slate-50 sticky top-0 z-10">
                                        <tr>
                                          <th className="px-3 py-2 text-left font-bold text-slate-500">তারিখ</th>
                                          <th className="px-3 py-2 text-left font-bold text-slate-500">ধরণ</th>
                                          <th className="px-3 py-2 text-right font-bold text-slate-500">পরিমাণ</th>
                                          <th className="px-3 py-2 text-left font-bold text-slate-500 font-sans">রেফারেন্স / পণ্য বিবরণী</th>
                                          <th className="px-3 py-2 text-left font-bold text-slate-500 bh-sans">মন্তব্য</th>
                                          <th className="px-3 py-2 text-center font-bold text-slate-500">অ্যাকশন</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 bg-white">
                                        {combinedTransactions.length === 0 ? (
                                          <tr>
                                            <td colSpan={6} className="px-3 py-8 text-center text-slate-400 italic">এই কৃষকের সাথে কোনো লেনদেনের রেকর্ড নেই।</td>
                                          </tr>
                                        ) : (
                                          combinedTransactions.map((t) => (
                                            <tr key={t.id} className="hover:bg-slate-50/50">
                                              <td className="px-3 py-2.5 text-slate-600 font-mono text-[10px] whitespace-nowrap">
                                                {new Date(t.date).toLocaleDateString()}
                                              </td>
                                              <td className="px-3 py-2.5">
                                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                                  t.type === 'payment' 
                                                    ? 'bg-amber-100 text-amber-800 border border-amber-200/50' 
                                                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200/50'
                                                }`}>
                                                  {t.type === 'payment' ? 'পরিশোধ (Paid)' : 'বিক্রয় (Sale)'}
                                                </span>
                                              </td>
                                              <td className={`px-3 py-2.5 text-right font-bold font-mono ${
                                                t.type === 'payment' ? 'text-amber-700' : 'text-emerald-700'
                                              }`}>
                                                {t.type === 'payment' ? '-' : '+'}৳{t.amount.toLocaleString()}
                                              </td>
                                              <td className="px-3 py-2.5 text-slate-700 font-semibold" title={t.reference}>
                                                <span className="line-clamp-1 max-w-[140px]">{t.reference}</span>
                                              </td>
                                              <td className="px-3 py-2.5 text-slate-500 text-[10px]" title={t.notes}>
                                                <span className="line-clamp-1 max-w-[120px]">{t.notes}</span>
                                              </td>
                                              <td className="px-3 py-2.5 text-center">
                                                {isAdmin ? (
                                                  <button
                                                    type="button"
                                                    onClick={() => t.type === 'payment' ? handleDeletePaymentLog(t.id) : handleDeleteSaleLog(t.id)}
                                                    className="p-1 rounded-md text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
                                                    title="মুছে ফেলুন"
                                                  >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                  </button>
                                                ) : (
                                                  <span className="text-slate-350 italic text-[10px]">অ্যাডমিন অনলি</span>
                                                )}
                                              </td>
                                            </tr>
                                          ))
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>

                                {/* Log payment columns */}
                                <div className="bg-slate-50/60 p-4.5 rounded-xl border border-slate-200/50 flex flex-col justify-between">
                                  <div className="space-y-4">
                                    <div className="border-b border-slate-200 pb-2">
                                      <h5 className="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                                        <Coins className="w-4 h-4 text-amber-600" />
                                        পেমেন্ট এন্ট্রি (Log Payout)
                                      </h5>
                                    </div>

                                    {isAdmin ? (
                                      <form onSubmit={(e) => handleInlinePaymentSubmit(e, f)} className="space-y-3 text-xs">
                                        <div>
                                          <label className="block text-slate-650 font-bold mb-1">পরিশোধের পরিমাণ (Paid BDT) *</label>
                                          <input
                                            type="number"
                                            required
                                            placeholder="যেমন: ৫০০০"
                                            value={paymentAmount || ''}
                                            onChange={(e) => setPaymentAmount(Number(e.target.value))}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-amber-500 font-mono font-bold text-sm"
                                          />
                                        </div>

                                        <div>
                                          <label className="block text-slate-650 font-bold mb-1">প্রদানের তারিখ (Date) *</label>
                                          <input
                                            type="date"
                                            required
                                            value={paymentDate}
                                            onChange={(e) => setPaymentDate(e.target.value)}
                                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white"
                                          />
                                        </div>

                                        <div>
                                          <label className="block text-slate-650 font-bold mb-1">রেফারেন্স / রসিদ নাম্বার *</label>
                                          <input
                                            type="text"
                                            required
                                            placeholder="যেমন: ব্যাংক TXN-4493, রশিদ #৫০"
                                            value={paymentReference}
                                            onChange={(e) => setPaymentReference(e.target.value)}
                                            className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-amber-500 font-mono text-xs font-semibold"
                                          />
                                        </div>

                                        <div>
                                          <label className="block text-slate-650 font-bold mb-1">কোনো মন্তব্য (Optional Notes)</label>
                                          <input
                                            type="text"
                                            placeholder="যেমন: চলতি সপ্তাহের বাকী পরিশোধ"
                                            value={paymentNotes}
                                            onChange={(e) => setPaymentNotes(e.target.value)}
                                            className="w-full px-3 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-none focus:border-amber-500"
                                          />
                                        </div>

                                        <button
                                          type="submit"
                                          className="w-full py-2 px-4 bg-amber-600 hover:bg-amber-500 transition-colors text-white font-extrabold rounded-lg font-mono text-xs tracking-wider"
                                        >
                                          পেমেন্ট লগ করুন (Log Payment)
                                        </button>
                                      </form>
                                    ) : (
                                      <div className="p-4 bg-slate-100 text-slate-400 text-center italic rounded-lg text-xs leading-normal">
                                        শুধুমাত্র অ্যাডমিন পেমেন্ট যোগ করতে পারেন।
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  );
                })}
              </table>
            )}
          </div>
        </div>

        {/* Right 1 Column: Detail Box or Callouts */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 space-y-6">
          {selectedFarmer ? (
            <div className="space-y-5">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  {selectedFarmer.photo_url ? (
                    <img 
                      src={selectedFarmer.photo_url} 
                      alt={selectedFarmer.name}
                      className="w-12 h-12 rounded-full object-cover border border-slate-200 shadow-sm shrink-0" 
                    />
                  ) : (
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${selectedFarmer.gender === 'female' ? 'bg-pink-400' : 'bg-blue-400'}`}>
                      {selectedFarmer.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h3 className="text-base font-bold text-slate-950">{selectedFarmer.name} (কৃষকের কার্ড)</h3>
                    <p className="text-[10px] text-slate-400 font-sans">নিবন্ধন তারিখ: {selectedFarmer.created_at ? new Date(selectedFarmer.created_at).toLocaleDateString() : 'N/A'}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedFarmer(null)}
                  className="p-1 rounded-md text-slate-400 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Basic Fields */}
              <div className="grid grid-cols-2 gap-3.5 bg-slate-50/50 p-3 rounded-lg border border-slate-100 text-xs">
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">মোবাইল (প্রধান/১ম)</span>
                  <div className="flex items-center gap-1.5 mt-0.5 font-mono">
                    <Phone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="font-bold text-slate-950">{selectedFarmer.phone}</span>
                    {selectedFarmer.phone && (
                      <a
                        href={`tel:${selectedFarmer.phone}`}
                        className="p-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors flex items-center justify-center shrink-0 cursor-pointer shadow-3xs"
                        title="সরাসরি কল দিন (Call)"
                      >
                        <Phone className="w-2.5 h-2.5 fill-current" />
                      </a>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">মোবাইল (২য় নাম্বার)</span>
                  {selectedFarmer.secondary_phone ? (
                    <div className="flex items-center gap-1.5 mt-0.5 font-mono">
                      <Phone className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                      <span className="font-bold text-slate-650">{selectedFarmer.secondary_phone}</span>
                      <a
                        href={`tel:${selectedFarmer.secondary_phone}`}
                        className="p-1 bg-teal-500 hover:bg-teal-600 text-white rounded-lg transition-colors flex items-center justify-center shrink-0 cursor-pointer shadow-3xs"
                        title="২য় নম্বরে কল দিন (Call)"
                      >
                        <Phone className="w-2.5 h-2.5 fill-current" />
                      </a>
                    </div>
                  ) : (
                    <span className="block text-slate-350 italic mt-1 bg-slate-100/50 px-1.5 py-0.5 rounded w-fit">দেওয়া নেই</span>
                  )}
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">গ্রাম ও আবাসন</span>
                  <span className="font-semibold text-slate-950 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {selectedFarmer.village}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">লিঙ্গ পরিচিতি</span>
                  <span className="font-semibold text-slate-950 flex items-center gap-1 mt-0.5">
                    {selectedFarmer.gender === 'female' ? 'মহিলা (Female)' : 'পুরুষ (Male)'}
                  </span>
                </div>
                <div className="col-span-2 border-t border-slate-100 pt-2">
                  <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">পণ্যসমূহ বিবরণ (Products)</span>
                  <span className="font-semibold text-slate-800 mt-0.5 block">{selectedFarmer.products_sold || 'বিবরণ নেই'}</span>
                </div>
              </div>

              {/* Core numbers */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide border-b pb-1">হিসাব খাতা সারসংক্ষেপ (Accounting Summary)</h4>
                
                <div className="flex justify-between text-xs items-center">
                  <span className="text-slate-500">মোট বেচাকেনা (টোটাল সেল):</span>
                  <span className="font-bold font-mono text-slate-900">৳{selectedFarmer.total_sales.toLocaleString()}</span>
                </div>

                <div className="flex justify-between text-xs items-center">
                  <span className="text-slate-500">কমিশন রেট (৫% অথবা ১০%):</span>
                  <span className="font-bold font-mono px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">{selectedFarmer.commission_rate}%</span>
                </div>

                <div className="flex justify-between text-xs items-center bg-emerald-50/30 p-2 rounded">
                  <span className="text-slate-600 font-bold">আমাদের মুনাফা (Our Commission):</span>
                  <span className="font-extrabold font-mono text-emerald-700">৳{selectedFarmer.our_profit.toLocaleString()}</span>
                </div>

                <div className="flex justify-between text-xs items-center">
                  <span className="text-slate-500">মোট পরিশোধিত টাকা:</span>
                  <span className="font-bold font-mono text-amber-600">৳{selectedFarmer.total_paid.toLocaleString()}</span>
                </div>

                <div className="flex justify-between text-xs items-center">
                  <span className="text-slate-500">মোট কিস্তি পরিশোধ (বার):</span>
                  <span className="font-bold font-mono text-slate-800">{selectedFarmer.payment_count} বার</span>
                </div>

                <div className="flex justify-between text-xs items-center border-t pt-2 font-bold bg-slate-50 p-2 rounded">
                  <span className="text-slate-700">চূড়ান্ত বকেয়া / পাওনা:</span>
                  <span className="font-mono text-rose-600">৳{Math.max(0, (selectedFarmer.total_sales - selectedFarmer.our_profit) - selectedFarmer.total_paid).toLocaleString()}</span>
                </div>
              </div>

              {/* Actions row */}
              <div className={`grid ${isAdmin ? 'grid-cols-2' : 'grid-cols-1'} gap-2.5 pt-2 border-t`}>
                <button
                  onClick={() => openEditFarmer(selectedFarmer)}
                  className={`py-2 text-xs font-bold rounded-lg border flex items-center justify-center gap-1 cursor-pointer ${
                    isAdmin 
                    ? 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    : 'border-slate-100 text-slate-300 bg-slate-50/50 cursor-not-allowed'
                  }`}
                  disabled={!isAdmin}
                >
                  <Edit3 className="w-3.5 h-3.5 text-slate-500" /> এডিট (Edit)
                </button>
                {isAdmin && (
                  <button
                    onClick={() => handleFarmerDelete(selectedFarmer.id, selectedFarmer.name)}
                    className="py-2 text-xs font-bold rounded-lg border flex items-center justify-center gap-1 cursor-pointer border-rose-100 hover:bg-rose-50 text-rose-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> ডিলিট করুন
                  </button>
                )}

                <button
                  onClick={() => openAddSale(selectedFarmer)}
                  className={`py-2 text-xs font-extrabold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded-lg flex items-center justify-center gap-1 cursor-pointer mt-1 ${isAdmin ? 'col-span-2' : 'col-span-1'}`}
                >
                  <Coins className="w-3.5 h-3.5" /> পণ্য বেচাকেনা করুন (Add Sales Log)
                </button>
              </div>

              {/* Transactions Logs */}
              <div className="space-y-2 border-t pt-2">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">সাম্প্রতিক কার্যকলাপ (Latest Logs)</h4>
                
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {payments.filter(p => p.farmer_id === selectedFarmer.id).map(p => (
                    <div key={p.id} className="text-[11px] bg-slate-50 p-2 rounded border border-slate-100/70 flex justify-between items-center">
                      <div>
                        <span className="font-bold text-amber-700">পরিশোধ: -৳{p.amount.toLocaleString()}</span>
                        {p.notes && <p className="text-[10px] text-slate-500 mt-0.5 font-sans leading-tight">মন্তব্য: {p.notes}</p>}
                      </div>
                      <span className="text-[9px] text-slate-400">{new Date(p.payment_date).toLocaleDateString()}</span>
                    </div>
                  ))}

                  {sales.filter(s => s.farmer_id === selectedFarmer.id).map(s => (
                    <div key={s.id} className="text-[11px] bg-emerald-50/20 p-2 rounded border border-emerald-100/50 flex justify-between items-center">
                      <div>
                        <span className="font-bold text-slate-800">বিক্রয়: +৳{s.amount.toLocaleString()}</span>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">{s.products}</p>
                      </div>
                      <span className="text-[9px] text-slate-400">{new Date(s.sale_date).toLocaleDateString()}</span>
                    </div>
                  ))}

                  {payments.filter(p => p.farmer_id === selectedFarmer.id).length === 0 && 
                   sales.filter(s => s.farmer_id === selectedFarmer.id).length === 0 && (
                    <div className="text-[10px] text-slate-400 py-4 text-center">কোনো কার্যকলাপের রেকর্ড নেই।</div>
                  )}
                </div>
              </div>

            </div>
          ) : (
            <div className="h-full flex flex-col justify-center items-center text-center p-6 space-y-3">
              <div className="h-12 w-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">কৃষকের তথ্য কার্ড</h4>
                <p className="text-xs text-slate-450 mt-1 max-w-[200px] leading-relaxed">যেকোনো কৃষকের লাইনের উপর ক্লিক করুন সম্পূর্ণ হিসাব ও সাম্প্রতিক কার্যকলাপ দেখতে।</p>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* --- ADD FARMER MODAL --- */}
      {showAddFarmerModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full scale-100 transition-all">
            <div className="px-5 py-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-slate-950 text-sm">নতুন কৃষক কার্ড যোগ (Add Farmer Profile)</h3>
              <button
                onClick={() => setShowAddFarmerModal(false)}
                className="p-1 rounded-md text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFarmerSubmit} className="p-5 space-y-4 text-xs font-semibold text-slate-700">
              {farmerError && (
                <div className="p-2.5 bg-rose-50 text-rose-700 font-bold rounded-lg leading-tight border border-rose-100">{farmerError}</div>
              )}

              {/* Photo Upload Area */}
              <div className="flex flex-col items-center justify-center p-3 text-slate-700 bg-slate-50 border border-dashed border-slate-300 rounded-xl space-y-2">
                <label className="text-slate-700 font-bold text-center block mb-0.5">কৃষকের ছবি (Farmer Photo)</label>
                <div className="relative w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center overflow-hidden border border-slate-300 group shadow-inner">
                  {farmerPhotoUrl ? (
                    <>
                      <img src={farmerPhotoUrl} alt="Farmer" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setFarmerPhotoUrl('')}
                        className="absolute inset-0 bg-black/60 text-white text-[9px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                      >
                        মুছে ফেলুন
                      </button>
                    </>
                  ) : (
                    <span className="text-xl text-slate-400">👤</span>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  id="farmer-photo-file-upload-add"
                />
                <label
                  htmlFor="farmer-photo-file-upload-add"
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-[10px] text-slate-705 border border-slate-200 rounded-md shadow-xs cursor-pointer select-none font-bold transition-all"
                >
                  ছবি আপলোড করুন (Upload Image)
                </label>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">কৃষকের নাম (Farmer Name) *</label>
                <input
                  type="text"
                  required
                  placeholder="যেমন: করিম মিয়া, হাসেম আলী"
                  value={farmerName}
                  onChange={(e) => setFarmerName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-emerald-505 focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-705 font-bold mb-1">১ম মোবাইল নম্বর (প্রধান) *</label>
                  <input
                    type="tel"
                    required
                    placeholder="যেমন: 017xxxxxxxx"
                    value={farmerPhone}
                    onChange={(e) => setFarmerPhone(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-emerald-505 focus:border-emerald-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-705 font-bold mb-1">২য় মোবাইল নম্বর (ঐচ্ছিক)</label>
                  <input
                    type="tel"
                    placeholder="যেমন: 018xxxxxxxx"
                    value={farmerSecondaryPhone}
                    onChange={(e) => setFarmerSecondaryPhone(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-emerald-505 focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-705 font-bold mb-1">গ্রামের নাম (Village) *</label>
                  <input
                    type="text"
                    required
                    placeholder="যেমন: রামপুর, খাগড়াবাড়ি"
                    value={farmerVillage}
                    onChange={(e) => setFarmerVillage(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-emerald-505 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-705 font-bold mb-1">লিঙ্গ (Gender) *</label>
                  <select
                    value={farmerGender}
                    onChange={(e) => setFarmerGender(e.target.value as 'male' | 'female')}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-emerald-505 focus:border-emerald-500"
                  >
                    <option value="male">পুরুষ (Male)</option>
                    <option value="female">মহিলা (Female)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-705 font-bold mb-1">মূল কি কি উৎপাদিত পণ্য বিক্রয় করেন (Products Details)</label>
                <input
                  type="text"
                  placeholder="যেমন: দুধ, ধান, পাট, শাকসবজি"
                  value={farmerProducts}
                  onChange={(e) => setFarmerProducts(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-emerald-505 focus:border-emerald-500"
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-lg space-y-3 border border-slate-200/60">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest">লভ্যাংশ ও প্রারম্ভিক তহবিল (Financial setups)</h4>
                
                <div>
                  <label className="block text-slate-700 font-bold mb-1">লভ্যাংশ কমিশন (Profit Percentage)</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="radio"
                        name="commission"
                        checked={farmerCommission === 5}
                        onChange={() => setFarmerCommission(5)}
                      />
                      <span>৫% লভ্যাংশ কমিশন</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="radio"
                        name="commission"
                        checked={farmerCommission === 10}
                        onChange={() => setFarmerCommission(10)}
                      />
                      <span>১০% লভ্যাংশ কমিশন</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-slate-700 mb-1">প্রারম্ভিক বিক্রয়/ক্রয় (টাকা)</label>
                    <input
                      type="number"
                      placeholder="০০.০০"
                      value={initialSales || ''}
                      onChange={(e) => setInitialSales(Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-emerald-550 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 mb-1">প্রারম্ভিক পরিশোধিত (টাকা)</label>
                    <input
                      type="number"
                      placeholder="০০.০০"
                      value={initialPaid || ''}
                      onChange={(e) => setInitialPaid(Number(e.target.value))}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-emerald-555 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddFarmerModal(false)}
                  className="px-4 py-2 hover:bg-slate-100 rounded-lg text-slate-600 font-bold cursor-pointer"
                >
                  বাতিল করুন
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <ArrowRight className="w-4 h-4" /> সংরক্ষিত করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT FARMER MODAL --- */}
      {editingFarmer && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full scale-100 transition-all">
            <div className="px-5 py-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-slate-950 text-sm">কৃষক তথ্য এডিট করুন (Edit Farmer Card)</h3>
              <button
                onClick={() => setEditingFarmer(null)}
                className="p-1 rounded-md text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleFarmerEditSubmit} className="p-5 space-y-4 text-xs font-semibold text-slate-700">
              {/* Photo Upload Area */}
              <div className="flex flex-col items-center justify-center p-3 text-slate-700 bg-slate-50 border border-dashed border-slate-300 rounded-xl space-y-2">
                <label className="text-slate-700 font-bold text-center block mb-0.5">কৃষকের ছবি (Farmer Photo)</label>
                <div className="relative w-16 h-16 bg-slate-200 rounded-full flex items-center justify-center overflow-hidden border border-slate-300 group shadow-inner">
                  {farmerPhotoUrl ? (
                    <>
                      <img src={farmerPhotoUrl} alt="Farmer" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setFarmerPhotoUrl('')}
                        className="absolute inset-0 bg-black/60 text-white text-[9px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                      >
                        মুছে ফেলুন
                      </button>
                    </>
                  ) : (
                    <span className="text-xl text-slate-400">👤</span>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                  id="farmer-photo-file-upload-edit"
                />
                <label
                  htmlFor="farmer-photo-file-upload-edit"
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 text-[10px] text-slate-705 border border-slate-200 rounded-md shadow-xs cursor-pointer select-none font-bold transition-all"
                >
                  ছবি আপলোড করুন (Upload Image)
                </label>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">কৃষকের নাম (Name)</label>
                <input
                  type="text"
                  required
                  value={farmerName}
                  onChange={(e) => setFarmerName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">১ম মোবাইল নম্বর (প্রধান)</label>
                  <input
                    type="tel"
                    required
                    value={farmerPhone}
                    onChange={(e) => setFarmerPhone(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg font-mono"
                    disabled // Main ID / Primary phone index is immutable
                  />
                </div>
                <div>
                  <label className="block text-slate-707 font-bold mb-1">২য় মোবাইল নম্বর</label>
                  <input
                    type="tel"
                    value={farmerSecondaryPhone}
                    onChange={(e) => setFarmerSecondaryPhone(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">গ্রাম ও আবাসন</label>
                  <input
                    type="text"
                    required
                    value={farmerVillage}
                    onChange={(e) => setFarmerVillage(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">লিঙ্গ পরিচিতি</label>
                  <select
                    value={farmerGender}
                    onChange={(e) => setFarmerGender(e.target.value as 'male' | 'female')}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="male">পুরুষ (Male)</option>
                    <option value="female">মহিলা (Female)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">পণ্যসমূহ বিবরণ</label>
                <input
                  type="text"
                  value={farmerProducts}
                  onChange={(e) => setFarmerProducts(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-slate-705 font-bold mb-1">লভ্যাংশ হার কমিশন (Commission Rate)</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="edit-commission"
                      checked={farmerCommission === 5}
                      onChange={() => setFarmerCommission(5)}
                    />
                    <span>৫% লভ্যাংশ</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="edit-commission"
                      checked={farmerCommission === 10}
                      onChange={() => setFarmerCommission(10)}
                    />
                    <span>১০% লভ্যাংশ</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t mt-4">
                <button
                  type="button"
                  onClick={() => setEditingFarmer(null)}
                  className="px-4 py-2 hover:bg-slate-100 rounded-lg text-slate-600 font-bold cursor-pointer"
                >
                  বাতিল করুন
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-bold cursor-pointer"
                >
                  আপডেট করুন (Update)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD PAYMENT MODAL --- */}
      {showAddPaymentModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-sm w-full scale-100 transition-all">
            <div className="px-5 py-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-slate-950 text-sm">নতুন টাকা পরিশোধ (Add Payment out)</h3>
              <button
                onClick={() => setShowAddPaymentModal(false)}
                className="p-1 rounded-md text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="p-5 space-y-4 text-xs font-semibold text-slate-705">
              {paymentError && (
                <div className="p-2.5 bg-rose-50 text-rose-700 font-bold rounded-lg border border-rose-105 leading-tight">{paymentError}</div>
              )}

              <div>
                <label className="block text-slate-700 font-bold mb-1">কৃষক নির্বাচন করুন (Select Farmer) *</label>
                <select
                  value={paymentFarmerId}
                  onChange={(e) => setPaymentFarmerId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-emerald-500"
                >
                  <option value="" disabled>কৃষক চয়েস করুন</option>
                  {farmers.map(f => (
                    <option key={f.id} value={f.id}>{f.name} ({f.phone})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">টাকা পরিশোধের পরিমাণ (Paid Amount - BDT) *</label>
                <input
                  type="number"
                  required
                  placeholder="যেমন: ৩০০০"
                  value={paymentAmount || ''}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-emerald-500 font-mono text-lg font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">পরিশোধের তারিখ (Date) *</label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">রেফারেন্স / ভাউচার নম্বর (Reference / Voucher No)</label>
                <input
                  type="text"
                  placeholder="যেমন: TXN1234567, ক্যাশ ভাউচার #০৫"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">কোনো মন্তব্য (Notes)</label>
                <textarea
                  placeholder="যেমন: এই সপ্তাহে পরিশোধিত নগদ টাকা"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-emerald-550 h-16"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddPaymentModal(false)}
                  className="px-4 py-2 hover:bg-slate-100 rounded-lg text-slate-650 cursor-pointer font-bold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded-lg text-white font-bold cursor-pointer"
                >
                  টাকা পরিশোধ এড করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD SALE MODAL --- */}
      {showAddSaleModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex justify-center items-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-sm w-full scale-100 transition-all">
            <div className="px-5 py-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-slate-950 text-sm">নতুন ক্রয় ও বিক্রয় এন্ট্রি (Add Farmer Sale Log)</h3>
              <button
                onClick={() => setShowAddSaleModal(false)}
                className="p-1 rounded-md text-slate-400 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaleSubmit} className="p-5 space-y-4 text-xs font-semibold text-slate-700">
              {saleError && (
                <div className="p-2.5 bg-rose-50 text-rose-700 font-bold rounded-lg border border-rose-100 leading-tight">{saleError}</div>
              )}

              <div>
                <label className="block text-slate-700 font-bold mb-1">কৃষক নির্বাচন করুন (Select Farmer) *</label>
                <select
                  value={saleFarmerId}
                  onChange={(e) => {
                    setSaleFarmerId(e.target.value);
                    const selected = farmers.find(f => f.id === e.target.value);
                    if (selected) {
                      setSaleProducts(selected.products_sold || '');
                      setSaleCommission(selected.commission_rate || 10);
                    }
                  }}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-emerald-500"
                >
                  <option value="" disabled>কৃষক চয়েস করুন</option>
                  {farmers.map(f => (
                    <option key={f.id} value={f.id}>{f.name} ({f.phone})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">বিক্রয়ের মোট মূল্য (Total Value of sold products - BDT) *</label>
                <input
                  type="number"
                  required
                  placeholder="যেমন: ৫০০০০"
                  value={saleAmount || ''}
                  onChange={(e) => setSaleAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-emerald-500 font-mono text-lg font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-705 font-bold mb-1">পণ্যের বিবরণ (Products description)</label>
                <input
                  type="text"
                  placeholder="যেমন: ২০ লিটার খাটি গরুর দুধ"
                  value={saleProducts}
                  onChange={(e) => setSaleProducts(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-705 font-bold mb-1">লভ্যাংশ শতকরা নির্বাচন করুন *</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="sale-commission"
                      checked={saleCommission === 5}
                      onChange={() => setSaleCommission(5)}
                    />
                    <span>৫% লভ্যাংশ কমিশন</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="radio"
                      name="sale-commission"
                      checked={saleCommission === 10}
                      onChange={() => setSaleCommission(10)}
                    />
                    <span>১০% লভ্যাংশ কমিশন</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-slate-707 font-bold mb-1">তারিখ (Sale Date) *</label>
                <input
                  type="date"
                  required
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              {saleAmount > 0 && (
                <div className="p-3 bg-emerald-50 text-emerald-800 font-bold rounded-lg border border-emerald-100 flex justify-between">
                  <span>আমাদের নির্ধারিত লাভ:</span>
                  <span className="font-mono text-emerald-700">৳{Math.round(saleAmount * (saleCommission / 100)).toLocaleString()}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t mt-4">
                <button
                  type="button"
                  onClick={() => setShowAddSaleModal(false)}
                  className="px-4 py-2 hover:bg-slate-100 rounded-lg text-slate-650 cursor-pointer font-bold"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white font-bold cursor-pointer font-sans"
                >
                  বিক্রয় জমা দিন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={deleteModalConfig.onConfirm}
        title={deleteModalConfig.title}
        message={deleteModalConfig.message}
        itemName={deleteModalConfig.itemName}
      />
    </div>
  );
}

// Inline fallback since we want to avoid import missing trends in lucide-react versions
function TrendingUpIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}
