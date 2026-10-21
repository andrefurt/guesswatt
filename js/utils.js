/**
 * Utility Functions
 * Data loading, phone and name formatting, and small helpers
 */

import { loadDataStatus } from './data-date.js';

let offersRequest = null;

/**
 * Load data/offers.json, with data/tar.json and the data date in parallel.
 * Fetched once per page load: later calls share the same promise, and a failed load is
 * forgotten so the next call retries. Callers must not mutate the returned offers.
 * @returns {Promise<{offers: Array<Object>, tar: Object|null, dataDate: Date|null}>}
 * @throws {Error} When offers.json cannot be loaded
 */
export function loadOffers() {
  offersRequest ??= fetchOffers().catch(error => {
    offersRequest = null;
    throw error;
  });
  return offersRequest;
}

async function fetchOffers() {
  const tarRequest = loadAccessTariffs();
  const dataDateRequest = loadDataDate();

  const response = await fetch('data/offers.json');
  if (!response.ok) {
    throw new Error(`offers.json: HTTP ${response.status}`);
  }
  const offers = await response.json();

  return { offers, tar: await tarRequest, dataDate: await dataDateRequest };
}

/**
 * Load the network-access (TAR) fixed terms used for the reduced VAT on the fixed term
 * @returns {Promise<Object|null>} data/tar.json, or null when it cannot be loaded
 *   (costs at 3.45 kVA or below then use the standard rate on the whole fixed term)
 */
async function loadAccessTariffs() {
  try {
    const response = await fetch('data/tar.json');
    if (response.ok) return await response.json();
  } catch (error) {
    console.warn('⚠️  Could not load tar.json:', error.message);
  }
  return null;
}

/**
 * Date of the prices in data/ (meta.json build.sourceUpdatedAt). Never the build time,
 * which only says when the CSVs were last processed.
 * @returns {Promise<Date|null>} null when the source date is unknown
 */
export async function loadDataDate() {
  return (await loadDataStatus()).date;
}

/**
 * Format a data date as "dez. 2025"
 * @param {Date} date
 * @returns {string}
 */
export function formatShortDataMonth(date) {
  const month = new Intl.DateTimeFormat('pt-PT', { month: 'short', timeZone: 'Europe/Lisbon' }).format(date);
  const year = new Intl.DateTimeFormat('pt-PT', { year: 'numeric', timeZone: 'Europe/Lisbon' }).format(date);
  return `${month} ${year}`;
}

// PT-PT number formats: "54,28 €", "4,6". Intl puts a no-break space before the €.
const EURO = {
  0: new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }),
  2: new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })
};
const NUMBER = new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 2 });

/**
 * Format euros the PT-PT way: "54,28 €"
 * @param {number} value
 * @param {0|2} [decimals=2] - 0 for rounded figures ("cerca de 65 €")
 * @returns {string}
 */
export function formatEuro(value, decimals = 2) {
  return EURO[decimals].format(value);
}

/**
 * Format a number the PT-PT way, up to 2 decimals: "4,6", "250"
 * @param {number|string} value
 * @returns {string}
 */
export function formatNumber(value) {
  return NUMBER.format(Number(value));
}

/**
 * Whether the person said the household has 5 or more people (reduced VAT up to 300 kWh)
 * @returns {boolean}
 */
export function isLargeHousehold() {
  return document.getElementById('large-household')?.checked === true;
}

/**
 * Format phone number to Portuguese format (XXX XXX XXX)
 * @param {string|number} phone - Phone number to format
 * @returns {string|null} Formatted phone number or null if invalid
 */
export function formatPhone(phone) {
  if (!phone) return null;
  
  // Converter para string caso seja número
  const phoneStr = String(phone);
  
  // Remove caracteres não numéricos
  const clean = phoneStr.replace(/\D/g, '');
  
  if (clean.length === 9) {
    return `${clean.slice(0,3)} ${clean.slice(3,6)} ${clean.slice(6)}`;
  }
  return phoneStr;
}

/**
 * Convert all-caps names to title case (e.g., "ENIPLENITUDE" → "Eniplenitude")
 * @param {string} name - Name to convert
 * @returns {string} Title case name
 */
export function toTitleCase(name) {
  if (!name) return name;
  
  // Check if string is all uppercase (ignoring spaces and special chars)
  const hasLowercase = /[a-záàâãéêíóôõúç]/.test(name);
  
  // If already has lowercase, return as-is (e.g., "Tárifa Tendência")
  if (hasLowercase) {
    return name;
  }
  
  // Convert all-caps to title case: lowercase first, then capitalize each word
  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Format tariff name with cycle info if available
 * @param {string} tariffName - Base tariff name
 * @param {number} tariffType - Tariff type (1=simple, 2=bi-hourly, 3=tri-hourly)
 * @param {string|null} cycleType - Cycle type ('daily' | 'weekly' | null)
 * @returns {string} Formatted tariff name
 */
export function formatTariffName(tariffName, tariffType, cycleType = null) {
  if (!tariffName) {
    // Fallback to type-based name
    if (tariffType === 1) return 'Tarifa Simples';
    if (tariffType === 2) return 'Tarifa Bi-horária';
    if (tariffType === 3) return 'Tarifa Tri-horária';
    return 'Tarifa Simples';
  }
  
  // If cycle info is available and tariff is bi/tri-hourly, append cycle info
  if (cycleType && (tariffType === 2 || tariffType === 3)) {
    const cycleLabel = cycleType === 'daily' ? ' (Ciclo Diário)' : ' (Ciclo Semanal)';
    // Only append if not already in the name
    const normalizedName = tariffName.toLowerCase();
    if (!normalizedName.includes('ciclo') && !normalizedName.includes('diário') && 
        !normalizedName.includes('diario') && !normalizedName.includes('semanal')) {
      return tariffName + cycleLabel;
    }
  }
  
  return tariffName;
}

