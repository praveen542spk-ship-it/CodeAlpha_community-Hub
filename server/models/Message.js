const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    index: true,
  },
  sender: {
    type: String, // Store username for display, or we can use ref
    required: true,
  },
  text: {
    type: String, // Encrypted content (base64 or hex ciphertext)
    required: true,
  },
  isSystem: {
    type: Boolean,
    default: false,
  },
  reactions: [{
    user: String, // username
    emoji: String,
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model('Message', MessageSchema);
