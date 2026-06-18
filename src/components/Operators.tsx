import { useEffect, useState, FormEvent, ChangeEvent } from 'react';
import { dbService } from '../db';
import { Profile } from '../types';
import { useNotification } from './NotificationContext';
import { Users, CheckCircle, ShieldAlert, Trash2, Smartphone, Calendar, UserCheck, MessageSquare, RefreshCw, Edit3, Key, Lock, X, Save } from 'lucide-react';

interface OperatorsProps {
  onApprovalChange: (count: number) => void;
}

export default function Operators({ onApprovalChange }: OperatorsProps) {
  const { showError, showNotification } = useNotification();
  const [operators, setOperators] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Operator Editing States
  const [editingOperator, setEditingOperator] = useState<Profile | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'operator' | 'cofounder'>('operator');
  const [editPassword, setEditPassword] = useState('');
  const [editApproved, setEditApproved] = useState(true);
  const [editPhotoUrl, setEditPhotoUrl] = useState('');

  const handlePhotoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("ছবিটির সাইজ খুব বড় (অনুগ্রহ করে ২ মেগাবাইটের কম সাইজের ছবি দিন)");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditPhotoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const startEditOperator = (op: Profile) => {
    setEditingOperator(op);
    setEditName(op.name || '');
    setEditPhone(op.phone || op.id || '');
    setEditRole(op.role || 'operator');
    setEditPassword((op as any).password || '');
    setEditApproved(op.approved);
    setEditPhotoUrl(op.photo_url || '');
  };

  const handleSaveOperator = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingOperator) return;
    if (!editName.trim()) {
      showNotification("সতর্কতা", "নাম খালি রাখা যাবে না।", "warning");
      return;
    }
    setProcessingId(editingOperator.id);
    try {
      await dbService.updateOperatorProfile(editingOperator.id, {
        name: editName.trim(),
        phone: editPhone.trim(),
        role: editRole,
        password: editPassword,
        approved: editApproved,
        photo_url: editPhotoUrl || undefined
      });
      showNotification("সফল", "অপারেটর প্রোফাইল সফলভাবে আপডেট করা হয়েছে।", "success");
      setEditingOperator(null);
      await fetchOperators();
    } catch (err: any) {
      showError("প্রোফাইল আপডেট ব্যর্থ হয়েছে", err);
    } finally {
      setProcessingId(null);
    }
  };

  const fetchOperators = async () => {
    setLoading(true);
    try {
      const ops = await dbService.getOperators();
      setOperators(ops);
      
      // Calculate pending counts to update badge in parent
      const pendingCount = ops.filter(op => !op.approved && op.role === 'operator').length;
      onApprovalChange(pendingCount);
    } catch (err) {
      console.error("Error reading operators:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    const unsubscribe = dbService.subscribeOperators(
      (liveOps) => {
        setOperators(liveOps);
        // Calculate pending counts to update badge in parent
        const pendingCount = liveOps.filter(op => !op.approved && op.role === 'operator').length;
        onApprovalChange(pendingCount);
        setLoading(false);
      },
      (err) => {
        console.error("Error listening to operators:", err);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleApprove = async (op: Profile) => {
    setProcessingId(op.id);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await dbService.approveOperator(op.id);
      
      // Calculate pending counts to update badge in parent immediately
      const updatedOps = await dbService.getOperators();
      setOperators(updatedOps);
      const pendingCount = updatedOps.filter(o => !o.approved && o.role === 'operator').length;
      onApprovalChange(pendingCount);
      
      setSuccessMsg(`অপারেটর "${op.name}" সফলভাবে অনুমোদিত হয়েছে এবং সরাসরি লগইন সেশনের সাথে যুক্ত!`);
      showNotification("সফল", `অপারেটর "${op.name}" সফলভাবে অনুমোদিত হয়েছে।`, "success");
      
      // Optionally trigger WhatsApp message notifying operator
      const confirmNotice = confirm(
        `Operator approved on portal! Would you like to launch WhatsApp to notify ${op.name} about their account activation?`
      );
      if (confirmNotice && op.phone) {
        const textMsg = encodeURIComponent(
          `প্রিয় ${op.name},\nকৃষক বাজার অপারেটর পোর্টালে আপনার অ্যাকাউন্টটি সফলভাবে অনুমোদন করা হয়েছে।\n\nআপনি এখন আপনার মোবাইল নম্বর (${op.phone}) এবং সংশ্লিষ্ট পাসওয়ার্ড ব্যবহার করে লগইন করতে পারবেন। ধন্যবাদ!`
        );
        window.open(`https://wa.me/${op.phone}?text=${textMsg}`, '_blank');
      }
    } catch (err: any) {
      setErrorMsg("Approving failed: " + err.message);
      showError("অনুমোদন ব্যর্থ হয়েছে", err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string, name: string) => {
    const isConfirmed = confirm(
      `Are you sure you want to reject/delete operator "${name}"? This removes them from database access.`
    );
    if (!isConfirmed) return;

    setProcessingId(id);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await dbService.rejectOperator(id);
      
      const updatedOps = await dbService.getOperators();
      setOperators(updatedOps);
      const pendingCount = updatedOps.filter(o => !o.approved && o.role === 'operator').length;
      onApprovalChange(pendingCount);

      setSuccessMsg(`অপারেটর "${name}" সফলভাবে বাতিল / মুছে ফেলা হয়েছে।`);
      showNotification("সফল", `অপারেটর "${name}" সফলভাবে বাতিল / মুছে ফেলা হয়েছে।`, "success");
    } catch (err: any) {
      setErrorMsg("Rejection failed: " + err.message);
      showError("বাতিল করতে ব্যর্থ হয়েছে", err);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  // Segment operators
  const pendingOps = operators.filter((op) => !op.approved && op.role === 'operator');
  const approvedOps = operators.filter((op) => op.approved);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" />
            অপারেটর ব্যবস্থাপনা (Operator Management)
          </h2>
          <p className="text-xs text-slate-500">Manage, approve, or disable operators accessing secure marketplace registries.</p>
        </div>
        <button
          onClick={fetchOperators}
          className="p-2.5 text-slate-500 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-250 text-emerald-850 text-xs px-4 py-3 rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2 font-semibold">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            {successMsg}
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-[10px] text-emerald-600 hover:text-emerald-850 font-bold px-2.5 py-1 rounded-md bg-white border border-emerald-150 cursor-pointer">dismiss</button>
        </div>
      )}

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-250 text-rose-850 text-xs px-4 py-3 rounded-xl flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            {errorMsg}
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-[10px] text-rose-600 hover:text-rose-850 font-bold px-2.5 py-1 rounded-md bg-white border border-rose-150 cursor-pointer">dismiss</button>
        </div>
      )}

      {/* Pending Approval Section */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-500" />
          Pending Approvals
          {pendingOps.length > 0 && (
            <span className="bg-amber-150 text-amber-800 text-[10px] uppercase font-bold font-mono px-2 py-0.5 rounded-full">
              {pendingOps.length} Action Needed
            </span>
          )}
        </h3>

        {pendingOps.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 p-6 rounded-xl text-center">
            <p className="text-xs text-slate-500">No operators are currently pending administrator approvals.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingOps.map((op) => (
              <div key={op.id} className="bg-amber-50/40 p-4.5 rounded-xl border border-amber-200 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2 gap-3">
                    <div className="flex items-center gap-2">
                      {op.photo_url ? (
                        <img 
                          src={op.photo_url} 
                          alt={op.name}
                          className="w-10 h-10 rounded-full object-cover border border-amber-200 shadow-xs shrink-0" 
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 font-bold flex items-center justify-center text-xs shrink-0">
                          {op.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <h4 className="font-bold text-slate-900">{op.name}</h4>
                    </div>
                    <span className="bg-amber-100 text-amber-800 text-[9px] uppercase font-bold px-2 py-0.5 rounded-sm shrink-0">
                      PENDING ROLE
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 mb-4">
                    <div className="flex items-center gap-1.5 font-mono">
                      <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                      {op.phone}
                    </div>
                    <div className="flex items-center gap-1.5 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>Registered: {new Date(op.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 border-t border-amber-200 pt-3">
                  <button
                    onClick={() => handleApprove(op)}
                    disabled={processingId !== null}
                    className="w-full px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-450 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    {processingId === op.id ? (
                      <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent animate-spin rounded-full" />
                    ) : (
                      <UserCheck className="w-3.5 h-3.5" />
                    )}
                    {processingId === op.id ? 'Approving...' : 'Approve Operator'}
                  </button>
                  <button
                    onClick={() => handleReject(op.id, op.name)}
                    disabled={processingId !== null}
                    className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 disabled:opacity-50 rounded-lg border border-rose-200 flex items-center justify-center cursor-pointer transition-colors"
                    title="Reject operator"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active/Approved Operators Section */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          Approved Operators, Co-Founders & Admins
        </h3>

        {approvedOps.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 p-6 rounded-xl text-center animate-pulse">
            <p className="text-xs text-slate-500">Wait, no approved operators or admins logged. System startup index seeding issue...</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <table className="min-w-full divide-y divide-slate-100 font-sans">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Staff Name</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Phone / Identifier</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Secured Role</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Password (পাসওয়ার্ড)</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Join Date</th>
                  <th className="px-5 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {approvedOps.map((op) => (
                  <tr key={op.id} className="hover:bg-slate-50/55 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-slate-900">{op.name}</td>
                    <td className="px-5 py-3.5 font-mono text-slate-650">{op.phone || op.email || 'Root Account'}</td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2 py-0.5 rounded-sm font-bold text-[9px] uppercase ${
                        op.role === 'admin' 
                          ? 'bg-purple-100 text-purple-800' 
                          : op.role === 'cofounder' 
                            ? 'bg-indigo-100 text-indigo-800' 
                            : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {op.role}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono font-semibold text-rose-600 bg-rose-50/20 px-2 py-0.5 rounded border border-rose-100/30 max-w-[120px] truncate">
                      {(op as any).password || <span className="text-slate-400 font-sans">Not set / admin override</span>}
                    </td>
                    <td className="px-5 py-3.5 text-slate-450 font-mono">{new Date(op.created_at).toLocaleDateString()}</td>
                    <td className="px-5 py-3.5 text-right">
                      {op.email !== 'ajzakir004@gmail.com' ? (
                        <div className="flex justify-end gap-2">
                          {/* Edit operator button */}
                          <button
                            onClick={() => startEditOperator(op)}
                            className="p-1 px-2 border border-slate-250 rounded-md hover:bg-slate-100 text-slate-600 flex items-center gap-1 cursor-pointer font-bold"
                            title="Edit Operator details"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-blue-500" /> সম্পাদনা (Edit)
                          </button>

                          {/* Force Notify Button via WhatsApp */}
                          {op.phone && (
                            <button
                              onClick={() => {
                                const msg = encodeURIComponent(`অপারেটর নোটিশ: কৃষক বাজারে আপনার অ্যাকাউন্টের অ্যাক্সেস সক্রিয় আছে। লগইন করে এন্ট্রি দিতে পারবেন।`);
                                window.open(`https://wa.me/${op.phone}?text=${msg}`, '_blank');
                              }}
                              className="p-1 px-2 border border-slate-250 rounded-md hover:bg-slate-100 text-slate-600 flex items-center gap-1 cursor-pointer"
                              title="Send Message"
                            >
                              <MessageSquare className="w-3.5 h-3.5 text-slate-500" /> Notify
                            </button>
                          )}

                          <button
                            onClick={() => handleReject(op.id, op.name)}
                            className="p-1 text-rose-600 border border-thin border-rose-200 hover:bg-rose-50 rounded-md cursor-pointer"
                            title="Disable/Delete Operator"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase bg-slate-50 px-2 py-0.5 rounded-sm">Protected</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inline Operator Edit Modal Component */}
      {editingOperator && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-bento border border-slate-200 shadow-xl overflow-hidden w-full max-w-md">
            <div className="bg-slate-950 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-bento-accent" />
                <span className="font-bold text-sm">অপারেটর প্রোফাইল সম্পাদনা (Edit Operator)</span>
              </div>
              <button 
                onClick={() => setEditingOperator(null)} 
                className="text-slate-405 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOperator} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1.5 label text-left">নাম (Staff Name)</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-205 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5 label text-left">ফোন নম্বর / আইডি (Identifier/Phone)</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-100 border border-slate-205 rounded-lg text-slate-500 cursor-not-allowed"
                  disabled
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5 label text-left">পাসওয়ার্ড (Secured Password)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Key className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-205 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono font-bold text-rose-650"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5 label text-left">সিস্টেম রোল (System Role)</label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as any)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-205 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-semibold"
                >
                  <option value="operator">Operator (অপারেটর)</option>
                  <option value="cofounder">Co-Founder (কো-ফাউন্ডার)</option>
                  <option value="admin">Admin (অ্যাডমিন)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1.5 label text-left">অনুমোদন স্ট্যাটাস (Approval Status)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="checkbox-approved"
                    checked={editApproved}
                    onChange={(e) => setEditApproved(e.target.checked)}
                    className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-slate-300 rounded"
                  />
                  <label htmlFor="checkbox-approved" className="font-semibold text-slate-700">অনুমোদিত সেশন এক্সেস (Approved Access)</label>
                </div>
              </div>

              <div className="flex gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingOperator(null)}
                  className="w-1/2 py-2.5 border border-slate-250 hover:bg-slate-50 rounded-lg font-bold text-slate-600 transition-colors cursor-pointer"
                >
                  Cancel (বাতিল)
                </button>
                <button
                  type="submit"
                  disabled={processingId !== null}
                  className="w-1/2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-xs"
                >
                  <Save className="w-4 h-4" /> Save (সংরক্ষণ করুন)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
