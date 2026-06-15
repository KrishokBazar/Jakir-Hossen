import { db, auth } from './firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot
} from 'firebase/firestore';
import { Profile, Customer, Order, CostSettings, DailyStat, Staff, StaffPayment, Expense, Farmer, FarmerPayment, FarmerSale, DailyLog, AuditLog } from './types';

// Supabase fallback modes (disabled to prefer Firebase)
export const isSupabaseConfigured = (): boolean => {
  return false;
};
export const supabase = null;

const CURRENT_USER_KEY = 'kb_current_user';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: dbService.getCurrentUser()?.id || null,
      email: dbService.getCurrentUser()?.email || null,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Global seeding state
let isSeeded = false;

export async function seedDatabaseIfNeeded() {
  if (isSeeded) return;
  try {
    // 1. Seed root Admin
    const adminDocRef = doc(db, 'profiles', '01931355398');
    await setDoc(adminDocRef, {
      id: '01931355398',
      name: 'Zakir (Admin)',
      phone: '01931355398',
      email: 'ajzakir004@gmail.com',
      role: 'admin',
      approved: true,
      password: 'Ajzakir@2020',
      created_at: new Date().toISOString()
    }, { merge: true });

    // 2. Seed Baseline Cost Settings
    const costDocRef = doc(db, 'cost_settings', 'default');
    const costSnap = await getDoc(costDocRef);
    if (!costSnap.exists()) {
      await setDoc(costDocRef, {
        product_cost_percent: 40,
        default_delivery_cost: 50,
        other_fixed_cost: 0,
        updated_at: new Date().toISOString()
      });
    }
    isSeeded = true;
  } catch (err) {
    console.warn("Firebase seeding bypassed/offline:", err);
  }
}

// Master customer stats recalculation helper
export async function recalculateCustomerStats(customerId: string): Promise<void> {
  try {
    const q = query(collection(db, 'orders'), where('customer_id', '==', customerId));
    const snap = await getDocs(q);
    
    let totalSpent = 0;
    let totalOrders = 0;
    let totalReturns = 0;
    let lastOrderDate: string | null = null;

    snap.forEach((docRef) => {
      const data = docRef.data();
      const rawAmt = Math.abs(Number(data.amount) || 0);
      const status = data.status;
      
      if (status === 'delivery') {
        totalSpent += rawAmt;
        totalOrders++;
      } else if (status === 'return') {
        totalSpent -= rawAmt; // Deduct return amount from lifetime spent
        totalReturns++;
      }
      
      if (!lastOrderDate || new Date(data.order_date) > new Date(lastOrderDate)) {
        lastOrderDate = data.order_date;
      }
    });

    const customerDocRef = doc(db, 'customers', customerId);
    await setDoc(customerDocRef, {
      total_orders: totalOrders,
      total_spent: totalSpent,
      total_returns: totalReturns,
      last_order_date: lastOrderDate
    }, { merge: true });
  } catch (error) {
    console.error('Failed to recalculate customer stats:', customerId, error);
  }
}

export const dbService = {
  // Authentication via Firestore profiles
  async signIn(loginId: string, password: string): Promise<{ user: Profile; error?: string }> {
    await seedDatabaseIfNeeded();
    try {
      const cleanLoginId = loginId.trim();
      const isEmailAdmin = cleanLoginId.toLowerCase() === 'riktazhossain@gmail.com' || cleanLoginId.toLowerCase() === 'ajzakir004@gmail.com';
      const isPhoneAdmin = cleanLoginId === '01931355398';

      let profileData: Profile | null = null;

      if ((isEmailAdmin || isPhoneAdmin) && password === 'Ajzakir@2020') {
        const adminEmail = isPhoneAdmin ? 'ajzakir004@gmail.com' : cleanLoginId.toLowerCase();

        // 1. Authenticate with real Firebase Auth
        try {
          try {
            await signInWithEmailAndPassword(auth, adminEmail, 'Ajzakir@2020');
          } catch (authError: any) {
            // Auto register the admin on the fly in Firebase Auth if needed
            if (
              authError.code === 'auth/user-not-found' || 
              authError.code === 'auth/invalid-credential' || 
              authError.message?.includes('user-not-found') || 
              authError.message?.includes('invalid-credential')
            ) {
              try {
                await createUserWithEmailAndPassword(auth, adminEmail, 'Ajzakir@2020');
              } catch (createErr) {
                console.warn("Firebase Auth admin auto-signup failed:", createErr);
              }
            } else {
              console.warn("Auth dual fallback failed (trying signup):", authError);
              try {
                await createUserWithEmailAndPassword(auth, adminEmail, 'Ajzakir@2020');
              } catch (createErr) {
                console.warn("Dual fallback failed:", createErr);
              }
            }
          }
        } catch (globalAuthErr) {
          console.warn("Firebase Auth bypassed:", globalAuthErr);
        }

        // 2. Read/Set Admin Profile in Firestore
        const adminDocRef = doc(db, 'profiles', '01931355398');
        try {
          const adminPayload = {
            id: '01931355398',
            name: 'Zakir (Admin)',
            phone: '01931355398',
            email: adminEmail,
            role: 'admin',
            approved: true,
            password: 'Ajzakir@2020',
            created_at: new Date().toISOString()
          };
          await setDoc(adminDocRef, adminPayload, { merge: true });

          if (auth.currentUser) {
            await setDoc(doc(db, 'profiles', auth.currentUser.uid), {
              ...adminPayload,
              id: auth.currentUser.uid
            }, { merge: true });
          }

          const latestSnap = await getDoc(adminDocRef);
          if (latestSnap.exists()) {
            profileData = latestSnap.data() as Profile;
          }
        } catch (setErr) {
          console.warn("Firestore admin check bypassed (using direct model):", setErr);
        }

        // Direct fallback to guarantee success (crucial for local testing)
        if (!profileData) {
          profileData = {
            id: '01931355398',
            name: 'Zakir (Admin)',
            phone: '01931355398',
            email: adminEmail,
            role: 'admin',
            approved: true,
            password: 'Ajzakir@2020',
            created_at: new Date().toISOString()
          } as any;
        }
      }

      if (!profileData) {
        const directDocRef = doc(db, 'profiles', cleanLoginId);
        const docSnap = await getDoc(directDocRef);
        
        if (docSnap.exists()) {
          profileData = docSnap.data() as Profile;
        } else {
          // Fallback: search by phone key
          const q = query(collection(db, 'profiles'), where('phone', '==', cleanLoginId));
          const qSnap = await getDocs(q);
          if (!qSnap.empty) {
            profileData = qSnap.docs[0].data() as Profile;
          } else {
            // Fallback: search by email key
            const qEmail = query(collection(db, 'profiles'), where('email', '==', cleanLoginId));
            const qEmailSnap = await getDocs(qEmail);
            if (!qEmailSnap.empty) {
              profileData = qEmailSnap.docs[0].data() as Profile;
            }
          }
        }
      }

      if (!profileData) {
        return { user: {} as Profile, error: 'Invalid identifier/phone or password.' };
      }

      const rawProfile = profileData as any;
      if (rawProfile.password !== password) {
        return { user: {} as Profile, error: 'Invalid identifier/phone or password.' };
      }

      if (!profileData.approved) {
        return { user: {} as Profile, error: 'Approval pending: Admin must approve your registration via WhatsApp.' };
      }

      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(profileData));
      return { user: profileData };
    } catch (error) {
      return { user: {} as Profile, error: error instanceof Error ? error.message : 'Authentication process failed.' };
    }
  },

  // Operator Self-Registration (starts as approved = false)
  async signUpOperator(
    name: string,
    phone: string,
    address: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> {
    await seedDatabaseIfNeeded();
    try {
      const cleanPhone = phone.trim();
      const docRef = doc(db, 'profiles', cleanPhone);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { success: false, error: 'An operator with this phone number is already registered.' };
      }

      await setDoc(docRef, {
        id: cleanPhone,
        phone: cleanPhone,
        name: name.trim(),
        address: address.trim(),
        password: password,
        role: 'operator',
        approved: false,
        created_at: new Date().toISOString()
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Signup failed' };
    }
  },

  signOut(): void {
    localStorage.removeItem(CURRENT_USER_KEY);
    try {
      firebaseSignOut(auth).catch(err => console.warn("Firebase Auth sign out ignored:", err));
    } catch (e) {
      console.warn("Firebase Auth sign out bypassed:", e);
    }
  },

  getCurrentUser(): Profile | null {
    const u = localStorage.getItem(CURRENT_USER_KEY);
    return u ? JSON.parse(u) : null;
  },

  // Operator approvals (Admin only)
  async getOperators(): Promise<Profile[]> {
    await seedDatabaseIfNeeded();
    try {
      const snap = await getDocs(collection(db, 'profiles'));
      const list: Profile[] = [];
      snap.forEach((docRef) => {
        list.push(docRef.data() as Profile);
      });
      return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'profiles');
      return [];
    }
  },

  async approveOperator(id: string): Promise<void> {
    const currentUser = dbService.getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      throw new Error("অনুমতি নেই: শুধুমাত্র অ্যাডমিন অপারেটর অনুমোদন করতে পারবেন (Unauthorized: Only admin can approve operators).");
    }
    try {
      const docRef = doc(db, 'profiles', id);
      const snap = await getDoc(docRef);
      const name = snap.exists() ? snap.data().name : 'Unknown Operator';
      await updateDoc(docRef, { approved: true });
      await dbService.addAuditLog('approve_operator', id, name, `Approved operator registration for ${name} (Phone: ${id})`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `profiles/${id}`);
      throw error;
    }
  },

  async rejectOperator(id: string): Promise<void> {
    const currentUser = dbService.getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      throw new Error("অনুমতি নেই: শুধুমাত্র অ্যাডমিন অপারেটর প্রত্যাখ্যান করতে পারবেন (Unauthorized: Only admin can reject/delete operators).");
    }
    try {
      const docRef = doc(db, 'profiles', id);
      const snap = await getDoc(docRef);
      const name = snap.exists() ? snap.data().name : 'Unknown Operator';
      await deleteDoc(docRef);
      await dbService.addAuditLog('reject_operator', id, name, `Rejected/Deleted operator registration for ${name} (Phone: ${id})`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `profiles/${id}`);
      throw error;
    }
  },

  // Cost Settings (Admin only)
  async getCostSettings(): Promise<CostSettings> {
    await seedDatabaseIfNeeded();
    try {
      const costDocRef = doc(db, 'cost_settings', 'default');
      const snap = await getDoc(costDocRef);
      if (snap.exists()) {
        return snap.data() as CostSettings;
      }
      return {
        id: 1,
        product_cost_percent: 40,
        default_delivery_cost: 50,
        other_fixed_cost: 0,
        updated_at: new Date().toISOString(),
      };
    } catch (error) {
      return {
        id: 1,
        product_cost_percent: 40,
        default_delivery_cost: 50,
        other_fixed_cost: 0,
        updated_at: new Date().toISOString(),
      };
    }
  },

  async updateCostSettings(settings: Omit<CostSettings, 'id' | 'updated_at'>, userId: string): Promise<void> {
    try {
      const docRef = doc(db, 'cost_settings', 'default');
      await setDoc(docRef, {
        product_cost_percent: Number(settings.product_cost_percent),
        default_delivery_cost: Number(settings.default_delivery_cost),
        other_fixed_cost: Number(settings.other_fixed_cost),
        updated_by: userId,
        updated_at: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'cost_settings/default');
    }
  },

  // Customers Directory
  async getCustomers(): Promise<Customer[]> {
    await seedDatabaseIfNeeded();
    try {
      const snap = await getDocs(collection(db, 'customers'));
      const list: Customer[] = [];
      snap.forEach((docRef) => {
        list.push(docRef.data() as Customer);
      });
      return list.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'customers');
      return [];
    }
  },

  async addCustomer(customer: Omit<Customer, 'id' | 'total_orders' | 'total_spent' | 'total_returns' | 'created_at'>): Promise<Customer> {
    await seedDatabaseIfNeeded();
    try {
      const q = query(collection(db, 'customers'), where('phone', '==', customer.phone));
      const qSnap = await getDocs(q);
      if (!qSnap.empty) {
        throw new Error('A customer with this phone number already exists.');
      }

      const customerId = `cust_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const newCustomer: Customer = {
        id: customerId,
        name: customer.name.trim(),
        phone: customer.phone.trim(),
        address: customer.address?.trim() || '',
        total_orders: 0,
        total_spent: 0,
        total_returns: 0,
        last_order_date: null,
        created_at: new Date().toISOString()
      };

      await setDoc(doc(db, 'customers', customerId), newCustomer);
      return newCustomer;
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) {
        throw error;
      }
      handleFirestoreError(error, OperationType.CREATE, 'customers');
      throw error;
    }
  },

  async updateCustomer(id: string, updates: Partial<Customer>): Promise<void> {
    try {
      const docRef = doc(db, 'customers', id);
      const cleanUpdates: any = {};
      if (updates.name !== undefined) cleanUpdates.name = updates.name.trim();
      if (updates.phone !== undefined) cleanUpdates.phone = updates.phone.trim();
      if (updates.address !== undefined) cleanUpdates.address = updates.address.trim();
      if (updates.total_orders !== undefined) cleanUpdates.total_orders = Number(updates.total_orders);
      if (updates.total_spent !== undefined) cleanUpdates.total_spent = Number(updates.total_spent);
      if (updates.total_returns !== undefined) cleanUpdates.total_returns = Number(updates.total_returns);
      if (updates.last_order_date !== undefined) cleanUpdates.last_order_date = updates.last_order_date;

      await setDoc(docRef, cleanUpdates, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `customers/${id}`);
    }
  },

  async deleteCustomer(id: string): Promise<void> {
    try {
      const docRef = doc(db, 'customers', id);
      const snap = await getDoc(docRef);
      const name = snap.exists() ? snap.data().name : id;
      await deleteDoc(docRef);
      
      // Cascade delete customer order records
      const q = query(collection(db, 'orders'), where('customer_id', '==', id));
      const ordersSnap = await getDocs(q);
      for (const orderDoc of ordersSnap.docs) {
        await deleteDoc(doc(db, 'orders', orderDoc.id));
      }

      await dbService.addAuditLog('delete_customer', id, name, `Deleted customer ${name} and cascaded their orders.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `customers/${id}`);
    }
  },

  // Orders Transaction Log
  async getOrders(): Promise<Order[]> {
    await seedDatabaseIfNeeded();
    try {
      const snap = await getDocs(collection(db, 'orders'));
      const list: Order[] = [];
      snap.forEach((docRef) => {
        list.push(docRef.data() as Order);
      });
      return list.sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime());
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'orders');
      return [];
    }
  },

  async addOrder(
    orderData: {
      customerName: string;
      customerPhone: string;
      customerAddress: string;
      amount: number;
      status: 'delivery' | 'return';
      product_cost: number;
      delivery_cost: number;
      other_costs: number;
      notes?: string;
    },
    operatorId: string
  ): Promise<Order> {
    await seedDatabaseIfNeeded();
    try {
      // Find or create customer (idempotent lookup)
      const q = query(collection(db, 'customers'), where('phone', '==', orderData.customerPhone.trim()));
      const qSnap = await getDocs(q);
      
      let targetCustomer: Customer;
      if (qSnap.empty) {
        const customerId = `cust_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        targetCustomer = {
          id: customerId,
          name: orderData.customerName.trim(),
          phone: orderData.customerPhone.trim(),
          address: orderData.customerAddress?.trim() || '',
          total_orders: 0,
          total_spent: 0,
          total_returns: 0,
          last_order_date: null,
          created_at: new Date().toISOString()
        };
        await setDoc(doc(db, 'customers', customerId), targetCustomer);
      } else {
        targetCustomer = qSnap.docs[0].data() as Customer;
      }

      const rawAmt = Math.abs(Number(orderData.amount) || 0);
      const sign = orderData.status === 'return' ? -1 : 1;
      const finalAmount = rawAmt * sign;
      const totalCost = Number(orderData.product_cost || 0) + Number(orderData.delivery_cost || 0) + Number(orderData.other_costs || 0);
      const profit = finalAmount - totalCost;

      const orderId = `ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const newOrder: Order = {
        id: orderId,
        customer_id: targetCustomer.id,
        customer_name: targetCustomer.name,
        customer_phone: targetCustomer.phone,
        operator_id: operatorId,
        operator_name: dbService.getCurrentUser()?.name || 'Operator',
        amount: finalAmount,
        status: orderData.status,
        product_cost: Number(orderData.product_cost || 0),
        delivery_cost: Number(orderData.delivery_cost || 0),
        other_costs: Number(orderData.other_costs || 0),
        total_cost: totalCost,
        profit: profit,
        order_date: new Date().toISOString(),
        notes: orderData.notes || ''
      };

      await setDoc(doc(db, 'orders', orderId), newOrder);

      // Recalculate customer metrics dynamically to guarantee 100% precision
      await recalculateCustomerStats(targetCustomer.id);

      return newOrder;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'orders');
      throw error;
    }
  },

  async deleteOrder(id: string): Promise<void> {
    try {
      const docRef = doc(db, 'orders', id);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return;
      const orderData = snap.data() as Order;
      
      await deleteDoc(docRef);
      
      // Cascaded customer statistics sync
      await recalculateCustomerStats(orderData.customer_id);

      await dbService.addAuditLog('delete_order', id, `Order ${id}`, `Deleted order with amount ৳${orderData.amount} for customer ${orderData.customer_name || orderData.customer_id}.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `orders/${id}`);
    }
  },

  // Inactive customers analysis (last order is older than 15 days)
  async getInactiveCustomers(days: number = 15): Promise<Customer[]> {
    await seedDatabaseIfNeeded();
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - days);

    try {
      const snap = await getDocs(collection(db, 'customers'));
      const list: Customer[] = [];
      snap.forEach((docRef) => {
        const c = docRef.data() as Customer;
        if (c.last_order_date && new Date(c.last_order_date) < thresholdDate) {
          list.push(c);
        }
      });
      return list.sort((a, b) => new Date(a.last_order_date!).getTime() - new Date(b.last_order_date!).getTime());
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'customers');
      return [];
    }
  },

  // Daily statistics for dashboard reporting
  async getStats(): Promise<{
    todaySales: number;
    todayProfit: number;
    todayOrders: number;
    todayReturns: number;
    weekSales: number;
    monthSales: number;
    costBreakdown: {
      product: number;
      delivery: number;
      other: number;
    };
    chartData: DailyStat[];
  }> {
    const orders = await this.getOrders();
    const payments = await this.getStaffPayments();
    const expenses = await this.getExpenses();

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const startOfWeek = new Date();
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0,0,0,0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let todaySales = 0;
    let todayOrderProfit = 0;
    let todayOrders = 0;
    let todayReturns = 0;

    let weekSales = 0;
    let monthSales = 0;

    let totalProductCost = 0;
    let totalDeliveryCost = 0;
    let totalOtherCosts = 0;

    orders.forEach((o) => {
      const dateStr = o.order_date.split('T')[0];
      const isReturn = o.status === 'return';
      const orderAmt = Math.abs(Number(o.amount) || 0);
      const signedAmt = isReturn ? -orderAmt : orderAmt;
      const profit = Number(o.profit) || 0;

      totalProductCost += Number(o.product_cost) || 0;
      totalDeliveryCost += Number(o.delivery_cost) || 0;
      totalOtherCosts += Number(o.other_costs) || 0;

      if (dateStr === todayStr) {
        if (!isReturn) {
          todaySales += orderAmt;
          todayOrders++;
        } else {
          todayReturns++;
          todaySales -= orderAmt;
        }
        todayOrderProfit += profit;
      }

      const oDate = new Date(o.order_date);
      if (oDate >= startOfWeek) {
        weekSales += signedAmt;
      }
      if (oDate >= startOfMonth) {
        monthSales += signedAmt;
      }
    });

    const totalStaffPayments = payments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
    const totalOtherExpenses = expenses.filter(e => e.expense_type !== 'Salary Payout').reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

    totalOtherCosts += totalStaffPayments + totalOtherExpenses;

    const todayExpensesAmount = expenses.reduce((acc, e) => {
      if (e.date === todayStr) {
        return acc + (Number(e.amount) || 0);
      }
      return acc;
    }, 0);

    const todayProfit = todayOrderProfit - todayExpensesAmount;

    const chartMap = new Map<string, { sales: number; profit: number; orders: number; returns: number }>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const k = d.toISOString().split('T')[0];
      chartMap.set(k, { sales: 0, profit: 0, orders: 0, returns: 0 });
    }

    orders.forEach((o) => {
      const k = o.order_date.split('T')[0];
      if (chartMap.has(k)) {
        const isReturn = o.status === 'return';
        const orderAmt = Math.abs(Number(o.amount) || 0);
        const signedAmt = isReturn ? -orderAmt : orderAmt;
        const profit = Number(o.profit) || 0;
        const current = chartMap.get(k)!;

        current.sales += signedAmt;
        current.profit += profit;
        if (isReturn) {
          current.returns++;
        } else {
          current.orders++;
        }
      }
    });

    expenses.forEach((e) => {
      const k = e.date;
      if (chartMap.has(k)) {
        const current = chartMap.get(k)!;
        current.profit -= (Number(e.amount) || 0);
      }
    });

    const chartData: DailyStat[] = Array.from(chartMap.entries()).map(([date, val]) => ({
      date,
      sales: Math.round(val.sales),
      profit: Math.round(val.profit),
      orders: val.orders,
      returns: val.returns,
    }));

    return {
      todaySales,
      todayProfit,
      todayOrders,
      todayReturns,
      weekSales,
      monthSales,
      costBreakdown: {
        product: totalProductCost,
        delivery: totalDeliveryCost,
        other: totalOtherCosts,
      },
      chartData,
    };
  },

  subscribeOrders(onUpdate: (orders: Order[]) => void, onError?: (err: any) => void): () => void {
    const q = collection(db, 'orders');
    return onSnapshot(q, (snap) => {
      const list: Order[] = [];
      snap.forEach((docRef) => {
        list.push(docRef.data() as Order);
      });
      const sorted = list.sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime());
      onUpdate(sorted);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
      if (onError) onError(error);
    });
  },

  subscribeCustomers(onUpdate: (customers: Customer[]) => void, onError?: (err: any) => void): () => void {
    const q = collection(db, 'customers');
    return onSnapshot(q, (snap) => {
      const list: Customer[] = [];
      snap.forEach((docRef) => {
        list.push(docRef.data() as Customer);
      });
      const sorted = list.sort((a, b) => a.name.localeCompare(b.name));
      onUpdate(sorted);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'customers');
      if (onError) onError(error);
    });
  },

  subscribeOperators(onUpdate: (operators: Profile[]) => void, onError?: (err: any) => void): () => void {
    const q = collection(db, 'profiles');
    return onSnapshot(q, (snap) => {
      const list: Profile[] = [];
      snap.forEach((docRef) => {
        list.push(docRef.data() as Profile);
      });
      const sorted = list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      onUpdate(sorted);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'profiles');
      if (onError) onError(error);
    });
  },

  subscribeStats(onUpdate: (stats: any) => void, onError?: (err: any) => void): () => void {
    const ordersCol = collection(db, 'orders');
    const expensesCol = collection(db, 'expenses');
    const paymentsCol = collection(db, 'staff_payments');

    let isUnsubscribed = false;
    const triggerUpdate = async () => {
      if (isUnsubscribed) return;
      try {
        const statsData = await dbService.getStats();
        onUpdate(statsData);
      } catch (err) {
        console.error("Error updating live stats:", err);
        if (onError) onError(err);
      }
    };

    const unsubOrders = onSnapshot(ordersCol, triggerUpdate, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'orders');
    });
    const unsubExpenses = onSnapshot(expensesCol, triggerUpdate, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'expenses');
    });
    const unsubPayments = onSnapshot(paymentsCol, triggerUpdate, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'staff_payments');
    });

    return () => {
      isUnsubscribed = true;
      unsubOrders();
      unsubExpenses();
      unsubPayments();
    };
  },

  subscribeProfile(phone: string, onUpdate: (profile: Profile | null) => void, onError?: (err: any) => void): () => void {
    const docRef = doc(db, 'profiles', phone.trim());
    return onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data() as Profile);
      } else {
        onUpdate(null);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `profiles/${phone}`);
      if (onError) onError(error);
    });
  },

  // --- STAFF METHODS ---
  async getStaff(): Promise<Staff[]> {
    try {
      const q = collection(db, 'staff');
      const snap = await getDocs(q);
      const list: Staff[] = [];
      snap.forEach((docRef) => {
        list.push(docRef.data() as Staff);
      });
      return list;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'staff');
      return [];
    }
  },

  async createStaff(staff: Omit<Staff, 'created_at'>): Promise<void> {
    try {
      const docRef = doc(db, 'staff', staff.id);
      await setDoc(docRef, {
        ...staff,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `staff/${staff.id}`);
      throw error;
    }
  },

  async updateStaff(id: string, updates: Partial<Staff>): Promise<void> {
    try {
      const docRef = doc(db, 'staff', id);
      await updateDoc(docRef, updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `staff/${id}`);
      throw error;
    }
  },

  async deleteStaff(id: string): Promise<void> {
    try {
      const docRef = doc(db, 'staff', id);
      const snap = await getDoc(docRef);
      const name = snap.exists() ? snap.data().name : id;
      await deleteDoc(docRef);
      await dbService.addAuditLog('delete_staff', id, name, `Deleted staff member named ${name}.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `staff/${id}`);
      throw error;
    }
  },

  subscribeStaff(onUpdate: (staff: Staff[]) => void, onError?: (err: any) => void): () => void {
    const q = collection(db, 'staff');
    return onSnapshot(q, (snap) => {
      const list: Staff[] = [];
      snap.forEach((docRef) => {
        list.push(docRef.data() as Staff);
      });
      const sorted = list.sort((a,b) => a.name.localeCompare(b.name));
      onUpdate(sorted);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'staff');
      if (onError) onError(error);
    });
  },

  // --- STAFF PAYMENTS ---
  async getStaffPayments(): Promise<StaffPayment[]> {
    try {
      const q = collection(db, 'staff_payments');
      const snap = await getDocs(q);
      const list: StaffPayment[] = [];
      snap.forEach((docRef) => {
        list.push(docRef.data() as StaffPayment);
      });
      return list;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'staff_payments');
      return [];
    }
  },

  async addStaffPayment(payment: StaffPayment): Promise<void> {
    try {
      const docRef = doc(db, 'staff_payments', payment.id);
      await setDoc(docRef, payment);

      const expenseId = `salary-payout-${payment.id}`;
      await setDoc(doc(db, 'expenses', expenseId), {
        id: expenseId,
        date: payment.payment_date.split('T')[0],
        staff_id: payment.staff_id,
        staff_name: payment.staff_name,
        expense_type: 'Salary Payout',
        amount: payment.amount,
        description: `বেতন পরিশোধ - মাস: ${payment.month_year} (${payment.days_worked} দিন ডিউটি)`,
        created_at: new Date().toISOString(),
        added_by: 'system'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `staff_payments/${payment.id}`);
      throw error;
    }
  },

  subscribeStaffPayments(onUpdate: (payments: StaffPayment[]) => void, onError?: (err: any) => void): () => void {
    const q = collection(db, 'staff_payments');
    return onSnapshot(q, (snap) => {
      const list: StaffPayment[] = [];
      snap.forEach((docRef) => {
        list.push(docRef.data() as StaffPayment);
      });
      const sorted = list.sort((a,b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());
      onUpdate(sorted);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'staff_payments');
      if (onError) onError(error);
    });
  },

  // --- GENERAL/CO-FOUNDER EXPENSES ---
  async getExpenses(): Promise<Expense[]> {
    try {
      const q = collection(db, 'expenses');
      const snap = await getDocs(q);
      const list: Expense[] = [];
      snap.forEach((docRef) => {
        list.push(docRef.data() as Expense);
      });
      return list;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'expenses');
      return [];
    }
  },

  async addExpense(expense: Expense): Promise<void> {
    try {
      const docRef = doc(db, 'expenses', expense.id);
      await setDoc(docRef, expense);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `expenses/${expense.id}`);
      throw error;
    }
  },

  async deleteExpense(id: string): Promise<void> {
    try {
      const docRef = doc(db, 'expenses', id);
      const snap = await getDoc(docRef);
      const expData = snap.exists() ? snap.data() : null;
      const desc = expData ? expData.description : '';
      const amt = expData ? expData.amount : 0;

      await deleteDoc(docRef);

      if (id.startsWith('salary-payout-')) {
        const paymentId = id.replace('salary-payout-', '');
        try {
          await deleteDoc(doc(db, 'staff_payments', paymentId));
        } catch (e) {
          console.error("Secondary payment delete failed:", e);
        }
      }

      await dbService.addAuditLog('delete_expense', id, `Expense ৳${amt}`, `Deleted expense voucher: "${desc}" for amount ৳${amt}.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `expenses/${id}`);
      throw error;
    }
  },

  subscribeExpenses(onUpdate: (expenses: Expense[]) => void, onError?: (err: any) => void): () => void {
    const q = collection(db, 'expenses');
    return onSnapshot(q, (snap) => {
      const list: Expense[] = [];
      snap.forEach((docRef) => {
        list.push(docRef.data() as Expense);
      });
      const sorted = list.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      onUpdate(sorted);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'expenses');
      if (onError) onError(error);
    });
  },

  // --- FARMER METHODS ---
  async getFarmers(): Promise<Farmer[]> {
    try {
      const q = collection(db, 'farmers');
      const snap = await getDocs(q);
      const list: Farmer[] = [];
      snap.forEach((docRef) => {
        list.push(docRef.data() as Farmer);
      });
      return list;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'farmers');
      return [];
    }
  },

  async createOrMergeFarmer(farmer: Omit<Farmer, 'created_at' | 'updated_at'>): Promise<void> {
    try {
      const docRef = doc(db, 'farmers', farmer.id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const existingData = snap.data() as Farmer;
        // Merge!
        await updateDoc(docRef, {
          name: farmer.name || existingData.name,
          secondary_phone: farmer.secondary_phone || existingData.secondary_phone || '',
          village: farmer.village || existingData.village,
          gender: farmer.gender || existingData.gender,
          products_sold: farmer.products_sold || existingData.products_sold,
          commission_rate: farmer.commission_rate || existingData.commission_rate,
          total_sales: existingData.total_sales + (farmer.total_sales || 0),
          our_profit: Math.round((existingData.total_sales + (farmer.total_sales || 0)) * (farmer.commission_rate || existingData.commission_rate || 5) / 100),
          total_paid: existingData.total_paid + (farmer.total_paid || 0),
          payment_count: existingData.payment_count + (farmer.payment_count || 0),
          updated_at: new Date().toISOString()
        });
      } else {
        // Create new!
        await setDoc(docRef, {
          ...farmer,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `farmers/${farmer.id}`);
      throw error;
    }
  },

  async updateFarmer(id: string, updates: Partial<Farmer>): Promise<void> {
    try {
      const docRef = doc(db, 'farmers', id);
      await updateDoc(docRef, {
        ...updates,
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `farmers/${id}`);
      throw error;
    }
  },

  async deleteFarmer(id: string): Promise<void> {
    try {
      const docRef = doc(db, 'farmers', id);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `farmers/${id}`);
      throw error;
    }
  },

  subscribeFarmers(onUpdate: (farmers: Farmer[]) => void, onError?: (err: any) => void): () => void {
    const q = collection(db, 'farmers');
    return onSnapshot(q, (snap) => {
      const list: Farmer[] = [];
      snap.forEach((docRef) => {
        list.push(docRef.data() as Farmer);
      });
      const sorted = list.sort((a,b) => a.name.localeCompare(b.name));
      onUpdate(sorted);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'farmers');
      if (onError) onError(error);
    });
  },

  // --- FARMER PAYMENTS ---
  async getFarmerPayments(): Promise<FarmerPayment[]> {
    try {
      const q = collection(db, 'farmer_payments');
      const snap = await getDocs(q);
      const list: FarmerPayment[] = [];
      snap.forEach((docRef) => {
        list.push(docRef.data() as FarmerPayment);
      });
      return list;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'farmer_payments');
      return [];
    }
  },

  async addFarmerPayment(payment: FarmerPayment): Promise<void> {
    try {
      const docRef = doc(db, 'farmer_payments', payment.id);
      await setDoc(docRef, payment);

      // Now update the Master Farmer's records
      const farmerRef = doc(db, 'farmers', payment.farmer_id);
      const farmerSnap = await getDoc(farmerRef);
      if (farmerSnap.exists()) {
        const existingData = farmerSnap.data() as Farmer;
        await updateDoc(farmerRef, {
          total_paid: existingData.total_paid + payment.amount,
          payment_count: existingData.payment_count + 1,
          updated_at: new Date().toISOString()
        });
      } else {
        // Create basic farmer if not exists!
        await setDoc(farmerRef, {
          id: payment.farmer_id,
          name: payment.farmer_name,
          phone: payment.farmer_phone,
          secondary_phone: '',
          village: 'Unknown',
          gender: 'male',
          products_sold: 'Unknown',
          commission_rate: 5,
          total_sales: 0,
          our_profit: 0,
          total_paid: payment.amount,
          payment_count: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }

      // Also double register in General Expenses as "Farmer Payment" so that it's tracked as a separate cost outlay
      const expenseId = `farmer-payment-${payment.id}`;
      await setDoc(doc(db, 'expenses', expenseId), {
        id: expenseId,
        date: payment.payment_date.split('T')[0],
        staff_id: payment.farmer_id,
        staff_name: payment.farmer_name,
        expense_type: 'Other Spend',
        amount: payment.amount,
        description: `কৃষক পরিশোধ - ${payment.farmer_name} (${payment.notes || 'কোনো মন্তব্য নেই'})`,
        created_at: new Date().toISOString(),
        added_by: payment.added_by
      });

    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `farmer_payments/${payment.id}`);
      throw error;
    }
  },

  async deleteFarmerPayment(id: string): Promise<void> {
    try {
      const docRef = doc(db, 'farmer_payments', id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const payment = snap.data() as FarmerPayment;
        const farmerRef = doc(db, 'farmers', payment.farmer_id);
        const farmerSnap = await getDoc(farmerRef);
        if (farmerSnap.exists()) {
          const existingData = farmerSnap.data() as Farmer;
          await updateDoc(farmerRef, {
            total_paid: Math.max(0, existingData.total_paid - payment.amount),
            payment_count: Math.max(0, existingData.payment_count - 1),
            updated_at: new Date().toISOString()
          });
        }
      }
      await deleteDoc(docRef);

      // Also remove from general expenses
      const expenseId = `farmer-payment-${id}`;
      try {
        await deleteDoc(doc(db, 'expenses', expenseId));
      } catch (e) {
        console.warn("Farmer secondary expense deletion skipped:", e);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `farmer_payments/${id}`);
      throw error;
    }
  },

  subscribeFarmerPayments(onUpdate: (payments: FarmerPayment[]) => void, onError?: (err: any) => void): () => void {
    const q = collection(db, 'farmer_payments');
    return onSnapshot(q, (snap) => {
      const list: FarmerPayment[] = [];
      snap.forEach((docRef) => {
        list.push(docRef.data() as FarmerPayment);
      });
      const sorted = list.sort((a,b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());
      onUpdate(sorted);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'farmer_payments');
      if (onError) onError(error);
    });
  },

  // --- FARMER SALES ---
  async getFarmerSales(): Promise<FarmerSale[]> {
    try {
      const q = collection(db, 'farmer_sales');
      const snap = await getDocs(q);
      const list: FarmerSale[] = [];
      snap.forEach((docRef) => {
        list.push(docRef.data() as FarmerSale);
      });
      return list;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'farmer_sales');
      return [];
    }
  },

  async addFarmerSale(sale: FarmerSale): Promise<void> {
    try {
      const docRef = doc(db, 'farmer_sales', sale.id);
      await setDoc(docRef, sale);

      // Now update the Master Farmer's records
      const farmerRef = doc(db, 'farmers', sale.farmer_id);
      const farmerSnap = await getDoc(farmerRef);
      if (farmerSnap.exists()) {
        const existingData = farmerSnap.data() as Farmer;
        const newTotalSales = existingData.total_sales + sale.amount;
        const newProfit = Math.round(newTotalSales * (sale.commission_rate || existingData.commission_rate || 5) / 100);
        await updateDoc(farmerRef, {
          total_sales: newTotalSales,
          our_profit: newProfit,
          products_sold: sale.products, // update latest products
          updated_at: new Date().toISOString()
        });
      } else {
        // Create basic farmer if not exists!
        await setDoc(farmerRef, {
          id: sale.farmer_id,
          name: sale.farmer_name,
          phone: sale.farmer_phone,
          secondary_phone: '',
          village: 'Unknown',
          gender: 'male',
          products_sold: sale.products,
          commission_rate: sale.commission_rate,
          total_sales: sale.amount,
          our_profit: sale.our_profit,
          total_paid: 0,
          payment_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `farmer_sales/${sale.id}`);
      throw error;
    }
  },

  async deleteFarmerSale(id: string): Promise<void> {
    try {
      const docRef = doc(db, 'farmer_sales', id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const sale = snap.data() as FarmerSale;
        const farmerRef = doc(db, 'farmers', sale.farmer_id);
        const farmerSnap = await getDoc(farmerRef);
        if (farmerSnap.exists()) {
          const existingData = farmerSnap.data() as Farmer;
          const newTotalSales = Math.max(0, existingData.total_sales - sale.amount);
          const newProfit = Math.round(newTotalSales * (existingData.commission_rate || 5) / 100);
          await updateDoc(farmerRef, {
            total_sales: newTotalSales,
            our_profit: newProfit,
            updated_at: new Date().toISOString()
          });
        }
      }
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `farmer_sales/${id}`);
      throw error;
    }
  },

  subscribeFarmerSales(onUpdate: (sales: FarmerSale[]) => void, onError?: (err: any) => void): () => void {
    const q = collection(db, 'farmer_sales');
    return onSnapshot(q, (snap) => {
      const list: FarmerSale[] = [];
      snap.forEach((docRef) => {
        list.push(docRef.data() as FarmerSale);
      });
      const sorted = list.sort((a,b) => new Date(b.sale_date).getTime() - new Date(a.sale_date).getTime());
      onUpdate(sorted);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'farmer_sales');
      if (onError) onError(error);
    });
  },

  async updateOrder(id: string, updates: Partial<Order>): Promise<void> {
    try {
      const docRef = doc(db, 'orders', id);
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        throw new Error('Order not found');
      }
      const existing = snap.data() as Order;
      const mergedOrder = {
        ...existing,
        ...updates
      };
      await setDoc(docRef, mergedOrder);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${id}`);
      throw error;
    }
  },

  async mergeCustomers(sourceId: string, targetId: string): Promise<void> {
    try {
      const targetDocRef = doc(db, 'customers', targetId);
      const targetSnap = await getDoc(targetDocRef);
      if (!targetSnap.exists()) {
        throw new Error("Target customer profile not found.");
      }
      const targetData = targetSnap.data() as Customer;

      const q = query(collection(db, 'orders'), where('customer_id', '==', sourceId));
      const ordersSnap = await getDocs(q);

      for (const orderDoc of ordersSnap.docs) {
        const orderRef = doc(db, 'orders', orderDoc.id);
        const orderData = orderDoc.data() as Order;
        const updatedOrder: Order = {
          ...orderData,
          customer_id: targetId,
          customer_name: targetData.name,
          customer_phone: targetData.phone
        };
        await setDoc(orderRef, updatedOrder);
      }

      await recalculateCustomerStats(targetId);
      await deleteDoc(doc(db, 'customers', sourceId));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `customers/merge/${sourceId}->${targetId}`);
      throw error;
    }
  },

  async getDailyLogs(): Promise<DailyLog[]> {
    try {
      const q = collection(db, 'daily_logs');
      const snap = await getDocs(q);
      const list: DailyLog[] = [];
      snap.forEach((docRef) => {
        list.push(docRef.data() as DailyLog);
      });
      return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'daily_logs');
      return [];
    }
  },

  async addDailyLog(log: DailyLog): Promise<void> {
    try {
      const docRef = doc(db, 'daily_logs', log.id);
      await setDoc(docRef, log);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `daily_logs/${log.id}`);
      throw error;
    }
  },

  async updateDailyLog(id: string, updates: Partial<DailyLog>): Promise<void> {
    try {
      const docRef = doc(db, 'daily_logs', id);
      await updateDoc(docRef, updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `daily_logs/${id}`);
      throw error;
    }
  },

  async deleteDailyLog(id: string): Promise<void> {
    try {
      const docRef = doc(db, 'daily_logs', id);
      await deleteDoc(docRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `daily_logs/${id}`);
      throw error;
    }
  },

  subscribeDailyLogs(onUpdate: (logs: DailyLog[]) => void, onError?: (err: any) => void): () => void {
    const q = collection(db, 'daily_logs');
    return onSnapshot(q, (snap) => {
      const list: DailyLog[] = [];
      snap.forEach((docRef) => {
        list.push(docRef.data() as DailyLog);
      });
      const sorted = list.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      onUpdate(sorted);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'daily_logs');
      if (onError) onError(error);
    });
  },

  async addAuditLog(action_type: string, target_id: string, target_name: string, details: string): Promise<void> {
    const currentUser = dbService.getCurrentUser();
    if (!currentUser) return;
    const admin_id = currentUser.id || currentUser.phone || 'Unknown';
    const admin_name = currentUser.name || 'Admin';

    try {
      const logId = doc(collection(db, 'audit_logs')).id;
      const logRef = doc(db, 'audit_logs', logId);
      await setDoc(logRef, {
        id: logId,
        admin_id,
        admin_name,
        action_type,
        target_id,
        target_name,
        timestamp: new Date().toISOString(),
        details
      });
    } catch (e) {
      console.error("Failed to log audit event:", e);
    }
  },

  subscribeAuditLogs(onUpdate: (logs: AuditLog[]) => void, onError?: (err: any) => void): () => void {
    const q = collection(db, 'audit_logs');
    return onSnapshot(q, (snap) => {
      const list: AuditLog[] = [];
      snap.forEach((docRef) => {
        list.push(docRef.data() as AuditLog);
      });
      const sorted = list.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      onUpdate(sorted);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'audit_logs');
      if (onError) onError(error);
    });
  }


};
