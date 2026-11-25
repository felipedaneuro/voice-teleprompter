import { clamp } from './text-utils.js';

const EASING_PER_SECOND = 5;
const MAX_FRAME_SECONDS = 0.1;

/**
 * Moves the script track with a transform on every animation frame.
 * Auto mode advances at a constant speed; otherwise the offset eases toward a target.
 */
export class Scroller {
  constructor(track, { onFrame, onEnd }) {
    this.track = track;
    this.onFrame = onFrame;
    this.onEnd = onEnd;
    this.offset = 0;
    this.target = 0;
    this.maxOffset = 0;
    this.pixelsPerSecond = 0;
    this.autoRunning = false;
    this.lastTime = null;
    this.renderedOffset = null;
    requestAnimationFrame((time) => this.loop(time));
  }

  setMaxOffset(maxOffset) {
    this.maxOffset = Math.max(0, maxOffset);
    this.target = clamp(this.target, 0, this.maxOffset);
  }

  startAuto(pixelsPerSecond) {
    this.pixelsPerSecond = pixelsPerSecond;
    this.target = this.offset;
    this.autoRunning = true;
  }

  stopAuto() {
    this.autoRunning = false;
    this.target = this.offset;
  }

  jumpTo(offset) {
    this.target = clamp(offset, 0, this.maxOffset);
    this.offset = this.target;
  }

  glideTo(offset) {
    this.target = clamp(offset, 0, this.maxOffset);
    if (this.autoRunning) this.offset = this.target;
  }

  nudge(delta) {
    this.glideTo(this.target + delta);
  }

  loop(time) {
    const seconds = this.lastTime === null ? 0 : Math.min((time - this.lastTime) / 1000, MAX_FRAME_SECONDS);
    this.lastTime = time;
    this.advance(seconds);
    if (this.offset !== this.renderedOffset) {
      this.track.style.transform = `translate3d(0, ${-this.offset}px, 0)`;
      this.renderedOffset = this.offset;
      this.onFrame(this.offset);
    }
    requestAnimationFrame((nextTime) => this.loop(nextTime));
  }

  advance(seconds) {
    if (this.autoRunning) {
      this.target = clamp(this.target + this.pixelsPerSecond * seconds, 0, this.maxOffset);
      this.offset = this.target;
      if (this.target >= this.maxOffset) {
        this.autoRunning = false;
        this.onEnd();
      }
      return;
    }
    const distance = this.target - this.offset;
    if (Math.abs(distance) < 0.3) {
      this.offset = this.target;
      return;
    }
    this.offset += distance * Math.min(1, seconds * EASING_PER_SECOND);
  }
}
