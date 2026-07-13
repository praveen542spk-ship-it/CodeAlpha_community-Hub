const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const ActivityLog = require('../models/ActivityLog');
const Room = require('../models/Room');

// @route   GET api/audit/:roomId
// @desc    Get activity audit logs for a specific room (Host only)
// @access  Private
router.get('/:roomId', auth, async (req, res) => {
  try {
    const { roomId } = req.params;
    
    // Security check: Verify if the user is indeed the host of this room
    const room = await Room.findOne({ roomId });
    if (!room) {
      return res.status(404).json({ msg: 'Room not found' });
    }

    if (room.host.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Access denied: Only the host can view activity logs' });
    }

    const logs = await ActivityLog.find({ roomId }).sort({ createdAt: -1 });
    res.json(logs);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
