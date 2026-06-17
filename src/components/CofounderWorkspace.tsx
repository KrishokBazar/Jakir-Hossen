import { useEffect, useState, FormEvent } from 'react';
import { dbService } from '../db';
import { Profile, CofounderNote, Order, Expense } from '../types';
import { useNotification } from './NotificationContext';
import { 
  Briefcase, 
  TrendingUp, 
  Coins, 
  DollarSign, 
  PlusCircle, 
  Trash2, 
  Edit3, 
  FileText, 
  Save, 
  X, 
  Calendar, 
  Award, 
  CheckCircle, 
  LayoutDashboard,
  Percent,
  Calculator,
  RefreshCw
} from 'lucide-react';

interface CofounderWorkspaceProps {
  user: Profile;
}

export default function CofounderWorkspace({ user }: CofounderWorkspaceProps) {
  const { showError, showNotification } = useNotification();
  const [notes, setNotes] = useState<CofounderNote[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // States for adding a plan
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [processing, setProcessing] = useState(false);

  // States for editing a plan
  const [editingNote, setEditingNote] = useState<CofounderNote | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  // Loaded stats
  const [stats, setStats] = useState({
    totalSales: 0,
    totalProfit: 0,
    totalExpenses: 0,
    profitMargin: 0,
  });

  const loadStatsAndNotes = async () => {
    setLoading(true);
    try {
      // Calculate from live collections
      const liveOrders = await dbService.getOrders();
      const liveExpenses = await dbService.getExpenses();
      setOrders(liveOrders);
      setExpenses(liveExpenses);

      let totalSalesSum = 0;
      let totalProfitSum = 0;
      liveOrders.forEach(o => {
        if (o.status === 'delivery') {
          totalSalesSum += Number(o.amount || 0);
          totalProfitSum += Number(o.profit || 0);
        } else if (o.status === 'return') {
          // Subtract return values if applicable
          totalProfitSum += Number(o.profit || 0); // profit is calculated as negative during return in standard system
        }
      });

      let totalExpensesSum = 0;
      liveExpenses.forEach(e => {
        totalExpensesSum += Number(e.amount || 0);
      });

      const netProfit = totalProfitSum - totalExpensesSum;
      const margin = totalSalesSum > 0 ? (netProfit / totalSalesSum) * 100 : 0;

      setStats({
        totalSales: totalSalesSum,
        totalProfit: netProfit,
        totalExpenses: totalExpensesSum,
        profitMargin: Math.round(margin * 10) / 10
      });
    } catch (err) {
      console.error("Cofounder stats load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatsAndNotes();

    // Subscribe to Co-Founder Notes real-time
    const unsubscribeNotes = dbService.subscribeCofounderNotes(
      (liveNotes) => {
        setNotes(liveNotes);
      },
      (err) => {
        console.error("Cofounder notes subscribe error:", err);
      }
    );

    return () => {
      unsubscribeNotes();
    };
  }, []);

  const handleAddNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) {
      showNotification("সতর্কতা", "শিরোনাম এবং বর্ণনা পূরণ করুন।", "warning");
      return;
    }
    setProcessing(true);
    try {
      await dbService.addCofounderNote(newTitle.trim(), newContent.trim());
      showNotification("সফল হয়েছে", "নতুন স্ট্র্যাটেজিক পরিকল্পনা সফলভাবে সংরক্ষণ করা হয়েছে।", "success");
      setNewTitle('');
      setNewContent('');
      setShowAddForm(false);
    } catch (err: any) {
      showError("সংরক্ষণ ব্যর্থ হয়েছে", err);
    } finally {
      setProcessing(false);
    }
  };

  const handleUpdateNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingNote) return;
    if (!editTitle.trim() || !editContent.trim()) {
      showNotification("সতর্কতা", "শিরোনাম এবং বর্ণনা পূরণ করতে হবে।", "warning");
      return;
    }
    setProcessing(true);
    try {
      // In Firestore, we delete and re-add or directly write the doc. We have update/setDoc methods.
      // Let's directly delete and add, or updateDoc. Let's look at updating operators or profiles, we do updateDoc.
      // For cofounder_notes we can use updateDoc since it's standard document.
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      const ref = doc(db, 'cofounder_notes', editingNote.id);
      await updateDoc(ref, {
        title: editTitle.trim(),
        content: editContent.trim(),
        updated_at: new Date().toISOString()
      });
      showNotification("আপডেট হয়েছে", "পরিকল্পনা সফলভাবে আপডেট করা হয়েছে।", "success");
      setEditingNote(null);
    } catch (err: any) {
      showError("আপডেট ব্যর্থ হয়েছে", err);
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteNote = async (id: string) => {
    const isConfirmed = confirm("আপনি কি নিশ্চিতভাবে এই স্ট্র্যাটেজিক পরিকল্পনাটি ডিলিট করতে চান?");
    if (!isConfirmed) return;

    try {
      await dbService.deleteCofounderNote(id);
      showNotification("মুছে ফেলা হয়েছে", "পরিকল্পনা ডিলিট করা হয়েছে।", "success");
    } catch (err: any) {
      showError("মুছে ফেলতে ত্রুটি", err);
    }
  };

  const startEdit = (note: CofounderNote) => {
    setEditingNote(note);
    setEditTitle(note.title);
    setEditContent(note.content);
  };

  return (
    <div id="cofounder-workspace" className="space-y-6">
      
      {/* Upper Banner Detail */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-bento border border-slate-800 p-6 shadow-bento flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5 justify-start">
            <div className="h-9 w-9 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Briefcase className="w-5 h-5 animate-pulse" />
            </div>
            <h1 className="text-xl font-extrabold text-white">
              কো-ফাউন্ডার ড্যাশবোর্ড ও স্ট্র্যাটেজিক বিভাগ <span className="text-indigo-300 font-light text-xs tracking-wider block sm:inline sm:ml-2">| Co-Founder Workspace</span>
            </h1>
          </div>
          <p className="text-xs text-slate-300 max-w-xl">
            প্রতিষ্ঠাতা অংশীদার এবং পরিচালনা পর্ষদের জন্য সুরক্ষিত কর্মক্ষেত্র। এখানে সামগ্রিক রিয়েল-টাইম ব্যবসায়িক মার্জিন ট্র্যাক করতে পারবেন এবং নিজস্ব স্ট্র্যাটেজি ও পরিকল্পনা নথিভুক্ত করতে পারবেন।
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={loadStatsAndNotes}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-700 bg-slate-800 hover:bg-slate-750 text-white rounded-bento text-xs font-bold transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> রিলোড ডাটা (Refresh)
          </button>
          
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-4.5 py-3 bg-indigo-650 hover:bg-indigo-600 text-white text-xs font-bold rounded-bento transition-all cursor-pointer shadow-lg border-b-2 border-indigo-850"
          >
            <PlusCircle className="w-4.5 h-4.5 text-indigo-300" />
            <span>নতুন পরিকল্পনা যোগ করুন (Add Strategy)</span>
          </button>
        </div>
      </div>

      {/* Stats Bento Grid Panel */}
      {loading ? (
        <div className="flex justify-center items-center h-24">
          <div className="animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1 */}
          <div className="bg-white border border-slate-200 rounded-bento p-5 shadow-xs hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">মোট বিক্রির পরিমাণ</span>
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-650">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-black text-slate-900">৳ {stats.totalSales.toLocaleString()} BDT</div>
            <p className="text-[10px] text-slate-400 font-semibold mt-1">সমস্ত সফল সাধারণ ডেলিভারি বিক্রয়</p>
          </div>

          {/* Card 2 */}
          <div className="bg-white border border-slate-200 rounded-bento p-5 shadow-xs hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">মোট স্টাফ এবং পরিচালন ব্যয়</span>
              <div className="p-1.5 rounded-lg bg-red-50 text-red-650">
                <Coins className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-black text-slate-900">৳ {stats.totalExpenses.toLocaleString()} BDT</div>
            <p className="text-[10px] text-slate-400 font-semibold mt-1">কমিশন, বেতন এবং সাধারণ অপারেটিং খরচ</p>
          </div>

          {/* Card 3 */}
          <div className="bg-white border border-slate-200 rounded-bento p-5 shadow-xs hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">নিট লভ্যাংশ (Net Yield)</span>
              <div className="p-1.5 rounded-lg bg-blue-50 text-blue-650">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className={`text-xl font-black ${stats.totalProfit >= 0 ? 'text-indigo-650' : 'text-red-650'}`}>
              ৳ {stats.totalProfit.toLocaleString()} BDT
            </div>
            <p className="text-[10px] text-slate-400 font-semibold mt-1">পরিচালন ব্যয় বাদ দিয়ে মোট আয়</p>
          </div>

          {/* Card 4 */}
          <div className="bg-white border border-slate-200 rounded-bento p-5 shadow-xs hover:shadow-md transition-all">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">ব্যবসায়িক মার্জিন</span>
              <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-650">
                <Percent className="w-4 h-4" />
              </div>
            </div>
            <div className="text-xl font-black text-slate-900">{stats.profitMargin}%</div>
            <p className="text-[10px] text-slate-400 font-semibold mt-1">মোট বিক্রির সাপেক্ষে নিট লাভের হার</p>
          </div>

        </div>
      )}

      {/* Add New Strategy Form */}
      {showAddForm && (
        <form onSubmit={handleAddNote} className="bg-white border border-indigo-100 rounded-bento p-5 shadow-bento space-y-4 text-xs">
          <div className="border-b border-slate-100 pb-2.5 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 flex items-center gap-1">
              <Award className="w-4.5 h-4.5 text-indigo-600" /> নতুন কৌশল বা লক্ষ্য যোগ করুন (Add Strategic Entry)
            </h3>
            <button 
              type="button" 
              onClick={() => { setShowAddForm(false); setNewTitle(''); setNewContent(''); }}
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3.5 text-left">
            <div>
              <label className="block text-slate-700 font-bold mb-1">পরিকল্পনার শিরোনাম (Strategy Initiative Title)</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="যেমন: ৩ মাসের পণ্য বাড়ানোর পরিকল্পনা বা নতুন ট্রান্সপোর্ট রুট..."
                className="w-full px-3.5 py-3.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-800"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1">বিস্তারিত পরিকল্পনা বিবরণী (Notice & Blueprint details)</label>
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                placeholder="এখানে আপনার সম্পূর্ণ লক্ষ্য বা পরিকল্পনা ও প্রয়োজনীয় হিসাব-নিকাশ বিস্তারিত লিখুন..."
                rows={4}
                className="w-full px-3.5 py-3.5 bg-slate-50 border border-slate-205 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-slate-800"
                required
              ></textarea>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => { setShowAddForm(false); setNewTitle(''); setNewContent(''); }}
              className="px-4 py-2 text-slate-600 hover:bg-slate-50 border border-slate-250 rounded-lg font-bold cursor-pointer"
              disabled={processing}
            >
              Cancel (বাতিল)
            </button>
            <button
              type="submit"
              disabled={processing}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
            >
              {processing ? "সংরক্ষণ করা হচ্ছে..." : <><Save className="w-4 h-4" /> সংরক্ষণ করুন (Save Strategy)</>}
            </button>
          </div>
        </form>
      )}

      {/* Editing Modal Dialog */}
      {editingNote && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-bento border border-slate-200 shadow-xl overflow-hidden w-full max-w-lg">
            <div className="bg-indigo-950 text-white px-5 py-4 flex items-center justify-between">
              <span className="font-bold text-sm">পরিকল্পনা সংশোধন করুন (Edit Strategic Initiative)</span>
              <button onClick={() => setEditingNote(null)} className="text-slate-400 hover:text-white transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateNote} className="p-5 space-y-4 text-xs text-left">
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">শিরোনাম (Title)</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3.5 py-3 bg-slate-50 border border-slate-205 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5">বিস্তারিত পরিকল্পনা বিবরণী</label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={6}
                  className="w-full px-3.5 py-3 bg-slate-50 border border-slate-205 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                  required
                ></textarea>
              </div>

              <div className="flex gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingNote(null)}
                  className="w-1/2 py-2.5 border border-slate-250 hover:bg-slate-50 rounded-lg font-bold text-slate-600 transition-colors cursor-pointer"
                >
                  Cancel (বাতিল)
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className="w-1/2 py-2.5 bg-indigo-650 hover:bg-indigo-600 text-white font-bold rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-xs"
                >
                  <Save className="w-4 h-4" /> Save (আপডেট করুন)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Co-founder Strategic Goals Wall (Managed by Co-Founder themselves) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-indigo-600 animate-pulse" />
            কো-ফাউন্ডার ম্যানেজমেন্ট ওয়াল (Strategic Management Board)
          </h2>
          <span className="text-[10px] text-indigo-800 font-bold uppercase font-mono bg-indigo-50 px-2.5 py-0.5 rounded-sm">
            {notes.length} Active Records
          </span>
        </div>

        {notes.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200/80 p-12 rounded-xl text-center">
            <FileText className="w-12 h-12 text-slate-350 mx-auto mb-3" />
            <h3 className="text-slate-900 font-bold text-sm">কোনো পরিকল্পনা বা লক্ষ্য নথিভুক্ত নেই</h3>
            <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto">
              নতুন কো-ফাউন্ডার পরিকল্পনা তৈরি করতে উপরের ডান কোণ থেকে ব্লুপ্রিন্ট সহ পরিকল্পনা যোগ করতে পারবেন। এটি প্রতিষ্ঠাতা অংশীদারদের নিজস্ব ব্যবহারের জন্য সংরক্ষিত।
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {notes.map((note) => (
              <div 
                key={note.id} 
                className="bg-white p-5 rounded-bento border border-slate-200 shadow-xs hover:border-indigo-500/20 hover:shadow-md transition-all flex flex-col justify-between text-left"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <h3 className="font-extrabold text-slate-900 text-sm leading-snug">{note.title}</h3>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => startEdit(note)}
                        className="p-1.5 hover:bg-indigo-50 text-indigo-600 rounded-lg block cursor-pointer transition-colors border border-slate-100"
                        title="Edit entry"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg block cursor-pointer transition-colors border border-slate-100"
                        title="Delete entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-slate-650 text-xs leading-relaxed whitespace-pre-wrap font-medium font-sans border-t border-slate-50 pt-2.5">
                    {note.content}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 pt-3.5 mt-3.5 border-t border-slate-100 text-[10px] text-slate-400 font-mono">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>তৈরি করা হয়েছে: {new Date(note.created_at).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
