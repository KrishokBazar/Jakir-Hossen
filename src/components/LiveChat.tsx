import { useState, useEffect, useRef, FormEvent, ChangeEvent, useMemo } from 'react';
import { dbService } from '../db';
import { ChatMessage, Profile, ChatGroup } from '../types';
import { useNotification } from './NotificationContext';
import { 
  Send, 
  User, 
  MessageSquare, 
  Shield, 
  Users, 
  Radio, 
  Camera, 
  Paperclip, 
  X, 
  CheckCheck, 
  Check,
  FileText,
  Maximize2,
  Bell,
  BellRing,
  BellOff,
  Plus,
  Users2
} from 'lucide-react';

// Pre-set agrarian stickers/mock photos for quick click-and-send demo
const QUICK_PHOTOS = [
  { name: 'সবজি চালান (Produce)', url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&q=80' },
  { name: 'রশিদ ভাউচার (Invoice)', url: 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=500&q=80' },
  { name: 'যানবাহন বিল (Transport)', url: 'https://images.unsplash.com/photo-1516574187841-cb9cc2ca948b?w=500&q=80' },
  { name: 'মিটিং গ্রুপ (Meeting)', url: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=500&q=80' }
];

// Real-time link and phone number detector with safe accessible contrasts
const formatMessageText = (text: string, isMyMessage: boolean) => {
  if (!text) return '';
  
  // Regex for URL matching
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
  
  // Regex for general phone numbers (digits of length 11, starting with 01, or +8801)
  const phoneRegex = /(\+?8801[3-9]\d{8}|01[3-9]\d{8})/g;

  // Split text into lines to preserve white space structure
  const lines = text.split('\n');
  
  return lines.map((line, lineIdx) => {
    const parts = line.split(/(\s+)/);
    const content = parts.map((part, index) => {
      if (urlRegex.test(part)) {
        const href = part.startsWith('http') ? part : `https://${part}`;
        return (
          <a 
            key={`${lineIdx}-${index}`} 
            href={href} 
            target="_blank" 
            rel="noopener noreferrer" 
            className={`underline font-bold break-all transition-colors ${
              isMyMessage ? 'text-yellow-200 hover:text-yellow-105' : 'text-emerald-700 hover:text-emerald-800'
            }`}
          >
            {part}
          </a>
        );
      } else if (phoneRegex.test(part)) {
        return (
          <a 
            key={`${lineIdx}-${index}`} 
            href={`tel:${part}`} 
            className={`underline font-mono font-bold transition-colors ${
              isMyMessage ? 'text-amber-150 hover:text-white' : 'text-teal-800 hover:text-teal-950'
            }`}
          >
            {part}
          </a>
        );
      }
      return part;
    });

    return (
      <span key={lineIdx} className="block">
        {content}
      </span>
    );
  });
};

export default function LiveChat() {
  const currentUser = dbService.getCurrentUser();
  const { showNotification } = useNotification();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [operators, setOperators] = useState<Profile[]>([]);
  const [chatGroups, setChatGroups] = useState<ChatGroup[]>([]);
  const [activeReceiverId, setActiveReceiverId] = useState<string>('all');
  const [activeReceiverName, setActiveReceiverName] = useState<string>('সমবায় চ্যাটরুম');
  const [inputText, setInputText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Image & document attachments states
  const [attachedBase64, setAttachedBase64] = useState<string | null>(null);
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState<boolean>(false);
  
  // Zoom mode for photos
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);

  // Group creation modal state
  const [showGroupModal, setShowGroupModal] = useState<boolean>(false);
  const [newGroupName, setNewGroupName] = useState<string>('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  // Push Permission states (Web standard for both mobile and desktop notifications)
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setPushPermission(Notification.permission);
    }
  }, []);

  const requestPushPermission = async () => {
    if (!('Notification' in window)) {
      showNotification(
        "পুশ এলার্ট সমর্থিত নয়", 
        "আপনার ব্রাউজার বা ডিভাইসে রিয়েল-টাইম মোবাইল পুশ নোটিফিকেশন সুবিধাটি সমর্থিত নয়।", 
        "warning"
      );
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      if (permission === 'granted') {
        showNotification(
          "সফলভাবে সক্রিয় হয়েছে!", 
          "মেসেজ পাঠালে সাথে সাথে আপনার ফোনে ইনস্ট্যান্ট পুশ অ্যালার্ট ভেসে উঠবে।", 
          "success"
        );
        new Notification("পুশ এলার্ট সফলভাবে সক্রিয়!", {
          body: "মোবাইল ও ডেক্সটপ পুশ নোটিফিকেশন এখন চমৎকারভাবে সচল রয়েছে।",
          icon: 'https://cdn-icons-png.flaticon.com/512/1041/1041916.png',
          badge: 'https://cdn-icons-png.flaticon.com/512/1041/1041916.png'
        });
      } else if (permission === 'denied') {
        showNotification(
          "অনুমতি নাকচ করা হয়েছে", 
          "পুশ নোটিফিকেশন অ্যাক্সেস ব্লক রয়েছে। দয়া করে ব্রাউজার অ্যাক্সেস সেটিংসে সচল করুন।", 
          "warning"
        );
      }
    } catch (err) {
      console.error("Error requesting browser Notification permission:", err);
    }
  };

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);

  // Load chat messages
  useEffect(() => {
    setLoading(true);
    const unsubscribe = dbService.subscribeChats((msgs) => {
      setMessages(msgs);
      setLoading(false);
    }, (error) => {
      console.error("LiveChat subscription error:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Monitor operators/profiles
  useEffect(() => {
    const unsubscribe = dbService.subscribeOperators((list) => {
      const filtered = list.filter(op => op.approved && op.id !== currentUser?.id);
      setOperators(filtered);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Monitor custom chat groups that current user belongs to
  useEffect(() => {
    const unsubscribe = dbService.subscribeChatGroups((liveGroups) => {
      const myId = currentUser?.id || currentUser?.phone || '';
      const filtered = liveGroups.filter(g => g.member_ids.includes(myId));
      setChatGroups(filtered);
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Handle sounds and notifications
  useEffect(() => {
    if (messages.length > 0) {
      const latest = messages[messages.length - 1];
      const myId = currentUser?.id || currentUser?.phone || '';
      
      if (latest && latest.sender_id !== myId && lastMessageIdRef.current && lastMessageIdRef.current !== latest.id) {
        // Only trigger push alert if message is for us (public channel 'all' or our user ID or our group membership)
        const isForMe = 
          latest.receiver_id === 'all' || 
          latest.receiver_id === myId || 
          chatGroups.some(g => g.id === latest.receiver_id);

        if (isForMe) {
          showNotification(
            `নতুন চ্যাট বার্তা: ${latest.sender_name}`,
            latest.message,
            "success"
          );
          try {
            const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2357/2357-84.wav");
            audio.volume = 0.55;
            audio.play().catch(() => {});
          } catch (audioErr) {}

          // Native push notification
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              const options: any = {
                body: latest.message,
                icon: 'https://cdn-icons-png.flaticon.com/512/1041/1041916.png',
                badge: 'https://cdn-icons-png.flaticon.com/512/1041/1041916.png',
                tag: `chat-msg-${latest.id}`,
                renotify: true,
                vibrate: [120, 80, 120]
              };
              const notif = new Notification(`নতুন চ্যাট বার্তা: ${latest.sender_name}`, options);
              notif.onclick = () => {
                window.focus();
                notif.close();
              };
            } catch (err) {
              console.warn("Push failed:", err);
            }
          }
        }
      }
      if (latest) {
        lastMessageIdRef.current = latest.id;
      }
    } else {
      lastMessageIdRef.current = null;
    }
  }, [messages, currentUser, showNotification, chatGroups]);

  // Auto scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeReceiverId]);

  // Read file as Base64 helper (works for images and documents)
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("ফাইল সাইজ খুব বড়! অনুগ্রহ করে ২MB এর চেয়ে ছোট ফাইল নির্বাচন করুন।");
        return;
      }
      setAttachedFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachedBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const clearAttachment = () => {
    setAttachedBase64(null);
    setAttachedFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const selectQuickPhoto = (url: string, name: string) => {
    setAttachedBase64(url);
    setAttachedFileName(name);
    setIsPhotoPickerOpen(false);
  };

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !attachedBase64) return;
    if (!currentUser) return;

    try {
      let isDoc = false;
      let finalMsg = inputText.trim();

      if (attachedBase64) {
        isDoc = !attachedBase64.startsWith('data:image/');
        if (!finalMsg) {
          finalMsg = isDoc ? `📎 ${attachedFileName || 'document.pdf'}` : '📷 ছবি সংযুক্ত করা হয়েছে';
        }
      }

      const payload: Omit<ChatMessage, 'id' | 'timestamp'> = {
        sender_id: currentUser.id || currentUser.phone || 'unknown-user',
        sender_name: currentUser.name || 'Anonymous User',
        sender_role: currentUser.role,
        receiver_id: activeReceiverId,
        receiver_name: activeReceiverName,
        message: finalMsg,
      };

      if (attachedBase64) {
        payload.image_url = attachedBase64; // serves as base64 URL for images/documents
      }

      await dbService.sendChatMessage(payload);
      setInputText('');
      clearAttachment();
    } catch (err) {
      console.error("Failed to post message:", err);
    }
  };

  const toggleMemberSelection = (id: string) => {
    if (selectedMemberIds.includes(id)) {
      setSelectedMemberIds(selectedMemberIds.filter(mId => mId !== id));
    } else {
      setSelectedMemberIds([...selectedMemberIds, id]);
    }
  };

  const handleCreateGroupSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || !currentUser) return;
    try {
      const myId = currentUser.id || currentUser.phone || '';
      const members = Array.from(new Set([...selectedMemberIds, myId]));
      
      await dbService.createChatGroup({
        name: newGroupName.trim(),
        member_ids: members,
        created_by: myId,
        created_by_name: currentUser.name
      });

      setNewGroupName('');
      setSelectedMemberIds([]);
      setShowGroupModal(false);
      showNotification("সফল", "নতুন চ্যাট গ্রুপ সফলভাবে তৈরি হয়েছে।", "success");
    } catch (err: any) {
      console.error(err);
      alert("গ্রুপ তৈরি করতে ব্যর্থ হয়েছে।");
    }
  };

  // Filter messages for current thread
  const activeMessages = useMemo(() => {
    return messages.filter(msg => {
      if (activeReceiverId === 'all') {
        return msg.receiver_id === 'all';
      } else if (activeReceiverId.startsWith('group_') || chatGroups.some(g => g.id === activeReceiverId)) {
        return msg.receiver_id === activeReceiverId;
      } else {
        const myId = currentUser?.id || currentUser?.phone || '';
        return (
          (msg.sender_id === myId && msg.receiver_id === activeReceiverId) ||
          (msg.sender_id === activeReceiverId && msg.receiver_id === myId)
        );
      }
    });
  }, [messages, activeReceiverId, chatGroups, currentUser]);

  // Automatically mark private messages received from the active receiver as seen
  useEffect(() => {
    if (!currentUser) return;
    const myId = currentUser.id || currentUser.phone || '';
    if (activeReceiverId !== 'all' && !activeReceiverId.startsWith('group_')) {
      const unseenMessages = activeMessages.filter(
        msg => msg.sender_id === activeReceiverId && !msg.seen
      );
      if (unseenMessages.length > 0) {
        unseenMessages.forEach((msg) => {
          dbService.markChatMessageAsSeen(msg.id);
        });
      }
    }
  }, [activeMessages, activeReceiverId, currentUser]);

  // Filter operators by search query
  const filteredOperators = operators.filter(op => 
    op.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    op.phone.includes(searchQuery)
  );

  const isSenderOrAdmin = currentUser?.role === 'admin' || currentUser?.role === 'cofounder';

  return (
    <div className="max-w-7xl mx-auto h-[calc(100vh-140px)] md:h-[680px] bg-white border border-slate-200 shadow-xl rounded-2xl overflow-hidden flex flex-col md:flex-row font-sans">
      
      {/* Sidebar - Threads Selection */}
      <div className="w-full md:w-80 bg-slate-50 border-r border-slate-200 flex flex-col shrink-0">
        
        {/* Header containing self details */}
        <div className="p-4 bg-white border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-extrabold text-white shadow-sm shrink-0 ${
                currentUser?.role === 'admin' ? 'bg-[#075E54]' : currentUser?.role === 'cofounder' ? 'bg-indigo-600' : 'bg-emerald-600'
              }`}>
                {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-slate-800 leading-none truncate">{currentUser?.name}</h3>
                <p className="text-[10px] text-slate-500 mt-1 capitalize flex items-center gap-1 font-semibold truncate">
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  {currentUser?.role === 'admin' ? 'মূল অ্যাডমিন' : currentUser?.role === 'cofounder' ? '🤝 সহ-প্রতিষ্ঠাতা' : '💻 অপারেটর (Operator)'}
                </p>
              </div>
            </div>

            {/* Notification & Group Controls */}
            <div className="flex items-center gap-1.5 shrink-0">
              {isSenderOrAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMemberIds([]);
                    setNewGroupName('');
                    setShowGroupModal(true);
                  }}
                  className="p-2 text-slate-500 hover:text-emerald-600 bg-slate-50 hover:bg-emerald-50 rounded-xl transition-all cursor-pointer flex items-center justify-center border border-slate-200"
                  title="WhatsApp গ্রুপ তৈরি করুন"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={requestPushPermission}
                className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-center shadow-xs ${
                  pushPermission === 'granted'
                    ? 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-600'
                    : pushPermission === 'denied'
                    ? 'border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-500'
                    : 'border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-600 animate-pulse'
                }`}
                title="পুশ নোটিফিকেশন সেটিংস"
              >
                {pushPermission === 'granted' ? (
                  <Bell className="w-4 h-4" />
                ) : pushPermission === 'denied' ? (
                  <BellOff className="w-4 h-4 text-rose-500" />
                ) : (
                  <BellRing className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Search member */}
        <div className="p-3">
          <input
            type="text"
            placeholder="ইউজার বা মোবাইল খুঁজুন..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 px-2 pb-4">
          <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center justify-between">
            <span>মেইন চ্যাটরুম (Channels)</span>
          </div>
          
          <button
            onClick={() => {
              setActiveReceiverId('all');
              setActiveReceiverName('সমবায় চ্যাটরুম');
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left cursor-pointer transition-all ${
              activeReceiverId === 'all'
                ? 'bg-emerald-50 text-[#075E54] font-bold border-l-4 border-[#075E54] pl-2 shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 font-medium'
            }`}
          >
            <div className={`p-1.5 rounded-lg ${activeReceiverId === 'all' ? 'bg-emerald-100 text-[#075E54]' : 'bg-slate-200'}`}>
              <Users className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate">সমবায় চ্যাটরুম (Public Group)</p>
              <p className="text-[9px] text-slate-500 font-medium whitespace-nowrap">সকল সদস্য ও অপারেটরের উন্মুক্ত চ্যাট</p>
            </div>
          </button>

          {/* Group Channels section */}
          {chatGroups.length > 0 && (
            <>
              <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-2 py-2 mt-2">
                গ্রুপ চ্যানেলসমূহ (WhatsApp Groups)
              </div>
              {chatGroups.map((group) => {
                const isSelected = activeReceiverId === group.id;
                return (
                  <button
                    key={group.id}
                    onClick={() => {
                      setActiveReceiverId(group.id);
                      setActiveReceiverName(group.id.startsWith('group_') ? group.name : `👥 ${group.name}`);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-emerald-50 text-[#075E54] font-bold border-l-4 border-[#075E54] pl-2 shadow-xs'
                        : 'text-slate-600 hover:bg-slate-100 font-medium'
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-emerald-100 text-[#075E54]' : 'bg-amber-100 text-amber-800'}`}>
                      <Users2 className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{group.name}</p>
                      <p className="text-[9px] text-slate-500 truncate mt-0.5 font-medium">
                        সদস্য সংখ্যা: {group.member_ids.length} জন
                      </p>
                    </div>
                  </button>
                );
              })}
            </>
          )}

          <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-2 py-2 mt-2">
            ১-টু-১ সরাসরি বার্তা (Direct Chats)
          </div>

          {/* Members Mapping */}
          {filteredOperators.length === 0 ? (
            <p className="text-[11px] text-slate-400 text-center py-4 font-semibold">কোনো ইউজার পাওয়া যায়নি</p>
          ) : (
            filteredOperators.map((op) => {
              const itemPhone = op.id || op.phone || '';
              const isSelected = activeReceiverId === itemPhone;
              return (
                <button
                  key={itemPhone}
                  onClick={() => {
                    setActiveReceiverId(itemPhone);
                    setActiveReceiverName(op.name);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-emerald-50 text-[#075E54] font-bold border-l-4 border-emerald-600 pl-2 shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 font-medium'
                  }`}
                >
                  <div className={`p-1.5 rounded-lg ${
                    op.role === 'admin' ? 'bg-indigo-150 text-indigo-700' : op.role === 'cofounder' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    <User className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{op.name}</p>
                    <p className="text-[9px] text-slate-550 leading-none truncate capitalize mt-0.5">
                      {op.role === 'admin' ? '🛡️ অ্যাডমিন' : op.role === 'cofounder' ? '🤝 সহ-প্রতিষ্ঠাতা' : '💻 অপারেটর (Operator)'}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main Messaging Canvas with WhatsApp Chat Wall bg */}
      <div className="flex-1 flex flex-col bg-[#efeae2] relative">
        
        {/* Active conversation details bar */}
        <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              {activeReceiverId === 'all' ? <Users className="w-5 h-5" /> : activeReceiverId.startsWith('group_') ? <Users2 className="w-5 h-5" /> : <User className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">{activeReceiverName}</h2>
              <p className="text-[10px] text-slate-400 flex items-center gap-1 font-semibold">
                <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
                রিয়েল-টাইম কনেকশন লাইভ
              </p>
            </div>
          </div>
        </div>

        {/* Real-time Notification activation prompt */}
        {pushPermission === 'default' && (
          <div className="bg-indigo-55 bg-opacity-95 backdrop-blur-xs border-b border-indigo-100 p-3 px-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-left shrink-0 z-10 font-sans shadow-md">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-xl bg-indigo-100 text-indigo-700 shrink-0 shadow-sm animate-bounce">
                <BellRing className="w-4.5 h-4.5 text-indigo-650" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-extrabold text-indigo-950 block">মোবাইলে সরাসরি পুশ নোটিফিকেশন সচল করুন!</span>
                <span className="text-[9.5px] text-indigo-700 font-bold block leading-normal mt-0.5">নতুন বার্তা ও জরুরি তথ্যের ইনস্ট্যান্ট পুশ অ্যালার্ট ফোনের নোটিফিকেশন ড্রয়ারে ভেসে উঠবে।</span>
              </div>
            </div>
            <button
              onClick={requestPushPermission}
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[10px] px-4 py-2 rounded-lg cursor-pointer shrink-0 shadow-sm"
            >
              আজই সচল করুন (Activate Alerts)
            </button>
          </div>
        )}

        {/* Converation Board scroll container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#efeae2]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <span className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></span>
              <p className="text-xs text-slate-400 font-semibold">মেসেজ লোড হচ্ছে...</p>
            </div>
          ) : activeMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-2">
              <div className="w-16 h-16 bg-white shadow-sm border border-slate-100 rounded-full flex items-center justify-center">
                <MessageSquare className="w-8 h-8 text-[#075E54]" />
              </div>
              <h4 className="text-xs font-semibold text-slate-600">এখনো কোনো চ্যাট বার্তা নেই</h4>
              <p className="text-[10px] text-slate-400 max-w-xs leading-normal font-semibold">
                নতুন চ্যাট শুরু করতে নিচে মেসেজ টাইপ করুন। আপনি হোয়াটসঅ্যাপের মত নম্বর, লিংক ও ফাইল পাঠাতে পারবেন।
              </p>
            </div>
          ) : (
            activeMessages.map((msg) => {
              const myId = currentUser?.id || currentUser?.phone || '';
              const isMyMessage = msg.sender_id === myId;
              
              // Detect if attachment is a document
              const isAttachmentDocument = msg.image_url && !msg.image_url.startsWith('data:image/');

              return (
                <div
                  key={msg.id}
                  className={`flex ${isMyMessage ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[70%] rounded-2xl px-3.5 py-2 min-w-[120px] shadow-sm transition-all duration-200 ${
                    isMyMessage 
                      ? 'bg-[#d9fdd3] text-slate-900 rounded-tr-none border border-[#e1fbc4]' 
                      : msg.sender_role === 'admin'
                      ? 'bg-white border border-slate-200 text-slate-900 rounded-tl-none'
                      : 'bg-white border border-slate-200 text-slate-900 rounded-tl-none'
                  }`}>
                    {/* Header meta - sender details */}
                    {!isMyMessage && (
                      <div className="flex items-center gap-1.5 mb-1 text-slate-755">
                        <span className="text-[10px] font-extrabold text-teal-800 leading-none">{msg.sender_name}</span>
                        <span className={`text-[8px] font-extrabold px-1 py-0.5 rounded uppercase font-mono ${
                          msg.sender_role === 'admin' ? 'bg-indigo-100 text-indigo-750' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {msg.sender_role === 'admin' ? 'অ্যাডমিন' : msg.sender_role === 'cofounder' ? 'সহ-প্রতিষ্ঠাতা' : 'অপারেটর'}
                        </span>
                      </div>
                    )}
                    
                    {/* Attachment rendering */}
                    {msg.image_url && (
                      isAttachmentDocument ? (
                        /* Document attachment view with instant download */
                        <div className="mb-2 p-3 bg-slate-50 text-slate-800 rounded-xl border border-slate-200 flex items-center justify-between gap-3 max-w-sm shrink-0">
                          <div className="flex items-center gap-2">
                            <div className="p-2 bg-emerald-100 text-emerald-800 rounded-lg">
                              <FileText className="w-5 h-5 text-[#075E54]" />
                            </div>
                            <div className="text-[11px] min-w-0">
                              <p className="font-extrabold text-slate-900 truncate max-w-[140px]">ডকুমেন্ট ফাইল (File)</p>
                              <p className="text-[9px] text-slate-500 font-mono truncate max-w-[120px]">
                                {msg.message && msg.message.includes('📎') ? msg.message.replace('📎 ', '') : 'document_file.pdf'}
                              </p>
                            </div>
                          </div>
                          <a 
                            href={msg.image_url} 
                            download={msg.message && msg.message.includes('📎') ? msg.message.replace('📎 ', '') : 'document_file.pdf'}
                            className="px-3 py-1.5 text-[9px] font-extrabold bg-[#075E54] hover:bg-teal-700 text-white rounded-lg cursor-pointer shadow-sm shrink-0"
                          >
                            ডাউনলোড
                          </a>
                        </div>
                      ) : (
                        /* Image attachment view */
                        <div className="mb-1.5 relative rounded-xl overflow-hidden border border-slate-200 bg-black/5 group max-w-sm shrink-0">
                          <img 
                            src={msg.image_url} 
                            alt="Chat asset" 
                            referrerPolicy="no-referrer"
                            className="w-full max-h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setZoomedImageUrl(msg.image_url || null)}
                          />
                          <button 
                            onClick={() => setZoomedImageUrl(msg.image_url || null)}
                            className="absolute bottom-2 right-2 p-1.5 bg-black/60 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )
                    )}

                    {/* Content Text with clickable URL & Telephone formatters */}
                    {msg.message && (
                      <div className="text-[11.5px] leading-relaxed whitespace-pre-wrap font-medium">
                        {formatMessageText(msg.message, isMyMessage)}
                      </div>
                    )}
                    
                    {/* Timestamp & Seen blue ticks */}
                    <div className="flex items-center justify-end gap-1 mt-1 shrink-0">
                      <span className="text-[8px] font-mono font-medium text-slate-400">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {isMyMessage && (
                        msg.receiver_id === 'all' ? (
                          <Check className="w-3.5 h-3.5 text-slate-400 inline" />
                        ) : msg.seen ? (
                          <CheckCheck className="w-3.5 h-3.5 text-sky-500 inline" title="Seen (দেখা হয়েছে)" />
                        ) : (
                          <CheckCheck className="w-3.5 h-3.5 text-slate-400 inline opacity-60" title="Delivered (পেঁৗছেছে)" />
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Quick Presets Stickers drawer panel */}
        {isPhotoPickerOpen && (
          <div className="p-3 bg-white border-t border-slate-200 grid grid-cols-4 gap-2 shrink-0 animate-fadeIn z-10 shadow-lg">
            {QUICK_PHOTOS.map((qp, index) => (
              <button
                key={index}
                type="button"
                onClick={() => selectQuickPhoto(qp.url, qp.name)}
                className="flex flex-col items-center gap-1 p-1 bg-slate-50 border border-slate-200 rounded-xl hover:border-emerald-500 hover:bg-emerald-50/50 transition-all cursor-pointer"
              >
                <img src={qp.url} alt={qp.name} referrerPolicy="no-referrer" className="w-full h-11 object-cover rounded-lg" />
                <span className="text-[8.5px] font-bold text-slate-700 truncate max-w-full">{qp.name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Selected file attachment badge */}
        {attachedBase64 && (
          <div className="mx-4 my-2 p-2 bg-white rounded-xl border border-emerald-250 flex items-center justify-between shadow-md shrink-0 animate-fade-in">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg overflow-hidden border border-emerald-100 flex items-center justify-center bg-slate-50">
                {attachedBase64.startsWith('data:image/') ? (
                  <img src={attachedBase64} alt="Attached draft" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                ) : (
                  <FileText className="w-6 h-6 text-[#075E54]" />
                )}
              </div>
              <div className="text-[10px] min-w-0">
                <p className="font-extrabold text-slate-900">হোয়াটসঅ্যাপ অ্যাটাচমেন্ট (Ready)</p>
                <p className="text-slate-500 font-mono text-[9px] truncate max-w-[220px]">{attachedFileName || 'file.pdf'}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={clearAttachment}
              className="p-1.5 hover:bg-rose-50 text-rose-500 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Active sending panel */}
        <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0">
          
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="ছবি বা ফাইল সংযুক্ত করুন (হোয়াটসঅ্যাপ)"
            className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 cursor-pointer transition-all flex items-center justify-center shrink-0"
          >
            <Camera className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setIsPhotoPickerOpen(!isPhotoPickerOpen)}
            title="হোয়াটসঅ্যাপ দ্রুত স্টিকার"
            className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-center shrink-0 ${
              isPhotoPickerOpen 
                ? 'border-emerald-250 bg-emerald-50 text-emerald-700' 
                : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800'
            }`}
          >
            <Paperclip className="w-4 h-4" />
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={attachedBase64 ? "ক্যাপশন বা বার্তা লিখুন..." : "এখানে বার্তা, লিংক বা নম্বর টাইপ করুন..."}
            className="flex-1 bg-slate-100 border border-transparent rounded-xl px-4 py-2.5 text-xs focus:bg-white focus:border-slate-205 focus:outline-none focus:ring-2 focus:ring-[#075E54] transition-all text-slate-900 font-semibold"
          />
          
          <button
            type="submit"
            disabled={!inputText.trim() && !attachedBase64}
            className="bg-[#075E54] hover:bg-teal-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white p-2.5 rounded-xl cursor-pointer transition-colors flex items-center justify-center shadow-md shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

      </div>

      {/* Group creations Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleCreateGroupSubmit} className="bg-white w-full max-w-md rounded-2xl p-6 border border-slate-100 shadow-2xl flex flex-col gap-4 animate-scale-in">
            <div className="flex items-center justify-between border-b pb-3.5">
              <h3 className="font-bold text-slate-900 flex items-center gap-1.5">
                <Users2 className="w-5 h-5 text-[#075E54]" />
                নতুন চ্যাট গ্রুপ খুলুন
              </h3>
              <button 
                type="button" 
                onClick={() => setShowGroupModal(false)}
                className="p-1 rounded-md text-slate-400 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">গ্রুপের নাম (Group Name) *</label>
                <input
                  type="text"
                  required
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="যেমন: ৩ জন পার্টনার মিটিং বা সবজি টিম"
                  className="w-full px-3.5 py-2 border rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#075E54]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">সদস্য নির্বাচন করুন (Select Members) *</label>
                <div className="border border-slate-150 rounded-xl max-h-48 overflow-y-auto p-2.5 space-y-2">
                  {operators.length === 0 ? (
                    <p className="text-[11px] text-slate-450 italic">কোনো সদস্য পাওয়া যায়নি।</p>
                  ) : (
                    operators.map((op) => {
                      const isChecked = selectedMemberIds.includes(op.id);
                      return (
                        <label 
                          key={op.id} 
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleMemberSelection(op.id)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="text-[11px] font-semibold text-slate-700 flex-1">{op.name} ({op.role === 'cofounder' ? 'সহ-প্রতিষ্ঠাতা' : 'অপারেটর'})</span>
                        </label>
                      );
                    })
                  )}
                </div>
                <p className="text-[9.5px] text-slate-400 mt-1.5">আপনি নিজে (বানানো অ্যাডমিন) গ্রুপে অটো যুক্ত হয়ে যাবেন।</p>
              </div>
            </div>

            <div className="flex gap-2.5 border-t pt-3.5 mt-2 justify-end text-xs">
              <button
                type="button"
                onClick={() => setShowGroupModal(false)}
                className="px-4 py-2 hover:bg-slate-100 rounded-lg font-bold border"
              >
                বাতিল (Cancel)
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#075E54] hover:bg-teal-700 text-white font-extrabold rounded-lg shadow-sm"
              >
                তৈরি করুন (Create Group)
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Lightbox for zooming photos */}
      {zoomedImageUrl && (
        <div className="fixed inset-0 z-55 bg-black/90 flex flex-col items-center justify-center p-4">
          <button 
            type="button"
            onClick={() => setZoomedImageUrl(null)}
            className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
          <img 
            src={zoomedImageUrl} 
            alt="Zoomed attachment" 
            referrerPolicy="no-referrer"
            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl scale-100"
          />
        </div>
      )}

    </div>
  );
}
