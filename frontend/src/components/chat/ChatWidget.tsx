import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Crown, Shield, User } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../../store/auth';
import { ChatMessage, OnlineUser } from '../../types';
import { useI18n } from '../../hooks/useI18n';

type Channel = 'global' | 'support';

const ROLE_COLORS: Record<string, string> = {
  admin: '#a78bfa',
  helper: '#f59e0b',
  user: '#94a3b8',
};

function RoleBadge({ role }: { role: string }) {
  if (role === 'admin') return <Crown size={11} style={{ color: '#a78bfa' }} />;
  if (role === 'helper') return <Shield size={11} style={{ color: '#f59e0b' }} />;
  return <User size={11} style={{ color: '#94a3b8' }} />;
}

function formatTime(ts: string) {
  try {
    return new Date(ts).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function ChatWidget() {
  const { user } = useAuthStore();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<Channel>('global');
  const [messages, setMessages] = useState<Record<Channel, ChatMessage[]>>({ global: [], support: [] });
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [input, setInput] = useState('');
  const [unread, setUnread] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const joinedRef = useRef<Set<Channel>>(new Set());

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, channel, scrollToBottom]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const socket = io('/', { auth: { token } });
    socketRef.current = socket;

    socket.on('chat:online', (users: OnlineUser[]) => {
      setOnlineUsers(users);
    });

    socket.on('chat:history', (data: { channel: Channel; messages: ChatMessage[] }) => {
      setMessages(prev => ({ ...prev, [data.channel]: data.messages }));
    });

    socket.on('chat:message', (msg: ChatMessage) => {
      setMessages(prev => ({
        ...prev,
        [msg.channel]: [...(prev[msg.channel as Channel] || []).slice(-499), msg]
      }));
      if (!open || msg.channel !== channel) {
        if (msg.user_id !== user?.id) {
          setUnread(p => p + 1);
        }
      }
    });

    return () => { socket.disconnect(); };
  }, []);

  useEffect(() => {
    if (open) {
      setUnread(0);
      if (!joinedRef.current.has(channel)) {
        joinedRef.current.add(channel);
        socketRef.current?.emit('chat:join', channel);
      }
    }
  }, [open, channel]);

  const handleJoinChannel = (ch: Channel) => {
    setChannel(ch);
    if (!joinedRef.current.has(ch)) {
      joinedRef.current.add(ch);
      socketRef.current?.emit('chat:join', ch);
    }
  };

  const sendMessage = () => {
    if (!input.trim() || !socketRef.current) return;
    socketRef.current.emit('chat:message', { channel, message: input.trim() });
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const currentMessages = messages[channel] || [];

  return (
    <>
      {/* Floating button */}
      <div className="fixed bottom-6 right-6 z-50">
        <AnimatePresence>
          {!open && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              onClick={() => setOpen(true)}
              className="w-14 h-14 rounded-2xl flex items-center justify-center relative shadow-2xl"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #38bdf8)',
                boxShadow: '0 8px 32px rgba(124,58,237,0.4)',
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <MessageCircle size={24} className="text-white" />
              {unread > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ background: '#ef4444' }}
                >
                  {unread > 9 ? '9+' : unread}
                </motion.span>
              )}
            </motion.button>
          )}
        </AnimatePresence>

        {/* Chat panel */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="absolute bottom-0 right-0 w-[380px] rounded-3xl overflow-hidden flex flex-col"
              style={{
                height: '520px',
                background: 'rgba(8,8,25,0.92)',
                backdropFilter: 'blur(40px) saturate(180%)',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
              }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-4 py-3 shrink-0"
                style={{
                  background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(56,189,248,0.2))',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <div className="flex items-center gap-2">
                  <MessageCircle size={16} style={{ color: '#a78bfa' }} />
                  <span className="font-semibold text-white text-sm">💬 {t('chat.title')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      {onlineUsers.length} {t('chat.online')}
                    </span>
                  </div>
                  <button
                    onClick={() => setOpen(false)}
                    className="w-7 h-7 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    <X size={14} style={{ color: 'rgba(255,255,255,0.6)' }} />
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div
                className="flex shrink-0"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
              >
                {(['global', 'support'] as Channel[]).map(ch => (
                  <button
                    key={ch}
                    onClick={() => handleJoinChannel(ch)}
                    className="flex-1 py-2.5 text-xs font-medium transition-all relative"
                    style={{ color: channel === ch ? '#a78bfa' : 'rgba(255,255,255,0.4)' }}
                  >
                    {ch === 'global' ? t('chat.global') : t('chat.support')}
                    {channel === ch && (
                      <motion.div
                        layoutId="chat-tab"
                        className="absolute bottom-0 left-0 right-0 h-0.5"
                        style={{ background: 'linear-gradient(90deg, #7c3aed, #38bdf8)' }}
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* Messages area */}
              <div className="flex flex-1 overflow-hidden min-h-0">
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {currentMessages.length === 0 && (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>
                        Žádné zprávy. Buďte první!
                      </p>
                    </div>
                  )}
                  {currentMessages.map((msg, i) => {
                    const isOwn = msg.user_id === user?.id;
                    return (
                      <motion.div
                        key={`${msg.id}-${i}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}
                      >
                        {/* Avatar */}
                        <div
                          className="w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                          style={{
                            background: `${ROLE_COLORS[msg.role] ?? '#94a3b8'}22`,
                            border: `1px solid ${ROLE_COLORS[msg.role] ?? '#94a3b8'}44`,
                          }}
                        >
                          {msg.username[0].toUpperCase()}
                        </div>
                        <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[75%]`}>
                          <div className={`flex items-center gap-1.5 mb-0.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
                            <RoleBadge role={msg.role} />
                            <span className="text-[11px] font-semibold" style={{ color: ROLE_COLORS[msg.role] ?? '#94a3b8' }}>
                              {msg.username}
                            </span>
                            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                              {formatTime(msg.created_at)}
                            </span>
                          </div>
                          <div
                            className="px-3 py-2 rounded-2xl text-xs leading-relaxed"
                            style={{
                              background: isOwn
                                ? 'linear-gradient(135deg, rgba(124,58,237,0.4), rgba(56,189,248,0.3))'
                                : 'rgba(255,255,255,0.06)',
                              border: `1px solid ${isOwn ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.08)'}`,
                              color: 'rgba(255,255,255,0.9)',
                              borderBottomRightRadius: isOwn ? '6px' : '16px',
                              borderBottomLeftRadius: isOwn ? '16px' : '6px',
                            }}
                          >
                            {msg.message}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Online users sidebar */}
                <div
                  className="w-[50px] shrink-0 overflow-y-auto pt-2 flex flex-col items-center gap-1.5"
                  style={{ borderLeft: '1px solid rgba(255,255,255,0.05)' }}
                >
                  {onlineUsers.slice(0, 12).map(u => (
                    <div
                      key={u.socketId}
                      className="relative"
                      title={`${u.username} (${u.role})`}
                    >
                      <div
                        className="w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold"
                        style={{
                          background: `${ROLE_COLORS[u.role] ?? '#94a3b8'}22`,
                          border: `1px solid ${ROLE_COLORS[u.role] ?? '#94a3b8'}44`,
                        }}
                      >
                        {u.username[0].toUpperCase()}
                      </div>
                      <div
                        className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[rgba(8,8,25,0.9)]"
                        style={{ background: '#22c55e' }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Input */}
              <div
                className="flex items-center gap-2 p-3 shrink-0"
                style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
              >
                <input
                  className="flex-1 px-3 py-2 rounded-xl text-sm text-white outline-none"
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.9)',
                  }}
                  placeholder={t('chat.placeholder')}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  maxLength={500}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim()}
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all disabled:opacity-40"
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed, #38bdf8)',
                  }}
                >
                  <Send size={14} className="text-white" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
