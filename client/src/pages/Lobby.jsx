import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Keyboard, Calendar, Plus, X, LogOut, CheckCircle, ShieldCheck, Mail, Users } from 'lucide-react';
import API from '../utils/api';
import { motion } from 'framer-motion';
import { Odometer, StampEffect, StaggerHeading } from '../components/BrutalistAnim';

const lobbyContainerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08
    }
  }
};

const lobbyCardVariants = {
  hidden: { scale: 0.8, opacity: 0 },
  visible: { 
    scale: 1, 
    opacity: 1, 
    transition: { type: 'spring', stiffness: 300, damping: 18 } 
  }
};

function Lobby({ user, logout }) {
  const [joinRoomId, setJoinRoomId] = useState('');
  const [scheduleData, setScheduleData] = useState({ scheduledAt: '', emails: [] });
  const [emailInput, setEmailInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [stats, setStats] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await API.get('/stats/me');
        setStats(res.data);
      } catch (err) {
        console.warn('Failed to load user stats:', err.message);
      }
    };
    fetchStats();
  }, []);
  // PWA Push Reminder scheduler
  useEffect(() => {
    let notifiedRooms = new Set();
    
    const checkUpcomingReminders = async () => {
      try {
        const res = await API.get('/room/upcoming');
        const upcomingRooms = res.data;
        
        const now = Date.now();
        upcomingRooms.forEach(room => {
          if (room.scheduledAt) {
            const scheduledTime = new Date(room.scheduledAt).getTime();
            const timeDiff = scheduledTime - now;
            
            const minutesLeft = timeDiff / 60000;
            if (minutesLeft > 0 && minutesLeft <= 5.1 && !notifiedRooms.has(room.roomId)) {
              notifiedRooms.add(room.roomId);
              
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Upcoming Meeting Reminder ⚡', {
                  body: `Your scheduled space ${room.roomId} starts in 5 minutes! Click here to join.`,
                  icon: '/favicon.svg',
                  tag: room.roomId
                }).onclick = () => {
                  window.focus();
                  navigate(`/room/${room.roomId}`);
                };
              }
            }
          }
        });
      } catch (err) {
        console.warn('Failed to fetch upcoming rooms for notifications:', err.message);
      }
    };

    checkUpcomingReminders();
    const interval = setInterval(checkUpcomingReminders, 30000);
    
    return () => clearInterval(interval);
  }, [navigate]);
  // Helper to generate secure random Room ID: xxx-xxx-xxx
  const generateRoomId = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const segment = () => Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    return `${segment()}-${segment()}-${segment()}`;
  };

  // Host/Create new meeting room
  const handleCreateRoom = async () => {
    setLoading(true);
    setErrorMsg('');
    const newRoomId = generateRoomId();

    try {
      await API.post('/room/create', { roomId: newRoomId });
      navigate(`/room/${newRoomId}`, { state: { isHost: true } });
    } catch (err) {
      setErrorMsg('Failed to create meeting room. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Validate format and existence, then join room
  const handleJoinRoom = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    const cleanId = joinRoomId.trim().toLowerCase();

    // Regex check format: xxx-xxx-xxx
    const roomRegex = /^[a-z0-9]{3}-[a-z0-9]{3}-[a-z0-9]{3}$/i;
    if (!roomRegex.test(cleanId)) {
      setErrorMsg("Invalid Space ID format! It must be in the format 'xxx-xxx-xxx' (e.g. abc-def-ghi).");
      return;
    }

    setLoading(true);
    try {
      const res = await API.get(`/room/validate/${cleanId}`);
      if (res.data.valid) {
        navigate(`/room/${cleanId}`, { state: { isHost: false } });
      } else {
        setErrorMsg('Space not found! This meeting code is invalid or the meeting has ended.');
      }
    } catch (err) {
      setErrorMsg('Error validating meeting room. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  // Add email tag to inviter list
  const handleAddEmail = (e) => {
    e.preventDefault();
    const email = emailInput.trim().toLowerCase();
    if (!email) return;

    // Simple regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }

    if (scheduleData.emails.includes(email)) {
      setErrorMsg('Email already added.');
      return;
    }

    setScheduleData({
      ...scheduleData,
      emails: [...scheduleData.emails, email],
    });
    setEmailInput('');
    setErrorMsg('');
  };

  // Remove email tag
  const handleRemoveEmail = (email) => {
    setScheduleData({
      ...scheduleData,
      emails: scheduleData.emails.filter((e) => e !== email),
    });
  };

  // Schedule meeting
  const handleScheduleRoom = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!scheduleData.scheduledAt) {
      setErrorMsg('Please select a scheduled date and time.');
      return;
    }

    setLoading(true);
    const newRoomId = generateRoomId();

    try {
      await API.post('/room/schedule', {
        roomId: newRoomId,
        scheduledAt: scheduleData.scheduledAt,
        emails: scheduleData.emails,
      });

      setSuccessMsg(`Space scheduled successfully! Space ID: ${newRoomId}`);
      setScheduleData({ scheduledAt: '', emails: [] });
    } catch (err) {
      setErrorMsg('Failed to schedule meeting room.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col z-10">
      {/* Header bar */}
      <header className="w-full glass py-4 px-6 md:px-12 flex justify-between items-center sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-purple-500/20">
            ⚡
          </div>
          <span className="text-xl font-bold font-display tracking-tight bg-gradient-to-r from-white via-gray-200 to-gray-400 bg-clip-text text-transparent">
            Communication Hub
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-2.5 px-4 py-2 bg-white/5 border border-white/10 rounded-xl">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-300 font-display">
              {user.username}
            </span>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            onClick={() => navigate('/analytics')}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600/20 border border-purple-500/30 text-purple-300 hover:bg-purple-600 hover:text-white rounded-xl text-xs font-semibold font-display cursor-pointer transition duration-300"
          >
            <span>📊</span>
            <span>Analytics</span>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            whileHover={{ scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-950/20 border border-red-800/30 text-red-400 font-semibold text-sm hover:bg-red-800/20 hover:text-white cursor-pointer transition duration-300"
          >
            <LogOut size={16} />
            <span>Logout</span>
          </motion.button>
        </div>
      </header>

      {/* Main dashboard content */}
      <motion.main 
        variants={lobbyContainerVariants}
        initial="hidden"
        animate="visible"
        className="flex-1 w-full max-w-7xl mx-auto px-6 py-8 md:py-12 flex flex-col md:grid md:grid-cols-5 gap-8"
      >
        {/* Left column: Actions */}
        <div className="md:col-span-3 flex flex-col gap-6">
          <motion.div 
            variants={lobbyCardVariants}
            className="glass rounded-3xl p-6 md:p-8 flex flex-col gap-6 shadow-xl"
          >
            <StaggerHeading text="Instant Meeting Space" className="text-2xl font-bold font-display text-white border-b border-white/5 pb-4">
              <Video className="text-purple-400 mr-3" size={24} />
            </StaggerHeading>

            {/* Error alerts */}
            {errorMsg && (
              <StampEffect className="bg-red-950/30 border border-red-800/50 text-red-400 px-4 py-3 rounded-xl text-sm font-sans flex items-center gap-2">
                <span className="font-bold">⚠️ Error:</span> {errorMsg}
              </StampEffect>
            )}

            {/* Success alerts */}
            {successMsg && (
              <StampEffect className="bg-emerald-950/30 border border-emerald-800/50 text-emerald-400 px-4 py-3 rounded-xl text-sm font-sans flex items-center gap-2">
                <CheckCircle size={18} className="flex-shrink-0" />
                <span>{successMsg}</span>
              </StampEffect>
            )}

            {/* Host Button */}
            <div className="flex flex-col gap-2">
              <p className="text-sm text-gray-400 font-sans">
                Start an instant collaborative meeting room and invite others by sharing your space code.
              </p>
              <motion.button
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.01 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                onClick={handleCreateRoom}
                disabled={loading}
                className="w-full sm:w-auto py-3.5 px-8 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold font-display shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
              >
                <Plus size={20} />
                <span>Host a Space</span>
              </motion.button>
            </div>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-white/5"></div>
              <span className="flex-shrink mx-4 text-xs font-bold uppercase tracking-widest text-gray-500 font-display">or</span>
              <div className="flex-grow border-t border-white/5"></div>
            </div>

            {/* Join Form */}
            <form onSubmit={handleJoinRoom} className="flex flex-col gap-3">
              <p className="text-sm text-gray-400 font-sans">
                Enter an existing space code below to join the call and whiteboard.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Keyboard className="absolute left-4 top-3.5 text-gray-500" size={18} />
                  <input
                    type="text"
                    required
                    value={joinRoomId}
                    onChange={(e) => setJoinRoomId(e.target.value)}
                    placeholder="Enter Space ID (e.g. abc-def-ghi)"
                    className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-sans text-center tracking-wide"
                  />
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.01 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  type="submit"
                  disabled={loading}
                  className="py-3 px-8 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold font-display border border-white/10 transition cursor-pointer disabled:opacity-50"
                >
                  Join Space
                </motion.button>
              </div>
            </form>
          </motion.div>

          {/* Core App Features Overview */}
          <motion.div 
            variants={lobbyCardVariants}
            className="glass rounded-3xl p-6 md:p-8 flex flex-col gap-6 shadow-xl"
          >
            <h3 className="text-xl font-bold font-display text-white flex items-center gap-2.5">
              <ShieldCheck className="text-purple-400" size={20} />
              Collaboration Features
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-sans text-sm text-gray-300">
              <div className="flex items-start gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                <span className="text-purple-400 font-bold text-lg">🔒</span>
                <div>
                  <h4 className="font-semibold text-white">E2EE Communication</h4>
                  <p className="text-xs text-gray-400">All text chats and file sharing transfers are fully encrypted.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                <span className="text-purple-400 font-bold text-lg">🎨</span>
                <div>
                  <h4 className="font-semibold text-white">Interactive Board</h4>
                  <p className="text-xs text-gray-400">Collaborative synced whiteboard with shapes, pens, and PNG exports.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                <span className="text-purple-400 font-bold text-lg">📁</span>
                <div>
                  <h4 className="font-semibold text-white">GridFS Files storage</h4>
                  <p className="text-xs text-gray-400">Upload/Download large files safely stored inside database storage.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                <span className="text-purple-400 font-bold text-lg">⏱️</span>
                <div>
                  <h4 className="font-semibold text-white">Breakout Spaces</h4>
                  <p className="text-xs text-gray-400">Hosts can split calls into separate breakout rooms dynamically.</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right column: Profile XP & Scheduling */}
        <div className="md:col-span-2 flex flex-col gap-6 font-sans">
          {/* Profile XP & Badge Gamification Card */}
          <motion.div 
            variants={lobbyCardVariants}
            className="glass rounded-3xl p-6 flex flex-col gap-5 shadow-xl"
          >
            <StaggerHeading text="Developer Hub XP" className="text-xl font-bold font-display text-white border-b border-white/5 pb-3">
              <span className="mr-2.5">🏆</span>
            </StaggerHeading>

            {stats ? (
              <div className="flex flex-col gap-4 font-sans text-sm">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white font-extrabold text-xl shadow-lg shadow-purple-500/30 animate-pulse">
                    <Odometer value={stats.xpPoints} /> <span className="text-[10px] ml-0.5">XP</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-white font-bold text-base">{user.username}</span>
                    <span className="text-xs text-purple-400 font-semibold font-display">Level <Odometer value={Math.floor(stats.xpPoints / 100) + 1} /> Member</span>
                  </div>
                </div>

                {/* Progress to next level */}
                <div className="flex flex-col gap-1 mt-1">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-gray-400 font-display">
                    <span>XP progress to level <Odometer value={Math.floor(stats.xpPoints / 100) + 2} /></span>
                    <span><Odometer value={stats.xpPoints % 100} /> / 100</span>
                  </div>
                  <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden border border-white/10">
                    <div className="bg-purple-500 h-full transition-all duration-500" style={{ width: `${stats.xpPoints % 100}%` }}></div>
                  </div>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-2 mt-1">
                  <div className="p-2.5 bg-white/5 border border-white/5 rounded-xl flex flex-col items-center">
                    <span className="text-gray-400 text-[10px] font-display font-bold uppercase">Meetings</span>
                    <span className="text-white font-bold font-mono text-base mt-1"><Odometer value={stats.meetingsAttended} /></span>
                  </div>
                  <div className="p-2.5 bg-white/5 border border-white/5 rounded-xl flex flex-col items-center">
                    <span className="text-gray-400 text-[10px] font-display font-bold uppercase">Speak Mins</span>
                    <span className="text-white font-bold font-mono text-base mt-1"><Odometer value={Math.floor(stats.speakingTimeSeconds / 60)} />m</span>
                  </div>
                  <div className="p-2.5 bg-[#0a0a19]/90 border border-white/5 rounded-xl flex flex-col items-center">
                    <span className="text-gray-400 text-[10px] font-display font-bold uppercase">Messages</span>
                    <span className="text-white font-bold font-mono text-base mt-1"><Odometer value={stats.messagesSentCount} /></span>
                  </div>
                </div>

                {/* Unlocked Badges list */}
                <div className="flex flex-col gap-2 mt-2">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-display font-sans">Unlocked Badges ({stats.badges.length})</h4>
                  {stats.badges.length === 0 ? (
                    <p className="text-[11px] text-gray-500 italic">Attend meetings or speak to unlock badges!</p>
                  ) : (
                    <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto no-scrollbar">
                      {stats.badges.map((b) => (
                        <div key={b.id} className="flex items-center gap-3 p-2 bg-purple-950/20 border border-purple-500/10 rounded-xl hover:border-purple-500/20 transition-all duration-300">
                          <span className="text-lg">{b.icon}</span>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-white font-display">{b.name}</span>
                            <span className="text-[10px] text-purple-300 leading-normal">{b.description}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-gray-400">Loading gamification stats...</p>
            )}
          </motion.div>

          {/* Schedule Meeting Panel */}
          <motion.div 
            variants={lobbyCardVariants}
            className="glass rounded-3xl p-6 md:p-8 flex flex-col gap-6 shadow-xl flex-1"
          >
            <StaggerHeading text="Schedule Meeting" className="text-2xl font-bold font-display text-white border-b border-white/5 pb-4">
              <Calendar className="text-purple-400 mr-3" size={24} />
            </StaggerHeading>

            <form onSubmit={handleScheduleRoom} className="flex flex-col gap-5 flex-1">
              {/* Date & Time Select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-gray-300 text-xs font-semibold uppercase tracking-wider font-display">Date & Time</label>
                <div className="relative">
                  <input
                    type="datetime-local"
                    required
                    value={scheduleData.scheduledAt}
                    onChange={(e) => setScheduleData({ ...scheduleData, scheduledAt: e.target.value })}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-sans"
                  />
                </div>
              </div>

              {/* Add email Invites */}
              <div className="flex flex-col gap-1.5">
                <label className="text-gray-300 text-xs font-semibold uppercase tracking-wider font-display">Invite Participants</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-4 top-3.5 text-gray-500" size={18} />
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      placeholder="participant@email.com"
                      className="w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-sans text-sm"
                    />
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    whileHover={{ scale: 1.05 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    onClick={handleAddEmail}
                    className="py-3 px-4 rounded-xl bg-purple-600/30 border border-purple-500/30 text-purple-300 hover:bg-purple-600 hover:text-white transition cursor-pointer flex items-center justify-center"
                  >
                    <Plus size={20} />
                  </motion.button>
                </div>
              </div>

              {/* Added emails tags lists */}
              {scheduleData.emails.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-gray-400 font-display uppercase tracking-wider flex items-center gap-1.5">
                    <Users size={14} /> Invitees ({scheduleData.emails.length})
                  </span>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1 bg-white/5 border border-white/5 rounded-xl">
                    {scheduleData.emails.map((email) => (
                      <div
                        key={email}
                        className="flex items-center gap-1.5 px-3 py-1 bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded-full text-xs font-sans"
                      >
                        <span>{email}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveEmail(email)}
                          className="hover:text-white text-purple-400 transition cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Submit schedule */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.01 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                type="submit"
                disabled={loading}
                className="w-full mt-auto py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold font-display shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Calendar size={18} />
                <span>Schedule & Send Invites</span>
              </motion.button>
            </form>
          </motion.div>
        </div>
      </motion.main>
    </div>
  );
}

export default Lobby;
