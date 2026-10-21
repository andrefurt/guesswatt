/**
 * UI Handlers Module
 * The logo link, the delete button, results visibility and the input pill.
 * The copy menu is in page-actions.js, which sobre.html loads on its own.
 */

import { toTitleCase, formatEuro, formatNumber } from './utils.js';
import { clearPDF } from './pdf-service.js';

// =============================================================================
// STATE - Track invoice data for input pill
// =============================================================================

let invoiceData = null;
let currentPillMode = 'estimado'; // 'estimado' or 'preciso'

// =============================================================================
// DELETE BUTTON - Return to input view
// =============================================================================

/**
 * Initialize delete button to return to input view
 */
function initDeleteButton() {
  const deleteBtn = document.getElementById('delete-btn');
  if (!deleteBtn) return;
  
  deleteBtn.addEventListener('click', function() {
    hideResults();
    // The delete button leaves with the results view: focus goes where the next entry starts
    document.getElementById('monthly-bill')?.focus();
  });
}

/**
 * Hide results view and return to input view with animation
 * Resets to clean estimado mode (clears invoice data)
 */
export function hideResults() {
  const pageWrapper = document.getElementById('page-wrapper');
  const inputPill = document.getElementById('input-pill');
  const inputView = document.getElementById('input-view');
  const inputSlot = document.getElementById('input-slot');
  const inputGroup = document.getElementById('input-group');
  const preciseMode = document.getElementById('precise-mode');
  const manualForm = document.getElementById('manual-form');
  const tabEstimado = document.getElementById('tab-estimado');
  const tabPreciso = document.getElementById('tab-preciso');
  const tabsIndicator = document.getElementById('tabs-indicator');
  const tabsWrapper = document.getElementById('tabs-wrapper');
  const resultDiv = document.getElementById('result');
  
  // Remove results-view class (CSS handles visibility)
  if (pageWrapper) {
    pageWrapper.classList.remove('results-view');
  }

  // The URL describes the result (url-state.js); with the result gone, it goes too
  history.replaceState(null, '', location.pathname);
  
  // Reset input pill mode (CSS handles visibility via .results-view)
  if (inputPill) {
    inputPill.classList.remove('preciso-mode');
  }
  
  // Clear invoice data
  clearInvoiceData();
  
  // Reset to estimado mode (clean state)
  if (inputSlot) {
    inputSlot.classList.remove('preciso-mode');
    inputSlot.classList.remove('manual-mode');
  }
  
  // Show estimado input group, hide others
  if (inputGroup) {
    inputGroup.classList.add('active');
  }
  if (preciseMode) {
    preciseMode.classList.remove('active');
  }
  if (manualForm) {
    manualForm.classList.remove('active');
  }
  
  // Update tabs
  if (tabEstimado && tabPreciso) {
    tabEstimado.classList.add('active');
    tabEstimado.setAttribute('aria-pressed', 'true');
    tabPreciso.classList.remove('active');
    tabPreciso.setAttribute('aria-pressed', 'false');
  }
  
  // Move indicator to estimado tab
  if (tabsIndicator && tabsWrapper && tabEstimado) {
    requestAnimationFrame(() => {
      const wrapperRect = tabsWrapper.getBoundingClientRect();
      const tabRect = tabEstimado.getBoundingClientRect();
      const left = tabRect.left - wrapperRect.left;
      const width = tabRect.width;
      tabsIndicator.style.transform = `translateX(${left}px)`;
      tabsIndicator.style.width = `${width}px`;
    });
  }
  
  // Clear result content to reset animations for next submission
  // Do this after a short delay to allow exit animations
  setTimeout(() => {
    if (resultDiv) {
      resultDiv.innerHTML = '';
      resultDiv.style.display = 'none';
    }
    // Remove dynamically added info section (matches new structure)
    const currentResultInfo = document.querySelector('.result-card-container > .result-info');
    if (currentResultInfo) {
      currentResultInfo.remove();
    }
  }, 200);
  
  // Add returning class for appear animation
  if (inputView) {
    inputView.classList.add('returning');
    
    // Remove returning class after animations complete
    setTimeout(() => {
      inputView.classList.remove('returning');
    }, 350);
  }
}

/**
 * Show results view (called from renderResult, but exported for external use)
 */
export function showResults() {
  const pageWrapper = document.getElementById('page-wrapper');
  const inputPill = document.getElementById('input-pill');
  
  // Add results-view class - CSS handles all visibility
  if (pageWrapper) {
    pageWrapper.classList.add('results-view');
  }

  // The form that had focus is now hidden: move focus to the result's heading, so keyboard and
  // screen reader users start reading the answer (tabindex="-1" in index.html)
  document.querySelector('.results-title')?.focus();
  
  // Set pill mode based on current state
  if (inputPill) {
    if (currentPillMode === 'preciso') {
      inputPill.classList.add('preciso-mode');
    } else {
      inputPill.classList.remove('preciso-mode');
    }
  }
}

// =============================================================================
// INPUT PILL DATA - Populate with invoice data
// =============================================================================

/**
 * Set invoice data for the input pill (preciso mode)
 * @param {Object} data - Invoice data { provider, tariff, consumption, power }
 * @param {boolean} fromPDF - Whether data comes from PDF (true) or manual entry (false)
 */
export function setInvoiceData(data, fromPDF = false) {
  invoiceData = data;
  currentPillMode = 'preciso';
  
  // Update pill UI elements
  const pillProvider = document.getElementById('pill-provider');
  const pillTariff = document.getElementById('pill-tariff');
  const pillConsumption = document.getElementById('pill-consumption');
  const pillPower = document.getElementById('pill-power');
  const inputPill = document.getElementById('input-pill');
  const dropArea = document.getElementById('precise-mode');
  
  if (pillProvider && data.provider) {
    pillProvider.textContent = toTitleCase(data.provider);
  }
  if (pillTariff && data.tariff) {
    pillTariff.textContent = toTitleCase(data.tariff);
  }
  if (pillConsumption && data.consumption) {
    pillConsumption.textContent = `${formatNumber(data.consumption)} kWh`;
  }
  if (pillPower && data.power) {
    pillPower.textContent = `${formatNumber(data.power)} kVA`;
  }
  
  // Show/hide PDF icon based on source
  // Check if drop area has has-file class (PDF) or if explicitly fromPDF
  const isFromPDF = fromPDF || (dropArea && dropArea.classList.contains('has-file'));
  if (inputPill) {
    if (isFromPDF) {
      inputPill.classList.add('pdf-source');
    } else {
      inputPill.classList.remove('pdf-source');
    }
  }
}

/**
 * Set estimado mode data for the input pill
 * @param {number} amount - Monthly bill amount
 */
export function setEstimadoData(amount) {
  currentPillMode = 'estimado';
  invoiceData = null;
  
  const pillAmount = document.getElementById('pill-amount');
  if (pillAmount) {
    pillAmount.textContent = formatEuro(amount, Number.isInteger(amount) ? 0 : 2);
  }
}

/**
 * Clear invoice data (reset to default)
 * Resets both internal state and visual UI elements
 */
export function clearInvoiceData() {
  invoiceData = null;
  currentPillMode = 'estimado';
  
  // Reset pill visual fields to defaults
  const pillProvider = document.getElementById('pill-provider');
  const pillTariff = document.getElementById('pill-tariff');
  const pillConsumption = document.getElementById('pill-consumption');
  const pillPower = document.getElementById('pill-power');
  
  if (pillProvider) pillProvider.textContent = '';
  if (pillTariff) pillTariff.textContent = '';
  if (pillConsumption) pillConsumption.textContent = '';
  if (pillPower) pillPower.textContent = '';
  
  // Back to the empty drop area
  clearPDF();
  
  // Reset manual form fields
  const preciseForm = document.getElementById('precise-form');
  if (preciseForm) preciseForm.reset();
}

/**
 * Get current pill mode
 * @returns {string} 'estimado' or 'preciso'
 */
export function getPillMode() {
  return currentPillMode;
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize all UI handlers
 */
/**
 * Initialize logo link to redirect to home (estimate mode)
 */
function initLogoLink() {
  const logoLink = document.getElementById('logo-link');
  if (!logoLink) return;
  
  logoLink.addEventListener('click', function(e) {
    e.preventDefault();
    // Hide results view and show input view (estimate mode)
    hideResults();
    // Reset to estimate mode if needed
    const estimateTab = document.getElementById('tab-estimado');
    if (estimateTab) {
      estimateTab.click();
    }
  });
}

export function initUIHandlers() {
  initLogoLink();
  initDeleteButton();
}
