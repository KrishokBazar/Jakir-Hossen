import { useEffect, useState } from 'react';
import { dbService } from '../db';
import { Customer, Order, Profile } from '../types';
import { exportToCSV } from '../utils/csv';
import { useNotification } from './NotificationContext';
import { jsPDF } from 'jspdf';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { 
  FileText, 
  Download, 
  Calendar, 
  UserCheck, 
  TrendingUp, 
  ShoppingBag, 
  ChevronRight, 
  RotateCcw,
  RefreshCw
} from 'lucide-react';

export default function Reports() {
  const { showError } = useNotification();
  const [activeReport, setActiveReport] = useState<'daily' | 'customer' | 'operator'>('daily');
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [operators, setOperators] = useState<Profile[]>([]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const ords = await dbService.getOrders();
      setOrders(ords);

      const custs = await dbService.getCustomers();
      setCustomers(custs);

      const ops = await dbService.getOperators();
      setOperators(ops);
    } catch (err: any) {
      console.error("Error loaded reports dataset:", err);
      showError("Error loaded reports dataset", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, []);

  // Filter orders reactively based on date frame strings
  const getFilteredOrders = () => {
    return orders.filter((o) => {
      const dateStr = o.order_date.split('T')[0];
      if (startDate && dateStr < startDate) return false;
      if (endDate && dateStr > endDate) return false;
      return true;
    });
  };

  // Preset Date range utilities
  const applyPresetRange = (preset: 'today' | '7days' | 'thisMonth' | 'all') => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (preset === 'today') {
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === '7days') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(today.getDate() - 7);
      setStartDate(sevenDaysAgo.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else if (preset === 'thisMonth') {
      const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      setStartDate(firstOfMonth.toISOString().split('T')[0]);
      setEndDate(todayStr);
    } else {
      setStartDate('');
      setEndDate('');
    }
  };

  // 1. Daily Sales aggregation grouping
  const getDailySales = () => {
    const dailyMap = new Map<string, { total_amount: number; total_profit: number; total_orders: number; total_returns: number }>();
    const filteredOrders = getFilteredOrders();
    
    filteredOrders.forEach((o) => {
      const dateKey = o.order_date.split('T')[0];
      const isReturn = o.status === 'return';
      const rawAmt = Math.abs(Number(o.amount) || 0);
      const signedAmt = isReturn ? -rawAmt : rawAmt;

      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { total_amount: 0, total_profit: 0, total_orders: 0, total_returns: 0 });
      }

      const activeObj = dailyMap.get(dateKey)!;
      activeObj.total_amount += signedAmt;
      activeObj.total_profit += o.profit;
      if (isReturn) {
        activeObj.total_returns++;
      } else {
        activeObj.total_orders++;
      }
    });

    return Array.from(dailyMap.entries())
      .map(([date, val]) => ({
        date,
        ...val,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  };

  // 2. Customer Spend sorted list dynamically computed from date-filtered orders
  const getCustomerLeaderboard = () => {
    const filteredOrders = getFilteredOrders();
    const statsMap = new Map<string, { id: string; name: string; phone: string; address?: string; total_orders: number; total_spent: number; total_returns: number; last_order_date?: string | null }>();

    // Seed mapping with customer metadata
    customers.forEach((c) => {
      statsMap.set(c.id, {
        id: c.id,
        name: c.name,
        phone: c.phone,
        address: c.address,
        total_orders: 0,
        total_spent: 0,
        total_returns: 0,
        last_order_date: c.last_order_date || null
      });
    });

    filteredOrders.forEach((o) => {
      const isReturn = o.status === 'return';
      const rawAmt = Math.abs(Number(o.amount) || 0);
      const signedAmt = isReturn ? -rawAmt : rawAmt;

      if (!statsMap.has(o.customer_id)) {
        statsMap.set(o.customer_id, {
          id: o.customer_id,
          name: o.customer_name || 'Registered Customer',
          phone: o.customer_phone || 'No Phone Registered',
          address: '',
          total_orders: 0,
          total_spent: 0,
          total_returns: 0,
          last_order_date: null
        });
      }

      const activeObj = statsMap.get(o.customer_id)!;
      if (isReturn) {
        activeObj.total_returns++;
      } else {
        activeObj.total_orders++;
      }
      activeObj.total_spent += signedAmt;

      // Track the latest order date dynamically within the window
      if (!activeObj.last_order_date || o.order_date > activeObj.last_order_date) {
        activeObj.last_order_date = o.order_date;
      }
    });

    // Handle filtering out entries with zero activity if date ranges are set
    let results = Array.from(statsMap.values());
    if (startDate || endDate) {
      results = results.filter((c) => c.total_orders > 0 || c.total_returns > 0);
    }

    return results.sort((a, b) => b.total_spent - a.total_spent);
  };

  // 3. Operator performance aggregation grouping
  const getOperatorPerformance = () => {
    const perfMap = new Map<string, { name: string; phone: string; orders_entered: number; total_sales: number }>();
    const filteredOrders = getFilteredOrders();
    
    filteredOrders.forEach((o) => {
      const opId = o.operator_id;
      const isReturn = o.status === 'return';
      const rawAmt = Math.abs(Number(o.amount) || 0);
      const signedAmt = isReturn ? -rawAmt : rawAmt;

      if (!perfMap.has(opId)) {
        // Find operator info
        const opProfile = operators.find((p) => p.id === opId);
        perfMap.set(opId, {
          name: opProfile?.name || o.operator_name || 'Staff User',
          phone: opProfile?.phone || 'No Phone Registered',
          orders_entered: 0,
          total_sales: 0,
        });
      }

      const activeObj = perfMap.get(opId)!;
      activeObj.orders_entered++;
      activeObj.total_sales += signedAmt;
    });

    // Also include operators with 0 logs who are approved
    operators.forEach((op) => {
      if (op.approved && op.role === 'operator' && !perfMap.has(op.id)) {
        perfMap.set(op.id, {
          name: op.name,
          phone: op.phone || 'No Phone Registered',
          orders_entered: 0,
          total_sales: 0,
        });
      }
    });

    return Array.from(perfMap.values()).sort((a, b) => b.total_sales - a.total_sales);
  };

  // 4. Operator performance for selected range or the last month (last 30 days) of orders entered
  const getOperatorPerformanceLastMonth = () => {
    const perfMap = new Map<string, { name: string; orders_count: number }>();
    const filteredOrders = getFilteredOrders();

    filteredOrders.forEach((o) => {
      const opId = o.operator_id;
      if (!perfMap.has(opId)) {
        const opProfile = operators.find((p) => p.id === opId);
        perfMap.set(opId, {
          name: opProfile?.name || o.operator_name || 'Staff User',
          orders_count: 0
        });
      }
      const activeObj = perfMap.get(opId)!;
      activeObj.orders_count++;
    });

    // Also include other operators with 0 logs who are approved
    operators.forEach((op) => {
      if (op.approved && op.role === 'operator' && !perfMap.has(op.id)) {
        perfMap.set(op.id, {
          name: op.name,
          orders_count: 0
        });
      }
    });

    return Array.from(perfMap.values());
  };

  // 5. Get daily orders and cost trends over the past 30 days
  const get30DaysTrendData = () => {
    const dataList = [];
    const today = new Date();
    
    // Generate the past 30 days starting 29 days ago up to today
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      
      dataList.push({
        dateStr,
        // Short localized day format like "১৮ জুন" or standard formatting like "18 Jun"
        dateLabel: d.toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' }),
        dateLabelEn: d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
        orders: 0,
        returns: 0,
        revenue: 0,      // sum of o.amount (Net Sales)
        productCost: 0,  // o.product_cost
        deliveryCost: 0, // o.delivery_cost
        otherCosts: 0,   // o.other_costs
        totalCost: 0,    // o.total_cost
        profit: 0        // o.profit
      });
    }

    orders.forEach((o) => {
      const oDateStr = o.order_date.split('T')[0];
      const match = dataList.find((item) => item.dateStr === oDateStr);
      if (match) {
        const isReturn = o.status === 'return';
        const rawAmt = Math.abs(Number(o.amount) || 0);

        if (isReturn) {
          match.returns += 1;
        } else {
          match.orders += 1;
          match.revenue += rawAmt;
          match.productCost += Number(o.product_cost) || 0;
          match.deliveryCost += Number(o.delivery_cost) || 0;
          match.otherCosts += Number(o.other_costs) || 0;
          match.totalCost += Number(o.total_cost) || 0;
          match.profit += Number(o.profit) || 0;
        }
      }
    });

    return dataList;
  };

  // Handle export trigger
  const handleExportCSV = () => {
    if (activeReport === 'daily') {
      const reportRows = getDailySales();
      const headers = ['Date', 'Total Orders', 'Total Returns', 'Net Sales Amount (BDT)', 'Total Net Profit (BDT)'];
      const dataRows = reportRows.map((r) => [
        r.date,
        r.total_orders,
        r.total_returns,
        r.total_amount,
        r.total_profit,
      ]);
      exportToCSV(`KB_Daily_Sales_Report_${new Date().toISOString().split('T')[0]}.csv`, dataRows, headers);
    } else if (activeReport === 'customer') {
      const reportRows = getCustomerLeaderboard();
      const headers = ['Customer Name', 'Phone', 'Address', 'Total Orders Placed', 'Total Spent (BDT)', 'Total Returns Placed', 'Last Active Order Date'];
      const dataRows = reportRows.map((c) => [
        c.name,
        c.phone,
        c.address || '',
        c.total_orders,
        c.total_spent,
        c.total_returns,
        c.last_order_date ? new Date(c.last_order_date).toLocaleDateString() : 'N/A',
      ]);
      exportToCSV(`KB_Customer_Leaderboard_${new Date().toISOString().split('T')[0]}.csv`, dataRows, headers);
    } else {
      const reportRows = getOperatorPerformance();
      const headers = ['Operator Name', 'Phone', 'Total Orders Entered', 'Net Sales Amount Generated (BDT)'];
      const dataRows = reportRows.map((o) => [
        o.name,
        o.phone,
        o.orders_entered,
        o.total_sales,
      ]);
      exportToCSV(`KB_Operator_Performance_${new Date().toISOString().split('T')[0]}.csv`, dataRows, headers);
    }
  };

  // Harmonious Transliterator to guarantee beautifully printed files on non-unicode devices
  const cleanAndTransliterate = (value: string): string => {
    if (!value) return '';
    const lookup: Record<string, string> = {
      'जاکির হোসেন': 'Zakir Hossain',
      'জাকির হোসেন (Zakir)': 'Zakir Hossain',
      'রতন ভাই': 'Raton Bhai',
      'রতন ভাই (Raton)': 'Raton Bhai',
      'রিক্তা হোসেন': 'Rikta Hossain',
      'রিক্তা হোসেন (Rikta)': 'Rikta Hossain',
      'অপারেটর': 'Operator',
      'সহ-প্রতিষ্ঠাতা': 'Co-founder',
      'সমবায় চ্যাটরুম': 'Somobay Group',
    };
    if (lookup[value]) return lookup[value];
    
    // Convert popular Bangla agricultural terms or names if matched
    let result = value;
    // Strip non-ASCII characters gently, but keep structure
    const cleaned = result.replace(/[^\x20-\x7E]/g, '').trim();
    if (cleaned) return cleaned;
    
    // Fallback phonetic words if everything is non-ascii
    return 'Registered User';
  };

  // Generate high-fidelity export using jsPDF
  const handleExportPDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Dark high-contrast banner (Teal / Dark Emerald)
    doc.setFillColor(6, 95, 70); // Theme green: bg-emerald-700
    doc.rect(0, 0, 210, 38, 'F');

    // Branding details inside PDF Header
    doc.setTextColor(255, 255, 255);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('KRISHOK BAZAR ADMIN PANEL', 15, 15);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Somobay Automated Accounting Platform & Ledger Summary', 15, 22);
    doc.text(`Report Logged on: ${new Date().toLocaleString()}`, 15, 29);

    let titleText = '';
    let headers: string[] = [];
    let colWidths: number[] = [];
    let rows: string[][] = [];

    if (activeReport === 'daily') {
      titleText = 'Daily Sales Summary Financial Log';
      headers = ['Date', 'Orders', 'Returns', 'Net Sales', 'Net Profit'];
      colWidths = [45, 30, 30, 40, 35]; // Sums to 180
      const source = getDailySales();
      rows = source.map(r => [
        new Date(r.date).toLocaleDateString(),
        String(r.total_orders),
        String(r.total_returns),
        `BDT ${r.total_amount.toLocaleString()}`,
        `BDT ${r.total_profit.toLocaleString()}`
      ]);
    } else if (activeReport === 'customer') {
      titleText = 'Customer Lifetime Value (LTV) Leaderboard';
      headers = ['Rank', 'Name / Phone Identification', 'Orders Count', 'Total Spent'];
      colWidths = [20, 80, 40, 40]; // Sums to 180
      const source = getCustomerLeaderboard();
      rows = source.map((c, idx) => [
        `#${idx + 1}`,
        `${cleanAndTransliterate(c.name)} (${c.phone})`,
        `${c.total_orders} Completed`,
        `BDT ${c.total_spent.toLocaleString()}`
      ]);
    } else {
      titleText = 'Operator Performance ledger & Database Audits';
      headers = ['Operator Name', 'Phone Account', 'Orders Logged', 'Sales Generated'];
      colWidths = [50, 45, 40, 45]; // Sums to 180
      const source = getOperatorPerformance();
      rows = source.map(o => [
        cleanAndTransliterate(o.name),
        o.phone,
        `${o.orders_entered} entries`,
        `BDT ${o.total_sales.toLocaleString()}`
      ]);
    }

    // Draw Report Title Box
    let currentY = 50;
    doc.setTextColor(30, 41, 59);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(titleText.toUpperCase(), 15, currentY);
    
    // Thin gray rule path
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(15, currentY + 3, 195, currentY + 3);

    currentY += 12;

    // Table Header drawing
    doc.setFillColor(241, 245, 249);
    doc.rect(15, currentY, 180, 9, 'F');
    doc.setTextColor(51, 65, 85);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9.5);

    let currentX = 15;
    headers.forEach((h, index) => {
      doc.text(h, currentX + 3, currentY + 6);
      currentX += colWidths[index];
    });

    currentY += 9;

    // Draw Rows and zebra lines
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);

    rows.forEach((row, rowIndex) => {
      // Check for page overflow
      if (currentY > 270) {
        doc.addPage();
        currentY = 20;

        // Redraw Table Header on new page
        doc.setFillColor(241, 245, 249);
        doc.rect(15, currentY, 180, 9, 'F');
        doc.setTextColor(51, 65, 85);
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(9.5);

        let repeatX = 15;
        headers.forEach((h, idx) => {
          doc.text(h, repeatX + 3, currentY + 6);
          repeatX += colWidths[idx];
        });

        currentY += 9;
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(71, 85, 105);
      }

      // Zebra background color
      if (rowIndex % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(15, currentY, 180, 8, 'F');
      }

      // Draw cell text
      let drawX = 15;
      row.forEach((cell, cellIdx) => {
        doc.text(cell, drawX + 3, currentY + 5.5);
        drawX += colWidths[cellIdx];
      });

      // Simple divider border
      doc.setDrawColor(241, 245, 249);
      doc.line(15, currentY + 8, 195, currentY + 8);
      
      currentY += 8;
    });

    // Save document
    const fileBase = titleText.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    doc.save(`KB_Report_${fileBase}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  const dailySales = getDailySales();
  const customerLdr = getCustomerLeaderboard();
  const operatorPerf = getOperatorPerformance();

  // Aggregate past 30 days statistics for visualization and summary cards
  const trend30Days = get30DaysTrendData();
  const total30dOrders = trend30Days.reduce((acc, curr) => acc + curr.orders, 0);
  const total30dReturns = trend30Days.reduce((acc, curr) => acc + curr.returns, 0);
  const total30dRevenue = trend30Days.reduce((acc, curr) => acc + curr.revenue, 0);
  const total30dCost = trend30Days.reduce((acc, curr) => acc + curr.totalCost, 0);
  const total30dProfit = trend30Days.reduce((acc, curr) => acc + curr.profit, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-emerald-600" />
            রিপোর্ট এবং বিশ্লেষণ (Operations Dashboard & Logs)
          </h2>
          <p className="text-xs text-slate-500 font-sans">Group operating variables by date, sorting customer lifetime spends, and evaluating agent records.</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={fetchReportData}
            title="রিফ্রেশ করুন (Refresh Data)"
            className="p-2.5 text-slate-505 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-55 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
          >
            <Download className="w-4 h-4 text-slate-505" /> CSV ডাউনলোড (CSV)
          </button>

          <button
            onClick={handleExportPDF}
            className="px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
          >
            <FileText className="w-4 h-4" /> PDF ডাউনলোড (PDF)
          </button>
        </div>
      </div>

      {/* Date Range Picker Filters */}
      <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-705 uppercase tracking-wider flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" /> তারিখের পরিসীমা (Date Range):
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 shadow-xs focus:ring-1 focus:ring-emerald-500 outline-hidden"
            />
            <span className="text-slate-400 text-xs">থেকে (To)</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 shadow-xs focus:ring-1 focus:ring-emerald-500 outline-hidden"
            />
          </div>
          
          {(startDate || endDate) && (
            <button
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="px-2.5 py-1.5 text-xs text-rose-600 hover:text-rose-700 font-bold bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> ফিল্টার মুছুন (Clear)
            </button>
          )}
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-1.5 bg-white p-1 rounded-lg border border-slate-200/80">
          <button
            onClick={() => applyPresetRange('all')}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
              !startDate && !endDate
                ? 'bg-emerald-650 bg-emerald-600 text-white shadow-xs'
                : 'text-slate-650 text-slate-600 hover:bg-slate-50'
            }`}
          >
            সব সময় (All Time)
          </button>
          <button
            onClick={() => applyPresetRange('today')}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
              startDate === new Date().toISOString().split('T')[0] && endDate === new Date().toISOString().split('T')[0]
                ? 'bg-emerald-650 bg-emerald-600 text-white shadow-xs'
                : 'text-slate-650 text-slate-600 hover:bg-slate-50'
            }`}
          >
            আজ (Today)
          </button>
          <button
            onClick={() => applyPresetRange('7days')}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
              startDate && endDate && startDate === (() => {
                const d = new Date();
                d.setDate(d.getDate() - 7);
                return d.toISOString().split('T')[0];
              })()
                ? 'bg-emerald-650 bg-emerald-600 text-white shadow-xs'
                : 'text-slate-650 text-slate-600 hover:bg-slate-50'
            }`}
          >
            গত ৭ দিন (7 Days)
          </button>
          <button
            onClick={() => applyPresetRange('thisMonth')}
            className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
              startDate && endDate && startDate === (() => {
                const d = new Date();
                return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
              })()
                ? 'bg-emerald-650 bg-emerald-600 text-white shadow-xs'
                : 'text-slate-650 text-slate-600 hover:bg-slate-50'
            }`}
          >
            এই মাস (This Month)
          </button>
        </div>
      </div>

      {/* Navigation tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveReport('daily')}
          className={`px-4 py-2.5 text-xs font-bold select-none cursor-pointer border-b-2 transition-all ${
            activeReport === 'daily'
              ? 'border-emerald-600 text-emerald-700 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          Daily Sales Summary (দৈনিক হিসাব)
        </button>
        <button
          onClick={() => setActiveReport('customer')}
          className={`px-4 py-2.5 text-xs font-bold select-none cursor-pointer border-b-2 transition-all ${
            activeReport === 'customer'
              ? 'border-emerald-600 text-emerald-700 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          Customer Spend Leaderboard (গ্রাহক ব্যয়)
        </button>
        <button
          onClick={() => setActiveReport('operator')}
          className={`px-4 py-2.5 text-xs font-bold select-none cursor-pointer border-b-2 transition-all ${
            activeReport === 'operator'
              ? 'border-emerald-600 text-emerald-700 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
          }`}
        >
          Operator Ledger (কর্মকর্তা কার্যকারিতা)
        </button>
      </div>

      {/* Render tables based on selection */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        
        {activeReport === 'daily' && (
          dailySales.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">No orders completed to construct daily financials yet.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {/* 30-Day Trend Visual Dashboard Section */}
              <div className="p-6 bg-slate-50/20 border-b border-slate-100">
                <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 tracking-tight flex items-center gap-2 uppercase">
                      <TrendingUp className="w-5 h-5 text-emerald-600" />
                      দৈনিক ট্রেন্ড ও বিশ্লেষণ (Daily Trends & Performance - Last 30 Days)
                    </h3>
                    <p className="text-[11px] text-slate-500 font-sans mt-0.5">Comparative analytics visualizer tracking daily orders volume, gross revenues, and operational costs over the past 30 days.</p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider select-none shrink-0 self-start sm:self-center">
                    30-Day Analytics Ledger
                  </div>
                </div>

                {/* scorecards grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {/* Card 1: Orders count */}
                  <div className="p-4 rounded-xl border border-slate-200/60 bg-white shadow-xs hover:border-emerald-300 hover:shadow-sm transition-all duration-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">মোট সম্পূর্ণ অর্ডার (Orders)</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-xl font-extrabold text-slate-900 font-mono">{total30dOrders}</span>
                      <span className="text-[10px] text-slate-400 font-medium">টি</span>
                    </div>
                    {total30dReturns > 0 ? (
                      <div className="text-[9px] text-rose-500 font-bold mt-1">
                        {total30dReturns} টি রিটার্ন অন্তর্ভুক্ত
                      </div>
                    ) : (
                      <div className="text-[9px] text-slate-400 font-medium mt-1">
                        কোনো রিটার্ন নেই
                      </div>
                    )}
                  </div>

                  {/* Card 2: 30D Revenue */}
                  <div className="p-4 rounded-xl border border-slate-200/60 bg-white shadow-xs hover:border-emerald-300 hover:shadow-sm transition-all duration-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">মোট সফল বিক্রয় (Revenue)</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-xl font-extrabold text-slate-900 font-mono">৳{total30dRevenue.toLocaleString()}</span>
                    </div>
                    <div className="text-[9px] text-slate-400 font-medium mt-1">
                      দৈনিক গড়: ৳{Math.round(total30dRevenue / 30).toLocaleString()}
                    </div>
                  </div>

                  {/* Card 3: 30D Costs */}
                  <div className="p-4 rounded-xl border border-slate-200/60 bg-white shadow-xs hover:border-emerald-300 hover:shadow-sm transition-all duration-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">মোট সামগ্রিক ব্যয় (Total Cost)</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-xl font-extrabold text-slate-900 font-mono">৳{total30dCost.toLocaleString()}</span>
                    </div>
                    <div className="text-[9px] text-slate-400 font-medium mt-1">
                      পণ্য, ড্রাইভ ও পরিচালনা খরচসমষ্টি
                    </div>
                  </div>

                  {/* Card 4: 30D Profits */}
                  <div className="p-4 rounded-xl border border-slate-200/60 bg-white shadow-xs hover:border-emerald-300 hover:shadow-sm transition-all duration-200">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">মোট নেট লাভ (Net Profit)</span>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className={`text-xl font-extrabold font-mono ${total30dProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        ৳{total30dProfit.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-[9px] text-slate-400 font-medium mt-1">
                      লাভের হার (Margin): {total30dRevenue > 0 ? ((total30dProfit / total30dRevenue) * 100).toFixed(1) : '0'}%
                    </div>
                  </div>
                </div>

                {/* Sub-grid containing actual charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Chart A: Daily Orders & Returns Volume */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-xs">
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        দৈনিক অর্ডার ও রিটার্ন ভলিউম ট্রেন্ড (Daily Orders vs Returns)
                      </h4>
                      <span className="text-[8px] font-bold font-mono text-slate-400 uppercase tracking-wider bg-slate-100 rounded-sm px-1">Bar Chart</span>
                    </div>

                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={trend30Days}
                          margin={{ top: 12, right: 10, left: -25, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis 
                            dataKey="dateLabel" 
                            tick={{ fontSize: 9, fill: '#64748b' }} 
                            stroke="#cbd5e1" 
                            interval={4}
                          />
                          <YAxis tick={{ fontSize: 9, fill: '#64748b' }} stroke="#cbd5e1" width={35} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '11px', boxShadow: '0 4px 12px 0 rgb(0 0 0 / 0.15)' }}
                            labelStyle={{ fontWeight: 'extrabold', color: '#34d399', marginBottom: '4px' }}
                            formatter={(value, name) => {
                              const labelMap: Record<string, string> = {
                                'orders': 'সম্পূর্ণ অর্ডার (Orders)',
                                'returns': 'রিটার্ন (Returns)'
                              };
                              return [value, labelMap[name] || name];
                            }}
                          />
                          <Legend 
                            verticalAlign="bottom" 
                            height={32} 
                            iconType="circle" 
                            iconSize={8}
                            wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }}
                            formatter={(value) => {
                              const labelMap: Record<string, string> = {
                                'orders': 'সম্পূর্ণ অর্ডার',
                                'returns': 'রিটার্নস'
                              };
                              return labelMap[value] || value;
                            }}
                          />
                          <Bar dataKey="orders" name="orders" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={14} />
                          <Bar dataKey="returns" name="returns" fill="#f43f5e" radius={[3, 3, 0, 0]} maxBarSize={14} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Chart B: Cost vs Revenue vs Profit Area Line Chart */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200/60 shadow-xs">
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        রাজস্ব, সামগ্রিক ব্যয় ও লাভ ট্রেন্ড (Revenue, Cost & Profit Waves)
                      </h4>
                      <span className="text-[8px] font-bold font-mono text-slate-400 uppercase tracking-wider bg-slate-100 rounded-sm px-1">Area Chart</span>
                    </div>

                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={trend30Days}
                          margin={{ top: 12, right: 10, left: -15, bottom: 5 }}
                        >
                          <defs>
                            <linearGradient id="revenueGrad2" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.01}/>
                            </linearGradient>
                            <linearGradient id="profitGrad2" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.12}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0.01}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                          <XAxis 
                            dataKey="dateLabel" 
                            tick={{ fontSize: 9, fill: '#64748b' }} 
                            stroke="#cbd5e1" 
                            interval={4}
                          />
                          <YAxis tick={{ fontSize: 9, fill: '#64748b' }} stroke="#cbd5e1" tickFormatter={(val) => `৳${val}`} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '10px', color: '#fff', fontSize: '11px', boxShadow: '0 4px 12px 0 rgb(0 0 0 / 0.15)' }}
                            labelStyle={{ fontWeight: 'extrabold', color: '#6366f1', marginBottom: '4px' }}
                            formatter={(value) => [`৳${Number(value).toLocaleString()}`]}
                          />
                          <Legend 
                            verticalAlign="bottom" 
                            height={32} 
                            iconType="circle" 
                            iconSize={8}
                            wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }}
                            formatter={(value) => {
                              const labelMap: Record<string, string> = {
                                'revenue': 'রাজস্ব (Revenue)',
                                'totalCost': 'মোট ব্যয় (Total Cost)',
                                'profit': 'নিট লাভ (Net Profit)'
                              };
                              return labelMap[value] || value;
                            }}
                          />
                          <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fillOpacity={1} fill="url(#revenueGrad2)" strokeWidth={2} name="revenue" />
                          <Line type="monotone" dataKey="totalCost" stroke="#f59e0b" strokeWidth={2} dot={{ r: 1.5 }} name="totalCost" />
                          <Area type="monotone" dataKey="profit" stroke="#10b981" fillOpacity={1} fill="url(#profitGrad2)" strokeWidth={2} name="profit" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>

              {/* Original Ledger Data Table */}
              <div className="bg-slate-50/50 p-4 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">দৈনিক লেনদেন খতিয়ান বিবরণ (Detailed Ledger Logs)</span>
                <span className="text-[10px] text-slate-400 font-medium">তারিখ ক্রমানুসারে সাজানো (Sorted chronologically)</span>
              </div>

              <table className="min-w-full divide-y divide-slate-100 font-sans">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Orders</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Returns</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Net Sales</th>
                    <th className="px-5 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Net Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs">
                  {dailySales.map((r) => (
                    <tr key={r.date} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3.5 font-bold font-sans text-slate-900 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-450" />
                        {new Date(r.date).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-3.5 text-slate-755 text-slate-750 font-semibold">{r.total_orders}</td>
                      <td className="px-5 py-3.5">
                        {r.total_returns > 0 ? (
                          <span className="bg-rose-50 text-rose-700 font-bold px-1.5 py-0.5 rounded-sm">
                            {r.total_returns} returns
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-slate-900 font-bold">৳{r.total_amount.toLocaleString()}</td>
                      <td className="px-5 py-3.5 text-right font-bold text-emerald-600">
                        <span className={r.total_profit >= 0 ? 'text-emerald-605' : 'text-rose-600'}>
                          ৳{r.total_profit.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {activeReport === 'customer' && (
          customerLdr.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">No active customer profiles logged.</div>
          ) : (
            <table className="min-w-full divide-y divide-slate-100 font-sans">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Customer Name</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Phone / Location</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Orders Count</th>
                  <th className="px-5 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Lifetime LTV Spend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {customerLdr.map((c, idx) => (
                  <tr key={c.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-3.5 text-slate-900">
                      <div className="flex items-center gap-2">
                        <span className="h-5 w-5 bg-slate-100 text-slate-500 text-[10px] font-bold font-mono rounded-full flex items-center justify-center">
                          #{idx + 1}
                        </span>
                        <span className="font-bold">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-slate-600">
                      <div>{c.phone}</div>
                      {c.address && <div className="text-[10px] text-slate-400 font-sans">{c.address}</div>}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1">
                        <ShoppingBag className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-bold font-mono text-slate-750">{c.total_orders} orders</span>
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-bold text-emerald-600">
                      ৳{c.total_spent.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {activeReport === 'operator' && (
          operatorPerf.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">No operators actions captured yet.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              <div className="p-5 bg-slate-50/30">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-1">অপারেটর কার্যকারিতা গ্রাফ (Orders Entered per Operator - Last 30 Days)</h4>
                <p className="text-[11px] text-slate-500 mb-4">This chart visualizes the total number of orders entered per operator over the last month to track individual staff performance.</p>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={getOperatorPerformanceLastMonth()}
                      margin={{ top: 10, right: 10, left: -20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#94a3b8" />
                      <YAxis tick={{ fontSize: 10 }} stroke="#94a3b8" />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                        labelStyle={{ fontWeight: 'bold', color: '#34d399' }}
                      />
                      <Bar dataKey="orders_count" name="অর্ডার সংখ্যা (Orders)" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <table className="min-w-full divide-y divide-slate-100 font-sans">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Operator Name</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Phone Identifier</th>
                    <th className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Orders Cataloged</th>
                    <th className="px-5 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Cumulative Value Generated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {operatorPerf.map((o) => (
                    <tr key={o.phone} className="hover:bg-slate-50/50">
                      <td className="px-5 py-3.5 font-bold font-sans text-slate-900 flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-slate-450" />
                        {o.name}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-slate-600 font-semibold">{o.phone}</td>
                      <td className="px-5 py-3.5 text-slate-700">
                        <span className="font-mono font-bold">{o.orders_entered}</span> entries
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-bold text-emerald-600">
                        ৳{o.total_sales.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

      </div>
    </div>
  );
}
