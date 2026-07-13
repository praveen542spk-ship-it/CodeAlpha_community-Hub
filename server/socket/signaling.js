const Room = require('../models/Room');
const ActivityLog = require('../models/ActivityLog');

const socketToRoom = {}; // socket.id -> roomId
const roomToSockets = {}; // roomId -> array of user objects
const waitingUsers = {}; // roomId -> array of waiting user objects
const lockedRooms = {}; // roomId -> boolean

function handleSocketConnections(io) {
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Request to Join Room (Waiting Room Check)
    socket.on('request-join', async ({ roomId, username, isHost }) => {
      // Check if room is locked
      if (lockedRooms[roomId]) {
        socket.emit('joined-room', { isApproved: false, isLocked: true, message: 'This meeting is locked by the host.' });
        return;
      }

      socketToRoom[socket.id] = roomId;

      let dbRoom = await Room.findOne({ roomId });
      const isRoomEmpty = !roomToSockets[roomId] || roomToSockets[roomId].length === 0;
      const socketHost = isHost || isRoomEmpty;

      if (socketHost) {
        // Host immediately joins
        if (!roomToSockets[roomId]) {
          roomToSockets[roomId] = [];
        }
        
        const hostUser = {
          socketId: socket.id,
          username,
          isHost: true,
          isApproved: true,
          isHandRaised: false
        };
        
        roomToSockets[roomId].push(hostUser);
        socket.join(roomId);
        
        console.log(`Host ${username} (${socket.id}) created/joined room: ${roomId}`);
        socket.emit('joined-room', { isApproved: true, isHost: true });

        // Log join event
        new ActivityLog({
          roomId,
          username,
          event: 'join',
          details: 'Host joined the meeting.'
        }).save().catch(() => {});
        io.to(roomId).emit('audit-log-update');
        
        // Let waiting users know host is available
        if (waitingUsers[roomId] && waitingUsers[roomId].length > 0) {
          socket.emit('waiting-list-update', waitingUsers[roomId]);
        }
      } else {
        // Participant: check if host is in the room
        const activeUsers = roomToSockets[roomId] || [];
        const currentHost = activeUsers.find(u => u.isHost);

        if (!currentHost) {
          // No host is present yet: put them in the waiting state
          if (!waitingUsers[roomId]) waitingUsers[roomId] = [];
          waitingUsers[roomId].push({ socketId: socket.id, username });
          socket.emit('waiting-room-state', { message: 'Waiting for the host to join...' });
          return;
        }

        // Host is present: add to waiting list and notify host
        if (!waitingUsers[roomId]) waitingUsers[roomId] = [];
        waitingUsers[roomId].push({ socketId: socket.id, username });

        socket.emit('waiting-room-state', { message: 'Waiting for host approval...' });
        
        // Notify host of join request
        io.to(currentHost.socketId).emit('join-request', { socketId: socket.id, username });
      }
    });

    // Host Action: Approve Join
    socket.on('approve-user', ({ targetSocketId }) => {
      const roomId = socketToRoom[socket.id];
      if (!roomId) return;

      if (waitingUsers[roomId]) {
        const idx = waitingUsers[roomId].findIndex(u => u.socketId === targetSocketId);
        if (idx !== -1) {
          const approvedUser = waitingUsers[roomId][idx];
          waitingUsers[roomId].splice(idx, 1);

          if (!roomToSockets[roomId]) roomToSockets[roomId] = [];
          const userObj = {
            socketId: approvedUser.socketId,
            username: approvedUser.username,
            isHost: false,
            isApproved: true,
            isHandRaised: false
          };
          roomToSockets[roomId].push(userObj);

          // Instruct target socket to join room
          io.to(targetSocketId).emit('joined-room', { isApproved: true, isHost: false });

          // Log join event
          new ActivityLog({
            roomId,
            username: approvedUser.username,
            event: 'join',
            details: 'Participant joined the meeting.'
          }).save().catch(() => {});
          io.to(roomId).emit('audit-log-update');
          
          // Notify host of updated list
          const activeUsers = roomToSockets[roomId] || [];
          const hostObj = activeUsers.find(u => u.isHost);
          if (hostObj) {
            io.to(hostObj.socketId).emit('waiting-list-update', waitingUsers[roomId]);
          }

          // Setup connections
          const otherUsers = roomToSockets[roomId].filter(u => u.socketId !== targetSocketId);
          io.to(targetSocketId).emit('all-users', otherUsers);
          socket.to(roomId).emit('user-joined', {
            socketId: targetSocketId,
            username: approvedUser.username
          });

          const targetSocketInstance = io.sockets.sockets.get(targetSocketId);
          if (targetSocketInstance) {
            targetSocketInstance.join(roomId);
          }
        }
      }
    });

    // Host Action: Deny Join
    socket.on('deny-user', ({ targetSocketId }) => {
      const roomId = socketToRoom[socket.id];
      if (!roomId) return;

      if (waitingUsers[roomId]) {
        const idx = waitingUsers[roomId].findIndex(u => u.socketId === targetSocketId);
        if (idx !== -1) {
          waitingUsers[roomId].splice(idx, 1);
          io.to(targetSocketId).emit('joined-room', { isApproved: false, message: 'Host denied your request to join.' });
          
          // Notify host
          socket.emit('waiting-list-update', waitingUsers[roomId]);
        }
      }
    });

    // WebRTC: signaling offers/answers
    socket.on('send-signal', ({ targetSocketId, signal }) => {
      io.to(targetSocketId).emit('signal-received', {
        senderSocketId: socket.id,
        signal
      });
    });

    // Chat messages
    socket.on('send-message', (msgData) => {
      const roomId = socketToRoom[socket.id];
      if (roomId) {
        socket.to(roomId).emit('message-received', msgData);
      }
    });

    // Whiteboard drawing coordinates
    socket.on('drawing', (data) => {
      const roomId = socketToRoom[socket.id];
      if (roomId) {
        socket.to(roomId).emit('drawing', data);
      }
    });

    // Whiteboard clear board command
    socket.on('clear-board', () => {
      const roomId = socketToRoom[socket.id];
      if (roomId) {
        socket.to(roomId).emit('clear-board');
      }
    });

    // Speech captions translation
    socket.on('caption-broadcast', (data) => {
      const roomId = socketToRoom[socket.id];
      if (roomId) {
        socket.to(roomId).emit('caption-received', {
          sender: data.sender,
          text: data.text
        });
      }
    });

    // Host Controls: Mute All Sockets
    socket.on('mute-all-users', () => {
      const roomId = socketToRoom[socket.id];
      if (roomId) {
        const hostCheck = roomToSockets[roomId]?.find(u => u.socketId === socket.id && u.isHost);
        if (hostCheck) {
          socket.to(roomId).emit('force-mute-mic');
        }
      }
    });

    // Host Controls: Kick Participant
    socket.on('kick-user', ({ targetSocketId }) => {
      const roomId = socketToRoom[socket.id];
      if (roomId) {
        const hostCheck = roomToSockets[roomId]?.find(u => u.socketId === socket.id && u.isHost);
        if (hostCheck) {
          io.to(targetSocketId).emit('force-disconnect');
        }
      }
    });

    // Raise Hand status
    socket.on('raise-hand', ({ isRaised }) => {
      const roomId = socketToRoom[socket.id];
      if (roomId && roomToSockets[roomId]) {
        const user = roomToSockets[roomId].find(u => u.socketId === socket.id);
        if (user) {
          user.isHandRaised = isRaised;
          io.in(roomId).emit('user-hand-state', {
            socketId: socket.id,
            username: user.username,
            isRaised
          });
        }
      }
    });

    // Breakout Rooms trigger
    socket.on('create-breakouts', ({ subRoomCount, durationMinutes }) => {
      const roomId = socketToRoom[socket.id];
      if (!roomId) return;

      const hostUser = roomToSockets[roomId]?.find(u => u.socketId === socket.id && u.isHost);
      if (!hostUser) return;

      const participants = roomToSockets[roomId].filter(u => !u.isHost);
      if (participants.length === 0) return;

      participants.forEach((user, index) => {
        const subRoomIndex = (index % subRoomCount) + 1;
        const subRoomId = `${roomId}-break-${subRoomIndex}`;
        io.to(user.socketId).emit('breakout-assigned', { subRoomId, durationMinutes });
      });
    });

    // Return breakouts to main room
    socket.on('end-breakouts', () => {
      const roomId = socketToRoom[socket.id];
      if (roomId) {
        io.in(roomId).emit('breakouts-ended');
      }
    });

    // ==========================================================================
    // NEW SYNC EVENT LISTENERS FOR EXPANDED CALL OPTIONS
    // ==========================================================================

    // Floating reaction emoji broadcast
    socket.on('send-reaction', ({ emoji }) => {
      const roomId = socketToRoom[socket.id];
      if (roomId) {
        socket.to(roomId).emit('reaction-received', {
          senderSocketId: socket.id,
          emoji
        });
      }
    });

    // Trello tasks sync
    socket.on('task-added', (task) => {
      const roomId = socketToRoom[socket.id];
      if (roomId) {
        socket.to(roomId).emit('task-added', task);
      }
    });

    socket.on('task-updated', (task) => {
      const roomId = socketToRoom[socket.id];
      if (roomId) {
        socket.to(roomId).emit('task-updated', task);
      }
    });

    socket.on('task-deleted', ({ taskId }) => {
      const roomId = socketToRoom[socket.id];
      if (roomId) {
        socket.to(roomId).emit('task-deleted', { taskId });
      }
    });

    // Agenda Checklist checklist checks sync
    socket.on('agenda-updated', (agendaState) => {
      const roomId = socketToRoom[socket.id];
      if (roomId) {
        socket.to(roomId).emit('agenda-updated', agendaState);
      }
    });

    // Collaborative code editor sync
    socket.on('code-change', ({ code }) => {
      const roomId = socketToRoom[socket.id];
      if (roomId) {
        socket.to(roomId).emit('code-change', { code });
      }
    });

    socket.on('code-language-change', ({ language }) => {
      const roomId = socketToRoom[socket.id];
      if (roomId) {
        socket.to(roomId).emit('code-language-change', { language });
      }
    });

    socket.on('terminal-output-change', ({ output }) => {
      const roomId = socketToRoom[socket.id];
      if (roomId) {
        socket.to(roomId).emit('terminal-output-change', { output });
      }
    });

    // Sync media toggle state
    socket.on('user-media-state', ({ micEnabled, videoEnabled }) => {
      const roomId = socketToRoom[socket.id];
      if (roomId && roomToSockets[roomId]) {
        const user = roomToSockets[roomId].find(u => u.socketId === socket.id);
        if (user) {
          user.micEnabled = micEnabled;
          user.videoEnabled = videoEnabled;
        }
        socket.to(roomId).emit('peer-media-state', {
          socketId: socket.id,
          micEnabled,
          videoEnabled
        });
      }
    });

    // Enforce lock-room status
    socket.on('lock-room', ({ roomId, locked }) => {
      lockedRooms[roomId] = locked;
      new ActivityLog({
        roomId,
        username: 'System',
        event: locked ? 'lock-room' : 'unlock-room',
        details: `Meeting ${locked ? 'locked' : 'unlocked'} by host.`
      }).save().catch(() => {});
      
      io.to(roomId).emit('room-lock-state', { locked });
      io.to(roomId).emit('audit-log-update');
    });

    // Audit logs: File shared
    socket.on('log-file-shared', ({ roomId, username, fileName }) => {
      new ActivityLog({
        roomId,
        username,
        event: 'file-share',
        details: `Shared file: ${fileName}`
      }).save().catch(() => {});
      io.to(roomId).emit('audit-log-update');
    });

    // Audit logs: Screen share start/stop
    socket.on('log-screen-share', ({ roomId, username, sharing }) => {
      new ActivityLog({
        roomId,
        username,
        event: sharing ? 'screen-share-start' : 'screen-share-stop',
        details: `${username} ${sharing ? 'started' : 'stopped'} screen share.`
      }).save().catch(() => {});
      io.to(roomId).emit('audit-log-update');
    });

    // Disconnection handler
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      const roomId = socketToRoom[socket.id];

      if (roomId && waitingUsers[roomId]) {
        waitingUsers[roomId] = waitingUsers[roomId].filter(u => u.socketId !== socket.id);
        const hostObj = roomToSockets[roomId]?.find(u => u.isHost);
        if (hostObj) {
          io.to(hostObj.socketId).emit('waiting-list-update', waitingUsers[roomId]);
        }
      }

      if (roomId && roomToSockets[roomId]) {
        const userLeaving = roomToSockets[roomId].find(u => u.socketId === socket.id);
        roomToSockets[roomId] = roomToSockets[roomId].filter(u => u.socketId !== socket.id);

        if (userLeaving) {
          new ActivityLog({
            roomId,
            username: userLeaving.username,
            event: 'leave',
            details: 'User left the meeting.'
          }).save().catch(() => {});
          io.to(roomId).emit('audit-log-update');
        }

        if (roomToSockets[roomId].length === 0) {
          delete roomToSockets[roomId];
          delete waitingUsers[roomId];
        } else if (userLeaving?.isHost) {
          const nextUser = roomToSockets[roomId][0];
          nextUser.isHost = true;
          io.to(nextUser.socketId).emit('host-privileges-granted');
          io.in(roomId).emit('host-changed', { socketId: nextUser.socketId, username: nextUser.username });
        }

        delete socketToRoom[socket.id];
        socket.to(roomId).emit('user-left', socket.id);
      }
    });
  });
}

module.exports = { handleSocketConnections };
