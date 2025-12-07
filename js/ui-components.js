/**
 * UI Components Module
 * Tooltip, tabs, and dropdown UI component logic
 */

import { PROVIDERS } from './config.js';

// Tooltip content definitions
const tooltipContent = {
  'kwh': 'Unidade de energia. 1 kWh = um aparelho de 1000W ligado durante 1 hora.',
  'kva': 'A potência máxima que podes usar ao mesmo tempo. Se ligares muitos aparelhos, o quadro dispara.',
  'tarifa-simples': 'Preço único a qualquer hora do dia.',
  'tarifa-bihoraria': 'Dois preços: mais barato à noite (22h-8h), mais caro de dia.',
  'tarifa-trihoraria': 'Três preços: vazio (noite), cheias (dia), ponta (mais caro, horas de pico).',
  'cpe': 'Código de Ponto de Entrega. Identifica o teu contador. Está na factura, normalmente no canto superior.',
  'consumo-mensal': 'Quantidade de energia que gastas por mês, medida em kWh.',
  'termo-fixo': 'Valor que pagas por dia, independentemente do consumo.',
  'termo-variavel': 'Preço por cada kWh que consomes.',
  'potencia-contratada': 'A "largura do cano" da tua instalação. Mais potência = mais aparelhos em simultâneo.'
};

// Tooltip state
let tooltipEl = null;
let activeTrigger = null;
let tooltipTimeout = null;
let tooltipsInitialized = false;

/**
 * Create tooltip element if it doesn't exist
 * @returns {HTMLElement} Tooltip element
 */
function createTooltip() {
  if (tooltipEl) return tooltipEl;
  
  tooltipEl = document.createElement('div');
  tooltipEl.className = 'tooltip';
  tooltipEl.setAttribute('role', 'tooltip');
  tooltipEl.hidden = true;
  document.body.appendChild(tooltipEl);
  return tooltipEl;
}

/**
 * Show tooltip for a trigger element
 * @param {HTMLElement} trigger - Element that triggered the tooltip
 */
function showTooltip(trigger) {
  const key = trigger.dataset.tooltip;
  const content = tooltipContent[key];
  
  if (!content) return;
  
  createTooltip();
  tooltipEl.textContent = content;
  tooltipEl.hidden = false;
  
  // Position tooltip
  const rect = trigger.getBoundingClientRect();
  const tooltipRect = tooltipEl.getBoundingClientRect();
  const padding = 8;
  
  let top = rect.top - tooltipRect.height - padding;
  let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
  
  // If would overflow top, position below
  if (top < padding) {
    top = rect.bottom + padding;
  }
  
  // Constrain horizontally
  const maxLeft = window.innerWidth - tooltipRect.width - padding;
  left = Math.max(padding, Math.min(left, maxLeft));
  
  tooltipEl.style.top = `${top + window.scrollY}px`;
  tooltipEl.style.left = `${left}px`;
  tooltipEl.classList.add('is-visible');
  
  activeTrigger = trigger;
}

/**
 * Hide tooltip
 */
function hideTooltip() {
  if (tooltipEl) {
    tooltipEl.classList.remove('is-visible');
    tooltipEl.hidden = true;
  }
  activeTrigger = null;
  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout);
    tooltipTimeout = null;
  }
}

/**
 * Initialize tooltip event listeners
 */
export function initTooltips() {
  createTooltip();
  
  // Evitar múltiplos event listeners
  if (tooltipsInitialized) return;
  tooltipsInitialized = true;
  
  // Handle hover (desktop)
  document.addEventListener('mouseover', (e) => {
    const trigger = e.target.closest('.tooltip-trigger');
    if (trigger && trigger.dataset.tooltip) {
      clearTimeout(tooltipTimeout);
      tooltipTimeout = setTimeout(() => showTooltip(trigger), 300);
    } else if (!e.target.closest('.tooltip')) {
      hideTooltip();
    }
  });
  
  document.addEventListener('mouseout', (e) => {
    if (!e.target.closest('.tooltip-trigger')) {
      hideTooltip();
    }
  });
  
  // Handle click (mobile)
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.tooltip-trigger');
    if (trigger && trigger.dataset.tooltip) {
      e.preventDefault();
      if (activeTrigger === trigger) {
        hideTooltip();
      } else {
        showTooltip(trigger);
      }
    } else if (!e.target.closest('.tooltip')) {
      hideTooltip();
    }
  });
  
  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideTooltip();
    }
  });
}

/**
 * Initialize tabs functionality
 * @param {Function} setCurrentMode - Function to set current mode
 * @param {Function} getTabResult - Function to get tab result
 */
export function initTabs(setCurrentMode, getTabResult) {
  const tabs = document.querySelectorAll('.tab');
  const forms = document.querySelectorAll('.mode-form');
  const resultDiv = document.getElementById('result');
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
  
  // Initialize indicator position on load
  if (tabEstimado && tabsIndicator) {
    requestAnimationFrame(() => {
      moveIndicator(tabEstimado);
    });
  }
  
  // Get input-slot element for preciso-mode class toggle
  const inputSlot = document.getElementById('input-slot');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const mode = tab.dataset.mode;
      setCurrentMode(mode);
      
      // Update tab active state
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      
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
      
      // Mostrar/esconder resultado da tab atual
      const cachedResult = getTabResult(mode);
      if (resultDiv) {
        if (cachedResult) {
          resultDiv.innerHTML = cachedResult;
          resultDiv.style.display = 'block';
        } else {
          resultDiv.innerHTML = '';
          resultDiv.style.display = 'none';
        }
      }
    });
  });
}

/**
 * Populate providers dropdown
 */
export function populateProvidersDropdown() {
  const providerSelect = document.getElementById('current-provider');
  if (!providerSelect) return;
  
  Object.entries(PROVIDERS).forEach(([code, name]) => {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = name;
    providerSelect.appendChild(option);
  });
}

