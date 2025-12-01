/**
 * GuessWatt - Main Application Entry Point
 * 
 * Orchestrates the electricity tariff comparison tool.
 * Zero dependencies (except pdf.js for PDF parsing).
 * 
 * @module app
 */

// ============================================================================
// Imports
// ============================================================================

import { DEFAULT_POWER, DEFAULT_TARIFF_TYPE, DEFAULT_VAZIO_PERCENT } from './constants.js';
import { loadCSVData } from './data/csv-parser.js';
import { compareOffers, estimateFromBill, calculateStats } from './data/calculator.js';
import { getProviderName } from './data/providers.js';
import { readState, pushState, createComparisonState, parseComparisonState, isStateStale } from './state.js';
import { extractFromPDF, isPDFExtractionAvailable } from './pdf-extractor.js';
import { formatCurrency, formatCurrencyCompact, formatPhone } from './utils/format.js';
import { $, $$, on, ready, show, hide } from './utils/dom.js';
import { createReminder } from './utils/calendar.js';
import { success, error } from './components/toast.js';
import { initTooltips } from './components/tooltip.js';

// ============================================================================
// State
// ============================================================================

/** Application state */
const state = {
  // Data
  prices: [],
  conditions: new Map(),
  dataLoaded: false,
  
  // User input
  monthlyBill: null,
  power: DEFAULT_POWER,
  consumption: null,
  tariffType: DEFAULT_TARIFF_TYPE,
  offPeakPercent: DEFAULT_VAZIO_PERCENT,
  currentProvider: null,
  
  // Input mode
  inputMode: 'estimate', // 'estimate' | 'precise' | 'manual'
  
  // Results
  results: [],
  bestOffer: null,
  stats: null
};

// ============================================================================
// DOM References
// ============================================================================

let elements = {};

function cacheElements() {
  try {
    elements = {
      // Sections
      heroSection: $('#hero-section'),
      inputContainer: $('.input-container'),
      resultSection: $('#result-section'),
      resultsWrapper: $('#results-wrapper'),
      switchGuide: $('#switch-guide'),
      
      // Input modes
      estimateMode: $('.input-mode-estimate'),
      detailsMode: $('.input-mode-details'),
      pdfMode: $('.input-mode-pdf'),
      
      // Input forms
      quickForm: $('#quick-form'),
      detailsForm: $('#details-form'),
      monthlyBillInput: $('#monthly-bill'),
      pdfInput: $('#pdf-input'),
      pdfTrigger: $('#pdf-trigger'),
      settingsTrigger: $('#settings-trigger'),
      submitBtn: $('#submit-btn'),
      backToEstimate: $('#back-to-estimate'),
      removePdf: $('#remove-pdf'),
      
      // Details form fields
      powerSelect: $('#power'),
      consumptionInput: $('#consumption'),
      tariffRadios: $$('#details-form [name="tariff"]'),
      offPeakInput: $('#off-peak-percent'),
      offPeakField: $('#off-peak-field'),
      
      // PDF card
      pdfFileName: $('#pdf-file-name'),
      pdfExtractedData: $('#pdf-extracted-data'),
      
      // Results
      currentCost: $('#current-cost'),
      lossValue: $('#loss-value'),
      bestOfferCard: $('#best-offer'),
      offersList: $('#offers-list'),
      showMoreBtn: $('#show-more-offers'),
      estimateNotice: $('#estimate-notice'),
      
      // Switch guide
      guideProvider: $('#guide-provider'),
      guidePhone: $('#guide-phone'),
      guideTariff: $('#guide-tariff'),
      guideWebsite: $('#guide-website'),
      
      // Actions
      refineBtn: $('#action-refine'),
      calendarBtn: $('#action-calendar'),
      backBtn: $('#action-back'),
      
      // Header/Footer for visibility control
      appHeader: $('.app-header'),
      appFooter: $('.app-footer'),
      
      // Legacy - kept for backward compatibility (should be null)
      refineSection: $('#refine-section'),
      refineForm: $('#refine-form')
    };
    
    // Verify critical elements exist
    const critical = ['heroSection', 'quickForm', 'monthlyBillInput', 'submitBtn'];
    critical.forEach(key => {
      if (!elements[key]) {
        // Critical element missing - error will be shown in init()
      }
    });
  } catch (err) {
    console.error('Error in cacheElements:', err);
    throw err;
  }
}

// ============================================================================
// Input Mode Management
// ============================================================================

/**
 * Sets the input mode (estimate, details, pdf)
 * @param {string} mode - The mode to set
 */
function setInputMode(mode) {
  if (!elements.inputContainer) return;
  
  // Hide all modes
  if (elements.estimateMode) elements.estimateMode.hidden = true;
  if (elements.detailsMode) elements.detailsMode.hidden = true;
  if (elements.pdfMode) elements.pdfMode.hidden = true;
  
  // Show selected mode
  switch (mode) {
    case 'estimate':
      if (elements.estimateMode) {
        elements.estimateMode.hidden = false;
        elements.inputContainer.setAttribute('data-mode', 'estimate');
      }
      break;
    case 'details':
      if (elements.detailsMode) {
        elements.detailsMode.hidden = false;
        elements.inputContainer.setAttribute('data-mode', 'details');
      }
      break;
    case 'pdf':
      if (elements.pdfMode) {
        elements.pdfMode.hidden = false;
        elements.inputContainer.setAttribute('data-mode', 'pdf');
      }
      break;
  }
  
  state.inputMode = mode;
}

/**
 * Sets the hero section state (initial, collapsed)
 * @param {string} heroState - The state to set
 */
function setHeroState(heroState) {
  if (!elements.heroSection) return;
  
  elements.heroSection.setAttribute('data-state', heroState);
  
  // Control header/footer visibility via body class
  if (heroState === 'initial') {
    document.body.classList.add('is-initial');
    document.body.classList.remove('is-collapsed');
  } else if (heroState === 'collapsed') {
    document.body.classList.remove('is-initial');
    document.body.classList.add('is-collapsed');
    
    // Make input container clickable to edit
    if (elements.inputContainer) {
      elements.inputContainer.style.cursor = 'pointer';
      elements.inputContainer.setAttribute('role', 'button');
      elements.inputContainer.setAttribute('tabindex', '0');
      elements.inputContainer.setAttribute('aria-label', 'Clicar para editar valores');
    }
  }
}

/**
 * Expands input for editing when in collapsed state
 */
function expandInputForEdit() {
  if (!elements.heroSection) return;
  
  const currentState = elements.heroSection.getAttribute('data-state');
  if (currentState === 'collapsed') {
    // Scroll to top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Switch back to initial state to allow editing
    // User can then modify and resubmit
    setHeroState('initial');
    setInputMode('estimate');
    
    // Focus on input
    if (elements.monthlyBillInput) {
      setTimeout(() => {
        elements.monthlyBillInput.focus();
        elements.monthlyBillInput.select();
      }, 300);
    }
  }
}

// ============================================================================
// Data Loading
// ============================================================================

/**
 * Loads CSV data from the data directory.
 */
async function loadData() {
  try {
    const data = await loadCSVData('./data/');
    state.prices = data.prices;
    // Convert conditions object to Map for consistent API
    state.conditions = new Map(Object.entries(data.conditions));
    state.dataLoaded = true;
    
    return true;
  } catch (err) {
    error('Não conseguimos carregar os dados. Tenta novamente.');
    return false;
  }
}

// ============================================================================
// Calculation
// ============================================================================

/**
 * Runs comparison with current state values.
 */
function runComparison() {
  if (!state.dataLoaded || !state.consumption) {
    return;
  }
  
  // Debug: Log input values
  console.log('🔍 [DEBUG] runComparison called with:');
  console.log('  - Power:', state.power, 'kVA');
  console.log('  - Consumption:', state.consumption, 'kWh');
  console.log('  - Tariff Type:', state.tariffType);
  console.log('  - Monthly Bill:', state.monthlyBill, '€');
  console.log('  - Prices count:', state.prices?.length || 0);
  console.log('  - Conditions count:', state.conditions?.size || 0);
  
  const results = compareOffers(
    state.prices,
    state.conditions,
    state.power,
    state.consumption,
    state.tariffType,
    state.offPeakPercent,
    state.monthlyBill // Pass current price for savings calculation
  );
  
  console.log('🔍 [DEBUG] compareOffers returned:', results.length, 'results');
  
  if (results.length > 0) {
    console.log('🔍 [DEBUG] Best offer (first result):');
    console.log('  - Provider:', results[0].providerName);
    console.log('  - Total:', results[0].total, '€/month');
    console.log('  - Savings:', results[0].savings, '€/month');
    console.log('  - Full offer:', results[0]);
  } else {
    console.warn('⚠️ [DEBUG] No results returned!');
  }
  
  state.results = results;
  state.stats = calculateStats(results, state.monthlyBill);
  state.bestOffer = results[0] || null;
  
  if (state.bestOffer) {
    console.log('🔍 [DEBUG] Best offer set:', {
      provider: state.bestOffer.providerName,
      total: state.bestOffer.total,
      savings: state.bestOffer.savings
    });
  }
}

// ============================================================================
// Rendering
// ============================================================================

/**
 * Renders the results section.
 */
function renderResults() {
  if (!state.bestOffer) {
    renderNoResults();
    return;
  }
  
  // Debug: Log values before rendering
  console.log('🔍 [DEBUG] renderResults - bestOffer:', {
    provider: state.bestOffer.providerName,
    total: state.bestOffer.total,
    code: state.bestOffer.offerCode
  });
  console.log('🔍 [DEBUG] renderResults - state:', {
    monthlyBill: state.monthlyBill,
    consumption: state.consumption,
    power: state.power
  });
  
  // Current cost - use monthlyBill if available, otherwise best offer
  const currentCost = state.monthlyBill || (state.bestOffer?.total || 0);
  elements.currentCost.textContent = formatCurrency(currentCost);
  
  // Loss calculation - ensure we're comparing positive values
  const bestOfferTotal = state.bestOffer.total || 0;
  
  // Validate: if best offer total is suspiciously low (< €5), something is wrong
  if (elements.lossValue) {
    if (bestOfferTotal < 5 && currentCost > 10) {
      console.error('❌ [DEBUG] Invalid best offer total detected!', {
        bestOfferTotal,
        currentCost,
        bestOffer: state.bestOffer
      });
      // Don't show savings if the calculation seems invalid
      if (elements.lossValue.parentElement) {
        elements.lossValue.parentElement.classList.add('hidden');
      }
    } else {
      const monthlySavings = Math.max(0, currentCost - bestOfferTotal);
      const annualSavings = monthlySavings * 12;
      
      console.log('🔍 [DEBUG] Savings calculation:', {
        currentCost,
        bestOfferTotal,
        monthlySavings,
        annualSavings
      });
      
      // Only show loss if there's a meaningful savings (> €1/year)
      if (annualSavings > 1 && annualSavings < 5000) { // Cap at €5000/year (sanity check)
        elements.lossValue.innerHTML = `
          <span class="amount">${formatCurrencyCompact(annualSavings)}</span>
          <span class="period">/ano</span>
        `;
        if (elements.lossValue.parentElement) {
          elements.lossValue.parentElement.classList.remove('hidden');
        }
      } else {
        if (elements.lossValue.parentElement) {
          elements.lossValue.parentElement.classList.add('hidden');
        }
      }
    }
  }
  
  // Best offer card
  renderOfferCard(state.bestOffer, elements.bestOfferCard, true);
  
  // Show/hide estimate notice
  if (state.inputMode === 'estimate') {
    show(elements.estimateNotice);
  } else {
    hide(elements.estimateNotice);
  }
  
  // Transition hero to collapsed state FIRST
  setHeroState('collapsed');
  
  // Show results wrapper (but keep list hidden)
  if (elements.resultsWrapper) {
    show(elements.resultsWrapper);
  }
  
  // Show results section
  show(elements.resultSection);
  
  // Hide offers list by default - user must click to expand
  if (elements.offersList) {
    elements.offersList.hidden = true;
  }
  
  // Update URL state
  updateURLState();
  
  // NO automatic scrolling - let the layout change handle positioning
}

/**
 * Renders a single offer card.
 * @param {Object} offer - Offer data
 * @param {HTMLElement} container - Container element
 * @param {boolean} isBest - Whether this is the best offer
 */
function renderOfferCard(offer, container, isBest = false) {
  // Use proposalCode for conditions lookup (offerCode is an alias)
  const offerCode = offer.proposalCode || offer.offerCode;
  const conditions = state.conditions.get(offerCode) || {};
  
  // Get enriched information
  const providerName = offer.providerName || offer.provider || offerCode?.split('_')[0] || 'N/A';
  const tariffName = offer.offerName || conditions.NomeProposta || 'Tarifa base';
  const phone = offer.phone || conditions.ContactoComercialTel || null;
  const website = offer.link || conditions.LinkOfertaCom || conditions.LinkCOM || null;
  
  container.innerHTML = `
    <article class="card offer-card ${isBest ? 'is-best' : ''}">
      <header class="offer-card-header">
        <span class="offer-provider">${providerName}</span>
        <span class="offer-name">${tariffName}</span>
      </header>
      
      <div class="offer-price">
        <span class="price-value">${formatCurrencyCompact(offer.total)}</span>
        <span class="price-period">/mês</span>
      </div>
      
      ${offer.savings > 0 ? `
        <p class="offer-savings">
          Poupas <strong>${formatCurrencyCompact(offer.savings)}/mês</strong> · <strong>${formatCurrencyCompact(offer.savings * 12)}/ano</strong>
        </p>
      ` : ''}
      
      ${phone ? `
        <p class="offer-contact">
          <strong>Telefone:</strong> <a href="tel:${phone.replace(/\s/g, '')}">${formatPhone(phone)}</a>
        </p>
      ` : ''}
      
      <details class="offer-details">
        <summary>Ver detalhes</summary>
        <dl class="offer-specs">
          <div class="spec">
            <dt>Termo fixo <button type="button" class="tooltip-trigger" data-tooltip="termo-fixo" aria-label="O que é o termo fixo?">ⓘ</button></dt>
            <dd>${formatCurrency(offer.invoice?.powerCost || 0, 2)}/mês</dd>
          </div>
          <div class="spec">
            <dt>Termo variável <button type="button" class="tooltip-trigger" data-tooltip="termo-variavel" aria-label="O que é o termo variável?">ⓘ</button></dt>
            <dd>${formatCurrency(offer.invoice?.energyCost || 0, 2)}/mês</dd>
          </div>
          <div class="spec">
            <dt>Fidelização</dt>
            <dd>${(conditions.FiltroFidelizacao === 'S' || conditions.FiltroFidelização === 'S') ? 'Sim' : 'Não tem'}</dd>
          </div>
          <div class="spec">
            <dt>Energia renovável</dt>
            <dd>${conditions.FiltroRenovavel === 'S' ? 'Sim' : 'Não'}</dd>
          </div>
        </dl>
      </details>
      
      <footer class="offer-card-footer cluster">
        <button type="button" class="button button-primary" data-action="show-guide" data-offer="${offer.proposalCode || offer.offerCode}">
          Ver como mudar
        </button>
        ${website ? `
          <a href="${website}" class="button button-ghost" target="_blank" rel="noopener">
            Ver oferta no site →
          </a>
        ` : ''}
      </footer>
    </article>
  `;
  
  // Initialize tooltips in the new card
  initTooltips();
}

/**
 * Renders the offers list setup.
 * List is hidden by default and shown only when user clicks "Ver mais ofertas"
 */
function renderOffersList() {
  if (!state.results.length || !elements.offersList) return;
  
  // Store all offers for later
  const allOffers = state.results.slice(1); // Skip best offer which is shown separately
  
  // Update "show more" button text with total count
  if (elements.showMoreBtn && allOffers.length > 0) {
    elements.showMoreBtn.textContent = `Ver mais ${allOffers.length} ofertas`;
    elements.showMoreBtn.hidden = false;
  } else if (elements.showMoreBtn) {
    elements.showMoreBtn.hidden = true;
  }
  
  // List is hidden by default - will be shown when user clicks button
  elements.offersList.hidden = true;
  elements.offersList.innerHTML = ''; // Clear existing content - will be populated when user clicks
}

/**
 * Renders the switch guide for a specific offer.
 * @param {string} offerCode - The offer code
 */
function renderSwitchGuide(offerCode) {
  // Find offer by proposalCode or offerCode
  const offer = state.results.find(o => (o.proposalCode === offerCode || o.offerCode === offerCode));
  if (!offer) return;
  
  const conditions = state.conditions.get(offerCode) || {};
  
  elements.guideProvider.textContent = offer.providerName;
  elements.guideTariff.textContent = offer.offerName || 'tarifa base';
  
  // Phone number
  const phone = conditions.ContactoComercialTel;
  if (phone) {
    elements.guidePhone.innerHTML = `<a href="tel:${phone.replace(/\s/g, '')}">${formatPhone(phone)}</a>`;
  } else {
    elements.guidePhone.textContent = 'Ver no site';
  }
  
  // Website
  const website = conditions.LinkCOM || conditions.LinkOfertaCom;
  if (website) {
    elements.guideWebsite.href = website;
    show(elements.guideWebsite);
  } else {
    hide(elements.guideWebsite);
  }
  
  // Show guide
  show(elements.switchGuide);
  // NO automatic scrolling - let layout handle positioning
}

/**
 * Renders empty state when no results found.
 */
function renderNoResults() {
  elements.bestOfferCard.innerHTML = `
    <div class="card stack text-center p-6">
      <p class="text-lg">Não encontrámos ofertas melhores.</p>
      <p class="text-secondary">
        Isto pode acontecer se já tens uma boa tarifa,
        o teu consumo é muito baixo, ou a potência é invulgar.
      </p>
      <button type="button" class="button button-secondary" data-action="refine">
        Tentar com valores diferentes
      </button>
    </div>
  `;
  
  show(elements.resultSection);
}

// ============================================================================
// Event Handlers
// ============================================================================

/**
 * Handles quick form submission.
 * @param {Event} event - Submit event
 */
async function handleQuickSubmit(event) {
  console.log('🔍 [DEBUG] ========== handleQuickSubmit CALLED ==========');
  
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  
  // Get input value directly from DOM as fallback
  const inputEl = document.getElementById('monthly-bill') || elements.monthlyBillInput;
  if (!inputEl) {
    console.error('❌ [DEBUG] Input element not found!');
    error('Erro: campo de input não encontrado');
    return;
  }
  
  const inputValue = inputEl.value?.trim();
  console.log('🔍 [DEBUG] Input value:', inputValue);
  
  // Check for non-numeric input
  if (!inputValue || inputValue === '' || isNaN(inputValue)) {
    console.error('❌ [DEBUG] Invalid input:', inputValue);
    error('Introduz um valor numérico válido');
    return;
  }
  
  const value = parseFloat(inputValue);
  console.log('🔍 [DEBUG] Parsed value:', value);
  
  // Check for valid range
  if (isNaN(value) || value < 10 || value > 1000) {
    console.error('❌ [DEBUG] Value out of range:', value);
    error('Introduz um valor entre €10 e €1000');
    return;
  }
  
  // Prevent double submission
  const submitBtnEl = document.getElementById('submit-btn') || elements.submitBtn;
  if (submitBtnEl?.disabled) {
    console.log('🔍 [DEBUG] Button already disabled, returning');
    return;
  }
  
  // Disable button immediately
  if (submitBtnEl) {
    submitBtnEl.disabled = true;
    submitBtnEl.textContent = 'A calcular...';
  }
  
  try {
    console.log('🔍 [DEBUG] Starting calculation process...');
    
    // Update state
    state.monthlyBill = value;
    state.inputMode = 'estimate';
    
    // Estimate consumption from bill
    console.log('🔍 [DEBUG] Estimating consumption from bill:', value);
    const estimate = estimateFromBill(value);
    console.log('🔍 [DEBUG] Estimate result:', estimate);
    
    state.monthlyBill = value;
    state.consumption = estimate.consumption;
    state.power = estimate.power;
    state.inputMode = 'estimate';
    
    // Ensure data is loaded
    console.log('🔍 [DEBUG] Checking if data is loaded...', state.dataLoaded);
    if (!state.dataLoaded) {
      console.log('🔍 [DEBUG] Loading data...');
      const loaded = await loadData();
      if (!loaded) {
        throw new Error('Failed to load data');
      }
      console.log('🔍 [DEBUG] Data loaded successfully');
    }
    
    // Only run comparison if we have valid data
    if (!state.dataLoaded || !state.consumption) {
      console.error('❌ [DEBUG] Invalid state after loading:', {
        dataLoaded: state.dataLoaded,
        consumption: state.consumption
      });
      error('Erro ao processar. Tenta novamente.');
      if (submitBtnEl) {
        submitBtnEl.disabled = false;
        submitBtnEl.textContent = 'Ver quanto perco';
      }
      return;
    }
    
    // Run comparison
    console.log('🔍 [DEBUG] Running comparison...');
    runComparison();
    
    // Render results
    console.log('🔍 [DEBUG] Rendering results...');
    renderResults();
    renderOffersList();
    console.log('🔍 [DEBUG] Results rendered');
    
  } catch (err) {
    console.error('❌ [DEBUG] Error in handleQuickSubmit:', err);
    console.error('❌ [DEBUG] Error stack:', err.stack);
    error('Erro ao processar. Tenta novamente.');
  } finally {
    // Reset button AFTER rendering (in case render fails)
    const submitBtnEl = document.getElementById('submit-btn') || elements.submitBtn;
    if (submitBtnEl) {
      submitBtnEl.disabled = false;
      submitBtnEl.textContent = 'Ver quanto perco';
    }
    console.log('🔍 [DEBUG] ========== handleQuickSubmit COMPLETE ==========');
  }
}

/**
 * Handles PDF file selection.
 * @param {Event} event - Change event
 */
async function handlePDFUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  
  if (!file.type.includes('pdf')) {
    error('Por favor seleciona um ficheiro PDF');
    return;
  }
  
  // Show loading
  if (elements.pdfTrigger) {
    elements.pdfTrigger.classList.add('is-loading');
  }
  
  try {
    const data = await extractFromPDF(file);
    
    if (!data.consumption) {
      throw new Error('Não conseguimos extrair os dados da fatura');
    }
    
    // Update state with extracted data
    state.consumption = data.consumption;
    state.power = data.power || DEFAULT_POWER;
    state.tariffType = data.tariffType || DEFAULT_TARIFF_TYPE;
    state.offPeakPercent = data.offPeakPercent || DEFAULT_VAZIO_PERCENT;
    state.currentProvider = data.provider;
    state.monthlyBill = data.monthlyBill || null;
    state.inputMode = 'precise';
    
    // Switch to PDF mode and display data
    setInputMode('pdf');
    
    // Update PDF card with file name and extracted data
    if (elements.pdfFileName) {
      elements.pdfFileName.textContent = file.name || 'Fatura carregada';
    }
    
    if (elements.pdfExtractedData) {
      const dataHTML = `
        <div><strong>Consumo:</strong> ${data.consumption} kWh</div>
        <div><strong>Potência:</strong> ${data.power || DEFAULT_POWER} kVA</div>
        ${data.monthlyBill ? `<div><strong>Valor fatura:</strong> €${data.monthlyBill.toFixed(2)}</div>` : ''}
        ${data.provider ? `<div><strong>Fornecedor:</strong> ${data.provider}</div>` : ''}
      `;
      elements.pdfExtractedData.innerHTML = dataHTML;
    }
    
    success('Fatura lida com sucesso');
    
    // Auto-submit if we have all required data
    if (state.consumption) {
      // Ensure data is loaded
      if (!state.dataLoaded) {
        await loadData();
      }
      
      // Run comparison
      runComparison();
      
      // Render
      renderResults();
      renderOffersList();
    }
    
  } catch (err) {
    error('Não conseguimos ler esta fatura. Tenta com o valor em €.');
    // Switch back to estimate mode on error
    setInputMode('estimate');
  } finally {
    if (elements.pdfTrigger) {
      elements.pdfTrigger.classList.remove('is-loading');
    }
    // Reset file input
    event.target.value = '';
  }
}

/**
 * Handles details form submission.
 * @param {Event} event - Submit event
 */
async function handleDetailsSubmit(event) {
  event.preventDefault();
  event.stopPropagation();
  
  // Get form values with proper validation
  const powerValue = elements.powerSelect?.value;
  const consumptionInputValue = elements.consumptionInput?.value?.trim();
  const checkedTariff = elements.tariffRadios?.find(r => r.checked);
  
  // Validate power
  if (!powerValue || isNaN(parseFloat(powerValue))) {
    error('Seleciona uma potência válida');
    return;
  }
  
  // Validate consumption
  if (!consumptionInputValue || consumptionInputValue === '') {
    error('Introduz o consumo mensal');
    return;
  }
  
  const consumptionValue = parseFloat(consumptionInputValue);
  if (isNaN(consumptionValue) || consumptionValue < 10 || consumptionValue > 5000) {
    error('Introduz um consumo válido entre 10 e 5000 kWh');
    return;
  }
  
  // Validate tariff type
  if (!checkedTariff) {
    error('Seleciona um tipo de tarifa');
    return;
  }
  
  // Update state - preserve monthlyBill for savings comparison
  state.power = parseFloat(powerValue);
  state.consumption = consumptionValue;
  state.tariffType = parseInt(checkedTariff.value, 10);
  
  // Validate and set off-peak percentage
  if (state.tariffType > 1) {
    const offPeakInputValue = elements.offPeakInput?.value?.trim();
    if (!offPeakInputValue || offPeakInputValue === '') {
      error('Introduz a percentagem de consumo em vazio');
      return;
    }
    const offPeakValue = parseFloat(offPeakInputValue);
    if (isNaN(offPeakValue) || offPeakValue < 0 || offPeakValue > 100) {
      error('A percentagem de vazio deve estar entre 0% e 100%');
      return;
    }
    state.offPeakPercent = offPeakValue / 100;
  } else {
    state.offPeakPercent = 0;
  }
  
  state.inputMode = 'manual';
  
  // Ensure data is loaded
  if (!state.dataLoaded) {
    await loadData();
  }
  
  // Only proceed if data is loaded and we have valid consumption
  if (!state.dataLoaded || !state.consumption) {
    error('Dados não carregados. Tenta novamente.');
    return;
  }
  
  // Run comparison - monthlyBill is preserved from initial estimate
  runComparison();
  
  // Render results
  renderResults();
  renderOffersList();
  
  // Switch back to estimate mode (collapsed)
  setInputMode('estimate');
}

/**
 * Handles refine form submission (legacy - keeping for backward compatibility).
 * @param {Event} event - Submit event
 */
async function handleRefineSubmit(event) {
  event.preventDefault();
  event.stopPropagation();
  
  // Get form values with proper validation
  const powerValue = elements.powerSelect?.value;
  const consumptionInputValue = elements.consumptionInput?.value?.trim();
  const checkedTariff = $$('[name="tariff"]:checked')[0];
  
  // Validate power
  if (!powerValue || isNaN(parseFloat(powerValue))) {
    error('Seleciona uma potência válida');
    return;
  }
  
  // Validate consumption
  if (!consumptionInputValue || consumptionInputValue === '') {
    error('Introduz o consumo mensal');
    return;
  }
  
  const consumptionValue = parseFloat(consumptionInputValue);
  if (isNaN(consumptionValue) || consumptionValue < 10 || consumptionValue > 5000) {
    error('Introduz um consumo válido entre 10 e 5000 kWh');
    return;
  }
  
  // Validate tariff type
  if (!checkedTariff) {
    error('Seleciona um tipo de tarifa');
    return;
  }
  
  // Update state - preserve monthlyBill for savings comparison
  state.power = parseFloat(powerValue);
  state.consumption = consumptionValue;
  state.tariffType = parseInt(checkedTariff.value, 10);
  
  // Validate and set off-peak percentage
  if (state.tariffType > 1) {
    const offPeakInputValue = elements.offPeakInput?.value?.trim();
    if (!offPeakInputValue || offPeakInputValue === '') {
      error('Introduz a percentagem de consumo em vazio');
      return;
    }
    const offPeakValue = parseFloat(offPeakInputValue);
    if (isNaN(offPeakValue) || offPeakValue < 0 || offPeakValue > 100) {
      error('A percentagem de vazio deve estar entre 0% e 100%');
      return;
    }
    state.offPeakPercent = offPeakValue / 100;
  } else {
    state.offPeakPercent = 0;
  }
  
  state.inputMode = 'manual';
  
  // Ensure data is loaded
  if (!state.dataLoaded) {
    await loadData();
  }
  
  // Only proceed if data is loaded and we have valid consumption
  if (!state.dataLoaded || !state.consumption) {
    error('Dados não carregados. Tenta novamente.');
    return;
  }
  
  // Run comparison - monthlyBill is preserved from initial estimate
  runComparison();
  
  // Render results
  renderResults();
  renderOffersList();
  
  // Hide refine section AFTER rendering
  if (elements.refineSection) {
    hide(elements.refineSection);
  }
}

/**
 * Handles tariff type change.
 */
function handleTariffChange() {
  const selectedValue = parseInt($$('[name="tariff"]:checked')[0]?.value || '1', 10);
  
  // Show/hide off-peak percentage field
  if (selectedValue > 1) {
    show(elements.offPeakField);
  } else {
    hide(elements.offPeakField);
  }
}

/**
 * Handles calendar reminder button.
 * TODO: Test calendar reminder functionality across different browsers/devices
 */
function handleCalendarReminder() {
  try {
    // Get current shareable URL
    const url = window.location.href;
    
    createReminder(2, url); // 2 months from now
    success('Lembrete adicionado ao calendário');
  } catch (err) {
    error('Não conseguimos criar o lembrete. Tenta novamente.');
  }
}


/**
 * Handles show more offers button - toggles visibility of offers list.
 */
function handleShowMore() {
  if (!state.results || !state.bestOffer || !elements.offersList || !elements.showMoreBtn) {
    return;
  }
  
  // Toggle visibility
  const isHidden = elements.offersList.hidden;
  
  if (isHidden) {
    // Show list - render all offers (excluding best which is shown separately)
    const allOffers = state.results.slice(1);
    
    elements.offersList.innerHTML = allOffers.map((offer, index) => `
      <li class="offer-row" data-offer="${offer.proposalCode || offer.offerCode}">
        <span class="offer-rank">${index + 2}</span>
        <span class="offer-row-provider">${offer.providerName || offer.provider} ${offer.offerName || offer.name || ''}</span>
        <span class="offer-row-price">${formatCurrencyCompact(offer.total)}/mês</span>
        <span class="offer-row-diff">+${formatCurrencyCompact(offer.total - state.bestOffer.total)}</span>
      </li>
    `).join('');
    
    elements.offersList.hidden = false;
    elements.showMoreBtn.textContent = 'Ver menos';
  } else {
    // Hide list
    elements.offersList.hidden = true;
    elements.showMoreBtn.textContent = `Ver mais ${state.results.length - 1} ofertas`;
  }
}

/**
 * Handles delegated clicks on the document.
 * @param {Event} event - Click event
 */
function handleDocumentClick(event) {
  const target = event.target;
  
  // Show guide action
  if (target.closest('[data-action="show-guide"]')) {
    event.preventDefault();
    event.stopPropagation();
    const button = target.closest('[data-action="show-guide"]');
    const offerCode = button?.dataset?.offer;
    if (offerCode) {
      renderSwitchGuide(offerCode);
    }
    return;
  }
  
  // Refine action - switch to details mode
  if (target.closest('[data-action="refine"]') || target.closest('#action-refine')) {
    event.preventDefault();
    event.stopPropagation();
    
    // Switch to details mode
    setInputMode('details');
    
    // Pre-fill with current values
    if (state.consumption && elements.consumptionInput) {
      elements.consumptionInput.value = state.consumption;
    }
    if (elements.powerSelect) {
      elements.powerSelect.value = state.power;
    }
    
    // Pre-fill tariff type
    if (elements.tariffRadios && elements.tariffRadios.length > 0) {
      elements.tariffRadios.forEach(radio => {
        if (parseInt(radio.value, 10) === state.tariffType) {
          radio.checked = true;
        }
      });
      // Trigger tariff change to show/hide off-peak field
      handleTariffChange();
    }
    
    // Pre-fill off-peak percentage
    if (state.tariffType > 1 && elements.offPeakInput && state.offPeakPercent) {
      elements.offPeakInput.value = Math.round(state.offPeakPercent * 100);
    }
    
    // Scroll to top to show input
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  
  // Back action
  if (target.closest('#action-back')) {
    event.preventDefault();
    event.stopPropagation();
    if (elements.switchGuide) {
      hide(elements.switchGuide);
    }
    if (elements.resultSection) {
      elements.resultSection.scrollIntoView({ behavior: 'smooth' });
    }
    return;
  }
  
  // Calendar action (delegated)
  if (target.closest('#action-calendar')) {
    event.preventDefault();
    event.stopPropagation();
    handleCalendarReminder();
    return;
  }
  
  // Show more offers (delegated)
  if (target.closest('#show-more-offers')) {
    event.preventDefault();
    event.stopPropagation();
    handleShowMore();
    return;
  }
  
  // Offer row click
  if (target.closest('.offer-row')) {
    event.preventDefault();
    event.stopPropagation();
    const row = target.closest('.offer-row');
    const offerCode = row?.dataset?.offer;
    if (offerCode) {
      renderSwitchGuide(offerCode);
    }
    return;
  }
}

// ============================================================================
// URL State Management
// ============================================================================

/**
 * Updates URL with current state.
 */
function updateURLState() {
  if (!state.bestOffer) return;
  
  const compactState = createComparisonState({
    power: state.power,
    consumption: state.consumption,
    tariffType: state.tariffType,
    offPeakPercent: state.offPeakPercent,
    bestPrice: state.bestOffer.total,
    currentPrice: state.monthlyBill
  });
  
  pushState(compactState);
}

/**
 * Restores state from URL if present.
 */
async function restoreFromURL() {
  const urlState = readState();
  if (!urlState) return false;
  
  const parsed = parseComparisonState(urlState);
  if (!parsed || !parsed.consumption) return false;
  
  // Check if state is stale
  if (isStateStale(urlState, 2)) {
    // State is stale - could show a notice here in future
  }
  
  // Restore state
  state.power = parsed.power || DEFAULT_POWER;
  state.consumption = parsed.consumption;
  state.tariffType = parsed.tariffType || DEFAULT_TARIFF_TYPE;
  state.offPeakPercent = parsed.offPeakPercent || DEFAULT_VAZIO_PERCENT;
  state.monthlyBill = parsed.currentPrice;
  state.inputMode = 'restored';
  
  // Load data and run comparison
  if (!state.dataLoaded) {
    await loadData();
  }
  
  // If we have data in URL, only pre-fill the input, DON'T show results
  // Results will only appear after user submits the form
  if (state.monthlyBill && elements.monthlyBillInput) {
    elements.monthlyBillInput.value = state.monthlyBill;
  }
  
  // Keep initial state - don't show results automatically
  setHeroState('initial');
  
  // Pre-load data in background but don't run comparison yet
  if (!state.dataLoaded) {
    await loadData();
  }
  
  return true;
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Sets up drag and drop for PDF upload.
 */
function setupDragAndDrop() {
  if (!elements.inputContainer) return;
  
  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    elements.inputContainer.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, false);
  });
  
  // Highlight drop zone
  ['dragenter', 'dragover'].forEach(eventName => {
    elements.inputContainer.addEventListener(eventName, () => {
      elements.inputContainer.classList.add('is-dragover');
    }, false);
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    elements.inputContainer.addEventListener(eventName, () => {
      elements.inputContainer.classList.remove('is-dragover');
    }, false);
  });
  
  // Handle dropped files
  elements.inputContainer.addEventListener('drop', (e) => {
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.includes('pdf')) {
        // Create a fake change event for the file input
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        if (elements.pdfInput) {
          elements.pdfInput.files = dataTransfer.files;
          const changeEvent = new Event('change', { bubbles: true });
          elements.pdfInput.dispatchEvent(changeEvent);
        }
      } else {
        error('Por favor arrasta um ficheiro PDF');
      }
    }
  }, false);
}

/**
 * Sets up event listeners.
 */
function setupEventListeners() {
  // Quick form - CRITICAL: must work
  const form = document.getElementById('quick-form');
  const submitBtn = document.getElementById('submit-btn');
  const input = document.getElementById('monthly-bill');
  
  console.log('🔍 [DEBUG] setupEventListeners - Direct element check:', {
    form: form ? 'FOUND' : 'NOT FOUND',
    submitBtn: submitBtn ? 'FOUND' : 'NOT FOUND',
    input: input ? 'FOUND' : 'NOT FOUND',
    elementsQuickForm: elements.quickForm ? 'FOUND' : 'NOT FOUND'
  });
  
  if (form) {
    console.log('🔍 [DEBUG] Adding submit listener to form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('🔍 [DEBUG] Form submit event fired');
      handleQuickSubmit(e);
    });
  } else {
    console.error('❌ [DEBUG] Form element not found by ID!');
  }
  
  // Also add click listener to button as primary handler
  if (submitBtn) {
    console.log('🔍 [DEBUG] Adding click listener to submit button');
    submitBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('🔍 [DEBUG] Submit button clicked - handler called');
      handleQuickSubmit(e);
    });
  } else {
    console.error('❌ [DEBUG] Submit button not found by ID!');
  }
  
  // Keep existing code for other elements
  if (elements.quickForm) {
    // Already handled above, but keep for compatibility
  }
  
  // PDF upload
  if (elements.pdfInput) {
    on(elements.pdfInput, 'change', handlePDFUpload);
  }
  
  if (elements.pdfTrigger) {
    on(elements.pdfTrigger, 'click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (elements.pdfInput) {
        elements.pdfInput.click();
      }
    });
  }
  
  // Details form (replaces refine form)
  if (elements.detailsForm) {
    on(elements.detailsForm, 'submit', handleDetailsSubmit);
  }
  
  // Settings trigger - switch to details mode
  if (elements.settingsTrigger) {
    on(elements.settingsTrigger, 'click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setInputMode('details');
    });
  }
  
  // Back to estimate button
  if (elements.backToEstimate) {
    on(elements.backToEstimate, 'click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setInputMode('estimate');
    });
  }
  
  // Remove PDF button
  if (elements.removePdf) {
    on(elements.removePdf, 'click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      setInputMode('estimate');
      // Clear PDF data
      if (elements.pdfInput) {
        elements.pdfInput.value = '';
      }
      if (elements.pdfExtractedData) {
        elements.pdfExtractedData.innerHTML = '';
      }
      if (elements.pdfFileName) {
        elements.pdfFileName.textContent = 'Fatura carregada';
      }
    });
  }
  
  // Click on collapsed input container to edit
  if (elements.inputContainer) {
    on(elements.inputContainer, 'click', (e) => {
      // Only handle if in collapsed state and clicking on container itself, not children
      if (elements.heroSection?.getAttribute('data-state') === 'collapsed' && 
          e.target === elements.inputContainer) {
        expandInputForEdit();
      }
    });
    
    // Keyboard support
    on(elements.inputContainer, 'keydown', (e) => {
      if (elements.heroSection?.getAttribute('data-state') === 'collapsed' &&
          (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        expandInputForEdit();
      }
    });
  }
  
  // Tariff type change (for details form)
  if (elements.tariffRadios && elements.tariffRadios.length > 0) {
    elements.tariffRadios.forEach(radio => {
      on(radio, 'change', handleTariffChange);
    });
  }
  
  // Action buttons are handled via event delegation in handleDocumentClick
  // No need for direct listeners here to avoid duplicates
  
  if (elements.guideWebsite) {
    // Website link should work normally, but ensure it's not prevented
    on(elements.guideWebsite, 'click', (e) => {
      // Allow normal link behavior
      if (!elements.guideWebsite.href || elements.guideWebsite.href === '#' || elements.guideWebsite.href === '') {
        e.preventDefault();
      }
    });
  }
  
  // Delegated clicks
  on(document, 'click', handleDocumentClick);
}

/**
 * Initializes the application.
 */
async function init() {
  console.log('🔍 [DEBUG] ========== INIT STARTING ==========');
  
  try {
    // Cache DOM elements
    cacheElements();
    
    // Verify critical elements exist - check both cached and direct
    const formDirect = document.getElementById('quick-form');
    const inputDirect = document.getElementById('monthly-bill');
    const btnDirect = document.getElementById('submit-btn');
    
    console.log('🔍 [DEBUG] Checking critical elements...');
    console.log('  - quickForm (cached):', elements.quickForm ? 'found' : 'NOT FOUND');
    console.log('  - quickForm (direct):', formDirect ? 'found' : 'NOT FOUND');
    console.log('  - monthlyBillInput (cached):', elements.monthlyBillInput ? 'found' : 'NOT FOUND');
    console.log('  - monthlyBillInput (direct):', inputDirect ? 'found' : 'NOT FOUND');
    console.log('  - submitBtn (cached):', elements.submitBtn ? 'found' : 'NOT FOUND');
    console.log('  - submitBtn (direct):', btnDirect ? 'found' : 'NOT FOUND');
    
    if (!formDirect && !elements.quickForm) {
      console.error('❌ [DEBUG] Form element not found by any method!');
      error('Erro ao inicializar a aplicação. Por favor, recarrega a página.');
      return;
    }
    
    // Setup event listeners
    console.log('🔍 [DEBUG] Setting up event listeners...');
    setupEventListeners();
    console.log('🔍 [DEBUG] Event listeners set up complete');
    
    // Test: verify button is clickable
    const testBtn = document.getElementById('submit-btn');
    if (testBtn) {
      console.log('🔍 [DEBUG] Test: Button element found, adding test click handler');
      testBtn.addEventListener('click', () => {
        console.log('🔍 [DEBUG] TEST: Button click detected!');
      }, { once: true });
    } else {
      console.error('❌ [DEBUG] TEST: Button not found for test!');
    }
    
    // Initialize tooltips
    initTooltips();
    
    // Initialize hero state to initial
    setHeroState('initial');
    setInputMode('estimate');
    
    // Ensure results are hidden on init (in case of page refresh with URL state)
    if (elements.resultsWrapper) {
      hide(elements.resultsWrapper);
    }
    if (elements.resultSection) {
      hide(elements.resultSection);
    }
    if (elements.offersList) {
      elements.offersList.hidden = true;
    }
    
    // Check for PDF.js availability
    if (!isPDFExtractionAvailable()) {
      if (elements.pdfTrigger) {
        hide(elements.pdfTrigger);
      }
    }
    
    // Add drag and drop support for PDF
    setupDragAndDrop();
    
    // Try to restore from URL
    const restored = await restoreFromURL();
    
    // Pre-load data in background if not restored
    if (!restored && !state.dataLoaded) {
      loadData();
    }
    
    // Don't run comparison on init if we didn't restore from URL
    // User needs to submit form first
  } catch (err) {
    console.error('Error in init:', err);
    error('Erro ao inicializar a aplicação. Por favor, recarrega a página.');
  }
}

// ============================================================================
// Bootstrap
// ============================================================================

// Bootstrap - ensure it runs
ready(init);

// Fallback: also try direct initialization if ready didn't fire
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  // DOM already loaded, run init
  setTimeout(init, 0);
}

// Export for debugging
if (typeof window !== 'undefined') {
  window.GuessWatt = {
    state,
    runComparison,
    loadData
  };
}

