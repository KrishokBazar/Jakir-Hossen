import { useEffect, useState, FormEvent, useRef } from 'react';
import { dbService, isSupabaseConfigured, supabase } from '../db';
import { Customer, Order, Profile } from '../types';
import { useNotification } from './NotificationContext';
import { canDelete } from '../utils/auth';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { 
  Users, 
  Search, 
  MapPin, 
  Phone, 
  Calendar, 
  TrendingUp, 
  ShoppingBag, 
  X, 
  Edit3, 
  Merge, 
  Trash2, 
  Info, 
  User, 
  RefreshCw,
  FileText,
  Navigation,
  Mic,
  MicOff,
  Camera
} from 'lucide-react';

interface CustomersProps {
  user: Profile;
}

export default function Customers({ user }: CustomersProps) {
  const { showError, showNotification } = useNotification();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

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
          speechLang === 'bn-BD' ? "গ্রাহকের নাম বা ঠিকানাটি বলুন..." : "Speak customer name or address...", 
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
        console.warn("Search dictate error:", event.error);
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
      console.error("Voice search engine load failure:", err);
      setIsDictating(false);
    }
  };

  // Modal / Drawer state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [zoomedOrderPhotoUrl, setZoomedOrderPhotoUrl] = useState<string | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [mergingSource, setMergingSource] = useState<Customer | null>(null);
  const [mergingTargetId, setMergingTargetId] = useState('');

  // Form states for manual profile edits
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');

  // Manual Add Customer Form
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [addAddress, setAddAddress] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const custData = await dbService.getCustomers();
      setCustomers(custData);
      
      const ordData = await dbService.getOrders();
      setOrders(ordData);
    } catch (err) {
      console.error("Error loading customer directories:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    const unsubscribeCustomers = dbService.subscribeCustomers(
      (liveCustomers) => {
        setCustomers(liveCustomers);
      },
      (err) => console.error("Error listening to customers:", err)
    );

    const unsubscribeOrders = dbService.subscribeOrders(
      (liveOrders) => {
        setOrders(liveOrders);
        setLoading(false);
      },
      (err) => {
        console.error("Error listening to orders:", err);
        setLoading(false);
      }
    );

    return () => {
      unsubscribeCustomers();
      unsubscribeOrders();
    };
  }, []);

  const handleManualAddCustomer = async (e: FormEvent) => {
    e.preventDefault();
    setAddError(null);
    if (!addName || !addPhone) {
      setAddError("Name and Phone are required.");
      return;
    }
    try {
      await dbService.addCustomer({
        name: addName.trim(),
        phone: addPhone.trim(),
        address: addAddress.trim() || undefined
      });
      setAddName('');
      setAddPhone('');
      setAddAddress('');
      setShowAddModal(false);
      await loadData();
      showNotification("Success", "Customer profile added successfully!", "success");
    } catch (err: any) {
      setAddError(err.message || "Failed to add customer manually.");
      showError("Failed to add customer", err);
    }
  };

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;

    try {
      await dbService.updateCustomer(editingCustomer.id, {
        name: editName.trim(),
        phone: editPhone.trim(),
        address: editAddress.trim() || undefined,
      });

      setEditingCustomer(null);
      await loadData();
      
      // Update local detailed page state if open
      if (selectedCustomer && selectedCustomer.id === editingCustomer.id) {
        setSelectedCustomer({
          ...selectedCustomer,
          name: editName.trim(),
          phone: editPhone.trim(),
          address: editAddress.trim(),
        });
      }
      showNotification("Success", "Customer profile updated successfully!", "success");
    } catch (err: any) {
      showError("Could not update customer profile", err);
    }
  };

  const handleMergeProfiles = async (e: FormEvent) => {
    e.preventDefault();
    if (!mergingSource || !mergingTargetId) return;

    if (mergingSource.id === mergingTargetId) {
      showNotification("Cannot Merge", "Cannot merge a profile into itself.", "warning");
      return;
    }

    const confirmMerge = confirm(
      `Are you sure you want to merge all records of customer "${mergingSource.name}" into the target customer? This action is irreversible. All order logs will transfer, and the source profile will be deleted.`
    );
    if (!confirmMerge) return;

    try {
      // Perform full safe merge in Firestore
      await dbService.mergeCustomers(mergingSource.id, mergingTargetId);

      setMergingSource(null);
      setMergingTargetId('');
      setSelectedCustomer(null);
      await loadData();

      showNotification("Success", "Customers merged successfully!", "success");
    } catch (err: any) {
      console.error(err);
      showError("Error merging profiles", err);
    }
  };

  const handleDeleteCustomer = (id: string) => {
    if (!canDelete(user)) {
      showNotification("অনুমতি নেই", "দুঃখিত, শুধুমাত্র অ্যাডমিন ডিলিট করতে পারবেন (Only admin can delete).", "warning");
      return;
    }

    const currentCust = customers.find(c => c.id === id);

    setDeleteModalConfig({
      onConfirm: async () => {
        try {
          await dbService.deleteCustomer(id);
          setSelectedCustomer(null);
          await loadData();
          showNotification("Success", "Customer has been deleted successfully.", "success");
        } catch (err: any) {
          showError("Could not remove customer profile", err);
        }
      },
      title: "কাস্টমার প্রোফাইল ডিলিট (Delete Customer Profile)",
      message: "আপনি কি নিশ্চিত যে আপনি এই কাস্টমারটি ডিলিট করতে চান? এর ফলে এই কাস্টমারের সমস্ত হিস্টোরি রিপোর্ট থেকে মুছে যাবে।",
      itemName: currentCust ? `${currentCust.name} (Phone: ${currentCust.phone})` : id
    });
    setDeleteModalOpen(true);
  };

  const handleDeleteOrder = (orderId: string) => {
    if (!canDelete(user)) {
      showNotification("অনুমতি নেই", "দুঃখিত, শুধুমাত্র অ্যাডমিন ডিলিট করতে পারবেন (Only admin can delete).", "warning");
      return;
    }

    const currentOrd = orders.find(o => o.id === orderId);

    setDeleteModalConfig({
      onConfirm: async () => {
        try {
          await dbService.deleteOrder(orderId);
          if (selectedCustomer) {
            const updatedOrders = orders.filter(o => o.id !== orderId);
            const relatedOrders = updatedOrders.filter(o => o.customer_id === selectedCustomer.id);
            const totalAmount = relatedOrders.reduce((sum, o) => sum + o.amount, 0);
            setSelectedCustomer({
              ...selectedCustomer,
              total_orders: relatedOrders.length,
              total_spent: totalAmount,
            });
          }
          showNotification("Success", "Order has been deleted successfully.", "success");
        } catch (err: any) {
          showError("Could not remove order", err);
        }
      },
      title: "অর্ডার ডিলিট নিশ্চিতকরণ (Confirm Order Delete)",
      message: "আপনি কি নিশ্চিত যে আপনি এই অর্ডারটি ডিলিট করতে চান? এই একশন সম্পূর্ণ অপরিবর্তনযোগ্য।",
      itemName: currentOrd ? `Order ID: ${currentOrd.id} - Amount: ৳${currentOrd.amount}` : orderId
    });
    setDeleteModalOpen(true);
  };

  // Filter list by searchQuery
  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery) ||
      (c.address && c.address.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const isAdmin = canDelete(user);
  const isCofounder = user.role === 'cofounder';

  const handleExportCSV = () => {
    if (filteredCustomers.length === 0) {
      showNotification("সতর্কতা", "রপ্তানি করার জন্য কোনো গ্রাহক ডেটা পাওয়া যায়নি।", "warning");
      return;
    }
    const headers = ["ID", "Name", "Phone", "Address", "Total Orders", "Total Spent", "Total Returns", "Last Order Date", "Created At"];
    const csvRows = [
      headers.join(','),
      ...filteredCustomers.map(cust => [
        `"${cust.id}"`,
        `"${cust.name.replace(/"/g, '""')}"`,
        `"${cust.phone}"`,
        `"${(cust.address || '').replace(/"/g, '""')}"`,
        `"${cust.total_orders}"`,
        `"${cust.total_spent}"`,
        `"${cust.total_returns}"`,
        `"${cust.last_order_date || ''}"`,
        `"${cust.created_at}"`
      ].join(','))
    ];

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `customer_list_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification("সফল হয়েছে", "গ্রাহক তালিকা সিএসভি ফাইল হিসেবে ডাউনলোড করা হয়েছে।", "success");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" />
            গ্রাহক তালিকা (Customer Directory)
          </h2>
          <p className="text-xs text-slate-500">View customer lifetime values, total spent, and match operators logs immediately.</p>
        </div>
        
        <div className="flex gap-2 items-center flex-wrap">
          <button
            onClick={loadData}
            title="Refresh database"
            className="p-2.5 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Export customer list button for Admins and Co-founders */}
          {(isAdmin || isCofounder) && (
            <button
              onClick={handleExportCSV}
              className="px-4 py-2.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <FileText className="w-4 h-4 text-emerald-300" /> Export CSV (সিএসভি ডাউনলোড)
            </button>
          )}
          
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <User className="w-4 h-4" /> Adding Customer Manually
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer name, phone number, address..."
            className="block w-full pl-10 pr-12 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1.5 focus:ring-emerald-500 text-sm"
          />
          {speechSupported && (
            <button
              type="button"
              onClick={toggleSpeech}
              className={`absolute right-2 top-1.5 px-2.5 py-1.5 rounded-lg transition-all duration-200 cursor-pointer flex items-center justify-center shrink-0 active:scale-95 ${
                isDictating
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'text-slate-400 hover:text-emerald-600 hover:bg-slate-50'
              }`}
              title={isDictating ? "Stop Voice Search" : "Voice Search (ভয়েস সার্চ)"}
            >
              {isDictating ? (
                <MicOff className="w-4.5 h-4.5" />
              ) : (
                <Mic className="w-4.5 h-4.5" />
              )}
            </button>
          )}
        </div>
        
        {speechSupported && (
          <div className="flex items-center gap-1.5 self-start sm:self-center bg-slate-50 border border-slate-200 p-1 rounded-xl text-xs shrink-0 shadow-3xs select-none">
            <span className="text-slate-500 px-1 text-[11px] font-medium font-mono">LANG:</span>
            <button
              type="button"
              onClick={() => setSpeechLang('bn-BD')}
              className={`px-3 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                speechLang === 'bn-BD'
                  ? 'bg-emerald-600 text-white shadow-3xs'
                  : 'text-slate-600 hover:text-slate-900 bg-transparent'
              }`}
            >
              বাংলা (BN)
            </button>
            <button
              type="button"
              onClick={() => setSpeechLang('en-US')}
              className={`px-3 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-all ${
                speechLang === 'en-US'
                  ? 'bg-emerald-600 text-white shadow-3xs'
                  : 'text-slate-600 hover:text-slate-900 bg-transparent'
              }`}
            >
              ENG (US)
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-emerald-600 border-t-transparent" />
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-200 p-12 text-center">
          <Users className="w-12 h-12 text-slate-350 mx-auto mb-3" />
          <h3 className="text-slate-900 font-bold">No customers match your search</h3>
          <p className="text-slate-500 text-xs max-w-md mx-auto mt-1">
            New customers are registered automatically upon entering an order. You can also manually add a placeholder profile using the button above.
          </p>
        </div>
      ) : (
        /* Customer Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCustomers.map((cust) => (
            <div
              key={cust.id}
              onClick={() => setSelectedCustomer(cust)}
              className="bg-white hover:bg-slate-50/50 p-5 rounded-xl border border-slate-200/80 shadow-xs hover:border-emerald-500/20 transition-all duration-200 cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0 pr-2">
                    <h3 className="font-bold text-slate-900 line-clamp-1">{cust.name}</h3>
                    <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-sm font-mono inline-block mt-0.5">
                      ID: {cust.id.slice(-5)}
                    </span>
                  </div>
                  {cust.phone && (
                    <a
                      href={`tel:${cust.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 bg-emerald-50 hover:bg-emerald-600 group hover:text-white text-emerald-600 rounded-full transition-all duration-150 border border-emerald-100 shadow-xs flex items-center justify-center shrink-0 cursor-pointer hover:scale-105 active:scale-95"
                      title="সরাসরি কল দিন (Call)"
                    >
                      <Phone className="w-3.5 h-3.5 fill-emerald-100 group-hover:fill-emerald-800 transition-colors" />
                    </a>
                  )}
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 mb-4">
                  <div className="flex items-center gap-1.5 font-mono">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {cust.phone}
                  </div>
                  {cust.address && (
                    <div className="flex items-center gap-1.5 line-clamp-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {cust.address}
                    </div>
                  )}
                  {cust.last_order_date && (
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Last: {new Date(cust.last_order_date).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Aggregated Figures */}
              <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1">
                  <ShoppingBag className="w-3.5 h-3.5 text-slate-450" />
                  <span>Orders: <span className="font-mono font-bold text-slate-800">{cust.total_orders}</span></span>
                </div>
                <div className="flex items-center gap-1 font-mono">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-555" />
                  <span className="font-sans text-slate-500">Spent:</span>
                  <span className="font-bold text-emerald-600">৳{cust.total_spent.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Customer Record Detail View Drawer (Modal) */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm flex justify-end z-50">
          <div className="w-full max-w-2xl bg-white h-screen overflow-y-auto shadow-2xl p-6 flex flex-col justify-between">
            <div>
              {/* Drawer Title Bar */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
                <h3 className="text-lg font-bold text-slate-900">গ্রাহক বিবরণ ও ইতিহাস (Detailed Customer Hub)</h3>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Profile Card Summary */}
              <div className="bg-slate-900 text-white p-5 rounded-2xl relative overflow-hidden mb-6">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-lg font-bold text-white">{selectedCustomer.name}</h4>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <p className="text-xs text-slate-300 font-mono flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5" /> {selectedCustomer.phone}
                      </p>
                      {selectedCustomer.phone && (
                        <a
                          href={`tel:${selectedCustomer.phone}`}
                          className="inline-flex items-center gap-1 bg-emerald-550 hover:bg-emerald-600 text-white text-[10px] font-extrabold px-2.5 py-1 rounded-lg transition-colors cursor-pointer shadow-xs border border-emerald-500/30"
                          title="সরাসরি কল করুন (Call Now)"
                        >
                          <Phone className="w-3 h-3 fill-current text-white" />
                          <span>সরাসরি কল দিন (Call)</span>
                        </a>
                      )}
                    </div>
                    {selectedCustomer.address && (
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                        <MapPin className="w-3.5 h-3.5 shrink-0" /> {selectedCustomer.address}
                      </p>
                    )}
                  </div>

                  <div className="border-t border-dashed border-slate-700/60 md:border-none pt-2.5 md:pt-0 shrink-0 font-mono flex gap-4 text-xs">
                    <div className="text-center bg-slate-800/40 px-3.5 py-2 rounded-xl border border-slate-700/35">
                      <div className="text-[10px] uppercase font-sans text-slate-400 font-semibold mb-1">Orders</div>
                      <div className="text-sm font-bold text-emerald-400">{selectedCustomer.total_orders}</div>
                    </div>
                    <div className="text-center bg-slate-800/40 px-3.5 py-2 rounded-xl border border-slate-700/35">
                      <div className="text-[10px] uppercase font-sans text-slate-400 font-semibold mb-1">Tot Spend</div>
                      <div className="text-sm font-bold text-emerald-400">৳{selectedCustomer.total_spent.toLocaleString()}</div>
                    </div>
                    <div className="text-center bg-slate-800/40 px-3.5 py-2 rounded-xl border border-slate-700/35">
                      <div className="text-[10px] uppercase font-sans text-slate-400 font-semibold mb-1">Returns</div>
                      <div className="text-sm font-bold text-rose-450">{selectedCustomer.total_returns}</div>
                    </div>
                  </div>
                </div>
                <div className="absolute right-0 bottom-0 top-0 w-1/4 opacity-5 flex items-center justify-end pr-4 pointer-events-none">
                  <Users className="w-32 h-32" />
                </div>
              </div>

              {/* Admin Profile Controls */}
              {isAdmin && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 mb-6 flex flex-wrap gap-2.5">
                  <button
                    onClick={() => {
                      setEditName(selectedCustomer.name);
                      setEditPhone(selectedCustomer.phone);
                      setEditAddress(selectedCustomer.address || '');
                      setEditingCustomer(selectedCustomer);
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-slate-350 bg-white hover:bg-slate-50 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-slate-500" /> Edit Address/Info
                  </button>

                  {isAdmin && (
                    <button
                      onClick={() => {
                        setMergingSource(selectedCustomer);
                      }}
                      className="px-3 py-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-900 border border-emerald-200 bg-white hover:bg-emerald-50 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <Merge className="w-3.5 h-3.5 text-emerald-500" /> Merge duplicates
                    </button>
                  )}

                  {isAdmin && (
                    <button
                      onClick={() => handleDeleteCustomer(selectedCustomer.id)}
                      className="px-3 py-1.5 text-xs font-bold text-rose-700 hover:text-rose-900 border border-rose-200 bg-white hover:bg-rose-50 rounded-lg flex items-center gap-1 cursor-pointer transition-colors ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" /> Delete Profile
                    </button>
                  )}
                </div>
              )}

              {/* Order History Log */}
              <h4 className="font-bold text-slate-800 text-sm mb-3">Order History (অর্ডার ইতিহাস)</h4>
              
              <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
                {orders.filter((o) => o.customer_id === selectedCustomer.id).length === 0 ? (
                  <p className="text-xs text-slate-400 bg-slate-50 p-4 rounded-xl text-center">No orders have been recorded for this customer account.</p>
                ) : (
                  orders
                    .filter((o) => o.customer_id === selectedCustomer.id)
                    .map((ord) => (
                      <div key={ord.id} className="bg-slate-50 p-3.5 rounded-xl border border-slate-100/80 font-mono text-xs flex flex-wrap justify-between items-center gap-3">
                        <div className="space-y-1">
                          <div className="flex gap-2 items-center">
                            <span className={`px-1.5 py-0.5 rounded-xs text-[10px] uppercase font-sans font-extrabold ${ord.status === 'delivery' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                              {ord.status}
                            </span>
                            <span className="font-bold text-slate-900">
                              {ord.amount < 0 ? `-৳${Math.abs(ord.amount).toLocaleString()}` : `৳${ord.amount.toLocaleString()}`}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-sans">
                            Date: {new Date(ord.order_date).toLocaleString()}
                          </div>
                          {ord.notes && (
                            <div className="text-[11px] text-slate-500 italic font-sans">
                              "{ord.notes}"
                            </div>
                          )}
                          {ord.gps_location && (
                            <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-lg font-sans w-fit border border-emerald-100/60 max-w-[240px] truncate" title={ord.gps_location}>
                              <Navigation className="w-2.5 h-2.5 text-emerald-600 animate-pulse shrink-0" />
                              <span className="truncate">GPS: {ord.gps_location}</span>
                            </div>
                          )}
                          {ord.photo_url && (
                            <div className="mt-1.5">
                              <button
                                type="button"
                                onClick={() => setZoomedOrderPhotoUrl(ord.photo_url || null)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 rounded-sm text-[10px] font-sans font-medium cursor-pointer transition-colors"
                              >
                                <Camera className="w-3 h-3 text-emerald-600" />
                                <span>ছবি দেখুন (View Voucher)</span>
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-[10px] text-slate-405 font-sans">Profit Weight</div>
                            <div className={`font-bold ${ord.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              ৳{ord.profit.toLocaleString()}
                            </div>
                            {ord.operator_name && (
                              <div className="text-[9px] text-slate-400 font-sans mt-0.5">
                                Agent: {ord.operator_name}
                              </div>
                            )}
                          </div>

                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDeleteOrder(ord.id)}
                              className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                              title="Delete Order (মুছে ফেলুন)"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-450" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 pt-4 flex gap-3 text-xs mt-6">
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg font-bold text-slate-600 hover:bg-slate-50 cursor-pointer text-center"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <form onSubmit={handleManualAddCustomer} className="bg-white w-full max-w-md rounded-xl shadow-2xl p-6 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-150 pb-3 mb-4">
              <h3 className="font-bold text-slate-900">নতুন গ্রাহক তৈরি (Manual Add Customer)</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="p-1 text-slate-400 hover:bg-slate-100 rounded-md">
                <X className="w-5 h-5" />
              </button>
            </div>

            {addError && (
              <div className="mb-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs p-2.5 rounded-lg">
                {addError}
              </div>
            )}

            <div className="space-y-3 p-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="e.g., Mukhlesur Rahman"
                  className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-sm focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number *</label>
                <input
                  type="text"
                  value={addPhone}
                  onChange={(e) => setAddPhone(e.target.value)}
                  placeholder="e.g., 01712345678"
                  className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-sm focus:ring-1 focus:ring-emerald-500 font-sans"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Address (Address)</label>
                <input
                  type="text"
                  value={addAddress}
                  onChange={(e) => setAddAddress(e.target.value)}
                  placeholder="e.g., Kaliganj, Satkhira"
                  className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-sm focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end border-t border-slate-100 pt-3 mt-4">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg font-bold text-slate-500 hover:bg-slate-50 text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs cursor-pointer"
              >
                Create Customer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Profile Modification Editor (Admin Only Modal) */}
      {editingCustomer && (
        <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <form onSubmit={handleEditSubmit} className="bg-white w-full max-w-md rounded-xl shadow-2xl p-6 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-150 pb-3 mb-4">
              <h3 className="font-bold text-slate-900">সম্পাদনা (Edit Customer Record)</h3>
              <button
                type="button"
                onClick={() => setEditingCustomer(null)}
                className="p-1 text-slate-400 hover:bg-slate-100 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-850 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Match Key</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-850 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Shipping Route Address</label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-850 text-sm"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end border-t border-slate-100 pt-3 mt-4">
              <button
                type="button"
                onClick={() => setEditingCustomer(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg font-bold text-slate-500 hover:bg-slate-50 text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Duplicate Merging Interface Modal (Admin Only) */}
      {mergingSource && (
        <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm flex justify-center items-center p-4 z-50">
          <form onSubmit={handleMergeProfiles} className="bg-white w-full max-w-md rounded-xl shadow-2xl p-6 border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-150 pb-3 mb-4">
              <h3 className="font-bold text-slate-900 flex items-center gap-1">
                <Merge className="w-5 h-5 text-emerald-600" />
                গ্রাহক মার্জ করুন (Merge Duplicate Customer)
              </h3>
              <button
                type="button"
                onClick={() => setMergingSource(null)}
                className="p-1 text-slate-400 hover:bg-slate-100 rounded-md cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-250 text-amber-900 p-3.5 rounded-lg text-xs flex gap-2 mb-4 leading-normal">
              <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                Merging will move all historical orders from <b>{mergingSource.name}</b> to a target profile. 
                The current source profile will then be safely deleted.
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Source Profile (To Be Deleted)
                </label>
                <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-lg text-xs font-semibold text-slate-700">
                  {mergingSource.name} (Phone: {mergingSource.phone})
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Select Target Profile (Destination)
                </label>
                <select
                  value={mergingTargetId}
                  onChange={(e) => setMergingTargetId(e.target.value)}
                  className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-850 text-sm focus:ring-1 focus:ring-emerald-500"
                  required
                >
                  <option value="">-- Choose target profile --</option>
                  {customers
                    .filter((c) => c.id !== mergingSource.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.phone})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 justify-end border-t border-slate-100 pt-3 mt-4">
              <button
                type="button"
                onClick={() => setMergingSource(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg font-bold text-slate-500 hover:bg-slate-50 text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!mergingTargetId}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg font-bold text-xs cursor-pointer"
              >
                Complete Merge
              </button>
            </div>
          </form>
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

      {/* Zoomed Photo Lightbox Modal */}
      {zoomedOrderPhotoUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm select-none"
          onClick={() => setZoomedOrderPhotoUrl(null)}
        >
          <div 
            className="relative bg-white/5 border border-white/10 rounded-2xl p-2.5 max-w-lg w-full flex flex-col items-center shadow-2xl transition-transform duration-300 transform scale-102"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setZoomedOrderPhotoUrl(null)}
              className="absolute top-4 right-4 p-2 bg-slate-900/60 text-white hover:text-red-400 hover:scale-105 active:scale-95 rounded-full shadow-lg border border-slate-700/50 backdrop-blur-xs transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-full max-h-[75vh] rounded-xl overflow-hidden bg-slate-900/40 border border-slate-750 flex items-center justify-center">
              <img 
                src={zoomedOrderPhotoUrl} 
                alt="Zoomed voucher document" 
                className="max-w-full max-h-[72vh] object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="mt-3.5 text-center text-xs text-slate-300 font-sans tracking-wide">
              (অর্ডার রশিদ / সংযুক্ত ছবি) Click outside or tap close.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
