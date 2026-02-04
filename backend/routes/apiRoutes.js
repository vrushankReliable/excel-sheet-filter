const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const multer = require('multer');
const path = require('path');

// Multer Setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.includes('excel') || file.mimetype.includes('spreadsheetml') || file.mimetype.includes('csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel or CSV files are allowed!'), false);
        }
    }
});

router.post('/upload', upload.single('file'), uploadController.handleUpload);
router.get('/download/:fileId', uploadController.handleDownload);

module.exports = router;
