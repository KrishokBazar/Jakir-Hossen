import { useState, useEffect, useRef, FormEvent, ChangeEvent, useMemo } from 'react';
import { dbService } from '../db';
import { ChatMessage, Profile, ChatGroup } from '../types';
import { useNotification } from './NotificationContext';
import { playIncomingTone, playOutgoingTone } from '../utils/audio';
import { compressImage } from '../utils/imageCompressor';
import { 
  Send, 
  User, 
  MessageSquare, 
  Users, 
  Radio, 
  Camera, 
  Paperclip, 
  X, 
  CheckCheck, 
  Check,
  FileText,
  Maximize2,
  BellRing,
  Plus,
  Users2,
  Video,
  PhoneCall,
  Search
} from 'lucide-react';

// Real-time links detector
const formatPopText = (text: string, isMyMessage: boolean) => {
  if (!text) return '';
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
  const phoneRegex = /(\+?8801[3-9]\d{8}|01[3-9]\d{8})/g;
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
            className={`underline font-bold break-all ${isMyMessage ? 'text-yellow-200 hover:text-white' : 'text-emerald-700 hover:text-emerald-800'}`}
          >
            {part}
          </a>
        );
      } else if (phoneRegex.test(part)) {
        return (
          <a 
            key={`${lineIdx}-${index}`} 
            href={`tel:${part}`} 
            className={`underline font-mono font-bold ${isMyMessage ? 'text-amber-100 hover:text-white' : 'text-slate-800 hover:text-[#075E54]'}`}
          >
            {part}
          </a>
        );
      }
      return part;
    });
    return <span key={lineIdx} className="block">{content}</span>;
  });
};

export default function FloatingChat() {
  const currentUserRaw = dbService.getCurrentUser();
  const currentUser = useMemo(() => currentUserRaw, [
    currentUserRaw?.id,
    currentUserRaw?.phone,
    currentUserRaw?.name,
    currentUserRaw?.role
  ]);
  
  if (!currentUser) return null; // Only render when authenticated

  const { showNotification } = useNotification();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]);
  const [operators, setOperators] = useState<Profile[]>([]);
  const [chatGroups, setChatGroups] = useState<ChatGroup[]>([]);
  
  const [activeTab, setActiveTab] = useState<'threads' | 'chat'>('threads');
  const [activeReceiverId, setActiveReceiverId] = useState<string>('all');
  const [activeReceiverName, setActiveReceiverName] = useState<string>('সমবায় চ্যাটরুম');
  
  const [inputText, setInputText] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  // Attachments
  const [attachedBase64, setAttachedBase64] = useState<string | null>(null);
  const [attachedFileName, setAttachedFileName] = useState<string | null>(null);

  // Group creation modal state inside popup
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastMessageIdRef = useRef<string | null>(null);

  // Filter messages for active thread
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
        const myId = currentUser.id || currentUser.phone || '';
        return (
          (msg.sender_id === myId && msg.receiver_id === activeReceiverId) ||
          (msg.sender_id === activeReceiverId && msg.receiver_id === myId)
        );
      }
    });
  }, [allMessagesMerged, activeReceiverId, chatGroups, currentUser]);

  // Subscriptions
  useEffect(() => {
    const unsubChats = dbService.subscribeChats((msgs) => {
      setMessages(msgs);
    });
    const unsubOps = dbService.subscribeOperators((list) => {
      const filtered = list.filter(op => op.approved && op.id !== currentUser.id);
      setOperators(filtered);
    });
    const unsubGroups = dbService.subscribeChatGroups((liveGroups) => {
      const myId = currentUser.id || currentUser.phone || '';
      const filtered = liveGroups.filter(g => g.member_ids.includes(myId));
      setChatGroups(filtered);
    });

    return () => {
      unsubChats();
      unsubOps();
      unsubGroups();
    };
  }, [currentUser]);

  // Handle unread counts & chime sounds
  useEffect(() => {
    if (messages.length > 0) {
      const myId = currentUser.id || currentUser.phone || '';
      const latest = messages[messages.length - 1];

      // Calculate total unseen private messages for us
      const unseens = messages.filter(m => m.sender_id !== myId && !m.seen && m.receiver_id === myId).length;
      setUnreadCount(unseens);

      if (latest && latest.sender_id !== myId && lastMessageIdRef.current && lastMessageIdRef.current !== latest.id) {
        // Trigger sound if active receiver is not the sender, or if closed
        const isForMe = latest.receiver_id === 'all' || latest.receiver_id === myId || chatGroups.some(g => g.id === latest.receiver_id);
        
        if (isForMe && (!isOpen || activeReceiverId !== latest.sender_id)) {
          playIncomingTone();
        }
      }
      if (latest) {
        lastMessageIdRef.current = latest.id;
      }
    } else {
      lastMessageIdRef.current = null;
    }
  }, [messages, currentUser, isOpen, activeReceiverId, chatGroups]);

  // Auto scroll
  useEffect(() => {
    if (isOpen && activeTab === 'chat') {
      setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [activeMessages, activeReceiverId, activeTab, isOpen]);

  // Mark unseen as read
  useEffect(() => {
    const myId = currentUser.id || currentUser.phone || '';
    if (isOpen && activeTab === 'chat' && activeReceiverId !== 'all' && !activeReceiverId.startsWith('group_')) {
      const unseen = messages.filter(m => m.sender_id === activeReceiverId && m.receiver_id === myId && !m.seen);
      if (unseen.length > 0) {
        unseen.forEach(m => dbService.markChatMessageAsSeen(m.id));
      }
    }
  }, [messages, activeReceiverId, activeTab, isOpen, currentUser]);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachedFileName(file.name);
      try {
        if (file.type.startsWith('image/')) {
          const compressedBase64 = await compressImage(file, 640, 640, 0.75);
          setAttachedBase64(compressedBase64);
        } else {
          if (file.size > 2 * 1024 * 1024) {
            alert("২MB এর চেয়ে ছোট ছবি বা ফাইল নির্বাচন করুন।");
            return;
          }
          const reader = new FileReader();
          reader.onloadend = () => {
            setAttachedBase64(reader.result as string);
          };
          reader.readAsDataURL(file);
        }
      } catch (err: any) {
        showNotification("ত্রুটি", "ফাইল প্রসেস করতে ত্রুটি হয়েছে।", "error");
      }
    }
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !attachedBase64) return;

    try {
      let isDoc = false;
      let finalMsg = inputText.trim();

      if (attachedBase64) {
        isDoc = !attachedBase64.startsWith('data:image/');
        if (!finalMsg) {
          finalMsg = isDoc ? `📎 ${attachedFileName || 'file.pdf'}` : '📷 ছবি সংযুক্ত করা হয়েছে';
        }
      }

      const msgId = "msg_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
      const optimisticMsg: ChatMessage = {
        id: msgId,
        sender_id: currentUser.id || currentUser.phone || 'unknown',
        sender_name: currentUser.name || 'Anonymous',
        sender_role: currentUser.role,
        receiver_id: activeReceiverId,
        receiver_name: activeReceiverName,
        message: finalMsg,
        image_url: attachedBase64 || undefined,
        timestamp: new Date().toISOString(),
        seen: false
      };

      // Reset fields immediately
      setInputText('');
      setAttachedBase64(null);
      setAttachedFileName(null);

      // Instantly add message to optimistic state
      setOptimisticMessages(prev => [...prev, optimisticMsg]);
      playOutgoingTone();

      // Fire the request in background
      dbService.sendChatMessage(optimisticMsg).catch(err => {
        console.error("Failed to post message:", err);
      }).finally(() => {
        setOptimisticMessages(prev => prev.filter(m => m.id !== msgId));
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateGroup = async (e: FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
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
      showNotification("সফল", "হোয়াটসঅ্যাপ গ্রুপ তৈরি হয়েছে।", "success");
    } catch (err) {
      console.error(err);
    }
  };

  const toggleMemberSelection = (id: string) => {
    if (selectedMemberIds.includes(id)) {
      setSelectedMemberIds(selectedMemberIds.filter(m => m !== id));
    } else {
      setSelectedMemberIds([...selectedMemberIds, id]);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans hidden md:block">
      
      {/* Floating Circular Green Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-[#25D366] hover:bg-[#20ba59] text-white rounded-full flex items-center justify-center shadow-2xl cursor-pointer select-none relative transition-all duration-300 hover:scale-105"
        title="WhatsApp চ্যাট পপআপ"
      >
        <MessageSquare className="w-6 h-6 fill-white" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-rose-600 border-2 border-white text-white font-bold text-[10px] w-5.5 h-5.5 rounded-full flex items-center justify-center animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Pop-up Card Widget */}
      {isOpen && (
        <div className="absolute bottom-18 right-0 w-96 h-[510px] bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-50 animate-fade-in transition-all">
          
          {/* Header Bar */}
          <div className="bg-[#075E54] text-white p-3.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              {activeTab === 'chat' && (
                <button 
                  onClick={() => setActiveTab('threads')} 
                  className="p-1 hover:bg-teal-800 rounded-lg text-xs font-bold mr-1"
                >
                  ◀ ব্যাক
                </button>
              )}
              <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#075E54] font-extrabold flex items-center justify-center text-xs shrink-0">
                W
              </div>
              <div>
                <h4 className="text-xs font-bold truncate max-w-[160px]">
                  {activeTab === 'threads' ? 'হোয়াটসঅ্যাপ চ্যাট (Live)' : activeReceiverName}
                </h4>
                <p className="text-[9px] text-[#25D366] flex items-center gap-1 font-semibold">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#25D366] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#25D366]"></span>
                  </span>
                  অনলাইন কনেকশন
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {activeTab === 'chat' && (
                <div className="flex items-center gap-1">
                  <button onClick={() => alert("অপ্রত্যাশিত অডিও কল সাপোর্ট")} className="p-1 hover:bg-teal-800 rounded-lg text-white">
                    <PhoneCall className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => alert("অপ্রত্যাশিত ভিডিও মিটিং সাপোর্ট")} className="p-1 hover:bg-teal-800 rounded-lg text-white">
                    <Video className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-teal-150 hover:bg-teal-800 rounded-lg transition-colors"
                title="বন্ধ করুন"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Active Area Viewport */}
          <div className="flex-1 overflow-hidden bg-slate-50 flex flex-col">
            {activeTab === 'threads' ? (
              /* Threads Viewport */
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
                
                <div className="flex items-center justify-between px-1.5 py-1">
                  <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">চ্যানেল সমূহ</span>
                  {(currentUser.role === 'admin' || currentUser.role === 'cofounder') && (
                    <button
                      type="button"
                      onClick={() => setShowGroupModal(true)}
                      className="text-[9px] font-extrabold text-[#075E54] hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> গ্রুপ খুলুন
                    </button>
                  )}
                </div>

                <button
                  onClick={() => {
                    setActiveReceiverId('all');
                    setActiveReceiverName('সমবায় চ্যাটরুম');
                    setActiveTab('chat');
                  }}
                  className="w-full flex items-center gap-3 p-2 bg-white rounded-xl border hover:bg-slate-50 text-left cursor-pointer transition-all"
                >
                  <div className="p-1.5 rounded-lg bg-emerald-100 text-[#075E54] shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate">সমবায় চ্যাটরুম (Public Group)</p>
                    <p className="text-[9.5px] text-slate-400 font-medium">সকলের জন্য উন্মুক্ত</p>
                  </div>
                </button>

                {chatGroups.length > 0 && (
                  <>
                    <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest px-1.5 pt-2">
                      গ্রুপ চ্যাটরুম (Groups)
                    </div>
                    {chatGroups.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => {
                          setActiveReceiverId(g.id);
                          setActiveReceiverName(g.name);
                          setActiveTab('chat');
                        }}
                        className="w-full flex items-center gap-3 p-2 bg-white rounded-xl border hover:bg-slate-50 text-left cursor-pointer transition-all"
                      >
                        <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800 shrink-0">
                          <Users2 className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">{g.name}</p>
                          <p className="text-[9px] text-slate-400 font-medium truncate">সদস্য: {g.member_ids.length} জন</p>
                        </div>
                      </button>
                    ))}
                  </>
                )}

                <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest px-1.5 pt-2">
                  ১-টু-১ সরাসরি বার্তা (Private)
                </div>

                {operators.length === 0 ? (
                  <p className="text-[10px] text-slate-400 italic text-center py-4">অন্য কোনো অপারেটর অনলাইন নেই</p>
                ) : (
                  operators.map((op) => {
                    const opId = op.id || op.phone || '';
                    return (
                      <button
                        key={opId}
                        onClick={() => {
                          setActiveReceiverId(opId);
                          setActiveReceiverName(op.name);
                          setActiveTab('chat');
                        }}
                        className="w-full flex items-center gap-3 p-2 bg-white rounded-xl border hover:bg-slate-50 text-left cursor-pointer transition-all"
                      >
                        <div className="p-1.5 rounded-lg bg-emerald-50 text-[#075E54] shrink-0">
                          <User className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">{op.name}</p>
                          <p className="text-[9px] text-slate-450 leading-none capitalize mt-0.5">{op.role === 'admin' ? '🛡️ অ্যাডমিন' : op.role === 'cofounder' ? '🤝 সহ-প্রতিষ্ঠাতা' : '💻 অপারেটর'}</p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            ) : (
              /* Inside active message thread Viewport */
              <div className="flex-1 flex flex-col bg-[#efeae2] overflow-hidden">
                
                {/* Message Log viewport */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                  {activeMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-4">
                      <p className="text-[11px] text-slate-500 font-medium">কোনো বার্তা নেই। নতুন বার্তা লিখুন।</p>
                    </div>
                  ) : (
                    activeMessages.map((msg) => {
                      const isMy = msg.sender_id === (currentUser.id || currentUser.phone || '');
                      const isDoc = msg.image_url && !msg.image_url.startsWith('data:image/');

                      return (
                        <div key={msg.id} className={`flex ${isMy ? 'justify-end' : 'justify-start'}`}>
                          <div className={`rounded-xl px-2.5 py-1.5 text-[11px] max-w-[80%] shadow-2xs ${
                            isMy ? 'bg-[#d9fdd3] text-slate-900 border border-[#cefabb]' : 'bg-white text-slate-900'
                          }`}>
                            {!isMy && <p className="text-[9px] font-extrabold text-teal-850 leading-none mb-0.5">{msg.sender_name}</p>}
                            
                            {/* Document / File rendering */}
                            {msg.image_url && (
                              isDoc ? (
                                <div className="my-1 p-2 bg-slate-50 border rounded-lg flex items-center justify-between gap-2 max-w-[180px]">
                                  <FileText className="w-4 h-4 text-[#075E54] shrink-0" />
                                  <span className="text-[9px] font-bold truncate max-w-[80px]">{msg.message && msg.message.includes('📎') ? msg.message.replace('📎 ', '') : 'file.pdf'}</span>
                                  <a href={msg.image_url} download="downloaded_doc.pdf" className="text-[8px] bg-[#075E54] text-white font-extrabold px-1.5 py-0.5 rounded">ডাউনলোডের</a>
                                </div>
                              ) : (
                                <img src={msg.image_url} alt="asset" referrerPolicy="no-referrer" className="my-1 max-w-[180px] max-h-[110px] rounded-lg object-cover cursor-zoom-in" />
                              )
                            )}

                            {msg.message && <div className="leading-relaxed whitespace-pre-wrap font-medium">{formatPopText(msg.message, isMy)}</div>}
                            
                            <div className="text-[7.5px] font-mono text-slate-400 text-right mt-0.5">
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              {isMy && (
                                msg.seen ? <span className="text-sky-500 ml-1">✓✓</span> : <span className="text-slate-400 ml-1">✓✓</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Selected attachment preview layout */}
                {attachedBase64 && (
                  <div className="mx-2 my-1 bg-white p-2 border border-emerald-200 rounded-lg flex items-center justify-between shadow-sm shrink-0">
                    <div className="flex items-center gap-1.5 text-[9px] min-w-0">
                      <FileText className="w-4 h-4 text-[#075E54] shrink-0" />
                      <span className="truncate max-w-[160px] font-bold">{attachedFileName}</span>
                    </div>
                    <button type="button" onClick={() => { setAttachedBase64(null); setAttachedFileName(null); }} className="text-rose-500 p-1">✕</button>
                  </div>
                )}

                {/* Chat input form */}
                <form onSubmit={handleSend} className="p-2 bg-white border-t border-slate-100 flex items-center gap-1.5 shrink-0">
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" className="hidden" />
                  
                  <button 
                    type="button" 
                    onClick={() => fileInputRef.current?.click()} 
                    className="p-1 px-1.5 text-slate-400 hover:text-[#075E54] transition-all"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={attachedBase64 ? "ক্যাপশন লিখুন..." : "মেসেজ লিখুন..."}
                    className="flex-1 bg-slate-100 border border-transparent rounded-xl px-3 py-2 text-[10px] focus:outline-none focus:ring-1 focus:ring-[#075E54]"
                  />

                  <button 
                    type="submit" 
                    disabled={!inputText.trim() && !attachedBase64}
                    className="bg-[#075E54] text-white p-2 rounded-xl disabled:bg-slate-300 disabled:cursor-not-allowed shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* Group creations Modal inside floating panel */}
          {showGroupModal && (
            <div className="absolute inset-0 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-3 z-50">
              <form onSubmit={handleCreateGroup} className="bg-white w-full rounded-xl p-4 border border-slate-100 shadow-xl flex flex-col gap-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    <Users2 className="w-4 h-4 text-[#075E54]" /> নতুন গ্রুপ খুলুন
                  </span>
                  <button type="button" onClick={() => setShowGroupModal(false)} className="text-slate-400 text-xs">✕</button>
                </div>
                
                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">গ্রুপের নাম *</label>
                    <input type="text" required value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="যেমন: অ্যাডমিন ও সহপার্টনার" className="w-full px-2.5 py-1.5 border text-[11px] rounded-lg" />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">সদস্য নির্বাচন করুন *</label>
                    <div className="border rounded-lg max-h-24 overflow-y-auto p-1.5 space-y-1 bg-slate-50">
                      {operators.map(op => {
                        const inGrp = selectedMemberIds.includes(op.id);
                        return (
                          <label key={op.id} className="flex items-center gap-2 text-[10px] cursor-pointer">
                            <input type="checkbox" checked={inGrp} onChange={() => toggleMemberSelection(op.id)} className="rounded text-emerald-600 focus:ring-emerald-550" />
                            <span className="truncate">{op.name} ({op.role === 'cofounder' ? 'সহ-প্রতিষ্ঠাতা' : 'অপারেটর'})</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 text-[10px] border-t pt-2 mt-1">
                  <button type="button" onClick={() => setShowGroupModal(false)} className="px-3 py-1.5 border hover:bg-slate-50 rounded-lg">বাতিল</button>
                  <button type="submit" className="px-3.5 py-1.5 bg-[#075E54] text-white rounded-lg font-bold">তৈরি করুন</button>
                </div>
              </form>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
