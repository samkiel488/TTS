// DOM Elements
const textInput = document.getElementById('text-input');
const voiceSelect = document.getElementById('voice-select');
const playBtn = document.getElementById('play-btn');
const pauseBtn = document.getElementById('pause-btn');
const stopBtn = document.getElementById('stop-btn');
const speedInput = document.getElementById('speed');
const pitchInput = document.getElementById('pitch');
const fileUpload = document.getElementById('file-upload');

// Speech Synthesis
let speech = new SpeechSynthesisUtterance();
let voices = [];

function loadVoices() {
  voices = window.speechSynthesis.getVoices();
  voiceSelect.innerHTML = voices.map(voice =>
    `<option value="${voice.name}">${voice.name} (${voice.lang})</option>`
  ).join('');
}

// Initialize
window.speechSynthesis.onvoiceschanged = loadVoices;

// Play/Pause/Stop
playBtn.addEventListener('click', () => {
  speech.text = textInput.value;
  speech.rate = speedInput.value;
  speech.pitch = pitchInput.value;
  speech.voice = voices.find(v => v.name === voiceSelect.value);
  window.speechSynthesis.speak(speech);
});

pauseBtn.addEventListener('click', () => {
  window.speechSynthesis.pause();
});

stopBtn.addEventListener('click', () => {
  window.speechSynthesis.cancel();
});

// File Upload (Basic TXT)
fileUpload.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file.type === 'text/plain') {
    const reader = new FileReader();
    reader.onload = (e) => textInput.value = e.target.result;
    reader.readAsText(file);
  } else {
    alert('Only TXT files supported in this demo. Full version handles PDF/DOCX!');
  }
});

// TODO: Add AI Voices (ElevenLabs API), SSML Editor, Export Audio, etc.