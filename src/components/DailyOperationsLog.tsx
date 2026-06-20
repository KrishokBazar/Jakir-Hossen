import { useEffect, useState, FormEvent, useRef } from 'react';
import { dbService } from '../db';
import { DailyLog, Profile } from '../types';
import { useNotification } from './NotificationContext';
import { canDelete } from '../utils/auth';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { 
  ClipboardList, 
  Search, 
  PlusCircle, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  Trash2, 
  Edit3, 
  Check, 
  Wrench, 
  UserCheck, 
  FileText, 
  Truck, 
  HelpCircle, 
  ArrowRight,
  Filter,
  Mic,
  MicOff
} from 'lucide-react';

interface DailyOperationsLogProps {
  user: Profile;
}

export default function DailyOperationsLog({ user }: DailyOperationsLogProps) {
  const { showError, showNotification } = useNotification();
  const [logs, setLogs] = useState<DailyLog[]>([]);
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

  // Search & Filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEventType, setSelectedEventType] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All'); // 'All', 'Active', 'Resolved'

  // Modal / Form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [eventType, setEventType] = useState<DailyLog['event_type']>('General Note');
  const [description, setDescription] = useState('');
  const [resolved, setResolved] = useState(false);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit / Resolve State
  const [editingLog, setEditingLog] = useState<DailyLog | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editResolved, setEditResolved] = useState(false);
  const [editResolutionNotes, setEditResolutionNotes] = useState('');

  // Web Speech API integration states
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

  const toggleSpeechRecognition = (fieldName: 'description' | 'resolutionNotes' | 'editDescription' | 'editResolutionNotes') => {
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
          if (fieldName === 'description') {
            setDescription(prev => prev ? `${prev} ${finalVal}` : finalVal);
            showNotification("প্রাপ্ত তথ্য যুক্ত করা হয়েছে", finalVal, "success");
          } else if (fieldName === 'resolutionNotes') {
            setResolutionNotes(prev => prev ? `${prev} ${finalVal}` : finalVal);
            showNotification("প্রাপ্ত তথ্য যুক্ত করা হয়েছে", finalVal, "success");
          } else if (fieldName === 'editDescription') {
            setEditDescription(prev => prev ? `${prev} ${finalVal}` : finalVal);
            showNotification("প্রাপ্ত তথ্য যুক্ত করা হয়েছে", finalVal, "success");
          } else if (fieldName === 'editResolutionNotes') {
            setEditResolutionNotes(prev => prev ? `${prev} ${finalVal}` : finalVal);
            showNotification("প্রাপ্ত তথ্য যুক্ত করা হয়েছে", finalVal, "success");
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

  // Subscribe to real-time operations log data
  useEffect(() => {
    setLoading(true);
    const unsubscribe = dbService.subscribeDailyLogs(
      (liveLogs) => {
        setLogs(liveLogs);
        setLoading(false);
      },
      (err) => {
        console.error("Error subscribing to daily logs:", err);
        showError("লগ ডেটা লোড করতে সমস্যা হয়েছে", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [showError]);

  // Handle Form submission
  const handleAddLog = async (e: FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      showNotification("সতর্কতা", "লগের বর্ণনা খালি রাখা যাবে না।", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const logId = `log_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const newLog: DailyLog = {
        id: logId,
        date: eventDate,
        operator_id: user.id,
        operator_name: user.name,
        event_type: eventType,
        description: description.trim(),
        resolved,
        created_at: new Date().toISOString(),
        ...(resolved ? { resolution_notes: resolutionNotes.trim() } : {})
      };

      await dbService.addDailyLog(newLog);
      
      showNotification("সফল হয়েছে", "অপারেশন লগ সফলভাবে লিপিবদ্ধ করা হয়েছে।", "success");
      
      // Reset State
      setDescription('');
      setResolved(false);
      setResolutionNotes('');
      setEventDate(new Date().toISOString().split('T')[0]);
      setEventType('General Note');
      setShowAddModal(false);
    } catch (err: any) {
      showError("লগ যুক্ত করতে সমস্যা হয়েছে", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Editing
  const handleUpdateLog = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingLog) return;
    if (!editDescription.trim()) {
      showNotification("সতর্কতা", "লগের বর্ণনা খালি রাখা যাবে না।", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      const updates: Partial<DailyLog> = {
        description: editDescription.trim(),
        resolved: editResolved,
        resolution_notes: editResolved ? editResolutionNotes.trim() : ""
      };

      await dbService.updateDailyLog(editingLog.id, updates);
      showNotification("সফল হয়েছে", "অপারেশন লগ আপডেট করা হয়েছে।", "success");
      setEditingLog(null);
    } catch (err: any) {
      showError("লগ আপডেট করতে সমস্যা হয়েছে", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle resolution status quickly
  const handleQuickResolve = async (log: DailyLog) => {
    try {
      await dbService.updateDailyLog(log.id, {
        resolved: !log.resolved,
        resolution_notes: !log.resolved ? "সমস্যা সমাধান করা হয়েছে (Quick resolved)" : ""
      });
      showNotification(
        "আপডেট করা হয়েছে", 
        log.resolved ? "লগটি পুনরায় সক্রিয় করা হয়েছে।" : "লগটি সমাধান করা হয়েছে চিহ্নিত করা হয়েছে।",
        "success"
      );
    } catch (err: any) {
      showError("স্ট্যাটাস পরিবর্তন করতে সমস্যা হয়েছে", err);
    }
  };

  // Handle Deleting (Admin only)
  const handleDeleteLog = (id: string) => {
    if (!isAdmin) {
      showNotification("অনুমতি নেই", "দুঃখিত, শুধুমাত্র অ্যাডমিন ডিলিট করতে পারবেন (Only admin can delete).", "warning");
      return;
    }

    const currentLog = logs.find(l => l.id === id);

    setDeleteModalConfig({
      onConfirm: async () => {
        try {
          await dbService.deleteDailyLog(id);
          showNotification("ডিলিট করা হয়েছে", "অপারেশন লগ ডিলিট করা হয়েছে।", "success");
        } catch (err: any) {
          showError("লগ ডিলিট করতে সমস্যা হয়েছে", err);
        }
      },
      title: "অপারেশন লগ ডিলিট নিশ্চিতকরণ (Confirm Operation Log Delete)",
      message: "আপনি কি নিশ্চিত যে আপনি এই অপারেশন লগটি ডিলিট করতে চান? এই একশন সম্পূর্ণ অপরিবর্তনযোগ্য।",
      itemName: currentLog ? `Type: ${currentLog.event_type} - Description: ${currentLog.description}` : id
    });
    setDeleteModalOpen(true);
  };

  // Helper to get Event Type visual badges & styling
  const getEventBadgeStyles = (type: DailyLog['event_type']) => {
    switch (type) {
      case 'Equipment Maintenance':
        return {
          bg: 'bg-amber-100 text-amber-800 border-amber-200',
          darkBg: 'bg-amber-500',
          icon: Wrench,
          labelBn: 'যন্ত্রপাতি রক্ষণাবেক্ষণ',
          labelEn: 'Equipment Maintenance'
        };
      case 'Visitor Check-in':
        return {
          bg: 'bg-blue-100 text-blue-800 border-blue-200',
          darkBg: 'bg-blue-600',
          icon: UserCheck,
          labelBn: 'দর্শনার্থী চেক-ইন',
          labelEn: 'Visitor Check-in'
        };
      case 'Site Incident':
        return {
          bg: 'bg-rose-100 text-rose-800 border-rose-200 animate-pulse',
          darkBg: 'bg-rose-600',
          icon: AlertTriangle,
          labelBn: 'সাইট দুর্ঘটনা/সমস্যা',
          labelEn: 'Site Incident'
        };
      case 'Supply Delivery':
        return {
          bg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          darkBg: 'bg-emerald-600',
          icon: Truck,
          labelBn: 'সরবরাহ ডেলিভারি',
          labelEn: 'Supply Delivery'
        };
      case 'General Note':
        return {
          bg: 'bg-slate-100 text-slate-800 border-slate-200',
          darkBg: 'bg-slate-600',
          icon: FileText,
          labelBn: 'সাধারণ দ্রষ্টব্য',
          labelEn: 'General Note'
        };
      default:
        return {
          bg: 'bg-purple-100 text-purple-800 border-purple-200',
          darkBg: 'bg-purple-600',
          icon: HelpCircle,
          labelBn: 'অন্যান্য',
          labelEn: 'Other'
        };
    }
  };

  // Filter logs list based on user selections
  const filteredLogs = logs.filter((log) => {
    // 1. Text Search query matching description, type, or operator name
    const matchText = 
      log.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.operator_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.event_type.toLowerCase().includes(searchQuery.toLowerCase());
    
    // 2. Event type dropdown filter
    const matchType = selectedEventType === 'All' || log.event_type === selectedEventType;

    // 3. Status filter
    let matchStatus = true;
    if (selectedStatus === 'Active') matchStatus = !log.resolved;
    if (selectedStatus === 'Resolved') matchStatus = log.resolved;

    return matchText && matchType && matchStatus;
  });

  const isAdmin = canDelete(user);
  const isCofounder = user.role === 'cofounder';

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      showNotification("সতর্কতা", "রপ্তানি করার জন্য কোনো ডাটা পাওয়া যায়নি।", "warning");
      return;
    }
    const headers = ["ID", "Date", "Operator", "Event Type", "Description", "Status", "Resolution Notes", "Created At"];
    const csvRows = [
      headers.join(','),
      ...filteredLogs.map(log => [
        `"${log.id}"`,
        `"${log.date}"`,
        `"${log.operator_name.replace(/"/g, '""')}"`,
        `"${log.event_type}"`,
        `"${log.description.replace(/"/g, '""')}"`,
        `"${log.resolved ? 'Resolved' : 'Active'}"`,
        `"${(log.resolution_notes || '').replace(/"/g, '""')}"`,
        `"${log.created_at}"`
      ].join(','))
    ];
    
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `daily_operations_log_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification("সফল হয়েছে", "অপারেশন লগ সিএসভি ফাইল হিসেবে ডাউনলোড করা হয়েছে।", "success");
  };

  return (
    <div id="daily-operations-log-view" className="space-y-6">
      
      {/* Header and Banner Section */}
      <div className="bg-white border border-bento-border rounded-bento p-6 shadow-bento flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="h-9 w-9 rounded-lg bg-bento-primary/10 flex items-center justify-center text-bento-primary">
              <ClipboardList className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-800">
              দৈনিক অপারেশন লগ <span className="text-bento-primary font-light text-sm tracking-wide block sm:inline sm:ml-2">| Daily Operations Log</span>
            </h1>
          </div>
          <p className="text-xs text-bento-muted max-w-xl">
            সাইটের বিভিন্ন ক্ষুদ্র ঘটনা, যন্ত্রপাতি বা মেশিনারি মেরামত, দর্শনার্থী বা পরিদর্শকদের আগমন এবং সাধারণ অপারেশনাল ইভেন্টগুলো এখানে ঝটপট নথিভুক্ত করে রাখুন।
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5 items-center">
          {/* CSV Export Button for Admins and Co-founders */}
          {(isAdmin || isCofounder) && (
            <button
              onClick={handleExportCSV}
              className="flex items-center justify-center gap-2 px-5 py-3 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-bento shadow-bento select-none cursor-pointer transition-all duration-200 border-b-2 border-b-teal-800"
            >
              <FileText className="w-4.5 h-4.5 text-emerald-300" />
              <span>CSV ডাউলোড (Export CSV)</span>
            </button>
          )}

          {/* Create Button */}
          <button
            onClick={() => {
              setEventDate(new Date().toISOString().split('T')[0]);
              setShowAddModal(true);
            }}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-bento-primary hover:bg-bento-primary/95 text-white text-xs font-bold rounded-bento shadow-bento select-none cursor-pointer transition-all duration-200 border-b-2 border-b-bento-primary-dark/40"
          >
            <PlusCircle className="w-4.5 h-4.5 text-bento-accent" />
            <span>নতুন লগ এন্ট্রি (Add Log)</span>
          </button>
        </div>
      </div>

      {/* Filter and Control Center */}
      <div className="bg-white border border-bento-border rounded-bento p-4 shadow-bento space-y-3.5">
        <div className="flex flex-col md:flex-row gap-3">
          
          {/* Search Field */}
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="বর্ণনা বা অপারেটরের নাম দিয়ে খুঁজুন... (Search logs...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs font-sans pl-10 pr-4 py-3 bg-bento-bg text-slate-700 placeholder-slate-400 rounded-bento border border-bento-border focus:outline-none focus:ring-1 focus:ring-bento-primary focus:bg-white transition-all duration-200"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {/* Event Type select filter */}
          <div className="w-full md:w-56">
            <select
              value={selectedEventType}
              onChange={(e) => setSelectedEventType(e.target.value)}
              className="w-full text-xs px-4 py-3 bg-bento-bg rounded-bento border border-bento-border focus:outline-none focus:ring-1 focus:ring-bento-primary focus:bg-white select-none text-slate-700 font-bold"
            >
              <option value="All">সকল ইভেন্ট ক্যাটাগরি (All Types)</option>
              <option value="Equipment Maintenance">যন্ত্রপাতি রক্ষণাবেক্ষণ (Maintenance)</option>
              <option value="Visitor Check-in">দর্শনার্থী চেক-ইন (Visitor)</option>
              <option value="Site Incident">সাইট দুর্ঘটনা/সমস্যা (Incident)</option>
              <option value="Supply Delivery">সরবরাহ ডেলিভারি (Delivery)</option>
              <option value="General Note">সাধারণ দ্রষ্টব্য (Note)</option>
              <option value="Other">অন্যান্য (Other)</option>
            </select>
          </div>

          {/* Status select filter */}
          <div className="w-full md:w-48">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full text-xs px-4 py-3 bg-bento-bg rounded-bento border border-bento-border focus:outline-none focus:ring-1 focus:ring-bento-primary focus:bg-white select-none text-slate-700 font-bold"
            >
              <option value="All">সকল রেজল্যুশন স্ট্যাটাস (All States)</option>
              <option value="Active">সমাধান প্রয়োজন (Action Needed)</option>
              <option value="Resolved">সমাধান সম্পন্ন (Resolved)</option>
            </select>
          </div>

        </div>

        {/* Count summary indicators */}
        <div className="flex items-center justify-between text-[11px] font-mono text-bento-muted border-t border-bento-border pt-3 select-none">
          <div>
            দেখাচ্ছে: <span className="font-bold text-bento-primary">{filteredLogs.length}</span> টি লগ (সর্বমোট: {logs.length})
          </div>
          <div className="flex gap-4">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-rose-500"></span> 
              সক্রিয়: {logs.filter(l => !l.resolved).length}
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500"></span> 
              সম্পন্ন: {logs.filter(l => l.resolved).length}
            </span>
          </div>
        </div>
      </div>

      {/* Main Logs View Area */}
      {loading ? (
        <div className="bg-white border border-bento-border rounded-bento p-12 text-center shadow-bento">
          <Clock className="w-8 h-8 animate-spin text-bento-primary mx-auto mb-3" />
          <p className="text-xs text-bento-muted font-bold">সার্ভার থেকে অপারেশন তথ্য লোড হচ্ছে...</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="bg-white border border-bento-border rounded-bento p-12 text-center shadow-bento space-y-2">
          <div className="text-4xl">🗒️</div>
          <p className="text-sm font-bold text-slate-700">কোনো লগ রেকর্ড পাওয়া যায়নি!</p>
          <p className="text-xs text-bento-muted max-w-sm mx-auto">
            আপনার ফিল্টার পরিবর্তন করে দেখুন অথবা উপরে <strong>"নতুন লগ এন্ট্রি"</strong> বাটনে ক্লিক করে প্রথম অপারেশন লগটি লিপিবদ্ধ করুন।
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredLogs.map((log) => {
            const badge = getEventBadgeStyles(log.event_type);
            const IconComponent = badge.icon;
            
            return (
              <div 
                key={log.id} 
                className={`bg-white border rounded-bento shadow-bento hover:shadow-md transition-all duration-200 overflow-hidden ${
                  log.resolved ? 'border-bento-border' : 'border-rose-200 ring-1 ring-rose-50/50'
                }`}
              >
                {/* Log Header Section */}
                <div className="px-5 py-4 flex flex-wrap md:flex-nowrap items-start justify-between gap-3 border-b border-bento-border bg-bento-bg/30">
                  
                  {/* Category and Operator Identity */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border ${badge.bg}`}>
                      <IconComponent className="w-3.5 h-3.5" />
                      <span>{badge.labelBn}</span>
                      <span className="text-[9px] opacity-70 font-mono font-medium hidden sm:inline">({badge.labelEn})</span>
                    </span>

                    {/* Resolution Status Indicator */}
                    {log.resolved ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-semibold">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span>সমাধান হয়েছে (Resolved)</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-100 rounded-full text-[10px] font-semibold animate-pulse">
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                        <span>অপেক্ষারত (Action Needed)</span>
                      </span>
                    )}

                    <span className="text-[11px] font-mono text-bento-muted flex items-center gap-1 ml-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {log.date}
                    </span>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-1.5 self-end md:self-auto">
                    
                    {/* Resolve toggle */}
                    <button
                      onClick={() => handleQuickResolve(log)}
                      title={log.resolved ? "সমাধান নাকচ করুন" : "সমাধান সম্পন্ন হিসেবে চিহ্নিত করুন"}
                      className={`p-1.5 rounded-lg border cursor-pointer transition-colors ${
                        log.resolved 
                          ? 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200' 
                          : 'bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>

                    {/* Edit button */}
                    <button
                      onClick={() => {
                        setEditingLog(log);
                        setEditDescription(log.description);
                        setEditResolved(log.resolved);
                        setEditResolutionNotes(log.resolution_notes || '');
                      }}
                      title="সম্পাদনা করুন"
                      className="p-1.5 bg-bento-bg border border-bento-border text-slate-600 hover:text-bento-primary rounded-lg cursor-pointer transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete button (Admin Only) */}
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteLog(log.id)}
                        title="ডিলিট করুন"
                        className="p-1.5 bg-rose-50 border border-rose-100 text-rose-600 hover:bg-rose-100 rounded-lg cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                </div>

                {/* Log Content & Body */}
                <div className="p-5 space-y-4">
                  
                  {/* Event Detail Description */}
                  <div className="text-xs text-slate-700 font-sans leading-relaxed whitespace-pre-wrap font-medium">
                    {log.description}
                  </div>

                  {/* Resolution Notes box if resolved and present */}
                  {log.resolved && log.resolution_notes && (
                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-bento p-3.5 text-xs">
                      <div className="font-bold text-emerald-800 flex items-center gap-1.5 mb-1 select-none">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>সমাধানের বিবরণ (Resolution Details):</span>
                      </div>
                      <div className="text-emerald-700 italic leading-relaxed font-medium pl-5 border-l-2 border-emerald-200">
                        {log.resolution_notes}
                      </div>
                    </div>
                  )}

                  {/* Audit Footer Info */}
                  <div className="flex justify-between items-center text-[10px] font-mono text-bento-muted border-t border-bento-border/70 pt-3 select-none">
                    <span>
                      লগকারী আইডি: <strong className="text-slate-600">{log.operator_id}</strong>
                    </span>
                    <span className="text-right">
                      লগ করেছেন: <strong className="text-slate-600 font-semibold">{log.operator_name}</strong>
                    </span>
                  </div>

                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* ================= ADD LOG DIALOG MODAL ================= */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-bento border border-bento-border max-w-xl w-full shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            
            {/* Modal Title */}
            <div className="px-5 py-4 bg-bento-primary text-white border-b-4 border-bento-accent flex justify-between items-center select-none">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4.5 h-4.5 text-bento-accent" />
                <span className="font-extrabold text-sm tracking-tight">
                  নতুন অপারেশন লগ এন্ট্রি (Add Operation Log)
                </span>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Form */}
            <form onSubmit={handleAddLog} className="p-5 space-y-4 overflow-y-auto flex-1">
              
              {/* Voice Configuration Panel */}
              {speechSupported && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-emerald-50/40 border border-emerald-100/60 rounded-xl px-4 py-2.5 text-xs gap-3 select-none">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                    <span className="flex h-2 w-2 relative shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span>ভয়েস ডিকটেশন সচল (Voice Input Active)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-[11px] font-medium">ভাষা (Lang):</span>
                    <div className="bg-white border border-slate-200 p-0.5 rounded-lg flex shadow-3xs">
                      <button
                        type="button"
                        onClick={() => setSpeechLang('bn-BD')}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                          speechLang === 'bn-BD' 
                            ? 'bg-emerald-600 text-white shadow-3xs' 
                            : 'text-slate-600 hover:text-slate-900 bg-transparent'
                        }`}
                      >
                        বাংলা
                      </button>
                      <button
                        type="button"
                        onClick={() => setSpeechLang('en-US')}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                          speechLang === 'en-US' 
                            ? 'bg-emerald-600 text-white shadow-3xs' 
                            : 'text-slate-600 hover:text-slate-900 bg-transparent'
                        }`}
                      >
                        English
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Event Date Input */}
                <div className="space-y-1">
                  <label className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider block">
                    তারিখ (Date)
                  </label>
                  <input
                    type="date"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full text-xs px-3 py-2.5 bg-bento-bg text-slate-700 rounded-bento border border-bento-border focus:outline-none focus:ring-1 focus:ring-bento-primary focus:bg-white"
                  />
                </div>

                {/* Event Type Select Input */}
                <div className="space-y-1">
                  <label className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider block">
                    ইভেন্ট ক্যাটাগরি (Event Type)
                  </label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value as DailyLog['event_type'])}
                    className="w-full text-xs px-3 py-2.5 bg-bento-bg text-slate-700 rounded-bento border border-bento-border focus:outline-none focus:ring-1 focus:ring-bento-primary focus:bg-white"
                  >
                    <option value="General Note">সাধারণ দ্রষ্টব্য (General Note)</option>
                    <option value="Equipment Maintenance">যন্ত্রপাতি রক্ষণাবেক্ষণ (Equipment Maintenance)</option>
                    <option value="Visitor Check-in">দর্শনার্থী চেক-ইন (Visitor Check-in)</option>
                    <option value="Site Incident">সাইট দুর্ঘটনা/সমস্যা (Site Incident)</option>
                    <option value="Supply Delivery">সরবরাহ ডেলিভারি (Supply Delivery)</option>
                    <option value="Other">অন্যান্য (Other)</option>
                  </select>
                </div>

              </div>

              {/* Event Description Text Area */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider block">
                    বিস্তারিত বিবরণ (Description) <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[9px] font-mono text-bento-muted">
                    {description.length}/2000 chars
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <textarea
                    required
                    rows={4}
                    maxLength={2000}
                    placeholder="এখানে ইভেন্টের চমৎকার বিবরণটি লিখুন (যেমন: দুপুর ১২টায় ফিল্ড মোটর জেনারেটরের মবিল পরিবর্তন ও ফিল্টার ক্লিন করা হয়েছে)..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-bento-bg text-slate-700 rounded-bento border border-bento-border focus:outline-none focus:ring-1 focus:ring-bento-primary focus:bg-white font-medium placeholder-slate-400 flex-1"
                  ></textarea>
                  {speechSupported && (
                    <button
                      type="button"
                      onClick={() => toggleSpeechRecognition('description')}
                      className={`px-3 border rounded-bento transition-all duration-200 cursor-pointer flex items-center justify-center shrink-0 active:scale-95 ${
                        activeDictationField === 'description'
                          ? 'bg-rose-500 border-rose-600 text-white animate-pulse'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500'
                      }`}
                      title="Speak Description"
                    >
                      {activeDictationField === 'description' ? (
                        <MicOff className="w-5 h-5 animate-spin" />
                      ) : (
                        <Mic className="w-5 h-5 text-emerald-600" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Resolved Toggle Switch box */}
              <div className="p-3 bg-bento-bg border border-bento-border rounded-bento">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={resolved}
                    onChange={(e) => setResolved(e.target.checked)}
                    className="h-4.5 w-4.5 rounded text-bento-primary border-slate-300 focus:ring-bento-primary cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">
                      সমাধান সম্পন্ন? (Mark as Resolved)
                    </span>
                    <span className="text-[10px] text-bento-muted block mt-0.5">
                      ঘটনা বা সমস্যাটি তাত্ক্ষণিকভাবে সমাধান করা হয়ে থাকলে এটি সক্রিয় করুন।
                    </span>
                  </div>
                </label>
              </div>

              {/* Resolution Notes if checked */}
              {resolved && (
                <div className="space-y-1 animate-fadeIn">
                  <label className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider block">
                    সমাধানের বিস্তারিত বিবরণ (Resolution Action Notes)
                  </label>
                  <div className="flex gap-1.5">
                    <textarea
                      required
                      rows={2}
                      maxLength={2000}
                      placeholder="কিভাবে সমাধান করা হলো বা বর্তমান সমাধান স্থিতি লিখুন..."
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-bento-bg text-slate-700 rounded-bento border border-bento-border focus:outline-none focus:ring-1 focus:ring-bento-primary focus:bg-white font-medium flex-1"
                    ></textarea>
                    {speechSupported && (
                      <button
                        type="button"
                        onClick={() => toggleSpeechRecognition('resolutionNotes')}
                        className={`px-3 border rounded-bento transition-all duration-200 cursor-pointer flex items-center justify-center shrink-0 active:scale-95 ${
                          activeDictationField === 'resolutionNotes'
                            ? 'bg-rose-500 border-rose-600 text-white animate-pulse'
                            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500'
                        }`}
                        title="Speak Resolution Details"
                      >
                        {activeDictationField === 'resolutionNotes' ? (
                          <MicOff className="w-5 h-5 animate-spin" />
                        ) : (
                          <Mic className="w-5 h-5 text-emerald-600" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Submit panel */}
              <div className="pt-2 border-t border-bento-border flex justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setShowAddModal(false)}
                  className="px-4.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-bento cursor-pointer transition-colors"
                >
                  বাতিল (Cancel)
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-bento-primary text-white text-xs font-bold rounded-bento hover:bg-bento-primary/95 flex items-center gap-1.5 cursor-pointer shadow-bento transition-all border-b-2 border-b-bento-primary-dark/40"
                >
                  {isSubmitting ? (
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>সেভ করুন (Save Log)</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ================= EDIT / ACTION MODAL ================= */}
      {editingLog && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-bento border border-bento-border max-w-xl w-full shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            
            {/* Title */}
            <div className="px-5 py-4 bg-slate-800 text-white border-b-4 border-slate-600 flex justify-between items-center select-none">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4.5 h-4.5 text-bento-accent" />
                <span className="font-extrabold text-sm tracking-tight">
                  অপারেশন লগ সম্পাদনা (Edit Operations Log)
                </span>
              </div>
              <button 
                onClick={() => setEditingLog(null)}
                className="text-white/80 hover:text-white p-1 hover:bg-white/10 rounded cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleUpdateLog} className="p-5 space-y-4 overflow-y-auto flex-1">
              
              {/* Voice Configuration Panel */}
              {speechSupported && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-emerald-50/40 border border-emerald-100/60 rounded-xl px-4 py-2.5 text-xs gap-3 select-none">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                    <span className="flex h-2 w-2 relative shrink-0">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span>ভয়েস ডিকটেশন সচল (Voice Input Active)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 text-[11px] font-medium">ভাষা (Lang):</span>
                    <div className="bg-white border border-slate-200 p-0.5 rounded-lg flex shadow-3xs">
                      <button
                        type="button"
                        onClick={() => setSpeechLang('bn-BD')}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                          speechLang === 'bn-BD' 
                            ? 'bg-emerald-600 text-white shadow-3xs' 
                            : 'text-slate-600 hover:text-slate-900 bg-transparent'
                        }`}
                      >
                        বাংলা
                      </button>
                      <button
                        type="button"
                        onClick={() => setSpeechLang('en-US')}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                          speechLang === 'en-US' 
                            ? 'bg-emerald-600 text-white shadow-3xs' 
                            : 'text-slate-600 hover:text-slate-900 bg-transparent'
                        }`}
                      >
                        English
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Static Fields Display for context */}
              <div className="grid grid-cols-2 gap-4 p-3.5 bg-bento-bg rounded-bento border border-bento-border/70 select-none">
                <div>
                  <span className="text-[10px] font-mono text-bento-muted uppercase tracking-wider block">লগ তারিখ (Log Date)</span>
                  <span className="text-xs font-bold text-slate-700">{editingLog.date}</span>
                </div>
                <div>
                  <span className="text-[10px] font-mono text-bento-muted uppercase tracking-wider block">ইভেন্ট ধরণ (Event Type)</span>
                  <span className="text-xs font-bold text-slate-700">{editingLog.event_type}</span>
                </div>
              </div>

              {/* Edit Description description */}
              <div className="space-y-1">
                <label className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider block">
                  লগের মূল বিবরণ (Description)
                </label>
                <div className="flex gap-1.5">
                  <textarea
                    required
                    rows={4}
                    maxLength={2000}
                    placeholder="বিবরণ লিখুন..."
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full text-xs px-3 py-2 bg-bento-bg text-slate-700 rounded-bento border border-bento-border focus:outline-none focus:ring-1 focus:ring-bento-primary focus:bg-white font-medium flex-1"
                  ></textarea>
                  {speechSupported && (
                    <button
                      type="button"
                      onClick={() => toggleSpeechRecognition('editDescription')}
                      className={`px-3 border rounded-bento transition-all duration-200 cursor-pointer flex items-center justify-center shrink-0 active:scale-95 ${
                        activeDictationField === 'editDescription'
                          ? 'bg-rose-500 border-rose-600 text-white animate-pulse'
                          : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500'
                      }`}
                      title="Speak Description"
                    >
                      {activeDictationField === 'editDescription' ? (
                        <MicOff className="w-5 h-5 animate-spin" />
                      ) : (
                        <Mic className="w-5 h-5 text-emerald-600" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Edit Resolved Toggle */}
              <div className="p-3 bg-bento-bg border border-bento-border rounded-bento">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editResolved}
                    onChange={(e) => setEditResolved(e.target.checked)}
                    className="h-4.5 w-4.5 rounded text-bento-primary border-slate-300 focus:ring-bento-primary cursor-pointer"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-700 block col-span-2">
                      সমাধান সম্পন্ন? (Mark as Resolved)
                    </span>
                    <span className="text-[10px] text-bento-muted block mt-0.5">
                      এই লগের সাথে জড়িত সমস্যা বা কাজটি সম্পন্ন হয়ে থাকলে সফল চিহ্নিত করুন।
                    </span>
                  </div>
                </label>
              </div>

              {/* Edit Resolution Notes */}
              {editResolved && (
                <div className="space-y-1 animate-fadeIn">
                  <label className="text-[11px] font-mono font-bold text-slate-500 uppercase tracking-wider block">
                    সমাধানের বিস্তারিত বিবরণ (Resolution Action Notes)
                  </label>
                  <div className="flex gap-1.5">
                    <textarea
                      required
                      rows={2.5}
                      maxLength={2000}
                      placeholder="কিভাবে সমাধান বা সম্পন্ন করা হলো লিখুন..."
                      value={editResolutionNotes}
                      onChange={(e) => setEditResolutionNotes(e.target.value)}
                      className="w-full text-xs px-3 py-2 bg-bento-bg text-slate-700 rounded-bento border border-bento-border focus:outline-none focus:ring-1 focus:ring-bento-primary focus:bg-white font-medium flex-1"
                    ></textarea>
                    {speechSupported && (
                      <button
                        type="button"
                        onClick={() => toggleSpeechRecognition('editResolutionNotes')}
                        className={`px-3 border rounded-bento transition-all duration-200 cursor-pointer flex items-center justify-center shrink-0 active:scale-95 ${
                          activeDictationField === 'editResolutionNotes'
                            ? 'bg-rose-500 border-rose-600 text-white animate-pulse'
                            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500'
                        }`}
                        title="Speak Resolution Details"
                      >
                        {activeDictationField === 'editResolutionNotes' ? (
                          <MicOff className="w-5 h-5 animate-spin" />
                        ) : (
                          <Mic className="w-5 h-5 text-emerald-600" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div className="pt-2 border-t border-bento-border flex justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setEditingLog(null)}
                  className="px-4.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-bento cursor-pointer transition-colors"
                >
                  বাতিল (Cancel)
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-slate-800 text-white text-xs font-bold rounded-bento hover:bg-slate-900 flex items-center gap-1.5 cursor-pointer shadow-bento transition-all border-b-2 border-b-slate-950/40"
                >
                  {isSubmitting ? (
                    <Clock className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>আপডেট করুন (Update Log)</span>
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
