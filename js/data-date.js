/**
 * Data date
 * Shows the date of the prices (data/meta.json) in the footer, a notice when they are more than
 * 45 days old, and one when there is no connection and the prices come from this device (sw.js).
 * Loaded on every page. It imports nothing, so sobre.html stays this small; utils.js reads the
 * price date through loadDataStatus below. Being on every page, it also registers the service
 * worker, so a first visit to sobre.html installs it too.
 */

/**
 * The price date, and whether the service worker answered from this device's copy because the
 * network failed (sw.js marks those responses), and the supplier codes in the data
 * @returns {Promise<{date: Date|null, offline: boolean, providers: string[]|null}>}
 */
let statusRequest = null;

export function loadDataStatus() {
  // One request per page (the footer, the comparison and the supplier list all ask); a failed one
  // is forgotten so the next call tries again
  statusRequest ??= fetchDataStatus().then(status => {
    if (!status.date) statusRequest = null;
    return status;
  });
  return statusRequest;
}

async function fetchDataStatus() {
  const none = { date: null, offline: false, providers: null };
  try {
    const response = await fetch('data/meta.json');
    if (!response.ok) return none;
    const offline = response.headers.has('X-GuessWatts-Offline');
    const { build } = await response.json();
    const value = build?.sourceUpdatedAt;
    return { date: value ? new Date(value) : null, offline, providers: build?.providers ? Object.keys(build.providers) : null };
  } catch (error) {
    console.warn('⚠️  Could not load meta.json:', error.message);
    return none;
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

/**
 * Register the service worker (sw.js, ADR-023) once the page has loaded, so it never competes with
 * the first paint. On localhost it runs only with ?sw in the URL, so it does not serve stale files
 * while you edit; without it, an earlier registration is removed.
 */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (local && !new URLSearchParams(location.search).has('sw')) {
    navigator.serviceWorker.getRegistrations().then(registrations => registrations.forEach(r => r.unregister()));
    return;
  }
  navigator.serviceWorker.register('sw.js').catch(error => console.warn('⚠️  Service worker not registered:', error.message));
}

// Only in a page: the selftest imports this module in Node through utils.js
if (typeof document !== 'undefined') {
  renderDataDate();
  window.addEventListener('load', registerServiceWorker);
}
