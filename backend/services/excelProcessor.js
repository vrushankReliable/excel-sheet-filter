const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');
const { normalizeMobile } = require('../utils/normalizeUtils');
const { createZip, cleanupFiles } = require('../utils/fileUtils');
const { v4: uuidv4 } = require('uuid');

const processExcel = async (filePath, batchSize = 1000) => {
    try {
        // 1. Read File
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Convert to JSON (Header: 1 means array of arrays [row1, row2...])
        // using raw: false to ensure we get strings, but might be slower. 
        // Better to used defval: '' to handle empty cells.
        const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

        const uniqueLeads = new Map(); // Key: Normalized Mobile, Value: { Name, Mobile }
        const rejected = [];

        // 2. Iterate & Filter & Normalize
        rows.forEach((row, index) => {
            // Identify columns - Specific mapping for user's data
            const keys = Object.keys(row);
            
            // Look for ContactName column (exact or partial match)
            const nameKey = keys.find(k => {
                const lower = k.toLowerCase().trim();
                return lower === 'contactname' || lower === 'contact name' || lower === 'contact_name';
            }) || keys.find(k => k.toLowerCase().includes('contact'));
            
            // Look for Phone2 column specifically
            const mobileKey = keys.find(k => {
                const lower = k.toLowerCase().trim();
                return lower === 'phone2' || lower === 'phone 2' || lower === 'phone_2';
            });

            const rawName = nameKey ? row[nameKey] : '';
            const rawMobile = mobileKey ? row[mobileKey] : '';

            // Basic availability check
            if (!rawName && !rawMobile) {
                rejected.push({ 
                    row: index + 2, 
                    reason: 'Missing Name and Mobile column data', 
                    availableColumns: keys,
                    data: row 
                });
                return;
            }

            // Handle potential multiple numbers in one cell (split by comma, slash, etc.)
            let validMobileFound = false;
            let failureReason = 'No valid mobile found';

            if (rawMobile) {
                // Split by common delimiters: , / | & and newline
                const candidates = String(rawMobile).split(/[,/|&\n]+/);
                
                for (const candidate of candidates) {
                    const normResult = normalizeMobile(candidate.trim());
                    if (normResult.valid) {
                        // 3. Deduplicate (first valid match in the cell wins)
                        if (!uniqueLeads.has(normResult.mobile)) {
                            uniqueLeads.set(normResult.mobile, {
                                Name: rawName ? rawName.toString().trim() : 'Unknown', // Allow name to be empty if mobile is present? Requirement said filter Name/Mobile.
                                Mobile: normResult.mobile
                            });
                        }
                        validMobileFound = true;
                        break; // Stop after finding the first valid mobile in this row
                    } else {
                        failureReason = normResult.reason; // Capture last reason
                    }
                }
            } else {
                failureReason = 'Mobile column empty';
            }

            if (!validMobileFound) {
                rejected.push({ row: index + 2, reason: failureReason, originalMobile: rawMobile, data: row });
            }
        });

        // 4. Chunking
        const BATCH_SIZE = Math.max(1, Math.min(batchSize, 100000)); // Clamp between 1 and 100000
        const validLeads = Array.from(uniqueLeads.values());
        const totalLeads = validLeads.length;
        const generatedFiles = [];
        const outputsDir = path.join(__dirname, '../../outputs');

        for (let i = 0; i < totalLeads; i += BATCH_SIZE) {
            const chunk = validLeads.slice(i, i + BATCH_SIZE);
            const newWb = xlsx.utils.book_new();
            const newWs = xlsx.utils.json_to_sheet(chunk);
            xlsx.utils.book_append_sheet(newWb, newWs, 'Leads');

            const fileName = `output_${Math.floor(i / BATCH_SIZE) + 1}.xlsx`;
            const filePath = path.join(outputsDir, fileName);
            xlsx.writeFile(newWb, filePath);
            generatedFiles.push(filePath);
        }

        // 5. Zip
        const jobId = uuidv4();
        const zipName = `processed_leads_${jobId}.zip`;
        const zipPath = path.join(outputsDir, zipName);

        await createZip(generatedFiles, zipPath, rejected);

        // 6. Cleanup Intermediate Files
        cleanupFiles(generatedFiles); 
        // Don't delete the uploaded file here if we want to debug, but in prod we should. 
        // Let's delete it.
        fs.unlinkSync(filePath);

        return {
            jobId,
            zipPath,
            zipName,
            stats: {
                totalRows: rows.length,
                valid: totalLeads,
                rejected: rejected.length,
                chunks: generatedFiles.length
            }
        };

    } catch (error) {
        throw error;
    }
};

module.exports = { processExcel };
