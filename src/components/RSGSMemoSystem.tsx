import React, { useState, useEffect } from 'react';
import { dbService } from '../db';
import { RSGSMemo, Profile } from '../types';
import { useNotification } from './NotificationContext';
import SignaturePad from './SignaturePad';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { LocalQRCode } from './LocalQRCode';
import { 
  FileText, Plus, Search, Printer, Trash2, Edit, PlusCircle, 
  User, BookOpen, Briefcase, Clock, DollarSign, CheckCircle, 
  Calendar, AlertCircle, MapPin, Building2, Eye, X, RefreshCw, Download, Phone,
  Send, Share2, MessageCircle, ShieldCheck, Copy, Link
} from 'lucide-react';

interface RSGSMemoSystemProps {
  user: Profile;
}

export default function RSGSMemoSystem({ user }: RSGSMemoSystemProps) {
  const { showNotification, showError } = useNotification();
  const [memos, setMemos] = useState<RSGSMemo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'all' | 'customer' | 'student'>('all');
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedMemo, setSelectedMemo] = useState<RSGSMemo | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Form states
  const [formMemoType, setFormMemoType] = useState<'customer' | 'student'>('customer');
  const [clientName, setClientName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [serviceType, setServiceType] = useState('Web Development');
  const [customService, setCustomService] = useState('');
  const [duration, setDuration] = useState('1 Month');
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [advancedAmount, setAdvancedAmount] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [signatureData, setSignatureData] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [shareWhatsAppNumber, setShareWhatsAppNumber] = useState('');
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [autoSendOnSave, setAutoSendOnSave] = useState(false);
  const [pendingAutoSend, setPendingAutoSend] = useState<RSGSMemo | null>(null);

  // Repeat / Recurring states
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState<'weekly' | 'monthly'>('monthly');
  const [recurringDay, setRecurringDay] = useState<number>(1);

  const isAdmin = user.role === 'admin';

  // Available services and courses lists
  const customerServices = [
    'Web Development',
    'App Development',
    'Social Media Marketing',
    'Digital Marketing Service',
    'SEO Optimization',
    'Graphics Design',
    'Other Service'
  ];

  const studentCourses = [
    'Web Development Course',
    'App Development Course',
    'Digital Marketing Course',
    'Flutter & Firebase Native App',
    'Python & Machine Learning',
    'Graphics Design & UI/UX',
    'Other Course'
  ];

  const customerDurations = ['7 Days', '15 Days', '1 Month', '3 Months', '6 Months', 'Custom'];
  const studentDurations = ['2 Months', '3 Months', '6 Months', '1 Year', 'Custom'];

  // Default templates with pricing and durations
  const serviceTemplates: Record<string, { duration: string; totalAmount: number }> = {
    'Web Development': { duration: '1 Month', totalAmount: 35000 },
    'App Development': { duration: '3 Months', totalAmount: 50000 },
    'Social Media Marketing': { duration: '1 Month', totalAmount: 15000 },
    'Digital Marketing Service': { duration: '1 Month', totalAmount: 12000 },
    'SEO Optimization': { duration: '1 Month', totalAmount: 10000 },
    'Graphics Design': { duration: '15 Days', totalAmount: 8000 },
    'Web Development Course': { duration: '3 Months', totalAmount: 15000 },
    'App Development Course': { duration: '3 Months', totalAmount: 18000 },
    'Digital Marketing Course': { duration: '2 Months', totalAmount: 10000 },
    'Flutter & Firebase Native App': { duration: '3 Months', totalAmount: 20000 },
    'Python & Machine Learning': { duration: '6 Months', totalAmount: 25000 },
    'Graphics Design & UI/UX': { duration: '3 Months', totalAmount: 12000 }
  };

  const handleServiceTypeChange = (val: string) => {
    setServiceType(val);
    const template = serviceTemplates[val];
    if (template) {
      setDuration(template.duration);
      setTotalAmount(template.totalAmount);
      showNotification(
        'টেমপ্লেট লোড হয়েছে',
        `"${val}" এর জন্য ডিফল্ট মূল্য ৳${template.totalAmount.toLocaleString('bn-BD')} এবং মেয়াদ "${template.duration}" নির্ধারণ করা হয়েছে।`,
        'success'
      );
    }
  };

  // Subscribe to memos
  useEffect(() => {
    setLoading(true);
    const unsubscribe = dbService.subscribeRSGSMemos(
      (data) => {
        setMemos(data);
        setLoading(false);
      },
      (error) => {
        showError('মেমো তথ্য লোড করতে সমস্যা হয়েছে', error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Update default states based on memo type changes
  useEffect(() => {
    if (!isEditing) {
      if (formMemoType === 'customer') {
        setServiceType('Web Development');
        setDuration('1 Month');
        setTotalAmount(35000);
      } else {
        setServiceType('Web Development Course');
        setDuration('3 Months');
        setTotalAmount(15000);
      }
    }
  }, [formMemoType, isEditing]);

  const handleOpenAdd = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormMemoType('customer');
    setClientName('');
    setStudentId('');
    setPhone('');
    setAddress('');
    setServiceType('Web Development');
    setCustomService('');
    setDuration('1 Month');
    setTotalAmount(35000);
    setAdvancedAmount(0);
    setNotes('');
    setSignatureData('');
    setIsRecurring(false);
    setRecurringInterval('monthly');
    setRecurringDay(1);
    setAutoSendOnSave(false);
    setShowAddModal(true);
  };

  const handleOpenEdit = (memo: RSGSMemo) => {
    if (!isAdmin) {
      showNotification('অনুমতি নেই', 'শুধুমাত্র এডমিন মেমো সংশোধন করতে পারবেন।', 'danger');
      return;
    }
    setIsEditing(true);
    setEditingId(memo.id);
    setFormMemoType(memo.memo_type);
    setClientName(memo.client_name);
    setStudentId(memo.student_id || '');
    setPhone(memo.phone);
    setAddress(memo.address || '');
    
    // Check if service is custom
    const allServices = [...customerServices, ...studentCourses];
    if (allServices.includes(memo.service_type)) {
      setServiceType(memo.service_type);
      setCustomService('');
    } else {
      setServiceType(memo.memo_type === 'customer' ? 'Other Service' : 'Other Course');
      setCustomService(memo.service_type);
    }

    setDuration(memo.duration);
    setTotalAmount(memo.total_amount);
    setAdvancedAmount(memo.advanced_amount);
    setNotes(memo.notes || '');
    setSignatureData(memo.signature_data || '');
    setIsRecurring(memo.is_recurring || false);
    setRecurringInterval(memo.recurring_interval || 'monthly');
    setRecurringDay(memo.recurring_day !== undefined ? memo.recurring_day : 1);
    setAutoSendOnSave(false);
    setShowAddModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) {
      showNotification('অনুমতি নেই', 'শুধুমাত্র এডমিন মেমো ডিলিট করতে পারবেন।', 'danger');
      return;
    }
    if (!window.confirm('আপনি কি নিশ্চিতভাবে এই মেমোটি ডিলিট করতে চান?')) return;
    try {
      await dbService.deleteRSGSMemo(id);
      showNotification('মেমো মুছে ফেলা হয়েছে', 'মেমোটি সফলভাবে ডেটাবেজ থেকে মুছে ফেলা হয়েছে!', 'success');
    } catch (error) {
      showError('মেমো ডিলিট করতে সমস্যা হয়েছে', error);
    }
  };

  // Helper to calculate the next recurrence date
  const calculateNextRecurDate = (baseDate: Date, interval: 'weekly' | 'monthly', scheduledDay: number): Date => {
    let nextDate = new Date(baseDate.getTime());
    nextDate.setHours(0, 0, 0, 0);
    
    if (interval === 'weekly') {
      nextDate.setDate(nextDate.getDate() + 1);
      while (nextDate.getDay() !== scheduledDay) {
        nextDate.setDate(nextDate.getDate() + 1);
      }
    } else {
      let year = baseDate.getFullYear();
      let month = baseDate.getMonth();
      
      let currentMonthTarget = new Date(year, month, scheduledDay);
      currentMonthTarget.setHours(0, 0, 0, 0);
      
      if (currentMonthTarget.getMonth() !== month) {
        currentMonthTarget = new Date(year, month + 1, 0);
      }
      
      // Use a 12 hour buffer to avoid triggering on the exact same day
      if (currentMonthTarget.getTime() > baseDate.getTime() + 12 * 60 * 60 * 1000) {
        nextDate = currentMonthTarget;
      } else {
        let targetMonth = month + 1;
        let targetYear = year;
        if (targetMonth > 11) {
          targetMonth = 0;
          targetYear++;
        }
        let nextMonthTarget = new Date(targetYear, targetMonth, scheduledDay);
        if (nextMonthTarget.getMonth() !== targetMonth) {
          nextMonthTarget = new Date(targetYear, targetMonth + 1, 0);
        }
        nextMonthTarget.setHours(0, 0, 0, 0);
        nextDate = nextMonthTarget;
      }
    }
    return nextDate;
  };

  // Helper to automatically generate unique, sequential invoice numbers
  const generateInvoiceNumber = (memosList: RSGSMemo[], tempGeneratedIds: string[] = []): string => {
    const currentYear = new Date().getFullYear();
    const prefix = 'KB';
    
    let maxSeq = 0;
    // Match pattern prefix-YYYY-sequence (e.g. KB-2024-001 or RSGS-2024-001)
    const regex = /^(KB|RSGS|RSGS-AUTO)-(\d{4})-(\d+)$/;
    
    // Scan existing memos in state
    for (const memo of memosList) {
      const match = memo.id.match(regex);
      if (match) {
        const year = parseInt(match[2], 10);
        if (year === currentYear) {
          const seq = parseInt(match[3], 10);
          if (seq > maxSeq) {
            maxSeq = seq;
          }
        }
      }
    }

    // Scan temporary IDs generated in the current batch loop to prevent collisions
    for (const id of tempGeneratedIds) {
      const match = id.match(regex);
      if (match) {
        const year = parseInt(match[2], 10);
        if (year === currentYear) {
          const seq = parseInt(match[3], 10);
          if (seq > maxSeq) {
            maxSeq = seq;
          }
        }
      }
    }
    
    const nextSeq = maxSeq + 1;
    const paddedSeq = String(nextSeq).padStart(3, '0');
    return `${prefix}-${currentYear}-${paddedSeq}`;
  };

  // Helper to trigger automated memo creation
  const triggerRecurrence = async (templateMemo: RSGSMemo, autoMemoId: string) => {
    const updatedTemplate: Partial<RSGSMemo> = {
      last_recurred_at: new Date().toISOString()
    };
    
    const autoMemo: RSGSMemo = {
      id: autoMemoId,
      memo_type: templateMemo.memo_type,
      client_name: templateMemo.client_name,
      phone: templateMemo.phone,
      address: templateMemo.address || '',
      service_type: templateMemo.service_type,
      duration: templateMemo.duration,
      total_amount: templateMemo.total_amount,
      advanced_amount: 0,
      due_amount: templateMemo.total_amount,
      created_at: new Date().toISOString(),
      created_by_id: 'system-recurring',
      created_by_name: 'System (Auto-Recurring)',
      notes: `[স্বয়ংক্রিয় পুনরাবৃত্তি] পূর্ববর্তী মেমো নং ${templateMemo.id} থেকে তৈরি।\n` + (templateMemo.notes || '')
    };

    try {
      await dbService.updateRSGSMemo(templateMemo.id, updatedTemplate);
      await dbService.addRSGSMemo(autoMemo);
      showNotification(
        'স্বয়ংক্রিয় মেমো তৈরি সফল',
        `সাবস্ক্রিপশন মেমো স্বয়ংক্রিয়ভাবে তৈরি হয়েছে (মেমো আইডি: ${autoMemo.id})!`,
        'success'
      );
    } catch (err) {
      console.error("Failed to process auto-recurrence:", templateMemo.id, err);
    }
  };

  // Automated Repeat Memo checker loop
  useEffect(() => {
    if (loading || memos.length === 0) return;
    
    const now = new Date();
    const processedIds: string[] = [];

    const checkAndProcess = async () => {
      const newlyGenerated: string[] = [];
      for (const memo of memos) {
        if (memo.is_recurring) {
          const baseDateStr = memo.last_recurred_at || memo.created_at;
          const baseDate = new Date(baseDateStr);
          const nextDate = calculateNextRecurDate(baseDate, memo.recurring_interval || 'monthly', memo.recurring_day || 1);
          
          if (now >= nextDate) {
            if (processedIds.includes(memo.id)) continue;
            processedIds.push(memo.id);
            
            const nextId = generateInvoiceNumber(memos, newlyGenerated);
            newlyGenerated.push(nextId);
            
            await triggerRecurrence(memo, nextId);
          }
        }
      }
    };

    checkAndProcess();
  }, [memos, loading]);

  // Trigger auto-send WhatsApp when a pending memo is set, and the print modal with the target ID is active
  useEffect(() => {
    if (pendingAutoSend && selectedMemo && selectedMemo.id === pendingAutoSend.id && showPrintModal) {
      // Short delay to ensure document/canvas content has fully updated and rendered
      const timer = setTimeout(() => {
        handleSendToWhatsApp(pendingAutoSend);
        setPendingAutoSend(null);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [pendingAutoSend, selectedMemo, showPrintModal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientName.trim() || !phone.trim() || !duration) {
      showNotification('ভুল ইনপুট', 'অনুগ্রহ করে সব প্রয়োজনীয় ঘর পূরণ করুন।', 'danger');
      return;
    }

    const finalService = (serviceType === 'Other Service' || serviceType === 'Other Course')
      ? (customService.trim() || serviceType)
      : serviceType;

    const calculatedDue = Math.max(0, totalAmount - advancedAmount);

    try {
      if (isEditing && editingId) {
        if (!isAdmin) {
          showNotification('অনুমতি নেই', 'শুধুমাত্র এডমিন মেমো সংশোধন করতে পারবেন।', 'danger');
          return;
        }
        const oldMemo = memos.find(m => m.id === editingId);
        const updates: Partial<RSGSMemo> = {
          memo_type: formMemoType,
          client_name: clientName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          service_type: finalService,
          duration,
          total_amount: totalAmount,
          advanced_amount: advancedAmount,
          due_amount: calculatedDue,
          notes: notes.trim(),
          is_recurring: isRecurring,
          recurring_interval: isRecurring ? recurringInterval : undefined,
          recurring_day: isRecurring ? recurringDay : undefined,
          last_recurred_at: isRecurring 
            ? (oldMemo?.is_recurring ? oldMemo.last_recurred_at : null)
            : null,
          student_id: formMemoType === 'student' ? studentId.trim() : '',
          signature_data: signatureData
        };
        await dbService.updateRSGSMemo(editingId, updates);
        showNotification('মেমো আপডেট সফল', 'মেমোটি সফলভাবে আপডেট করা হয়েছে।', 'success');

        if (autoSendOnSave) {
          const updatedMemo: RSGSMemo = {
            ...oldMemo,
            ...updates,
            id: editingId,
            created_at: oldMemo?.created_at || new Date().toISOString(),
            created_by_id: oldMemo?.created_by_id || user.id,
            created_by_name: oldMemo?.created_by_name || user.name,
          } as RSGSMemo;
          setSelectedMemo(updatedMemo);
          setShareWhatsAppNumber(updatedMemo.phone || '');
          setShowPrintModal(true);
          setPendingAutoSend(updatedMemo);
        }
      } else {
        const nextId = generateInvoiceNumber(memos);
        const newMemo: RSGSMemo = {
          id: nextId,
          memo_type: formMemoType,
          client_name: clientName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          service_type: finalService,
          duration,
          total_amount: totalAmount,
          advanced_amount: advancedAmount,
          due_amount: calculatedDue,
          created_at: new Date().toISOString(),
          created_by_id: user.id,
          created_by_name: user.name,
          notes: notes.trim(),
          is_recurring: isRecurring,
          recurring_interval: isRecurring ? recurringInterval : undefined,
          recurring_day: isRecurring ? recurringDay : undefined,
          last_recurred_at: null,
          student_id: formMemoType === 'student' ? studentId.trim() : '',
          signature_data: signatureData
        };
        await dbService.addRSGSMemo(newMemo);
        showNotification('মেমো তৈরি সফল', 'নতুন মেমোটি সফলভাবে যুক্ত করা হয়েছে!', 'success');

        if (autoSendOnSave) {
          setSelectedMemo(newMemo);
          setShareWhatsAppNumber(newMemo.phone || '');
          setShowPrintModal(true);
          setPendingAutoSend(newMemo);
        }
      }
      setShowAddModal(false);
    } catch (error) {
      showError('মেমো সংরক্ষণ ব্যর্থ হয়েছে', error);
    }
  };

  const handlePrintTrigger = (memo: RSGSMemo) => {
    setSelectedMemo(memo);
    setShareWhatsAppNumber(memo.phone || '');
    setShowPrintModal(true);
  };

  const executePrint = () => {
    window.print();
  };

  // Helper to generate a crisp A4 PDF Blob from invoice HTML
  const generatePDFBlob = async (): Promise<Blob | null> => {
    const element = document.getElementById('print-invoice-area');
    
    // Detailed console logging diagnostic block to capture exact element state
    console.log('=== PDF Capture Element Diagnostic ===');
    console.log('Target Element ID: print-invoice-area');
    if (element) {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      console.log('Element found in DOM: YES');
      console.log('Bounding Rect (Viewport Relative):', {
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left,
        bottom: rect.bottom,
        right: rect.right
      });
      console.log('Client/Offset dimensions:', {
        clientWidth: element.clientWidth,
        clientHeight: element.clientHeight,
        offsetWidth: element.offsetWidth,
        offsetHeight: element.offsetHeight,
        scrollWidth: element.scrollWidth,
        scrollHeight: element.scrollHeight
      });
      console.log('Computed Styles:', {
        display: style.display,
        position: style.position,
        visibility: style.visibility,
        opacity: style.opacity,
        transform: style.transform,
        zIndex: style.zIndex,
        overflow: style.overflow
      });

      // Traverse ancestors to check for hidden container issues
      let parent = element.parentElement;
      while (parent) {
        const pStyle = window.getComputedStyle(parent);
        if (pStyle.display === 'none' || pStyle.visibility === 'hidden' || parseFloat(pStyle.opacity) === 0) {
          console.warn('Hidden Ancestor Found! html2canvas might fail or produce a blank image:', {
            tagName: parent.tagName,
            id: parent.id,
            className: parent.className,
            display: pStyle.display,
            visibility: pStyle.visibility,
            opacity: pStyle.opacity
          });
        }
        parent = parent.parentElement;
      }
    } else {
      console.error('Element found in DOM: NO! print-invoice-area is missing from the document tree.');
    }
    console.log('=======================================');

    if (!element) {
      showNotification('ত্রুটি', 'রশিদ ভিউ পাওয়া যায়নি।', 'danger');
      return null;
    }

    setIsGeneratingPDF(true);
    try {
      // Small delay to ensure any dynamic assets/images are fully rendered
      await new Promise((resolve) => setTimeout(resolve, 300));

      const canvas = await html2canvas(element, {
        scale: 2, // 2x density for extra high class crispness
        useCORS: true,
        logging: true, // Enable html2canvas internal logs for deeper debugging
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgWidth = 210; // A4 size width in mm
      const pageHeight = 297; // A4 size height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Calculate centering offset to make it look exactly like an official document centered on A4 sheet
      let yOffset = 0;
      if (imgHeight < pageHeight) {
        yOffset = (pageHeight - imgHeight) / 2;
      }

      pdf.addImage(imgData, 'PNG', 0, yOffset, imgWidth, imgHeight);
      
      return pdf.output('blob');
    } catch (err) {
      console.error('Error generating PDF:', err);
      showNotification('ত্রুটি', 'পিডিএফ ফাইল তৈরি করতে ব্যর্থ হয়েছে।', 'danger');
      return null;
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Downloads the invoice PDF to the device
  const handleDownloadPDF = async (memo: RSGSMemo) => {
    const pdfBlob = await generatePDFBlob();
    if (!pdfBlob) return;

    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Invoice_${memo.id}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showNotification('ডাউনলোড সফল', 'পিডিএফ মেমোটি সফলভাবে ডাউনলোড করা হয়েছে।', 'success');
  };

  // Copies the online verification link to clipboard
  const handleCopyVerificationLink = (memoId: string) => {
    const link = `${window.location.origin}?verify=${memoId}`;
    navigator.clipboard.writeText(link)
      .then(() => {
        setCopiedLinkId(memoId);
        showNotification('লিঙ্ক কপি হয়েছে', 'ভেরিফিকেশন লিঙ্কটি ক্লিপবোর্ডে কপি করা হয়েছে।', 'success');
        setTimeout(() => setCopiedLinkId(null), 2500);
      })
      .catch((err) => {
        console.error('Failed to copy link: ', err);
        showNotification('ত্রুটি', 'লিঙ্ক কপি করা যায়নি।', 'danger');
      });
  };

  // Sends PDF details and triggers direct WhatsApp redirect
  const handleSendToWhatsApp = async (memo: RSGSMemo) => {
    const cleanNumber = shareWhatsAppNumber.replace(/\D/g, '');
    if (!cleanNumber || cleanNumber.length < 10) {
      showNotification('ভুল নম্বর', 'অনুগ্রহ করে একটি সঠিক হোয়াটসঅ্যাপ নম্বর প্রদান করুন।', 'danger');
      return;
    }

    // Format number to include international prefix (88 for Bangladesh) if missing
    const formattedNumber = cleanNumber.startsWith('88') ? cleanNumber : `88${cleanNumber.startsWith('0') ? cleanNumber : '0' + cleanNumber}`;

    // First generate and download the actual PDF
    const pdfBlob = await generatePDFBlob();
    if (!pdfBlob) return;

    // Trigger local download so they have the file ready to attach
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Invoice_${memo.id}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // Formulate a beautiful summary message
    const totalBn = memo.total_amount.toLocaleString('bn-BD');
    const advancedBn = memo.advanced_amount.toLocaleString('bn-BD');
    const dueBn = memo.due_amount.toLocaleString('bn-BD');

    const textMessage = `আসসালামু আলাইকুম, RSGS Global Solution Group থেকে আপনার মেমো রশিদটি পাঠানো হলো।\n\n` +
      `🧾 মেমো নং: ${memo.id}\n` +
      `👤 গ্রাহক/ছাত্র: ${memo.client_name}\n` +
      `💼 বিবরণ: ${memo.service_type}\n` +
      `💵 মোট ফি: ৳ ${totalBn}\n` +
      `✅ পরিশোধিত: ৳ ${advancedBn}\n` +
      `⚠️ বকেয়া: ৳ ${dueBn}\n\n` +
      `📥 আপনার মেমোটির পিডিএফ কপি স্বয়ংক্রিয়ভাবে ডাউনলোড হয়েছে। দয়া করে চ্যাট বক্সে ফাইলটি সরাসরি সংযুক্ত (Attach) করে দিন। ধন্যবাদ!`;

    const waUrl = `https://wa.me/${formattedNumber}?text=${encodeURIComponent(textMessage)}`;
    
    // Open WhatsApp Web/App in a new tab
    window.open(waUrl, '_blank');
    
    showNotification(
      'হোয়াটসঅ্যাপ চ্যাট ওপেন হচ্ছে',
      'পিডিএফ ফাইলটি ডাউনলোড হয়েছে। চ্যাটে ফাইলটি সংযুক্ত (Attach) করে দিন।',
      'success'
    );
  };

  // Uses Web Share API (if supported) to share the actual PDF file directly to WhatsApp, Imo, or other apps
  const handleNativeShare = async (memo: RSGSMemo) => {
    const pdfBlob = await generatePDFBlob();
    if (!pdfBlob) return;

    const fileName = `Invoice_${memo.id}.pdf`;
    const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `RSGS Invoice ${memo.id}`,
          text: `RSGS Global Solution Group - Official Invoice ${memo.id}`,
        });
        showNotification('শেয়ার সফল', 'পিডিএফ ফাইলটি সফলভাবে পাঠানো হয়েছে।', 'success');
      } catch (error) {
        console.error('Sharing failed:', error);
        // Fallback: download the file
        handleDownloadPDF(memo);
      }
    } else {
      // Fallback if native sharing is unsupported
      handleDownloadPDF(memo);
      showNotification(
        'সরাসরি শেয়ার সাপোর্ট করে না',
        'আপনার ব্রাউজারে সরাসরি ফাইল শেয়ারিং সাপোর্ট করে না। পিডিএফটি ডাউনলোড করা হয়েছে, এটি ম্যানুয়ালি পাঠান।',
        'warning'
      );
    }
  };

  const handleExportCSV = () => {
    if (memos.length === 0) {
      showNotification('কোন তথ্য নেই', 'ডাউনলোড করার জন্য কোনো মেমো পাওয়া যায়নি।', 'warning');
      return;
    }

    // CSV Headers
    const headers = [
      'Memo ID',
      'Memo Type',
      'Client Name',
      'Phone',
      'Address',
      'Service/Course Title',
      'Duration',
      'Total Amount (BDT)',
      'Advanced Amount (BDT)',
      'Due Amount (BDT)',
      'Created At',
      'Created By'
    ];

    // Helper to escape CSV cell values
    const escapeCSVCell = (val: any) => {
      if (val === undefined || val === null) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvRows = [
      headers.join(','),
      ...memos.map(m => [
        escapeCSVCell(m.id),
        escapeCSVCell(m.memo_type),
        escapeCSVCell(m.client_name),
        escapeCSVCell(m.phone),
        escapeCSVCell(m.address || ''),
        escapeCSVCell(m.service_type),
        escapeCSVCell(m.duration),
        escapeCSVCell(m.total_amount),
        escapeCSVCell(m.advanced_amount),
        escapeCSVCell(m.due_amount),
        escapeCSVCell(new Date(m.created_at).toLocaleString('en-US')),
        escapeCSVCell(m.created_by_name)
      ].join(','))
    ];

    const csvContent = "\uFEFF" + csvRows.join('\n'); // UTF-8 BOM for Bengali Excel support
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `RSGS_Memos_Backup_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showNotification('এক্সপোর্ট সফল', 'মেমো লগ সফলভাবে CSV ফাইল হিসেবে এক্সপোর্ট করা হয়েছে।', 'success');
  };

  // Filtered list
  const filteredMemos = memos.filter(m => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = 
      m.client_name.toLowerCase().includes(query) ||
      m.phone.toLowerCase().includes(query) ||
      m.id.toLowerCase().includes(query) ||
      m.service_type.toLowerCase().includes(query);
    
    const matchesType = selectedTypeFilter === 'all' || m.memo_type === selectedTypeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6" id="rsgs-memo-container">
      {/* Media print custom CSS styling injection */}
      <style>{`
        @media print {
          /* Set absolute pristine print background */
          body {
            background: #ffffff !important;
            color: #000000 !important;
            font-size: 11pt;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          /* Hide all elements by default on paper */
          body * {
            visibility: hidden !important;
          }

          /* Force display none on floating items, navigation bars, and buttons to avoid empty layout space */
          header,
          nav,
          aside,
          footer,
          button,
          .no-print,
          [id^="whatsapp-chat"],
          .floating-chat {
            display: none !important;
          }

          /* Overwrite visibility for ONLY the printable invoice wrapper and its entire tree */
          #print-invoice-area, 
          #print-invoice-area * {
            visibility: visible !important;
          }

          /* Position the invoice beautifully at the absolute top-left corner of the page */
          #print-invoice-area {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
            background: #ffffff !important;
          }

          /* Set precise paper margins and dimension size rules */
          @page {
            size: A4 portrait;
            margin: 15mm 15mm 15mm 15mm;
          }

          /* Ensure exact background and text rendering on standard office paper printers */
          .bg-slate-50 {
            background-color: #f8fafc !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          .bg-indigo-50 {
            background-color: #f0f2ff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          .bg-emerald-50 {
            background-color: #ecfdf5 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          /* Secure watermark rendering for print */
          .print-watermark {
            display: flex !important;
            opacity: 0.045 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* Top Section */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs no-print">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">RSGS Global Solution Group</h1>
              <p className="text-xs text-slate-500 font-bold tracking-wide uppercase">International Invoice & Memo System</p>
            </div>
          </div>
          <p className="text-xs text-slate-450">গ্রাহক এবং ছাত্র-ছাত্রীদের সার্ভিস ফি ও কোর্স ফি এর রশিদ/মেমো সংরক্ষণ এবং প্রিন্ট করার জন্য ডেডিকেটেড পোর্টাল।</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-slate-500 font-semibold pt-1">
            <span className="flex items-center gap-1 bg-slate-50 border border-slate-150 px-2.5 py-1 rounded-lg">
              <MapPin className="w-3.5 h-3.5 text-indigo-500" /> সৈয়দ প্লাজা (২য় তলা), রাজ্জাক প্লাজা সংলগ্ন, ঢাকা
            </span>
            <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-1 rounded-lg">
              <Phone className="w-3.5 h-3.5 text-emerald-500" /> WhatsApp: ০১৭৪৮৫২৪৩৮১
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          {isAdmin && (
            <button
              onClick={handleExportCSV}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200 shadow-2xs cursor-pointer active:scale-95"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>এক্সপোর্ট করুন (Export CSV)</span>
            </button>
          )}
          <button
            onClick={handleOpenAdd}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>মেমো তৈরি করুন (Create Memo)</span>
          </button>
        </div>
      </div>

      {/* Grid Dashboard Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">সর্বমোট মেমো</p>
            <p className="text-xl font-black text-slate-800">{memos.length} টি</p>
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">মোট আদায়কৃত টাকা</p>
            <p className="text-xl font-black text-emerald-600">৳ {memos.reduce((sum, m) => sum + m.advanced_amount, 0).toLocaleString('bn-BD')}</p>
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">মোট বকেয়া বা পাওনা</p>
            <p className="text-xl font-black text-rose-600">৳ {memos.reduce((sum, m) => sum + m.due_amount, 0).toLocaleString('bn-BD')}</p>
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200/80 shadow-2xs flex items-center gap-3.5">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">বকেয়া সম্পন্ন মেমো</p>
            <p className="text-xl font-black text-amber-600">{memos.filter(m => m.due_amount > 0).length} টি</p>
          </div>
        </div>
      </div>

      {/* Filtered View Summary Card */}
      <div className="bg-gradient-to-r from-indigo-500/10 to-indigo-600/5 border border-indigo-150 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div className="space-y-1">
          <h2 className="text-xs font-black text-indigo-700 uppercase tracking-widest flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span>ফিল্টারকৃত ভিউ সারসংক্ষেপ (Filtered View Summary)</span>
          </h2>
          <p className="text-[11px] text-slate-500 font-semibold">অনুসন্ধান বা ফিল্টার অনুযায়ী বর্তমান তালিকার লাইভ হিসেব।</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 md:gap-8">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ফিল্টারকৃত মোট বিল (Billed)</p>
            <p className="text-base sm:text-lg font-black text-slate-800">৳ {filteredMemos.reduce((sum, m) => sum + m.total_amount, 0).toLocaleString('bn-BD')}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ফিল্টারকৃত আদায়কৃত (Received)</p>
            <p className="text-base sm:text-lg font-black text-emerald-600">৳ {filteredMemos.reduce((sum, m) => sum + m.advanced_amount, 0).toLocaleString('bn-BD')}</p>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ফিল্টারকৃত বকেয়া (Due)</p>
            <p className="text-base sm:text-lg font-black text-rose-600">৳ {filteredMemos.reduce((sum, m) => sum + m.due_amount, 0).toLocaleString('bn-BD')}</p>
          </div>
        </div>
      </div>

      {/* Main List and Search */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden no-print">
        {/* Filter controls */}
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-72">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder="নাম, ফোন বা আইডি দিয়ে খুঁজুন..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-3xs"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-xs font-bold text-slate-500 hidden sm:inline">ফিল্টার:</span>
            <div className="grid grid-cols-3 gap-1 bg-slate-200/60 p-1 rounded-xl w-full md:w-auto">
              <button
                onClick={() => setSelectedTypeFilter('all')}
                className={`px-4 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer transition-all ${
                  selectedTypeFilter === 'all' ? 'bg-white text-indigo-600 shadow-3xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                সকল মেমো
              </button>
              <button
                onClick={() => setSelectedTypeFilter('customer')}
                className={`px-4 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer transition-all ${
                  selectedTypeFilter === 'customer' ? 'bg-white text-indigo-600 shadow-3xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                গ্রাহক (Customer)
              </button>
              <button
                onClick={() => setSelectedTypeFilter('student')}
                className={`px-4 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer transition-all ${
                  selectedTypeFilter === 'student' ? 'bg-white text-indigo-600 shadow-3xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                ছাত্র (Student)
              </button>
            </div>
          </div>
        </div>

        {/* Memo List View */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
            <p className="text-xs text-slate-500 font-bold">মেমো ডাটাবেজ থেকে নিয়ে আসা হচ্ছে...</p>
          </div>
        ) : filteredMemos.length === 0 ? (
          <div className="py-16 text-center">
            <div className="h-14 w-14 rounded-full bg-slate-50 text-slate-350 flex items-center justify-center mx-auto mb-3">
              <FileText className="w-7 h-7" />
            </div>
            <p className="text-sm font-bold text-slate-600">কোনো মেমো পাওয়া যায়নি!</p>
            <p className="text-xs text-slate-450 mt-1">অনুগ্রহ করে নতুন একটি মেমো রশিদ তৈরি করুন।</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-150/80 bg-slate-50 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">আইডি ও তারিখ</th>
                  <th className="py-3 px-4">মেমো ধরণ</th>
                  <th className="py-3 px-4">নাম ও ফোন</th>
                  <th className="py-3 px-4">সার্ভিস/কোর্স ও মেয়াদ</th>
                  <th className="py-3 px-4 text-right">মোট টাকা</th>
                  <th className="py-3 px-4 text-right">আদায়কৃত</th>
                  <th className="py-3 px-4 text-right">বকেয়া</th>
                  <th className="py-3 px-4 text-center">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredMemos.map((memo) => (
                  <tr key={memo.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-4">
                      <p className="font-mono font-bold text-indigo-600">{memo.id}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(memo.created_at).toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                        memo.memo_type === 'customer' 
                          ? 'bg-blue-50 text-blue-700 border border-blue-100' 
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                      }`}>
                        {memo.memo_type === 'customer' ? (
                          <>
                            <Briefcase className="w-3 h-3" />
                            <span>গ্রাহক</span>
                          </>
                        ) : (
                          <>
                            <BookOpen className="w-3 h-3" />
                            <span>ছাত্র</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold">
                      <p className="text-slate-800 font-bold">{memo.client_name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-slate-500 font-mono">{memo.phone}</span>
                        {memo.memo_type === 'student' && memo.student_id && (
                          <span className="inline-flex items-center px-1.5 py-0.5 bg-indigo-50 text-indigo-700 text-[9px] font-bold rounded border border-indigo-100">
                            ID: {memo.student_id}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold">
                      <p className="text-slate-700 truncate max-w-xs">{memo.service_type}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <span className="text-[10px] text-slate-450 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" /> Duration: {memo.duration}
                        </span>
                        {memo.is_recurring && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-50 text-indigo-600 font-bold text-[9px] rounded border border-indigo-100 uppercase tracking-wide">
                            <RefreshCw className="w-2.5 h-2.5 text-indigo-500" />
                            <span>
                              {memo.recurring_interval === 'weekly'
                                ? `সাপ্তাহিক (${['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহঃ', 'শুক্র', 'শনি'][memo.recurring_day ?? 1]})`
                                : `মাসিক (${memo.recurring_day ?? 1} তারিখ)`
                              }
                            </span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-slate-800">৳ {memo.total_amount.toLocaleString('bn-BD')}</td>
                    <td className="py-3.5 px-4 text-right font-black text-emerald-600">৳ {memo.advanced_amount.toLocaleString('bn-BD')}</td>
                    <td className="py-3.5 px-4 text-right">
                      {memo.due_amount > 0 ? (
                        <p className="font-black text-rose-600">৳ {memo.due_amount.toLocaleString('bn-BD')}</p>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-50 text-emerald-600 font-bold text-[9px] rounded border border-emerald-100 uppercase">Paid</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-2">
                        {/* View & Print Option (Allowed for all roles) */}
                        <button
                          onClick={() => handlePrintTrigger(memo)}
                          title="বিস্তারিত ও প্রিন্ট (View & Print)"
                          className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          <span className="text-[10px] font-bold">বিস্তারিত</span>
                        </button>

                        {/* Send directly to WhatsApp shortcut */}
                        <button
                          onClick={() => {
                            handlePrintTrigger(memo);
                            showNotification(
                              'পিডিএফ প্রস্তুত',
                              'হোয়াটসঅ্যাপ চ্যাট উইন্ডোতে মেমোটি পাঠাতে নিচের সবুজ বাটনে ক্লিক করুন।',
                              'info'
                            );
                          }}
                          title="হোয়াটসঅ্যাপে পিডিএফ পাঠান (Send PDF to WhatsApp)"
                          className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg cursor-pointer transition-colors flex items-center gap-1"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span className="text-[10px] font-bold">হোয়াটসঅ্যাপ</span>
                        </button>

                        {/* Edit and Delete based on role (Admin Only) */}
                        {isAdmin && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(memo)}
                              title="সম্পাদনা করুন"
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg cursor-pointer transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(memo.id)}
                              title="মুছে ফেলুন"
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg cursor-pointer transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: ADD / EDIT MEMO FORM */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in no-print">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-150 max-w-2xl w-full overflow-hidden flex flex-col relative animate-fade-in-down">
            {/* Header */}
            <div className="bg-indigo-600 text-white p-4.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-indigo-200" />
                <div>
                  <h3 className="font-extrabold text-sm">{isEditing ? 'মেমো সংশোধন করুন (Update Memo)' : 'নতুন মেমো রশিদ তৈরি (New Memo Receipt)'}</h3>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] text-indigo-100 font-bold uppercase tracking-wider mt-0.5">
                    <span>RSGS Global Solution Group</span>
                    <span className="text-indigo-300">•</span>
                    <span>সৈয়দ প্লাজা (২য় তলা)</span>
                    <span className="text-indigo-300">•</span>
                    <span>WhatsApp: ০১৭৪৮৫২৪৩৮১</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 hover:bg-indigo-700 rounded-lg text-indigo-100/85 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Type Switcher */}
              <div>
                <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-wider mb-2">মেমোর ধরণ (Memo Type) *</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-xl">
                  <button
                    type="button"
                    onClick={() => !isEditing && setFormMemoType('customer')}
                    disabled={isEditing}
                    className={`py-2.5 rounded-lg text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
                      isEditing ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                    } ${
                      formMemoType === 'customer' ? 'bg-white text-indigo-600 shadow-3xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Briefcase className="w-4 h-4" />
                    গ্রাহক মেমো (Customer Memo)
                  </button>
                  <button
                    type="button"
                    onClick={() => !isEditing && setFormMemoType('student')}
                    disabled={isEditing}
                    className={`py-2.5 rounded-lg text-xs font-extrabold flex items-center justify-center gap-2 transition-all ${
                      isEditing ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                    } ${
                      formMemoType === 'student' ? 'bg-white text-indigo-600 shadow-3xs' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <BookOpen className="w-4 h-4" />
                    ছাত্র মেমো (Student Memo)
                  </button>
                </div>
              </div>

              {/* Identity fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-wider">
                    {formMemoType === 'customer' ? 'গ্রাহকের নাম (Customer Name) *' : 'ছাত্র/ছাত্রীর নাম (Student Name) *'}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <User className="w-4 h-4" />
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="যেমন: মোঃ সাকিব হোসেন"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-wider">মোবাইল নম্বর (Contact Phone) *</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 font-mono font-bold">BD</span>
                    <input
                      type="tel"
                      required
                      placeholder="যেমন: 01712345678"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 font-mono focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                {formMemoType === 'student' && (
                  <div className="space-y-1 md:col-span-2 animate-fade-in">
                    <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-wider">ছাত্র/ছাত্রী আইডি বা রোল নম্বর (Student ID / Roll No.) *</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                        <BookOpen className="w-4 h-4" />
                      </span>
                      <input
                        type="text"
                        required
                        placeholder="যেমন: RSGS-2026-042"
                        value={studentId}
                        onChange={(e) => setStudentId(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Address / Location */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-wider">ঠিকানা (Physical/Email Address)</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <MapPin className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    placeholder="যেমন: মিরপুর ১০, ঢাকা অথবা ইমেইল এড্রেস"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

              {/* Service Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-wider">
                    সার্ভিস বা কোর্সের নাম (Service or Course Name) *
                  </label>
                  <select
                    value={serviceType}
                    onChange={(e) => handleServiceTypeChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                  >
                    <optgroup label="গ্রাহক সেবা (Client Services)">
                      {customerServices.map(s => <option key={s} value={s}>{s}</option>)}
                    </optgroup>
                    <optgroup label="ছাত্র কোর্স (Student Courses)">
                      {studentCourses.map(c => <option key={c} value={c}>{c}</option>)}
                    </optgroup>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-wider">স্থায়িত্ব/মেয়াদ (Duration Period) *</label>
                  <select
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                  >
                    {formMemoType === 'customer' ? (
                      <>
                        {customerDurations.map(d => <option key={d} value={d}>{d}</option>)}
                      </>
                    ) : (
                      <>
                        {studentDurations.map(d => <option key={d} value={d}>{d}</option>)}
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Custom Input if other is selected */}
              {(serviceType === 'Other Service' || serviceType === 'Other Course') && (
                <div className="space-y-1 animate-fade-in">
                  <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-wider">সার্ভিস/কোর্সের নাম লিখুন (Custom Name)</label>
                  <input
                    type="text"
                    required
                    placeholder="যেমন: UI/UX Masterclass Course অথবা iOS Core Development"
                    value={customService}
                    onChange={(e) => setCustomService(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                  />
                </div>
              )}

              {/* Money Ledger Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4.5 rounded-xl border border-slate-150">
                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-wider">মোট মূল্য (Total Amount) *</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 font-bold">৳</span>
                    <input
                      type="number"
                      required
                      min="0"
                      placeholder="যেমন: 15000"
                      value={totalAmount || ''}
                      onChange={(e) => setTotalAmount(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-wider">আদায়কৃত/অগ্রিম (Paid/Advance) *</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 font-bold">৳</span>
                    <input
                      type="number"
                      required
                      min="0"
                      placeholder="যেমন: 5000"
                      value={advancedAmount || ''}
                      onChange={(e) => setAdvancedAmount(Math.max(0, parseInt(e.target.value) || 0))}
                      className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-wider">বকেয়া পরিমাণ (Remaining Due)</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 font-bold">৳</span>
                    <input
                      type="text"
                      disabled
                      value={(totalAmount - advancedAmount).toLocaleString('bn-BD')}
                      className="w-full pl-8 pr-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono font-black text-rose-600 cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              {/* Extra notes */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-wider">মেমো নোট বা বিস্তারিত (Memo Notes / Specs)</label>
                <textarea
                  rows={3}
                  placeholder="সার্ভিসের শর্তাবলী, অ্যাপের নাম, স্পেসিফিকেশন অথবা ছাত্র-ছাত্রীর রোল/আইডি লিখুন..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-450 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                />
              </div>

              {/* Digital Signature */}
              <div className="bg-white p-4.5 rounded-xl border border-slate-150">
                <SignaturePad
                  value={signatureData}
                  onChange={setSignatureData}
                  label={formMemoType === 'student' ? 'ছাত্র/ছাত্রী বা অভিভাবকের স্বাক্ষর (Digital Signature)' : 'গ্রাহকের স্বাক্ষর (Customer Digital Signature)'}
                />
              </div>

              {/* Recurring / Repeat Memo Option */}
              <div className="bg-slate-50/60 p-4.5 rounded-xl border border-slate-150 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="block text-xs font-black text-slate-800">
                      পুনরাবৃত্তি মেমো (Repeat/Recurring Memo)
                    </label>
                    <p className="text-[10px] text-slate-500 font-semibold">
                      সাবস্ক্রিপশন সেবার জন্য নির্দিষ্ট সময়ে স্বয়ংক্রিয়ভাবে নতুন মেমো তৈরি করতে এটি চালু করুন।
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-250 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {isRecurring && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-200/60 animate-fade-in">
                    <div className="space-y-1">
                      <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-wider">
                        পুনরাবৃত্তির ফ্রিকোয়েন্সি (Recurrence Interval) *
                      </label>
                      <select
                        value={recurringInterval}
                        onChange={(e) => {
                          const val = e.target.value as 'weekly' | 'monthly';
                          setRecurringInterval(val);
                          setRecurringDay(val === 'weekly' ? 1 : 1);
                        }}
                        className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                      >
                        <option value="weekly">সাপ্তাহিক (Weekly)</option>
                        <option value="monthly">মাসিক (Monthly)</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[10px] font-extrabold text-slate-450 uppercase tracking-wider">
                        {recurringInterval === 'weekly' ? 'সপ্তাহের দিন (Day of Week) *' : 'মাসের তারিখ (Date of Month) *'}
                      </label>
                      {recurringInterval === 'weekly' ? (
                        <select
                          value={recurringDay}
                          onChange={(e) => setRecurringDay(parseInt(e.target.value))}
                          className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                        >
                          <option value={0}>রবিবার (Sunday)</option>
                          <option value={1}>সোমবার (Monday)</option>
                          <option value={2}>মঙ্গলবার (Tuesday)</option>
                          <option value={3}>বুধবার (Wednesday)</option>
                          <option value={4}>বৃহস্পতিবার (Thursday)</option>
                          <option value={5}>শুক্রবার (Friday)</option>
                          <option value={6}>শনিবার (Saturday)</option>
                        </select>
                      ) : (
                        <select
                          value={recurringDay}
                          onChange={(e) => setRecurringDay(parseInt(e.target.value))}
                          className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all"
                        >
                          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                            <option key={d} value={d}>
                              {d} তারিখ
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Auto-send to WhatsApp on save Option */}
              <div className="bg-emerald-50/40 p-4.5 rounded-xl border border-emerald-100/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label className="block text-xs font-black text-slate-800">
                      সংরক্ষণের পর হোয়াটসঅ্যাপে পাঠান (Auto-send to WhatsApp on save)
                    </label>
                    <p className="text-[10px] text-slate-500 font-semibold">
                      মেমোটি সফলভাবে তৈরি বা আপডেট হওয়ার পর স্বয়ংক্রিয়ভাবে পিডিএফ রশিদ ডাউনলোড করে গ্রাহকের হোয়াটসঅ্যাপে রিডাইরেক্ট করতে এটি চালু করুন।
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={autoSendOnSave}
                      onChange={(e) => setAutoSendOnSave(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-250 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                  </label>
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="bg-slate-50 -mx-6 -mb-6 px-6 py-4.5 border-t border-slate-100 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 text-slate-600 hover:text-slate-800 hover:bg-slate-100 border border-slate-200 bg-white font-extrabold rounded-lg text-xs transition-all cursor-pointer text-center active:scale-95"
                >
                  বাতিল করুন (Cancel)
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 text-white bg-indigo-600 hover:bg-indigo-700 font-extrabold rounded-lg text-xs transition-all shadow-md shadow-indigo-900/10 cursor-pointer text-center active:scale-95"
                >
                  {isEditing ? 'পরিবর্তন সংরক্ষণ করুন' : 'মেমো সংরক্ষণ করুন (Save)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EXTREMELY HIGH CLASS INTERNATIONAL PDF-LOOK PRINT PREVIEW */}
      {showPrintModal && selectedMemo && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in no-print">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col relative animate-fade-in-down">
            {/* Header / Actions */}
            <div className="bg-slate-800 text-white p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 no-print">
              <span className="text-xs font-bold tracking-wider uppercase flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-450 animate-pulse" />
                <span>RSGS Professional Print Preview</span>
                {isGeneratingPDF && (
                  <span className="inline-flex items-center gap-1 bg-indigo-500/30 text-indigo-300 text-[10px] px-2 py-0.5 rounded-full animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin" /> পিডিএফ তৈরি হচ্ছে...
                  </span>
                )}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={executePrint}
                  disabled={isGeneratingPDF}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-[10px] font-bold cursor-pointer transition-all active:scale-95"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>মুদ্রণ (Print)</span>
                </button>
                <button
                  onClick={() => handleDownloadPDF(selectedMemo)}
                  disabled={isGeneratingPDF}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-[10px] font-bold cursor-pointer transition-all active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>পিডিএফ ডাউনলোড</span>
                </button>
                <button
                  onClick={() => handleNativeShare(selectedMemo)}
                  disabled={isGeneratingPDF}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-[10px] font-bold cursor-pointer transition-all active:scale-95"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>সরাসরি শেয়ার (WhatsApp/Imo)</span>
                </button>
                <button
                  onClick={() => {
                    setShowPrintModal(false);
                    setSelectedMemo(null);
                  }}
                  className="p-1.5 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Frame Area */}
            <div className="p-8 md:p-12 overflow-y-auto max-h-[80vh] bg-slate-50">
              <div 
                id="print-invoice-area" 
                className="bg-white mx-auto shadow-sm p-6 sm:p-10 border border-slate-200 rounded-lg max-w-2xl font-sans text-slate-800 relative overflow-hidden"
              >
                {/* Subtle company-branded semi-transparent watermark */}
                <div className="print-watermark absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden opacity-[0.035] sm:opacity-[0.045]">
                  <div className="transform -rotate-[35deg] text-center space-y-1 sm:space-y-2">
                    <p className="text-4xl sm:text-6xl font-black tracking-widest uppercase text-slate-900 font-sans">
                      RSGS GLOBAL
                    </p>
                    <p className="text-lg sm:text-xl font-extrabold tracking-wider uppercase text-indigo-900 font-sans">
                      OFFICIAL INVOICE
                    </p>
                    <p className="text-[9px] sm:text-[10px] font-mono font-black tracking-widest text-slate-700">
                      SECURE SYSTEM VERIFIED • NON-TAMPERABLE
                    </p>
                  </div>
                </div>

                {/* Invoice Stamp Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b-2 border-slate-200 pb-6">
                  {/* Company Left Panel */}
                  <div className="space-y-1.5">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-1">
                      <Building2 className="w-6 h-6 text-indigo-600 no-print" />
                      <span>RSGS Global Solution Group</span>
                    </h2>
                    <p className="text-[10px] text-slate-500 font-extrabold tracking-widest uppercase">Digital Agency & Tech Training Institute</p>
                    <div className="text-[10px] text-slate-450 leading-relaxed font-semibold">
                      <p>সৈয়দ প্লাজা (২য় তলা), রাজ্জাক প্লাজা সংলগ্ন, ঢাকা (Syed Plaza 2nd Floor, Adjacent to Razzak Plaza, Dhaka)</p>
                      <p>হোয়াটসঅ্যাপ / মোবাইল: ০১৭৪৮৫২৪৩৮১ (WhatsApp / Cell: +8801748524381)</p>
                      <p>ইমেইল: support@rsgs.global | ওয়েব: www.rsgs.global</p>
                    </div>
                  </div>

                  {/* Title Right Panel */}
                  <div className="text-left sm:text-right space-y-1">
                    <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-extrabold rounded-md uppercase tracking-wider">
                      {selectedMemo.memo_type === 'customer' ? 'Customer Memo' : 'Student Memo'}
                    </span>
                    <h1 className="text-xl font-black text-slate-900 tracking-tight mt-1.5">মানি রিসিট / মেমো</h1>
                    <p className="text-xs font-bold text-indigo-600 font-mono">Invoice NO: {selectedMemo.id}</p>
                    <p className="text-[10px] text-slate-450 font-bold">
                      Date: {new Date(selectedMemo.created_at).toLocaleDateString('bn-BD')} ({new Date(selectedMemo.created_at).toLocaleDateString('en-US')})
                    </p>
                  </div>
                </div>

                {/* Client Metadata details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6 text-xs bg-slate-50 p-4.5 rounded-xl border border-slate-100">
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">বিল প্রাপক (Invoiced To)</p>
                    <p className="text-sm font-black text-slate-900">{selectedMemo.client_name}</p>
                    {selectedMemo.memo_type === 'student' && selectedMemo.student_id && (
                      <div className="mt-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-100">
                          ID / Roll: {selectedMemo.student_id}
                        </span>
                      </div>
                    )}
                    {selectedMemo.phone && <p className="font-mono text-slate-600 font-semibold">Phone: {selectedMemo.phone}</p>}
                    {selectedMemo.address && <p className="text-slate-500 font-semibold">Address: {selectedMemo.address}</p>}
                  </div>
                  
                  <div className="space-y-1.5 text-left md:text-right">
                    <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">প্রস্তুতকারক (Issued By)</p>
                    <p className="text-sm font-black text-slate-900">RSGS Billing Portal</p>
                    <p className="text-slate-600 font-semibold">Operator: {selectedMemo.created_by_name}</p>
                    <p className="text-slate-500 text-[10px] font-bold">সিস্টেম দ্বারা অনুমোদিত এবং সিঙ্কড।</p>
                  </div>
                </div>

                {/* Services/Courses Table breakdown */}
                <div className="my-6">
                  <p className="text-[10px] text-slate-450 font-extrabold uppercase tracking-widest mb-2.5">অর্ডার বিবরণ (Service / Course Specifications)</p>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                        <th className="py-2.5 px-3">ক্রমিক (Item)</th>
                        <th className="py-2.5 px-3">সার্ভিস / কোর্সের বিবরণ</th>
                        <th className="py-2.5 px-3 text-center">স্থায়িত্ব (Duration)</th>
                        <th className="py-2.5 px-3 text-right">মূল্য (Price)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="py-3 px-3 font-mono font-bold">01</td>
                        <td className="py-3 px-3">
                          <p className="font-bold text-slate-900">{selectedMemo.service_type}</p>
                          {selectedMemo.notes && <p className="text-[10px] text-slate-450 mt-1 leading-relaxed max-w-md italic">{selectedMemo.notes}</p>}
                        </td>
                        <td className="py-3 px-3 text-center font-bold text-slate-700">{selectedMemo.duration}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">৳{selectedMemo.total_amount.toLocaleString('bn-BD')}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Invoice Summary calculation block */}
                <div className="border-t border-slate-200 pt-5 flex justify-end">
                  <div className="w-full sm:w-64 space-y-2.5 text-xs">
                    <div className="flex justify-between font-semibold text-slate-600">
                      <span>মোট ফি (Total Amount):</span>
                      <span className="font-mono">৳{selectedMemo.total_amount.toLocaleString('bn-BD')}</span>
                    </div>
                    
                    <div className="flex justify-between font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                      <span>অগ্রিম প্রদান (Advanced Paid):</span>
                      <span className="font-mono">৳{selectedMemo.advanced_amount.toLocaleString('bn-BD')}</span>
                    </div>

                    <div className={`flex justify-between font-extrabold px-2 py-1 rounded ${
                      selectedMemo.due_amount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      <span>বকেয়া পরিমাণ (Remaining Due):</span>
                      <span className="font-mono">৳{selectedMemo.due_amount.toLocaleString('bn-BD')}</span>
                    </div>
                  </div>
                </div>

                {/* Declaration terms / Signatures */}
                <div className="mt-12 pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-6 text-[9px] text-slate-450 leading-relaxed">
                  <div>
                    <p className="font-extrabold uppercase tracking-wider text-slate-500 mb-1">শর্তাবলী / Terms & Conditions</p>
                    <p>১. অগ্রিম প্রদানকৃত ফি কোনো অবস্থাতেই অফেরতযোগ্য।</p>
                    <p>২. বকেয়া পরিশোধ সাপেক্ষে পূর্ণ সেবা চালু থাকবে।</p>
                    <p>৩. এই রসিদটি ডিজিটাল সার্ভার দ্বারা তৈরি এবং সার্ভার থেকে সত্যতা যাচাইযোগ্য।</p>
                  </div>

                  {/* Verification QR Code Column */}
                  <div className="flex flex-col items-center text-center justify-center border-y sm:border-y-0 sm:border-x border-slate-100 py-3 sm:py-0 px-2 bg-slate-50/50 rounded-lg">
                    <div className="bg-white p-1 border border-slate-200 rounded-md shadow-3xs">
                    <LocalQRCode 
                      text={`${window.location.origin}?verify=${selectedMemo.id}`}
                      className="w-16 h-16 object-contain"
                    />
                    </div>
                    <p className="mt-1.5 text-[8px] font-black text-indigo-700 tracking-tight flex items-center gap-0.5">
                      <ShieldCheck className="w-3 h-3 text-emerald-500 shrink-0" />
                      <span>রসিদ ভেরিফিকেশন কিউআর</span>
                    </p>
                    <p className="text-[7px] text-slate-400 font-mono mt-0.5 font-bold uppercase">Scan to Verify Invoice</p>

                    {/* Copy Verification Link Button (Hidden in Print/PDF generation) */}
                    <button
                      onClick={() => handleCopyVerificationLink(selectedMemo.id)}
                      data-html2canvas-ignore="true"
                      className="print:hidden mt-2 px-2.5 py-1 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 font-bold rounded-md text-[8.5px] cursor-pointer flex items-center gap-1 transition-all border border-slate-200 shadow-3xs hover:shadow-2xs select-none hover:text-indigo-600"
                      title="ভেরিফিকেশন লিঙ্ক কপি করুন (Copy Verification Link)"
                    >
                      {copiedLinkId === selectedMemo.id ? (
                        <>
                          <CheckCircle className="w-3 h-3 text-emerald-500 shrink-0" />
                          <span className="text-emerald-600 font-black">লিঙ্ক কপি হয়েছে!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-slate-400 shrink-0 animate-pulse" />
                          <span>লিঙ্ক কপি করুন</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="flex flex-col items-center justify-end space-y-1">
                      {selectedMemo.signature_data ? (
                        <img 
                          src={selectedMemo.signature_data} 
                          alt="Customer Signature" 
                          className="max-h-12 max-w-[120px] object-contain border border-slate-100 rounded p-0.5 bg-white mb-1"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="h-12 w-28 border-b border-slate-200 border-dashed" />
                      )}
                      <p className="text-[10px] font-bold text-slate-600">গ্রাহক / ছাত্রের স্বাক্ষর</p>
                    </div>

                    <div className="flex flex-col items-center justify-end space-y-1">
                      <div className="h-12 w-28 border-b border-slate-200 border-dashed flex items-end justify-center pb-1">
                        <span className="text-[8px] font-mono text-slate-300 font-bold">Authorized</span>
                      </div>
                      <p className="text-[10px] font-bold text-slate-600">কর্তৃপক্ষের স্বাক্ষর</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dedicated WhatsApp & File Share Actions Panel (Visible in preview, excluded from prints) */}
              <div className="max-w-2xl mx-auto mt-6 bg-white border border-slate-150 rounded-xl p-5 shadow-xs no-print space-y-4 animate-fade-in">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                    <MessageCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-800">হোয়াটসঅ্যাপ ও মেসেঞ্জারে মেমো প্রেরণ</h4>
                    <p className="text-[10px] text-slate-450 font-semibold mt-0.5 font-sans">গ্রাহকের হোয়াটসঅ্যাপ নম্বরে পিডিএফ ফাইল ও রসিদ বিবরণ সরাসরি পাঠান।</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Phone verification input */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">গ্রাহকের হোয়াটসঅ্যাপ নম্বর (WhatsApp Number)</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 font-bold text-xs font-mono">BD</span>
                      <input
                        type="tel"
                        placeholder="যেমন: 01712345678"
                        value={shareWhatsAppNumber}
                        onChange={(e) => setShareWhatsAppNumber(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold font-mono text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all"
                      />
                    </div>
                  </div>

                  {/* Quick Trigger Buttons */}
                  <div className="flex flex-col justify-end">
                    <button
                      onClick={() => handleSendToWhatsApp(selectedMemo)}
                      disabled={isGeneratingPDF}
                      className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold rounded-lg text-xs transition-all shadow-md shadow-emerald-950/20 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <Send className="w-4 h-4" />
                      <span>মেমো পিডিএফ ও বার্তা পাঠান (WhatsApp)</span>
                    </button>
                  </div>
                </div>

                {/* Informational helpful tip card */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                    <p className="font-bold text-slate-700">ডিজিটাল রসিদ টিপস:</p>
                    <ul className="list-disc list-inside space-y-0.5 mt-1">
                      <li>গ্রাহকের নম্বরে সরাসরি পিডিএফ ফাইল শেয়ার করতে উপরের <b className="text-sky-600">"সরাসরি শেয়ার (WhatsApp/Imo)"</b> বাটন ব্যবহার করুন। এটি মোবাইল ফোনে সবচেয়ে দারুণ কাজ করে!</li>
                      <li>হোয়াটসঅ্যাপ বাটনে ক্লিক করলে পিডিএফ মেমোটি ডাউনলোড হবে এবং স্বয়ংক্রিয়ভাবে হোয়াটসঅ্যাপ চ্যাট উইন্ডো ওপেন হবে। আপনি শুধু ডাউনলোড করা ফাইলটি সংযুক্ত (Attach) করে দিবেন।</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
