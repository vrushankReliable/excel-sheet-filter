const fs = require('fs');
const archiver = require('archiver');
const path = require('path');

const createZip = (sourceFiles, outputZipPath, rejectedData) => {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(outputZipPath);
        const archive = archiver('zip', {
            zlib: { level: 9 } // Sets the compression level.
        });

        output.on('close', function() {
            resolve(outputZipPath);
        });

        archive.on('error', function(err) {
            reject(err);
        });

        archive.pipe(output);

        // Add Excel files
        sourceFiles.forEach(file => {
            archive.file(file, { name: path.basename(file) });
        });

        // Add rejected.json if exists
        if (rejectedData && rejectedData.length > 0) {
            archive.append(JSON.stringify(rejectedData, null, 2), { name: 'rejected.json' });
        }

        archive.finalize();
    });
};

const cleanupFiles = (files) => {
    files.forEach(file => {
        if (fs.existsSync(file)) {
            fs.unlinkSync(file);
        }
    });
};

module.exports = { createZip, cleanupFiles };
