// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const audioFileInput = document.getElementById('audioFile');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const targetLanguage = document.getElementById('targetLanguage');
const translateBtn = document.getElementById('translateBtn');
const loader = document.getElementById('loader');
const resultSection = document.getElementById('resultSection');
const translatedAudio = document.getElementById('translatedAudio');
const downloadBtn = document.getElementById('downloadBtn');
const successAlert = document.getElementById('successAlert');
const errorAlert = document.getElementById('errorAlert');
const infoAlert = document.getElementById('infoAlert');

// Recording elements
const recordBtn = document.getElementById('recordBtn');
const recordStatus = document.getElementById('recordStatus');
const recordTimer = document.getElementById('recordTimer');

// Real-time elements
const realtimeLanguage = document.getElementById('realtimeLanguage');
const realtimeBtn = document.getElementById('realtimeBtn');
const realtimeStatus = document.getElementById('realtimeStatus');
const realtimeTimer = document.getElementById('realtimeTimer');
const realtimeResult = document.getElementById('realtimeResult');
const realtimeAudio = document.getElementById('realtimeAudio');
const realtimeDownloadBtn = document.getElementById('realtimeDownloadBtn');

// Language selector visibility
const normalLanguageSelector = document.getElementById('normalLanguageSelector');

// State variables
let uploadedFile = null;
let outputFileName = null;
let mediaRecorder = null;
let audioChunks = [];
let recordingInterval = null;
let recordingSeconds = 0;
let isRecording = false;
let currentTab = 'upload';
let audioContext = null;
let audioStream = null;
let audioRecorder = null;

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.getAttribute('data-tab');
        switchTab(tabName);
    });
});

function switchTab(tabName) {
    currentTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`${tabName}-content`).classList.add('active');

    // Show/hide language selector and translate button
    if (tabName === 'realtime') {
        normalLanguageSelector.style.display = 'none';
        translateBtn.style.display = 'none';
        resultSection.classList.remove('show');
    } else {
        normalLanguageSelector.style.display = 'block';
        translateBtn.style.display = 'block';
        realtimeResult.classList.remove('show');
    }

    // Reset states
    hideAlerts();
    resultSection.classList.remove('show');
    realtimeResult.classList.remove('show');
}

// Upload area click handler
uploadArea.addEventListener('click', () => {
    audioFileInput.click();
});

// Drag and drop handlers
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFileSelect(files[0]);
    }
});

// File input change handler
audioFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
    }
});

// Handle file selection
function handleFileSelect(file) {
    // Validate file type
    const validTypes = ['audio/wav', 'audio/mpeg', 'audio/mp3'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(wav|mp3)$/i)) {
        showError('Please upload a valid audio file (WAV or MP3)');
        return;
    }

    // Validate file size (50MB)
    if (file.size > 50 * 1024 * 1024) {
        showError('File size must be less than 50MB');
        return;
    }

    uploadedFile = file;
    fileName.textContent = file.name;
    fileInfo.classList.add('show');
    hideAlerts();
    
    // Upload the file
    uploadFile(file);
}

// Upload file to server
async function uploadFile(file) {
    const formData = new FormData();
    formData.append('audio', file);

    try {
        showInfo('Uploading audio file...');
        
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok && data.success) {
            showSuccess('Audio file uploaded successfully!');
            checkTranslateButton();
        } else {
            showError(data.error || 'Failed to upload file');
            fileInfo.classList.remove('show');
        }
    } catch (error) {
        showError('Error uploading file: ' + error.message);
        fileInfo.classList.remove('show');
    }
}

// Language selection handler
targetLanguage.addEventListener('change', () => {
    checkTranslateButton();
});

// Check if translate button should be enabled
function checkTranslateButton() {
    if (uploadedFile && targetLanguage.value) {
        translateBtn.disabled = false;
    } else {
        translateBtn.disabled = true;
    }
}

// Translate button handler
translateBtn.addEventListener('click', async () => {
    if (!uploadedFile || !targetLanguage.value) {
        showError('Please upload an audio file and select a target language');
        return;
    }

    try {
        translateBtn.disabled = true;
        loader.classList.add('show');
        resultSection.classList.remove('show');
        hideAlerts();
        showInfo('Translating audio... This may take a moment.');

        const response = await fetch('/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                target_language: targetLanguage.value
            })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            outputFileName = data.output_file;
            showSuccess('Translation completed successfully!');

            // Load and display the translated audio
            translatedAudio.src = `/play/${outputFileName}`;
            resultSection.classList.add('show');

            // Auto-play the translated audio
            translatedAudio.play().catch(err => {
                console.log('Auto-play prevented by browser:', err);
            });
        } else {
            showError(data.error || 'Translation failed');
            translateBtn.disabled = false;
        }
    } catch (error) {
        showError('Error during translation: ' + error.message);
        translateBtn.disabled = false;
    } finally {
        loader.classList.remove('show');
        checkTranslateButton();
    }
});

// Download button handler
downloadBtn.addEventListener('click', () => {
    if (outputFileName) {
        window.location.href = `/download/${outputFileName}`;
    }
});

// Alert functions
function showSuccess(message) {
    hideAlerts();
    successAlert.textContent = message;
    successAlert.classList.add('show');
}

function showError(message) {
    hideAlerts();
    errorAlert.textContent = message;
    errorAlert.classList.add('show');
}

function showInfo(message) {
    hideAlerts();
    infoAlert.textContent = message;
    infoAlert.classList.add('show');
}

function hideAlerts() {
    successAlert.classList.remove('show');
    errorAlert.classList.remove('show');
    infoAlert.classList.remove('show');
}

// Recording functionality
recordBtn.addEventListener('click', toggleRecording);

async function toggleRecording() {
    if (!isRecording) {
        await startRecording('record');
    } else {
        stopRecording('record');
    }
}

async function startRecording(mode) {
    try {
        // Get microphone stream
        audioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                sampleRate: 16000,
                echoCancellation: true,
                noiseSuppression: true
            }
        });

        // Create AudioContext for raw audio processing
        audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        const source = audioContext.createMediaStreamSource(audioStream);

        // Create ScriptProcessor to capture raw audio data
        const bufferSize = 4096;
        const processor = audioContext.createScriptProcessor(bufferSize, 1, 1);

        audioChunks = [];
        recordingSeconds = 0;
        isRecording = true;

        const btn = mode === 'record' ? recordBtn : realtimeBtn;
        const status = mode === 'record' ? recordStatus : realtimeStatus;
        const timer = mode === 'record' ? recordTimer : realtimeTimer;

        btn.classList.add('recording');
        btn.innerHTML = '<i class="fas fa-stop"></i>';
        status.textContent = 'Recording... Click to stop';

        // Capture audio data
        processor.onaudioprocess = (e) => {
            if (isRecording) {
                const inputData = e.inputBuffer.getChannelData(0);
                audioChunks.push(new Float32Array(inputData));
            }
        };

        // Connect audio nodes
        source.connect(processor);
        processor.connect(audioContext.destination);

        // Store processor for stopping later
        audioRecorder = { processor, source };

        // Start timer
        recordingInterval = setInterval(() => {
            recordingSeconds++;
            const minutes = Math.floor(recordingSeconds / 60);
            const seconds = recordingSeconds % 60;
            timer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

            // Auto-stop after 5 minutes
            if (recordingSeconds >= 300) {
                stopRecording(mode);
            }
        }, 1000);

    } catch (error) {
        showError('Microphone access denied. Please allow microphone access.');
        console.error('Error accessing microphone:', error);
    }
}

// Function to create WAV blob from Float32Array chunks
function createWavBlob(audioChunks, sampleRate) {
    // Merge all chunks into single Float32Array
    let totalLength = 0;
    audioChunks.forEach(chunk => {
        totalLength += chunk.length;
    });

    const mergedAudio = new Float32Array(totalLength);
    let offset = 0;
    audioChunks.forEach(chunk => {
        mergedAudio.set(chunk, offset);
        offset += chunk.length;
    });

    // Convert Float32 to Int16
    const int16Audio = new Int16Array(mergedAudio.length);
    for (let i = 0; i < mergedAudio.length; i++) {
        const s = Math.max(-1, Math.min(1, mergedAudio[i]));
        int16Audio[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    // Create WAV file
    const wavBuffer = createWavBuffer(int16Audio, sampleRate);
    return new Blob([wavBuffer], { type: 'audio/wav' });
}

// Function to create WAV file buffer
function createWavBuffer(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    // WAV header
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // byte rate
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);

    // Write audio data
    const offset = 44;
    for (let i = 0; i < samples.length; i++) {
        view.setInt16(offset + i * 2, samples[i], true);
    }

    return buffer;
}

// Helper function to write string to DataView
function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

async function stopRecording(mode) {
    if (!isRecording || !audioRecorder) return;

    isRecording = false;
    clearInterval(recordingInterval);

    const btn = mode === 'record' ? recordBtn : realtimeBtn;
    const status = mode === 'record' ? recordStatus : realtimeStatus;

    btn.classList.remove('recording');
    btn.innerHTML = '<i class="fas fa-microphone"></i>';
    status.textContent = 'Processing...';

    // Disconnect audio nodes
    audioRecorder.processor.disconnect();
    audioRecorder.source.disconnect();

    // Stop all audio tracks
    if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop());
    }

    // Close audio context
    if (audioContext) {
        await audioContext.close();
    }

    // Convert Float32Array chunks to WAV blob
    const wavBlob = createWavBlob(audioChunks, 16000);

    console.log('Created WAV blob:', wavBlob.size, 'bytes');

    if (mode === 'realtime') {
        // Real-time mode: auto-translate
        await uploadAndTranslateRealtime(wavBlob);
    } else {
        // Normal record mode: just upload
        await uploadRecordedAudio(wavBlob);
    }
}

async function uploadRecordedAudio(audioBlob) {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recorded_audio.wav');

    try {
        showInfo('Uploading recorded audio...');

        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok && data.success) {
            uploadedFile = audioBlob;
            fileName.textContent = 'recorded_audio.wav';
            fileInfo.classList.add('show');
            showSuccess('Audio recorded and uploaded successfully!');
            recordStatus.textContent = 'Recording complete! Click to record again';
            recordTimer.textContent = '00:00';
            checkTranslateButton();
        } else {
            showError(data.error || 'Failed to upload recorded audio');
            recordStatus.textContent = 'Click the button to start recording';
            recordTimer.textContent = '00:00';
        }
    } catch (error) {
        showError('Error uploading recorded audio: ' + error.message);
        recordStatus.textContent = 'Click the button to start recording';
        recordTimer.textContent = '00:00';
    }
}

// Real-time translation
realtimeLanguage.addEventListener('change', () => {
    if (realtimeLanguage.value) {
        realtimeBtn.disabled = false;
        realtimeStatus.textContent = 'Click the button to start speaking';
    } else {
        realtimeBtn.disabled = true;
        realtimeStatus.textContent = 'Select language first, then click to speak';
    }
});

realtimeBtn.addEventListener('click', toggleRealtimeRecording);

async function toggleRealtimeRecording() {
    if (!realtimeLanguage.value) {
        showError('Please select a target language first');
        return;
    }

    if (!isRecording) {
        await startRecording('realtime');
    } else {
        stopRecording('realtime');
    }
}

async function uploadAndTranslateRealtime(audioBlob) {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'realtime_audio.wav');

    try {
        showInfo('Uploading and translating...');
        realtimeStatus.textContent = 'Translating...';

        // Upload
        const uploadResponse = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        const uploadData = await uploadResponse.json();

        if (!uploadResponse.ok || !uploadData.success) {
            throw new Error(uploadData.error || 'Upload failed');
        }

        // Translate
        const translateResponse = await fetch('/translate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                target_language: realtimeLanguage.value
            })
        });

        const translateData = await translateResponse.json();

        if (translateResponse.ok && translateData.success) {
            outputFileName = translateData.output_file;
            showSuccess('Translation complete!');

            // Load and display the translated audio
            realtimeAudio.src = `/play/${outputFileName}`;
            realtimeResult.classList.add('show');

            // Auto-play the translated audio
            realtimeAudio.play().catch(err => {
                console.log('Auto-play prevented by browser:', err);
            });

            realtimeStatus.textContent = 'Translation complete! Click to speak again';
            realtimeTimer.textContent = '00:00';
        } else {
            throw new Error(translateData.error || 'Translation failed');
        }
    } catch (error) {
        showError('Error: ' + error.message);
        realtimeStatus.textContent = 'Error occurred. Click to try again';
        realtimeTimer.textContent = '00:00';
    }
}

// Real-time download button
realtimeDownloadBtn.addEventListener('click', () => {
    if (outputFileName) {
        window.location.href = `/download/${outputFileName}`;
    }
});

