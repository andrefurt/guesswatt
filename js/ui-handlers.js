/**
 * UI Handlers Module
 * Handles interactive UI elements: Copy button, Dropdown, Delete button, Results visibility
 * 
 * Matches design.html behavior exactly:
 * - Copy button: blur transition Emil Kowalski style
 * - Dropdown: smooth scale/opacity animation
 * - Delete button: returns to input view with animation
 */

import { resetPDFData } from './pdf-service.js';

// =============================================================================
// STATE - Track invoice data for input pill
// =============================================================================

let invoiceData = null;
let currentPillMode = 'estimado'; // 'estimado' or 'preciso'

// =============================================================================
// COPY BUTTON - Emil Kowalski blur transition
// =============================================================================

let copyTimeout = null;

/**
 * Initialize copy button with blur transition
 */
function initCopyButton() {
  const copyBtn = document.getElementById('copy-btn');
  if (!copyBtn) return;
  
  copyBtn.addEventListener('click', async function() {
    // Prevent multiple clicks during animation
    if (copyBtn.classList.contains('copied')) return;
    
    // Copy to clipboard
    const textToCopy = 'Guesswatt - Comparador de tarifas de eletricidade';
    try {
      await navigator.clipboard.writeText(textToCopy);
    } catch (err) {
      console.log('Copied:', textToCopy);
    }
    
    // Add copied state with blur transition
    copyBtn.classList.add('copied');
    
    // Reset after 2 seconds
    clearTimeout(copyTimeout);
    copyTimeout = setTimeout(() => {
      copyBtn.classList.remove('copied');
    }, 2000);
  });
}

// =============================================================================
// DROPDOWN - Emil Kowalski animations
// =============================================================================

/**
 * Initialize dropdown with smooth animations
 */
function initDropdown() {
  const dropdownWrapper = document.getElementById('dropdown-wrapper');
  const dropdownTrigger = document.getElementById('dropdown-trigger');
  const dropdownMenu = document.getElementById('dropdown-menu');
  
  if (!dropdownWrapper || !dropdownTrigger || !dropdownMenu) return;
  
  const dropdownItems = dropdownMenu.querySelectorAll('.dropdown-item');
  
  // Toggle dropdown on trigger click
  dropdownTrigger.addEventListener('click', function(e) {
    e.stopPropagation();
    dropdownWrapper.classList.toggle('open');
    
    // Update ARIA
    const isOpen = dropdownWrapper.classList.contains('open');
    dropdownTrigger.setAttribute('aria-expanded', isOpen);
  });
  
  // Close on outside click
  document.addEventListener('click', function(e) {
    if (!dropdownWrapper.contains(e.target)) {
      dropdownWrapper.classList.remove('open');
      dropdownTrigger.setAttribute('aria-expanded', 'false');
    }
  });
  
  // Close on escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      dropdownWrapper.classList.remove('open');
      dropdownTrigger.setAttribute('aria-expanded', 'false');
    }
  });
  
  // Handle dropdown item clicks
  dropdownItems.forEach(item => {
    item.addEventListener('click', function() {
      const action = this.dataset.action;
      
      // Close dropdown with slight delay for click feedback
      setTimeout(() => {
        dropdownWrapper.classList.remove('open');
        dropdownTrigger.setAttribute('aria-expanded', 'false');
      }, 100);
      
      // Handle actions
      handleDropdownAction(action);
    });
  });
}

/**
 * Handle dropdown action
 * @param {string} action - Action identifier
 */
async function handleDropdownAction(action) {
  const copyBtn = document.getElementById('copy-btn');
  
  // Determine which markdown file to use based on current page
  const isAboutPage = window.location.pathname.includes('sobre');
  const markdownFile = isAboutPage ? 'sobre.md' : 'index.md';
  
  switch(action) {
    case 'markdown':
      try {
        const response = await fetch(markdownFile);
        const markdown = await response.text();
        await navigator.clipboard.writeText(markdown);
        
        // Show copied feedback on main button
        if (copyBtn) {
          copyBtn.classList.add('copied');
          clearTimeout(copyTimeout);
          copyTimeout = setTimeout(() => {
            copyBtn.classList.remove('copied');
          }, 2000);
        }
      } catch (err) {
        console.error('Failed to copy markdown:', err);
      }
      break;
      
    case 'chatgpt':
      const llmsUrl = window.location.origin + '/llms.txt';
      const chatGPTPrompt = encodeURIComponent(`Use this documentation to answer questions about GuessWatt: ${llmsUrl}`);
      window.open(`https://chatgpt.com/?q=${chatGPTPrompt}`, '_blank');
      break;
      
    case 'claude':
      const claudeUrl = window.location.origin + '/llms.txt';
      const claudePrompt = encodeURIComponent(`Use this documentation to answer questions about GuessWatt: ${claudeUrl}`);
      window.open(`https://claude.ai/new?q=${claudePrompt}`, '_blank');
      break;
  }
}

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
    tabEstimado.setAttribute('aria-selected', 'true');
    tabPreciso.classList.remove('active');
    tabPreciso.setAttribute('aria-selected', 'false');
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
 */
export function setInvoiceData(data) {
  invoiceData = data;
  currentPillMode = 'preciso';
  
  // Update pill UI elements
  const pillProvider = document.getElementById('pill-provider');
  const pillTariff = document.getElementById('pill-tariff');
  const pillConsumption = document.getElementById('pill-consumption');
  const pillPower = document.getElementById('pill-power');
  
  if (pillProvider && data.provider) {
    pillProvider.textContent = data.provider;
  }
  if (pillTariff && data.tariff) {
    pillTariff.textContent = data.tariff;
  }
  if (pillConsumption && data.consumption) {
    pillConsumption.textContent = `${data.consumption} kWh`;
  }
  if (pillPower && data.power) {
    pillPower.textContent = `${data.power} kVA`;
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
    pillAmount.textContent = `€${amount}`;
  }
}

/**
 * Clear invoice data (reset to default)
 * Resets both internal state and visual UI elements
 */
export function clearInvoiceData() {
  invoiceData = null;
  currentPillMode = 'estimado';
  
  // Reset PDF service state
  resetPDFData();
  
  // Reset pill visual fields to defaults
  const pillProvider = document.getElementById('pill-provider');
  const pillTariff = document.getElementById('pill-tariff');
  const pillConsumption = document.getElementById('pill-consumption');
  const pillPower = document.getElementById('pill-power');
  
  if (pillProvider) pillProvider.textContent = '';
  if (pillTariff) pillTariff.textContent = '';
  if (pillConsumption) pillConsumption.textContent = '';
  if (pillPower) pillPower.textContent = '';
  
  // Reset file input
  const pdfInput = document.getElementById('pdf-input');
  if (pdfInput) pdfInput.value = '';
  
  // Reset precise mode drop area to initial state
  const dropArea = document.getElementById('precise-mode');
  const dropAreaText = dropArea?.querySelector('.drop-area-text');
  const manualLink = document.getElementById('manual-link');
  
  // Remove has-file class
  if (dropArea) dropArea.classList.remove('has-file');
  
  // Restore original drop area content
  if (dropAreaText) {
    dropAreaText.innerHTML = `
      <p>Clica ou arrasta a tua fatura PDF</p>
      <a href="#" id="manual-link" aria-label="Introduzir dados da fatura manualmente">Adicionar dados manualmente</a>
    `;
  }
  
  // Show manual link
  if (manualLink) manualLink.style.display = 'inline';
  
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
  initCopyButton();
  initDropdown();
  initDeleteButton();
}
