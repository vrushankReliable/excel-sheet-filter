const { processExcel } = require('../services/excelProcessor');
const path = require('path');
const fs = require('fs');

const handleUpload = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const batchSize = parseInt(req.body.batchSize) || 1000;
        const result = await processExcel(req.file.path, batchSize);
        res.json({
            success: true,
            jobId: result.jobId,
            downloadUrl: `/api/download/${result.jobId}`, // Client uses this directly
            stats: result.stats
        });
    } catch (error) {
        console.error('Processing Error:', error);
        res.status(500).json({ error: 'Processing failed', details: error.message });
    }
};

const handleDownload = (req, res) => {
    const fileId = req.params.fileId;
    // Security: basic check to prevent directory traversal
    if (!fileId || !/^[a-zA-Z0-9-]+$/.test(fileId)) {
        return res.status(400).send('Invalid File ID');
    }

    const fileName = `processed_leads_${fileId}.zip`;
    const filePath = path.join(__dirname, '../../outputs', fileName);

    if (fs.existsSync(filePath)) {
        res.download(filePath, fileName, (err) => {
            if (err) {
                 // handle error
            } else {
                // Delete ZIP after download? Maybe keep for a bit. 
                // For this simple app, let's keep it or implement a cron cleanup later.
                // We keep it for now.
            }
        });
    } else {
        res.status(404).json({ error: 'File not found or expired' });
    }
};

module.exports = { handleUpload, handleDownload };
