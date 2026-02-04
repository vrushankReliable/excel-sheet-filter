const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileLabel = document.getElementById('file-label');
const uploadBtn = document.getElementById('upload-btn');
const responseArea = document.getElementById('response-area');
const batchSizeInput = document.getElementById('batch-size');

let selectedFile = null;

// Drag & Drop Events
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
        handleFileSelect(e.dataTransfer.files[0]);
    }
});

dropZone.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        handleFileSelect(e.target.files[0]);
    }
});

function handleFileSelect(file) {
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.csv')) {
        selectedFile = file;
        fileLabel.innerHTML = `<strong>${file.name}</strong><br>${(file.size / 1024 / 1024).toFixed(2)} MB`;
        uploadBtn.disabled = false;
        responseArea.style.display = 'none';
    } else {
        alert('Please upload a valid Excel (.xlsx) or CSV file.');
    }
}

uploadBtn.addEventListener('click', async () => {
    if (!selectedFile) return;

    // UI Loading State
    uploadBtn.innerHTML = '<div class="spinner"></div> Processing...';
    uploadBtn.disabled = true;

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('batchSize', batchSizeInput.value || 1000);

    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            showSuccess(data);
        } else {
            showError(data.error || 'Upload failed');
        }

    } catch (error) {
        showError('Network error occurred.');
        console.error(error);
    } finally {
        uploadBtn.innerHTML = 'Start Processing';
        uploadBtn.disabled = false;
    }
});

function showSuccess(data) {
    responseArea.style.display = 'block';
    
    // Create Stats HTML
    const statsHtml = `
        <div class="stats-card">
            <div class="stat-row"><span>Total Rows Scanned:</span> <span class="stat-val">${data.stats.totalRows}</span></div>
            <div class="stat-row"><span>Valid Leads:</span> <span class="stat-val" style="color:#10b981">${data.stats.valid}</span></div>
            <div class="stat-row"><span>Rejected / Duplicates:</span> <span class="stat-val" style="color:#ef4444">${data.stats.rejected}</span></div>
            <div class="stat-row"><span>Files Generated:</span> <span class="stat-val">${data.stats.chunks}</span></div>
        </div>
        <a href="${data.downloadUrl}" class="btn" style="display:block; text-align:center; margin-top:1rem; text-decoration:none;">Download ZIP</a>
    `;

    responseArea.innerHTML = `<div class="success-msg">Processing Complete!</div>` + statsHtml;
}

function showError(msg) {
    responseArea.style.display = 'block';
    responseArea.innerHTML = `<div class="error-msg">Error: ${msg}</div>`;
}
