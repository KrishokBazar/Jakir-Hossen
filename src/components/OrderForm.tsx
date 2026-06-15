import { useEffect, useState, FormEvent } from 'react';
import { dbService } from '../db';
import { CostSettings, Customer, Profile } from '../types';
import { useNotification } from './NotificationContext';
import { ShoppingCart, Phone, User, MapPin, DollarSign, FileText, CheckCircle, Smartphone } from 'lucide-react';

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

  // Statuses
  const [existingCustomerMatched, setExistingCustomerMatched] = useState<Customer | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
        },
        user.id
      );

      setSubmitSuccess(true);
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
          <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-4 flex items-center gap-1">
            <Smartphone className="w-4 h-4" /> 1. Customer Information
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Phone */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                Phone Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g., 01931355398"
                className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-1.5 focus:ring-emerald-500 text-sm font-sans"
                required
              />
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
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Anisur Rahman"
                disabled={!!existingCustomerMatched}
                className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg disabled:opacity-60 disabled:bg-slate-50 text-slate-800 focus:outline-hidden focus:ring-1.5 focus:ring-emerald-500 text-sm"
                required
              />
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
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={!!existingCustomerMatched}
                placeholder="e.g., Satkhira, Khulna Road, Bangladesh"
                className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg disabled:opacity-60 disabled:bg-slate-50 text-slate-800 focus:outline-hidden focus:ring-1.5 focus:ring-emerald-500 text-sm"
              />
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
              <input
                type="number"
                value={amountStr}
                onChange={(e) => handleAmountChange(e.target.value)}
                placeholder="e.g., 2500"
                className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-1.5 focus:ring-emerald-500 text-sm font-mono"
                required
              />
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
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Farmer paid instantly, quality checked"
                className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-hidden focus:ring-1.5 focus:ring-emerald-500 text-sm"
              />
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
    </div>
  );
}
