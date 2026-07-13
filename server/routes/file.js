const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const { GridFsStorage } = require('multer-gridfs-storage');
const Grid = require('gridfs-stream');
const auth = require('../middleware/auth');
const FileModel = require('../models/File');
const path = require('path');

// We initialize GridFS when connection is open
let gfs, gridfsBucket;
const conn = mongoose.connection;
conn.once('open', () => {
  gridfsBucket = new mongoose.mongo.GridFSBucket(conn.db, {
    bucketName: 'uploads'
  });
  gfs = Grid(conn.db, mongoose.mongo);
  gfs.collection('uploads');
});

// Create GridFS Storage engine
const storage = new GridFsStorage({
  url: process.env.MONGO_URI,
  options: { tlsAllowInvalidCertificates: true },
  file: (req, file) => {
    return {
      filename: file.fieldname + '-' + Date.now() + path.extname(file.originalname),
      bucketName: 'uploads'
    };
  }
});

const upload = multer({ storage });

// @route   POST api/file/upload
// @desc    Upload file to GridFS and return metadata
// @access  Private
router.post('/upload', [auth, upload.single('file')], async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ msg: 'No file uploaded' });
  }

  const { roomId, encryptedName } = req.body;

  try {
    const fileMeta = new FileModel({
      roomId,
      sender: req.user.username,
      fileName: encryptedName || req.file.originalname, // Store encrypted name for E2EE
      fileType: fileMeta?.fileType || req.file.mimetype || 'application/octet-stream',
      fileSize: req.file.size,
      gridFsId: req.file.id
    });

    await fileMeta.save();
    res.json(fileMeta);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/file/download/:gridFsId
// @desc    Download file from GridFS
// @access  Public
router.get('/download/:gridFsId', async (req, res) => {
  try {
    const fileId = new mongoose.Types.ObjectId(req.params.gridFsId);
    
    // Check if file exists
    const files = await gridfsBucket.find({ _id: fileId }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ msg: 'File not found' });
    }

    const file = files[0];
    res.set('Content-Type', file.contentType || 'application/octet-stream');
    res.set('Content-Disposition', `attachment; filename="${file.filename}"`);

    const readStream = gridfsBucket.openDownloadStream(fileId);
    readStream.pipe(res);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// @route   GET api/file/list/:roomId
// @desc    Get all file metadata for a specific room
// @access  Private
router.get('/list/:roomId', auth, async (req, res) => {
  try {
    const files = await FileModel.find({ roomId }).sort({ createdAt: -1 });
    res.json(files);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
