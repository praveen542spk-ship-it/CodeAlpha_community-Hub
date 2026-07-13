const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Room = require('../models/Room');
const { sendInviteEmail } = require('../utils/email');

// @route   POST api/room/create
// @desc    Register a new room instance in DB
// @access  Private
router.post('/create', auth, async (req, res) => {
  const { roomId } = req.body;

  try {
    let room = await Room.findOne({ roomId });
    if (room) {
      // Room already exists, return it (e.g. re-joining as host)
      return res.json(room);
    }

    room = new Room({
      roomId,
      host: req.user.id,
      participants: [req.user.id]
    });

    await room.save();
    res.json(room);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST api/room/schedule
// @desc    Schedule a future meeting and invite via email
// @access  Private
router.post('/schedule', auth, async (req, res) => {
  const { roomId, scheduledAt, emails } = req.body;

  try {
    let room = new Room({
      roomId,
      host: req.user.id,
      scheduledAt: new Date(scheduledAt)
    });

    await room.save();

    // Send email invites in background
    if (emails && Array.isArray(emails) && emails.length > 0) {
      const roomLink = `http://localhost:3000/room/${roomId}`;
      emails.forEach(email => {
        sendInviteEmail(email, roomLink, scheduledAt, req.user.username)
          .then(() => console.log(`Invite email sent to ${email} ✅`))
          .catch(err => console.error(`Failed to send invite email to ${email}:`, err.message));
      });
    }

    res.json({ msg: 'Meeting scheduled successfully', room });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/room/turn-credentials
// @desc    Retrieve TURN/STUN server configuration securely
// @access  Private
router.get('/turn-credentials', auth, (req, res) => {
  res.json({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      {
        urls: process.env.TURN_URL || 'stun:stun.l.google.com:19302', // fallback STUN
        username: process.env.TURN_USERNAME || '',
        credential: process.env.TURN_PASSWORD || '',
      }
    ]
  });
});

// @route   GET api/room/upcoming
// @desc    Retrieve all upcoming scheduled meetings
// @access  Private
router.get('/upcoming', auth, async (req, res) => {
  try {
    const rooms = await Room.find({
      host: req.user.id,
      scheduledAt: { $gte: new Date() }
    }).sort({ scheduledAt: 1 });
    res.json(rooms);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
