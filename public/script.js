// public/script.js — attach to your provided index.html

// DOM
const sendBtn = document.getElementById('send');
const replayBtn = document.getElementById('replay');
const clearBtn = document.getElementById('clear');
const promptEl = document.getElementById('prompt');
const answerEl = document.getElementById('answer');
const statusEl = document.getElementById('status');

// TTS state
let lastAnswer = '';
let chosenVoice = null;
let ttsUnlocked = false;
let isPaused = false;

// -------------------- Utilities --------------------
function setStatus(msg) {
  if (!statusEl) return;
  statusEl.textContent = msg || '';
}

function setAnswerText(text) {
  answerEl.textContent = text;
}

function sanitizeForTTS(text) {
  if (!text) return '';
  let s = text;
  // remove fenced code blocks
  s = s.replace(/```[\s\S]*?```/g, ' ');
  // remove inline code
  s = s.replace(/`[^`]*`/g, ' ');
  // convert markdown links to their text label
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  // remove common markdown symbols that should not be read
  s = s.replace(/[*_~#>|-]{1,}/g, ' ');
  // collapse whitespace
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

async function loadVoices() {
  let voices = speechSynthesis.getVoices();
  if (voices.length && chosenVoice) return voices;
  if (!voices.length) {
    await new Promise((resolve) => {
      const handler = () => { speechSynthesis.removeEventListener('voiceschanged', handler); resolve(); };
      speechSynthesis.addEventListener('voiceschanged', handler);
      setTimeout(resolve, 1200);
    });
    voices = speechSynthesis.getVoices();
  }
  // prefer English voice
  chosenVoice = voices.find(v => /en(-|_)?/i.test(v.lang)) || voices.find(v => v.default) || voices[0] || null;
  console.log('[TTS] voices:', voices.length, 'chosen:', chosenVoice?.name || null);
  return voices;
}

async function unlockTTS() {
  if (ttsUnlocked) return;
  await loadVoices();
  try {
    const u = new SpeechSynthesisUtterance('');
    if (chosenVoice) u.voice = chosenVoice;
    u.volume = 0.0001; // nearly silent to unlock
    speechSynthesis.speak(u);
  } catch (e) {
    console.warn('[TTS] unlock failed', e);
  }
  ttsUnlocked = true;
}

// -------------------- TTS Play/Pause/Resume --------------------
async function speakText(rawText) {
  if (!rawText) return;
  if (!('speechSynthesis' in window)) {
    console.warn('TTS not supported in this browser');
    return;
  }

  const text = sanitizeForTTS(rawText);
  if (!text) return;

  try {
    await loadVoices();
    if (!ttsUnlocked) {
      // when called from a user click, this will satisfy autoplay policies
      await unlockTTS();
    }

    // cancel currently speaking utterances (so new text starts clean)
    try { speechSynthesis.cancel(); } catch (e) { /* ignore */ }

    isPaused = false;
    setStatus('Speaking...');
    replayBtn.disabled = false;
    pauseBtnEnable(true);

    const utt = new SpeechSynthesisUtterance(text);
    if (chosenVoice) utt.voice = chosenVoice;
    utt.lang = chosenVoice?.lang || 'en-US';
    utt.rate = 1;
    utt.pitch = 1;
    utt.volume = 1;

    utt.onstart = () => console.log('[TTS] start');
    utt.onend = () => {
      console.log('[TTS] end');
      setStatus('');
      pauseBtnEnable(false);
      isPaused = false;
    };
    utt.onerror = (ev) => {
      console.warn('[TTS] error', ev);
      setStatus('TTS error');
      pauseBtnEnable(false);
      isPaused = false;
    };

    speechSynthesis.speak(utt);
  } catch (err) {
    console.warn('[TTS] speak failed', err);
    setStatus('TTS error');
  }
}

function pauseBtnEnable(enable) {
  // If clear button or replay exist, we have pause button? find or create
  // Your HTML doesn't include a pause button; create one in DOM if missing.
  let pause = document.getElementById('pause');
  if (!pause) {
    // create and insert next to controls
    pause = document.createElement('button');
    pause.id = 'pause';
    pause.className = 'btn';
    pause.textContent = '⏸ Pause';
    // insert before clearBtn
    if (clearBtn && clearBtn.parentNode) clearBtn.parentNode.insertBefore(pause, clearBtn);
    pause.addEventListener('click', togglePauseResume);
  }
  pause.disabled = !enable;
  pause.textContent = isPaused ? '▶ Resume' : '⏸ Pause';
}

function togglePauseResume() {
  if (!('speechSynthesis' in window)) return;
  if (speechSynthesis.speaking) {
    if (!speechSynthesis.paused) {
      speechSynthesis.pause();
      isPaused = true;
      setStatus('Paused');
      pauseBtnEnable(true);
    } else {
      speechSynthesis.resume();
      isPaused = false;
      setStatus('Speaking...');
      pauseBtnEnable(true);
    }
  }
}

// -------------------- Network / UI --------------------
sendBtn.addEventListener('click', async () => {
  const prompt = (promptEl.value || '').trim();
  if (!prompt) { setStatus('Type a question first.'); return; }

  setStatus('Sending...');
  setAnswerText('');
  try {
    // unlock TTS on user gesture (click) — helps autoplay policies
    await unlockTTS();

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    if (!res.ok) {
      const text = await res.text();
      console.error('API error', res.status, text);
      setStatus('Server error: ' + res.status);
      setAnswerText('Error: ' + text);
      return;
    }

    const j = await res.json();
    if (j.error) {
      console.error('API returned error', j);
      setStatus('API error');
      setAnswerText('Error: ' + (j.details?.message || j.error));
      return;
    }

    const answer = j.answer || 'No answer';
    lastAnswer = answer;
    setAnswerText(answer);
    setStatus('');
    replayBtn.disabled = false;
    // speak
    await speakText(answer);
  } catch (err) {
    console.error('Fetch failed', err);
    setStatus('Network or server error.');
    setAnswerText('Network error: ' + (err.message || err));
  }
});

// Replay
replayBtn.addEventListener('click', async () => {
  if (!lastAnswer) return;
  await unlockTTS();
  await speakText(lastAnswer);
});

// Clear
clearBtn.addEventListener('click', () => {
  promptEl.value = '';
  setAnswerText('');
  setStatus('');
  replayBtn.disabled = true;
  // also cancel TTS
  try { speechSynthesis.cancel(); } catch (e) {}
  isPaused = false;
  pauseBtnEnable(false);
});

// Keyboard shortcut send (Ctrl/Cmd+Enter)
promptEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    sendBtn.click();
  }
});

// init: disable replay, ensure pause UI consistent
replayBtn.disabled = true;
pauseBtnEnable(false);

// quick health fetch to show active model (optional)
(async function fetchActive(){
  try {
    const r = await fetch('/health');
    if (r.ok) {
      const j = await r.json();
      // optionally show model info in status briefly
      console.log('Health', j);
    }
  } catch(e){}
})();
