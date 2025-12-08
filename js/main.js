/**
 * Main Entry Point
 * State management, form handlers, and initialization
 */

import { DEFAULT_POWER, PROVIDERS } from './config.js';
import { loadOffers, toTitleCase } from './utils.js';
import { 
  estimateConsumption, 
  calculateMonthlyCost, 
  findBestOffer, 
  findBestOfferForTariff, 
  enrichOffer 
} from './calculator.js';
import { 
  initPDFUpload, 
  calculateFromPDF
} from './pdf-service.js';
import { initTooltips, initTabs, populateProvidersDropdown } from './ui-components.js';
import { renderResult } from './ui-renderer.js';
import { initUIHandlers, showResults, hideResults, setEstimadoData, setInvoiceData } from './ui-handlers.js';

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

// Application state
const state = {
  // Tab results cache
  tabResults: {
    estimate: null,
    precise: null
  },
  
  // Current active mode
  currentMode: 'estimate',
  
  // Manual form visibility
  manualFormVisible: false
};

/**
 * Get current mode
 * @returns {string} Current mode ('estimate' or 'precise')
 */
function getCurrentMode() {
  return state.currentMode;
}

/**
 * Set current mode
 * @param {string} mode - Mode to set ('estimate' or 'precise')
 */
function setCurrentMode(mode) {
  state.currentMode = mode;
}

/**
 * Get tab result for a mode
 * @param {string} mode - Mode to get result for
 * @returns {string|null} Cached HTML result or null
 */
function getTabResult(mode) {
  return state.tabResults[mode] || null;
}

/**
 * Set tab result for a mode
 * @param {string} mode - Mode to set result for
 * @param {string} html - HTML result string
 */
function setTabResult(mode, html) {
  state.tabResults[mode] = html;
}

/**
 * Clear tab result for a mode
 * @param {string} mode - Mode to clear result for
 */
function clearTabResult(mode) {
  state.tabResults[mode] = null;
}

/**
 * Get manual form visibility
 * @returns {boolean} Whether manual form is visible
 */
function getManualFormVisible() {
  return state.manualFormVisible;
}

/**
 * Set manual form visibility
 * @param {boolean} visible - Whether manual form should be visible
 */
function setManualFormVisible(visible) {
  state.manualFormVisible = visible;
}

// =============================================================================
// FORM HANDLERS
// =============================================================================

/**
 * Handler for estimate form submission
 * @param {Event} e - Form submit event
 */
async function handleEstimateSubmit(e) {
  e.preventDefault();
  
  const monthlyBill = parseFloat(document.getElementById('monthly-bill').value);
  const resultDiv = document.getElementById('result');
  
  if (!resultDiv) return;
  
  resultDiv.innerHTML = '<p>A calcular...</p>';
  
  // Set estimado mode data for input pill
  setEstimadoData(monthlyBill);
  
  try {
    // 1. Carregar dados (prefers offers.json, falls back to CSV)
    const { prices, conditions, offers } = await loadOffers();
    
    // 2. Estimar consumo (data-driven if offers available)
    const consumption = estimateConsumption(monthlyBill, offers);
    
    // 3. Use offers.json if available (already filtered to ELE-only at build time)
    // Otherwise filter CSV data to ELE-only
    let offersToSearch;
    if (offers && offers.length > 0) {
      // offers.json already contains ELE-only offers with all metadata
      offersToSearch = offers;
    } else {
      // CSV fallback: filter to ELE-only
      const electricityOnly = prices.filter(p => {
        const condition = conditions.find(c => 
          c.COM === p.COM && c.COD_Proposta === p.COD_Proposta
        );
        if (condition && condition.Fornecimento) {
          return condition.Fornecimento === 'ELE';
        }
        // If no condition data, assume electricity (backward compatibility)
        return true;
      });
      // Convert to offer-like format for compatibility
      offersToSearch = electricityOnly.map(p => ({
        ...p,
        tariffName: '',
        website: '',
        phone: '',
        fornecimento: '',
        segmento: '',
        validFrom: '',
        validTo: '',
        isIndexed: false,
        hasLockIn: false,
        promotion: null,
        isCampaignActive: null
      }));
    }
    
    // 4. Encontrar melhor oferta (filters lock-in, uses annual effective cost)
    const best = findBestOffer(offersToSearch, consumption, DEFAULT_POWER);
    
    // 5. Enriquecer com nome da tarifa e metadata (if not already enriched)
    const enrichedBest = offers ? best : enrichOffer(best, conditions);
    
    // 6. Renderizar resultado (usa monthlyBill para calcular poupança)
    renderResult(enrichedBest, consumption, DEFAULT_POWER, monthlyBill, null, true, getCurrentMode(), setTabResult);
    
  } catch (error) {
    resultDiv.innerHTML = `<p class="error">Erro: ${error.message}</p>`;
    console.error(error);
  }
}

/**
 * Handler for precise form submission
 * @param {Event} e - Form submit event
 */
async function handlePreciseSubmit(e) {
  e.preventDefault();
  
  const consumption = parseFloat(document.getElementById('consumption').value);
  const power = parseFloat(document.getElementById('power').value);
  const tariffType = parseInt(document.getElementById('tariff-type').value);
  const currentProvider = document.getElementById('current-provider').value;
  
  const resultDiv = document.getElementById('result');
  
  if (!resultDiv) return;
  
  resultDiv.innerHTML = '<p>A calcular...</p>';
  
  // Get tariff name for pill
  const tariffNames = { 1: 'Simples', 2: 'Bi-horária', 3: 'Tri-horária' };
  const tariffName = toTitleCase(tariffNames[tariffType] || 'Simples');
  
  // Get provider name for pill
  const providerNameRaw = currentProvider ? (PROVIDERS[currentProvider] || currentProvider) : 'Manual';
  const providerName = toTitleCase(providerNameRaw);
  
  // Set invoice data for input pill (manual entry)
  setInvoiceData({
    provider: providerName,
    tariff: tariffName,
    consumption: consumption,
    power: power
  }, false); // fromPDF = false (manual entry)
  
  try {
    // 1. Validar inputs
    if (!consumption || consumption <= 0) {
      throw new Error('Introduz um consumo válido');
    }
    
    // 2. Carregar dados (prefers offers.json, falls back to CSV)
    const { prices, conditions, offers } = await loadOffers();
    
    // 3. Use offers.json if available (already filtered to ELE-only at build time)
    // Otherwise filter CSV data to ELE-only
    let offersToSearch;
    if (offers && offers.length > 0) {
      // offers.json already contains ELE-only offers with all metadata
      offersToSearch = offers;
    } else {
      // CSV fallback: filter to ELE-only
      const electricityOnly = prices.filter(p => {
        const condition = conditions.find(c => 
          c.COM === p.COM && c.COD_Proposta === p.COD_Proposta
        );
        if (condition && condition.Fornecimento) {
          return condition.Fornecimento === 'ELE';
        }
        // If no condition data, assume electricity (backward compatibility)
        return true;
      });
      // Convert to offer-like format for compatibility
      offersToSearch = electricityOnly.map(p => ({
        ...p,
        tariffName: '',
        website: '',
        phone: '',
        fornecimento: '',
        segmento: '',
        validFrom: '',
        validTo: '',
        isIndexed: false,
        hasLockIn: false,
        promotion: null,
        isCampaignActive: null
      }));
    }
    
    // 4. Encontrar melhor oferta (filters lock-in, uses annual effective cost)
    const best = findBestOfferForTariff(offersToSearch, consumption, power, tariffType);
    
    // 5. Enriquecer com nome da tarifa e metadata (if not already enriched)
    const enrichedBest = offers ? best : enrichOffer(best, conditions);
    
    // 6. Calcular poupança se houver operador actual
    let savings = null;
    if (currentProvider) {
      // Normalize power for comparison (use same tolerance as findBestOfferForTariff)
      const normalizedPower = typeof power === 'number' ? power : parseFloat(String(power).replace(',', '.'));
      const normalizedTariffType = typeof tariffType === 'number' ? tariffType : parseInt(tariffType);
      
      // Encontrar ofertas do operador actual com mesma potência e tarifa
      const currentProviderOffers = offersToSearch.filter(o => {
        const tvField = o['TV|TVFV|TVP'] || o.TV || 0;
        const potCont = typeof o.Pot_Cont === 'number' ? o.Pot_Cont : parseFloat(String(o.Pot_Cont || '').replace(',', '.'));
        const contagem = typeof o.Contagem === 'number' ? o.Contagem : parseInt(o.Contagem);
        
        // Use tolerance for floating point comparison (0.01 kVA tolerance - same as findBestOfferForTariff)
        const powerMatch = Math.abs(potCont - normalizedPower) < 0.01;
        
        return o.COM === currentProvider && 
               o.TF > 0 &&
               tvField > 0 &&
               powerMatch &&
               contagem === normalizedTariffType;
      });
      
      if (currentProviderOffers.length > 0) {
        // Calcular custo com a melhor oferta do operador actual
        const currentProviderCosts = currentProviderOffers.map(offer => ({
          ...offer,
          monthlyCost: calculateMonthlyCost(offer, consumption, power)
        }));
        
        // Ordenar por custo e pegar a mais barata
        currentProviderCosts.sort((a, b) => a.monthlyCost - b.monthlyCost);
        const bestCurrentOffer = currentProviderCosts[0];
        
        const currentProviderCost = bestCurrentOffer.monthlyCost;
        const monthlySavings = currentProviderCost - enrichedBest.monthlyCost;
        
        if (monthlySavings > 0) {
          savings = {
            monthly: monthlySavings,
            yearly: monthlySavings * 12,
            vsProvider: toTitleCase(PROVIDERS[currentProvider] || currentProvider)
          };
        }
      }
    }
    
    // 6. Renderizar resultado (isEstimate: false para modo Preciso)
    renderResult(enrichedBest, consumption, power, null, savings, false, getCurrentMode(), setTabResult);
    
  } catch (error) {
    resultDiv.innerHTML = `<p class="error">Erro: ${error.message}</p>`;
    console.error(error);
  }
}

// =============================================================================
// PDF CALCULATION WRAPPER
// =============================================================================

/**
 * Wrapper for calculateFromPDF that provides current mode
 * @returns {Promise<void>}
 */
async function calculateFromPDFWrapper() {
  return calculateFromPDF(renderResult, getCurrentMode(), setTabResult);
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize application
 */
function init() {
  // Inicializar UI handlers (copy, dropdown, delete button)
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
  initTabs(setCurrentMode, getTabResult);
  
  // Inicializar PDF upload (pass calculateFromPDFWrapper as callback for auto-calculation)
  initPDFUpload(clearTabResult, setManualFormVisible, getManualFormVisible, calculateFromPDFWrapper);
  
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
      
      setManualFormVisible(true);
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
      
      setManualFormVisible(false);
    });
  }
  
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

// Setup quando DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  // DOM já está pronto
  init();
}
