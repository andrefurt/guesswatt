/**
 * Main Entry Point
 * Form handlers, the comparison every flow runs, and initialization
 */

import { PROVIDERS } from './config.js';
import { loadOffers, parseNumber, toTitleCase, formatTariffName, isLargeHousehold } from './utils.js';
import { compare } from './calculator.js';
import { initPDFUpload } from './pdf-service.js';
import { initTabs, populateProvidersDropdown, matchProvidersToData, OTHER_PROVIDER } from './ui-components.js';
import { renderResult } from './ui-renderer.js';
import { initUIHandlers, hideResults, setEstimadoData, setInvoiceData } from './ui-handlers.js';
import { initPageActions } from './page-actions.js';
import { readState, writeState, monthOf } from './url-state.js';
import { formatDataMonth, loadDataStatus } from './data-date.js';

// =============================================================================
// COMPARISON
// =============================================================================

const TARIFF_NAMES = { 1: 'Simples', 2: 'Bi-horária', 3: 'Tri-horária' };

// Status line copy (voice in docs/COPY.mdc); technical detail goes to the console
const STATUS = {
  loading: 'A calcular…',
  loadFailed: 'Não conseguimos carregar os dados das tarifas. Tenta novamente ou volta mais tarde.',
  noOffers: 'Não encontrámos ofertas para esta potência e este tipo de tarifa. Experimenta outra potência ou tarifa.',
  billRange: 'Indica um valor entre 20 € e 500 €.',
  billNotNumber: 'Escreve só o valor em euros, por exemplo 87,50.',
  noConsumption: 'Indica o consumo mensal em kWh.',
  consumptionNotNumber: 'Escreve só o consumo em kWh, por exemplo 250.',
  consumptionRange: 'Indica um consumo entre 1 e 5000 kWh por mês.',
  notPDF: 'Escolhe um ficheiro PDF.',
  pdfUnreadable: 'Não conseguimos ler esta fatura. Podes introduzir os valores à mão.',
  pdfReaderMissing: 'Não conseguimos abrir o leitor de PDF. Da primeira vez precisa de ligação à internet; podes também introduzir os valores à mão.'
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
  // A new line replaces the old one, so a field it marked is no longer the one at fault
  document.querySelectorAll('[aria-invalid="true"]').forEach(clearInvalid);
  box.dataset.kind = kind;
  document.getElementById('form-status-text').textContent = text;
  statusAction = action?.run || null;
  button.textContent = action?.label || '';
  button.hidden = !action;
}

/**
 * An input error: the status line says what to type, and the field is marked, described by it and
 * focused, so a screen reader hears the error where the person has to fix it
 * @param {string} id - The field
 * @param {string} text - From STATUS
 */
function fieldError(id, text) {
  setStatus('error', text);
  const field = document.getElementById(id);
  if (!field) return;
  field.setAttribute('aria-invalid', 'true');
  field.setAttribute('aria-describedby', 'form-status-text');
  field.focus();
}

function clearInvalid(field) {
  field.removeAttribute('aria-invalid');
  field.removeAttribute('aria-describedby');
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
  // The link's price month belongs to this run only: a failed run must not pass it to the next
  // comparison the person types (a retry of this run gets it back)
  const fromLinkMonth = linkDataMonth;
  linkDataMonth = null;
  // While it runs, the submit buttons say so but keep focus (a disabled button drops it to <body>
  // in Chromium), and a repeat press is ignored
  if (comparing) return;
  comparing = true;
  const submits = document.querySelectorAll('#submit-btn, #manual-submit-btn');
  submits.forEach(button => button.setAttribute('aria-disabled', 'true'));
  const loading = setTimeout(() => setStatus('info', STATUS.loading), LOADING_DELAY_MS);

  let data;
  try {
    data = await loadOffers();
  } catch (error) {
    console.error(error);
    setStatus('error', STATUS.loadFailed, { label: 'Tentar novamente', run: () => { linkDataMonth = fromLinkMonth; runComparison(input); } });
    document.getElementById('form-status-action')?.focus();
    return;
  } finally {
    clearTimeout(loading);
    comparing = false;
    submits.forEach(button => button.removeAttribute('aria-disabled'));
  }

  const { offers, tar, dataDate } = data;
  let result;
  try {
    result = compare(offers, input, { tar, largeHousehold: isLargeHousehold() });
  } catch (error) {
    console.error(error);
    setStatus('error', STATUS.noOffers);
    // The fix is another power or tariff: focus the first, when the manual form shows it
    const power = document.getElementById('power');
    if (power?.checkVisibility?.()) power.focus();
    return;
  }

  setStatus('info');
  // The inputs go into the URL, so the result can be bookmarked or shared (url-state.js)
  history.replaceState(null, '', writeState(input, isLargeHousehold(), dataDate));
  const best = {
    ...result.best,
    dataDate,
    marketMedianCost: result.marketMedianCost,
    currentProvider: input.provider || null
  };
  renderResult(best, result.consumption, result.power, input.bill ?? null, result.savings, input.mode === 'estimate');

  // A shared link made with older prices: say the result uses today's
  if (fromLinkMonth && dataDate && monthOf(dataDate) !== fromLinkMonth) {
    document.getElementById('results-subtitle')?.append(` Este link foi criado com os preços de ${formatDataMonth(new Date(`${fromLinkMonth}-15T12:00:00Z`))}; o resultado usa os mais recentes.`);
  }
}

// A comparison is loading its data (runComparison)
let comparing = false;

// Price month of the link the page was opened with, until its result is shown
let linkDataMonth = null;

/**
 * Open the result a URL describes: fill the form it came from and send it, so it takes the same
 * path (and the same checks) as a person typing it
 */
function restoreFromURL() {
  const state = readState(location.search);
  if (!state) {
    // Drop a broken result link's keys only: other params (?sw, which registers the service worker
    // on localhost after load) stay
    const params = new URLSearchParams(location.search);
    const stateKeys = ['f', 'c', 'p', 't', 's', 'h', 'd'].filter(key => params.has(key));
    if (stateKeys.length) {
      stateKeys.forEach(key => params.delete(key));
      history.replaceState(null, '', location.pathname + (params.size ? `?${params}` : ''));
    }
    return;
  }
  linkDataMonth = state.dataMonth;
  document.getElementById('large-household').checked = state.largeHousehold;
  const { input } = state;
  if (input.mode === 'estimate') {
    document.getElementById('monthly-bill').value = String(input.bill);
    document.getElementById('estimate-form').requestSubmit();
    return;
  }
  document.getElementById('tab-preciso')?.click();
  document.getElementById('input-slot')?.classList.add('preciso-mode', 'manual-mode');
  document.getElementById('consumption').value = String(input.consumption);
  document.getElementById('power').value = String(input.power);
  document.getElementById('tariff-type').value = String(input.tariffType);
  document.getElementById('current-provider').value = input.provider || '';
  document.getElementById('precise-form').requestSubmit();
}

// =============================================================================
// FORM HANDLERS
// =============================================================================

// Estimate mode accepts bills in this range (€/month)
const MIN_BILL = 20;
const MAX_BILL = 500;
// The manual form accepts this consumption (kWh/month), the range a result link can carry (url-state.js)
const MIN_CONSUMPTION = 1;
const MAX_CONSUMPTION = 5000;

/**
 * Handler for estimate form submission
 * @param {Event} e - Form submit event
 */
function handleEstimateSubmit(e) {
  e.preventDefault();

  const typed = parseNumber(document.getElementById('monthly-bill').value);
  // Cents are kept, as a bill shows them; more digits than that are rounded away
  const monthlyBill = typed === null ? null : Math.round(typed * 100) / 100;

  // The estimate only holds for typical household bills
  if (monthlyBill === null && document.getElementById('monthly-bill').value.trim()) {
    fieldError('monthly-bill', STATUS.billNotNumber);
    return;
  }
  if (!(monthlyBill >= MIN_BILL && monthlyBill <= MAX_BILL)) {
    fieldError('monthly-bill', STATUS.billRange);
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

  const consumptionText = document.getElementById('consumption').value;
  const typedConsumption = parseNumber(consumptionText);
  // Bills show whole kWh: a decimal is rounded, so "250,5" is 251 and never an error (audit question 10)
  const consumption = typedConsumption === null ? null : Math.round(typedConsumption);
  const power = parseFloat(document.getElementById('power').value);
  const tariffType = parseInt(document.getElementById('tariff-type').value);
  const provider = document.getElementById('current-provider').value || null;

  setInvoiceData({
    provider: provider === OTHER_PROVIDER ? 'Outro' : provider ? toTitleCase(PROVIDERS[provider] || provider) : 'Manual',
    tariff: TARIFF_NAMES[tariffType] || 'Simples',
    consumption,
    power
  }, false);

  if (!consumptionText.trim()) {
    fieldError('consumption', STATUS.noConsumption);
    return;
  }
  if (consumption === null) {
    fieldError('consumption', STATUS.consumptionNotNumber);
    return;
  }
  if (!(consumption >= MIN_CONSUMPTION && consumption <= MAX_CONSUMPTION)) {
    fieldError('consumption', STATUS.consumptionRange);
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
 * Initialize application
 */
function init() {
  // Copy menu, then the logo, delete and About controls
  initPageActions();
  initUIHandlers();
  
  // Popular dropdown de fornecedores, then match it to this week's data
  populateProvidersDropdown();
  // Match the list to this week's data first, then open a result link: a link can name a supplier
  // that only the data lists (a new code not yet in PROVIDERS). loadDataStatus never rejects.
  loadDataStatus().then(({ providers }) => {
    matchProvidersToData(providers);
    restoreFromURL();
  });
  
  // Inicializar tabs
  initTabs();
  
  // A PDF with consumption and power goes straight to the comparison; a file that is not a PDF, or
  // one with no readable text, gets a line under the card
  initPDFUpload(handleInvoice, problem => {
    if (problem === 'not-pdf') setStatus('error', STATUS.notPDF);
    else setStatus('error', problem === 'no-reader' ? STATUS.pdfReaderMissing : STATUS.pdfUnreadable, { label: 'Introduzir manualmente', run: openManualForm });
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
  
  // Attach form handlers
  const estimateForm = document.getElementById('estimate-form');
  const preciseForm = document.getElementById('precise-form');
  
  if (estimateForm) {
    estimateForm.addEventListener('submit', handleEstimateSubmit);
  }
  
  if (preciseForm) {
    preciseForm.addEventListener('submit', handlePreciseSubmit);
  }

  // Typing in a field marked by an error clears the mark; the line stays until the next submit
  document.addEventListener('input', e => {
    if (e.target.getAttribute?.('aria-invalid') === 'true') clearInvalid(e.target);
  });
}

// Setup quando DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  // DOM já está pronto
  init();
}
