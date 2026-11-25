const KEY_ACTIONS = {
  ' ': 'togglePlay',
  ArrowUp: 'faster',
  ArrowDown: 'slower',
  ArrowLeft: 'previousBlock',
  ArrowRight: 'nextBlock',
  PageUp: 'previousBlock',
  PageDown: 'nextBlock',
  Home: 'reset',
  r: 'reset',
  f: 'fullscreen',
  m: 'mirror',
  e: 'edit',
  '+': 'biggerFont',
  '=': 'biggerFont',
  '-': 'smallerFont',
  Escape: 'escape',
};

function isEditing(target) {
  if (document.querySelector('dialog[open]')) return true;
  return Boolean(target.closest?.('input, textarea, select, [contenteditable="true"]'));
}

export function bindKeyboard(actions) {
  document.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key !== 'Escape' && isEditing(event.target)) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const action = KEY_ACTIONS[key];
    if (!action) return;
    event.preventDefault();
    actions[action]();
  });
  document.addEventListener('click', (event) => {
    event.target.closest?.('button')?.blur();
  });
  document.addEventListener('change', (event) => {
    if (event.target.matches?.('input[type="range"], select')) event.target.blur();
  });
}
