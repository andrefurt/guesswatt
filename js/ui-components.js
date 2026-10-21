/**
 * UI Components Module
 * Tabs and the supplier dropdown
 */

import { PROVIDERS } from './config.js';

/**
 * Initialize tabs functionality
 */
export function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  const tabsWrapper = document.getElementById('tabs-wrapper');
  const tabsIndicator = document.getElementById('tabs-indicator');
  const tabEstimado = document.getElementById('tab-estimado');
  const tabPreciso = document.getElementById('tab-preciso');
  
  /**
   * Move indicator to active tab
   * @param {HTMLElement} tabElement - Active tab element
   */
  function moveIndicator(tabElement) {
    if (!tabsIndicator || !tabElement || !tabsWrapper) return;
    
    const wrapperRect = tabsWrapper.getBoundingClientRect();
    const tabRect = tabElement.getBoundingClientRect();
    
    const left = tabRect.left - wrapperRect.left;
    const width = tabRect.width;
    
    tabsIndicator.style.transform = `translateX(${left}px)`;
    tabsIndicator.style.width = `${width}px`;
  }
  
  // Place the indicator, and place it again whenever the tabs change size: Inter arriving after the
  // first measure, a resize, zoom. A fixed rAF measure caught the fallback font's width.
  if (tabsWrapper && tabsIndicator) {
    const placeIndicator = new ResizeObserver(() => moveIndicator(tabsWrapper.querySelector('.tab.active') || tabEstimado));
    [tabsWrapper, ...tabs].forEach(element => placeIndicator.observe(element));
  }
  
  // Get input-slot element for preciso-mode class toggle
  const inputSlot = document.getElementById('input-slot');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const mode = tab.dataset.mode;
      
      // Update tab active state
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-pressed', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-pressed', 'true');
      
      // Move indicator
      moveIndicator(tab);
      
      // CRITICAL: Toggle preciso-mode class on input-slot
      if (inputSlot) {
        if (mode === 'estimate') {
          inputSlot.classList.remove('preciso-mode');
          inputSlot.classList.remove('manual-mode');
        } else if (mode === 'precise') {
          inputSlot.classList.add('preciso-mode');
          // Don't add manual-mode here - that's only for the manual form link
        }
      }
      
      // CSS now handles all visibility via parent .preciso-mode and .manual-mode classes
      // No need to toggle .active on individual elements
    });
  });
}

// Last option: a supplier that is not in ERSE's data (main.js and ui-renderer.js handle "outro")
export const OTHER_PROVIDER = 'outro';

/**
 * Fill the supplier dropdown: every named supplier at once, so a link (url-state.js) can select
 * one before the data loads, then "Outro"
 */
export function populateProvidersDropdown() {
  const providerSelect = document.getElementById('current-provider');
  if (!providerSelect) return;
  const byName = Object.entries(PROVIDERS).sort(([, a], [, b]) => a.localeCompare(b, 'pt'));
  byName.forEach(([code, name]) => providerSelect.append(new Option(name, code)));
  providerSelect.append(new Option('Outro', OTHER_PROVIDER));
}

/**
 * Match the dropdown to the suppliers in the data (meta.json build.providers): drop the named ones
 * with no offers this week, and add a new code under its ERSE code until PROVIDERS names it. So a
 * supplier entering or leaving the market changes the list, never breaks the page or the refresh.
 * @param {string[]|null} codes - null when meta.json could not be read (the list stays as it is)
 */
export function matchProvidersToData(codes) {
  const providerSelect = document.getElementById('current-provider');
  if (!providerSelect || !codes) return;
  const inData = new Set(codes);
  for (const option of [...providerSelect.options]) {
    const keep = !option.value || option.value === OTHER_PROVIDER || inData.has(option.value) || option.selected;
    if (!keep) option.remove();
  }
  const other = [...providerSelect.options].find(option => option.value === OTHER_PROVIDER);
  codes.filter(code => !PROVIDERS[code]).sort().forEach(code => providerSelect.insertBefore(new Option(code, code), other));
}

