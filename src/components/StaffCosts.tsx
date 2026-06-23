import { useEffect, useState, FormEvent } from 'react';
import { dbService } from '../db';
import { Staff, StaffPayment, Expense, Profile } from '../types';
import { useNotification } from './NotificationContext';
import { canDelete } from '../utils/auth';
import DeleteConfirmationModal from './DeleteConfirmationModal';
import { 
  Users, 
  DollarSign, 
  Plus, 
  Trash2, 
  Edit, 
  TrendingDown, 
  Calendar, 
  Lock, 
  CheckCircle, 
  AlertCircle,
  FileText,
  Clock,
  UserPlus,
  Coins,
  Receipt,
  FileCheck,
  TrendingUp,
  UserCheck,
  Phone
} from 'lucide-react';

interface StaffCostsProps {
  user: Profile;
}

export default function StaffCosts({ user }: StaffCostsProps) {
  const { showError, showNotification } = useNotification();
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

  // State lists
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [paymentsList, setPaymentsList] = useState<StaffPayment[]>([]);
  const [expensesList, setExpensesList] = useState<Expense[]>([]);

  // UI state
  const [activeTab, setActiveTab] = useState<'staff' | 'expenses' | 'calculator'>('staff');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Selected staff for payroll log inspection (Admin only)
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);

  // Form states for Add Staff
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [staffName, setStaffName] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffAddress, setStaffAddress] = useState('');
  const [staffSalary, setStaffSalary] = useState('');
  const [staffDutyHours, setStaffDutyHours] = useState('8');
  const [staffHolidays, setStaffHolidays] = useState('1');
  const [staffIdCard, setStaffIdCard] = useState('');
  const [staffDocument, setStaffDocument] = useState('');

  // Form states for Payroll (Admin salaries checkout modal)
  const [showPayoutModal, setShowPayoutModal] = useState<Staff | null>(null);
  const [payoutDays, setPayoutDays] = useState('30');
  const [payoutMonth, setPayoutMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [payoutNotes, setPayoutNotes] = useState('');

  // Form states for Expense entry
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expSpenderName, setExpSpenderName] = useState('Co-founder');
  const [expType, setExpType] = useState<string>('Daily Cost');
  const [expAmount, setExpAmount] = useState('');
  const [expDesc, setExpDesc] = useState('');
  const [expDate, setExpDate] = useState(() => new Date().toISOString().split('T')[0]);

  // Analytics calculator states
  const [calcMonth, setCalcMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [orderIncome, setOrderIncome] = useState(0);
  const [orderProfit, setOrderProfit] = useState(0);

  // Subscriptions setup
  useEffect(() => {
    setLoading(true);
    const unsubStaff = dbService.subscribeStaff(
      (data) => {
        setStaffList(data);
        setLoading(false);
      },
      (err) => console.error("Staff subscription error:", err)
    );

    const unsubPayments = dbService.subscribeStaffPayments(
      (data) => setPaymentsList(data),
      (err) => console.error("Payments subscription error:", err)
    );

    const unsubExpenses = dbService.subscribeExpenses(
      (data) => setExpensesList(data),
      (err) => console.error("Expenses subscription error:", err)
    );

    return () => {
      unsubStaff();
      unsubPayments();
      unsubExpenses();
    };
  }, []);

  // Fetch monthly gross order yield for calculator comparison
  useEffect(() => {
    const fetchYield = async () => {
      try {
        const orders = await dbService.getOrders();
        let monthTotalSales = 0;
        let monthGrossProfit = 0;

        orders.forEach(o => {
          if (o.order_date.startsWith(calcMonth)) {
            const isReturn = o.status === 'return';
            const amt = Math.abs(Number(o.amount) || 0);
            monthTotalSales += isReturn ? -amt : amt;
            monthGrossProfit += Number(o.profit) || 0;
          }
        });

        setOrderIncome(monthTotalSales);
        setOrderProfit(monthGrossProfit);
      } catch (e) {
        console.error("Failed to read order revenues for calculator:", e);
      }
    };
    fetchYield();
  }, [calcMonth, expensesList, paymentsList]);

  // Trigger Notifications Helpers
  const triggerSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setErrorMsg(null);
    showNotification("সফলতা (Success)", msg, "success");
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  const triggerError = (msg: string, err?: any) => {
    setErrorMsg(msg);
    setSuccessMsg(null);
    if (err) {
      showError("ত্রুটি দেখা দিয়েছে (Error)", err, msg);
    } else {
      showNotification("ত্রুটি (Error)", msg, "error");
    }
    setTimeout(() => setErrorMsg(null), 7000);
  };

  // Staff registration form submit handler
  const handleStaffSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!staffName || !staffPhone || !staffSalary) {
      triggerError("সবুজ চিহ্নিত বাধ্যতামূলক ঘরগুলি পূরণ করুন!");
      return;
    }

    setActionLoading(true);
    try {
      const staffPayload = {
        id: staffPhone.trim(),
        name: staffName.trim(),
        phone: staffPhone.trim(),
        address: staffAddress.trim(),
        salary: Number(staffSalary) || 0,
        duty_hours: Number(staffDutyHours) || 8,
        holidays_weekly: Number(staffHolidays) || 1,
        id_card: staffIdCard.trim(),
        document: staffDocument.trim()
      };

      if (editingStaffId) {
        await dbService.updateStaff(editingStaffId, staffPayload);
        triggerSuccess(`কর্মচারী "${staffName}" এর প্রোফাইল তথ্য সফলভাবে আপডেট হয়েছে!`);
      } else {
        await dbService.createStaff(staffPayload);
        triggerSuccess(`নতুন কর্মচারী "${staffName}" সফলভাবে ডাটাবেজে নথিবদ্ধ হয়েছে!`);
      }

      // Reset form variables
      setEditingStaffId(null);
      setStaffName('');
      setStaffPhone('');
      setStaffAddress('');
      setStaffSalary('');
      setStaffDutyHours('8');
      setStaffHolidays('1');
      setStaffIdCard('');
      setStaffDocument('');
      setShowStaffForm(false);
    } catch (err: any) {
      triggerError("সংরক্ষণ ব্যর্থ হয়েছে: " + err.message, err);
    } finally {
      setActionLoading(false);
    }
  };

  // Click edit handler for staff
  const startEditStaff = (staff: Staff) => {
    setEditingStaffId(staff.id);
    setStaffName(staff.name);
    setStaffPhone(staff.phone);
    setStaffAddress(staff.address || '');
    setStaffSalary(String(staff.salary));
    setStaffDutyHours(String(staff.duty_hours || '8'));
    setStaffHolidays(String(staff.holidays_weekly || '1'));
    setStaffIdCard(staff.id_card || '');
    setStaffDocument(staff.document || '');
    setShowStaffForm(true);
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  // Click delete handler for staff
  const handleDeleteStaff = (id: string, name: string) => {
    if (!isAdmin) {
      triggerError("অনুমতি নেই: দুঃখিত, শুধুমাত্র অ্যাডমিন ডিলিট করতে পারবেন।");
      return;
    }

    setDeleteModalConfig({
      onConfirm: async () => {
        try {
          await dbService.deleteStaff(id);
          triggerSuccess(`কর্মচারী "${name}" এর সকল রেকর্ড সফলভাবে মুছে ফেলা হয়েছে।`);
        } catch (err: any) {
          triggerError("ডিলেট ব্যর্থ হয়েছে: " + err.message, err);
        }
      },
      title: "কর্মচারী প্রোফাইল মুছে ফেলা (Delete Staff Profile)",
      message: `আপনি কি নিশ্চিতভাবে কর্মচারী "${name}" কে তালিকা থেকে মুছে ফেলতে চান? এই কর্মটি অপরিবর্তনযোগ্য।`,
      itemName: `${name} (ID: ${id})`
    });
    setDeleteModalOpen(true);
  };

  // Salary payout checkout handler (Admin-only payout trigger)
  const handlePayoutSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!showPayoutModal) return;

    setActionLoading(true);
    try {
      const days = Number(payoutDays) || 30;
      const baseSalary = showPayoutModal.salary;
      // Pro-rata wage calculation
      const calculatedAmt = Math.round((baseSalary / 30) * days);

      const paymentPayload: StaffPayment = {
        id: `pay-${showPayoutModal.id}-${payoutMonth}-${Date.now()}`,
        staff_id: showPayoutModal.id,
        staff_name: showPayoutModal.name,
        payment_date: new Date().toISOString(),
        amount: calculatedAmt,
        days_worked: days,
        month_year: payoutMonth,
        notes: payoutNotes.trim()
      };

      await dbService.addStaffPayment(paymentPayload);
      triggerSuccess(`মাসিক বেতন ৳${calculatedAmt} কর্মচারী "${showPayoutModal.name}" কে পরিশোধ করা হয়েছে এবং এটি ব্যয় খাতায় নিবন্ধিত হয়েছে!`);
      
      setShowPayoutModal(null);
      setPayoutNotes('');
      setPayoutDays('30');
    } catch (err: any) {
      triggerError("বেতন পরিশোধ ব্যর্থ হয়েছে: " + err.message, err);
    } finally {
      setActionLoading(false);
    }
  };

  // Expense entry submit handler
  const handleExpenseSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!expAmount || !expDesc) {
      triggerError("ব্যয়ের পরিমাণ এবং সংক্ষিপ্ত বিবরণী অবশ্যই প্রদান করুন!");
      return;
    }

    setActionLoading(true);
    try {
      const expPayload: Expense = {
        id: `exp-${Date.now()}`,
        date: expDate,
        staff_id: expSpenderName === 'Co-founder' ? 'co-founder' : (staffList.find(s => s.name === expSpenderName)?.id || ''),
        staff_name: expSpenderName,
        expense_type: expType,
        amount: Number(expAmount) || 0,
        description: expDesc.trim(),
        created_at: new Date().toISOString(),
        added_by: user.name
      };

      await dbService.addExpense(expPayload);
      triggerSuccess(`ব্যয়ের ভাউচার (৳${expAmount}) সফলভাবে যুক্ত করা হয়েছে!`);

      setExpAmount('');
      setExpDesc('');
      setShowExpenseForm(false);
    } catch (err: any) {
      triggerError("ব্যয় অন্তর্ভুক্তি ব্যর্থ হয়েছে: " + err.message, err);
    } finally {
      setActionLoading(false);
    }
  };

  // Delete expense item
  const handleDeleteExpense = (id: string, detail: string) => {
    if (!isAdmin) {
      triggerError("অনুমতি নেই: দুঃখিত, শুধুমাত্র অ্যাডমিন ডিলিট করতে পারবেন।");
      return;
    }

    const currentExp = expensesList.find(e => e.id === id);

    setDeleteModalConfig({
      onConfirm: async () => {
        try {
          await dbService.deleteExpense(id);
          triggerSuccess("খরচের রেকর্ডটি সফলভাবে ডাটাবেজ থেকে মুছে ফেলা হয়েছে।");
        } catch (e: any) {
          triggerError("মুছে ফেলা অসমাপ্ত ছিল: " + e.message, e);
        }
      },
      title: "খরচ রেকর্ড মুছে ফেলা (Delete Expense Record)",
      message: "আপনি কি সত্যিই এই খরচের রেকর্ডটি মুছে ফেলতে চান? এটি রিভার্স করা যাবে না।",
      itemName: currentExp ? `Type: ${currentExp.expense_type} - Detail: ${detail} - Amount: ৳${currentExp.amount}` : detail
    });
    setDeleteModalOpen(true);
  };

  // Calculate filtered lists
  const monthlySalaryWagesTotal = paymentsList
    .filter(p => p.month_year === calcMonth)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const monthlyOtherExpensesTotal = expensesList
    .filter(e => e.date.startsWith(calcMonth) && e.expense_type !== 'Salary Payout')
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const trueNetProfitValue = orderProfit - monthlySalaryWagesTotal - monthlyOtherExpensesTotal;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Visual Hub Title Banner */}
      <div className="bg-white border border-bento-border p-5 rounded-bento shadow-bento flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-bento-primary flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" />
            ভেতরের কর্মচারী হাব এবং খরচ খাতা (Staff & Cost Center)
          </h2>
          <p className="text-xs text-bento-muted font-sans mt-0.5 font-semibold">
            Manage permanent staff records, disburse monthly wages, record co-founder advances, and track monthly net profit.
          </p>
        </div>

        {/* Tab Selection Navigation */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50 w-full md:w-auto self-stretch md:self-auto shrink-0 select-none">
          <button
            onClick={() => setActiveTab('staff')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'staff' 
                ? 'bg-bento-primary text-white shadow-bento' 
                : 'text-bento-muted hover:text-bento-primary'
            }`}
          >
            <Users className="w-4 h-4" />
            কর্মচারী তালিকা ({staffList.length})
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'expenses' 
                ? 'bg-bento-primary text-white shadow-bento' 
                : 'text-bento-muted hover:text-bento-primary'
            }`}
          >
            <Coins className="w-4 h-4" />
            খরচ এবং মালিক ড্র উইথড্র
          </button>
          <button
            onClick={() => setActiveTab('calculator')}
            className={`flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'calculator' 
                ? 'bg-bento-primary text-white shadow-bento' 
                : 'text-bento-muted hover:text-bento-primary'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            লাভ ক্যালকুলেটর
          </button>
        </div>
      </div>

      {/* Persistent Notification Toasts */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold p-4 rounded-xl flex items-center gap-2.5 shadow-sm">
          <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold p-4 rounded-xl flex items-center gap-2.5 shadow-sm">
          <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* TAB CONTENT: 1. Staff Logs */}
      {activeTab === 'staff' && (
        <div className="space-y-6">

          {/* Form Trigger Row */}
          <div className="flex justify-between items-center bg-white p-4 border border-bento-border rounded-bento">
            <div>
              <span className="font-bold text-xs text-bento-muted block uppercase tracking-wider">Scale Operations</span>
              <span className="font-sans text-xs text-slate-400">Add staff workers with custom salary, address, duty cycles, and photo-id files.</span>
            </div>
            
            <button
              onClick={() => {
                setEditingStaffId(null);
                setStaffName('');
                setStaffPhone('');
                setStaffAddress('');
                setStaffSalary('');
                setStaffDutyHours('8');
                setStaffHolidays('1');
                setStaffIdCard('');
                setStaffDocument('');
                setShowStaffForm(!showStaffForm);
              }}
              className="px-4 py-2 bg-bento-primary hover:bg-bento-primary-light text-white font-bold text-xs rounded-bento shadow-bento flex items-center gap-2 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              {showStaffForm ? 'ফরম বন্ধ করুন' : 'নতুন কর্মচারী যুক্ত করুন'}
            </button>
          </div>

          {/* Collapsible Add/Edit Staff Form */}
          {showStaffForm && (
            <form onSubmit={handleStaffSubmit} className="bg-white p-6 border-2 border-bento-primary/30 rounded-bento shadow-bento grid grid-cols-1 md:grid-cols-2 gap-4">
              <h3 className="text-sm font-bold text-bento-primary uppercase tracking-wider col-span-1 md:col-span-2 border-b border-bento-border pb-2 mb-2 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-600" />
                {editingStaffId ? 'কর্মচারীর তথ্য সংশোধন করুন (Edit Profile)' : 'নতুন কর্মচারীর প্রোফাইল ফর্ম (Add New Employee)'}
              </h3>

              <div>
                <label className="block text-xs font-bold text-bento-muted mb-1">পূর্ণ নাম (Employee Full Name) *</label>
                <input
                  type="text"
                  required
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  placeholder="উদাঃ সেলিম মিয়া"
                  className="w-full bg-bento-bg border border-bento-border p-2.5 rounded-xl text-xs font-bold focus:outline-emerald-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-bento-muted mb-1">মোবাইল নম্বর (Phone Number) *</label>
                <input
                  type="text"
                  required
                  placeholder="উদাঃ 01712345678"
                  value={staffPhone}
                  onChange={(e) => setStaffPhone(e.target.value)}
                  disabled={!!editingStaffId} // Phone is ID, disable on editing
                  className="w-full bg-bento-bg border border-bento-border p-2.5 rounded-xl text-xs font-bold focus:outline-emerald-600 outline-none disabled:opacity-40"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-bento-muted mb-1">মাসিক মূল বেতন (Monthly base salary) *</label>
                <input
                  type="number"
                  required
                  value={staffSalary}
                  onChange={(e) => setStaffSalary(e.target.value)}
                  placeholder="উদাঃ 25000"
                  className="w-full bg-bento-bg border border-bento-border p-2.5 rounded-xl text-xs font-bold focus:outline-emerald-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-bento-muted mb-1">দৈনিক কাজের ঘন্টা (Duty Hours)</label>
                <input
                  type="number"
                  value={staffDutyHours}
                  onChange={(e) => setStaffDutyHours(e.target.value)}
                  placeholder="উদাঃ 8"
                  className="w-full bg-bento-bg border border-bento-border p-2.5 rounded-xl text-xs font-bold focus:outline-emerald-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-bento-muted mb-1">সাপ্তাহিক ছুটি (Weekly Holidays)</label>
                <input
                  type="number"
                  value={staffHolidays}
                  onChange={(e) => setStaffHolidays(e.target.value)}
                  placeholder="উদাঃ 1"
                  className="w-full bg-bento-bg border border-bento-border p-2.5 rounded-xl text-xs font-bold focus:outline-emerald-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-bento-muted mb-1">বাসার ঠিকানা (Residential Address)</label>
                <input
                  type="text"
                  value={staffAddress}
                  onChange={(e) => setStaffAddress(e.target.value)}
                  placeholder="উদাঃ ঢাকা, মিরপুর-১০"
                  className="w-full bg-bento-bg border border-bento-border p-2.5 rounded-xl text-xs font-bold focus:outline-emerald-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-bento-muted mb-1">জাতীয় পরিচয়পত্র এনআইডি নম্বর (ID Card / NID)</label>
                <input
                  type="text"
                  value={staffIdCard}
                  onChange={(e) => setStaffIdCard(e.target.value)}
                  placeholder="উদাঃ 19932619..."
                  className="w-full bg-bento-bg border border-bento-border p-2.5 rounded-xl text-xs font-bold focus:outline-emerald-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-bento-muted mb-1">অন্যান্য নথিপত্র / ফাইল বিবরণী (Document Log)</label>
                <input
                  type="text"
                  value={staffDocument}
                  onChange={(e) => setStaffDocument(e.target.value)}
                  placeholder="ফাইল লিংক অথবা প্রয়োজনীয় কাজের নথি"
                  className="w-full bg-bento-bg border border-bento-border p-2.5 rounded-xl text-xs font-bold focus:outline-emerald-600 outline-none"
                />
              </div>

              <div className="col-span-1 md:col-span-2 flex justify-end gap-3 mt-2 border-t border-bento-border pt-4">
                <button
                  type="button"
                  onClick={() => setShowStaffForm(false)}
                  className="px-4.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-bento transition-all cursor-pointer"
                >
                  বাতিল করুন
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5.5 py-2.5 bg-bento-success hover:bg-emerald-700 text-white font-bold text-xs rounded-bento shadow-bento flex items-center gap-2 transition-all cursor-pointer disabled:opacity-45"
                >
                  {actionLoading ? 'সংরক্ষণ করা হচ্ছে...' : 'প্রোফাইল সংরক্ষণ করুন'}
                </button>
              </div>
            </form>
          )}

          {/* Staff Grid Cards View */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {staffList.length === 0 ? (
              <div className="bg-white border border-bento-border rounded-bento p-12 text-center col-span-1 md:col-span-3">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h4 className="font-bold text-slate-700 mb-1">কোনো কর্মচারী তথ্য পাওয়া যায়নি!</h4>
                <p className="text-xs text-bento-muted">সিস্টেমে এখনও কোনো কর্মী যুক্ত করা হয়নি। নতুন কর্মচারী ফর্ম ব্যবহার করে ফার্স্ট এন্ট্রি করুন।</p>
              </div>
            ) : (
              staffList.map((staff) => {
                const isSelected = selectedStaffId === staff.id;
                const staffPayments = paymentsList.filter(p => p.staff_id === staff.id);
                const totalPaidWages = staffPayments.reduce((sum, p) => sum + p.amount, 0);

                return (
                  <div key={staff.id} className="bg-white border border-bento-border rounded-bento hover:shadow-bento transition-all overflow-hidden flex flex-col justify-between">
                    
                    {/* Card Head */}
                    <div className="p-5 border-b border-bento-border space-y-2.5 bg-gradient-to-r from-emerald-50/10 to-slate-50/10">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-bento-primary/10 text-bento-primary flex items-center justify-center font-bold font-sans">
                            {staff.name.charAt(0)}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm leading-tight">{staff.name}</h4>
                            <p className="text-[10px] text-bento-muted flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              ডিউটি: {staff.duty_hours || 8} ঘণ্টা / সপ্তাহ {staff.holidays_weekly || 1} দিন ছুটি
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 select-none">
                          <span className="bg-bento-bg border border-bento-border text-slate-600 text-xs font-bold font-mono px-2 py-0.5 rounded-full">
                            {staff.phone}
                          </span>
                          {staff.phone && (
                            <a
                              href={`tel:${staff.phone}`}
                              className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-full border border-emerald-100 flex items-center justify-center shrink-0 cursor-pointer shadow-3xs transition-all hover:scale-110"
                              title={`${staff.name} কে সরাসরি কল দিন: ${staff.phone}`}
                            >
                              <Phone className="w-3.5 h-3.5 fill-current/10" />
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Role specific view boundary: Admin vs. Operator */}
                      {isAdmin ? (
                        <div className="bg-bento-bg/75 border border-slate-100 p-2.5 rounded-xl space-y-1 mt-1 text-xs font-semibold leading-relaxed">
                          <div className="flex justify-between items-center text-bento-muted">
                            <span>মাসিক বেসিক বেতন:</span>
                            <span className="font-bold text-bento-primary font-mono">৳{staff.salary.toLocaleString()}</span>
                          </div>
                          {staff.address && (
                            <div className="text-bento-muted flex justify-between items-center text-[10px]">
                              <span>ঠিকানা:</span>
                              <span className="font-sans text-slate-700 font-bold truncate max-w-[150px]">{staff.address}</span>
                            </div>
                          )}
                          {staff.id_card && (
                            <div className="text-bento-muted flex justify-between items-center text-[10px]">
                              <span>এনআইডি / সাধারণ ফাইল:</span>
                              <span className="font-mono text-slate-700 font-bold truncate max-w-[150px]">{staff.id_card}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="bg-slate-50 p-2.5 rounded-xl text-[10px] text-slate-500 font-sans font-semibold flex items-center gap-1.5 justify-center border border-dashed border-slate-200">
                          <Lock className="w-3.5 h-3.5 text-slate-400" />
                          ব্যক্তিগত পেমেন্ট ও ঠিকানা ডাটা এডমিন সুরক্ষিত
                        </div>
                      )}
                    </div>

                    {/* Card Actions & payments summaries (Admin only features) */}
                    <div className="p-4 bg-slate-50/50 border-t border-bento-border flex flex-col gap-2.5">
                      {isAdmin && (
                        <div className="flex justify-between items-center text-[10px] font-bold text-bento-muted">
                          <span>মোট পরিশোধ এ পর্যন্ত:</span>
                          <span className="text-bento-success font-mono font-black">৳{totalPaidWages.toLocaleString()} ({staffPayments.length} বার)</span>
                        </div>
                      )}

                      <div className="flex gap-2">
                        {isAdmin ? (
                          <>
                            <button
                              onClick={() => setShowPayoutModal(staff)}
                              className="flex-1 py-2 bg-bento-accent hover:bg-amber-500 text-bento-primary font-bold text-[10px] rounded-lg tracking-wide shadow-xs flex items-center justify-center gap-1.5 cursor-pointer select-none"
                            >
                              <DollarSign className="w-3 h-3" />
                              বেতন দিন (Pay Salary)
                            </button>
                            <button
                              onClick={() => setSelectedStaffId(isSelected ? null : staff.id)}
                              className="px-3 py-2 bg-white border border-bento-border text-slate-700 hover:bg-slate-50 font-bold text-[10px] rounded-lg leading-none"
                              title="পেমেন্ট রেকর্ড দেখতে ক্লিক করুন"
                            >
                              {isSelected ? 'রেকর্ড বন্ধ করুন' : 'ইতিহাস'}
                            </button>
                            <button
                              onClick={() => startEditStaff(staff)}
                              className="p-2 bg-white border border-bento-border hover:bg-slate-100 rounded-lg text-slate-600"
                              title="সম্পাদনা করুন"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteStaff(staff.id, staff.name)}
                              className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg border border-rose-200"
                              title="ডিলিট কর্মচারী"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          // Operators can only click Whatsapp ping or notify
                          <a
                            href={`https://wa.me/${staff.phone}`}
                            target="_blank"
                            rel="noreferrer"
                            className="w-full py-2 bg-emerald-600 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 hover:bg-emerald-700"
                          >
                            💬 হোয়াটসঅ্যাপে পিন করুন ({staff.name})
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Collapsible Payment Ledger History (Expanded details below card) */}
                    {isAdmin && isSelected && (
                      <div className="border-t border-bento-border bg-amber-50/15 p-4 space-y-2 max-h-48 overflow-y-auto font-sans">
                        <div className="text-[10px] font-bold text-bento-primary border-b border-amber-200/50 pb-1 flex items-center justify-between">
                          <span>📊 বেতন প্রদানের ইতিহাস ({staff.name})</span>
                          <span className="text-[9px] font-mono font-bold text-bento-muted">১০ বছরের রেকর্ড লগ সমর্থিত</span>
                        </div>
                        {staffPayments.length === 0 ? (
                          <p className="text-[10px] text-slate-400 italic">এখনও পেমেন্ট ভাউচার জেনারেট করা হয়নি।</p>
                        ) : (
                          <div className="space-y-2">
                            {staffPayments.map((p) => (
                              <div key={p.id} className="bg-white border border-slate-200/50 p-2 rounded-lg text-[10px] flex justify-between items-center">
                                <div className="space-y-0.5">
                                  <div className="font-bold text-slate-800">
                                    মাস: <span className="font-mono bg-slate-100 px-1 rounded-xs">{p.month_year}</span> ({p.days_worked} দিন ডিউটি)
                                  </div>
                                  <div className="text-slate-400 text-[9px] leading-3 flex items-center gap-0.5">
                                    <Calendar className="w-2.5 h-2.5" /> {new Date(p.payment_date).toLocaleDateString('bn-BD')}
                                    {p.notes && <span className="text-bento-primary"> • {p.notes}</span>}
                                  </div>
                                </div>
                                <span className="font-bold text-bento-primary font-mono bg-emerald-100/50 px-2.5 py-1 rounded-sm">
                                  ৳{p.amount.toLocaleString()}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT: 2. Expense Ledger & Co-founder drawing registry */}
      {activeTab === 'expenses' && (
        <div className="space-y-6">
          
          {/* Top Form Trigger */}
          <div className="flex justify-between items-center bg-white p-4 border border-bento-border rounded-bento">
            <div>
              <span className="font-bold text-xs text-bento-muted block uppercase tracking-wider">Log Everyday Operations Spend</span>
              <span className="font-sans text-xs text-slate-400">Record cash draws, daily shipping fuel, packaging items, co-founder deposits, etc.</span>
            </div>
            
            <button
              onClick={() => {
                setExpAmount('');
                setExpDesc('');
                setShowExpenseForm(!showExpenseForm);
              }}
              className="px-4 py-2 bg-bento-primary hover:bg-bento-primary-light text-white font-bold text-xs rounded-bento shadow-bento flex items-center gap-2 transition-all cursor-pointer"
            >
              <Coins className="w-4 h-4" />
              {showExpenseForm ? 'খরচ ফর্ম বন্ধ করুন' : 'নতুন খরচ যোগ করুন / মালিক উইথড্র'}
            </button>
          </div>

          {/* Spend Vouchers Form */}
          {showExpenseForm && (
            <form onSubmit={handleExpenseSubmit} className="bg-white p-6 border-2 border-bento-primary/30 rounded-bento shadow-bento grid grid-cols-1 md:grid-cols-3 gap-4">
              <h3 className="text-sm font-bold text-bento-primary uppercase tracking-wider col-span-1 md:col-span-3 border-b border-bento-border pb-2 mb-2 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-600" />
                দৈনিক খরচ ও কো-ফাউন্ডার উইথড্র ভাউচার এন্ট্রি (Expense Form)
              </h3>

              <div>
                <label className="block text-xs font-bold text-bento-muted mb-1">খরচকারী ব্যক্তি (Spender / Beneficiary) *</label>
                <select
                  value={expSpenderName}
                  onChange={(e) => setExpSpenderName(e.target.value)}
                  className="w-full bg-bento-bg border border-bento-border p-2.5 rounded-xl text-xs font-bold focus:outline-emerald-600 outline-none"
                >
                  <option value="Co-founder">কো-ফাউন্ডার (Co-founder / Partner Withdraw)</option>
                  <option value="Office Costs">অফিস এবং বিবিধ সাধারণ ব্যায় (General Expenses)</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.name}>{s.name} (কর্মচারী)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-bento-muted mb-1">ক্যাটাগরি / प्रकार (Expense Category) *</label>
                <select
                  value={expType}
                  onChange={(e) => setExpType(e.target.value)}
                  className="w-full bg-bento-bg border border-bento-border p-2.5 rounded-xl text-xs font-bold focus:outline-emerald-600 outline-none"
                >
                  <option value="Daily Cost">দৈনিক বাজার খরচ (Daily Cost)</option>
                  <option value="Accommodation">আবাসন বা হোটেল বিল (Accommodation)</option>
                  <option value="Vehicle Charges">যানবাহন ও ফুয়েল খরচ (Vehicle Charges)</option>
                  <option value="Co-founder Withdraw">ফাউন্ডার বা মালিক উইথড্র (Co-founder Withdraw)</option>
                  <option value="Co-founder Spend">কো-ফাউন্ডার / এডমিন ব্যয় (Co-founder Spend)</option>
                  <option value="Staff Advance">কর্মচারী অগ্রিম (Staff Advance)</option>
                  <option value="Office Utility">অফিস বিদ্যুৎ ও ইউটিলিটি বিল (Office Utility)</option>
                  <option value="Packaging Costs">প্যাকেজিং ও ব্যাগ সামগ্রী (Packaging Cost)</option>
                  <option value="Discounts Given">ডিসকাউন্ট / অফার কাটতি (Discounts Given)</option>
                  <option value="Food Allowances">খাবার ভাতা (Food Allowance)</option>
                  <option value="Entertainment">আপ্যায়ন এবং চা-নাস্তা খরচ (Entertainment)</option>
                  <option value="Equipment Purchase">যন্ত্রপাতি বা গ্যাজেট ক্রয় (Equipment Purchase)</option>
                  <option value="Other Spend">অন্যান্য ওভারহেড হিসাব (Other Spend)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-bento-muted mb-1">টাকার পরিমাণ (Amount BDT) *</label>
                <input
                  type="number"
                  required
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="উদাঃ 120"
                  className="w-full bg-bento-bg border border-bento-border p-2.5 rounded-xl text-xs font-bold focus:outline-emerald-600 outline-none"
                />
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="block text-xs font-bold text-bento-muted mb-1">খরচের বিবরণী (Short Description) *</label>
                <input
                  type="text"
                  required
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  placeholder="উদাঃ চা পান এবং যাতায়াত ভাড়া (took 120 taka today)"
                  className="w-full bg-bento-bg border border-bento-border p-2.5 rounded-xl text-xs font-bold focus:outline-emerald-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-bento-muted mb-1">তারিখ (Date Expense Incurred) *</label>
                <input
                  type="date"
                  required
                  value={expDate}
                  onChange={(e) => setExpDate(e.target.value)}
                  className="w-full bg-bento-bg border border-bento-border p-2.5 rounded-xl text-xs font-bold focus:outline-emerald-600 outline-none"
                />
              </div>

              <div className="col-span-1 md:col-span-3 flex justify-end gap-3 mt-2 border-t border-bento-border pt-4">
                <button
                  type="button"
                  onClick={() => setShowExpenseForm(false)}
                  className="px-4.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-bento transition-all cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5.5 py-2.5 bg-bento-success hover:bg-emerald-700 text-white font-bold text-xs rounded-bento shadow-bento flex items-center gap-2 transition-all cursor-pointer disabled:opacity-45"
                >
                  {actionLoading ? 'ভাউচার যুক্ত হচ্ছে...' : 'ভাউচার জমা দিন'}
                </button>
              </div>
            </form>
          )}

          {/* Ledger Table View */}
          <div className="bg-white border border-bento-border rounded-bento shadow-bento overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-bento-border flex justify-between items-center flex-wrap gap-2">
              <h3 className="text-xs font-extrabold text-bento-primary uppercase tracking-wider">আমাদের অল টাইম হিসাব খাতা (Expenses & Drawings Sheet)</h3>
              <span className="text-[10px] text-slate-400 font-bold">আইটেম সংখ্যা: {expensesList.length} টি</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase font-mono border-b border-bento-border">
                    <th className="py-3 px-4.5">তারিখ (Date)</th>
                    <th className="py-3 px-4.5">ব্যক্তি / খাত (Spent By)</th>
                    <th className="py-3 px-4.5">ধরণ (Category)</th>
                    <th className="py-3 px-4.5">বিবরণ (Description)</th>
                    <th className="py-3 px-4.5 text-right">পরিমাণ (Amount BDT)</th>
                    {isAdmin && <th className="py-3 px-4.5 text-right">অ্যাকশন</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-150 text-xs font-semibold text-slate-700">
                  {expensesList.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 6 : 5} className="py-12 px-4.5 text-center text-slate-400 italic">
                        হিসাব খাতায় এখনও কোনো খরচের এন্ট্রি করা হয়নি।
                      </td>
                    </tr>
                  ) : (
                    expensesList.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 px-4.5 font-mono text-slate-500">
                          {exp.date}
                        </td>
                        <td className="py-3.5 px-4.5 text-slate-900 font-bold">
                          {exp.staff_name}
                        </td>
                        <td className="py-3.5 px-4.5">
                          <span className={`inline-block text-[9px] px-2 py-0.5 rounded-full font-mono font-bold ${
                            exp.expense_type === 'Co-founder Withdraw' 
                              ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                              : exp.expense_type === 'Salary Payout' 
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-150 text-slate-700 border border-slate-200'
                          }`}>
                            {exp.expense_type}
                          </span>
                        </td>
                        <td className="py-3.5 px-4.5 text-slate-600 max-w-xs truncate font-sans">
                          {exp.description}
                        </td>
                        <td className="py-3.5 px-4.5 text-right font-mono text-bento-primary font-black">
                          ৳{exp.amount.toLocaleString()}
                        </td>
                        {isAdmin && (
                          <td className="py-3.5 px-4.5 text-right">
                            <button
                              onClick={() => handleDeleteExpense(exp.id, exp.description)}
                              className="p-1 px-2.5 text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-lg text-[10px] font-bold"
                              title="খরচ রিমুভ করুন"
                            >
                              রিমুভ
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* TAB CONTENT: 3. লাভ ক্যালকুলেটর (Dynamic Profit and Spend Calculator) */}
      {activeTab === 'calculator' && (
        <div className="space-y-6">

          {/* Month Filter Picker card */}
          <div className="bg-white border border-bento-border p-4.5 rounded-bento flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="font-bold text-xs text-bento-muted block uppercase tracking-wider">Integrated Accountant</span>
              <span className="font-sans text-xs text-slate-400">Select Month to calculate structural yield balancing revenues, payouts, and drawing slips.</span>
            </div>

            <div className="flex items-center gap-2 self-stretch sm:self-auto">
              <span className="text-xs font-bold text-bento-primary">মাস নির্বাচন করুন:</span>
              <input
                type="month"
                value={calcMonth}
                onChange={(e) => setCalcMonth(e.target.value)}
                className="bg-slate-50 border border-bento-border p-2 rounded-xl text-xs font-bold outline-emerald-600 caret-emerald-600"
              />
            </div>
          </div>

          {/* Dynamic Comparison Overview Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-white border border-bento-border p-5 rounded-bento shadow-xs">
              <div className="text-[10px] font-bold text-bento-muted uppercase tracking-wider mb-1">মোট অর্ডার বিক্রয় ({calcMonth})</div>
              <div className="text-xl font-mono font-extrabold text-slate-800">৳{orderIncome.toLocaleString()}</div>
              <p className="text-[10px] text-slate-400 mt-1 leading-normal font-sans font-semibold">সকল সফল আর্ডার বিক্রয় এর যোগফল (রিটার্ন বাদে)</p>
            </div>

            <div className="bg-white border border-bento-border p-5 rounded-bento shadow-xs">
              <div className="text-[10px] font-bold text-bento-muted uppercase tracking-wider mb-1">গ্রস অর্ডার লাভ (Gross Order Profit)</div>
              <div className="text-xl font-mono font-extrabold text-slate-800">৳{orderProfit.toLocaleString()}</div>
              <p className="text-[10px] text-slate-400 mt-1 leading-normal font-sans font-semibold">মোট বিক্রয় মাইনাস কৃষকের টাকা, লজিস্টিকস ও পণ্য খরচ</p>
            </div>

            <div className="bg-white border border-bento-border p-5 rounded-bento shadow-xs">
              <div className="text-[10px] font-bold text-rose-500 uppercase tracking-wider mb-1">মোট মাসিক ব্যয় ও ড্রইংস</div>
              <div className="text-xl font-mono font-extrabold text-rose-600">৳{(monthlySalaryWagesTotal + monthlyOtherExpensesTotal).toLocaleString()}</div>
              <p className="text-[10px] text-rose-400 mt-1 leading-normal font-sans font-semibold">বেতন (৳{monthlySalaryWagesTotal.toLocaleString()}) + দৈনিক বিবিধ খরচ (৳{monthlyOtherExpensesTotal.toLocaleString()})</p>
            </div>

            <div className={`border p-5 rounded-bento shadow-bento ${
              trueNetProfitValue >= 0 
                ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 border-emerald-500 text-white' 
                : 'bg-gradient-to-br from-rose-500 to-rose-600 border-rose-500 text-white'
            }`}>
              <div className="text-[10px] font-bold text-white/80 uppercase tracking-widest mb-1 flex items-center gap-1">
                {trueNetProfitValue >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                প্রকৃত নীট লাভ (Net Profit)
              </div>
              <div className="text-2xl font-mono font-black">৳{trueNetProfitValue.toLocaleString()}</div>
              <p className="text-[10px] text-white/80 mt-1 leading-normal font-sans font-semibold">গ্রস লাভ মাইনাস স্টাফ স্যালারি এবং মালিকদের তোলা টাকা</p>
            </div>

          </div>

          {/* Interactive Calculator playground simulating business targets */}
          <div className="bg-white p-5 border border-bento-border rounded-bento shadow-bento space-y-4">
            <h3 className="text-sm font-bold text-bento-primary uppercase tracking-wider border-b border-bento-border pb-2 flex items-center gap-1.5">
              <FileCheck className="w-4.5 h-4.5 text-emerald-600" />
              ব্যবসার প্রজেকশন ক্যাশফ্লো ক্যালকুলেটর (Cashflow Projection Playground)
            </h3>

            <p className="text-xs text-bento-muted leading-relaxed max-w-3xl">
              নিচে আপনার আনুমানিক টার্গেটের সাপেক্ষে প্রজেকশন হিসাব ট্র্যাকার দেওয়া হলো। যদি আপনি এই মাসে ১ লাখ টাকার লাভ অর্জন করতে চান, তাহলে কোন প্যারামিটার কেমন হতে হবে তা পরীক্ষা করতে নিচের স্লাইডারগুলি পরিবর্তন করুন:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 font-semibold">
              <div className="space-y-1.5">
                <span className="text-xs text-bento-muted block">১. টার্গেট ক্যাশব্যাক অর্ডার প্রফিট (৳) :</span>
                <input
                  type="range"
                  min="30000"
                  max="500000"
                  step="5000"
                  value={orderProfit || 100000}
                  disabled // Binded to live month order profit for accurate dashboard comparison
                  className="w-full text-emerald-600 accent-emerald-600 cursor-not-allowed"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-400">
                  <span>লাইভ ডাটা রিড:</span>
                  <span className="font-bold text-slate-800">৳{orderProfit.toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs text-bento-muted block">২. টার্গেট মোট স্টাফ মান্থলি বেতন (৳) :</span>
                <input
                  type="range"
                  min="0"
                  max="200000"
                  step="5000"
                  value={monthlySalaryWagesTotal || 35000}
                  disabled
                  className="w-full text-emerald-600 accent-emerald-600 cursor-not-allowed"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-400">
                  <span>লাইভ বেতন পেমেন্ট:</span>
                  <span className="font-bold text-slate-800">৳{monthlySalaryWagesTotal.toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs text-bento-muted block">৩. অন্যান্য উত্তোলন ও মালিক ড্রইংস (৳) :</span>
                <input
                  type="range"
                  min="0"
                  max="100000"
                  step="1000"
                  value={monthlyOtherExpensesTotal || 10000}
                  disabled
                  className="w-full text-emerald-600 accent-emerald-600 cursor-not-allowed"
                />
                <div className="flex justify-between text-[10px] font-mono text-slate-400">
                  <span>লাইভ উত্তোলন ব্যয়:</span>
                  <span className="font-bold text-slate-800">৳{monthlyOtherExpensesTotal.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-start gap-3 mt-4">
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-600 leading-normal font-sans">
                💡 <span className="font-bold text-slate-800">অটোলিংক সক্রিয়:</span> আপনার টার্গেট প্যারামিটারগুলি সম্পূর্ণভাবে লাইভ ডাটাবেজের সাথে সিনক্রোনাইজড। অ্যাডমিন প্যানেলে কর্মচারী স্যালারি পরিবর্তন করা অথবা দৈনিক উইথড্র রেকর্ড করার সাথে সাথেই উপরের তুলনা ছক এবং এই প্রকৃত নীট লাভ স্বয়ংক্রিয়ভাবে পুনঃসংখ্যাকরণ হয়ে যায়। কোড ফাইল পরিবর্তন করার কোনো প্রয়োজন নেই।
              </div>
            </div>

          </div>

        </div>
      )}

      {/* ADMIN-ONLY PAYOUT MODAL SHEET */}
      {isAdmin && showPayoutModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-40">
          <form onSubmit={handlePayoutSubmit} className="bg-white border-2 border-bento-accent max-w-md w-full rounded-bento p-6 shadow-2xl space-y-4 text-slate-800 font-sans">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">বেতন প্রদান ভাউচার (Salary Checkout Payout)</h3>
                <p className="text-[10px] text-slate-400">বেতন প্রদানের সাথে সাথেই এই রেকর্ড ব্যয় খাতায় স্বয়ংক্রিয় যুক্ত হবে।</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPayoutModal(null)}
                className="p-1 hover:bg-slate-150 rounded-lg text-slate-400 text-xs font-bold font-mono"
              >
                ✕
              </button>
            </div>

            <div className="bg-bento-bg p-3.5 rounded-xl border border-bento-border text-xs leading-relaxed space-y-1.5 font-semibold">
              <div className="flex justify-between text-slate-500">
                <span>প্রাপক কর্মচারী:</span>
                <span className="font-bold text-slate-800">{showPayoutModal.name} ({showPayoutModal.phone})</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>মাসিক অল টাইম রেট:</span>
                <span className="font-bold text-bento-primary">৳{showPayoutModal.salary.toLocaleString()}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-bento-muted mb-1">কত দিনের কাজ / ডিউটি সম্পন্ন করেছেন? *</label>
              <input
                type="number"
                min="1"
                max="31"
                required
                value={payoutDays}
                onChange={(e) => setPayoutDays(e.target.value)}
                placeholder="উদাঃ 30 অথবা 25 দিন"
                className="w-full bg-bento-bg border border-bento-border p-2.5 rounded-xl text-xs font-bold focus:outline-emerald-600 outline-none"
              />
              <p className="text-[10px] text-indigo-600 mt-1">
                {payoutDays && `প্রো-রাটা সূত্রানুযায়ী হিসাব: (৳${showPayoutModal.salary} মাসিক বেতন / ৩০ দিন) × ${payoutDays} দিন = ৳${Math.round((showPayoutModal.salary / 30) * Number(payoutDays)).toLocaleString()}`}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-bold text-bento-muted mb-1">কোন মাসের বেতন? *</label>
                <input
                  type="month"
                  required
                  value={payoutMonth}
                  onChange={(e) => setPayoutMonth(e.target.value)}
                  className="w-full bg-bento-bg border border-bento-border p-2.5 rounded-xl text-xs font-bold focus:outline-emerald-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-bento-muted mb-1">অ্যাডমিন খসড়া মন্তব্য (Notes / Voucher remark)</label>
                <input
                  type="text"
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                  placeholder="উদাঃ নিয়মিত মাসিক সম্পূর্ণ পেমেন্ট"
                  className="w-full bg-bento-bg border border-bento-border p-2.5 rounded-xl text-xs font-bold focus:outline-emerald-600 outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end border-t border-slate-100 pt-4 mt-2">
              <button
                type="button"
                onClick={() => setShowPayoutModal(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-bento cursor-pointer"
              >
                বাতিল করুন
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="px-5.5 py-2.5 bg-bento-success hover:bg-emerald-700 text-white font-bold text-xs rounded-bento shadow-bento flex items-center gap-1.5 cursor-pointer disabled:opacity-45"
              >
                {actionLoading ? 'রিলিজিং...' : 'বেতন রসিদ নিশ্চিত করুন'}
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
    </div>
  );
}
