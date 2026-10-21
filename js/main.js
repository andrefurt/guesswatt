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

// Status line copy (docs/COPY.mdc, "Estados Vazios e Erros"); technical detail goes to the console
const STATUS = {
  loading: 'A calcular…',
  loadFailed: 'Não conseguimos carregar os dados das tarifas. Tenta novamente ou volta mais tarde.',
  noOffers: 'Não encontrámos ofertas para esta potência e este tipo de tarifa. Experimenta outra potência ou tarifa.',
  billRange: 'Indica um valor entre 20 € e 500 €.',
  noConsumption: 'Indica o consumo mensal em kWh.',
  notPDF: 'Escolhe um ficheiro PDF.',
  pdfUnreadable: 'Não conseguimos ler esta fatura. Podes introduzir os valores à mão.'
};
const LOADING_DELAY_MS = 300; // a quicker answer shows no loading line, so nothing flashes

let statusAction = null;

/**
 * Write the status line under the input card; an empty text clears it
 * @param {'info'|'error'} kind
 * @param {string} text
 * @param {{label: string, run: Function}} [action] - One next step, shown as a button
 */
function setStatus(kind, text = '', action = null) {
  const box = document.getElementById('form-status');
  const button = document.getElementById('form-status-action');
  if (!box || !button) return;
  box.dataset.kind = kind;
  document.getElementById('form-status-text').textContent = text;
  statusAction = action?.run || null;
  button.textContent = action?.label || '';
  button.hidden = !action;
}

/** Show the manual form with focus on its first field (the way out of an unreadable PDF) */
function openManualForm() {
  setStatus('info');
  document.getElementById('tab-preciso')?.click();
  document.getElementById('input-slot')?.classList.add('preciso-mode', 'manual-mode');
  document.getElementById('current-provider')?.focus();
}

/**
 * Load the data, run the one comparison (calculator.js compare) and render it. Every flow ends here.
 * @param {Object} input - See compare(); precise input may carry provider (ERSE code)
 */
async function runComparison(input) {
  const submits = document.querySelectorAll('.submit-btn');
  submits.forEach(button => { button.disabled = true; });
  const loading = setTimeout(() => setStatus('info', STATUS.loading), LOADING_DELAY_MS);

  let data;
  try {
    data = await loadOffers();
  } catch (error) {
    console.error(error);
    setStatus('error', STATUS.loadFailed, { label: 'Tentar novamente', run: () => runComparison(input) });
    return;
  } finally {
    clearTimeout(loading);
    submits.forEach(button => { button.disabled = false; });
  }

  const { offers, tar, dataDate } = data;
  let result;
  try {
    result = compare(offers, input, { tar, largeHousehold: isLargeHousehold() });
  } catch (error) {
    console.error(error);
    setStatus('error', STATUS.noOffers);
    return;
  }

  setStatus('info');
  const best = {
    ...result.best,
    dataDate,
    marketMedianCost: result.marketMedianCost,
    currentProvider: input.provider || null
  };
  renderResult(best, result.consumption, result.power, input.bill ?? null, result.savings, input.mode === 'estimate');
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
  if (!(monthlyBill >= MIN_BILL && monthlyBill <= MAX_BILL)) {
    setStatus('error', STATUS.billRange);
    document.getElementById('monthly-bill')?.focus();
    return;
  }

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
    setStatus('error', STATUS.noConsumption);
    document.getElementById('consumption')?.focus();
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
  
  // Popular dropdown de fornecedores
  populateProvidersDropdown();
  
  // Inicializar tabs
  initTabs();
  
  // A PDF with consumption and power goes straight to the comparison; a file that is not a PDF, or
  // one with no readable text, gets a line under the card
  initPDFUpload(handleInvoice, problem => {
    if (problem === 'not-pdf') setStatus('error', STATUS.notPDF);
    else setStatus('error', STATUS.pdfUnreadable, { label: 'Introduzir manualmente', run: openManualForm });
  });
  document.getElementById('form-status-action')?.addEventListener('click', () => statusAction?.());
  // A message belongs to the form it came from
  document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => setStatus('info')));
  
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
  
  // "Escolher o fornecedor" in a result with no supplier: back to the manual form, values kept
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
