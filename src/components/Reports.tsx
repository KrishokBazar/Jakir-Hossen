import { useEffect, useState } from 'react';
import { dbService } from '../db';
import { Customer, Order, Profile } from '../types';
import { exportToCSV } from '../utils/csv';
import { useNotification } from './NotificationContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
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

  // 1. Daily Sales aggregation grouping
  const getDailySales = () => {
    const dailyMap = new Map<string, { total_amount: number; total_profit: number; total_orders: number; total_returns: number }>();
    
    orders.forEach((o) => {
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

  // 2. Customer Spend sorted list
  const getCustomerLeaderboard = () => {
    return [...customers].sort((a, b) => b.total_spent - a.total_spent);
  };

  // 3. Operator performance aggregation grouping
  const getOperatorPerformance = () => {
    const perfMap = new Map<string, { name: string; phone: string; orders_entered: number; total_sales: number }>();
    
    orders.forEach((o) => {
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

  // 4. Operator performance for the last month (last 30 days) of orders entered
  const getOperatorPerformanceLastMonth = () => {
    const perfMap = new Map<string, { name: string; orders_count: number }>();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    orders.forEach((o) => {
      const orderDate = new Date(o.order_date);
      if (orderDate >= thirtyDaysAgo) {
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
      }
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
            className="p-2.5 text-slate-505 hover:text-slate-800 border border-slate-200 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
          >
            <Download className="w-4 h-4" /> Export Report (CSV)
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
                    <td className="px-5 py-3.5 text-slate-750 font-semibold">{r.total_orders}</td>
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
