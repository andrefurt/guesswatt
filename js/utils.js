/**
 * Utility Functions
 * Generic helper functions for CSV parsing, phone formatting, etc.
 */

/**
 * Parse CSV text into array of objects
 * @param {string} text - CSV text content
 * @returns {Array<Object>} Parsed CSV data as array of objects
 */
export function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(';').map(h => h.trim());
  
  return lines.slice(1).map(line => {
    const values = line.split(';');
    const obj = {};
    
    headers.forEach((header, i) => {
      let value = values[i]?.trim() || '';
      
      // Converter números (vírgula para ponto)
      // Pode ser: "0,2325", "4,6", "123", etc.
      if (value !== '' && /^-?\d+[,.]\d+/.test(value)) {
        value = parseFloat(value.replace(',', '.'));
      } else if (value !== '' && /^-?\d+$/.test(value)) {
        value = parseFloat(value);
      }
      
      // Preservar o nome do campo exatamente como está (incluindo caracteres especiais como |)
      obj[header] = value;
    });
    
    return obj;
  });
}

/**
 * Load and parse CSV file from URL
 * @param {string} url - URL to CSV file
 * @returns {Promise<Array<Object>>} Parsed CSV data
 */
export async function loadCSV(url) {
  const response = await fetch(url);
  const text = await response.text();
  return parseCSV(text);
}

/**
 * Format phone number to Portuguese format (XXX XXX XXX)
 * @param {string|number} phone - Phone number to format
 * @returns {string|null} Formatted phone number or null if invalid
 */
export function formatPhone(phone) {
  if (!phone) return null;
  
  // Converter para string caso seja número
  const phoneStr = String(phone);
  
  // Remove caracteres não numéricos
  const clean = phoneStr.replace(/\D/g, '');
  
  if (clean.length === 9) {
    return `${clean.slice(0,3)} ${clean.slice(3,6)} ${clean.slice(6)}`;
  }
  return phoneStr;
}

