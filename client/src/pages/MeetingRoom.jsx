import { useEffect, useRef, useState } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { 
  Mic, MicOff, Video, VideoOff, Monitor, PhoneOff, Hand, 
  MessageSquare, Users, Edit, FileText, Settings, ShieldAlert,
  Volume2, VolumeX, UserX, Play, Square, Languages, Timer, CheckSquare,
  Smile, Download, LayoutGrid, ChevronRight, Sparkles, Code, QrCode,
  MoreVertical, Maximize, Minimize
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { deriveKey } from '../utils/crypto';
import API from '../utils/api';
import ChatBox from '../components/ChatBox';
import Whiteboard from '../components/Whiteboard';
import FileShare from '../components/FileShare';
import TaskBoard from '../components/TaskBoard';
import AgendaList from '../components/AgendaList';
import CodeTogether from '../components/CodeTogether';
import { AnimatePresence, motion } from 'framer-motion';
import { Odometer, ChunkyProgressBar, JitterText, MicWaveform, StampEffect } from '../components/BrutalistAnim';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '😮'];

function MeetingRoom({ user }) {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  // Socket & State
  const [lobbyActive, setLobbyActive] = useState(() => {
    return sessionStorage.getItem(`joined-${roomId}`) !== 'true';
  });
  const [socket, setSocket] = useState(null);
  const [isJoined, setIsJoined] = useState(() => {
    return sessionStorage.getItem(`joined-${roomId}`) === 'true';
  });
  const [isHost, setIsHost] = useState(() => {
    return sessionStorage.getItem(`isHost-${roomId}`) === 'true';
  });
  const [waitingStatus, setWaitingStatus] = useState('Connecting to room...');
  const [deniedMsg, setDeniedMsg] = useState('');
  
  // Media States
  const [micEnabled, setMicEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [sharingScreen, setSharingScreen] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [displayStream, setDisplayStream] = useState(null);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [permissionError, setPermissionError] = useState('');
  const [isInsecure, setIsInsecure] = useState(false);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [blockedMediaType, setBlockedMediaType] = useState('');

  // AI Co-pilot States
  const [transcript, setTranscript] = useState([]);
  const [showAICoPilot, setShowAICoPilot] = useState(false);
  const [aiMessages, setAiMessages] = useState([
    { role: 'assistant', text: "Hello! I am your AI Meeting Co-pilot. Ask me to 'summarize the discussion', check 'what did I miss?', or 'list action items'!" }
  ]);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showPostMeetingModal, setShowPostMeetingModal] = useState(false);
  const [actionItems, setActionItems] = useState([]);

  // Async Video Message States
  const [showVideoMsgModal, setShowVideoMsgModal] = useState(false);
  const [videoMsgRecording, setVideoMsgRecording] = useState(false);
  const [videoMsgURL, setVideoMsgURL] = useState(null);
  const [videoMsgBlob, setVideoMsgBlob] = useState(null);
  const [videoMessages, setVideoMessages] = useState([]);
  const [playingVideoMsg, setPlayingVideoMsg] = useState(null);

  // Fatigue Tracker States
  const [sessionMinutes, setSessionMinutes] = useState(0);
  const [todayMeetingMinutes, setTodayMeetingMinutes] = useState(0);
  const [showBreakToast, setShowBreakToast] = useState(false);
  const [ghostModeEnabled, setGhostModeEnabled] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [leftMeeting, setLeftMeeting] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);

  // Active call states
  const [peers, setPeers] = useState([]); // [{ id, username, stream, isHandRaised, networkQuality }]
  const [waitingList, setWaitingList] = useState([]); // [{ socketId, username }]
  const [handRaised, setHandRaised] = useState(false);
  
  // Sidebar Tabs
  const [activeTab, setActiveTab] = useState('chat'); // chat, participants, whiteboard, files, tasks, agenda

  // Cryptographic Key
  const [cryptoKey, setCryptoKey] = useState(null);

  // Extra features
  const [recording, setRecording] = useState(false);
  const [captionText, setCaptionText] = useState('');
  const [captionFeed, setCaptionFeed] = useState([]); // [{ sender, text }]
  const [showCaptions, setShowCaptions] = useState(false);

  // Floating reactions list state
  const [floatingReactions, setFloatingReactions] = useState([]); // [{ id, emoji, x }]

  // Breakout state
  const [inBreakout, setInBreakout] = useState(false);
  const [breakoutTimer, setBreakoutTimer] = useState(0);

  // Refs
  const localVideoRef = useRef(null);
  const peersRef = useRef({}); // peerId -> RTCPeerConnection
  const localStreamRef = useRef(null);
  const socketRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const videoMessageRecorderRef = useRef(null);
  const videoMessageChunksRef = useRef([]);
  const speechRecognitionRef = useRef(null);
  const ghostCanvasRef = useRef(null);
  const ghostAnimationIdRef = useRef(null);
  const audioAnalyserRef = useRef(null);
  const audioContextRef = useRef(null);
  const meetingLoggedRef = useRef(false);
  
  // Ref for TURN iceServers
  const iceServersRef = useRef(null);

  // Sync state values with refs to prevent closure stale states in socket listeners
  const micEnabledRef = useRef(micEnabled);
  const videoEnabledRef = useRef(videoEnabled);
  
  useEffect(() => {
    micEnabledRef.current = micEnabled;
  }, [micEnabled]);

  useEffect(() => {
    videoEnabledRef.current = videoEnabled;
  }, [videoEnabled]);

  // Insecure context warning check
  useEffect(() => {
    const secure = window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!secure) {
      setIsInsecure(true);
    }
  }, []);

  // Load E2EE Cryptographic Key on mount
  useEffect(() => {
    const initCrypto = async () => {
      const key = await deriveKey(roomId);
      setCryptoKey(key);
    };
    initCrypto();
  }, [roomId]);

  // Fetch secure TURN credentials from server on mount
  useEffect(() => {
    const fetchTurn = async () => {
      try {
        const res = await API.get('/room/turn-credentials');
        iceServersRef.current = res.data.iceServers;
        console.log('TURN credentials loaded successfully 🌐');
      } catch (err) {
        console.warn('Failed to load TURN credentials, using fallback STUN:', err.message);
      }
    };
    fetchTurn();
  }, []);

  // Ask AI helper
  const handleAskAI = async (e) => {
    if (e) e.preventDefault();
    if (!aiQuestion.trim()) return;

    const userMsg = { role: 'user', text: aiQuestion };
    setAiMessages((prev) => [...prev, userMsg]);
    const currentQuestion = aiQuestion;
    setAiQuestion('');
    setAiLoading(true);

    try {
      const res = await API.post('/ai/ask', {
        question: currentQuestion,
        transcript
      });
      setAiMessages((prev) => [...prev, { role: 'assistant', text: res.data.answer }]);
    } catch (err) {
      console.error('AI query failed:', err);
      setAiMessages((prev) => [...prev, { role: 'assistant', text: 'Error contacting AI co-pilot. Please check your connection.' }]);
    } finally {
      setAiLoading(false);
    }
  };

  const handleEndMeeting = async () => {
    if (isHost) {
      try {
        const participantsList = [
          { username: user.username, speakingTimeSeconds: 0 },
          ...peers.map((p) => ({ username: p.username, speakingTimeSeconds: 0 }))
        ];
        await API.post('/analytics/session/end', { roomId, participantsList });
      } catch (e) {
        console.warn('Failed to end meeting session on server:', e.message);
      }
    }

    if (transcript.length > 0) {
      setAiLoading(true);
      try {
        const res = await API.post('/ai/ask', {
          question: "list action items",
          transcript
        });
        
        const text = res.data.answer;
        const items = [];
        const lines = text.split('\n');
        lines.forEach(line => {
          if (line.trim().startsWith('-') || line.trim().startsWith('•') || line.trim().startsWith('*') || line.match(/^\d+\./)) {
            const clean = line.replace(/^[-•*\d.]+\s*/, '').trim();
            if (clean) {
              items.push({ task: clean, completed: false });
            }
          }
        });
        
        if (items.length === 0) {
          items.push({ task: 'Review meeting minutes and outline next steps', completed: false });
        }
        
        setActionItems(items);
        setShowPostMeetingModal(true);
      } catch (err) {
        console.error('Failed to get action items:', err);
        setActionItems([
          { task: 'Follow up on sprint checklist items', completed: false },
          { task: 'Sync with frontend team on local media integration', completed: false }
        ]);
        setShowPostMeetingModal(true);
      } finally {
        setAiLoading(false);
      }
    } else {
      leaveMeeting();
    }
  };

  // Fetch video messages left for this space on join (host only)
  useEffect(() => {
    if (isJoined && isHost) {
      const fetchVideoMessages = async () => {
        try {
          const res = await API.get(`/video-message/list/${roomId}`);
          setVideoMessages(res.data);
        } catch (err) {
          console.warn('Failed to load video messages:', err.message);
        }
      };
      fetchVideoMessages();
    }
  }, [isJoined, isHost, roomId]);
  // Fatigue Tracker Heartbeat loop (every 1 minute)
  useEffect(() => {
    if (!isJoined) return;

    const fetchTodayMinutes = async () => {
      try {
        const res = await API.get('/fatigue/today');
        setTodayMeetingMinutes(res.data.totalMinutes);
        if (res.data.totalMinutes >= 90) {
          setShowBreakToast(true);
        }
      } catch (err) {
        console.warn('Failed to fetch initial today minutes:', err.message);
      }
    };
    fetchTodayMinutes();

    const interval = setInterval(async () => {
      setSessionMinutes((prev) => {
        const nextSession = prev + 1;
        if (nextSession >= 90) {
          setShowBreakToast(true);
        }
        return nextSession;
      });

      try {
        const res = await API.post('/fatigue/heartbeat');
        const total = res.data.totalMinutes;
        setTodayMeetingMinutes(total);
        if (total >= 90) {
          setShowBreakToast(true);
        }
      } catch (err) {
        console.warn('Failed to send fatigue heartbeat:', err.message);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [isJoined]);
  // Gamification: Track active speaking time (every 5 seconds)
  useEffect(() => {
    if (!isJoined) return;

    const interval = setInterval(() => {
      if (micEnabled && audioAnalyserRef.current) {
        const dataArray = new Uint8Array(audioAnalyserRef.current.frequencyBinCount);
        audioAnalyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avgVolume = sum / dataArray.length;
        
        // Volume threshold to detect speaking vs background noise
        if (avgVolume > 15) {
          API.post('/stats/update', { speakingTimeIncrement: 5 }).catch(() => {});
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isJoined, micEnabled]);

  // Ghost Mode Privacy Avatar canvas stream generator helpers
  const setupAudioAnalyser = (stream) => {
    try {
      if (!stream || stream.getAudioTracks().length === 0) return;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      audioAnalyserRef.current = analyser;
    } catch (err) {
      console.warn('Could not setup audio analyser for Ghost Mode:', err.message);
    }
  };

  const drawGhostAvatar = () => {
    const canvas = ghostCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    let volume = 0;
    if (audioAnalyserRef.current) {
      const dataArray = new Uint8Array(audioAnalyserRef.current.frequencyBinCount);
      audioAnalyserRef.current.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      volume = sum / dataArray.length;
    }

    // Futuristic matrix style styling
    ctx.fillStyle = '#06040e';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = 'rgba(139, 92, 246, 0.05)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const centerX = width / 2;
    const centerY = height / 2;
    const pulseFactor = 1 + (volume / 255) * 0.45;

    ctx.shadowBlur = 25;
    ctx.shadowColor = 'rgba(124, 58, 237, 0.7)';

    // Shoulders
    ctx.beginPath();
    ctx.moveTo(centerX - 100 * pulseFactor, centerY + 120);
    ctx.quadraticCurveTo(centerX - 90 * pulseFactor, centerY + 50, centerX - 50 * pulseFactor, centerY + 40);
    ctx.lineTo(centerX + 50 * pulseFactor, centerY + 40);
    ctx.quadraticCurveTo(centerX + 90 * pulseFactor, centerY + 50, centerX + 100 * pulseFactor, centerY + 120);
    ctx.closePath();
    ctx.fillStyle = 'rgba(124, 58, 237, 0.15)';
    ctx.fill();
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Head
    ctx.beginPath();
    ctx.arc(centerX, centerY - 25, 45 * pulseFactor, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(79, 70, 229, 0.25)';
    ctx.fill();
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 4;
    ctx.stroke();

    // Cyber visor
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#60a5fa';
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX - 20 * pulseFactor, centerY - 25);
    ctx.lineTo(centerX + 20 * pulseFactor, centerY - 25);
    ctx.stroke();

    ctx.shadowBlur = 0;

    // Overlay code text
    ctx.fillStyle = 'rgba(168, 85, 247, 0.5)';
    ctx.font = '10px monospace';
    ctx.fillText("STATUS: GHOST ACTIVE", 20, 30);
    ctx.fillText(`VOLUME: ${Math.round(volume)}`, 20, 45);

    ghostAnimationIdRef.current = requestAnimationFrame(drawGhostAvatar);
  };

  const toggleGhostMode = async () => {
    const nextState = !ghostModeEnabled;
    setGhostModeEnabled(nextState);

    if (nextState) {
      if (!ghostCanvasRef.current) {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 480;
        ghostCanvasRef.current = canvas;
      }

      if (localStreamRef.current) {
        setupAudioAnalyser(localStreamRef.current);
      }

      drawGhostAvatar();

      const canvasStream = ghostCanvasRef.current.captureStream(30);
      const ghostVideoTrack = canvasStream.getVideoTracks()[0];

      if (localStreamRef.current) {
        const currentVideoTrack = localStreamRef.current.getVideoTracks()[0];
        if (currentVideoTrack) {
          currentVideoTrack.enabled = false;
        }

        setDisplayStream(canvasStream);

        Object.values(peersRef.current).forEach((pc) => {
          const senders = pc.getSenders();
          const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(ghostVideoTrack);
          }
        });
      }
    } else {
      if (ghostAnimationIdRef.current) {
        cancelAnimationFrame(ghostAnimationIdRef.current);
        ghostAnimationIdRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }

      if (localStreamRef.current) {
        const currentVideoTrack = localStreamRef.current.getVideoTracks()[0];
        if (currentVideoTrack) {
          currentVideoTrack.enabled = true;
          setDisplayStream(localStreamRef.current);

          Object.values(peersRef.current).forEach((pc) => {
            const senders = pc.getSenders();
            const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
            if (videoSender) {
              videoSender.replaceTrack(currentVideoTrack);
            }
          });
        }
      }
    }
  };

  // Browser Fullscreen toggle helpers
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Video message recording & upload helpers
  const initVideoMessageRecorder = async () => {
    let stream = localStreamRef.current;
    if (!stream) {
      stream = await initLocalMedia(true, true);
    }
    if (!stream) {
      alert('Camera and Microphone access is required to record a video message.');
      setShowVideoMsgModal(false);
      return;
    }
    setTimeout(() => {
      const previewEl = document.getElementById('video-msg-preview');
      if (previewEl) {
        previewEl.srcObject = stream;
      }
    }, 300);
  };

  const handleStartVideoMsgRecording = () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    videoMessageChunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    videoMessageRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        videoMessageChunksRef.current.push(e.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(videoMessageChunksRef.current, { type: 'video/webm' });
      setVideoMsgBlob(blob);
      const url = URL.createObjectURL(blob);
      setVideoMsgURL(url);

      const previewEl = document.getElementById('video-msg-preview');
      if (previewEl) {
        previewEl.srcObject = null;
        previewEl.src = url;
        previewEl.controls = true;
        previewEl.play();
      }
    };

    recorder.start();
    setVideoMsgRecording(true);
  };

  const handleStopVideoMsgRecording = () => {
    if (videoMessageRecorderRef.current && videoMsgRecording) {
      videoMessageRecorderRef.current.stop();
      setVideoMsgRecording(false);
    }
  };

  const handleUploadVideoMsg = async () => {
    if (!videoMsgBlob) return;

    const formData = new FormData();
    formData.append('video', videoMsgBlob, 'message.webm');
    formData.append('roomId', roomId);

    setAiLoading(true);
    try {
      await API.post('/video-message/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert('Video message uploaded successfully! The host has been notified.');
      setShowVideoMsgModal(false);
      setVideoMsgBlob(null);
      setVideoMsgURL(null);
    } catch (err) {
      console.error('Failed to upload video message:', err);
      alert('Upload failed. Please check your connection.');
    } finally {
      setAiLoading(false);
    }
  };

  // Auto restore connection if they were already joined (page refreshed)
  useEffect(() => {
    const wasJoined = sessionStorage.getItem(`joined-${roomId}`) === 'true';
    if (wasJoined) {
      startSocketConnection();
    }
  }, []);
  const fetchAuditLogs = async () => {
    try {
      const res = await API.get(`/audit/${roomId}`);
      setAuditLogs(res.data);
    } catch (err) {
      console.warn('Failed to load audit logs:', err.message);
    }
  };

  useEffect(() => {
    if (isHost && isJoined && activeTab === 'logs') {
      fetchAuditLogs();
    }
  }, [activeTab, isHost, isJoined]);


  // Keyboard Shortcuts (M = toggle mic, V = toggle video, S = screen share, H = raise hand)
  useEffect(() => {
    const handleShortcuts = (e) => {
      // Avoid triggering shortcuts if typing inside input boxes
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const key = e.code;
      if (key === 'KeyM') {
        e.preventDefault();
        toggleMic();
      } else if (key === 'KeyV') {
        e.preventDefault();
        toggleVideo();
      } else if (key === 'KeyS') {
        e.preventDefault();
        toggleScreenShare();
      } else if (key === 'KeyH') {
        e.preventDefault();
        toggleRaiseHand();
      } else if (key === 'KeyL') {
        e.preventDefault();
        handleEndMeeting();
      }
    };

    window.addEventListener('keydown', handleShortcuts);
    return () => window.removeEventListener('keydown', handleShortcuts);
  }, [micEnabled, videoEnabled, sharingScreen, handRaised]);

  // Helper to query camera and microphone permissions before prompting
  const checkMediaPermissions = async () => {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const camPermission = await navigator.permissions.query({ name: 'camera' });
        const micPermission = await navigator.permissions.query({ name: 'microphone' });
        return {
          camera: camPermission.state,
          microphone: micPermission.state
        };
      }
    } catch (err) {
      console.warn('Permissions query API not supported:', err.message);
    }
    return null;
  };

  // Delayed Socket.io connection, invoked only when clicking "Join Now" in Lobby
  const startSocketConnection = () => {
    const socketInstance = io('http://localhost:5000');
    setSocket(socketInstance);
    socketRef.current = socketInstance;

    const savedHost = sessionStorage.getItem(`isHost-${roomId}`) === 'true';
    const hostState = location.state?.isHost || savedHost;
    setIsHost(hostState);
    sessionStorage.setItem(`isHost-${roomId}`, hostState ? 'true' : 'false');

    // Initial Request to Join
    socketInstance.emit('request-join', { roomId, username: user.username, isHost: hostState });

    // Status callback
    socketInstance.on('waiting-room-state', ({ message }) => {
      setWaitingStatus(message);
    });

    // Approved to Join
    socketInstance.on('joined-room', async ({ isApproved, isHost: grantedHost, message }) => {
      if (isApproved) {
        setIsJoined(true);
        setIsHost(grantedHost);
        sessionStorage.setItem(`joined-${roomId}`, 'true');
        sessionStorage.setItem(`isHost-${roomId}`, grantedHost ? 'true' : 'false');
        if (grantedHost) {
          API.post('/analytics/session/start', { roomId }).catch(() => {});
        }
        if (!meetingLoggedRef.current) {
          meetingLoggedRef.current = true;
          API.post('/stats/update', { meetingAttendedIncrement: 1 }).catch(() => {});
        }
        await initLocalMedia(micEnabledRef.current, videoEnabledRef.current);
        socketInstance.emit('user-media-state', {
          micEnabled: micEnabledRef.current,
          videoEnabled: videoEnabledRef.current
        });
      } else {
        setDeniedMsg(message || 'Host denied your entry request.');
        sessionStorage.removeItem(`joined-${roomId}`);
        sessionStorage.removeItem(`isHost-${roomId}`);
        socketInstance.disconnect();
      }
    });

    // Host: Listen for join requests
    socketInstance.on('join-request', (data) => {
      setWaitingList((prev) => [...prev, data]);
    });

    // Host: Listen for waiting list updates
    socketInstance.on('waiting-list-update', (updatedList) => {
      setWaitingList(updatedList);
    });
    socketInstance.on('room-lock-state', ({ locked }) => {
      setIsLocked(locked);
    });

    socketInstance.on('audit-log-update', () => {
      if (hostState) {
        fetchAuditLogs();
      }
    });
    // WebRTC: Start handshake when joining room
    socketInstance.on('all-users', (usersList) => {
      usersList.forEach((u) => {
        const pc = createPeerConnection(u.socketId, u.username);
        peersRef.current[u.socketId] = pc;

        const tracks = [];
        if (displayStream) {
          const videoTrack = displayStream.getVideoTracks()[0];
          if (videoTrack) tracks.push(videoTrack);
        }
        if (localStreamRef.current) {
          const audioTrack = localStreamRef.current.getAudioTracks()[0];
          if (audioTrack) tracks.push(audioTrack);
        }
        tracks.forEach((track) => {
          pc.addTrack(track, localStreamRef.current);
        });

        socketInstance.emit('user-media-state', {
          micEnabled: micEnabledRef.current,
          videoEnabled: videoEnabledRef.current
        });

        pc.createOffer().then((offer) => {
          pc.setLocalDescription(offer).then(() => {
            socketInstance.emit('send-signal', {
              targetSocketId: u.socketId,
              signal: offer
            });
          });
        });
      });
    });

    // WebRTC: User joined
    socketInstance.on('user-joined', ({ socketId, username }) => {
      const pc = createPeerConnection(socketId, username);
      peersRef.current[socketId] = pc;

      const tracks = [];
      if (displayStream) {
        const videoTrack = displayStream.getVideoTracks()[0];
        if (videoTrack) tracks.push(videoTrack);
      }
      if (localStreamRef.current) {
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        if (audioTrack) tracks.push(audioTrack);
      }
      tracks.forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
      
      socketInstance.emit('user-media-state', {
        micEnabled: micEnabledRef.current,
        videoEnabled: videoEnabledRef.current
      });
    });

    // WebRTC: Receive handshakes (offer / answer / candidate)
    socketInstance.on('signal-received', ({ senderSocketId, signal }) => {
      let pc = peersRef.current[senderSocketId];
      if (!pc) return;

      if (signal.type === 'offer') {
        pc.setRemoteDescription(new RTCSessionDescription(signal)).then(() => {
          pc.createAnswer().then((answer) => {
            pc.setLocalDescription(answer).then(() => {
              socketInstance.emit('send-signal', {
                targetSocketId: senderSocketId,
                signal: answer
              });
            });
          });
        });
      } else if (signal.type === 'answer') {
        pc.setRemoteDescription(new RTCSessionDescription(signal)).catch(err => {
          console.error("Set remote description error:", err);
        });
      } else if (signal.candidate) {
        pc.addIceCandidate(new RTCIceCandidate(signal)).catch(err => {
          console.error("Add ICE candidate error:", err);
        });
      }
    });

    // Hand status state update
    socketInstance.on('user-hand-state', ({ socketId, isRaised }) => {
      setPeers((prev) =>
        prev.map((p) => (p.id === socketId ? { ...p, isHandRaised: isRaised } : p))
      );
    });

    // Emojis reaction sync
    socketInstance.on('reaction-received', ({ emoji }) => {
      triggerReaction(emoji);
    });

    // Force Mute from Host
    socketInstance.on('force-mute-mic', () => {
      if (localStreamRef.current) {
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = false;
          setMicEnabled(false);
          socketInstance.emit('user-media-state', { micEnabled: false, videoEnabled: videoEnabledRef.current });
        }
      }
    });

    // Force Disconnect from Host
    socketInstance.on('force-disconnect', () => {
      alert('You have been removed from the meeting by the host.');
      leaveMeeting();
    });

    // Breakout Assignments
    socketInstance.on('breakout-assigned', ({ subRoomId, durationMinutes }) => {
      handleJoinBreakout(subRoomId, durationMinutes);
    });

    // End Breakouts
    socketInstance.on('breakouts-ended', () => {
      handleReturnToMain();
    });

    // Captions feed sync
    socketInstance.on('caption-received', ({ sender, text }) => {
      setCaptionFeed((prev) => [...prev, { sender, text }].slice(-4));
      setTranscript((prev) => [...prev, { sender, text, timestamp: new Date() }]);
    });

    // Listen to remote peer media toggle state changes
    socketInstance.on('peer-media-state', ({ socketId, micEnabled, videoEnabled }) => {
      setPeers((prev) =>
        prev.map((p) => (p.id === socketId ? { ...p, micEnabled, videoEnabled } : p))
      );
    });

    // Peer disconnect
    socketInstance.on('user-left', (socketId) => {
      if (peersRef.current[socketId]) {
        peersRef.current[socketId].close();
        delete peersRef.current[socketId];
      }
      setPeers((prev) => prev.filter((p) => p.id !== socketId));
    });
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupMedia();
    };
  }, []);

  // Detect current browser based on userAgent
  const detectBrowser = () => {
    const ua = navigator.userAgent;
    if (ua.indexOf("Chrome") > -1 && ua.indexOf("Edg") === -1) return "chrome";
    if (ua.indexOf("Firefox") > -1) return "firefox";
    if (ua.indexOf("Edg") > -1) return "edge";
    if (ua.indexOf("Safari") > -1 && ua.indexOf("Chrome") === -1) return "safari";
    return "chrome";
  };

  // Background permission polling effect when warning modal is open
  useEffect(() => {
    if (!showBlockedModal) return;

    const interval = setInterval(async () => {
      try {
        if (navigator.permissions && navigator.permissions.query) {
          const camPerm = await navigator.permissions.query({ name: 'camera' });
          const micPerm = await navigator.permissions.query({ name: 'microphone' });

          const isCamGranted = camPerm.state === 'granted';
          const isMicGranted = micPerm.state === 'granted';

          if (
            (blockedMediaType === 'camera' && isCamGranted) ||
            (blockedMediaType === 'microphone' && isMicGranted) ||
            (blockedMediaType === 'both' && isCamGranted && isMicGranted)
          ) {
            setShowBlockedModal(false);
            clearInterval(interval);
            await initLocalMedia(isMicGranted, isCamGranted);
            if (socketRef.current) {
              socketRef.current.emit('user-media-state', {
                micEnabled: isMicGranted,
                videoEnabled: isCamGranted
              });
            }
          }
        }
      } catch (err) {
        console.warn('Polling permissions query failed:', err.message);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [showBlockedModal, blockedMediaType]);

  // Action button: Manually check permission status immediately
  const handleManualRecheck = async () => {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const camPerm = await navigator.permissions.query({ name: 'camera' });
        const micPerm = await navigator.permissions.query({ name: 'microphone' });

        const isCamGranted = camPerm.state === 'granted';
        const isMicGranted = micPerm.state === 'granted';

        if (
          (blockedMediaType === 'camera' && isCamGranted) ||
          (blockedMediaType === 'microphone' && isMicGranted) ||
          (blockedMediaType === 'both' && isCamGranted && isMicGranted)
        ) {
          setShowBlockedModal(false);
          await initLocalMedia(isMicGranted, isCamGranted);
          if (socketRef.current) {
            socketRef.current.emit('user-media-state', {
              micEnabled: isMicGranted,
              videoEnabled: isCamGranted
            });
          }
        } else {
          alert('Permissions are still blocked. Please allow them in browser settings.');
        }
      } else {
        const stream = await initLocalMedia();
        if (stream) {
          setShowBlockedModal(false);
        }
      }
    } catch (err) {
      console.warn('Manual recheck failed:', err.message);
    }
  };

  // Action button: Copy current URL to clipboard
  const handleCopyURL = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('Meeting link copied! You can paste it into browser settings if needed.');
  };

  // Initializing local user media stream
  const initLocalMedia = async (initialMicPref = true, initialCamPref = true) => {
    setPermissionError('');
    if (localStreamRef.current) {
      if (localVideoRef.current && localVideoRef.current.srcObject !== localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      return localStreamRef.current;
    }

    try {
      const perms = await checkMediaPermissions();
      if (perms && (perms.camera === 'denied' || perms.microphone === 'denied')) {
        console.warn('Browser permissions already blocked.');
        setVideoEnabled(false);
        setMicEnabled(false);
        return null;
      }

      // If both preferences are false, we don't call getUserMedia yet to prevent browser prompt spam!
      if (!initialMicPref && !initialCamPref) {
        setVideoEnabled(false);
        setMicEnabled(false);
        return null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: initialCamPref, 
        audio: initialMicPref 
      });
      setLocalStream(stream);
      setDisplayStream(stream);
      localStreamRef.current = stream;
      setupAudioAnalyser(stream);
      setVideoEnabled(initialCamPref);
      setMicEnabled(initialMicPref);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      console.error('Error fetching webcam stream:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionError('Camera and microphone access is required to join the call. Please grant permissions in your browser and click retry.');
        return null;
      }
      // Fallback to audio-only if webcam fails
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setLocalStream(audioStream);
        setDisplayStream(audioStream);
        localStreamRef.current = audioStream;
        setupAudioAnalyser(audioStream);
        setMicEnabled(true);
        setVideoEnabled(false);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = audioStream;
        }
        return audioStream;
      } catch (e) {
        console.error('Audio-only fallback error:', e);
        if (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError') {
          setPermissionError('Camera and microphone access is required to join the call. Please grant permissions in your browser and click retry.');
        }
        return null;
      }
    }
  };

  // Request camera and microphone access on component mount
  useEffect(() => {
    initLocalMedia();
  }, []);

  // Re-bind local stream when isJoined toggles and local video mounts
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isJoined]);

  // Setup RTCPeerConnection Mesh with Secure TURN Configuration
  const createPeerConnection = (socketId, username) => {
    const pc = new RTCPeerConnection({
      iceServers: iceServersRef.current || [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('send-signal', {
          targetSocketId: socketId,
          signal: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      setPeers((prev) => {
        const exists = prev.find((p) => p.id === socketId);
        if (exists) {
          return prev.map((p) => (p.id === socketId ? { ...p, stream: remoteStream } : p));
        }
        return [...prev, { id: socketId, username, stream: remoteStream, isHandRaised: false, networkQuality: 'good' }];
      });
    };

    // Periodically inspect peer connection quality stats
    const statsInterval = setInterval(async () => {
      if (pc.signalingState === 'closed') {
        clearInterval(statsInterval);
        return;
      }
      try {
        const stats = await pc.getStats();
        stats.forEach((report) => {
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            const lost = report.packetsLost || 0;
            const received = report.packetsReceived || 1;
            const lossRate = lost / (lost + received);

            let quality = 'good';
            if (lossRate > 0.08) quality = 'poor';
            else if (lossRate > 0.02) quality = 'fair';

            setPeers((prev) =>
              prev.map((p) => (p.id === socketId ? { ...p, networkQuality: quality } : p))
            );
          }
        });
      } catch (err) {
        clearInterval(statsInterval);
      }
    }, 6000);

    return pc;
  };

  const cleanupMedia = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    Object.values(peersRef.current).forEach((pc) => pc.close());
    peersRef.current = {};
    setPeers([]);
  };

  // Permissions API live status changes event listener
  useEffect(() => {
    let camStatus = null;
    let micStatus = null;

    const registerPermissionListeners = async () => {
      try {
        if (navigator.permissions && navigator.permissions.query) {
          camStatus = await navigator.permissions.query({ name: 'camera' });
          micStatus = await navigator.permissions.query({ name: 'microphone' });

          camStatus.onchange = async () => {
            console.log('Camera permission state changed live to:', camStatus.state);
            if (camStatus.state === 'granted') {
              setShowBlockedModal(false);
              await initLocalMedia(micEnabledRef.current, true);
              if (socketRef.current) {
                socketRef.current.emit('user-media-state', {
                  micEnabled: micEnabledRef.current,
                  videoEnabled: true
                });
              }
            } else if (camStatus.state === 'denied') {
              if (localStreamRef.current) {
                const track = localStreamRef.current.getVideoTracks()[0];
                if (track) {
                  track.stop();
                  localStreamRef.current.removeTrack(track);
                }
              }
              setVideoEnabled(false);
              if (socketRef.current) {
                socketRef.current.emit('user-media-state', {
                  micEnabled: micEnabledRef.current,
                  videoEnabled: false
                });
              }
            }
          };

          micStatus.onchange = async () => {
            console.log('Microphone permission state changed live to:', micStatus.state);
            if (micStatus.state === 'granted') {
              setShowBlockedModal(false);
              await initLocalMedia(true, videoEnabledRef.current);
              if (socketRef.current) {
                socketRef.current.emit('user-media-state', {
                  micEnabled: true,
                  videoEnabled: videoEnabledRef.current
                });
              }
            } else if (micStatus.state === 'denied') {
              if (localStreamRef.current) {
                const track = localStreamRef.current.getAudioTracks()[0];
                if (track) {
                  track.stop();
                  localStreamRef.current.removeTrack(track);
                }
              }
              setMicEnabled(false);
              if (socketRef.current) {
                socketRef.current.emit('user-media-state', {
                  micEnabled: false,
                  videoEnabled: videoEnabledRef.current
                });
              }
            }
          };
        }
      } catch (err) {
        console.warn('Browser does not support permission query change listening:', err.message);
      }
    };

    registerPermissionListeners();

    return () => {
      if (camStatus) camStatus.onchange = null;
      if (micStatus) micStatus.onchange = null;
    };
  }, []);

  const handleToggleMicWithPermissions = async () => {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const status = await navigator.permissions.query({ name: 'microphone' });
        if (status.state === 'denied') {
          setBlockedMediaType('microphone');
          setShowBlockedModal(true);
          return;
        }
      }
      await toggleMic();
    } catch (err) {
      await toggleMic();
    }
  };

  const handleToggleVideoWithPermissions = async () => {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const status = await navigator.permissions.query({ name: 'camera' });
        if (status.state === 'denied') {
          setBlockedMediaType('camera');
          setShowBlockedModal(true);
          return;
        }
      }
      await toggleVideo();
    } catch (err) {
      await toggleVideo();
    }
  };

  // Toggle Media handlers
  const toggleMic = async () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicEnabled(audioTrack.enabled);
      } else {
        // Request mic access if it was blocked/missing
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const newAudioTrack = stream.getAudioTracks()[0];
          if (newAudioTrack) {
            localStreamRef.current.addTrack(newAudioTrack);
            
            // Sync with all peers
            Object.values(peersRef.current).forEach((pc) => {
              const senders = pc.getSenders();
              const audioSender = senders.find((s) => s.track && s.track.kind === 'audio');
              if (audioSender) {
                audioSender.replaceTrack(newAudioTrack);
              } else {
                pc.addTrack(newAudioTrack, localStreamRef.current);
              }
            });
            
            setMicEnabled(true);
            console.log('Microphone track added successfully 🎙️');
          }
        } catch (err) {
          console.error('Failed to start microphone:', err);
          alert('Could not start microphone. Please check browser permission settings.');
        }
      }
    } else {
      await initLocalMedia();
    }
  };

  const toggleVideo = async () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      } else {
        // Request camera access if it was blocked/missing
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          const newVideoTrack = stream.getVideoTracks()[0];
          if (newVideoTrack) {
            localStreamRef.current.addTrack(newVideoTrack);
            
            // Sync with all peers
            Object.values(peersRef.current).forEach((pc) => {
              const senders = pc.getSenders();
              const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
              if (videoSender) {
                videoSender.replaceTrack(newVideoTrack);
              } else {
                pc.addTrack(newVideoTrack, localStreamRef.current);
              }
            });
            
            setVideoEnabled(true);
            
            // Re-bind to local video display
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = localStreamRef.current;
            }
            console.log('Camera track added successfully 📷');
          }
        } catch (err) {
          console.error('Failed to start camera:', err);
          alert('Could not start camera. Please check browser permission settings.');
        }
      }
    } else {
      await initLocalMedia();
    }
  };

  const toggleScreenShare = async () => {
    if (sharingScreen) {
      cleanupMedia();
      await initLocalMedia();
      setSharingScreen(false);
      socketRef.current?.emit('log-screen-share', { roomId, username: user.username, sharing: false });
      socketRef.current.emit('request-join', { roomId, username: user.username, isHost });
    } else {
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setDisplayStream(screen);
        setSharingScreen(true);
        socketRef.current?.emit('log-screen-share', { roomId, username: user.username, sharing: true });

        const screenTrack = screen.getVideoTracks()[0];
        Object.values(peersRef.current).forEach((pc) => {
          const senders = pc.getSenders();
          const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
          if (videoSender) {
            videoSender.replaceTrack(screenTrack);
          }
        });

        screenTrack.onended = () => {
          socketRef.current?.emit('log-screen-share', { roomId, username: user.username, sharing: false });
          toggleScreenShare();
        };
      } catch (err) {
        console.error('Error starting screen share:', err);
      }
    }
  };

  const toggleRaiseHand = () => {
    const nextState = !handRaised;
    setHandRaised(nextState);
    if (socketRef.current) {
      socketRef.current.emit('raise-hand', { isRaised: nextState });
    }
  };

  // Reaction Click
  const handleSendReaction = (emoji) => {
    triggerReaction(emoji);
    if (socketRef.current) {
      socketRef.current.emit('send-reaction', { emoji });
    }
  };

  const triggerReaction = (emoji) => {
    const id = Date.now() + Math.random();
    const x = 15 + Math.random() * 70; // random horizontal percentage offset
    setFloatingReactions((prev) => [...prev, { id, emoji, x }]);

    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2000); // cleanup after animation ends
  };

  // Host: Mute All Sockets
  const handleMuteAll = () => {
    if (socketRef.current && isHost) {
      socketRef.current.emit('mute-all-users');
    }
  };

  // Host: Kick user
  const handleKickUser = (targetSocketId) => {
    if (socketRef.current && isHost) {
      socketRef.current.emit('kick-user', { targetSocketId });
    }
  };

  // Host: Approve user entry
  const handleApprove = (targetSocketId) => {
    if (socketRef.current && isHost) {
      socketRef.current.emit('approve-user', { targetSocketId });
    }
  };

  // Host: Deny user entry
  const handleDeny = (targetSocketId) => {
    if (socketRef.current && isHost) {
      socketRef.current.emit('deny-user', { targetSocketId });
    }
  };

  // Host: Breakout Room split
  const handleTriggerBreakouts = () => {
    if (socketRef.current && isHost) {
      socketRef.current.emit('create-breakouts', { subRoomCount: 2, durationMinutes: 2 });
    }
  };

  // Breakouts assigned trigger
  const handleJoinBreakout = (subRoomId, durationMinutes) => {
    setInBreakout(true);
    setBreakoutTimer(durationMinutes * 60);

    cleanupMedia();
    initLocalMedia().then(() => {
      socketRef.current.emit('request-join', { roomId: subRoomId, username: user.username, isHost: false });
    });
  };

  const handleReturnToMain = () => {
    setInBreakout(false);
    setBreakoutTimer(0);

    cleanupMedia();
    initLocalMedia().then(() => {
      socketRef.current.emit('request-join', { roomId, username: user.username, isHost });
    });
  };

  // Local meeting recording
  const toggleRecording = () => {
    if (recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    } else {
      recordedChunksRef.current = [];
      const stream = displayStream;

      if (!stream) return;

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `meeting-record-${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
      };

      mediaRecorder.start();
      setRecording(true);
    }
  };

  // Speech Recognition Captions
  const toggleCaptions = () => {
    if (showCaptions) {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
      }
      setShowCaptions(false);
    } else {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert('Web Speech API is not supported in this browser.');
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        if (finalTranscript) {
          const cleanText = finalTranscript.trim();
          setTranscript((prev) => [...prev, { sender: user.username, text: cleanText, timestamp: new Date() }]);
          if (socketRef.current) {
            socketRef.current.emit('caption-broadcast', { sender: user.username, text: cleanText });
          }
          setCaptionText(cleanText);
        } else if (interimTranscript) {
          setCaptionText(interimTranscript.trim());
        }
      };

      recognition.start();
      speechRecognitionRef.current = recognition;
      setShowCaptions(true);
    }
  };

  // Compile PDF Meeting Summary Export
  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFont("Helvetica");
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(124, 58, 237); // purple
    doc.text("Communication Hub - Meeting Summary", 20, 20);
    
    // Space details
    doc.setFontSize(12);
    doc.setTextColor(80, 80, 80);
    doc.text(`Space ID: ${roomId}`, 20, 35);
    doc.text(`Role: ${isHost ? 'Host' : 'Participant'}`, 20, 42);
    doc.text(`Exported Date: ${new Date().toLocaleString()}`, 20, 49);
    
    doc.line(20, 56, 190, 56);
    
    // Info
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("Meeting Statistics:", 20, 68);
    
    doc.setFontSize(12);
    doc.text(`- Active Members present: ${peers.length + 1}`, 20, 78);
    doc.text(`- Security status: Verified E2EE (AES-256) encryption`, 20, 85);
    doc.text(`- Whiteboard status: Shared Canvas active`, 20, 92);
    
    doc.save(`meeting-summary-${roomId}.pdf`);
  };

  const leaveMeeting = () => {
    cleanupMedia();
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    sessionStorage.removeItem(`joined-${roomId}`);
    sessionStorage.removeItem(`isHost-${roomId}`);
    setIsJoined(false);
    setLeftMeeting(true);
  };

  return (
    <div className="min-h-screen w-full bg-[#040209] relative overflow-hidden font-sans">
      <AnimatePresence mode="wait">
        {leftMeeting ? (
          <motion.div
            key="leftMeeting"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="min-h-screen w-full flex items-center justify-center p-4 relative z-10"
          >
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>

            <div className="max-w-md w-full glass rounded-3xl p-8 flex flex-col items-center justify-center text-center gap-6 border border-white/10 shadow-2xl relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 text-2xl">
                👋
              </div>
              
              <div className="flex flex-col gap-1.5">
                <h2 className="text-2xl font-bold font-display text-white">You left the meeting</h2>
                <p className="text-gray-400 text-xs font-sans leading-relaxed">
                  Want to join back or return to the main dashboard?
                </p>
              </div>

              <div className="w-full flex flex-col gap-3">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.01 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  onClick={() => {
                    setLeftMeeting(false);
                    setLobbyActive(true);
                    initLocalMedia(micEnabled, videoEnabled);
                  }}
                  className="w-full py-3.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold font-display cursor-pointer transition shadow-lg shadow-purple-500/25"
                >
                  Rejoin Space
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.01 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  onClick={() => {
                    navigate('/');
                  }}
                  className="w-full py-3.5 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl text-xs font-bold font-display cursor-pointer transition"
                >
                  Return to Home
                </motion.button>
              </div>
            </div>
          </motion.div>
        ) : lobbyActive ? (
          <motion.div
            key="lobbyActive"
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: -90, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
            className="min-h-screen w-full flex items-center justify-center p-4 relative z-10"
          >
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] pointer-events-none"></div>
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] pointer-events-none"></div>

            <div className="max-w-4xl w-full glass rounded-3xl p-8 flex flex-col md:flex-row items-center gap-8 border border-white/10 shadow-2xl relative z-10">
              <div className="flex-grow w-full aspect-video rounded-2xl border border-white/10 overflow-hidden bg-black/60 relative shadow-inner">
                {videoEnabled && localStream ? (
                  <video
                    id="lobby-preview-video"
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover mirrored"
                    ref={(el) => {
                      if (el && localStream) el.srcObject = localStream;
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-purple-950/20 backdrop-blur-md">
                    <div className="w-20 h-20 rounded-full bg-purple-600 border-2 border-purple-400 flex items-center justify-center text-white text-3xl font-bold font-display shadow-lg shadow-purple-500/25 animate-pulse">
                      {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <span className="text-xs text-gray-400 mt-4 font-medium">Camera is Off</span>
                  </div>
                )}

                {!localStream && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-center p-4 gap-2">
                    <VideoOff className="text-gray-500" size={32} />
                    <span className="text-xs text-gray-300 font-semibold font-display">No Camera/Mic Access</span>
                    <span className="text-[10px] text-gray-500 max-w-[220px] leading-relaxed">
                      Permissions blocked or webcam not found. You can still join with camera/mic disabled.
                    </span>
                  </div>
                )}
              </div>

              <div className="w-full md:w-80 flex flex-col gap-6 justify-center">
                <div className="flex flex-col gap-1.5">
                  <h2 className="text-2xl font-bold text-white font-display">Ready to Join?</h2>
                  <p className="text-xs text-gray-400 leading-relaxed font-sans">
                    Space ID: <span className="text-purple-400 font-mono font-bold tracking-wider">{roomId}</span>
                  </p>
                </div>

                <div className="flex gap-4">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    onClick={async () => {
                      const nextCam = !videoEnabled;
                      setVideoEnabled(nextCam);
                      if (nextCam && !localStream) {
                        await initLocalMedia(micEnabled, true);
                      } else if (localStream) {
                        const track = localStream.getVideoTracks()[0];
                        if (track) track.enabled = nextCam;
                      }
                    }}
                    className={`flex-1 py-3 rounded-xl border flex items-center justify-center gap-2 cursor-pointer transition text-xs font-bold font-display ${
                      videoEnabled
                        ? 'bg-purple-600/20 border-purple-500/35 text-purple-300 hover:bg-purple-600/30'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {videoEnabled ? <Video size={16} /> : <VideoOff size={16} />}
                    <span>Camera {videoEnabled ? 'On' : 'Off'}</span>
                  </motion.button>

                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    whileHover={{ scale: 1.02 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    onClick={async () => {
                      const nextMic = !micEnabled;
                      setMicEnabled(nextMic);
                      if (nextMic && !localStream) {
                        await initLocalMedia(true, videoEnabled);
                      } else if (localStream) {
                        const track = localStream.getAudioTracks()[0];
                        if (track) track.enabled = nextMic;
                      }
                    }}
                    className={`flex-1 py-3 rounded-xl border flex items-center justify-center gap-2 cursor-pointer transition text-xs font-bold font-display ${
                      micEnabled
                        ? 'bg-purple-600/20 border-purple-500/35 text-purple-300 hover:bg-purple-600/30'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {micEnabled ? <Mic size={16} /> : <MicOff size={16} />}
                    <span>Mic {micEnabled ? 'On' : 'Off'}</span>
                  </motion.button>
                </div>

                <motion.button
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.01 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  onClick={() => {
                    setLobbyActive(false);
                    startSocketConnection();
                  }}
                  className="w-full py-3.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold font-display shadow-lg shadow-purple-500/25 cursor-pointer transition duration-300"
                >
                  Join Now
                </motion.button>
              </div>
            </div>
          </motion.div>
        ) : permissionError ? (
          <motion.div
            key="permissionError"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="min-h-screen w-full flex items-center justify-center p-4 relative z-10 font-sans"
          >
            <div className="max-w-md w-full glass rounded-3xl p-8 flex flex-col items-center justify-center text-center gap-6">
              <ShieldAlert className="text-red-400" size={48} />
              <h2 className="text-2xl font-bold font-display text-white">Permissions Required</h2>
              <p className="text-gray-400 text-sm">{permissionError}</p>
              <motion.button
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.01 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                onClick={initLocalMedia}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-xs cursor-pointer transition shadow-lg shadow-purple-500/25"
              >
                Grant Access & Retry
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.01 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                onClick={() => navigate('/')}
                className="w-full py-3 bg-white/5 hover:bg-white/10 text-white text-xs border border-white/10 rounded-xl cursor-pointer transition"
              >
                Back to Lobby
              </motion.button>
            </div>
          </motion.div>
        ) : deniedMsg ? (
          <motion.div
            key="deniedMsg"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="min-h-screen w-full flex items-center justify-center p-4 relative z-10 font-sans"
          >
            <div className="max-w-md w-full glass rounded-3xl p-8 flex flex-col items-center justify-center text-center gap-6">
              <ShieldAlert className="text-red-400" size={48} />
              <h2 className="text-2xl font-bold font-display text-white">Entry Denied</h2>
              <p className="text-gray-400 text-sm">{deniedMsg}</p>
              <motion.button
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.01 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                onClick={() => navigate('/')}
                className="px-6 py-2.5 bg-white/10 hover:bg-white/15 text-white font-bold border border-white/10 rounded-xl cursor-pointer"
              >
                Back to Lobby
              </motion.button>
            </div>
          </motion.div>
        ) : !isJoined ? (
          <motion.div
            key="connecting"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="min-h-screen w-full flex items-center justify-center p-4 relative z-10 font-sans"
          >
            <div className="max-w-md w-full glass rounded-3xl p-8 flex flex-col items-center justify-center text-center gap-6">
              <ChunkyProgressBar label="Waiting Room" />
              <JitterText text={waitingStatus} />
              <motion.button
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.01 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                onClick={() => navigate('/')}
                className="px-6 py-2.5 bg-red-950/20 border border-red-800/30 text-red-400 rounded-xl font-bold text-xs hover:bg-red-800/20 cursor-pointer"
              >
                Cancel Join
              </motion.button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="room"
            initial={{ rotateY: 90, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            exit={{ rotateY: -90, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
            className="h-screen w-full flex flex-col z-10 overflow-hidden relative font-sans"
          >
      {/* Insecure context warning banner */}
      {isInsecure && (
        <div className="w-full bg-red-600 text-white text-xs text-center py-2 font-semibold font-sans flex items-center justify-center gap-2 z-50">
          <ShieldAlert size={14} />
          <span>Warning: Running on an insecure context (HTTP). Camera & Microphone access will be blocked by the browser. Please use HTTPS or localhost.</span>
        </div>
      )}
      
      {/* Header bar */}
      <div className="w-full glass py-3 px-6 flex justify-between items-center border-b border-white/5 z-20">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-400 font-display">
            📍 Space ID: <span className="text-purple-400 font-bold font-mono tracking-wider">{roomId}</span>
          </span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(roomId);
              alert('Space code copied to clipboard!');
            }}
            className="py-1 px-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-lg text-[10px] font-bold font-display cursor-pointer"
          >
            Copy Code
          </button>
          
          <button
            onClick={() => {
              setShowInviteModal(true);
            }}
            className="py-1 px-2.5 bg-purple-600/10 border border-purple-500/20 hover:bg-purple-600/20 text-purple-300 rounded-lg text-[10px] font-bold font-display cursor-pointer transition flex items-center gap-1.5"
            title="Show Join QR Code"
          >
            <QrCode size={12} />
            <span>QR Code</span>
          </button>
          
          {/* Export PDF Button */}
          <button
            onClick={handleExportPDF}
            className="py-1 px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[10px] font-bold font-display cursor-pointer flex items-center gap-1"
          >
            <Download size={10} /> Export Summary
          </button>
        </div>

        {inBreakout && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded-full text-xs font-semibold font-display">
            <Timer size={14} className="animate-pulse" />
            <span>Breakout active</span>
          </div>
        )}

        <div className="text-sm font-semibold text-gray-300 font-display">
          👥 Active Members: <span className="bg-purple-500/15 border border-purple-500/25 text-purple-300 px-2 py-0.5 rounded-full text-xs ml-1.5"><Odometer value={peers.length + 1} /></span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 w-full flex flex-col md:flex-row min-h-0 overflow-hidden">
        
        {/* Left column: Video streams */}
        <div className="flex-1 flex flex-col p-4 gap-4 min-h-0 relative">
          
          {/* Leave a Video Message Banner when no one is present */}
          {peers.length === 0 && !isHost && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-purple-950/80 border border-purple-500/35 px-6 py-3 rounded-2xl flex items-center gap-4 shadow-2xl z-20 animate-fade-in-up backdrop-blur-md">
              <span className="text-xs text-purple-200 font-sans">
                👥 No one has joined yet. Would you like to leave a video message for the host?
              </span>
              <button
                onClick={() => {
                  setShowVideoMsgModal(true);
                  initVideoMessageRecorder();
                }}
                className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-[10px] font-bold font-display cursor-pointer transition"
              >
                Leave Message
              </button>
            </div>
          )}

          {/* Floating reactions overlay inside stream area */}
          <AnimatePresence>
            {floatingReactions.map((r) => (
              <motion.div
                key={r.id}
                initial={{ y: 0, opacity: 0, scale: 0, rotate: 0 }}
                animate={{ 
                  y: -300, 
                  opacity: [0, 1, 1, 0],
                  scale: [0, 1.2, 1, 1],
                  rotate: [0, Math.random() > 0.5 ? 18 : -18, Math.random() > 0.5 ? 20 : -20]
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
                className="absolute bottom-20 text-4xl select-none z-50 pointer-events-none"
                style={{ left: `${r.x}%` }}
              >
                {r.emoji}
              </motion.div>
            ))}
          </AnimatePresence>

          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto no-scrollbar relative">
            {/* Local feed */}
            {displayStream && (
              <motion.div 
                layout
                animate={activeSpeaker === user.username ? {
                  rotate: [-1.5, 1.5, -1.5, 1.5, 0],
                  scale: [1, 1.02, 1]
                } : { rotate: 0, scale: 1 }}
                transition={{ duration: 0.15 }}
                className={`relative rounded-2xl border overflow-hidden bg-black/60 aspect-video transition-all ${
                  activeSpeaker === user.username 
                    ? 'border-4 border-yellow-400 shadow-[4px_4px_0px_0px_#000]' 
                    : 'border-white/10'
                } ${sharingScreen ? 'unmirrored' : 'mirrored'}`}
              >
                <video 
                  ref={localVideoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className={`w-full h-full object-cover ${videoEnabled ? 'block' : 'hidden'}`}
                />

                {/* Local avatar card when camera is off */}
                {!videoEnabled && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-purple-950/40 backdrop-blur-md">
                    <div className="w-16 h-16 rounded-full bg-purple-600 border-2 border-purple-400 flex items-center justify-center text-white text-xl font-bold font-display shadow-lg shadow-purple-500/25">
                      {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
                    </div>
                  </div>
                )}

                {/* Warning overlay if camera is blocked/audio fallback */}
                {localStream && localStream.getVideoTracks().length === 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-center p-4 gap-2">
                    <VideoOff className="text-red-400 animate-pulse" size={32} />
                    <span className="text-xs text-gray-200 font-semibold font-display">Camera Blocked / Audio Only</span>
                    <span className="text-[9px] text-gray-400 max-w-[220px] leading-relaxed">
                      Ensure your webcam is not in-use by Zoom, Teams, or another tab, and browser permissions are granted.
                    </span>
                  </div>
                )}
                
                <div className="absolute bottom-4 left-4 bg-[#0a0a19]/75 border border-white/10 py-1.5 px-3 rounded-xl flex items-center gap-2 text-xs font-semibold text-white font-display">
                  <span>👤</span> {user.username} (You)
                  {!micEnabled && <MicOff size={12} className="text-red-400" />}
                </div>

                {handRaised && (
                  <div className="absolute top-4 right-4 p-2 bg-yellow-500 rounded-full text-black shadow-lg animate-bounce">
                    <Hand size={14} />
                  </div>
                )}
              </motion.div>
            )}

            {/* Remote feeds */}
            <AnimatePresence>
              {peers.map((p) => (
                <motion.div 
                  key={p.id}
                  layout
                  initial={{ rotate: -8, y: -20, opacity: 0, scale: 0.9 }}
                  animate={activeSpeaker === p.username ? {
                    rotate: [-1.5, 1.5, -1.5, 1.5, 0],
                    scale: [1, 1.02, 1],
                    opacity: 1,
                    y: 0
                  } : { rotate: 0, scale: 1, opacity: 1, y: 0 }}
                  exit={{ rotateY: 90, opacity: 0, transition: { duration: 0.3 } }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  style={{ transformStyle: 'preserve-3d', backfaceVisibility: 'hidden' }}
                  className={`relative rounded-2xl border overflow-hidden bg-black/60 aspect-video unmirrored transition-all ${
                    activeSpeaker === p.username 
                      ? 'border-4 border-yellow-400 shadow-[4px_4px_0px_0px_#000]' 
                      : 'border-white/5'
                  }`}
                >
                  <video
                    ref={(el) => {
                      if (el && p.stream) el.srcObject = p.stream;
                    }}
                    autoPlay
                    playsInline
                    muted={speakerMuted}
                    className={`w-full h-full object-cover ${p.videoEnabled !== false ? 'block' : 'hidden'}`}
                  />

                  {/* Remote initials avatar card when camera is off */}
                  {p.videoEnabled === false && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-purple-950/40 backdrop-blur-md">
                      <div className="w-16 h-16 rounded-full bg-purple-600 border-2 border-purple-400 flex items-center justify-center text-white text-xl font-bold font-display shadow-lg shadow-purple-500/25">
                        {p.username ? p.username.charAt(0).toUpperCase() : 'U'}
                      </div>
                    </div>
                  )}

                  <div className="absolute bottom-4 left-4 bg-[#0a0a19]/75 border border-white/10 py-1.5 px-3 rounded-xl flex items-center gap-2 text-xs font-semibold text-white font-display">
                    <span>👤</span> {p.username}
                    <span className={`w-2 h-2 rounded-full ${
                      p.networkQuality === 'good' ? 'bg-emerald-500' : p.networkQuality === 'fair' ? 'bg-yellow-500' : 'bg-red-500'
                    }`} title={`Network Quality: ${p.networkQuality}`}></span>
                  </div>

                  {isHost && (
                    <button
                      onClick={() => handleKickUser(p.id)}
                      className="absolute top-4 left-4 p-1.5 rounded-lg bg-red-950/40 border border-red-800/40 text-red-400 hover:bg-red-600 hover:text-white transition cursor-pointer"
                    >
                      <UserX size={14} />
                    </button>
                  )}

                  {p.isHandRaised && (
                    <div className="absolute top-4 right-4 p-2 bg-yellow-500 rounded-full text-black shadow-lg animate-bounce">
                      <Hand size={14} />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Scrolling speech captions */}
          {showCaptions && (captionText || captionFeed.length > 0) && (
            <div className="w-full bg-[#0a0a19]/80 border border-purple-500/20 py-2.5 px-4 rounded-xl text-center text-xs font-sans text-purple-300">
              {captionFeed.map((feed, idx) => (
                <p key={idx} className="mb-0.5"><strong>{feed.sender}:</strong> {feed.text}</p>
              ))}
              {captionText && <p className="animate-pulse"><strong>You:</strong> {captionText}</p>}
            </div>
          )}

          {/* Draggable control bar */}
          <div className="w-full glass py-3 px-6 rounded-2xl flex items-center justify-between border border-white/5 flex-shrink-0 gap-4">
            
            {/* Quick Emojis reactions panel */}
            <div className="flex gap-1 bg-white/5 p-1 rounded-xl border border-white/5">
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleSendReaction(emoji)}
                  className="hover:scale-125 transition text-base p-1.5 cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Standard Media Actions */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-white/5 rounded-xl border border-white/5 pr-1">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  onClick={handleToggleMicWithPermissions}
                  className={`p-3 rounded-xl cursor-pointer transition ${
                    micEnabled ? 'bg-transparent text-white' : 'bg-red-600 text-white rounded-r-none'
                  }`}
                  title="Mute Mic [M]"
                >
                  {micEnabled ? <Mic size={18} /> : <MicOff size={18} />}
                </motion.button>
                {micEnabled && (
                  <MicWaveform analyser={audioAnalyserRef.current} micEnabled={micEnabled} />
                )}
              </div>

              <motion.button
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                onClick={handleToggleVideoWithPermissions}
                className={`p-3 rounded-xl cursor-pointer transition ${
                  videoEnabled ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-red-600 text-white'
                }`}
                title="Stop Video [V]"
              >
                {videoEnabled ? <Video size={18} /> : <VideoOff size={18} />}
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                onClick={toggleScreenShare}
                className={`p-3 rounded-xl cursor-pointer transition ${
                  sharingScreen ? 'bg-purple-600 text-white' : 'bg-white/5 hover:bg-white/10 text-white'
                }`}
                title="Share Screen [S]"
              >
                <Monitor size={18} />
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.02 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                onClick={toggleRaiseHand}
                className={`p-3 rounded-xl cursor-pointer transition ${
                  handRaised ? 'bg-yellow-500 text-black' : 'bg-white/5 hover:bg-white/10 text-white'
                }`}
                title="Raise Hand [H]"
              >
                <Hand size={18} />
              </motion.button>

              {/* More options 3-dot menu button */}
              <div className="relative">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  className={`p-3 rounded-xl cursor-pointer transition ${
                    showMoreMenu ? 'bg-purple-600 text-white' : 'bg-white/5 hover:bg-white/10 text-white'
                  }`}
                  title="More Options"
                >
                  <MoreVertical size={18} />
                </motion.button>

                {showMoreMenu && (
                  <div className="absolute bottom-16 right-0 w-56 glass border border-white/10 rounded-2xl p-2.5 flex flex-col gap-1.5 shadow-2xl z-50 animate-fade-in-up">
                    
                    {/* Full Screen option */}
                    <button
                      onClick={() => {
                        toggleFullscreen();
                        setShowMoreMenu(false);
                      }}
                      className="w-full px-3 py-2 hover:bg-white/5 text-gray-300 hover:text-white rounded-lg transition text-xs font-semibold font-display flex items-center gap-2.5 cursor-pointer text-left"
                    >
                      {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
                      <span>{isFullscreen ? 'Exit Full Screen' : 'Full Screen'}</span>
                    </button>

                    {/* Captions */}
                    <button
                      onClick={() => {
                        toggleCaptions();
                        setShowMoreMenu(false);
                      }}
                      className={`w-full px-3 py-2 rounded-lg transition text-xs font-semibold font-display flex items-center gap-2.5 cursor-pointer text-left ${
                        showCaptions ? 'bg-purple-600/10 text-purple-300' : 'hover:bg-white/5 text-gray-300 hover:text-white'
                      }`}
                    >
                      <Languages size={14} />
                      <span>Live Captions</span>
                    </button>

                    {/* Record */}
                    <button
                      onClick={() => {
                        toggleRecording();
                        setShowMoreMenu(false);
                      }}
                      className={`w-full px-3 py-2 rounded-lg transition text-xs font-semibold font-display flex items-center gap-2.5 cursor-pointer text-left ${
                        recording ? 'bg-red-600/10 text-red-400' : 'hover:bg-white/5 text-gray-300 hover:text-white'
                      }`}
                    >
                      {recording ? <Square size={14} className="text-red-400" /> : <Play size={14} />}
                      <span>{recording ? 'Stop Recording' : 'Record Meeting'}</span>
                    </button>

                    {/* Speaker */}
                    <button
                      onClick={() => {
                        setSpeakerMuted(!speakerMuted);
                        setShowMoreMenu(false);
                      }}
                      className={`w-full px-3 py-2 rounded-lg transition text-xs font-semibold font-display flex items-center gap-2.5 cursor-pointer text-left ${
                        speakerMuted ? 'bg-red-600/10 text-red-400' : 'hover:bg-white/5 text-gray-300 hover:text-white'
                      }`}
                    >
                      {speakerMuted ? <VolumeX size={14} className="text-red-400" /> : <Volume2 size={14} />}
                      <span>{speakerMuted ? 'Unmute Speaker' : 'Mute Speaker'}</span>
                    </button>

                    {/* Ghost Mode */}
                    <button
                      onClick={() => {
                        toggleGhostMode();
                        setShowMoreMenu(false);
                      }}
                      className={`w-full px-3 py-2 rounded-lg transition text-xs font-semibold font-display flex items-center gap-2.5 cursor-pointer text-left ${
                        ghostModeEnabled ? 'bg-purple-600/10 text-purple-300' : 'hover:bg-white/5 text-gray-300 hover:text-white'
                      }`}
                    >
                      <span className="text-sm">👻</span>
                      <span>Ghost Mode</span>
                    </button>

                    {/* Participants panel */}
                    <button
                      onClick={() => {
                        setActiveTab(activeTab === 'people' ? 'chat' : 'people');
                        setShowMoreMenu(false);
                      }}
                      className={`w-full px-3 py-2 rounded-lg transition text-xs font-semibold font-display flex items-center gap-2.5 cursor-pointer text-left ${
                        activeTab === 'people' ? 'bg-purple-600/10 text-purple-300' : 'hover:bg-white/5 text-gray-300 hover:text-white'
                      }`}
                    >
                      <Users size={14} />
                      <span>Participants</span>
                    </button>

                    {/* Host Specifics */}
                    {isHost && (
                      <>
                        <div className="h-[1px] bg-white/5 my-1"></div>
                        
                        <button
                          onClick={() => {
                            const nextLocked = !isLocked;
                            setIsLocked(nextLocked);
                            socketRef.current?.emit('lock-room', { roomId, locked: nextLocked });
                            setShowMoreMenu(false);
                          }}
                          className={`w-full px-3 py-2 rounded-lg transition text-xs font-semibold font-display flex items-center gap-2.5 cursor-pointer text-left ${
                            isLocked ? 'bg-red-600/10 text-red-400' : 'hover:bg-white/5 text-gray-300 hover:text-white'
                          }`}
                        >
                          <span>🔒</span>
                          <span>{isLocked ? 'Unlock Meeting' : 'Lock Meeting'}</span>
                        </button>
                        
                        <button
                          onClick={() => {
                            handleMuteAll();
                            setShowMoreMenu(false);
                          }}
                          className="w-full px-3 py-2 hover:bg-red-600/10 text-red-400 hover:text-red-300 rounded-lg transition text-xs font-semibold font-display flex items-center gap-2.5 cursor-pointer text-left"
                        >
                          <Volume2 size={14} />
                          <span>Mute All Members</span>
                        </button>

                        <button
                          onClick={() => {
                            handleTriggerBreakouts();
                            setShowMoreMenu(false);
                          }}
                          className="w-full px-3 py-2 hover:bg-indigo-600/10 text-indigo-400 hover:text-indigo-300 rounded-lg transition text-xs font-semibold font-display flex items-center gap-2.5 cursor-pointer text-left"
                        >
                          <Users size={14} />
                          <span>Split Breakouts</span>
                        </button>
                      </>
                    )}

                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleEndMeeting}
              className="p-3 rounded-xl bg-red-600 hover:bg-red-500 text-white cursor-pointer transition shadow-lg shadow-red-500/25"
              title="Leave Call [L]"
            >
              <PhoneOff size={18} />
            </button>
          </div>
        </div>

        {/* Right column: Sidebar tool panels */}
        <div className="w-full md:w-96 flex flex-col border-t md:border-t-0 md:border-l border-white/5 p-4 gap-4 min-h-0 bg-[#070611]/50">
          
          {/* Sidebar tabs selection */}
          <div className={`grid ${isHost ? 'grid-cols-8' : 'grid-cols-7'} gap-1 p-1 bg-white/5 border border-white/5 rounded-xl flex-shrink-0`}>
            {[
              { id: 'chat', label: 'Chat', icon: <MessageSquare size={12} /> },
              { id: 'tasks', label: 'Task', icon: <LayoutGrid size={12} /> },
              { id: 'agenda', label: 'Plan', icon: <CheckSquare size={12} /> },
              { id: 'whiteboard', label: 'Board', icon: <Edit size={12} /> },
              { id: 'files', label: 'File', icon: <FileText size={12} /> },
              { id: 'code', label: 'Code', icon: <Code size={12} /> },
              { id: 'people', label: 'User', icon: <Users size={12} /> },
              ...(isHost ? [{ id: 'logs', label: 'Logs', icon: <ShieldAlert size={12} /> }] : [])
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 rounded-lg text-[9px] font-bold font-display cursor-pointer transition flex flex-col items-center justify-center gap-1 ${
                  activeTab === tab.id
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Active Sidebar workspace panel rendering */}
          <div className="flex-1 min-h-0">
            {activeTab === 'chat' && (
              <ChatBox 
                socket={socket} 
                roomId={roomId}
                username={user.username} 
                cryptoKey={cryptoKey} 
                activeParticipants={[
                  { socketId: socket?.id, username: user.username },
                  ...peers.map(p => ({ socketId: p.id, username: p.username }))
                ]} 
              />
            )}

            {activeTab === 'tasks' && (
              <TaskBoard 
                socket={socket} 
                roomId={roomId} 
                username={user.username} 
              />
            )}

            {activeTab === 'agenda' && (
              <AgendaList 
                socket={socket} 
                isHost={isHost} 
              />
            )}

            {activeTab === 'whiteboard' && <Whiteboard socket={socket} />}

            {activeTab === 'files' && (
              <FileShare 
                socket={socket} 
                roomId={roomId} 
                username={user.username} 
                cryptoKey={cryptoKey} 
              />
            )}
            {activeTab === 'code' && (
              <CodeTogether 
                socket={socket} 
              />
            )}
            {activeTab === 'people' && (
              <div className="flex flex-col h-full bg-[#0a0a19]/90 border border-white/5 rounded-2xl p-4 gap-4 overflow-y-auto no-scrollbar font-sans text-sm">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-display">Participants (<Odometer value={peers.length + 1} />)</h4>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between p-2.5 bg-white/5 border border-white/5 rounded-xl">
                    <div className="flex flex-col">
                      <span className="font-semibold text-white">{user.username} (You)</span>
                      <span className="text-[9px] text-purple-400 font-bold uppercase tracking-wider font-display">{isHost ? 'Host' : 'Participant'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {handRaised && <Hand className="text-yellow-400 animate-bounce" size={12} />}
                      {micEnabled ? <Mic className="text-purple-400" size={12} /> : <MicOff className="text-red-400" size={12} />}
                      {videoEnabled ? <Video className="text-purple-400" size={12} /> : <VideoOff className="text-red-400" size={12} />}
                    </div>
                  </div>
                  {peers.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-2.5 bg-white/5 border border-white/5 rounded-xl">
                      <div className="flex flex-col">
                        <span className="text-gray-200">{p.username}</span>
                        {p.isHost && <span className="text-[9px] text-purple-400 font-bold uppercase tracking-wider font-display">Host</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        {p.isHandRaised && <Hand className="text-yellow-400 animate-pulse" size={12} />}
                        {p.micEnabled !== false ? <Mic className="text-purple-400" size={12} /> : <MicOff className="text-red-400" size={12} />}
                        {p.videoEnabled !== false ? <Video className="text-purple-400" size={12} /> : <VideoOff className="text-red-400" size={12} />}
                        {isHost && (
                          <button
                            onClick={() => handleKickUser(p.id)}
                            className="ml-2 px-2 py-1 bg-red-950/20 border border-red-800/30 text-red-400 hover:bg-red-600 hover:text-white transition rounded-lg text-[10px] font-bold font-display cursor-pointer"
                          >
                            Kick
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {isHost && (
                  <div className="flex flex-col gap-2 mt-4 border-t border-white/5 pt-4">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-display">Waiting Approval ({waitingList.length})</h4>
                    {waitingList.length === 0 ? (
                      <p className="text-xs text-gray-500">No pending join requests.</p>
                    ) : (
                      waitingList.map((req) => (
                        <div key={req.socketId} className="flex items-center justify-between p-2.5 bg-purple-500/5 border border-purple-500/10 rounded-xl">
                          <span className="font-semibold text-white truncate max-w-[120px]">{req.username}</span>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleApprove(req.socketId)}
                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold font-display cursor-pointer"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleDeny(req.socketId)}
                              className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold font-display cursor-pointer"
                            >
                              Deny
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {isHost && (
                  <div className="flex flex-col gap-2 mt-4 border-t border-white/5 pt-4">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-display">Video Messages ({videoMessages.length})</h4>
                    {videoMessages.length === 0 ? (
                      <p className="text-xs text-gray-500">No video messages left.</p>
                    ) : (
                      <div className="flex flex-col gap-2 max-h-40 overflow-y-auto scrollbar-thin">
                        {videoMessages.map((msg) => (
                          <div key={msg._id} className="flex items-center justify-between p-2.5 bg-purple-500/5 border border-purple-500/10 rounded-xl gap-2">
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-white truncate">{msg.sender}</span>
                              <span className="text-[9px] text-gray-400 font-mono">{new Date(msg.createdAt).toLocaleTimeString()}</span>
                            </div>
                            <button
                              onClick={() => {
                                setPlayingVideoMsg(msg.fileName);
                              }}
                              className="px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold font-display cursor-pointer shrink-0 transition"
                            >
                              Play
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            {activeTab === 'logs' && isHost && (
              <div className="flex flex-col h-full bg-[#0a0a19]/90 border border-white/5 rounded-2xl p-4 gap-4 overflow-y-auto no-scrollbar font-sans text-sm">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest font-display">Activity Audit Log</h4>
                <div className="flex flex-col gap-2.5 max-h-[85%] overflow-y-auto pr-1">
                  {auditLogs.length === 0 ? (
                    <p className="text-xs text-gray-500 italic text-center my-auto">No events logged yet.</p>
                  ) : (
                    auditLogs.map((log) => (
                      <div key={log._id} className="p-2.5 bg-white/5 border border-white/5 rounded-xl flex flex-col gap-1 hover:bg-white/10 transition-all duration-200">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="font-semibold text-purple-300 font-display">{log.username}</span>
                          <span className="text-gray-500 font-mono">{new Date(log.createdAt).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-xs text-gray-200 leading-relaxed font-sans">{log.details}</p>
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider font-display">{log.event}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Blocked permission modal overlay */}
      {showBlockedModal && (() => {
        const browser = detectBrowser();
        return (
          <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md z-50 animate-fade-in">
            <div className="max-w-md w-full glass rounded-3xl p-8 flex flex-col items-center justify-center text-center gap-6 border border-purple-500/25 shadow-2xl">
              <ShieldAlert className="text-red-400 animate-pulse" size={48} />
              
              <h2 className="text-2xl font-bold font-display text-white">
                {blockedMediaType === 'camera' ? 'Camera' : blockedMediaType === 'microphone' ? 'Microphone' : 'Media Devices'} Blocked
              </h2>
              
              <p className="text-gray-300 text-sm leading-relaxed">
                Your {blockedMediaType} access is blocked by browser security. To unblock it:
              </p>

              {/* Browser-specific illustrated guidelines */}
              <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-3 text-left font-sans text-xs">
                <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider font-display">
                  Instructions for {browser.charAt(0).toUpperCase() + browser.slice(1)}
                </span>
                
                {browser === 'chrome' && (
                  <div className="text-gray-300 leading-relaxed flex flex-col gap-2">
                    <p>1. Click the <strong className="text-white">lock icon (🔒)</strong> directly to the left of the address bar.</p>
                    <p>2. Locate <strong className="text-white">Camera / Microphone</strong> in the dropdown menu.</p>
                    <p>3. Toggle the switch to <strong className="text-purple-400">Allow</strong>.</p>
                  </div>
                )}

                {browser === 'firefox' && (
                  <div className="text-gray-300 leading-relaxed flex flex-col gap-2">
                    <p>1. Click the <strong className="text-white">permissions icon (🎥/🎙️)</strong> next to the URL input box.</p>
                    <p>2. Click the <strong className="text-white">X</strong> next to "Blocked Temporarily" or "Blocked".</p>
                    <p>3. Reload and select <strong className="text-purple-400">Allow</strong> when prompted.</p>
                  </div>
                )}

                {browser === 'edge' && (
                  <div className="text-gray-300 leading-relaxed flex flex-col gap-2">
                    <p>1. Click the <strong className="text-white">lock icon (🔒)</strong> in the address bar.</p>
                    <p>2. Locate site permissions and set <strong className="text-white">Camera/Microphone</strong> to <strong className="text-purple-400">Allow</strong>.</p>
                  </div>
                )}

                {browser === 'safari' && (
                  <div className="text-gray-300 leading-relaxed flex flex-col gap-2">
                    <p>1. Open <strong className="text-white">Safari &gt; Settings...</strong> from the macOS menu bar.</p>
                    <p>2. Go to the <strong className="text-white">Websites</strong> tab and select Camera/Microphone.</p>
                    <p>3. Locate this URL and change configuration to <strong className="text-purple-400">Allow</strong>.</p>
                  </div>
                )}

                {/* Animated progress indicator representing polling */}
                <div className="w-full bg-white/5 h-1 rounded-full overflow-hidden relative mt-1">
                  <div className="absolute inset-0 bg-purple-500 w-1/3 rounded-full animate-bounce"></div>
                </div>
                <span className="text-[10px] text-gray-500 italic text-center block">
                  Autodetecting permission settings updates in real-time...
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3 w-full">
                <div className="flex gap-3 w-full">
                  <button
                    onClick={() => window.location.reload()}
                    className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold font-display cursor-pointer transition shadow-lg shadow-purple-500/25"
                  >
                    Reload Page
                  </button>
                  <button
                    onClick={handleManualRecheck}
                    className="flex-1 py-3 bg-white/10 hover:bg-white/15 text-white text-xs border border-white/10 rounded-xl cursor-pointer transition font-display font-semibold"
                  >
                    I've Allowed It
                  </button>
                </div>
                
                <div className="flex gap-3 w-full">
                  <button
                    onClick={handleCopyURL}
                    className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl text-[10px] font-bold font-display cursor-pointer transition"
                  >
                    Copy Site URL
                  </button>
                  <button
                    onClick={() => setShowBlockedModal(false)}
                    className="flex-1 py-2 bg-transparent text-gray-500 hover:text-white rounded-xl text-[10px] cursor-pointer transition font-medium"
                  >
                    Dismiss Warning
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Floating Ask AI Button */}
      <button
        onClick={() => setShowAICoPilot(!showAICoPilot)}
        className="fixed bottom-24 right-6 p-4 bg-gradient-to-tr from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-full shadow-2xl z-30 flex items-center justify-center cursor-pointer transition hover:scale-110 active:scale-95 duration-300"
        title="Ask AI Co-pilot"
      >
        <Sparkles size={22} className="animate-pulse" />
      </button>

      {/* AI Co-pilot chat panel overlay */}
      {showAICoPilot && (
        <div className="fixed bottom-28 right-6 w-80 md:w-96 h-[450px] glass rounded-3xl border border-purple-500/20 shadow-2xl z-40 flex flex-col overflow-hidden animate-fade-in-up font-sans">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-950/60 to-indigo-950/60 py-3 px-4 flex justify-between items-center border-b border-white/5">
            <div className="flex items-center gap-2">
              <Sparkles className="text-purple-400 animate-pulse" size={16} />
              <span className="text-sm font-bold text-white font-display">AI Meeting Co-pilot</span>
            </div>
            <button
              onClick={() => setShowAICoPilot(false)}
              className="text-gray-400 hover:text-white transition cursor-pointer text-xs"
            >
              ✕
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 scrollbar-thin">
            {aiMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-purple-600 text-white self-end rounded-tr-none'
                    : 'bg-white/5 border border-white/10 text-gray-300 self-start rounded-tl-none font-sans'
                }`}
              >
                {msg.text}
              </div>
            ))}
            {aiLoading && (
              <div className="bg-white/5 border border-white/10 text-gray-400 self-start rounded-2xl rounded-tl-none p-3 text-xs flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                <span>Thinking...</span>
              </div>
            )}
          </div>

          {/* Quick prompt chips */}
          <div className="px-4 py-2 border-t border-white/5 bg-black/20 flex gap-2 overflow-x-auto scrollbar-none whitespace-nowrap">
            {[
              { label: '📝 Summarize', q: 'summarize latest discussion' },
              { label: '❓ What did I miss?', q: 'what did I miss recently?' },
              { label: '✅ Action items', q: 'list action items' }
            ].map((chip) => (
              <button
                key={chip.label}
                onClick={async () => {
                  const userMsg = { role: 'user', text: chip.q };
                  setAiMessages((prev) => [...prev, userMsg]);
                  setAiLoading(true);
                  try {
                    const res = await API.post('/ai/ask', { question: chip.q, transcript });
                    setAiMessages((prev) => [...prev, { role: 'assistant', text: res.data.answer }]);
                  } catch (err) {
                    setAiMessages((prev) => [...prev, { role: 'assistant', text: 'Error contacting AI co-pilot.' }]);
                  } finally {
                    setAiLoading(false);
                  }
                }}
                className="py-1 px-2.5 bg-purple-600/15 hover:bg-purple-600/25 border border-purple-500/20 text-purple-300 rounded-full text-[10px] font-bold font-display cursor-pointer transition"
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Chat Input */}
          <form onSubmit={handleAskAI} className="p-3 border-t border-white/5 bg-black/40 flex gap-2">
            <input
              type="text"
              value={aiQuestion}
              onChange={(e) => setAiQuestion(e.target.value)}
              placeholder="Ask anything about the meeting..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50"
            />
            <button
              type="submit"
              disabled={aiLoading || !aiQuestion.trim()}
              className="px-3 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 disabled:text-gray-400 text-white rounded-xl text-xs font-bold font-display cursor-pointer transition"
            >
              Ask
            </button>
          </form>
        </div>
      )}

      {/* Post-Meeting Summary & Action Items Modal */}
      {showPostMeetingModal && (
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md z-50 animate-fade-in font-sans">
          <div className="max-w-xl w-full glass rounded-3xl p-8 flex flex-col gap-6 border border-purple-500/25 shadow-2xl relative">
            <div className="flex items-center gap-3">
              <Sparkles className="text-purple-400 animate-pulse" size={28} />
              <div>
                <h2 className="text-2xl font-bold font-display text-white">Meeting Summary</h2>
                <p className="text-xs text-gray-400">Review and check off action items before leaving</p>
              </div>
            </div>

            <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-4 text-left">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest font-display">Auto-generated Action Items</span>
                <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full font-mono font-bold">
                  {actionItems.filter(i => i.completed).length}/{actionItems.length} Done
                </span>
              </div>
              
              <div className="max-h-60 overflow-y-auto flex flex-col gap-3 scrollbar-thin">
                {actionItems.map((item, idx) => (
                  <label
                    key={idx}
                    className="flex items-start gap-3 p-3 bg-white/5 border border-white/5 hover:border-white/10 rounded-xl cursor-pointer transition"
                  >
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={() => {
                        setActionItems(prev =>
                          prev.map((it, i) => i === idx ? { ...it, completed: !it.completed } : it)
                        );
                      }}
                      className="mt-1 accent-purple-500 rounded cursor-pointer"
                    />
                    <span className={`text-xs text-gray-300 font-sans leading-relaxed ${item.completed ? 'line-through text-gray-500' : ''}`}>
                      {item.task}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Bottom buttons */}
            <div className="flex gap-4 w-full">
              <button
                onClick={() => {
                  const doc = new jsPDF();
                  doc.setFont("Helvetica");
                  doc.setFontSize(22);
                  doc.setTextColor(124, 58, 237);
                  doc.text("Meeting Action Items Summary", 20, 20);
                  
                  doc.setFontSize(12);
                  doc.setTextColor(80, 80, 80);
                  doc.text(`Space ID: ${roomId}`, 20, 35);
                  doc.text(`Completed Date: ${new Date().toLocaleString()}`, 20, 42);
                  
                  doc.line(20, 49, 190, 49);
                  
                  doc.setFontSize(14);
                  doc.setTextColor(0, 0, 0);
                  doc.text("Action Items Checklist:", 20, 60);
                  
                  let y = 72;
                  actionItems.forEach((item, index) => {
                    const status = item.completed ? "[X]" : "[ ]";
                    doc.setFontSize(11);
                    doc.text(`${status} ${item.task}`, 20, y);
                    y += 10;
                  });
                  
                  doc.save(`meeting-action-items-${roomId}.pdf`);
                  alert('Action items summary PDF exported successfully!');
                }}
                className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold font-display cursor-pointer transition shadow-lg shadow-purple-500/25"
              >
                Export Checklist PDF
              </button>
              
              <button
                onClick={leaveMeeting}
                className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white text-xs font-bold border border-white/10 rounded-xl cursor-pointer transition font-display"
              >
                Confirm Exit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Message Recorder Modal */}
      {showVideoMsgModal && (
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md z-50 animate-fade-in font-sans">
          <div className="max-w-xl w-full glass rounded-3xl p-8 flex flex-col gap-6 border border-purple-500/25 shadow-2xl relative">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold font-display text-white">Leave a Video Message</h2>
                <p className="text-xs text-gray-400">Record a short clip to notify the host</p>
              </div>
              <button
                onClick={() => {
                  handleStopVideoMsgRecording();
                  setShowVideoMsgModal(false);
                  setVideoMsgBlob(null);
                  setVideoMsgURL(null);
                }}
                className="text-gray-400 hover:text-white transition cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            <div className="w-full aspect-video rounded-2xl border border-white/10 overflow-hidden bg-black/60 relative">
              <video
                id="video-msg-preview"
                autoPlay
                playsInline
                muted={videoMsgRecording}
                className="w-full h-full object-cover mirrored"
              />
              
              {videoMsgRecording && (
                <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1 bg-red-600 text-white rounded-full text-[10px] font-bold font-mono animate-pulse">
                  <span className="w-2.5 h-2.5 bg-white rounded-full"></span>
                  <span>RECORDING</span>
                </div>
              )}
            </div>

            <div className="flex gap-4 w-full justify-center">
              {!videoMsgURL && !videoMsgRecording && (
                <button
                  onClick={handleStartVideoMsgRecording}
                  className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold font-display cursor-pointer transition shadow-lg shadow-red-500/25"
                >
                  Start Recording
                </button>
              )}

              {videoMsgRecording && (
                <button
                  onClick={handleStopVideoMsgRecording}
                  className="px-6 py-3 bg-white text-black hover:bg-gray-100 rounded-xl text-xs font-bold font-display cursor-pointer transition shadow-lg shadow-white/25"
                >
                  Stop Recording
                </button>
              )}

              {videoMsgURL && (
                <div className="flex gap-4 w-full">
                  <button
                    onClick={() => {
                      setVideoMsgURL(null);
                      setVideoMsgBlob(null);
                      initVideoMessageRecorder();
                    }}
                    className="flex-1 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl text-xs font-bold font-display cursor-pointer transition"
                  >
                    Record Again
                  </button>
                  <button
                    onClick={handleUploadVideoMsg}
                    className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold font-display cursor-pointer transition shadow-lg shadow-purple-500/25"
                  >
                    Upload & Notify Host
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Video Message Playback Modal */}
      {playingVideoMsg && (
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md z-50 animate-fade-in font-sans">
          <div className="max-w-xl w-full glass rounded-3xl p-8 flex flex-col gap-6 border border-purple-500/25 shadow-2xl relative">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold font-display text-white">Playing Video Message</h2>
                <p className="text-xs text-gray-400">Recorded for Room {roomId}</p>
              </div>
              <button
                onClick={() => setPlayingVideoMsg(null)}
                className="text-gray-400 hover:text-white transition cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            <div className="w-full aspect-video rounded-2xl border border-white/10 overflow-hidden bg-black/60">
              <video
                src={`http://localhost:5000/api/video-message/play/${playingVideoMsg}`}
                autoPlay
                controls
                playsInline
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setPlayingVideoMsg(null)}
                className="px-6 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-white rounded-xl text-xs font-bold font-display cursor-pointer transition"
              >
                Close Player
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fatigue Warning Toast */}
      {showBreakToast && (
        <div className="fixed bottom-6 left-6 max-w-sm glass border border-amber-500/30 p-4 rounded-2xl shadow-2xl z-50 flex items-center justify-between gap-4 animate-fade-in-up font-sans">
          <div className="flex items-center gap-3">
            <Timer className="text-amber-400 shrink-0 animate-pulse" size={20} />
            <div className="flex flex-col">
              <span className="text-xs font-bold text-white font-display">Meeting Fatigue Alert</span>
              <span className="text-[10px] text-gray-300 leading-normal font-sans">
                You've been in calls for {sessionMinutes}m today ({todayMeetingMinutes}m total). Consider taking a short break!
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowBreakToast(false)}
            className="text-[10px] font-bold text-purple-400 hover:text-purple-300 cursor-pointer shrink-0 transition"
          >
            Dismiss
          </button>
        </div>
      )}
      {/* Invite Details & QR Code Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md z-50 animate-fade-in font-sans">
          <div className="max-w-md w-full glass rounded-3xl p-8 flex flex-col items-center text-center gap-6 border border-purple-500/25 shadow-2xl relative">
            <button
              onClick={() => setShowInviteModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition cursor-pointer text-xs"
            >
              ✕
            </button>

            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 text-xl">
              ⚡
            </div>

            <div className="flex flex-col gap-1.5">
              <h2 className="text-xl font-bold font-display text-white">Space is Ready!</h2>
              <p className="text-xs text-gray-400">Share this space link or QR code with others</p>
            </div>

            {/* QR Code container */}
            <div className="p-4 bg-white rounded-2xl shadow-xl border border-white/10 flex items-center justify-center">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(window.location.href)}`}
                alt="Quick Join QR Code"
                className="w-40 h-40 object-contain"
              />
            </div>
            <span className="text-[10px] text-gray-500 font-mono italic">Scan with your phone to join instantly</span>

            <div className="w-full flex flex-col gap-2 mt-2">
              <div className="w-full bg-[#0a0a19]/90 border border-white/5 rounded-xl px-4 py-3 text-xs text-purple-300 font-mono select-all break-all text-center">
                {window.location.href}
              </div>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  alert('Join link copied to clipboard!');
                }}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold font-display cursor-pointer transition shadow-lg shadow-purple-500/25"
              >
                Copy Invite Link
              </button>
            </div>
          </div>
        </div>
      )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default MeetingRoom;
