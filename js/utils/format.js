/**
 * GuessWatt - Formatting Utilities
 * 
 * Number and currency formatting for Portuguese locale.
 */

/**
 * Format number as currency (€).
 * 
 * @param {number} value - Value to format
 * @param {number} decimals - Decimal places (default: 2)
 * @returns {string} Formatted currency string
 * 
 * @example
 * formatCurrency(95.50) // "95,50 €"
 * formatCurrency(288) // "288,00 €"
 */
export function formatCurrency(value, decimals = 2) {
  if (value === null || value === undefined || isNaN(value)) {
    return '—';
  }
  
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format number as compact currency (no decimals for whole numbers).
 * 
 * @param {number} value - Value to format
 * @returns {string} Formatted string
 * 
 * @example
 * formatCurrencyCompact(95) // "€95"
 * formatCurrencyCompact(95.50) // "€95,50"
 */
export function formatCurrencyCompact(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return '—';
  }
  
  const hasDecimals = value % 1 !== 0;
  return `€${value.toLocaleString('pt-PT', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format number with Portuguese locale.
 * 
 * @param {number} value - Value to format
 * @param {number} decimals - Decimal places
 * @returns {string} Formatted number
 * 
 * @example
 * formatNumber(1234.56, 2) // "1 234,56"
 */
export function formatNumber(value, decimals = 0) {
  if (value === null || value === undefined || isNaN(value)) {
    return '—';
  }
  
  return value.toLocaleString('pt-PT', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format consumption in kWh.
 * 
 * @param {number} value - kWh value
 * @returns {string} Formatted string
 * 
 * @example
 * formatConsumption(350) // "350 kWh"
 */
export function formatConsumption(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return '—';
  }
  
  return `${Math.round(value)} kWh`;
}

/**
 * Format power in kVA.
 * 
 * @param {number} value - kVA value
 * @returns {string} Formatted string
 * 
 * @example
 * formatPower(4.6) // "4,6 kVA"
 */
export function formatPower(value) {
  if (value === null || value === undefined || isNaN(value)) {
    return '—';
  }
  
  return `${value.toLocaleString('pt-PT', { minimumFractionDigits: 1 })} kVA`;
}

/**
 * Format rate (€/kWh or €/day).
 * 
 * @param {number} value - Rate value
 * @param {string} unit - Unit to append
 * @returns {string} Formatted string
 * 
 * @example
 * formatRate(0.1658, '€/kWh') // "0,1658 €/kWh"
 */
export function formatRate(value, unit = '€/kWh') {
  if (value === null || value === undefined || isNaN(value)) {
    return '—';
  }
  
  return `${value.toLocaleString('pt-PT', { 
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  })} ${unit}`;
}

/**
 * Format percentage.
 * 
 * @param {number} value - Percentage (0-100 or 0-1)
 * @param {boolean} fromDecimal - If true, multiply by 100
 * @returns {string} Formatted percentage
 * 
 * @example
 * formatPercent(35) // "35%"
 * formatPercent(0.35, true) // "35%"
 */
export function formatPercent(value, fromDecimal = false) {
  if (value === null || value === undefined || isNaN(value)) {
    return '—';
  }
  
  const percent = fromDecimal ? value * 100 : value;
  return `${Math.round(percent)}%`;
}

/**
 * Format savings with period.
 * 
 * @param {number} monthly - Monthly savings
 * @returns {string} Formatted string
 * 
 * @example
 * formatSavings(24) // "€24/mês · €288/ano"
 */
export function formatSavings(monthly) {
  if (monthly === null || monthly === undefined || isNaN(monthly)) {
    return '—';
  }
  
  const yearly = monthly * 12;
  return `€${Math.round(monthly)}/mês · €${Math.round(yearly)}/ano`;
}

/**
 * Format phone number for display.
 * Adds spaces for readability.
 * 
 * @param {string} phone - Raw phone number
 * @returns {string} Formatted phone
 * 
 * @example
 * formatPhone('800100100') // "800 100 100"
 * formatPhone('210123456') // "210 123 456"
 */
export function formatPhone(phone) {
  if (!phone || phone === 'NA') return null;
  
  // Remove non-digits
  const digits = phone.replace(/\D/g, '');
  
  // Format based on length
  if (digits.length === 9) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  
  return phone;
}

/**
 * Format tariff type name.
 * 
 * @param {number} type - Tariff type (1, 2, or 3)
 * @returns {string} Human-readable name
 */
export function formatTariffType(type) {
  const names = {
    1: 'Simples',
    2: 'Bi-horária',
    3: 'Tri-horária',
  };
  return names[type] || 'Desconhecido';
}
