import { renderScript } from './markdown.js';
import { VoiceTracker, isVoiceSupported } from './voice-tracker.js';
import { Scroller } from './scroller.js';
import { Karaoke } from './karaoke.js';
import { PaceMeter } from './pace-meter.js';
import { startCountdown } from './countdown.js';
import { bindKeyboard } from './keyboard.js';
import { SAMPLE_SCRIPT } from './sample-script.js';
import { SCRIPT_PROMPT } from './script-prompt.js';
import { clamp, formatDuration } from './text-utils.js';
import { applySettings, bindSettingControls, loadSettings, saveSettings, syncControls } from './settings.js';

const SCRIPT_STORAGE_KEY = 'teleprompter.script.v1';
const DEFAULT_WORDS_PER_MINUTE = 140;
const SPEED_STEP = 0.1;
const FONT_STEP = 4;
const WHEEL_SETTLE_MS = 250;
const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
const TOAST_MS = 5000;
const LAYOUT_KEYS = new Set(['fontSize', 'lineHeight', 'margin', 'fontFamily', 'fontWeight', 'guidePosition']);

const VOICE_ERRORS = {
  'not-allowed': 'Permissão do microfone negada. Libere o microfone para este site nas configurações do navegador.',
  'service-not-allowed': 'O navegador bloqueou o reconhecimento de voz. Abra o app por http://localhost ou https.',
  'audio-capture': 'Nenhum microfone encontrado.',
  network: 'Sem conexão com o serviço de reconhecimento de voz (o Chrome precisa de internet para isso).',
  'language-not-supported': 'Este idioma não é suportado pelo reconhecimento de voz deste navegador.',
};

const ELEMENT_IDS = [
  'toolbar', 'stage', 'mirror', 'viewport', 'track', 'script', 'countdown', 'status', 'transcript',
  'paceMetric', 'remainingMetric', 'progressBar', 'playButton', 'resetButton', 'editButton',
  'slowerButton', 'fasterButton', 'themeButton', 'mirrorButton', 'fullscreenButton',
  'settingsButton', 'closeSettingsButton', 'settingsPanel', 'editorDialog', 'editorText',
  'fileInput', 'sampleButton', 'copyPromptButton', 'modeSelect', 'toast',
];

const elements = Object.fromEntries(ELEMENT_IDS.map((id) => [id, document.getElementById(id)]));
const settings = loadSettings();
const karaoke = new Karaoke(elements.track);
const pace = new PaceMeter();
const state = { running: false, cancelCountdown: null, blockStarts: [], guideCenter: 0, wheelTimer: null, toastTimer: null, promptTimer: null };

const tracker = new VoiceTracker({
  onAdvance: handleVoiceAdvance,
  onStatus: handleVoiceStatus,
  onTranscript: showTranscript,
});
const scroller = new Scroller(elements.track, { onFrame: handleFrame, onEnd: finish });

/* ---------- Geometry ---------- */

function lineHeightPixels() {
  return settings.fontSize * settings.lineHeight;
}

function pixelsPerSecond() {
  return (settings.speed * lineHeightPixels()) / 4;
}

function offsetFor(index) {
  return karaoke.centerOf(index) - state.guideCenter;
}

function isVoiceMode() {
  return settings.mode === 'voice' && isVoiceSupported();
}

function layout() {
  const viewportHeight = elements.viewport.clientHeight;
  document.documentElement.style.setProperty('--toolbar-height', `${elements.toolbar.offsetHeight}px`);
  state.guideCenter = (viewportHeight * settings.guidePosition) / 100;
  elements.track.style.paddingTop = `${Math.max(0, state.guideCenter - lineHeightPixels() / 2)}px`;
  elements.track.style.paddingBottom = `${viewportHeight}px`;
  karaoke.measure();
  scroller.setMaxOffset(offsetFor(karaoke.total - 1) + lineHeightPixels());
  scroller.jumpTo(offsetFor(karaoke.current));
  if (scroller.autoRunning) scroller.pixelsPerSecond = pixelsPerSecond();
  updateHud();
}

/* ---------- Script ---------- */

function loadScript() {
  return localStorage.getItem(SCRIPT_STORAGE_KEY) ?? SAMPLE_SCRIPT;
}

function renderSource(source) {
  pause();
  const { words, blockStarts } = renderScript(source, elements.script);
  state.blockStarts = blockStarts;
  karaoke.setWords(words);
  tracker.setScript(words.map((word) => word.normalized));
  pace.reset();
  layout();
  setStatus('idle', words.length ? 'Pronto' : 'Roteiro vazio');
}

/* ---------- Playback ---------- */

function togglePlay() {
  if (state.running || state.cancelCountdown) pause();
  else play();
}

function play() {
  if (!karaoke.total) {
    openEditor();
    return;
  }
  if (karaoke.current >= karaoke.total) goToWord(0);
  closeSettings();
  setRunningUi(true);
  setStatus('countdown', 'Prepare-se…');
  state.cancelCountdown = startCountdown(elements.countdown, settings.countdown, begin);
}

function begin() {
  state.cancelCountdown = null;
  state.running = true;
  pace.reset();
  pace.record(karaoke.current);
  if (isVoiceMode()) {
    tracker.resync(karaoke.current);
    tracker.start(settings.language);
    return;
  }
  scroller.startAuto(pixelsPerSecond());
  setStatus('running', 'Rolando');
}

function pause() {
  state.cancelCountdown?.();
  state.cancelCountdown = null;
  state.running = false;
  tracker.stop();
  scroller.stopAuto();
  setRunningUi(false);
  setStatus('idle', 'Pausado');
}

function finish() {
  pause();
  setStatus('idle', 'Fim do roteiro');
}

function reset() {
  pause();
  goToWord(0);
  setStatus('idle', 'Pronto');
}

function goToWord(index) {
  const target = clamp(index, 0, karaoke.total);
  karaoke.setCurrent(target);
  tracker.resync(target);
  pace.reset();
  scroller.glideTo(offsetFor(target));
}

function jumpBlock(direction) {
  const current = karaoke.current;
  const starts = state.blockStarts;
  const target = direction > 0
    ? starts.find((start) => start > current)
    : [...starts].reverse().find((start) => start < current);
  goToWord(target ?? (direction > 0 ? karaoke.total - 1 : 0));
}

/* ---------- Voice + frame callbacks ---------- */

function handleVoiceAdvance(index) {
  karaoke.setCurrent(index);
  pace.record(index);
  scroller.glideTo(offsetFor(index));
  if (index >= karaoke.total) finish();
}

function handleVoiceStatus(status, detail) {
  if (status === 'error') {
    handleVoiceError(detail);
    return;
  }
  if (!state.running) return;
  setStatus(status, status === 'speaking' ? 'Ouvindo você' : 'Aguardando você falar…');
}

function handleVoiceError(code) {
  showToast(VOICE_ERRORS[code] ?? `Erro no reconhecimento de voz (${code}).`);
  if (tracker.active) return;
  pause();
  setStatus('error', 'Microfone indisponível');
}

function handleFrame(offset) {
  if (!isVoiceMode()) karaoke.setCurrent(karaoke.indexAt(offset + state.guideCenter - 1));
  updateHud();
}

/* ---------- Settings ---------- */

function onSettingChange(key) {
  saveSettings(settings);
  syncControls(document, settings);
  applySettings(settings, elements.mirror);
  elements.mirrorButton.setAttribute('aria-pressed', String(settings.mirrorX));
  if (key === 'mode') handleModeChange();
  if (key === 'speed' && scroller.autoRunning) scroller.pixelsPerSecond = pixelsPerSecond();
  if (key === 'showTranscript') showTranscript('');
  if (LAYOUT_KEYS.has(key)) requestAnimationFrame(layout);
  updateHud();
}

function handleModeChange() {
  if (state.running || state.cancelCountdown) pause();
  if (settings.mode !== 'voice' || isVoiceSupported()) return;
  settings.mode = 'auto';
  onSettingChange('speed');
  showToast('Este navegador não tem reconhecimento de voz. Use Chrome, Edge ou Safari para o modo karaokê.');
}

function changeSpeed(delta) {
  settings.speed = Math.round(clamp(settings.speed + delta, 0.1, 10) * 10) / 10;
  onSettingChange('speed');
}

function changeFontSize(delta) {
  settings.fontSize = clamp(settings.fontSize + delta, 24, 160);
  onSettingChange('fontSize');
}

function toggleSetting(key) {
  settings[key] = key === 'uiTheme'
    ? (settings.uiTheme === 'dark' ? 'light' : 'dark')
    : !settings[key];
  onSettingChange(key);
}

/* ---------- UI helpers ---------- */

function setRunningUi(running) {
  document.body.classList.toggle('is-running', running);
  elements.playButton.textContent = running ? '❚❚ Pausar' : '▶ Iniciar';
  elements.playButton.setAttribute('aria-pressed', String(running));
}

function setStatus(name, label) {
  elements.status.dataset.state = name;
  elements.status.textContent = label;
}

function showTranscript(text) {
  elements.transcript.textContent = settings.showTranscript ? text.trim().slice(-90) : '';
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => { elements.toast.hidden = true; }, TOAST_MS);
}

function currentWordsPerMinute() {
  if (isVoiceMode()) return pace.wordsPerMinute();
  if (karaoke.total < 2) return null;
  const span = karaoke.centerOf(karaoke.total - 1) - karaoke.centerOf(0);
  return span > 0 ? pixelsPerSecond() * 60 * (karaoke.total / span) : null;
}

function updateHud() {
  const total = karaoke.total;
  const progress = total ? karaoke.current / total : 0;
  elements.progressBar.style.width = `${(progress * 100).toFixed(1)}%`;
  const wordsPerMinute = currentWordsPerMinute();
  elements.paceMetric.textContent = wordsPerMinute ? `${Math.round(wordsPerMinute)} ppm` : '';
  const remainingSeconds = ((total - karaoke.current) / (wordsPerMinute || DEFAULT_WORDS_PER_MINUTE)) * 60;
  elements.remainingMetric.textContent = `⏳ ${formatDuration(remainingSeconds)}`;
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen();
    return;
  }
  document.documentElement.requestFullscreen?.().catch(() => showToast('Não foi possível entrar em tela cheia.'));
}

function closeSettings() {
  elements.settingsPanel.hidden = true;
}

function handleEscape() {
  if (state.running || state.cancelCountdown) pause();
  else closeSettings();
}

/* ---------- Editor ---------- */

function openEditor() {
  pause();
  elements.editorText.value = loadScript();
  elements.editorDialog.returnValue = '';
  elements.editorDialog.showModal();
  elements.editorText.focus();
}

function handleEditorClose() {
  if (elements.editorDialog.returnValue !== 'apply') return;
  const source = elements.editorText.value;
  localStorage.setItem(SCRIPT_STORAGE_KEY, source);
  renderSource(source);
}

async function importFile(file) {
  if (!file) return;
  const isText = /\.(md|markdown|txt)$/i.test(file.name) || file.type.startsWith('text/');
  if (!isText) {
    showToast('Envie um arquivo .md ou .txt.');
    return;
  }
  if (file.size > MAX_IMPORT_BYTES) {
    showToast('Arquivo muito grande (limite de 2 MB).');
    return;
  }
  elements.editorText.value = await file.text();
}

/** Clipboard API needs a secure context; fall back to a throwaway textarea elsewhere. */
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const scratch = document.createElement('textarea');
    scratch.value = text;
    scratch.setAttribute('readonly', '');
    scratch.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.append(scratch);
    scratch.select();
    const copied = document.execCommand?.('copy') ?? false;
    scratch.remove();
    return copied;
  }
}

async function copyScriptPrompt() {
  const copied = await copyText(SCRIPT_PROMPT);
  showToast(copied
    ? 'Prompt copiado. Cole numa IA junto com o seu texto e traga o roteiro pronto de volta para cá.'
    : 'Não foi possível copiar. Selecione o texto do prompt manualmente.');
  elements.copyPromptButton.textContent = copied ? '✓ Prompt copiado' : '✨ Copiar prompt para ajustar seu roteiro';
  clearTimeout(state.promptTimer);
  state.promptTimer = setTimeout(() => {
    elements.copyPromptButton.textContent = '✨ Copiar prompt para ajustar seu roteiro';
  }, TOAST_MS);
}

/* ---------- Bindings ---------- */

function bindButtons() {
  elements.playButton.addEventListener('click', togglePlay);
  elements.resetButton.addEventListener('click', reset);
  elements.editButton.addEventListener('click', openEditor);
  elements.slowerButton.addEventListener('click', () => changeSpeed(-SPEED_STEP));
  elements.fasterButton.addEventListener('click', () => changeSpeed(SPEED_STEP));
  elements.themeButton.addEventListener('click', () => toggleSetting('uiTheme'));
  elements.mirrorButton.addEventListener('click', () => toggleSetting('mirrorX'));
  elements.fullscreenButton.addEventListener('click', toggleFullscreen);
  elements.settingsButton.addEventListener('click', () => {
    elements.settingsPanel.hidden = !elements.settingsPanel.hidden;
  });
  elements.closeSettingsButton.addEventListener('click', closeSettings);
}

function handleWheel(event) {
  event.preventDefault();
  const lineScale = event.deltaMode === 1 ? lineHeightPixels() : 1;
  const direction = settings.mirrorY ? -1 : 1;
  scroller.nudge(event.deltaY * lineScale * direction);
  if (!isVoiceMode()) return;
  clearTimeout(state.wheelTimer);
  state.wheelTimer = setTimeout(() => {
    goToWord(karaoke.indexAt(scroller.target + state.guideCenter - 1));
  }, WHEEL_SETTLE_MS);
}

function bindStage() {
  elements.stage.addEventListener('wheel', handleWheel, { passive: false });
  // The track moves by transform only; undo native scrolling (find-in-page, focus, scrollIntoView).
  elements.viewport.addEventListener('scroll', () => { elements.viewport.scrollTop = 0; });
  elements.script.addEventListener('click', (event) => {
    const word = event.target.closest('.word');
    if (word) goToWord(Number(word.dataset.index));
  });
  new ResizeObserver(() => layout()).observe(elements.viewport);
  document.fonts?.ready.then(layout);
}

function bindEditor() {
  elements.editorDialog.addEventListener('close', handleEditorClose);
  elements.fileInput.addEventListener('change', () => {
    importFile(elements.fileInput.files[0]);
    elements.fileInput.value = '';
  });
  elements.sampleButton.addEventListener('click', () => {
    elements.editorText.value = SAMPLE_SCRIPT;
  });
  elements.copyPromptButton.addEventListener('click', copyScriptPrompt);
}

function keyboardActions() {
  return {
    togglePlay,
    reset,
    faster: () => changeSpeed(SPEED_STEP),
    slower: () => changeSpeed(-SPEED_STEP),
    previousBlock: () => jumpBlock(-1),
    nextBlock: () => jumpBlock(1),
    biggerFont: () => changeFontSize(FONT_STEP),
    smallerFont: () => changeFontSize(-FONT_STEP),
    mirror: () => toggleSetting('mirrorX'),
    fullscreen: toggleFullscreen,
    edit: openEditor,
    escape: handleEscape,
  };
}

function checkEnvironment() {
  if (!isVoiceSupported()) {
    elements.modeSelect.querySelector('option[value="voice"]').disabled = true;
    if (settings.mode === 'voice') handleModeChange();
    return;
  }
  if (location.protocol === 'file:') {
    showToast('Para usar o microfone, abra o app pelo servidor local (veja o README).');
  }
}

function init() {
  applySettings(settings, elements.mirror);
  bindSettingControls(document, settings, onSettingChange);
  elements.mirrorButton.setAttribute('aria-pressed', String(settings.mirrorX));
  bindButtons();
  bindStage();
  bindEditor();
  bindKeyboard(keyboardActions());
  renderSource(loadScript());
  checkEnvironment();
}

init();
