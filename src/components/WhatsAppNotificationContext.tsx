import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Customer } from '../types';
import { dbService } from '../db';
import { useNotification } from './NotificationContext';

export interface WhatsAppTemplate {
  id: string;
  label: string;
  text: string;
  isCustom?: boolean;
}

const DEFAULT_QUICK_TEMPLATES: WhatsAppTemplate[] = [
  { id: 'order_update', label: '📦 অর্ডার আপডেট (Order Update)', text: 'প্রিয় গ্রাহক, আপনার অর্ডারটি সফলভাবে আপডেট করা হয়েছে। ধন্যবাদ!' },
  { id: 'delivery_alert', label: '🚚 ডেলিভারি এলার্ট (Delivery Alert)', text: 'প্রিয় গ্রাহক, আপনার অর্ডারটি ডেলিভারির জন্য পাঠানো হয়েছে। কিছুক্ষণের মধ্যেই ডেলিভারি ম্যান আপনার সাথে যোগাযোগ করবেন।' },
  { id: 'payment_reminder', label: '💳 বকেয়া পরিশোধ (Payment Reminder)', text: 'প্রিয় গ্রাহক, আপনার বকেয়া পেমেন্টটি পরিশোধ করার জন্য বিনীত অনুরোধ করা হচ্ছে। ধন্যবাদ!' },
  { id: 'welcome', label: '👋 স্বাগতম শুভেচ্ছা (Welcome Message)', text: 'কৃষক বাজারে আপনাকে স্বাগতম! আমরা কীভাবে আপনাকে সাহায্য করতে পারি?' },
  { id: 'inactivity_reminder', label: '🌾 অলসতা রিমাইন্ডার (Inactivity Reminder)', text: 'আসসালামু আলাইকুম প্রিয় {name}, কৃষক বাজার (Krishok Bazar) থেকে আপনার শেষ অর্ডার ছিল প্রায় {days} দিন আগে ({date} তারিখে)। আশাকরি আমাদের তাজা শাকসবজি ও খামারি পণ্যগুলো আপনার পছন্দ হয়েছিল। পুনরায় অর্ডার করতে আজই আমাদের সাথে যোগাযোগ করুন। ধন্যবাদ!' }
];

interface WhatsAppNotificationContextType {
  templates: WhatsAppTemplate[];
  addTemplate: (label: string, text: string) => void;
  deleteTemplate: (id: string) => void;
  updateTemplate: (id: string, text: string) => void;
  
  inactiveCustomers: Customer[];
  loadingInactive: boolean;
  inactivityDays: number;
  setInactivityDays: (days: number) => void;
  refreshInactiveCustomers: () => Promise<void>;
  
  sentReminders: Record<string, string>; // customerId -> ISOString timestamp
  launchWhatsAppReminder: (customer: Customer, customText: string) => void;
  clearReminderHistory: () => void;
}

const WhatsAppNotificationContext = createContext<WhatsAppNotificationContextType | undefined>(undefined);

export const useWhatsAppNotification = () => {
  const context = useContext(WhatsAppNotificationContext);
  if (!context) {
    throw new Error('useWhatsAppNotification must be used within a WhatsAppNotificationProvider');
  }
  return context;
};

interface WhatsAppNotificationProviderProps {
  children: ReactNode;
}

export function WhatsAppNotificationProvider({ children }: WhatsAppNotificationProviderProps) {
  const { showError, showNotification } = useNotification();
  
  // 1. Templates state with LocalStorage persistence
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>(() => {
    const saved = localStorage.getItem('kb_whatsapp_templates');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing saved templates:", e);
      }
    }
    return DEFAULT_QUICK_TEMPLATES;
  });

  // Save templates whenever they change
  useEffect(() => {
    localStorage.setItem('kb_whatsapp_templates', JSON.stringify(templates));
  }, [templates]);

  // 2. Inactive customers state (Centralized)
  const [inactiveCustomers, setInactiveCustomers] = useState<Customer[]>([]);
  const [loadingInactive, setLoadingInactive] = useState(false);
  const [inactivityDays, setInactivityDaysState] = useState<number>(() => {
    const saved = localStorage.getItem('kb_inactivity_threshold_days');
    return saved ? parseInt(saved, 10) : 15;
  });

  const setInactivityDays = useCallback((days: number) => {
    setInactivityDaysState(days);
    localStorage.setItem('kb_inactivity_threshold_days', String(days));
  }, []);

  // 3. Sent reminders tracking with LocalStorage persistence
  const [sentReminders, setSentReminders] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('kb_sent_reminders_history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Error parsing reminder history:", e);
      }
    }
    return {};
  });

  // Fetch inactive customers from DB service
  const refreshInactiveCustomers = useCallback(async () => {
    setLoadingInactive(true);
    try {
      const list = await dbService.getInactiveCustomers(inactivityDays);
      
      // Sort inactive customers by oldest last_order_date first
      const sorted = [...list].sort((a, b) => {
        if (!a.last_order_date) return 1;
        if (!b.last_order_date) return -1;
        return new Date(a.last_order_date).getTime() - new Date(b.last_order_date).getTime();
      });
      
      setInactiveCustomers(sorted);
    } catch (err: any) {
      console.error("Error fetching inactive customers:", err);
      showError("গ্রাহক তথ্য লোড করতে সমস্যা হয়েছে", err);
    } finally {
      setLoadingInactive(false);
    }
  }, [inactivityDays, showError]);

  // Trigger refetch when inactivityDays changes
  useEffect(() => {
    refreshInactiveCustomers();
  }, [refreshInactiveCustomers]);

  // Manage Real-time Synchronization when customer list in DB updates
  useEffect(() => {
    // We can also subscribe to customers in real-time to detect if their last_order_date changes
    const unsubscribe = dbService.subscribeCustomers(
      (list) => {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - inactivityDays);
        
        const dormant = list.filter(c => {
          if (!c.last_order_date) return false;
          return new Date(c.last_order_date) < thresholdDate;
        });
        
        const sorted = dormant.sort((a, b) => {
          const dateA = new Date(a.last_order_date!).getTime();
          const dateB = new Date(b.last_order_date!).getTime();
          return dateA - dateB;
        });
        
        setInactiveCustomers(sorted);
      },
      (err) => {
        console.error("Error subscribing to customers in WhatsApp state manager:", err);
      }
    );

    return () => unsubscribe();
  }, [inactivityDays]);

  // Add Template Action
  const addTemplate = useCallback((label: string, text: string) => {
    const id = `custom_${Date.now()}`;
    const newTemplate: WhatsAppTemplate = { id, label, text, isCustom: true };
    setTemplates((prev) => [...prev, newTemplate]);
    showNotification("টেমপ্লেট সফল", "নতুন কুইক চ্যাট টেমপ্লেট যোগ করা হয়েছে!", "success", 4000, false);
  }, [showNotification]);

  // Delete Template Action
  const deleteTemplate = useCallback((id: string) => {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    showNotification("টেমপ্লেট সফল", "টেমপ্লেটটি মুছে ফেলা হয়েছে।", "success", 4000, false);
  }, [showNotification]);

  // Update Template Action
  const updateTemplate = useCallback((id: string, text: string) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, text } : t))
    );
    showNotification("টেমপ্লেট সফল", "টেমপ্লেট টেক্সট সফলভাবে আপডেট করা হয়েছে।", "success", 4000, false);
  }, [showNotification]);

  // Launch WhatsApp and record history
  const launchWhatsAppReminder = useCallback((customer: Customer, customText: string) => {
    const phone = customer.phone.trim();
    const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(customText)}`;
    
    // Open in a new tab/window
    window.open(waUrl, '_blank');
    
    // Record history
    const timestamp = new Date().toISOString();
    setSentReminders((prev) => {
      const updated = { ...prev, [customer.id]: timestamp };
      localStorage.setItem('kb_sent_reminders_history', JSON.stringify(updated));
      return updated;
    });

    showNotification(
      "মেসেজ শুরু হয়েছে",
      `${customer.name} কে হোয়াটসঅ্যাপ রিমাইন্ডার পাঠানোর উইন্ডো খোলা হয়েছে।`,
      "success",
      5000,
      false
    );
  }, [showNotification]);

  // Clear reminder history
  const clearReminderHistory = useCallback(() => {
    setSentReminders({});
    localStorage.removeItem('kb_sent_reminders_history');
    showNotification("ইতিহাস সফল", "রিমাইন্ডার পাঠানোর ইতিহাস মুছে ফেলা হয়েছে।", "success", 4000, false);
  }, [showNotification]);

  return (
    <WhatsAppNotificationContext.Provider
      value={{
        templates,
        addTemplate,
        deleteTemplate,
        updateTemplate,
        inactiveCustomers,
        loadingInactive,
        inactivityDays,
        setInactivityDays,
        refreshInactiveCustomers,
        sentReminders,
        launchWhatsAppReminder,
        clearReminderHistory
      }}
    >
      {children}
    </WhatsAppNotificationContext.Provider>
  );
}
