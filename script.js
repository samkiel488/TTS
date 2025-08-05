// UltraTTS Pro - Advanced AI TTS Engine
class UltraTTS {
    constructor() {
        this.apiKey = localStorage.getItem('elevenlabs_api_key') || '';
        this.baseUrl = 'https://api.elevenlabs.io/v1';
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.currentAudio = null;
        this.backgroundMusic = null;
        this.isPlaying = false;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.loadVoices();
        this.setupThemeToggle();
        this.setupFileUpload();
        this.setupSSMLEditor();
        this.setupExportButtons();
        this.setupBackgroundMusic();
    }

    // API Integration
    async makeRequest(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            headers: {
                'xi-api-key': this.apiKey,
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };
        
        try {
            const response = await fetch(url, config);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response;
        } catch (error) {
            console.error('API Error:', error);
            this.showNotification('API Error: Check your key and connection', 'error');
            throw error;
        }
    }

    // Voice Management
    async loadVoices() {
        const voiceSelect = document.getElementById('voice-select');
        if (!this.apiKey) {
            this.showNotification('No API key found. Using browser voices as fallback.', 'info');
            // Load browser voices as fallback
            const synth = window.speechSynthesis;
            const loadBrowserVoices = () => {
                const voices = synth.getVoices();
                if (voices.length === 0) {
                    // Voices not loaded yet, retry after a delay
                    setTimeout(loadBrowserVoices, 100);
                    return;
                }
                voiceSelect.innerHTML = voices.map(voice =>
                    `<option value="${voice.name}">${voice.name} (${voice.lang})</option>`
                ).join('');
                voiceSelect.value = voices[0]?.name || '';
                console.log('Browser voices loaded:', voices.length);
            };
            loadBrowserVoices();
            return;
        }

        console.log('Loading voices with API key:', this.apiKey);

        try {
            const response = await this.makeRequest('/voices');
            const data = await response.json();
            
            voiceSelect.innerHTML = data.voices.map(voice => 
                `<option value="${voice.voice_id}">${voice.name} (${voice.labels?.accent || 'English'})</option>`
            ).join('');
            
            if (data.voices.length > 0) {
                voiceSelect.value = data.voices[0].voice_id;
            }
            console.log('Voices loaded:', data.voices.length);
        } catch (error) {
            console.error('Failed to load voices:', error);
            voiceSelect.innerHTML = '<option value="">Failed to load voices. Check API key.</option>';
        }
    }

    // Text-to-Speech
    async synthesizeSpeech(text, voiceId, options = {}) {
        if (!this.apiKey) {
            // Use browser SpeechSynthesis API as fallback
            return new Promise((resolve, reject) => {
                const synth = window.speechSynthesis;
                const utterance = new SpeechSynthesisUtterance(text);
                const voices = synth.getVoices();
                const voice = voices.find(v => v.name === voiceId);
                if (voice) {
                    utterance.voice = voice;
                }
                utterance.rate = parseFloat(document.getElementById('speed').value);
                utterance.pitch = 1.0; // No pitch control in fallback
                synth.speak(utterance);

                // Since browser API does not provide audio buffer, resolve null
                resolve(null);
            });
        }

        const payload = {
            text: text,
            model_id: document.getElementById('model-select').value || 'eleven_monolingual_v1',
            voice_settings: {
                stability: parseFloat(document.getElementById('stability').value),
                similarity_boost: parseFloat(document.getElementById('similarity').value),
                speed: parseFloat(document.getElementById('speed').value)
            }
        };

        try {
            const response = await this.makeRequest(`/text-to-speech/${voiceId}`, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
            
            return await response.arrayBuffer();
        } catch (error) {
            if (!this.apiKey) {
                // Suppress API error if no API key (fallback mode)
                console.warn('API request failed but no API key set, ignoring error.');
                return null;
            }
            throw error;
        }
    }

    // Audio Playback
    async playAudio(audioBuffer) {
        try {
            if (this.currentAudio) {
                this.currentAudio.pause();
                this.currentAudio = null;
            }

            const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });
            const audioUrl = URL.createObjectURL(audioBlob);
            
            this.currentAudio = new Audio(audioUrl);
            
            // Add background music if selected
            if (this.backgroundMusic) {
                this.currentAudio.volume = 0.7;
            }
            
            this.currentAudio.play();
            this.isPlaying = true;
            
            this.currentAudio.addEventListener('ended', () => {
                this.isPlaying = false;
                this.stopBackgroundMusic();
            });
            
        } catch (error) {
            console.error('Playback error:', error);
            this.showNotification('Playback failed', 'error');
        }
    }

    // Background Music
    setupBackgroundMusic() {
        const musicSelect = document.getElementById('bg-music-select');
        const volumeSlider = document.getElementById('bg-volume');
        
        musicSelect.addEventListener('change', (e) => {
            const musicType = e.target.value;
            if (musicType) {
                this.startBackgroundMusic(musicType);
            } else {
                this.stopBackgroundMusic();
            }
        });
        
        volumeSlider.addEventListener('input', (e) => {
            if (this.backgroundMusic) {
                this.backgroundMusic.volume = e.target.value;
            }
        });
    }

    async startBackgroundMusic(type) {
        const musicUrls = {
            ambient: 'https://www.soundjay.com/misc/sounds/ambient-music.mp3',
            classical: 'https://www.soundjay.com/misc/sounds/classical-music.mp3',
            lofi: 'https://www.soundjay.com/misc/sounds/lofi-music.mp3'
        };
        
        if (this.backgroundMusic) {
            this.backgroundMusic.pause();
        }
        
        this.backgroundMusic = new Audio(musicUrls[type]);
        this.backgroundMusic.loop = true;
        this.backgroundMusic.volume = document.getElementById('bg-volume').value;
        this.backgroundMusic.play().catch(console.error);
    }

    stopBackgroundMusic() {
        if (this.backgroundMusic) {
            this.backgroundMusic.pause();
            this.backgroundMusic = null;
        }
    }

    // File Upload & OCR
    setupFileUpload() {
        const fileUpload = document.getElementById('file-upload');
        fileUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const fileExtension = file.name.split('.').pop().toLowerCase();
            
            try {
                if (fileExtension === 'txt') {
                    const text = await this.readTextFile(file);
                    document.getElementById('text-input').value = text;
                } else if (['jpg', 'jpeg', 'png'].includes(fileExtension)) {
                    await this.performOCR(file);
                } else if (['pdf', 'docx'].includes(fileExtension)) {
                    this.showNotification('PDF/DOCX support coming soon!', 'info');
                }
            } catch (error) {
                console.error('File processing error:', error);
                this.showNotification('Failed to process file', 'error');
            }
        });
    }

    async readTextFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsText(file);
        });
    }

    async performOCR(file) {
        this.showNotification('Processing image for text...', 'info');
        
        try {
            const { data: { text } } = await Tesseract.recognize(file, 'eng');
            document.getElementById('text-input').value = text;
            this.showNotification('OCR completed!', 'success');
        } catch (error) {
            console.error('OCR error:', error);
            this.showNotification('OCR failed', 'error');
        }
    }

    // SSML Editor
    setupSSMLEditor() {
        const modal = document.getElementById('ssml-modal');
        const toggleBtn = document.getElementById('ssml-toggle');
        const closeBtn = document.getElementById('close-ssml');
        const applyBtn = document.getElementById('apply-ssml');
        
        toggleBtn.addEventListener('click', () => {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
            document.getElementById('ssml-editor').value = document.getElementById('text-input').value;
        });
        
        closeBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        });
        
        applyBtn.addEventListener('click', () => {
            document.getElementById('text-input').value = document.getElementById('ssml-editor').value;
            modal.classList.add('hidden');
            modal.classList.remove('flex');
            this.showNotification('SSML applied!', 'success');
        });
    }

    // Export Audio
    setupExportButtons() {
        document.getElementById('export-mp3').addEventListener('click', () => this.exportAudio('mp3'));
        document.getElementById('export-wav').addEventListener('click', () => this.exportAudio('wav'));
    }

    async exportAudio(format) {
        const text = document.getElementById('text-input').value;
        const voiceId = document.getElementById('voice-select').value;
        
        if (!text || !voiceId) {
            this.showNotification('Please enter text and select a voice', 'warning');
            return;
        }

        try {
            this.showNotification('Generating audio...', 'info');
            const audioBuffer = await this.synthesizeSpeech(text, voiceId);

            if (!audioBuffer) {
                this.showNotification('Export not supported in browser voice fallback mode.', 'warning');
                return;
            }
            
            const blob = new Blob([audioBuffer], { type: `audio/${format}` });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `ultratts-${Date.now()}.${format}`;
            a.click();
            
            URL.revokeObjectURL(url);
            this.showNotification('Audio exported successfully!', 'success');
            
        } catch (error) {
            console.error('Export error:', error);
            this.showNotification('Export failed', 'error');
        }
    }

    // Event Listeners
    setupEventListeners() {
        // Play controls
        document.getElementById('play-btn').addEventListener('click', () => this.handlePlay());
        document.getElementById('pause-btn').addEventListener('click', () => this.handlePause());
        document.getElementById('stop-btn').addEventListener('click', () => this.handleStop());
        
        // Sliders
        ['speed', 'stability', 'similarity'].forEach(id => {
            const slider = document.getElementById(id);
            const valueSpan = document.getElementById(`${id}-value`);
            slider.addEventListener('input', (e) => {
                valueSpan.textContent = e.target.value;
            });
        });
        
        // API Key
        document.getElementById('save-api-key').addEventListener('click', () => {
            const key = document.getElementById('api-key').value;
            if (key) {
                this.apiKey = key;
                localStorage.setItem('elevenlabs_api_key', key);
                this.loadVoices();
                this.showNotification('API key saved!', 'success');
            }
        });
        
        // Character counter
        document.getElementById('text-input').addEventListener('input', (e) => {
            document.getElementById('char-count').textContent = `${e.target.value.length} characters`;
        });
    }

    // Playback Handlers
    async handlePlay() {
        const text = document.getElementById('text-input').value;
        const voiceId = document.getElementById('voice-select').value;
        
        if (!text) {
            this.showNotification('Please enter text to synthesize', 'warning');
            return;
        }
        
        if (!voiceId) {
            this.showNotification('Please select a voice', 'warning');
            return;
        }
        
        try {
            this.showNotification('Synthesizing speech...', 'info');
            const audioBuffer = await this.synthesizeSpeech(text, voiceId);
            await this.playAudio(audioBuffer);
            this.showNotification('Playing audio...', 'success');
        } catch (error) {
            console.error('Play error:', error);
            this.showNotification('Failed to play audio', 'error');
        }
    }

    handlePause() {
        if (this.currentAudio && !this.currentAudio.paused) {
            this.currentAudio.pause();
            this.showNotification('Audio paused', 'info');
        }
    }

    handleStop() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.isPlaying = false;
            this.stopBackgroundMusic();
            this.showNotification('Audio stopped', 'info');
        }
    }

    // Theme Toggle
    setupThemeToggle() {
        const themeToggle = document.getElementById('theme-toggle');
        const html = document.documentElement;
        
        // Load saved theme
        const savedTheme = localStorage.getItem('theme') || 'dark';
        console.log('Loaded theme:', savedTheme);
        if (savedTheme === 'dark') {
            html.classList.add('dark');
        } else {
            html.classList.remove('dark');
        }
        this.updateThemeIcon(savedTheme);
        
        themeToggle.addEventListener('click', () => {
            const isDark = html.classList.contains('dark');
            const newTheme = isDark ? 'light' : 'dark';
            console.log('Toggling theme to:', newTheme);
            if (newTheme === 'dark') {
                html.classList.add('dark');
            } else {
                html.classList.remove('dark');
            }
            localStorage.setItem('theme', newTheme);
            this.updateThemeIcon(newTheme);
        });
    }

    updateThemeIcon(theme) {
        const icon = document.querySelector('#theme-toggle i');
        icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }

    // Notifications
    showNotification(message, type = 'info') {
        const colors = {
            success: 'bg-green-600',
            error: 'bg-red-600',
            warning: 'bg-yellow-600',
            info: 'bg-blue-600'
        };
        
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 ${colors[type]} text-white px-6 py-3 rounded-lg shadow-lg z-50`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    window.ultraTTS = new UltraTTS();
});

// Global functions for HTML onclick
function toggleSSMLEditor() {
    document.getElementById('ssml-modal').classList.toggle('hidden');
}
