/**
 * Data date
 * Shows the date of the prices (data/meta.json) in the footer, and a notice when they are
 * more than 45 days old. Loaded on every page.
 */

import { loadDataDate, formatDataMonth } from './utils.js';

const STALE_AFTER_DAYS = 45;
const DAY_MS = 24 * 60 * 60 * 1000;

async function renderDataDate() {
  const date = await loadDataDate();
  if (!date) return; // Unknown date: the footer just says "Dados: ERSE."

  const holder = document.getElementById('data-date');
  const time = holder?.querySelector('time');
  if (holder && time) {
    time.dateTime = date.toISOString().slice(0, 10);
    time.textContent = formatDataMonth(date);
    holder.hidden = false;
  }

  const stale = document.getElementById('data-stale');
  if (stale && (Date.now() - date.getTime()) / DAY_MS > STALE_AFTER_DAYS) {
    stale.hidden = false;
  }
}

renderDataDate();
