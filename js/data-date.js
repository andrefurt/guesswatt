/**
 * Data date
 * Shows the date of the prices (data/meta.json) in the footer, a notice when they are more than
 * 45 days old, and one when there is no connection and the prices come from this device (sw.js).
 * Loaded on every page. It imports nothing, so sobre.html stays this small; utils.js reads the
 * price date through loadDataStatus below.
 */

/**
 * The price date, and whether the service worker answered from this device's copy because the
 * network failed (sw.js marks those responses)
 * @returns {Promise<{date: Date|null, offline: boolean}>}
 */
export async function loadDataStatus() {
  try {
    const response = await fetch('data/meta.json');
    if (!response.ok) return { date: null, offline: false };
    const offline = response.headers.has('X-GuessWatts-Offline');
    const { build } = await response.json();
    const value = build?.sourceUpdatedAt;
    return { date: value ? new Date(value) : null, offline };
  } catch (error) {
    console.warn('⚠️  Could not load meta.json:', error.message);
    return { date: null, offline: false };
  }
}

/**
 * Format a data date as "dezembro de 2025"
 * @param {Date} date
 * @returns {string}
 */
export function formatDataMonth(date) {
  return new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric', timeZone: 'Europe/Lisbon' }).format(date);
}

const STALE_AFTER_DAYS = 45;
const DAY_MS = 24 * 60 * 60 * 1000;

async function renderDataDate() {
  const { date, offline } = await loadDataStatus();
  if (!date) return; // Unknown date: the footer just says "Dados: ERSE."

  const holder = document.getElementById('data-date');
  const time = holder?.querySelector('time');
  if (holder && time) {
    time.dateTime = date.toISOString().slice(0, 10);
    time.textContent = formatDataMonth(date);
    holder.hidden = false;
  }

  const offlineNotice = document.getElementById('data-offline')?.querySelector('p');
  if (offline && offlineNotice) {
    offlineNotice.querySelector('time').dateTime = date.toISOString().slice(0, 10);
    offlineNotice.querySelector('time').textContent = formatDataMonth(date);
    offlineNotice.hidden = false;
  }

  const stale = document.getElementById('data-stale');
  if (stale && (Date.now() - date.getTime()) / DAY_MS > STALE_AFTER_DAYS) {
    stale.hidden = false;
  }
}

// Only in a page: the selftest imports this module in Node through utils.js
if (typeof document !== 'undefined') renderDataDate();
