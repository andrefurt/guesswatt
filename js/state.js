/**
 * GuessWatt - URL State Management
 * 
 * Encode/decode application state in URL for bookmarks and sharing.
 * No localStorage dependency - state lives entirely in URL.
 */

/**
 * Encode state object to URL-safe base64.
 * 
 * @param {Object} state - State to encode
 * @returns {string} Base64 encoded string
 */
export function encodeState(state) {
  const json = JSON.stringify(state);
  return btoa(encodeURIComponent(json));
}

/**
 * Decode state from base64 string.
 * 
 * @param {string} encoded - Base64 encoded state
 * @returns {Object|null} Decoded state, or null if invalid
 */
export function decodeState(encoded) {
  try {
    const json = decodeURIComponent(atob(encoded));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/**
 * Update URL with state (without page reload).
 * 
 * @param {Object} state - State to save
 */
export function pushState(state) {
  const encoded = encodeState(state);
  const url = new URL(window.location);
  url.searchParams.set('s', encoded);
  history.pushState(null, '', url);
}

/**
 * Replace current URL with state (no history entry).
 * 
 * @param {Object} state - State to save
 */
export function replaceState(state) {
  const encoded = encodeState(state);
  const url = new URL(window.location);
  url.searchParams.set('s', encoded);
  history.replaceState(null, '', url);
}

/**
 * Read state from current URL.
 * 
 * @returns {Object|null} Decoded state, or null if none
 */
export function readState() {
  const url = new URL(window.location);
  const encoded = url.searchParams.get('s');
  return encoded ? decodeState(encoded) : null;
}

/**
 * Clear state from URL.
 */
export function clearState() {
  const url = new URL(window.location);
  url.searchParams.delete('s');
  history.replaceState(null, '', url);
}

/**
 * Get shareable URL with current state.
 * 
 * @param {Object} state - State to include
 * @returns {string} Full URL with state
 */
export function getShareableURL(state) {
  const encoded = encodeState(state);
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set('s', encoded);
  return url.toString();
}

/**
 * Create state object for comparison result.
 * Uses short keys to minimize URL length.
 * 
 * @param {Object} options - Full state options
 * @returns {Object} Compact state object
 */
export function createComparisonState({ 
  power, 
  consumption, 
  tariffType, 
  offPeakPercent,
  bestPrice,
  currentPrice,
}) {
  return {
    p: power,                    // power (kVA)
    c: consumption,              // consumption (kWh)
    t: tariffType,               // tariff type (1/2/3)
    v: Math.round(offPeakPercent * 100), // off-peak % (0-100, stored as integer)
    b: Math.round(bestPrice),    // best price (€)
    r: currentPrice ? Math.round(currentPrice) : null, // current price if known
    d: new Date().toISOString().slice(0, 7), // date (YYYY-MM)
  };
}

/**
 * Parse comparison state back to full object.
 * 
 * @param {Object} compact - Compact state from URL
 * @returns {Object} Full state object
 */
export function parseComparisonState(compact) {
  if (!compact) return null;
  
  return {
    power: compact.p,
    consumption: compact.c,
    tariffType: compact.t,
    offPeakPercent: compact.v ? compact.v / 100 : 0, // Convert from 0-100 to 0-1
    bestPrice: compact.b,
    currentPrice: compact.r,
    date: compact.d,
  };
}

/**
 * Check if saved state is stale (older than N months).
 * 
 * @param {Object} state - State with date
 * @param {number} months - Staleness threshold (default: 2)
 * @returns {boolean} True if state is stale
 */
export function isStateStale(state, months = 2) {
  if (!state?.d) return true;
  
  const stateDate = new Date(state.d + '-01');
  const now = new Date();
  const diffMonths = (now.getFullYear() - stateDate.getFullYear()) * 12 + 
                     (now.getMonth() - stateDate.getMonth());
  
  return diffMonths >= months;
}
