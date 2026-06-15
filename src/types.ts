export interface Profile {
  id: string;
  email?: string;
  phone?: string;
  name: string;
  role: 'admin' | 'operator';
  approved: boolean;
  created_at: string;
}

export interface Customer {
  id: string;
  phone: string;
  name: string;
  address?: string;
  total_orders: number;
  total_spent: number;
  total_returns: number;
  last_order_date?: string | null;
  created_at: string;
}

export interface Order {
  id: string;
  customer_id: string;
  customer_name?: string; // cache/join for display UI
  customer_phone?: string;
  operator_id: string;
  operator_name?: string; // join
  amount: number;
  status: 'delivery' | 'return';
  product_cost: number;
  delivery_cost: number;
  other_costs: number;
  total_cost: number;
  profit: number;
  order_date: string;
  notes?: string;
}

export interface CostSettings {
  id: number;
  product_cost_percent: number;
  default_delivery_cost: number;
  other_fixed_cost: number;
  updated_by?: string;
  updated_at: string;
}

export interface DailyStat {
  date: string;
  sales: number;
  profit: number;
  orders: number;
  returns: number;
}

export interface Staff {
  id: string;
  name: string;
  phone: string;
  address?: string;
  salary: number;
  duty_hours?: number;
  holidays_weekly?: number;
  id_card?: string;
  document?: string;
  created_at: string;
}

export interface StaffPayment {
  id: string;
  staff_id: string;
  staff_name: string;
  payment_date: string;
  amount: number;
  days_worked: number;
  month_year: string;
  notes?: string;
}

export interface Expense {
  id: string;
  date: string;
  staff_id?: string;
  staff_name?: string;
  expense_type: string;
  amount: number;
  description: string;
  created_at: string;
  added_by?: string;
}

export interface AuditLog {
  id: string;
  admin_id: string;
  admin_name: string;
  action_type: 'approve_operator' | 'reject_operator' | 'delete_customer' | 'delete_order' | 'delete_staff' | 'delete_expense' | 'delete_farmer' | 'delete_farmer_payment' | 'delete_farmer_sale' | 'delete_daily_log';
  target_id: string;
  target_name: string;
  timestamp: string;
  details: string;
}

export interface Farmer {
  id: string; // phone number (main number) as identifier
  name: string;
  phone: string; // main number
  secondary_phone?: string; // secondary number
  village: string;
  gender: 'male' | 'female';
  products_sold: string; // what products they sold
  commission_rate: 5 | 10; // 5% or 10% profit options
  total_sales: number; // total value of goods sold by farmer
  our_profit: number; // profit we received (sales * rate / 100)
  total_paid: number; // total BDT paid to them
  payment_count: number; // how many times paid
  created_at: string;
  updated_at: string;
}

export interface FarmerPayment {
  id: string;
  farmer_id: string;
  farmer_name: string;
  farmer_phone: string;
  amount: number;
  payment_date: string;
  notes?: string;
  reference?: string;
  added_by: string;
}

export interface FarmerSale {
  id: string;
  farmer_id: string;
  farmer_name: string;
  farmer_phone: string;
  amount: number;
  products: string;
  commission_rate: 5 | 10;
  our_profit: number;
  sale_date: string;
  added_by: string;
}

export interface DailyLog {
  id: string;
  date: string;
  operator_id: string;
  operator_name: string;
  event_type: 'Equipment Maintenance' | 'Visitor Check-in' | 'Site Incident' | 'General Note' | 'Supply Delivery' | 'Other';
  description: string;
  resolved: boolean;
  resolution_notes?: string;
  created_at: string;
}


