const mongoose = require('mongoose');

const FileSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    index: true,
  },
  sender: {
    type: String, // username
    required: true,
  },
  fileName: {
    type: String, // Encrypted file name
    required: true,
  },
  fileType: {
    type: String,
    required: true,
  },
  fileSize: {
    type: Number,
    required: true,
  },
  gridFsId: {
    type: mongoose.Schema.Types.ObjectId, // reference to fs.files
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model('File', FileSchema);
