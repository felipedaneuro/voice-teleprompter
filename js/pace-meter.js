const WINDOW_MS = 20000;
const MINIMUM_SPAN_MS = 4000;

/** Rolling words-per-minute estimate from the reader's progress over the last few seconds. */
export class PaceMeter {
  constructor() {
    this.samples = [];
  }

  reset() {
    this.samples = [];
  }

  record(wordIndex, time = performance.now()) {
    this.samples.push({ wordIndex, time });
    while (this.samples.length && time - this.samples[0].time > WINDOW_MS) this.samples.shift();
  }

  wordsPerMinute() {
    if (this.samples.length < 2) return null;
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    const span = last.time - first.time;
    if (span < MINIMUM_SPAN_MS) return null;
    return ((last.wordIndex - first.wordIndex) / span) * 60000;
  }
}
