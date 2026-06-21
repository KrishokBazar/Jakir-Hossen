import { useEffect, useState, FormEvent } from 'react';
import { dbService } from '../db';
import { Profile, OfficePlan, Staff } from '../types';
import { useNotification } from './NotificationContext';
import { 
  Briefcase, 
  Target, 
  CalendarDays, 
  FileSpreadsheet, 
  PlusCircle, 
  Trash2, 
  Edit3, 
  Save, 
  X, 
  UserCheck, 
  Clock, 
  TrendingUp, 
  Printer, 
  Sparkles,
  Info,
  CalendarRange,
  Search,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface OfficeWorkspaceProps {
  user: Profile;
}

export default function OfficeWorkspace({ user }: OfficeWorkspaceProps) {
  const { showError, showNotification } = useNotification();
  const [plans, setPlans] = useState<OfficePlan[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtering states
  const [activePeriod, setActivePeriod] = useState<'all' | 'daily' | 'weekly' | 'monthly'>('all');
  const [activeType, setActiveType] = useState<'all' | 'plan' | 'routine' | 'target'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modal / Form state for Managing
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<OfficePlan | null>(null);
  const [processing, setProcessing] = useState(false);

  // Form Fields
  const [title, setTitle] = useState('');
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [type, setType] = useState<'target' | 'plan' | 'routine'>('plan');
  const [content, setContent] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [isCustomAssignment, setIsCustomAssignment] = useState(false);
  const [targetValue, setTargetValue] = useState('');
  const [achievementStatus, setAchievementStatus] = useState('pending');
  const [scheduleDay, setScheduleDay] = useState('Saturday');

  // Check if current user has permissions (admin or special credentials)
  const isAdmin = user.role === 'admin' || 
                  user.email?.toLowerCase().trim() === 'ajzakir004@gmail.com' ||
                  user.email?.toLowerCase().trim() === 'riktazhossain@gmail.com' ||
                  user.phone === '01931355398';

  useEffect(() => {
    setLoading(true);
    // Subscribe to office plans real-time
    const unsubscribe = dbService.subscribeOfficePlans(
      (livePlans) => {
        // Enforce backward compatibility fallbacks if period is missing in old records
        const sanitized = livePlans.map(p => {
          if (!p.period) {
            // Deduce period for existing old records
            return {
              ...p,
              period: p.type === 'routine' ? 'weekly' : p.type === 'target' ? 'monthly' : 'daily'
            } as OfficePlan;
          }
          return p;
        });
        setPlans(sanitized);
        setLoading(false);
      },
      (err) => {
        console.error("Office workspace subscription failure:", err);
        showError("অনাকাঙ্ক্ষিত কারণে ডাটা সিঙ্ক করতে ত্রুটি হয়েছে", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Subscribe to registered staff
    const unsubscribeStaff = dbService.subscribeStaff(
      (list) => {
        setStaffList(list);
      },
      (err) => {
        console.error("Failed to fetch staff list:", err);
      }
    );
    return () => unsubscribeStaff();
  }, []);

  // Prepare fields for Add mode
  const openAddModal = (initialPeriod?: 'daily' | 'weekly' | 'monthly') => {
    setEditingPlan(null);
    setTitle('');
    setPeriod(initialPeriod || 'daily');
    setType(initialPeriod === 'daily' ? 'plan' : 'routine');
    setContent('');
    setAssignedTo('');
    setAssignedToId('');
    setIsCustomAssignment(false);
    setTargetValue('');
    setAchievementStatus('pending');
    setScheduleDay('Saturday');
    setShowForm(true);
  };

  // Prepare fields for Edit mode
  const openEditModal = (plan: OfficePlan) => {
    setEditingPlan(plan);
    setTitle(plan.title);
    setPeriod(plan.period || 'daily');
    setType(plan.type);
    setContent(plan.content);
    setAssignedTo(plan.assigned_to || '');
    setAssignedToId(plan.assigned_to_id || '');
    setIsCustomAssignment(!plan.assigned_to_id && !!plan.assigned_to);
    setTargetValue(plan.target_value || '');
    setAchievementStatus(plan.achievement_status || 'pending');
    setScheduleDay(plan.schedule_day || 'Saturday');
    setShowForm(true);
  };

  // Submit Handler (Create or Update)
  const handleSubmitPlan = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      showNotification("সতর্কতা", "বার্তা সংশোধন করুন: শিরোনাম এবং বিবরণ আবশ্যিক।", "warning");
      return;
    }

    setProcessing(true);
    try {
      const payload = {
        title: title.trim(),
        period,
        type,
        content: content.trim(),
        assigned_to: assignedTo.trim() || undefined,
        assigned_to_id: assignedToId || undefined,
        target_value: targetValue.trim() || undefined,
        achievement_status: achievementStatus || undefined,
        schedule_day: type === 'routine' ? scheduleDay : undefined,
        updated_by: user.name || 'অ্যাডমিন',
      };

      if (editingPlan) {
        await dbService.updateOfficePlan(editingPlan.id, payload);
        showNotification("সফল", "कर्मপরিল্পনাটি সফলভাবে পরিবর্তন করা হয়েছে।", "success");
      } else {
        await dbService.addOfficePlan(payload);
        showNotification("সফল", "নতুন কর্মপরিকল্পনাটি সফলভাবে যুক্ত হয়েছে।", "success");
      }
      setShowForm(false);
    } catch (err: any) {
      showError("সংরক্ষণ ব্যর্থ হয়েছে", err);
    } finally {
      setProcessing(false);
    }
  };

  // Delete Handler
  const handleDeletePlan = async (id: string, name: string) => {
    if (!window.confirm(`আপনি কি নিশ্চিতভাবে "${name}" মুছে ফেলতে চান?`)) return;

    try {
      await dbService.deleteOfficePlan(id);
      showNotification("সফল", "রেকর্ডটি স্থায়ীভাবে মুছে ফেলা হয়েছে।", "success");
    } catch (err: any) {
      showError("মুছে ফেলতে ব্যর্থ হয়েছে", err);
    }
  };

  // Filter items
  const filteredPlans = plans.filter(p => {
    const matchPeriod = activePeriod === 'all' || p.period === activePeriod;
    const matchType = activeType === 'all' || p.type === activeType;
    
    const query = searchQuery.trim().toLowerCase();
    const matchQuery = !query || 
      p.title.toLowerCase().includes(query) || 
      p.content.toLowerCase().includes(query) || 
      (p.assigned_to && p.assigned_to.toLowerCase().includes(query));

    return matchPeriod && matchType && matchQuery;
  });

  // Print function
  const handlePrint = () => {
    window.print();
  };

  // Day Name Translation Helper
  const getDayBangla = (day: string) => {
    const days: Record<string, string> = {
      Saturday: 'শনিবার (Saturday)',
      Sunday: 'রবিবার (Sunday)',
      Monday: 'সোমবার (Monday)',
      Tuesday: 'মঙ্গলবার (Tuesday)',
      Wednesday: 'বুধবার (Wednesday)',
      Thursday: 'বৃহস্পতিবার (Thursday)',
      Friday: 'শুক্রবার (Friday)'
    };
    return days[day] || day;
  };

  // Render Assignee Avatar or Initials chip with high fidelity design
  const renderAssigneeAvatar = (plan: OfficePlan) => {
    const name = plan.assigned_to || '';
    if (!name) return null;

    const staff = plan.assigned_to_id ? staffList.find(s => s.id === plan.assigned_to_id) : null;
    const photoUrl = staff?.photo_url;

    // Get initials for avatar fallback (works nicely for both English letters and Bengali characters)
    const getInitials = (n: string): string => {
      const trimmed = n.trim();
      if (!trimmed) return '?';
      const parts = trimmed.split(/\s+/);
      if (parts.length > 1) {
        // First char of first word + first char of last word
        const first = parts[0][0] || '';
        const last = parts[parts.length - 1][0] || '';
        return (first + last).toUpperCase();
      }
      return trimmed.substring(0, 2).toUpperCase();
    };

    return (
      <div className="flex items-center gap-2 bg-slate-50 border border-slate-150 p-1.5 pr-3.5 rounded-full w-fit mt-2 shadow-xs transition-colors hover:bg-slate-100/75 select-none print:bg-white">
        {photoUrl ? (
          <img
            src={photoUrl}
            referrerPolicy="no-referrer"
            alt={name}
            className="w-7 h-7 rounded-full object-cover border border-emerald-500 shadow-xs ring-1 ring-emerald-500/10"
          />
        ) : (
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-600 to-teal-650 text-white flex items-center justify-center text-[10px] font-black shadow-xs uppercase ring-1 ring-emerald-500/10">
            {getInitials(name)}
          </div>
        )}
        <div className="flex flex-col leading-none">
          <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">দায়িত্বরত কর্মী</span>
          <span className="text-xs font-black text-slate-800 tracking-tight mt-0.5">{name}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Print Specific Header */}
      <div className="hidden print:block text-center border-b border-slate-350 pb-4 mb-6">
        <h1 className="text-2xl font-bold text-slate-900">কৃষক বাজার লিমিটেড</h1>
        <h2 className="text-lg font-bold text-slate-700 mt-1">অফিসিয়াল কর্মপরিকল্পনা ও দায়িত্ব বণ্টন রুটিন</h2>
        <p className="text-xs text-slate-500 mt-1">প্রিন্ট সময়কাল: {new Date().toLocaleDateString('bn-BD')} {new Date().toLocaleTimeString('bn-BD')}</p>
      </div>

      {/* Brand Header Section */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-850 to-indigo-900 rounded-bento p-6 md:p-8 text-white shadow-bento relative overflow-hidden flex flex-col md:flex-row md:items-center md:justify-between gap-6 print:hidden">
        <div className="absolute right-0 top-0 opacity-10 text-9xl font-extrabold select-none pointer-events-none transform translate-x-12 translate-y-2">
          ⏰
        </div>
        
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-1.5 bg-emerald-500/35 border border-emerald-400/30 text-emerald-100 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
            <Sparkles className="w-3 h-3 text-emerald-300 animate-pulse" />
            কৃষক বাজার অফিস ওয়ার্কস্পেস
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight font-sans">
            কর্মপরিকল্পনা ও রুটিন চেম্বার
          </h2>
          <p className="text-xs text-emerald-200/90 font-medium max-w-2xl leading-relaxed">
            এখানে কৃষক বাজার টিমের <b>প্রতিদিনের রুটিন</b>, <b>সাপ্তাহিক রুটিন</b> এবং <b>মাসিক লক্ষ্যমাত্রা/পরিকল্পনা</b> আলাদা আলাদা ভাবে সাজানো রয়েছে। অ্যাডমিন যে কোনো সময় পরিবর্তন বা নতুন এন্ট্রি যোগ করতে পারবেন যা রিয়েল-টাইমে সবাই দেখতে পাবেন।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 relative z-10 shrink-0">
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-slate-100 text-xs font-bold rounded-xl border border-white/25 cursor-pointer flex items-center gap-1.5 transition-all outline-none"
          >
            <Printer className="w-4 h-4" /> প্রিন্ট করুন (Print)
          </button>
          
          {isAdmin && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => openAddModal('daily')}
                className="px-3.5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-extrabold rounded-xl shadow-lg cursor-pointer flex items-center gap-1 transition-transform active:scale-95 duration-100"
              >
                <PlusCircle className="w-4 h-4" /> দৈনিক যোগ করুন
              </button>
              <button
                type="button"
                onClick={() => openAddModal('weekly')}
                className="px-3.5 py-2.5 bg-teal-500 hover:bg-teal-600 text-white text-xs font-extrabold rounded-xl shadow-lg cursor-pointer flex items-center gap-1 transition-transform active:scale-95 duration-100"
              >
                <PlusCircle className="w-4 h-4" /> সাপ্তাহিক যোগ করুন
              </button>
              <button
                type="button"
                onClick={() => openAddModal('monthly')}
                className="px-3.5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-extrabold rounded-xl shadow-lg cursor-pointer flex items-center gap-1 transition-transform active:scale-95 duration-100"
              >
                <PlusCircle className="w-4 h-4" /> মাসিক যোগ করুন
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter and Command Center Controls */}
      <div className="bg-white p-4 border border-bento-border rounded-bento shadow-xs space-y-4 print:hidden">
        
        {/* Row 1: Plan Recurrence Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">পরিকল্পনা ও রুটিন মেয়াদ (Core Periods)</span>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setActivePeriod('all')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activePeriod === 'all'
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                    : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                🌈 সবগুলো একসাথে (All Period)
              </button>
              
              <button
                onClick={() => setActivePeriod('daily')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activePeriod === 'daily'
                    ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-md'
                    : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                ☀️ প্রতিদিন কাজের রুটিন (Daily)
              </button>
              
              <button
                onClick={() => setActivePeriod('weekly')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activePeriod === 'weekly'
                    ? 'bg-gradient-to-r from-teal-600 to-teal-700 text-white shadow-md'
                    : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                📅 সাপ্তাহিক রুটিন ও প্ল্যান (Weekly)
              </button>
              
              <button
                onClick={() => setActivePeriod('monthly')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activePeriod === 'monthly'
                    ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md'
                    : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                🚀 মাসিক টার্গেট ও রুটিন (Monthly)
              </button>
            </div>
          </div>

          {/* Row 2: Secondary Types & Search Bar combo */}
          <div className="flex flex-col sm:flex-row gap-3">
            
            {/* Search Input */}
            <div className="relative min-w-[200px] sm:min-w-[250px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="রুটিন, কর্মী বা লক্ষ্য খুঁজুন..."
                className="w-full bg-slate-50 hover:bg-slate-100/70 border border-slate-200 pl-10 pr-4 py-2 rounded-xl text-xs font-bold text-slate-700 placeholder-slate-400 focus:bg-white focus:outline-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="p-1 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 rounded-md"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Type selector */}
            <select
              value={activeType}
              onChange={(e: any) => setActiveType(e.target.value)}
              className="bg-slate-50 hover:bg-slate-100/75 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 focus:outline-emerald-600 outline-none"
            >
              <option value="all">সব ক্যাটাগরি (All Types)</option>
              <option value="routine">নির্ধারিত রুটিন (Duty Routine)</option>
              <option value="plan">দিকনির্দেশনা ও প্ল্যান (Directives)</option>
              <option value="target">লক্ষ্যমাত্রা ও গোল (Target Goals)</option>
            </select>

          </div>
        </div>
      </div>

      {/* Main Board Grid View */}
      {loading ? (
        <div className="bg-white rounded-bento border border-bento-border p-12 flex flex-col items-center justify-center gap-3">
          <div className="animate-spin rounded-full h-9 w-9 border-4 border-emerald-600 border-t-transparent" />
          <p className="text-xs font-bold text-slate-500 font-sans">রিয়েল-টাইমে পরিকল্পনা সুবিন্যস্ত হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...</p>
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="bg-white rounded-bento border border-bento-border p-12 text-center text-slate-400 text-xs font-medium space-y-2 max-w-lg mx-auto">
          <div className="text-4xl">🗓️</div>
          <p className="font-sans text-slate-700 font-bold text-sm">কোন সংশ্লিষ্ট পরিকল্পনা বা রুটিন পাওয়া যায়নি!</p>
          <p className="text-[11px] text-slate-450 leading-relaxed">
            {isAdmin 
              ? "বর্তমানে নথিবদ্ধ ডাটাবেজে এই ফিল্টারে কোন তথ্য নেই। উপরের ডানপাশের অ্যাডমিন বাটন বা নিচ থেকে নতুন রুটিন বা লক্ষ্যমাত্রা এড করুন।" 
              : "এখানে অ্যাডমিন কর্তৃক যুক্তকৃত কোন রুটিন বা কার্যক্রম বর্তমানে নেই। নতুন কিছু যোগ করা হলে স্বয়ংক্রিয়ভাবে তা এখানে দেখা যাবে।"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPlans.map((plan) => {
            const isTarget = plan.type === 'target';
            const isRoutine = plan.type === 'routine';
            const isPlan = plan.type === 'plan';

            // Period label
            const periodLabels: Record<string, string> = {
              daily: 'দৈনিক (Daily)',
              weekly: 'সাপ্তাহিক (Weekly)',
              monthly: 'মাসিক (Monthly)'
            };

            const typeLabels: Record<string, string> = {
              routine: 'রুটিন দায়িত্ব',
              plan: 'পরিকল্পনা',
              target: 'লক্ষ্যমাত্রা'
            };

            return (
              <div 
                key={plan.id}
                className={`bg-white border rounded-bento p-5 shadow-xs hover:shadow-bento duration-200 transition-all flex flex-col justify-between relative border-l-4 overflow-hidden ${
                  plan.period === 'daily' 
                    ? 'border-l-emerald-500' 
                    : plan.period === 'weekly' 
                    ? 'border-l-teal-500' 
                    : 'border-l-indigo-600'
                }`}
              >
                {/* Print element visual marker */}
                <div className="absolute right-0 top-0 w-32 h-32 bg-slate-50 rounded-full opacity-[0.03] pointer-events-none transform translate-x-12 -translate-y-12" />

                <div>
                  {/* Category Stamp info */}
                  <div className="flex items-center justify-between mb-4 select-none print:hidden">
                    
                    {/* Period or Recurrence badge */}
                    <div className="flex flex-wrap gap-1">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wide ${
                        plan.period === 'daily'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50'
                          : plan.period === 'weekly'
                          ? 'bg-teal-50 text-teal-700 border border-teal-200/50'
                          : 'bg-indigo-50 text-indigo-700 border border-indigo-200/50'
                      }`}>
                        {periodLabels[plan.period || 'daily']}
                      </span>

                      <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md text-[9px] font-bold ${
                        isTarget 
                          ? 'bg-rose-50 text-rose-700 border border-rose-100' 
                          : isRoutine 
                          ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {typeLabels[plan.type]}
                      </span>
                    </div>

                    {/* Action Panel for Admin */}
                    {isAdmin && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditModal(plan)}
                          title="সম্পাদনা করুন"
                          className="p-1 px-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-indigo-150"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeletePlan(plan.id, plan.title)}
                          title="মুছে ফেলুন"
                          className="p-1 px-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-rose-150"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Print-only small indicators */}
                  <div className="hidden print:flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-dense mb-2">
                    <span>{periodLabels[plan.period || 'daily']}</span>
                    <span>•</span>
                    <span>{typeLabels[plan.type]}</span>
                  </div>

                  {/* Title */}
                  <h4 className="text-sm font-black text-slate-800 tracking-tight leading-snug font-sans break-words max-w-full">
                    {plan.title}
                  </h4>

                  {/* Routine Specific Sub Header metadata */}
                  {plan.type === 'routine' && (
                    <div className="space-y-2 mt-2.5">
                      <div className="flex flex-wrap items-center gap-2 bg-slate-50 text-slate-700 border border-slate-150 p-2 rounded-xl text-[10px] font-bold">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-teal-600" />
                          <span>{plan.schedule_day ? getDayBangla(plan.schedule_day) : 'প্রতিদিন'}</span>
                        </div>
                        
                        {plan.target_value && (
                          <>
                            <span className="text-slate-300">|</span>
                            <span className="font-mono text-slate-600">{plan.target_value}</span>
                          </>
                        )}
                      </div>
                      {renderAssigneeAvatar(plan)}
                    </div>
                  )}

                  {/* Target Custom Display info */}
                  {plan.type === 'target' && (plan.target_value || plan.assigned_to) && (
                    <div className="mt-2.5 space-y-2 bg-rose-50/20 border border-rose-100 p-2.5 rounded-xl">
                      {plan.target_value && (
                        <div className="flex items-center justify-between text-[10px] font-bold">
                          <span className="text-slate-600 flex items-center gap-1">🎯 লক্ষ্যমাত্রা (Target Goal):</span>
                          <span className="text-slate-850 font-mono font-black">{plan.target_value}</span>
                        </div>
                      )}
                      
                      {renderAssigneeAvatar(plan)}

                      {/* Display visual targets progress gauge */}
                      <div className="pt-1.5">
                        <div className="flex items-center justify-between text-[9px] font-extrabold mb-1">
                          <span className="text-slate-400 uppercase tracking-wider">Progress Status:</span>
                          <span className={`uppercase font-mono ${
                            plan.achievement_status === 'completed' || plan.achievement_status === 'achieved'
                              ? 'text-emerald-700 font-black'
                              : plan.achievement_status === 'on_track'
                              ? 'text-indigo-600 font-black'
                              : 'text-amber-600 animate-pulse'
                          }`}>
                            {plan.achievement_status === 'completed' || plan.achievement_status === 'achieved'
                              ? '✓ অর্জন শেষ'
                              : plan.achievement_status === 'on_track'
                              ? '⚡ চলমান (On Track)'
                              : '⏳ প্রক্রিয়াদ্বীন (Pending)'}
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-300 ${
                            plan.achievement_status === 'completed' || plan.achievement_status === 'achieved'
                              ? 'bg-emerald-500 w-full'
                              : plan.achievement_status === 'on_track'
                              ? 'bg-indigo-500 w-[65%]'
                              : 'bg-amber-400 w-[30%]'
                          }`} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Simple Plan metadata */}
                  {plan.type === 'plan' && plan.assigned_to && (
                    <div className="mt-2">
                      {renderAssigneeAvatar(plan)}
                    </div>
                  )}

                  {/* Content / Instructions Body */}
                  <div className="mt-3.5 text-xs text-slate-700 leading-relaxed font-sans whitespace-pre-line border-t border-slate-100 pt-3">
                    {plan.content}
                  </div>
                </div>

                {/* Footer system details */}
                <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-[9px] font-bold text-slate-450 font-mono select-none">
                  <span className="bg-slate-50 border border-slate-150 px-2 py-0.5 rounded text-[8px]">
                    BY: {plan.updated_by || 'Admin'}
                  </span>
                  <span>
                    {new Date(plan.created_at).toLocaleDateString('bn-BD', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info Warning notice */}
      <div className="bg-amber-50 border border-amber-200/80 rounded-bento p-4 flex items-start gap-3.5 text-amber-900 shadow-xs max-w-4xl print:hidden">
        <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-xs font-black leading-none">শ্রেণীবদ্ধ রুটিন নির্দেশিকা (Roster Regulations)</p>
          <p className="text-[11px] text-amber-850 leading-relaxed">
            এই ওয়ার্কস্পেসে প্রতিদিনের কাজের ধারাবাহিক রুটিন, সাপ্তাহিক দায়িত্ব ও মাসিক গুরুত্বপূর্ণ পরিকল্পনা অত্যন্ত নিপুণভাবে ডাটাবেজের সাথে সিঙ্ক থাকে। কোনো কর্মী যদি নির্ধারিত শিফট বা রুটিনে ত্রুটি লক্ষ করেন, তবে অবিলম্বে অ্যাডমিন প্যানেলে জাকির ভাই (<b>01931355398</b>) অথবা রিকতা আপুর সাথে যোগাযোগ করুন।
          </p>
        </div>
      </div>

      {/* Full-Featured Modal Form for Creators */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 print:hidden">
          <div 
            className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-150 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 rounded-t-2xl">
              <h3 className="text-sm font-extrabold text-slate-800 flex items-center gap-2">
                <CalendarRange className="w-5 h-5 text-emerald-600" />
                {editingPlan ? 'পরিকল্পনা এজেন্ডা সংশোধন করুন' : 'নতুন কর্মপরিকল্পনা যুক্ত বা নথিবদ্ধ করুন'}
              </h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="p-1.5 hover:bg-slate-200 text-slate-500 cursor-pointer transition-colors rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSubmitPlan} className="p-6 space-y-4 flex-1">
              
              {/* 1. Period Selector (Daily, Weekly, Monthly) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">কর্মপরিকল্পনার মেয়াদ (Core Period) *</label>
                <div className="grid grid-cols-3 gap-2">
                  <label className={`border rounded-xl p-2.5 flex flex-col items-center justify-center gap-1 text-center cursor-pointer transition-all ${
                    period === 'daily' 
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 ring-2 ring-emerald-500/10' 
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}>
                    <input 
                      type="radio" 
                      name="plan_period" 
                      value="daily" 
                      checked={period === 'daily'} 
                      onChange={() => setPeriod('daily')} 
                      className="hidden" 
                    />
                    <span className="text-xs font-bold">☀️ প্রতিদিন (Daily)</span>
                  </label>

                  <label className={`border rounded-xl p-2.5 flex flex-col items-center justify-center gap-1 text-center cursor-pointer transition-all ${
                    period === 'weekly' 
                      ? 'bg-teal-50 text-teal-800 border-teal-300 ring-2 ring-teal-500/10' 
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}>
                    <input 
                      type="radio" 
                      name="plan_period" 
                      value="weekly" 
                      checked={period === 'weekly'} 
                      onChange={() => setPeriod('weekly')} 
                      className="hidden" 
                    />
                    <span className="text-xs font-bold">📅 সাপ্তাহিক (Weekly)</span>
                  </label>

                  <label className={`border rounded-xl p-2.5 flex flex-col items-center justify-center gap-1 text-center cursor-pointer transition-all ${
                    period === 'monthly' 
                      ? 'bg-indigo-50 text-indigo-800 border-indigo-300 ring-2 ring-indigo-500/10' 
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}>
                    <input 
                      type="radio" 
                      name="plan_period" 
                      value="monthly" 
                      checked={period === 'monthly'} 
                      onChange={() => setPeriod('monthly')} 
                      className="hidden" 
                    />
                    <span className="text-xs font-bold">🚀 মাসিক (Monthly)</span>
                  </label>
                </div>
              </div>

              {/* 2. Type Selector (Plan, Routine, Target) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">কর্মপরিকল্পনার ধরণ (Recurrence Type) *</label>
                <div className="grid grid-cols-3 gap-2">
                  <label className={`border rounded-xl p-2.5 flex items-center justify-center gap-1 text-xs font-bold cursor-pointer transition-all ${
                    type === 'routine' 
                      ? 'bg-blue-50 text-blue-800 border-blue-300 ring-2 ring-blue-500/10' 
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}>
                    <input 
                      type="radio" 
                      name="plan_type" 
                      value="routine" 
                      checked={type === 'routine'} 
                      onChange={() => setType('routine')} 
                      className="hidden" 
                    />
                    <span>নির্ধারিত রুটিন</span>
                  </label>

                  <label className={`border rounded-xl p-2.5 flex items-center justify-center gap-1 text-xs font-bold cursor-pointer transition-all ${
                    type === 'plan' 
                      ? 'bg-slate-50 text-slate-800 border-slate-300 ring-2 ring-slate-500/10' 
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}>
                    <input 
                      type="radio" 
                      name="plan_type" 
                      value="plan" 
                      checked={type === 'plan'} 
                      onChange={() => setType('plan')} 
                      className="hidden" 
                    />
                    <span>কাজের নির্দেশনা</span>
                  </label>

                  <label className={`border rounded-xl p-2.5 flex items-center justify-center gap-1 text-xs font-bold cursor-pointer transition-all ${
                    type === 'target' 
                      ? 'bg-rose-50 text-rose-800 border-rose-300 ring-2 ring-rose-500/10' 
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}>
                    <input 
                      type="radio" 
                      name="plan_type" 
                      value="target" 
                      checked={type === 'target'} 
                      onChange={() => setType('target')} 
                      className="hidden" 
                    />
                    <span>টার্গেট Goal</span>
                  </label>
                </div>
              </div>

              {/* Title Input field */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">পরিকল্পনা/রুটিন শিরোনাম (Title / Agenda Name) *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="উদাঃ প্রতিদিন সকাল শিফটের ডেলিভারী তদারকি অথবা জুনের অর্ডার লক্ষ্যমাত্রা ৫০০"
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold focus:outline-emerald-650 focus:bg-white outline-none"
                />
              </div>

              {/* Routine specific schedule day selector */}
              {type === 'routine' && period === 'weekly' && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">কাজের সাপ্তাহিক বার (Weekly Roster Day)</label>
                  <select
                    value={scheduleDay}
                    onChange={(e) => setScheduleDay(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold focus:outline-emerald-650 outline-none"
                  >
                    <option value="Saturday">শনিবার (Saturday)</option>
                    <option value="Sunday">রবিবার (Sunday)</option>
                    <option value="Monday">সোমবার (Monday)</option>
                    <option value="Tuesday">মঙ্গলবার (Tuesday)</option>
                    <option value="Wednesday">বুধবার (Wednesday)</option>
                    <option value="Thursday">বৃহস্পতিবার (Thursday)</option>
                    <option value="Friday">শুক্রবার (Friday)</option>
                  </select>
                </div>
              )}

              {/* Routine & Target specific - Assignment operator name */}
              {(type === 'routine' || type === 'target' || type === 'plan') && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">দায়িত্বরত কর্মী (Assigned Staff)</label>
                    <div className="space-y-1.5">
                      <select
                        value={isCustomAssignment ? 'custom_manual' : assignedToId}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'custom_manual') {
                            setIsCustomAssignment(true);
                            setAssignedToId('');
                            setAssignedTo('');
                          } else if (val === '') {
                            setIsCustomAssignment(false);
                            setAssignedToId('');
                            setAssignedTo('');
                          } else {
                            setIsCustomAssignment(false);
                            const matched = staffList.find(s => s.id === val);
                            if (matched) {
                              setAssignedToId(matched.id);
                              setAssignedTo(matched.name);
                            }
                          }
                        }}
                        className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold focus:outline-emerald-650 outline-none h-10"
                      >
                        <option value="">নির্বাচন করুন (None)</option>
                        {staffList.map((st) => (
                          <option key={st.id} value={st.id}>
                            👤 {st.name} ({st.phone || 'সহকারী'})
                          </option>
                        ))}
                        <option value="custom_manual">✍️ নিজ হাতে টাইপ করুন (Custom Name)</option>
                      </select>

                      {isCustomAssignment && (
                        <input
                          type="text"
                          required
                          value={assignedTo}
                          onChange={(e) => setAssignedTo(e.target.value)}
                          placeholder="কর্মীর নাম টাইপ করুন..."
                          className="w-full bg-slate-50 border border-emerald-300 p-2.5 rounded-xl text-xs font-bold focus:outline-emerald-650 focus:bg-white outline-none"
                        />
                      )}
                    </div>
                  </div>

                  {type === 'target' ? (
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">টার্গেট ভ্যালু (Target Value Metric)</label>
                      <input
                        type="text"
                        value={targetValue}
                        onChange={(e) => setTargetValue(e.target.value)}
                        placeholder="উদাঃ ৫০০টি সম্পূর্ণ অর্ডার"
                        className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold focus:outline-emerald-650 focus:bg-white outline-none h-10"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-slate-600 mb-1">শিফটের সময়সীমা (Duty Hours / Timings)</label>
                      <input
                        type="text"
                        value={targetValue}
                        onChange={(e) => setTargetValue(e.target.value)}
                        placeholder="উদাঃ দুপুর ১২:০০ - রাত ৮:০০"
                        className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold focus:outline-emerald-655 focus:bg-white outline-none h-10"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Target specific current status */}
              {type === 'target' && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">বর্তমান অগ্রগতি (Goal Status)</label>
                  <select
                    value={achievementStatus}
                    onChange={(e) => setAchievementStatus(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold focus:outline-emerald-650 outline-none"
                  >
                    <option value="pending">চলমান / অপরিবর্তিত (Pending)</option>
                    <option value="on_track">প্রক্রিয়াধীন / সন্তোষজনক অগ্রগতি (On Track)</option>
                    <option value="completed">অর্জিত / লক্ষ্য সমাপ্ত (Completed)</option>
                  </select>
                </div>
              )}

              {/* Main Content Instruction Textarea */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">বিস্তারিত বিবরণ ও নির্দেশাবলী (Details & Instructions) *</label>
                <textarea
                  required
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="এজেন্ডা বা রুটিনের বিস্তারিত সময়সূচি, নির্দেশনা ও দায়িত্ব বন্টন বিবরণ লিখুন।"
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl text-xs font-bold focus:outline-emerald-650 focus:bg-white outline-none resize-none font-sans"
                />
              </div>

              {/* Form Actions Footer block */}
              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer transition-colors"
                >
                  বাতিল করুন (Cancel)
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold rounded-xl shadow-md cursor-pointer flex items-center gap-1.5 transition-all"
                >
                  {processing ? (
                    <div className="animate-spin rounded-full h-3 border-2 border-white border-t-transparent mr-1" />
                  ) : <Save className="w-4 h-4" />}
                  <span>তথ্য সংরক্ষণ করুন</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
