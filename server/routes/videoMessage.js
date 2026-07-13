const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const { GridFsStorage } = require('multer-gridfs-storage');
const Grid = require('gridfs-stream');
const auth = require('../middleware/auth');
const Room = require('../models/Room');
const VideoMessage = require('../models/VideoMessage');
const { sendVideoMessageNotification } = require('../utils/email');
const path = require('path');

// We initialize GridFS when connection is open
let gridfsBucket;
const conn = mongoose.connection;
conn.once('open', () => {
  gridfsBucket = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: 'videoMessages'
  });
});

// Create GridFS Storage engine for video messages
const storage = new GridFsStorage({
  url: process.env.MONGO_URI,
  options: { tlsAllowInvalidCertificates: true },
  file: (req, file) => {
    return {
      filename: `videomsg-${Date.now()}${path.extname(file.originalname || '.webm')}`,
      bucketName: 'videoMessages'
    };
  }
});

const upload = multer({ storage });

// @route   POST api/video-message/upload
// @desc    Upload recorded video message to GridFS
// @access  Private
router.post('/upload', [auth, upload.single('video')], async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ msg: 'No video file uploaded' });
  }

  const { roomId } = req.body;

  try {
    const videoMsg = new VideoMessage({
      roomId,
      sender: req.user.username,
      fileName: req.file.filename
    });

    await videoMsg.save();
    res.json(videoMsg);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/video-message/list/:roomId
// @desc    Get all video messages for a room
// @access  Private
router.get('/list/:roomId', auth, async (req, res) => {
  try {
    const messages = await VideoMessage.find({ roomId }).sort({ createdAt: -1 });
    res.json(messages);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/video-message/play/:filename
// @desc    Stream video from GridFS and trigger notification
// @access  Public
router.get('/play/:filename', async (req, res) => {
  try {
    // Find video message metadata to get roomId & sender
    const msg = await VideoMessage.findOne({ fileName: req.params.filename });
    if (!msg) {
      return res.status(404).json({ msg: 'Video message not found' });
    }

    // Stream from GridFS
    const files = await gridfsBucket.find({ filename: req.params.filename }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ msg: 'Video file not found' });
    }

    const file = files[0];
    res.set('Content-Type', file.contentType || 'video/webm');
    
    // Notify room owner (host) if not already viewed
    if (!msg.isViewed) {
      msg.isViewed = true;
      await msg.save();

      // Find room host email
      const room = await Room.findOne({ roomId: msg.roomId }).populate('host');
      if (room && room.host && room.host.email) {
        sendVideoMessageNotification(room.host.email, room.host.username, msg.sender, msg.roomId)
          .then(() => console.log(`Host notified of viewed video message ✅`))
          .catch(e => console.error('Failed to notify host:', e.message));
      }
    }

    const readStream = gridfsBucket.openDownloadStream(file._id);
    readStream.pipe(res);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
