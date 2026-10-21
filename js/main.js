/**
 * Main Entry Point
 * Form handlers, the comparison every flow runs, and initialization
 */

import { PROVIDERS } from './config.js';
import { loadOffers, toTitleCase, formatTariffName, isLargeHousehold } from './utils.js';
import { compare } from './calculator.js';
import { initPDFUpload } from './pdf-service.js';
import { initTooltips, initTabs, populateProvidersDropdown } from './ui-components.js';
import { renderResult } from './ui-renderer.js';
import { initUIHandlers, hideResults, setEstimadoData, setInvoiceData } from './ui-handlers.js';
import { initPageActions } from './page-actions.js';

// =============================================================================
// COMPARISON
// =============================================================================

const TARIFF_NAMES = { 1: 'Simples', 2: 'Bi-horária', 3: 'Tri-horária' };

/**
 * Load the data, run the one comparison (calculator.js compare) and render it. Every flow ends here.
 * @param {Object} input - See compare(); precise input may carry provider (ERSE code)
 */
async function runComparison(input) {
  const resultDiv = document.getElementById('result');
  if (!resultDiv) return;
  resultDiv.innerHTML = '<p>A calcular...</p>';

  try {
    const { offers, tar, dataDate } = await loadOffers();
    const result = compare(offers, input, { tar, largeHousehold: isLargeHousehold() });
    const best = {
      ...result.best,
      dataDate,
      marketMedianCost: result.marketMedianCost,
      currentProvider: input.provider || null
    };
    renderResult(best, result.consumption, result.power, input.bill ?? null, result.savings, input.mode === 'estimate');
  } catch (error) {
    resultDiv.innerHTML = `<p class="error">Erro: ${error.message}</p>`;
    console.error(error);
  }
}

// =============================================================================
// FORM HANDLERS
// =============================================================================

// Estimate mode accepts bills in this range (€/month)
const MIN_BILL = 20;
const MAX_BILL = 500;

/**
 * Handler for estimate form submission
 * @param {Event} e - Form submit event
 */
function handleEstimateSubmit(e) {
  e.preventDefault();

  const monthlyBill = parseFloat(String(document.getElementById('monthly-bill').value).replace(',', '.'));

  // The estimate only holds for typical household bills
  const billNote = document.getElementById('estimate-note');
  if (!(monthlyBill >= MIN_BILL && monthlyBill <= MAX_BILL)) {
    if (billNote) billNote.hidden = false;
    document.getElementById('monthly-bill')?.focus();
    return;
  }
  if (billNote) billNote.hidden = true;

  setEstimadoData(monthlyBill);
  runComparison({ mode: 'estimate', bill: monthlyBill });
}

/**
 * Handler for precise form submission
 * @param {Event} e - Form submit event
 */
function handlePreciseSubmit(e) {
  e.preventDefault();

  // The "missing field" note from a partial PDF has done its job once the form is sent
  const formNote = document.getElementById('manual-form-note');
  if (formNote) formNote.hidden = true;

  const consumption = parseFloat(document.getElementById('consumption').value);
  const power = parseFloat(document.getElementById('power').value);
  const tariffType = parseInt(document.getElementById('tariff-type').value);
  const provider = document.getElementById('current-provider').value || null;

  setInvoiceData({
    provider: provider ? toTitleCase(PROVIDERS[provider] || provider) : 'Manual',
    tariff: TARIFF_NAMES[tariffType] || 'Simples',
    consumption,
    power
  }, false);

  if (!consumption || consumption <= 0) {
    document.getElementById('result').innerHTML = '<p class="error">Erro: Introduz um consumo válido</p>';
    return;
  }

  runComparison({ mode: 'precise', consumption, power, tariffType, provider });
}

/**
 * A PDF was read with consumption and power: fill the pill and compare
 * @param {Object} invoice - parseInvoiceText output
 */
function handleInvoice(invoice) {
  setInvoiceData({
    provider: invoice.provider ? toTitleCase(PROVIDERS[invoice.provider] || invoice.provider) : 'Não detetado',
    tariff: formatTariffName(TARIFF_NAMES[invoice.tariffType], invoice.tariffType, invoice.cycleType),
    consumption: invoice.consumption,
    power: invoice.power
  }, true);

  runComparison({
    mode: 'precise',
    consumption: invoice.consumption,
    power: invoice.power,
    tariffType: invoice.tariffType,
    distribution: invoice.distribution,
    provider: invoice.provider || null
  });
}

// =============================================================================
// INITIALIZATION
// =============================================================================

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

/**
 * Initialize application
 */
function init() {
  // Copy menu, then the logo, delete and About controls
  initPageActions();
  initUIHandlers();
  
  // Popular dropdown de operadores
  populateProvidersDropdown();
  
  // Event delegation for copy phone button (works for both new and cached results)
  const resultDiv = document.getElementById('result');
  if (resultDiv) {
    resultDiv.addEventListener('click', async (e) => {
      const copyPhoneBtn = e.target.closest('.copy-phone-btn');
      if (copyPhoneBtn) {
        e.preventDefault();
        const phone = copyPhoneBtn.dataset.phone;
        if (phone) {
          try {
            await navigator.clipboard.writeText(phone);
            const originalText = copyPhoneBtn.textContent;
            copyPhoneBtn.textContent = '✓ Copiado!';
            setTimeout(() => {
              copyPhoneBtn.textContent = originalText;
            }, 2000);
          } catch (err) {
            console.error('Failed to copy phone:', err);
          }
        }
      }
    });
  }
  
  // Inicializar tabs
  initTabs();
  
  // A PDF with consumption and power goes straight to the comparison
  initPDFUpload(handleInvoice);
  
  // Event delegation for manual-link (can be recreated dynamically)
  const inputSlot = document.getElementById('input-slot');
  const pdfLink = document.getElementById('pdf-link');
  
  // Use event delegation on document for manual-link
  document.addEventListener('click', (e) => {
    const manualLink = e.target.closest('#manual-link');
    if (manualLink) {
      e.preventDefault();
      e.stopPropagation();
      
      // Show manual form - need BOTH preciso-mode AND manual-mode on input-slot
      if (inputSlot) {
        inputSlot.classList.add('preciso-mode');
        inputSlot.classList.add('manual-mode');
      }
      // CSS handles visibility via .preciso-mode.manual-mode .manual-form
    }
  });
  
  if (pdfLink) {
    pdfLink.addEventListener('click', (e) => {
      e.preventDefault();
      
      // Hide manual form, show PDF upload
      // CSS handles visibility via .preciso-mode.manual-mode selectors
      if (inputSlot) {
        inputSlot.classList.remove('manual-mode');
        // Keep preciso-mode class - CSS shows drop-area when manual-mode is removed
      }
    });
  }
  
  // "Escolher o operador" in a result with no supplier: back to the manual form, values kept
  document.addEventListener('click', (e) => {
    const choose = e.target.closest('#choose-provider');
    if (!choose) return;
    const { consumption, power, tariff } = choose.dataset;
    hideResults();
    document.getElementById('tab-preciso')?.click();
    inputSlot?.classList.add('preciso-mode', 'manual-mode');
    document.getElementById('consumption').value = consumption;
    document.getElementById('power').value = power;
    document.getElementById('tariff-type').value = tariff;
    document.getElementById('current-provider')?.focus();
  });
  
  // "Usa o modo Preciso" in an estimate result: back to the form, on the Preciso tab
  document.addEventListener('click', (e) => {
    if (e.target.closest('#go-precise')) {
      hideResults();
      document.getElementById('tab-preciso')?.click();
    }
  });
  
  // Inicializar tooltips
  initTooltips();
  
  // Attach form handlers
  const estimateForm = document.getElementById('estimate-form');
  const preciseForm = document.getElementById('precise-form');
  
  if (estimateForm) {
    estimateForm.addEventListener('submit', handleEstimateSubmit);
  }
  
  if (preciseForm) {
    preciseForm.addEventListener('submit', handlePreciseSubmit);
  }
}

window.addEventListener('load', registerServiceWorker);

// Setup quando DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  // DOM já está pronto
  init();
}
