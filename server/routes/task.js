const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Task = require('../models/Task');

// @route   GET api/tasks/:roomId
// @desc    Get all tasks for a room
// @access  Private
router.get('/:roomId', auth, async (req, res) => {
  try {
    const tasks = await Task.find({ roomId: req.params.roomId }).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   POST api/tasks
// @desc    Create a new task
// @access  Private
router.post('/', auth, async (req, res) => {
  const { roomId, title, description, assignedTo } = req.body;

  try {
    const newTask = new Task({
      roomId,
      title,
      description,
      assignedTo,
    });

    const task = await newTask.save();
    res.json(task);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   PUT api/tasks/:taskId
// @desc    Update a task (e.g. status or description)
// @access  Private
router.put('/:taskId', auth, async (req, res) => {
  const { title, description, status, assignedTo } = req.body;

  try {
    let task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ msg: 'Task not found' });
    }

    // Update fields
    if (title !== undefined) task.title = title;
    if (description !== undefined) task.description = description;
    if (status !== undefined) task.status = status;
    if (assignedTo !== undefined) task.assignedTo = assignedTo;

    await task.save();
    res.json(task);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   DELETE api/tasks/:taskId
// @desc    Delete a task
// @access  Private
router.delete('/:taskId', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ msg: 'Task not found' });
    }

    await Task.findByIdAndDelete(req.params.taskId);
    res.json({ msg: 'Task removed' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
