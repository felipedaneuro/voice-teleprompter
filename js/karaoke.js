import { clamp } from './text-utils.js';

/**
 * Vertical position of `element` inside `container`, walking the offsetParent chain.
 * A single offsetTop is not enough: positioned blocks (list items use position: relative
 * for their bullets) reset offsetTop to their own top edge.
 */
function offsetTopWithin(element, container) {
  let top = 0;
  for (let node = element; node && node !== container; node = node.offsetParent) {
    top += node.offsetTop;
  }
  return top;
}

/** Keeps the read / current word highlight in sync and knows where each word sits vertically. */
export class Karaoke {
  constructor(container) {
    this.container = container;
    this.words = [];
    this.centers = [];
    this.current = 0;
  }

  setWords(words) {
    this.words = words;
    this.current = 0;
    this.words[0]?.element.classList.add('current');
    this.measure();
  }

  get total() {
    return this.words.length;
  }

  measure() {
    this.centers = this.words.map(({ element }) => (
      offsetTopWithin(element, this.container) + element.offsetHeight / 2
    ));
  }

  centerOf(index) {
    if (!this.centers.length) return 0;
    return this.centers[clamp(index, 0, this.centers.length - 1)];
  }

  /** First word whose vertical center is at or below `y`. */
  indexAt(y) {
    let low = 0;
    let high = this.centers.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (this.centers[middle] < y) low = middle + 1;
      else high = middle;
    }
    return low;
  }

  setCurrent(index) {
    const next = clamp(index, 0, this.words.length);
    const previous = this.current;
    if (next === previous) return;
    this.words[previous]?.element.classList.remove('current');
    const markAsRead = next > previous;
    const [from, to] = markAsRead ? [previous, next] : [next, previous];
    for (let position = from; position < to; position++) {
      this.words[position].element.classList.toggle('read', markAsRead);
    }
    this.current = next;
    this.words[next]?.element.classList.add('current');
  }
}
