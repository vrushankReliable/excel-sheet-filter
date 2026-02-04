/**
 * Vercel Serverless Function for Excel Processing
 * Handles file upload, processing, and returns ZIP directly
 */

const xlsx = require('xlsx');
const archiver = require('archiver');

/**
 * STRICT Indian Mobile Number Normalization
 */
const normalizeMobile = (rawMobile) => {
    if (!rawMobile) return { valid: false, reason: 'Empty value' };

    let clean = String(rawMobile).replace(/[^0-9]/g, '');

    if (clean.length === 10) {
        clean = '91' + clean;
    } else if (clean.length === 11 && clean.startsWith('0')) {
        clean = '91' + clean.substring(1);
    } else if (clean.length === 12 && clean.startsWith('91')) {
        // Already valid
    } else {
        return { valid: false, reason: 'Invalid length or format', original: rawMobile };
    }

    const indianMobileRegex = /^91[6-9][0-9]{9}$/;
    if (!indianMobileRegex.test(clean)) {
        return { valid: false, reason: 'Invalid Indian mobile pattern', original: rawMobile };
    }

    return { valid: true, mobile: clean };
};

/**
 * Process Excel Buffer and return processed data
 */
const processExcelBuffer = (buffer, batchSize = 1000) => {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    const uniqueLeads = new Map();
    const rejected = [];

    rows.forEach((row, index) => {
        const keys = Object.keys(row);
        
        const nameKey = keys.find(k => {
            const lower = k.toLowerCase().trim();
            return lower === 'contactname' || lower === 'contact name' || lower === 'contact_name';
        }) || keys.find(k => k.toLowerCase().includes('contact'));
        
        const mobileKey = keys.find(k => {
            const lower = k.toLowerCase().trim();
            return lower === 'phone2' || lower === 'phone 2' || lower === 'phone_2';
        });

        const rawName = nameKey ? row[nameKey] : '';
        const rawMobile = mobileKey ? row[mobileKey] : '';

        if (!rawName && !rawMobile) {
            rejected.push({ 
                row: index + 2, 
                reason: 'Missing Name and Mobile column data', 
                availableColumns: keys,
                data: row 
            });
            return;
        }

        let validMobileFound = false;
        let failureReason = 'No valid mobile found';

        if (rawMobile) {
            const candidates = String(rawMobile).split(/[,/|&\n]+/);
            
            for (const candidate of candidates) {
                const normResult = normalizeMobile(candidate.trim());
                if (normResult.valid) {
                    if (!uniqueLeads.has(normResult.mobile)) {
                        uniqueLeads.set(normResult.mobile, {
                            Name: rawName ? rawName.toString().trim() : 'Unknown',
                            Mobile: normResult.mobile
                        });
                    }
                    validMobileFound = true;
                    break;
                } else {
                    failureReason = normResult.reason;
                }
            }
        } else {
            failureReason = 'Mobile column empty';
        }

        if (!validMobileFound) {
            rejected.push({ row: index + 2, reason: failureReason, originalMobile: rawMobile, data: row });
        }
    });

    // Chunking
    const BATCH_SIZE = Math.max(1, Math.min(batchSize, 100000));
    const validLeads = Array.from(uniqueLeads.values());
    const chunks = [];

    for (let i = 0; i < validLeads.length; i += BATCH_SIZE) {
        const chunk = validLeads.slice(i, i + BATCH_SIZE);
        const newWb = xlsx.utils.book_new();
        const newWs = xlsx.utils.json_to_sheet(chunk);
        xlsx.utils.book_append_sheet(newWb, newWs, 'Leads');
        
        const buffer = xlsx.write(newWb, { type: 'buffer', bookType: 'xlsx' });
        chunks.push({
            name: `output_${Math.floor(i / BATCH_SIZE) + 1}.xlsx`,
            buffer: buffer
        });
    }

    return {
        chunks,
        rejected,
        stats: {
            totalRows: rows.length,
            valid: validLeads.length,
            rejected: rejected.length,
            chunksCount: chunks.length
        }
    };
};

/**
 * Create ZIP buffer from chunks
 */
const createZipBuffer = (chunks, rejected) => {
    return new Promise((resolve, reject) => {
        const archive = archiver('zip', { zlib: { level: 9 } });
        const buffers = [];

        archive.on('data', (data) => buffers.push(data));
        archive.on('end', () => resolve(Buffer.concat(buffers)));
        archive.on('error', (err) => reject(err));

        chunks.forEach(chunk => {
            archive.append(chunk.buffer, { name: chunk.name });
        });

        if (rejected && rejected.length > 0) {
            archive.append(JSON.stringify(rejected, null, 2), { name: 'rejected.json' });
        }

        archive.finalize();
    });
};

/**
 * Parse multipart manually (no external dependencies)
 */
const parseMultipartBody = (body, boundary) => {
    const parts = body.split(`--${boundary}`);
    let fileBuffer = null;
    let batchSize = 1000;

    for (const part of parts) {
        if (part.includes('name="file"')) {
            const headerEnd = part.indexOf('\r\n\r\n');
            if (headerEnd !== -1) {
                let content = part.slice(headerEnd + 4);
                // Remove trailing boundary markers
                const endIndex = content.lastIndexOf('\r\n');
                if (endIndex !== -1) {
                    content = content.slice(0, endIndex);
                }
                fileBuffer = Buffer.from(content, 'binary');
            }
        } else if (part.includes('name="batchSize"')) {
            const headerEnd = part.indexOf('\r\n\r\n');
            if (headerEnd !== -1) {
                let content = part.slice(headerEnd + 4).trim();
                const endIndex = content.indexOf('\r\n');
                if (endIndex !== -1) {
                    content = content.slice(0, endIndex);
                }
                const parsed = parseInt(content, 10);
                if (!isNaN(parsed)) {
                    batchSize = parsed;
                }
            }
        }
    }

    return { fileBuffer, batchSize };
};

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Expose-Headers', 'X-Stats-TotalRows, X-Stats-Valid, X-Stats-Rejected, X-Stats-Chunks');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Get boundary from content-type
        const contentType = req.headers['content-type'] || '';
        const boundaryMatch = contentType.match(/boundary=(.+)$/);
        
        if (!boundaryMatch) {
            return res.status(400).json({ error: 'Invalid content type - missing boundary' });
        }

        const boundary = boundaryMatch[1];
        
        // Read body
        const chunks = [];
        for await (const chunk of req) {
            chunks.push(chunk);
        }
        const bodyBuffer = Buffer.concat(chunks);
        const bodyString = bodyBuffer.toString('binary');

        // Parse multipart
        const { fileBuffer, batchSize } = parseMultipartBody(bodyString, boundary);
        
        if (!fileBuffer || fileBuffer.length === 0) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Process the Excel file
        const result = processExcelBuffer(fileBuffer, batchSize);
        
        if (result.chunks.length === 0) {
            return res.status(400).json({ 
                error: 'No valid leads found',
                stats: result.stats
            });
        }

        // Create ZIP buffer
        const zipBuffer = await createZipBuffer(result.chunks, result.rejected);

        // Return ZIP file directly
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', 'attachment; filename="processed_leads.zip"');
        res.setHeader('X-Stats-TotalRows', result.stats.totalRows.toString());
        res.setHeader('X-Stats-Valid', result.stats.valid.toString());
        res.setHeader('X-Stats-Rejected', result.stats.rejected.toString());
        res.setHeader('X-Stats-Chunks', result.stats.chunksCount.toString());
        
        return res.send(zipBuffer);

    } catch (error) {
        console.error('Processing Error:', error);
        return res.status(500).json({ 
            error: 'Processing failed', 
            details: error.message 
        });
    }
};

// Vercel config
module.exports.config = {
    api: {
        bodyParser: false,
    },
};
