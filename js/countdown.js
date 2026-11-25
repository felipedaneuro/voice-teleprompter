function showNumber(overlay, value) {
  overlay.textContent = String(value);
  overlay.classList.remove('tick');
  void overlay.offsetWidth;
  overlay.classList.add('tick');
}

/**
 * Show a full-screen countdown, then call `onDone`.
 * Returns a cancel function that hides the overlay without calling `onDone`.
 */
export function startCountdown(overlay, seconds, onDone) {
  if (seconds <= 0) {
    onDone();
    return () => {};
  }
  let remaining = seconds;
  overlay.hidden = false;
  showNumber(overlay, remaining);
  const timer = setInterval(() => {
    remaining -= 1;
    if (remaining > 0) {
      showNumber(overlay, remaining);
      return;
    }
    cancel();
    onDone();
  }, 1000);
  function cancel() {
    clearInterval(timer);
    overlay.hidden = true;
  }
  return cancel;
}
