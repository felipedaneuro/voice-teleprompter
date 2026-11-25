const STORAGE_KEY = 'teleprompter.settings.v1';

export const DEFAULT_SETTINGS = {
  mode: 'voice',
  speed: 2,
  fontSize: 64,
  lineHeight: 1.4,
  margin: 12,
  fontFamily: 'sans',
  fontWeight: '600',
  palette: 'white',
  readOpacity: 0.35,
  guideStyle: 'both',
  guidePosition: 30,
  countdown: 3,
  language: 'pt-BR',
  showTranscript: true,
  mirrorX: false,
  mirrorY: false,
  uiTheme: 'dark',
};

const FONT_STACKS = {
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  rounded: 'ui-rounded, "SF Pro Rounded", "Nunito", "Arial Rounded MT Bold", system-ui, sans-serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
};

const OUTPUT_FORMATS = {
  speed: (value) => value.toFixed(1),
  fontSize: (value) => `${value}px`,
  lineHeight: (value) => value.toFixed(2),
  margin: (value) => `${value}%`,
  readOpacity: (value) => `${Math.round(value * 100)}%`,
  guidePosition: (value) => `${value}%`,
  countdown: (value) => (value ? `${value}s` : 'desligada'),
};

export function loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return { ...DEFAULT_SETTINGS, ...stored };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function readControl(control) {
  if (control.type === 'checkbox') return control.checked;
  if (control.type === 'range' || control.type === 'number') return Number(control.value);
  return control.value;
}

function writeControl(control, value) {
  if (control.type === 'checkbox') control.checked = Boolean(value);
  else control.value = String(value);
}

/** Push current settings values into every [data-setting] control and its <output>. */
export function syncControls(root, settings) {
  for (const control of root.querySelectorAll('[data-setting]')) {
    writeControl(control, settings[control.dataset.setting]);
  }
  for (const output of root.querySelectorAll('output[data-for]')) {
    const key = output.dataset.for;
    const format = OUTPUT_FORMATS[key] ?? String;
    output.textContent = format(settings[key]);
  }
}

export function bindSettingControls(root, settings, onChange) {
  for (const control of root.querySelectorAll('[data-setting]')) {
    const key = control.dataset.setting;
    control.addEventListener('input', () => {
      settings[key] = readControl(control);
      syncControls(root, settings);
      onChange(key);
    });
  }
  syncControls(root, settings);
}

/** Reflect settings as CSS variables / attributes on the document. */
export function applySettings(settings, mirrorElement) {
  const root = document.documentElement;
  root.style.setProperty('--font-size', `${settings.fontSize}px`);
  root.style.setProperty('--line-height', String(settings.lineHeight));
  root.style.setProperty('--margin', `${settings.margin}%`);
  root.style.setProperty('--font-family', FONT_STACKS[settings.fontFamily] ?? FONT_STACKS.sans);
  root.style.setProperty('--font-weight', settings.fontWeight);
  root.style.setProperty('--guide-pos', `${settings.guidePosition}%`);
  root.style.setProperty('--read-opacity', String(settings.readOpacity));
  root.dataset.theme = settings.uiTheme;
  root.dataset.palette = settings.palette;
  root.dataset.guide = settings.guideStyle;
  mirrorElement.classList.toggle('flip-x', settings.mirrorX);
  mirrorElement.classList.toggle('flip-y', settings.mirrorY);
  document.body.classList.toggle('mode-voice', settings.mode === 'voice');
}
