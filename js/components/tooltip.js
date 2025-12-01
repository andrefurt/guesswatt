/**
 * Tooltip Component
 * Accessible tooltips for technical terms
 * 
 * @module components/tooltip
 */

/** Singleton tooltip element */
let tooltipEl = null;

/** Currently active trigger */
let activeTrigger = null;

/** Hover delay timeout */
let hoverTimeout = null;

/** Tooltip content definitions */
const tooltipContent = {
  'termo-fixo': {
    title: 'Termo fixo',
    content: 'O termo fixo é o valor que pagas por dia, independentemente do consumo. Inclui custos de rede e taxas.'
  },
  'termo-variavel': {
    title: 'Termo variável',
    content: 'O termo variável é o preço por cada kWh consumido. Quanto mais gastas, mais pagas desta componente.'
  },
  'kwh': {
    title: 'kWh (quilowatt-hora)',
    content: 'Unidade de energia consumida. 1 kWh = ter um aparelho de 1000W ligado durante 1 hora. Uma máquina de lavar gasta ~1.5 kWh por ciclo.'
  },
  'potencia': {
    title: 'Potência contratada',
    content: 'A potência define quanta energia podes usar ao mesmo tempo. Se for baixa e ligares muitos aparelhos, o quadro dispara. 4.6 kVA é o valor mais comum.'
  },
  'consumo': {
    title: 'Consumo mensal',
    content: 'É a quantidade de energia que gastas por mês. Encontras este valor na tua fatura, em kWh. Uma casa média consome 200-300 kWh/mês.'
  },
  'cpe': {
    title: 'CPE (Código de Ponto de Entrega)',
    content: 'Código único que identifica o teu contador. Formato: PT0002000012345678XX. Encontras na fatura, normalmente no canto superior direito.'
  },
  'fidelizacao': {
    title: 'Fidelização',
    content: 'Período mínimo de permanência num contrato. Se saíres antes, podes ter de pagar penalização. Muitas ofertas no mercado livre não têm fidelização.'
  },
  'vazio': {
    title: 'Horário de vazio',
    content: 'Período com energia mais barata (normalmente 22h-08h e fins-de-semana). Ideal para máquinas de lavar, carregamento de carros elétricos, etc.'
  },
  'fora-vazio': {
    title: 'Fora de vazio',
    content: 'Período com energia mais cara (normalmente 08h-22h em dias úteis). Corresponde às horas de maior consumo.'
  },
  'iva': {
    title: 'IVA',
    content: 'Imposto sobre o Valor Acrescentado. A eletricidade tem IVA de 23%, exceto na potência até 3.45 kVA que tem taxa reduzida de 6%.'
  }
};

/**
 * Creates tooltip element (singleton)
 */
function createTooltip() {
  if (tooltipEl) return;
  
  tooltipEl = document.createElement('div');
  tooltipEl.className = 'tooltip';
  tooltipEl.setAttribute('role', 'tooltip');
  tooltipEl.hidden = true;
  document.body.appendChild(tooltipEl);
}

/**
 * Positions tooltip relative to trigger element
 * @param {HTMLElement} trigger - The trigger element
 */
function positionTooltip(trigger) {
  if (!tooltipEl || !trigger) return;
  
  const rect = trigger.getBoundingClientRect();
  const tooltipRect = tooltipEl.getBoundingClientRect();
  const padding = 8;
  
  // Default: position above trigger
  let top = rect.top - tooltipRect.height - padding;
  let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
  
  // If would overflow top, position below
  if (top < padding) {
    top = rect.bottom + padding;
    tooltipEl.classList.add('tooltip-below');
  } else {
    tooltipEl.classList.remove('tooltip-below');
  }
  
  // Constrain horizontally to viewport
  const maxLeft = window.innerWidth - tooltipRect.width - padding;
  left = Math.max(padding, Math.min(left, maxLeft));
  
  tooltipEl.style.top = `${top + window.scrollY}px`;
  tooltipEl.style.left = `${left}px`;
}

/**
 * Shows tooltip for a trigger element
 * @param {HTMLElement} trigger - The trigger element
 * @param {string} [contentKey] - Key to look up content (defaults to data-tooltip)
 */
function showTooltip(trigger, contentKey) {
  createTooltip();
  
  const key = contentKey || trigger.dataset.tooltip;
  const data = tooltipContent[key];
  
  if (!data) {
    // Tooltip content not found - silently fail
    return;
  }
  
  // Set content
  tooltipEl.innerHTML = `
    <p><strong>${data.title}</strong></p>
    <p>${data.content}</p>
  `;
  
  // Connect to trigger for accessibility
  const tooltipId = `tooltip-${key}`;
  tooltipEl.id = tooltipId;
  trigger.setAttribute('aria-describedby', tooltipId);
  
  // Show and position
  tooltipEl.hidden = false;
  tooltipEl.classList.add('is-visible');
  
  // Position after content is rendered
  requestAnimationFrame(() => {
    positionTooltip(trigger);
  });
  
  activeTrigger = trigger;
}

/**
 * Hides the tooltip
 */
function hideTooltip() {
  if (!tooltipEl) return;
  
  tooltipEl.classList.remove('is-visible');
  tooltipEl.hidden = true;
  
  if (activeTrigger) {
    activeTrigger.removeAttribute('aria-describedby');
    activeTrigger = null;
  }
}

/**
 * Initializes tooltip functionality for all triggers.
 * Call this after DOM is ready or after adding new triggers.
 * 
 * @param {string} [selector='.tooltip-trigger'] - CSS selector for trigger elements
 * 
 * @example
 * // Initialize with default selector
 * initTooltips();
 * 
 * // Or with custom selector
 * initTooltips('[data-tooltip]');
 */
export function initTooltips(selector = '.tooltip-trigger') {
  createTooltip();
  
  const triggers = document.querySelectorAll(selector);
  
  triggers.forEach(trigger => {
    // Skip if already initialized
    if (trigger.dataset.tooltipInit) return;
    trigger.dataset.tooltipInit = 'true';
    
    // Mouse events with delay
    trigger.addEventListener('mouseenter', () => {
      clearTimeout(hoverTimeout);
      hoverTimeout = setTimeout(() => {
        showTooltip(trigger);
      }, 200); // 200ms delay on hover
    });
    
    trigger.addEventListener('mouseleave', () => {
      clearTimeout(hoverTimeout);
      hideTooltip();
    });
    
    // Focus events (immediate, no delay)
    trigger.addEventListener('focus', () => {
      clearTimeout(hoverTimeout);
      showTooltip(trigger);
    });
    
    trigger.addEventListener('blur', () => {
      hideTooltip();
    });
    
    // Touch events (toggle)
    trigger.addEventListener('touchstart', (event) => {
      event.preventDefault();
      if (activeTrigger === trigger) {
        hideTooltip();
      } else {
        showTooltip(trigger);
      }
    });
  });
  
  // Global escape key handler
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && activeTrigger) {
      hideTooltip();
    }
  });
  
  // Close tooltip when clicking outside
  document.addEventListener('click', (event) => {
    if (activeTrigger && !event.target.closest('.tooltip-trigger') && !event.target.closest('.tooltip')) {
      hideTooltip();
    }
  });
}

/**
 * Registers custom tooltip content.
 * 
 * @param {string} key - Unique key for the tooltip
 * @param {Object} data - Tooltip data
 * @param {string} data.title - Tooltip title
 * @param {string} data.content - Tooltip content
 * 
 * @example
 * registerTooltip('custom-term', {
 *   title: 'Termo personalizado',
 *   content: 'Explicação do termo...'
 * });
 */
export function registerTooltip(key, { title, content }) {
  tooltipContent[key] = { title, content };
}

/**
 * Programmatically shows a tooltip.
 * 
 * @param {HTMLElement} trigger - The trigger element
 * @param {string} [key] - Content key (defaults to trigger's data-tooltip)
 */
export function show(trigger, key) {
  showTooltip(trigger, key);
}

/**
 * Programmatically hides the active tooltip.
 */
export function hide() {
  hideTooltip();
}

export default { initTooltips, registerTooltip, show, hide };
