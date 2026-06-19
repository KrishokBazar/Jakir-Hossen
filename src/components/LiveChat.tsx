import { useState, useEffect, useRef, FormEvent, ChangeEvent, useMemo } from 'react';
import { dbService } from '../db';
import { safeStorage } from '../utils/storage';
import { ChatMessage, Profile, ChatGroup } from '../types';
import { useNotification } from './NotificationContext';
import { playIncomingTone, playOutgoingTone } from '../utils/audio';
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
  Users2,
  Zap,
  Clock,
  Eye,
  Sliders,
  Reply,
  CornerUpLeft,
  Smile,
  Mic,
  Square,
  Volume2,
  Play,
  Pause,
  Trash2,
  Moon,
  Sun
} from 'lucide-react';

// Pre-set agrarian stickers/mock photos for quick click-and-send demo
const QUICK_PHOTOS = [
  { name: 'সবজি চালান (Produce)', url: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=500&q=80' },
  { name: 'রশিদ ভাউচার (Invoice)', url: 'https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=500&q=80' },
  { name: 'যানবাহন বিল (Transport)', url: 'https://images.unsplash.com/photo-1516574187841-cb9cc2ca948b?w=500&q=80' },
  { name: 'মিটিং গ্রুপ (Meeting)', url: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=500&q=80' }
];

// Predefined quick replies for common chat interactions
const QUICK_REPLIES = [
  { id: 'qr_welcome', label: 'স্বাগতম (Welcome)', text: 'স্বাগতম! আমরা কীভাবে আপনাকে সাহায্য করতে পারি?' },
  { id: 'qr_processing', label: 'প্রক্রিয়াধীন (Processing)', text: 'আপনার অর্ডারটি বা আবেদনটি বর্তমানে প্রক্রিয়াধীন রয়েছে।' },
  { id: 'qr_payment', label: 'পেমেন্ট সম্পন্ন (Paid)', text: 'আপনার পেমেন্ট সফলভাবে সম্পন্ন হয়েছে। ধন্যবাদ!' },
  { id: 'qr_wait', label: 'অপেক্ষা করুন (Wait)', text: 'দয়া করে কিছুক্ষণ অপেক্ষা করুন, আমরা আপনার তথ্য যাচাই করছি।' },
  { id: 'qr_received', label: 'বার্তা প্রাপ্তি (Received)', text: 'প্রিয় সুধী, আমরা আপনার বার্তাটি পেয়েছি। শীঘ্রই আপনার সাথে যোগাযোগ করা হবে।' },
  { id: 'qr_number', label: 'নম্বর চাওয়া (Phone)', text: 'অনুগ্রহ করে আপনার সচল মোবাইল নম্বরটি আমাদের এখানে প্রদান করুন।' },
  { id: 'qr_thanks', label: 'ধন্যবাদ (Thanks)', text: 'আমাদের সেবা গ্রহণ করার জন্য এবং মূল্যবান মতামত দেওয়ার জন্য আপনাকে অনেক ধন্যবাদ।' },
  { id: 'qr_docs', label: 'ডকুমেন্ট প্রয়োজন (Docs)', text: 'দয়া করে আপনার প্রয়োজনীয় জাতীয় পরিচয়পত্র বা সদস্য কার্ডের ছবি এখানে পাঠান।' }
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

const VoiceNotePlayer = ({ src, isNightMode }: { src: string; isNightMode?: boolean }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    
    const onLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, [src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.warn("Audio play failed:", err);
      });
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className={`flex items-center gap-3 rounded-2xl p-2.5 max-w-sm mt-1 mb-1 shadow-xs transition-colors ${
      isNightMode 
        ? 'bg-[#182229] border border-[#222e35]/65 hover:bg-[#202c33]/70' 
        : 'bg-slate-50 border border-slate-105/50 hover:bg-slate-100/30'
    }`}>
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      <button
        type="button"
        onClick={togglePlay}
        className={`w-8 h-8 flex items-center justify-center rounded-full text-white shadow-xs hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0 ${
          isNightMode 
            ? 'bg-[#00a884] hover:bg-[#008f72]' 
            : 'bg-[#075E54] hover:bg-teal-700'
        }`}
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-white text-white" /> : <Play className="w-4 h-4 fill-white text-white ml-0.5" />}
      </button>

      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-4 flex items-end gap-[1.5px] px-0.5 select-none font-mono">
            {[4, 10, 16, 8, 5, 12, 18, 14, 7, 10, 12, 5, 8, 14, 20, 10, 6, 12, 8, 4].map((h, i) => {
              const totalBars = 20;
              const activeBarCount = Math.floor((currentTime / (duration || 1)) * totalBars);
              const isActive = i <= activeBarCount;
              return (
                <div
                  key={i}
                  style={{ height: `${h}px` }}
                  className={`flex-1 rounded-sm transition-colors duration-100 ${
                    isActive 
                      ? (isNightMode ? 'bg-[#00a884]' : 'bg-[#075E54]') 
                      : (isNightMode ? 'bg-slate-700' : 'bg-slate-250')
                  }`}
                />
              );
            })}
          </div>
          <Volume2 className={`w-3.5 h-3.5 shrink-0 ${isNightMode ? 'text-slate-500' : 'text-slate-400'}`} />
        </div>
        <div className="flex items-center justify-between text-[8px] font-mono">
          <span className={isNightMode ? 'text-slate-400' : 'text-slate-550'}>{formatTime(currentTime)}</span>
          <span className={`flex items-center gap-1 font-bold ${isNightMode ? 'text-[#00a884]' : 'text-teal-800'}`}>
            🎙️ ভয়েস ড্রাফট ({formatTime(duration || 0)})
          </span>
        </div>
      </div>
    </div>
  );
};

export default function LiveChat() {
  const currentUserRaw = dbService.getCurrentUser();
  const currentUser = useMemo(() => currentUserRaw, [
    currentUserRaw?.id,
    currentUserRaw?.phone,
    currentUserRaw?.name,
    currentUserRaw?.role
  ]);
  const { showNotification } = useNotification();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]);
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
  const [isQuickRepliesOpen, setIsQuickRepliesOpen] = useState<boolean>(false);
  
  // Custom interactive client-side image preview and processing states
  const [attachedImageMeta, setAttachedImageMeta] = useState<{
    width: number;
    height: number;
    size: string;
    type: string;
  } | null>(null);
  const [draftFilter, setDraftFilter] = useState<string>('none');
  const [isDraftPreviewModalOpen, setIsDraftPreviewModalOpen] = useState<boolean>(false);
  
  // Zoom mode for photos
  const [zoomedImageUrl, setZoomedImageUrl] = useState<string | null>(null);

  // Night Mode state specifically for LiveChat to reduce eye strain
  const [isNightMode, setIsNightMode] = useState<boolean>(() => {
    return safeStorage.getItem('operator_chat_night_mode') === 'true';
  });

  const toggleNightMode = () => {
    setIsNightMode(prev => {
      const newVal = !prev;
      safeStorage.setItem('operator_chat_night_mode', String(newVal));
      return newVal;
    });
  };

  // Message reply/quoting states
  const [activeReplyTo, setActiveReplyTo] = useState<ChatMessage | null>(null);

  // Message reaction picker state
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState<string | null>(null);

  // Group creation modal state
  const [showGroupModal, setShowGroupModal] = useState<boolean>(false);
  const [newGroupName, setNewGroupName] = useState<string>('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  // Push Permission states (Web standard for both mobile and desktop notifications)
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');

  // Voice Note Recording states
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  useEffect(() => {
    if ('Notification' in window) {
      setPushPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  const formatRecordTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showNotification("অনুপস্থিত ফিচার", "আপনার ব্রাউজারটি অডিও রেকর্ডিং সাপোর্ট করে না।", "warning");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Convert to base64 so we can save it inside firestore doc
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          sendVoiceMessage(base64Audio);
        };

        // Stop all tracks to free up the microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Failed to start voice note recording:", err);
      showNotification(
        "মাইক্রোফোন ত্রুটি",
        "মাইক্রোফোন অ্যাক্সেস করতে ব্যর্থ হয়েছে। দয়া করে ব্রাউজারের পারমিশন চেক করুন।",
        "error"
      );
    }
  };

  const stopAndSendRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      cleanupRecording();
    }
  };

  const cancelAndDiscardRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      // Override onstop to throw away chunks and stop tracks
      mediaRecorderRef.current.onstop = () => {
        if (mediaRecorderRef.current) {
          const stream = mediaRecorderRef.current.stream;
          stream.getTracks().forEach(track => track.stop());
        }
      };
      mediaRecorderRef.current.stop();
      cleanupRecording();
      showNotification("ড্রাফট বাতিল", "ভয়েস রেকর্ডিংটি বাতিল ও মুছে ফেলা হয়েছে।", "success");
    }
  };

  const cleanupRecording = () => {
    setIsRecording(false);
    setRecordingDuration(0);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const sendVoiceMessage = (base64Audio: string) => {
    if (!currentUser) return;
    try {
      const msgId = "msg_audio_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
      const voiceMessage: ChatMessage = {
        id: msgId,
        sender_id: currentUser.id || currentUser.phone || 'unknown-user',
        sender_name: currentUser.name || 'Anonymous User',
        sender_role: currentUser.role,
        receiver_id: activeReceiverId,
        receiver_name: activeReceiverName,
        message: "🎙️ ভয়েস নোট (Voice Note)",
        audio_url: base64Audio,
        timestamp: new Date().toISOString(),
        seen: false,
        ...(activeReplyTo ? {
          reply_to: {
            message_id: activeReplyTo.id,
            sender_name: activeReplyTo.sender_name,
            message: activeReplyTo.message || 'সংযুক্তি (Attachment)',
          }
        } : {})
      };

      setActiveReplyTo(null);
      setOptimisticMessages(prev => [...prev, voiceMessage]);
      playOutgoingTone();

      dbService.sendChatMessage(voiceMessage).catch(err => {
        console.error("Failed to post message:", err);
      }).finally(() => {
        setOptimisticMessages(prev => prev.filter(m => m.id !== msgId));
      });
    } catch (err) {
      console.error("Failed to prepare voice message payload:", err);
    }
  };

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

  // Filter messages for current thread
  const allMessagesMerged = useMemo(() => {
    const syncedIds = new Set(messages.map(m => m.id));
    const pendingOptimistic = optimisticMessages.filter(om => !syncedIds.has(om.id));
    return [...messages, ...pendingOptimistic];
  }, [messages, optimisticMessages]);

  const activeMessages = useMemo(() => {
    return allMessagesMerged.filter(msg => {
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
  }, [allMessagesMerged, activeReceiverId, chatGroups, currentUser]);

  const syncedIds = useMemo(() => new Set(messages.map(m => m.id)), [messages]);

  // Dynamically compute thread statistics for receipts & unread counters
  const relationStats = useMemo(() => {
    const stats: Record<string, { lastMsg?: ChatMessage; unreadCount: number }> = {};
    const myId = currentUser?.id || currentUser?.phone || '';
    if (!myId) return stats;

    allMessagesMerged.forEach(m => {
      let key = '';
      let isUnread = false;

      if (m.receiver_id === 'all') {
        key = 'all';
        // Count as unread if someone else sent it and it hasn't been read or viewed
        isUnread = m.sender_id !== myId;
      } else if (m.receiver_id.startsWith('group_')) {
        key = m.receiver_id;
        isUnread = m.sender_id !== myId;
      } else {
        const otherId = m.sender_id === myId ? m.receiver_id : m.sender_id;
        key = otherId;
        isUnread = m.sender_id === otherId && m.receiver_id === myId && !m.seen;
      }

      if (!stats[key]) {
        stats[key] = { unreadCount: 0 };
      }

      const currentLast = stats[key].lastMsg;
      if (!currentLast || new Date(m.timestamp) > new Date(currentLast.timestamp)) {
        stats[key].lastMsg = m;
      }

      if (isUnread) {
        stats[key].unreadCount += 1;
      }
    });

    if (activeReceiverId && stats[activeReceiverId]) {
      stats[activeReceiverId].unreadCount = 0;
    }

    return stats;
  }, [allMessagesMerged, currentUser, activeReceiverId]);

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
          
          // Trigger high-quality custom synthesized sound with vibration
          playIncomingTone();

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
    const scrollToBottom = () => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Scroll immediately
    scrollToBottom();

    // Scroll after a brief delay to account for layout/rendering and image/DOM updates
    const timer = setTimeout(scrollToBottom, 60);
    return () => clearTimeout(timer);
  }, [activeMessages, activeReceiverId]);

  // Read file as Base64 helper (works for images and documents) and extracts rich metadata
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("ফাইল সাইজ খুব বড়! অনুগ্রহ করে ২MB এর চেয়ে ছোট ফাইল নির্বাচন করুন।");
        return;
      }
      setAttachedFileName(file.name);
      setDraftFilter('none'); // Reset filters
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Str = reader.result as string;
        setAttachedBase64(base64Str);
        
        if (file.type.startsWith('image/')) {
          // Client-side image dimensions reader
          const img = new Image();
          img.onload = () => {
            setAttachedImageMeta({
              width: img.naturalWidth || img.width,
              height: img.naturalHeight || img.height,
              size: (file.size / 1024).toFixed(1) + ' KB',
              type: file.type.split('/')[1]?.toUpperCase() || 'IMG'
            });
          };
          img.src = base64Str;
        } else {
          setAttachedImageMeta({
            width: 0,
            height: 0,
            size: (file.size / 1024).toFixed(1) + ' KB',
            type: file.type.split('/')[1]?.toUpperCase() || 'FILE'
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const clearAttachment = () => {
    setAttachedBase64(null);
    setAttachedFileName(null);
    setAttachedImageMeta(null);
    setDraftFilter('none');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const selectQuickPhoto = (url: string, name: string) => {
    setAttachedBase64(url);
    setAttachedFileName(name);
    setDraftFilter('none');
    
    // Read quick photo metadata
    const img = new Image();
    img.onload = () => {
      setAttachedImageMeta({
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        size: '124.5 KB', // Estimated placeholder size
        type: 'JPEG'
      });
    };
    img.src = url;
    setIsPhotoPickerOpen(false);
  };

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !attachedBase64) return;
    if (!currentUser) return;

    try {
      let isDoc = false;
      let finalMsg = inputText.trim();
      let finalImageUrl = attachedBase64 || undefined;

      if (attachedBase64) {
        isDoc = !attachedBase64.startsWith('data:image/');
        if (!finalMsg) {
          finalMsg = isDoc ? `📎 ${attachedFileName || 'document.pdf'}` : '📷 ছবি সংযুক্ত করা হয়েছে';
        }

        // Bake filters into the base64 imagery on load
        if (!isDoc && draftFilter !== 'none' && attachedBase64.startsWith('data:image/')) {
          try {
            const img = await new Promise<HTMLImageElement>((resolve, reject) => {
              const i = new Image();
              i.crossOrigin = "anonymous";
              i.onload = () => resolve(i);
              i.onerror = () => reject(new Error("Failed to load original draft image"));
              i.src = attachedBase64;
            });

            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              if (draftFilter === 'grayscale') {
                ctx.filter = 'grayscale(100%)';
              } else if (draftFilter === 'sepia') {
                ctx.filter = 'sepia(100%)';
              } else if (draftFilter === 'invert') {
                ctx.filter = 'invert(100%)';
              } else if (draftFilter === 'cool') {
                ctx.filter = 'hue-rotate(180deg) saturate(120%)';
              } else if (draftFilter === 'warm') {
                ctx.filter = 'sepia(30%) brightness(110%) saturate(120%)';
              }
              ctx.drawImage(img, 0, 0);
              finalImageUrl = canvas.toDataURL('image/jpeg', 0.85);
            }
          } catch (err) {
            console.warn("Could not bake filters on canvas:", err);
          }
        }
      }

      const msgId = "msg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
      const optimisticMsg: ChatMessage = {
        id: msgId,
        sender_id: currentUser.id || currentUser.phone || 'unknown-user',
        sender_name: currentUser.name || 'Anonymous User',
        sender_role: currentUser.role,
        receiver_id: activeReceiverId,
        receiver_name: activeReceiverName,
        message: finalMsg,
        image_url: finalImageUrl,
        timestamp: new Date().toISOString(),
        seen: false,
        ...(activeReplyTo ? {
          reply_to: {
            message_id: activeReplyTo.id,
            sender_name: activeReplyTo.sender_name,
            message: activeReplyTo.message || (activeReplyTo.image_url ? '📷 ছবি সংযুক্ত করা হয়েছে (Photo attached)' : 'সংযুক্তি (Attachment)'),
            image_url: activeReplyTo.image_url
          }
        } : {})
      };

      // Clear input and attachment immediately to make typing experience feel instant
      setInputText('');
      clearAttachment();
      setIsDraftPreviewModalOpen(false);
      setActiveReplyTo(null);

      // Instantly add message to optimistic state
      setOptimisticMessages(prev => [...prev, optimisticMsg]);
      playOutgoingTone();

      // Trigger standard background upload/save
      dbService.sendChatMessage(optimisticMsg).catch(err => {
        console.error("Failed to post message:", err);
      }).finally(() => {
        setOptimisticMessages(prev => prev.filter(m => m.id !== msgId));
      });
    } catch (err) {
      console.error("Failed to post message:", err);
    }
  };

  const sendQuickReply = async (text: string) => {
    if (!currentUser) return;
    try {
      const msgId = "msg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
      const optimisticMsg: ChatMessage = {
        id: msgId,
        sender_id: currentUser.id || currentUser.phone || 'unknown-user',
        sender_name: currentUser.name || 'Anonymous User',
        sender_role: currentUser.role,
        receiver_id: activeReceiverId,
        receiver_name: activeReceiverName,
        message: text,
        timestamp: new Date().toISOString(),
        seen: false
      };

      // Instantly add message to optimistic state
      setOptimisticMessages(prev => [...prev, optimisticMsg]);
      playOutgoingTone();
      setIsQuickRepliesOpen(false); // Close the quick replies drawer

      // Trigger standard background upload/save
      dbService.sendChatMessage(optimisticMsg).catch(err => {
        console.error("Failed to post message:", err);
      }).finally(() => {
        setOptimisticMessages(prev => prev.filter(m => m.id !== msgId));
      });
    } catch (err) {
      console.error("Failed to post quick reply:", err);
    }
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    try {
      if (!currentUser) return;
      const uId = currentUser.id || currentUser.phone || '';
      const uName = currentUser.name || 'অপারেটর';
      await dbService.toggleChatMessageReaction(messageId, emoji, uId, uName);
    } catch (err) {
      console.error("Failed to react to message:", err);
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
          
          {(() => {
            const stats = relationStats['all'];
            const lastMsg = stats?.lastMsg;
            const unreadCount = stats?.unreadCount || 0;
            const myId = currentUser?.id || currentUser?.phone || '';
            const lastMsgIsMine = lastMsg?.sender_id === myId;
            const isSelected = activeReceiverId === 'all';
            return (
              <button
                onClick={() => {
                  setActiveReceiverId('all');
                  setActiveReceiverName('সমবায় চ্যাটরুম');
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-emerald-50 text-[#075E54] font-bold border-l-4 border-[#075E54] pl-2 shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 font-medium'
                }`}
              >
                <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-emerald-100 text-[#075E54]' : 'bg-slate-200 text-slate-650'}`}>
                  <Users className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold truncate">সমবায় চ্যাটরুম (Public Group)</p>
                    {lastMsg && (
                      <span className="text-[8px] text-slate-400 font-mono font-medium">
                        {new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-0.5 gap-1.5">
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 truncate flex-1 leading-tight font-medium">
                      {lastMsg ? (
                        <>
                          {lastMsgIsMine && (
                            <Check className="w-3 h-3 text-slate-400 shrink-0 inline-block opacity-75" />
                          )}
                          <span className="truncate">
                            <strong className="text-slate-600 mr-0.5">{lastMsgIsMine ? 'আপনি: ' : `${lastMsg.sender_name}: `}</strong>
                            {lastMsg.message ? lastMsg.message : '📎 ফাইল সংযুক্ত'}
                          </span>
                        </>
                      ) : (
                        <span className="truncate text-slate-400">সকলের উন্মুক্ত চ্যাট</span>
                      )}
                    </div>
                    {unreadCount > 0 && !isSelected && (
                      <span className="px-1.5 py-0.5 text-[8px] font-extrabold bg-[#25D366] text-white rounded-full shrink-0 min-w-4 text-center">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })()}

          {/* Group Channels section */}
          {chatGroups.length > 0 && (
            <>
              <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-2 py-2 mt-2">
                গ্রুপ চ্যানেলসমূহ (WhatsApp Groups)
              </div>
              {chatGroups.map((group) => {
                const isSelected = activeReceiverId === group.id;
                const stats = relationStats[group.id];
                const lastMsg = stats?.lastMsg;
                const unreadCount = stats?.unreadCount || 0;
                const myId = currentUser?.id || currentUser?.phone || '';
                const lastMsgIsMine = lastMsg?.sender_id === myId;
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
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold truncate">{group.name}</p>
                        {lastMsg ? (
                          <span className="text-[8px] text-slate-400 font-mono font-medium">
                            {new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : (
                          <span className="text-[8px] text-slate-400 font-mono font-medium">
                            {group.member_ids.length} জন সদস্য
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-0.5 gap-1.5">
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 truncate flex-1 leading-tight font-medium">
                          {lastMsg ? (
                            <>
                              {lastMsgIsMine && (
                                <Check className="w-3 h-3 text-slate-400 shrink-0 inline-block opacity-75" />
                              )}
                              <span className="truncate">
                                <strong className="text-slate-600 mr-0.5">{lastMsgIsMine ? 'আপনি: ' : `${lastMsg.sender_name}: `}</strong>
                                {lastMsg.message ? lastMsg.message : '📎 ফাইল সংযুক্ত'}
                              </span>
                            </>
                          ) : (
                            <span className="truncate">সদস্য সংখ্যা: {group.member_ids.length} জন</span>
                          )}
                        </div>
                        {unreadCount > 0 && !isSelected && (
                          <span className="px-1.5 py-0.5 text-[8px] font-extrabold bg-[#25D366] text-white rounded-full shrink-0 min-w-4 text-center">
                            {unreadCount}
                          </span>
                        )}
                      </div>
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
              const stats = relationStats[itemPhone];
              const lastMsg = stats?.lastMsg;
              const unreadCount = stats?.unreadCount || 0;
              const myId = currentUser?.id || currentUser?.phone || '';
              const lastMsgIsMine = lastMsg?.sender_id === myId;
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
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold truncate">{op.name}</p>
                      {lastMsg && (
                        <span className="text-[8px] text-slate-400 font-mono font-medium">
                          {new Date(lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-0.5 gap-1.5">
                      <div className="flex items-center gap-1 text-[10px] text-slate-500 truncate flex-1 leading-tight font-medium">
                        {lastMsg ? (
                          <>
                            {lastMsgIsMine && (
                              !syncedIds.has(lastMsg.id) ? (
                                <Clock className="w-3 w-3 text-slate-400 shrink-0 inline-block animate-pulse" />
                              ) : lastMsg.seen ? (
                                <CheckCheck className="w-3 h-3 text-sky-500 shrink-0 inline-block" title="Seen" />
                              ) : (
                                <CheckCheck className="w-3 h-3 text-slate-400 shrink-0 inline-block opacity-70" title="Delivered" />
                              )
                            )}
                            <span className="truncate">
                              {lastMsg.message ? lastMsg.message : '📎 ফাইল সংযুক্ত'}
                            </span>
                          </>
                        ) : (
                          <span className="capitalize text-slate-400">
                            {op.role === 'admin' ? '🛡️ অ্যাডমিন' : op.role === 'cofounder' ? '🤝 সহ-প্রতিষ্ঠাতা' : '💻 অপারেটর'}
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && !isSelected && (
                        <span className="px-1.5 py-0.5 text-[8px] font-extrabold bg-[#25D366] text-white rounded-full shrink-0 min-w-4 text-center">
                          {unreadCount}
                        </span>
                      )}
                    </div>
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
                  className={`flex items-center gap-1.5 group ${isMyMessage ? 'justify-end flex-row-reverse' : 'justify-start'}`}
                >
                  {/* Subtle reply and react triggers next to bubble */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveReplyTo(msg);
                      }}
                      title="উত্তর দিন (Reply)"
                      className="p-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-[#075E54] active:scale-95 text-slate-400 hover:scale-105 rounded-xl cursor-pointer shadow-xs transition-all opacity-0 group-hover:opacity-100 max-sm:opacity-30 max-sm:group-hover:opacity-100 duration-150 self-center"
                    >
                      <Reply className="w-3 h-3" />
                    </button>

                    <div className="relative flex items-center">
                      <button
                        type="button"
                        onClick={() => {
                          setReactionPickerMsgId(reactionPickerMsgId === msg.id ? null : msg.id);
                        }}
                        title="প্রতিক্রিয়া দিন (React)"
                        className="p-1.5 bg-slate-100 hover:bg-emerald-50 hover:text-[#075E54] active:scale-95 text-slate-400 hover:scale-105 rounded-xl cursor-pointer shadow-xs transition-all opacity-0 group-hover:opacity-100 max-sm:opacity-30 max-sm:group-hover:opacity-100 duration-150 self-center"
                      >
                        <Smile className="w-3.5 h-3.5" />
                      </button>

                      {/* Floating Reaction Selector Popover */}
                      {reactionPickerMsgId === msg.id && (
                        <div className={`absolute bottom-full mb-1.5 z-45 bg-slate-900 border border-slate-700/80 shadow-2xl rounded-2xl p-1.5 flex items-center gap-1.5 animate-scale-up ${
                          isMyMessage ? 'right-0 origin-bottom-right' : 'left-0 origin-bottom-left'
                        }`}>
                          {['👍', '❤️', '🙏', '✔️', '🚜', '🌾'].map((emoji) => {
                            const myReactionId = currentUser?.id || currentUser?.phone || '';
                            const hasMyReaction = msg.reactions?.some(r => r.emoji === emoji && r.sender_id === myReactionId);
                            return (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => {
                                  handleToggleReaction(msg.id, emoji);
                                  setReactionPickerMsgId(null);
                                }}
                                className={`w-8 h-8 flex items-center justify-center rounded-xl text-base transition-all hover:bg-white/15 active:scale-90 cursor-pointer ${
                                  hasMyReaction ? 'bg-emerald-500/20 border border-emerald-500/30 font-extrabold scale-110' : ''
                                }`}
                              >
                                {emoji}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={`relative max-w-[70%] rounded-2xl px-3.5 py-2 min-w-[120px] shadow-sm transition-all duration-200 pb-3 mb-1.5 ${
                    isMyMessage 
                      ? 'bg-[#d9fdd3] text-slate-900 rounded-tr-none border border-[#e1fbc4]' 
                      : 'bg-white border border-slate-200 text-slate-900 rounded-tl-none'
                  }`}>
                    {/* Quoted Message Reference (Reply-to block rendering) */}
                    {msg.reply_to && (
                      <div className="mb-2 p-1.5 rounded-lg bg-black/5 text-[10px] leading-snug border-l-2 border-[#075E54] text-slate-700 flex items-center justify-between gap-2 select-none">
                        <div className="min-w-0 flex-1">
                          <span className="font-extrabold text-[#075E54] flex items-center gap-1 text-[9px] leading-none mb-0.5">
                            <CornerUpLeft className="w-2.5 h-2.5 shrink-0" />
                            {msg.reply_to.sender_name}
                          </span>
                          <p className="truncate text-slate-600 italic text-[10px]">
                            {msg.reply_to.message}
                          </p>
                        </div>
                        {msg.reply_to.image_url && !msg.reply_to.image_url.startsWith('data:image/') ? null : msg.reply_to.image_url && (
                          <div className="w-6 h-6 rounded bg-black/10 overflow-hidden shrink-0 border border-slate-200/50">
                            <img src={msg.reply_to.image_url} alt="Quoted thumbnail" referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>
                    )}
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

                    {/* Audio Voice Note rendering */}
                    {msg.audio_url && (
                      <VoiceNotePlayer src={msg.audio_url} />
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
                      {isMyMessage && (() => {
                        if (!syncedIds.has(msg.id)) {
                          return <Clock className="w-3 h-3 text-slate-400 inline animate-pulse animate-duration-1000" title="Sending (পাঠানো হচ্ছে...)" />;
                        }
                        if (msg.seen) {
                          return <CheckCheck className="w-3.5 h-3.5 text-[#34b7f1] inline font-extrabold scale-110 transition-transform" title="Read / Seen (পঠিত হয়েছে - পড়া হয়েছে)" />;
                        }
                        // Elegant sent vs delivered transition
                        const msgAgeMs = Date.now() - new Date(msg.timestamp).getTime();
                        if (msgAgeMs < 1800) {
                          return <Check className="w-3.5 h-3.5 text-slate-400/80 inline" title="Sent to server (সার্ভারে পাঠানো হয়েছে)" />;
                        } else {
                          return <CheckCheck className="w-3.5 h-3.5 text-slate-400 inline opacity-70" title="Delivered successfully (গ্রাহকের কাছে পৌঁছেছে)" />;
                        }
                      })()}
                    </div>

                    {/* Reactions Pill Block */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className={`absolute -bottom-2 ${isMyMessage ? 'left-2.5' : 'right-2.5'} z-15 flex items-center gap-1 bg-white hover:bg-slate-50 border border-slate-200 shadow-sm rounded-full px-1.5 py-0.5 select-none transition-all duration-150 group/react relative cursor-pointer`}>
                        <div className="flex items-center gap-0.5">
                          {Array.from(new Set(msg.reactions.map(r => r.emoji))).slice(0, 3).map((emoji) => (
                            <span key={emoji} className="text-[10px] leading-none">{emoji}</span>
                          ))}
                        </div>
                        {msg.reactions.length > 1 && (
                          <span className="text-[8px] font-mono font-extrabold text-slate-600 bg-slate-100 rounded-full px-1 shrink-0">
                            {msg.reactions.length}
                          </span>
                        )}

                        {/* Hover tooltip displaying who reacted */}
                        <div className="opacity-0 pointer-events-none group-hover/react:opacity-100 absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 text-white rounded-xl py-1 px-2.5 text-[9px] shadow-xl z-50 transition-opacity duration-150 shrink-0">
                          <p className="font-extrabold text-[#34d399] border-b border-white/10 pb-0.5 mb-1 text-[8px] tracking-wider uppercase">প্রতিক্রিয়া প্রদানকারী (Reactions)</p>
                          <div className="space-y-0.5 max-h-24 overflow-y-auto">
                            {msg.reactions.map((r, i) => (
                              <div key={i} className="flex items-center gap-1 font-semibold text-slate-200">
                                <span className="text-[11px] leading-none">{r.emoji}</span>
                                <span className="truncate max-w-[80px]">{r.sender_name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
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

        {/* Quick Replies Drawer panel */}
        {isQuickRepliesOpen && (
          <div className="p-3 bg-white border-t border-slate-200 shrink-0 max-h-60 overflow-y-auto animate-fadeIn z-10 shadow-lg">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-100">
              <span className="text-xs font-bold text-[#075E54] flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 fill-yellow-400 text-yellow-500 animate-pulse" /> চটজলদি জবাব (Quick Replies)
              </span>
              <button 
                type="button" 
                onClick={() => setIsQuickRepliesOpen(false)}
                className="text-slate-450 hover:text-slate-700 cursor-pointer p-0.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {QUICK_REPLIES.map((qr) => (
                <div 
                  key={qr.id} 
                  className="flex items-center justify-between gap-1.5 p-2 bg-slate-50 border border-slate-250 rounded-xl hover:border-emerald-300 hover:bg-emerald-50/25 transition-all text-left group"
                >
                  <button
                    type="button"
                    onClick={() => sendQuickReply(qr.text)}
                    title="সরাসরি পাঠান (Send Instant)"
                    className="flex-1 text-xs text-slate-800 font-medium text-left truncate cursor-pointer pr-1"
                  >
                    <div className="font-bold text-[11px] text-[#075E54] group-hover:text-teal-700">{qr.label}</div>
                    <div className="text-[10px] text-slate-600 truncate">{qr.text}</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInputText(qr.text);
                      setIsQuickRepliesOpen(false);
                    }}
                    title="লিখুন (Insert to edit)"
                    className="p-1 px-1.5 bg-slate-200 hover:bg-emerald-150 text-slate-700 hover:text-emerald-900 rounded-lg text-[9px] font-bold cursor-pointer transition-colors shrink-0"
                  >
                    সম্পাদনা
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selected file attachment badge */}
        {attachedBase64 && (
          <div className="mx-4 my-2.5 p-2 bg-gradient-to-r from-emerald-50/60 to-white rounded-xl border border-emerald-250 flex items-center justify-between shadow-xs shrink-0 animate-fade-in">
            <div className="flex items-center gap-3">
              <div 
                onClick={() => {
                  if (attachedBase64.startsWith('data:image/') || attachedImageMeta?.width) {
                    setIsDraftPreviewModalOpen(true);
                  }
                }}
                className={`relative w-12 h-12 rounded-lg overflow-hidden border border-emerald-200 flex items-center justify-center bg-slate-50 shrink-0 select-none group/thumb ${
                  attachedBase64.startsWith('data:image/') ? 'cursor-zoom-in' : ''
                }`}
                title={attachedBase64.startsWith('data:image/') ? "বড় করে দেখতে ও ফিল্টার করতে ক্লিক করুন (Click to zoom/filter)" : undefined}
              >
                {attachedBase64.startsWith('data:image/') ? (
                  <>
                    <img 
                      src={attachedBase64} 
                      alt="Attached draft" 
                      referrerPolicy="no-referrer" 
                      className={`w-full h-full object-cover transition-all duration-300 ${
                        draftFilter === 'grayscale' ? 'grayscale' :
                        draftFilter === 'sepia' ? 'sepia' :
                        draftFilter === 'invert' ? 'invert' :
                        draftFilter === 'cool' ? 'hue-rotate-180 saturate-120' :
                        draftFilter === 'warm' ? 'sepia-[0.3] brightness-110 saturate-120' : ''
                      }`} 
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-all">
                      <Eye className="w-4 h-4 text-white" />
                    </div>
                  </>
                ) : (
                  <FileText className="w-6 h-6 text-[#075E54]" />
                )}
              </div>
              <div className="text-[11px] min-w-0 flex-1">
                <p className="font-extrabold text-slate-900 truncate">
                  {attachedBase64.startsWith('data:image/') ? '📷 ছবি ড্রাফট (Image Selected)' : '📎 ডকুমেন্ট সংযুক্তি (Document Selected)'}
                </p>
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5">
                  <span className="text-slate-500 font-mono text-[10px] truncate max-w-[150px] sm:max-w-[200px]" title={attachedFileName || 'file'}>
                    {attachedFileName || 'file.jpg'}
                  </span>
                  {attachedImageMeta && (
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-mono font-bold">
                      {attachedImageMeta.type} • {attachedImageMeta.size} 
                      {attachedImageMeta.width > 0 && ` • ${attachedImageMeta.width}x${attachedImageMeta.height}`}
                    </span>
                  )}
                  {draftFilter !== 'none' && (
                    <span className="text-[9px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded font-bold uppercase tracking-wider">
                      {draftFilter}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5 shrink-0 ml-2">
              {attachedBase64.startsWith('data:image/') && (
                <button
                  type="button"
                  onClick={() => setIsDraftPreviewModalOpen(true)}
                  title="ফিল্টার ও প্রিভিউ (Apply filters & preview)"
                  className="p-2 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg cursor-pointer transition-colors"
                >
                  <Sliders className="w-4 h-4" />
                </button>
              )}
              
              <button
                type="button"
                onClick={clearAttachment}
                title="মুছে ফেলুন (Remove attachment)"
                className="p-2 hover:bg-rose-50 text-rose-500 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Reply To message preview bar with animation */}
        {activeReplyTo && (
          <div className="mx-4 mt-2 px-3.5 py-2.5 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-center justify-between gap-3 shadow-xs animate-fade-in shrink-0">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {/* Vertical accent colored handle */}
              <div className="w-1 bg-amber-500 rounded-lg self-stretch" />
              <div className="text-[11px] min-w-0">
                <p className="font-extrabold text-amber-900 flex items-center gap-1">
                  <CornerUpLeft className="w-3.5 h-3.5 text-amber-600" />
                  <span>{activeReplyTo.sender_name} কে উত্তর দেওয়া হচ্ছে</span>
                </p>
                <p className="text-slate-600 font-semibold truncate max-w-[280px] sm:max-w-md mt-0.5" title={activeReplyTo.message}>
                  {activeReplyTo.message || (activeReplyTo.image_url ? '📷 একটি ছবি (Attached Photo)' : 'সংযুক্তি (Attachment)')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {activeReplyTo.image_url && !activeReplyTo.image_url.startsWith('data:image/') ? null : activeReplyTo.image_url && (
                <div className="w-8 h-8 rounded-lg overflow-hidden border border-amber-200 bg-amber-100 flex items-center justify-center shrink-0">
                  <img src={activeReplyTo.image_url} alt="Quoted draft" className="w-full h-full object-cover select-none" />
                </div>
              )}
              
              <button
                type="button"
                onClick={() => setActiveReplyTo(null)}
                title="উত্তর বাতিল করুন (Cancel reply)"
                className="p-1.5 hover:bg-rose-50 hover:text-rose-500 text-slate-400 rounded-lg cursor-pointer transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Active sending panel & Recording HUD */}
        <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0">
          
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            className="hidden"
          />

          {isRecording ? (
            <div className="flex-1 flex items-center justify-between bg-rose-50 border border-rose-150 rounded-xl px-4 py-2 select-none animate-pulse">
              <div className="flex items-center gap-2 text-rose-600 font-bold text-xs">
                <span className="w-2.5 h-2.5 bg-rose-600 rounded-full shrink-0" />
                <span>রেকর্ডিং হচ্ছে (Recording): {formatRecordTime(recordingDuration)}</span>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Cancel / Trash out button */}
                <button
                  type="button"
                  onClick={cancelAndDiscardRecording}
                  title="রেকর্ড বাতিল করুন (Discard Recording)"
                  className="p-1 px-2.5 bg-rose-100/60 hover:bg-rose-200 text-rose-600 font-extrabold rounded-lg text-[10px] uppercase flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>মুছে ফেলুন (Discard)</span>
                </button>

                {/* Stop / Send recording */}
                <button
                  type="button"
                  onClick={stopAndSendRecording}
                  title="রেকর্ড সম্পন্ন ও পাঠান (Stop and Send)"
                  className="p-1 px-2.5 bg-emerald-650 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-[10px] uppercase flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-xs"
                >
                  <Square className="w-3 h-3 fill-white" />
                  <span>পাঠান (Send)</span>
                </button>
              </div>
            </div>
          ) : (
            <>
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
                onClick={() => {
                  setIsPhotoPickerOpen(!isPhotoPickerOpen);
                  setIsQuickRepliesOpen(false);
                }}
                title="হোয়াটসঅ্যাপ দ্রুত স্টিকার"
                className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-center shrink-0 ${
                  isPhotoPickerOpen 
                    ? 'border-emerald-250 bg-emerald-50 text-emerald-700' 
                    : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsQuickRepliesOpen(!isQuickRepliesOpen);
                  setIsPhotoPickerOpen(false);
                }}
                title="চটজলদি জবাব (Quick Replies)"
                className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-center shrink-0 ${
                  isQuickRepliesOpen 
                    ? 'border-yellow-400 bg-yellow-50 text-yellow-700' 
                    : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100/85 hover:text-slate-800'
                }`}
              >
                <Zap className={`w-4 h-4 ${isQuickRepliesOpen ? 'fill-yellow-400' : ''}`} />
              </button>

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={attachedBase64 ? "ক্যাপশন বা বার্তা লিখুন..." : "এখানে বার্তা, লিংক বা নম্বর টাইপ করুন..."}
                className="flex-1 bg-slate-100 border border-transparent rounded-xl px-4 py-2.5 text-xs focus:bg-white focus:border-slate-205 focus:outline-none focus:ring-2 focus:ring-[#075E54] transition-all text-slate-900 font-semibold"
              />

              {/* Record Voice Note triggering button */}
              <button
                type="button"
                onClick={startRecording}
                title="ভয়েস রেকর্ড করুন (Record Voice Note)"
                className="p-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600 cursor-pointer transition-all flex items-center justify-center shrink-0 hover:scale-105 active:scale-95"
              >
                <Mic className="w-4 h-4" />
              </button>

              <button
                type="submit"
                disabled={!inputText.trim() && !attachedBase64}
                className="bg-[#075E54] hover:bg-teal-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white p-2.5 rounded-xl cursor-pointer transition-colors flex items-center justify-center shadow-md shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </>
          )}
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

      {/* WhatsApp-style Immersive Draft Image Preview Modal */}
      {isDraftPreviewModalOpen && attachedBase64 && (
        <div className="fixed inset-0 z-55 bg-slate-950/95 backdrop-blur-xs flex flex-col justify-between p-4 md:p-6 animate-fade-in text-white font-sans">
          
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3 md:pb-4 max-w-5xl mx-auto w-full">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-emerald-400 flex items-center gap-1.5 leading-none">
                📸 ছবি সংযুক্তি প্রিভিউ (Active Draft)
              </span>
              <span className="text-[10px] text-slate-400 font-mono mt-1">
                {attachedFileName || 'unnamed_image.jpg'}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              {attachedImageMeta && (
                <span className="hidden sm:inline-block text-[10px] bg-white/10 px-2 py-0.5 rounded font-mono text-slate-300 border border-white/5 font-bold">
                  {attachedImageMeta.type} • {attachedImageMeta.size} 
                  {attachedImageMeta.width > 0 && ` • ${attachedImageMeta.width} x ${attachedImageMeta.height} px`}
                </span>
              )}
              <button
                type="button"
                onClick={() => setIsDraftPreviewModalOpen(false)}
                className="p-2 hover:bg-white/10 active:bg-white/20 rounded-xl cursor-pointer transition-colors text-slate-300 hover:text-white"
                title="বন্ধ করুন (Close)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col md:flex-row items-center justify-center gap-6 py-6 md:py-8 overflow-hidden max-w-5xl mx-auto w-full">
            {/* Left Column: Interactive Screen Image */}
            <div className="flex-1 max-w-xl w-full flex flex-col items-center justify-center overflow-hidden">
              <div className="relative max-h-[42vh] md:max-h-[50vh] overflow-hidden rounded-2xl border border-white/10 shadow-2xl bg-slate-900/60 p-1 flex items-center justify-center">
                <img
                  src={attachedBase64}
                  alt="Draft Attachment Full Resolution"
                  referrerPolicy="no-referrer"
                  className={`max-w-full max-h-[40vh] md:max-h-[48vh] object-contain rounded-xl shadow-inner transition-all duration-300 origin-center select-none ${
                    draftFilter === 'grayscale' ? 'grayscale' :
                    draftFilter === 'sepia' ? 'sepia' :
                    draftFilter === 'invert' ? 'invert' :
                    draftFilter === 'cool' ? 'hue-rotate-180 saturate-120' :
                    draftFilter === 'warm' ? 'sepia-[0.3] brightness-110 saturate-120' : ''
                  }`}
                />
              </div>
            </div>

            {/* Right Column: Editing Panel */}
            <div className="w-full md:w-80 flex flex-col gap-5 bg-white/5 border border-white/10 p-4 rounded-2xl shrink-0">
              <div>
                <span className="text-xs font-bold text-slate-200 uppercase tracking-widest flex items-center gap-1.5 mb-2.5">
                  <Sliders className="w-3.5 h-3.5 text-emerald-400" /> ফিল্টার ইফেক্টস (Filters)
                </span>
                
                <div className="grid grid-cols-2 md:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                  {[
                    { id: 'none', label: 'স্বাভাবিক (Normal)', class: '' },
                    { id: 'grayscale', label: 'সাদা-কালো (Grayscale)', class: 'grayscale' },
                    { id: 'sepia', label: 'সেপিয়া (Sepia)', class: 'sepia' },
                    { id: 'cool', label: 'শীতল (Cool Theme)', class: 'hue-rotate-180 saturate-120' },
                    { id: 'warm', label: 'উষ্ণ (Warm Tone)', class: 'sepia-[0.3] brightness-110 saturate-120' },
                    { id: 'invert', label: 'বিপরীত (Inverted)', class: 'invert' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setDraftFilter(f.id)}
                      className={`flex flex-col items-center gap-1.5 p-2 bg-slate-905 bg-slate-900/60 hover:bg-slate-800/80 rounded-xl transition-all cursor-pointer text-center group border-2 ${
                        draftFilter === f.id ? 'border-emerald-500 shadow-emerald-500/20 shadow-md' : 'border-transparent'
                      }`}
                    >
                      <div className="w-full h-12 bg-slate-800 rounded-lg overflow-hidden flex items-center justify-center border border-white/5 shrink-0">
                        <img
                          src={attachedBase64}
                          alt={f.label}
                          referrerPolicy="no-referrer"
                          className={`w-full h-full object-cover select-none ${f.class}`}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-slate-300 group-hover:text-white transition-colors">{f.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Resolution details in sidebar for small screen devices */}
              {attachedImageMeta && (
                <div className="bg-slate-900/80 p-2 text-[10px] rounded-lg border border-white/5 font-mono text-slate-400 space-y-0.5">
                  <p className="font-sans text-slate-300 font-bold mb-1 border-b border-white/5 pb-1">মেটাডেটা (Metadata)</p>
                  <p>প্রকার: {attachedImageMeta.type}</p>
                  <p>সাইজ: {attachedImageMeta.size}</p>
                  {attachedImageMeta.width > 0 && <p>রেশিও: {attachedImageMeta.width} x {attachedImageMeta.height} px</p>}
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer Controls & Capable caption text */}
          <div className="max-w-5xl mx-auto w-full border-t border-white/10 pt-4 flex flex-col md:flex-row items-center gap-3">
            <div className="flex-1 w-full relative">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="ক্যাপশন বা বার্তা লিখুন (Write image caption or message...)"
                className="w-full bg-slate-900 hover:bg-slate-800 focus:bg-slate-900 border border-white/10 focus:border-emerald-500 rounded-xl px-4 py-3 text-xs placeholder-slate-400 outline-none shadow-inner focus:ring-1 focus:ring-emerald-500 font-medium text-white transition-all"
              />
            </div>
            
            <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-end">
              <button
                type="button"
                onClick={() => {
                  clearAttachment();
                  setIsDraftPreviewModalOpen(false);
                }}
                className="flex-1 md:flex-none px-4 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 font-bold rounded-xl text-xs cursor-pointer transition-colors"
              >
                ড্রাফট মুছুন (Discard)
              </button>
              
              <button
                type="button"
                onClick={(e) => {
                  setIsDraftPreviewModalOpen(false);
                  handleSendMessage(e);
                }}
                className="flex-1 md:flex-none px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-xl text-xs cursor-pointer transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/20"
              >
                <Send className="w-3.5 h-3.5" /> পাঠান (Send with Filter)
              </button>
            </div>
          </div>

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
