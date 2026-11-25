const NUMBER_WORDS = {
  zero: '0', um: '1', uma: '1', dois: '2', duas: '2', tres: '3', quatro: '4',
  cinco: '5', seis: '6', sete: '7', oito: '8', nove: '9', dez: '10', cem: '100', mil: '1000',
  one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7',
  eight: '8', nine: '9', ten: '10', hundred: '100', thousand: '1000',
};

const DIACRITICS = /[̀-ͯ]/g;
const NON_WORD_CHARACTERS = /[^\p{L}\p{N}]/gu;

/** Lowercase, strip accents and punctuation, and map small number words to digits. */
export function normalizeWord(word) {
  const plain = word
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .replace(NON_WORD_CHARACTERS, '');
  return NUMBER_WORDS[plain] ?? plain;
}

export function levenshtein(first, second) {
  let previousRow = Array.from({ length: second.length + 1 }, (_, index) => index);
  for (let row = 1; row <= first.length; row++) {
    const currentRow = [row];
    for (let column = 1; column <= second.length; column++) {
      const substitution = first[row - 1] === second[column - 1] ? 0 : 1;
      currentRow[column] = Math.min(
        previousRow[column] + 1,
        currentRow[column - 1] + 1,
        previousRow[column - 1] + substitution,
      );
    }
    previousRow = currentRow;
  }
  return previousRow[second.length];
}

/** Tolerant comparison between a spoken word and a script word (both normalized). */
export function wordsMatch(spoken, expected) {
  if (spoken === expected) return true;
  const shortest = Math.min(spoken.length, expected.length);
  if (shortest < 4) return false;
  if (spoken.startsWith(expected) || expected.startsWith(spoken)) return true;
  const tolerance = shortest >= 7 ? 2 : 1;
  return levenshtein(spoken, expected) <= tolerance;
}

export function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

export function formatDuration(totalSeconds) {
  if (!Number.isFinite(totalSeconds)) return '–:––';
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}
