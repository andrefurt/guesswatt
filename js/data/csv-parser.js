/**
 * GuessWatt - CSV Parser
 * 
 * Parses ERSE CSV files with Portuguese formatting:
 * - Semicolon delimiter
 * - Comma as decimal separator
 * - UTF-8 with BOM
 */

/**
 * Parse a Portuguese-formatted number.
 * Handles comma decimal separator.
 * 
 * @param {string} value - Number string (e.g., "0,1658")
 * @returns {number} Parsed float, or 0 if invalid
 */
export function parseNumber(value) {
  if (!value || value === '' || value === 'NA') return 0;
  return parseFloat(value.replace(',', '.')) || 0;
}

/**
 * Parse Precos_ELEGN.csv (prices).
 * 
 * @param {string} text - Raw CSV text
 * @returns {Array<Object>} Array of price objects
 */
export function parsePricesCSV(text) {
  const lines = text.trim().split('\n');
  
  // Remove BOM and parse header
  const header = lines[0]
    .replace(/^\uFEFF/, '')
    .split(';')
    .map(col => col.trim());
  
  return lines.slice(1)
    .map(line => {
      const values = line.replace(/\r/g, '').split(';');
      const obj = {};
      
      header.forEach((col, i) => {
        obj[col] = values[i]?.trim() || '';
      });
      
      return obj;
    })
    .filter(row => row.COM && row.Pot_Cont);
}

/**
 * Parse CondComerciais.csv (commercial conditions).
 * Returns a map keyed by COD_Proposta for fast lookup.
 * 
 * @param {string} text - Raw CSV text
 * @returns {Object} Map of COD_Proposta -> condition object
 */
export function parseConditionsCSV(text) {
  const lines = text.trim().split('\n');
  
  // Remove BOM and parse header
  const header = lines[0]
    .replace(/^\uFEFF/, '')
    .split(';')
    .map(col => col.trim());
  
  const map = {};
  
  lines.slice(1).forEach(line => {
    const values = line.replace(/\r/g, '').split(';');
    const obj = {};
    
    header.forEach((col, i) => {
      obj[col] = values[i]?.trim() || '';
    });
    
    if (obj.COD_Proposta) {
      map[obj.COD_Proposta] = obj;
    }
  });
  
  return map;
}

/**
 * Load and parse both CSV files.
 * 
 * @param {string} basePath - Path to data folder (default: 'data/')
 * @returns {Promise<{prices: Array, conditions: Object}>}
 */
export async function loadCSVData(basePath = 'data/') {
  // Ensure basePath ends with /
  const normalizedPath = basePath.endsWith('/') ? basePath : `${basePath}/`;
  
  const [pricesResponse, conditionsResponse] = await Promise.all([
    fetch(`${normalizedPath}Precos_ELEGN.csv`),
    fetch(`${normalizedPath}CondComerciais.csv`),
  ]);
  
  if (!pricesResponse.ok || !conditionsResponse.ok) {
    throw new Error('Failed to load CSV data');
  }
  
  const [pricesText, conditionsText] = await Promise.all([
    pricesResponse.text(),
    conditionsResponse.text(),
  ]);
  
  return {
    prices: parsePricesCSV(pricesText),
    conditions: parseConditionsCSV(conditionsText),
  };
}
