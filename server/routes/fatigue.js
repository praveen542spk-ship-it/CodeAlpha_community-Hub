const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const FatigueTracker = require('../models/FatigueTracker');

// @route   POST api/fatigue/heartbeat
// @desc    Increment meeting duration counter for today
// @access  Private
router.post('/heartbeat', auth, async (req, res) => {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  
  try {
    let record = await FatigueTracker.findOne({ userId: req.user.id, date: today });
    
    if (!record) {
      record = new FatigueTracker({
        userId: req.user.id,
        date: today,
        totalMinutes: 1
      });
    } else {
      record.totalMinutes += 1;
      record.updatedAt = new Date();
    }
    
    await record.save();
    res.json({ totalMinutes: record.totalMinutes });
  } catch (err) {
    console.error('Fatigue Tracker error:', err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/fatigue/today
// @desc    Get today's total meeting duration
// @access  Private
router.get('/today', auth, async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    const record = await FatigueTracker.findOne({ userId: req.user.id, date: today });
    res.json({ totalMinutes: record ? record.totalMinutes : 0 });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
