import { normalizeWord } from './text-utils.js';

const BLOCK_RULES = [
  { pattern: /^(#{1,6})\s+(.*)$/, build: (match) => ({ type: `h${Math.min(match[1].length, 3)}`, text: match[2] }) },
  { pattern: /^(?:-{3,}|\*{3,}|_{3,})$/, build: () => ({ type: 'hr' }) },
  { pattern: /^>\s?(.*)$/, build: (match) => ({ type: 'quote', text: match[1] }) },
  { pattern: /^[-*+]\s+(.*)$/, build: (match) => ({ type: 'ul', text: match[1] }) },
  { pattern: /^(\d+)[.)]\s+(.*)$/, build: (match) => ({ type: 'ol', text: match[2], number: match[1] }) },
];

function matchBlock(line) {
  for (const rule of BLOCK_RULES) {
    const match = line.match(rule.pattern);
    if (match) return rule.build(match);
  }
  return null;
}

/** Split markdown source into flat blocks (headings, paragraphs, list items, quotes, pauses). */
export function parseBlocks(source) {
  const blocks = [];
  let paragraph = [];
  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'p', text: paragraph.join(' ') });
    paragraph = [];
  };
  const lines = source.replace(/<!--[\s\S]*?-->/g, '').replace(/\r\n?/g, '\n').split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      continue;
    }
    const block = matchBlock(line);
    if (!block) {
      paragraph.push(line);
      continue;
    }
    flushParagraph();
    blocks.push(block);
  }
  flushParagraph();
  return blocks;
}

function isUnderscoreEmphasis(text, index) {
  const before = text[index - 1] ?? ' ';
  const after = text[index + 1] ?? ' ';
  return !/[\p{L}\p{N}]/u.test(before) || !/[\p{L}\p{N}]/u.test(after);
}

/** Parse **bold**, *italic* and _italic_ into styled text segments. */
export function parseInline(text) {
  const segments = [];
  const style = { strong: false, em: false };
  let buffer = '';
  const pushBuffer = () => {
    if (buffer) segments.push({ text: buffer, ...style });
    buffer = '';
  };
  for (let index = 0; index < text.length; index++) {
    const character = text[index];
    const pair = text.slice(index, index + 2);
    if (character === '\\' && index + 1 < text.length) {
      buffer += text[++index];
    } else if (pair === '**' || pair === '__') {
      pushBuffer();
      style.strong = !style.strong;
      index++;
    } else if (character === '*' || (character === '_' && isUnderscoreEmphasis(text, index))) {
      pushBuffer();
      style.em = !style.em;
    } else {
      buffer += character;
    }
  }
  pushBuffer();
  return segments;
}

function stripLinksAndCode(text) {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1');
}

function createCue(text) {
  const cue = document.createElement('span');
  cue.className = 'cue';
  cue.textContent = text.trim();
  return cue;
}

function appendWords(parent, segment, words) {
  for (const token of segment.text.split(/(\s+)/)) {
    if (!token) continue;
    if (/^\s+$/.test(token)) {
      parent.append(document.createTextNode(' '));
      continue;
    }
    const span = document.createElement('span');
    span.textContent = token;
    if (segment.strong) span.classList.add('strong');
    if (segment.em) span.classList.add('em');
    const normalized = normalizeWord(token);
    if (normalized) {
      span.classList.add('word');
      span.dataset.index = String(words.length);
      words.push({ element: span, normalized });
    }
    parent.append(span);
  }
}

function appendInline(parent, text, words) {
  stripLinksAndCode(text).split(/\[([^\]]+)\]/).forEach((part, index) => {
    if (index % 2 === 1) {
      parent.append(createCue(part));
      return;
    }
    for (const segment of parseInline(part)) appendWords(parent, segment, words);
  });
}

function renderBlock(block, words) {
  const element = document.createElement('div');
  element.className = `block block-${block.type}`;
  if (block.type === 'hr') {
    element.setAttribute('aria-hidden', 'true');
    return element;
  }
  if (block.number) element.dataset.number = `${block.number}.`;
  appendInline(element, block.text, words);
  return element;
}

/**
 * Render markdown into the container, wrapping every speakable word in a span.
 * Returns the word list (DOM element + normalized text) and the word index where each block starts.
 */
export function renderScript(source, container) {
  const words = [];
  const blockStarts = [];
  container.replaceChildren();
  for (const block of parseBlocks(source)) {
    const firstWord = words.length;
    container.append(renderBlock(block, words));
    if (words.length > firstWord) blockStarts.push(firstWord);
  }
  return { words, blockStarts };
}
