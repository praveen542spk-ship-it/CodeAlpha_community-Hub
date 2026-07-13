const dns = require('dns');

// Set DNS servers to Google DNS to fix querySrv ECONNREFUSED issues on certain network providers
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (err) {
  console.warn('Could not set custom DNS servers:', err.message);
}

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const { apiLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const { handleSocketConnections } = require('./socket/signaling');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Security Middlewares
app.use(helmet()); // Set secure HTTP headers
app.use(cors());
app.use(express.json());

// Apply rate limiter to authentication endpoints to prevent brute-force
app.use('/api/auth', apiLimiter);

// REST Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/room', require('./routes/room'));
app.use('/api/file', require('./routes/file'));
app.use('/api/tasks', require('./routes/task')); // Trello board task routes
app.use('/api/ai', require('./routes/ai')); // AI Co-pilot routes
app.use('/api/video-message', require('./routes/videoMessage')); // Async Video message routes
app.use('/api/fatigue', require('./routes/fatigue')); // Fatigue Tracker routes
app.use('/api/stats', require('./routes/stats')); // Gamification stats routes
app.use('/api/analytics', require('./routes/analytics')); // Analytics routes
app.use('/api/audit', require('./routes/audit')); // Audit routes

// Room Validation Endpoint
const Room = require('./models/Room');
app.get('/api/room/validate/:roomId', async (req, res) => {
  const { roomId } = req.params;
  
  // Try to find if room is registered in database
  try {
    const scheduledRoom = await Room.findOne({ roomId });
    if (scheduledRoom) {
      return res.json({ valid: true });
    }
    return res.json({ valid: false });
  } catch (err) {
    return res.status(500).json({ valid: false, err: err.message });
  }
});

// Mongoose Connection
mongoose.connect(process.env.MONGO_URI, { tlsAllowInvalidCertificates: true })
  .then(() => console.log('MongoDB connected successfully ✅'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Socket.io event connections relay
handleSocketConnections(io);

// Global Error Handler Middleware
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT} 🚀`));
