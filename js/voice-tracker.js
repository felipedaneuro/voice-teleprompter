import { normalizeWord, wordsMatch } from './text-utils.js';

const RESTART_DELAY_MS = 150;
const FATAL_ERRORS = new Set(['not-allowed', 'service-not-allowed', 'audio-capture', 'network', 'language-not-supported']);

function getRecognitionClass() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function isVoiceSupported() {
  return getRecognitionClass() !== null;
}

/** How far ahead a spoken word may jump: short words are ambiguous, so they only match nearby. */
function lookaheadFor(word) {
  if (word.length <= 3) return 2;
  if (word.length <= 5) return 5;
  return 10;
}

/**
 * Follows the reader through the script using the Web Speech API.
 * `position` is the index of the next word still to be read; it only moves forward
 * when spoken words match the script, so pauses and improvisation keep it in place.
 */
export class VoiceTracker {
  constructor({ onAdvance, onStatus, onTranscript }) {
    this.onAdvance = onAdvance;
    this.onStatus = onStatus;
    this.onTranscript = onTranscript;
    this.words = [];
    this.position = 0;
    this.anchors = new Map();
    this.active = false;
    this.recognition = null;
    this.language = 'pt-BR';
  }

  setScript(normalizedWords) {
    this.words = normalizedWords;
    this.resync(0);
  }

  start(language) {
    this.language = language;
    this.active = true;
    if (!this.recognition) this.launch();
  }

  stop() {
    this.active = false;
    this.recognition?.abort();
  }

  /** Jump to a word (click, arrows, reset). Restarting drops results anchored to the old position. */
  resync(index) {
    this.position = index;
    this.anchors.clear();
    this.recognition?.abort();
  }

  launch() {
    const Recognition = getRecognitionClass();
    const recognition = new Recognition();
    recognition.lang = this.language;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => this.handleResult(event);
    recognition.onerror = (event) => this.handleError(event);
    recognition.onend = () => this.handleEnd();
    recognition.onspeechstart = () => this.onStatus('speaking');
    recognition.onspeechend = () => this.onStatus('listening');
    this.anchors.clear();
    this.recognition = recognition;
    try {
      recognition.start();
      this.onStatus('listening');
    } catch (error) {
      this.recognition = null;
      this.onStatus('error', error.name);
    }
  }

  handleResult(event) {
    const heard = [];
    for (let index = event.resultIndex; index < event.results.length; index++) {
      if (!this.anchors.has(index)) this.anchors.set(index, this.position);
      const transcript = event.results[index][0].transcript;
      heard.push(transcript);
      const reached = this.matchFrom(this.anchors.get(index), transcript);
      if (reached > this.position) {
        this.position = reached;
        this.onAdvance(reached);
      }
    }
    this.onTranscript(heard.join(' '));
  }

  matchFrom(start, transcript) {
    let cursor = start;
    for (const rawWord of transcript.split(/\s+/)) {
      const spoken = normalizeWord(rawWord);
      if (!spoken) continue;
      const found = this.findNext(spoken, cursor);
      if (found !== -1) cursor = found + 1;
    }
    return cursor;
  }

  findNext(spoken, cursor) {
    const end = Math.min(this.words.length, cursor + lookaheadFor(spoken));
    for (let index = cursor; index < end; index++) {
      if (wordsMatch(spoken, this.words[index])) return index;
    }
    return -1;
  }

  handleError(event) {
    if (event.error === 'no-speech' || event.error === 'aborted') return;
    if (FATAL_ERRORS.has(event.error)) this.active = false;
    this.onStatus('error', event.error);
  }

  handleEnd() {
    this.recognition = null;
    if (!this.active) {
      this.onStatus('idle');
      return;
    }
    setTimeout(() => {
      if (this.active && !this.recognition) this.launch();
    }, RESTART_DELAY_MS);
  }
}
