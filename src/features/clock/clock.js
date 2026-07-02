/**
 * Clock feature: time display, date, greeting, and responsive scaling.
 */

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function greetingText(h) {
  if (h < 5) return 'Burning the midnight oil.';
  if (h < 12) return 'Good morning.';
  if (h < 17) return 'Good afternoon.';
  if (h < 21) return 'Good evening.';
  return 'Good night.';
}

/**
 * Initialize the clock feature.
 * @param {object} deps - Dependencies
 * @param {object} deps.store - The Store object
 * @returns {object} Clock API: updateClock, updateClockScale
 */
export function initClock(deps) {
  const { store } = deps;
  const clockEl = document.getElementById('clock');
  const dateEl = document.getElementById('date');
  const greetEl = document.getElementById('greeting');

  function updateClock() {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes().toString().padStart(2, '0');
    const use12 = store.get('use12h');
    const showAmPm = store.get('showAmPm') ?? true;
    const hh = (use12 ? h % 12 || 12 : h).toString().padStart(2, '0');
    const ampm = (use12 && showAmPm) ? ` ${h < 12 ? 'AM' : 'PM'}` : '';
    if (clockEl) clockEl.textContent = `${hh}:${m}${ampm}`;
    if (dateEl) dateEl.textContent = `${DAYS[now.getDay()]}, ${ordinal(now.getDate())} ${MONTHS[now.getMonth()]}`;
    if (greetEl) greetEl.textContent = greetingText(h);
  }

  function updateClockScale() {
    const widget = document.getElementById('widget-clock');
    const clock = document.getElementById('clock');
    if (!widget || !clock) return;
    const width = widget.offsetWidth;
    const height = widget.offsetHeight;
    const size = Math.max(40, Math.min(140, Math.min(width * 0.35, height * 0.75)));
    document.documentElement.style.setProperty('--clock-widget-size', `${size}px`);
  }

  function applyVisibility() {
    if (greetEl) greetEl.style.display = store.get('hideGreeting') ? 'none' : '';
    if (dateEl) dateEl.style.display = store.get('hideDate') ? 'none' : '';
  }

  function initSettings() {
    const toggle12h = document.getElementById('toggle-12h');
    const toggleAmPm = document.getElementById('toggle-ampm');
    const toggleGreeting = document.getElementById('toggle-greeting');
    const toggleDate = document.getElementById('toggle-date');

    if (toggle12h) {
      toggle12h.checked = !!store.get('use12h');
      toggle12h.addEventListener('change', () => { store.set('use12h', toggle12h.checked); updateClock(); });
    }
    if (toggleAmPm) {
      toggleAmPm.checked = store.get('showAmPm') ?? true;
      toggleAmPm.addEventListener('change', () => { store.set('showAmPm', toggleAmPm.checked); updateClock(); });
    }
    if (toggleGreeting) {
      toggleGreeting.checked = !store.get('hideGreeting');
      toggleGreeting.addEventListener('change', () => { store.set('hideGreeting', !toggleGreeting.checked); applyVisibility(); });
    }
    if (toggleDate) {
      toggleDate.checked = !store.get('hideDate');
      toggleDate.addEventListener('change', () => { store.set('hideDate', !toggleDate.checked); applyVisibility(); });
    }
  }

  // Start the clock
  initSettings();
  applyVisibility();
  updateClock();
  setInterval(updateClock, 1000);

  return { updateClock, updateClockScale, applyVisibility };
}
