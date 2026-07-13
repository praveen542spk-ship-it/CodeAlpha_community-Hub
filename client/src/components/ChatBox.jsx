import { useState, useEffect, useRef } from 'react';
import { Send, Shield, Smile, UserCheck } from 'lucide-react';
import { encryptText, decryptText } from '../utils/crypto';
import API from '../utils/api';
import { motion } from 'framer-motion';

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '👏'];

function ChatBox({ socket, roomId, username, cryptoKey, activeParticipants }) {
  const [messages, setMessages] = useState(() => {
    try {
      const cached = localStorage.getItem(`chat-messages-${roomId}`);
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  });
  const [inputText, setInputText] = useState('');
  const [showEmojiPickerFor, setShowEmojiPickerFor] = useState(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Socket listener for new messages
    if (socket) {
      socket.on('message-received', async (data) => {
        const { sender, encryptedText: cyphertext, id, reactions, isSystem } = data;
        let plainText = '';
        if (isSystem) {
          plainText = cyphertext; // system messages are not encrypted
        } else if (cryptoKey) {
          plainText = await decryptText(cyphertext, cryptoKey);
        } else {
          plainText = '[Encrypted text]';
        }

        setMessages((prev) => [
          ...prev,
          { id, sender, text: plainText, reactions: reactions || [], isSystem }
        ]);
      });

      // Socket listener for reaction updates
      socket.on('reaction-updated', ({ messageId, reactions }) => {
        setMessages((prev) =>
          prev.map((msg) => (msg.id === messageId ? { ...msg, reactions } : msg))
        );
      });
    }

    return () => {
      if (socket) {
        socket.off('message-received');
        socket.off('reaction-updated');
      }
    };
  }, [socket, cryptoKey]);
  useEffect(() => {
    if (roomId && messages.length > 0) {
      localStorage.setItem(`chat-messages-${roomId}`, JSON.stringify(messages));
    }
  }, [messages, roomId]);
  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle Mentions autocomplete check
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputText(val);

    const words = val.split(' ');
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith('@')) {
      setShowMentions(true);
      setMentionQuery(lastWord.slice(1).toLowerCase());
    } else {
      setShowMentions(false);
    }
  };

  const selectMention = (user) => {
    const words = inputText.split(' ');
    words[words.length - 1] = `@${user.username} `;
    setInputText(words.join(' '));
    setShowMentions(false);
  };

  // Send message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    const cleanText = inputText.trim();
    if (!cleanText) return;

    const messageId = `${socket.id}-${Date.now()}`;
    let encryptedPayload = '';

    if (cryptoKey) {
      encryptedPayload = await encryptText(cleanText, cryptoKey);
    } else {
      encryptedPayload = cleanText;
    }

    const messageObj = {
      id: messageId,
      sender: username,
      text: cleanText,
      reactions: [],
      isSystem: false
    };

    // Append locally
    setMessages((prev) => [...prev, messageObj]);
    API.post('/stats/update', { messagesSentIncrement: 1 }).catch(() => {});

    // Send encrypted payload to peers
    if (socket) {
      socket.emit('send-message', {
        id: messageId,
        sender: username,
        encryptedText: encryptedPayload,
        reactions: [],
        isSystem: false
      });
    }

    setInputText('');
    setShowMentions(false);
  };

  // Add emoji reaction
  const handleAddReaction = (messageId, emoji) => {
    const targetMsg = messages.find((m) => m.id === messageId);
    if (!targetMsg) return;

    let updatedReactions = [...targetMsg.reactions];
    const existingIndex = updatedReactions.findIndex((r) => r.user === username && r.emoji === emoji);

    if (existingIndex !== -1) {
      // Toggle off
      updatedReactions.splice(existingIndex, 1);
    } else {
      // Add reaction
      updatedReactions.push({ user: username, emoji });
    }

    setMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, reactions: updatedReactions } : msg))
    );

    if (socket) {
      socket.emit('add-reaction', { messageId, reactions: updatedReactions });
    }
    setShowEmojiPickerFor(null);
  };

  // Filtered active participants list for @mentions
  const filteredUsers = activeParticipants
    ? activeParticipants.filter(
        (u) =>
          u.username !== username &&
          u.username.toLowerCase().includes(mentionQuery)
      )
    : [];

  return (
    <div className="flex flex-col h-full bg-[#0a0a19]/90 border border-white/5 rounded-2xl overflow-hidden relative">
      
      {/* Encryption Banner Header */}
      <div className="bg-purple-950/20 border-b border-white/5 py-3 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="text-purple-400" size={16} />
          <span className="text-xs font-semibold uppercase tracking-wider text-purple-300 font-display">
            End-to-End Encrypted (AES-256)
          </span>
        </div>
      </div>

      {/* Messages List Area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 no-scrollbar">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 gap-2 text-gray-500 font-sans">
            <span className="text-2xl">🔒</span>
            <p className="text-xs">Chat is empty. All messages are encrypted locally before transmission.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender === username;
            
            if (msg.isSystem) {
              return (
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 350, damping: 15 }}
                  key={msg.id} 
                  className="text-center text-xs text-purple-400/80 font-sans my-1 bg-purple-500/5 py-1 px-3 rounded-full border border-purple-500/10 self-center"
                >
                  {msg.text}
                </motion.div>
              );
            }

            return (
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 12 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 350, damping: 15 }}
                key={msg.id} 
                className={`flex flex-col max-w-[80%] ${isMe ? 'self-end items-end' : 'self-start items-start'}`}
              >
                {/* Username */}
                <span className="text-[10px] text-gray-400 font-semibold mb-1 font-display uppercase tracking-wider">
                  {msg.sender}
                </span>

                {/* Message pill */}
                <div className={`relative group px-4 py-2.5 rounded-2xl font-sans text-sm shadow-md ${
                  isMe 
                    ? 'bg-purple-600 text-white rounded-tr-none' 
                    : 'bg-white/5 border border-white/5 text-gray-200 rounded-tl-none'
                }`}>
                  <p className="break-words leading-relaxed">{msg.text}</p>
                  
                  {/* Emoji Picker toggle inside hover toolbar */}
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowEmojiPickerFor(showEmojiPickerFor === msg.id ? null : msg.id)}
                    className="absolute -top-3 -right-3 opacity-0 group-hover:opacity-100 transition p-1 bg-[#100f24] border border-white/10 rounded-full text-gray-400 hover:text-white cursor-pointer shadow-lg z-10"
                  >
                    <Smile size={12} />
                  </motion.button>

                  {/* Reaction Pick popup */}
                  {showEmojiPickerFor === msg.id && (
                    <div className="absolute -top-10 right-0 bg-[#100f24] border border-white/10 p-1.5 rounded-full flex gap-1 shadow-2xl z-20 animate-fade-in-up">
                      {EMOJIS.map((e) => (
                        <button
                          key={e}
                          onClick={() => handleAddReaction(msg.id, e)}
                          className="hover:scale-125 transition text-sm cursor-pointer p-0.5"
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Active reactions tags */}
                {msg.reactions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Array.from(new Set(msg.reactions.map((r) => r.emoji))).map((emoji) => {
                      const count = msg.reactions.filter((r) => r.emoji === emoji).length;
                      return (
                        <div
                          key={emoji}
                          className="px-2 py-0.5 bg-white/5 border border-white/5 rounded-full text-[10px] font-sans flex items-center gap-1 text-gray-300"
                        >
                          <span>{emoji}</span>
                          <span>{count}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* @Mentions list popup */}
      {showMentions && filteredUsers.length > 0 && (
        <div className="absolute bottom-[68px] left-4 right-4 bg-[#100f24] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-20 flex flex-col max-h-40 overflow-y-auto">
          {filteredUsers.map((user) => (
            <button
              key={user.socketId}
              onClick={() => selectMention(user)}
              className="px-4 py-2 text-left text-sm text-gray-200 hover:bg-purple-600 hover:text-white flex items-center gap-2 cursor-pointer font-sans"
            >
              <UserCheck size={14} className="text-purple-400" />
              <span>{user.username}</span>
            </button>
          ))}
        </div>
      )}

      {/* Input Message Area */}
      <form onSubmit={handleSendMessage} className="p-3 bg-white/5 border-t border-white/5 flex gap-2 items-center">
        <input
          type="text"
          value={inputText}
          onChange={handleInputChange}
          placeholder="Type encrypted message... Use @ for mentions"
          className="flex-1 px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 font-sans text-sm"
        />
        <motion.button
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.05 }}
          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          type="submit"
          className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-500/25 cursor-pointer transition flex items-center justify-center"
        >
          <Send size={16} />
        </motion.button>
      </form>
    </div>
  );
}

export default ChatBox;
