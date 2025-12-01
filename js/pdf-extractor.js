/**
 * GuessWatt - PDF Extractor
 * 
 * Extracts consumption data from electricity bill PDFs.
 * Uses pdf.js for text extraction and provider-specific patterns.
 * 
 * Supported providers:
 * - Endesa
 * - EDP / EDP Comercial
 * - Galp
 * - Goldenergy
 * - Generic fallback
 */

import { POTENCIAS_VALIDAS } from './constants.js';

/**
 * Provider-specific extraction patterns.
 * Each extractor has:
 * - detect: function to identify if PDF is from this provider
 * - extract: function to extract data from text
 */
const EXTRACTORS = {
  
  endesa: {
    detect: (text) => text.includes('endesa') || text.includes('ENDESA'),
    
    extract: (text) => {
      const result = { provider: 'Endesa' };
      
      // Power: "6,90 kVA" or "Potência 6,90 kVA"
      const powerMatch = text.match(/(\d{1,2}[,\.]\d{1,2})\s*kVA/i);
      if (powerMatch) {
        result.power = parseFloat(powerMatch[1].replace(',', '.'));
      }
      
      // Tariff type
      if (/bi[- ]?hor[aá]ria/i.test(text)) {
        result.tariffType = 2;
        result.tariffTypeName = 'Bi-horária';
      } else if (/tri[- ]?hor[aá]ria/i.test(text)) {
        result.tariffType = 3;
        result.tariffTypeName = 'Tri-horária';
      } else {
        result.tariffType = 1;
        result.tariffTypeName = 'Simples';
      }
      
      // Consumption - Endesa shows Cheia/Ponta and Vazio separately
      const consumptionPeak = [];
      const consumptionOffPeak = [];
      
      // Find all peak consumption entries
      const regexPeak = /Termo de Energia\s+(?:Cheio|Cheia|F\.?\s*Vazio|Fora\s*Vazio)[^\d]*(\d+)\s*kWh/gi;
      let match;
      while ((match = regexPeak.exec(text)) !== null) {
        consumptionPeak.push(parseInt(match[1]));
      }
      
      // Find all off-peak consumption entries
      const regexOffPeak = /Termo de Energia\s+Vazio[^\d]*(\d+)\s*kWh/gi;
      while ((match = regexOffPeak.exec(text)) !== null) {
        consumptionOffPeak.push(parseInt(match[1]));
      }
      
      const totalPeak = consumptionPeak.reduce((a, b) => a + b, 0);
      const totalOffPeak = consumptionOffPeak.reduce((a, b) => a + b, 0);
      const totalConsumption = totalPeak + totalOffPeak;
      
      if (totalConsumption > 0) {
        result.consumption = totalConsumption;
        result.consumptionPeak = totalPeak;
        result.consumptionOffPeak = totalOffPeak;
        result.offPeakPercent = Math.round((totalOffPeak / totalConsumption) * 100);
      }
      
      // Fallback: generic consumption pattern
      if (!result.consumption) {
        const consumptionMatch = text.match(/(\d{2,4})\s*kWh/);
        if (consumptionMatch) {
          result.consumption = parseInt(consumptionMatch[1]);
        }
      }
      
      return result;
    },
  },
  
  edp: {
    detect: (text) => (text.includes('EDP') || text.includes('edp')) && !text.includes('endesa'),
    
    extract: (text) => {
      const result = { provider: 'EDP' };
      
      // Power
      const powerMatch = text.match(/Pot[eê]ncia\s*(?:Contratada)?[:\s]*(\d{1,2}[,\.]\d{1,2})\s*kVA/i) ||
                         text.match(/(\d{1,2}[,\.]\d{1,2})\s*kVA/i);
      if (powerMatch) {
        result.power = parseFloat(powerMatch[1].replace(',', '.'));
      }
      
      // Tariff type
      if (/bi[- ]?hor[aá]ri/i.test(text)) {
        result.tariffType = 2;
        result.tariffTypeName = 'Bi-horária';
      } else if (/tri[- ]?hor[aá]ri/i.test(text)) {
        result.tariffType = 3;
        result.tariffTypeName = 'Tri-horária';
      } else {
        result.tariffType = 1;
        result.tariffTypeName = 'Simples';
      }
      
      // Consumption - EDP uses "Energia Ativa" or similar
      const consumptions = [];
      const regexConsumption = /(?:Energia|Consumo)[^\d]*(\d{2,4})\s*kWh/gi;
      let match;
      while ((match = regexConsumption.exec(text)) !== null) {
        consumptions.push(parseInt(match[1]));
      }
      
      if (consumptions.length > 0) {
        result.consumption = consumptions.reduce((a, b) => a + b, 0);
      }
      
      // Off-peak percentage (if bi-hourly)
      if (result.tariffType === 2) {
        const offPeakMatch = text.match(/Vazio[^\d]*(\d{2,4})\s*kWh/i);
        const peakMatch = text.match(/(?:Fora\s*Vazio|Cheias?|Ponta)[^\d]*(\d{2,4})\s*kWh/i);
        if (offPeakMatch && peakMatch) {
          const offPeak = parseInt(offPeakMatch[1]);
          const peak = parseInt(peakMatch[1]);
          result.offPeakPercent = Math.round((offPeak / (offPeak + peak)) * 100);
        }
      }
      
      return result;
    },
  },
  
  galp: {
    detect: (text) => text.includes('Galp') || text.includes('GALP') || text.includes('galp.pt'),
    
    extract: (text) => {
      const result = { provider: 'Galp' };
      
      // Power
      const powerMatch = text.match(/(\d{1,2}[,\.]\d{1,2})\s*kVA/i);
      if (powerMatch) {
        result.power = parseFloat(powerMatch[1].replace(',', '.'));
      }
      
      // Tariff type
      if (/bi[- ]?hor[aá]ri/i.test(text)) {
        result.tariffType = 2;
        result.tariffTypeName = 'Bi-horária';
      } else if (/tri[- ]?hor[aá]ri/i.test(text)) {
        result.tariffType = 3;
        result.tariffTypeName = 'Tri-horária';
      } else {
        result.tariffType = 1;
        result.tariffTypeName = 'Simples';
      }
      
      // Consumption
      const consumptionMatch = text.match(/Consumo[^\d]*(\d{2,4})\s*kWh/i) ||
                               text.match(/(\d{2,4})\s*kWh/);
      if (consumptionMatch) {
        result.consumption = parseInt(consumptionMatch[1]);
      }
      
      return result;
    },
  },
  
  goldenergy: {
    detect: (text) => text.includes('Goldenergy') || text.includes('GOLDENERGY') || text.includes('goldenergy'),
    
    extract: (text) => {
      const result = { provider: 'Goldenergy' };
      
      // Power
      const powerMatch = text.match(/Pot[eê]ncia[^\d]*(\d{1,2}[,\.]\d{1,2})\s*kVA/i) ||
                         text.match(/(\d{1,2}[,\.]\d{1,2})\s*kVA/i);
      if (powerMatch) {
        result.power = parseFloat(powerMatch[1].replace(',', '.'));
      }
      
      // Tariff type
      if (/bi[- ]?hor[aá]ri/i.test(text)) {
        result.tariffType = 2;
        result.tariffTypeName = 'Bi-horária';
      } else if (/tri[- ]?hor[aá]ri/i.test(text)) {
        result.tariffType = 3;
        result.tariffTypeName = 'Tri-horária';
      } else {
        result.tariffType = 1;
        result.tariffTypeName = 'Simples';
      }
      
      // Consumption - filter reasonable values
      const consumptions = [];
      const regexConsumption = /(\d{2,4})\s*kWh/gi;
      let match;
      while ((match = regexConsumption.exec(text)) !== null) {
        const value = parseInt(match[1]);
        // Filter unreasonable values (probably accumulated or too low)
        if (value >= 10 && value <= 2000) {
          consumptions.push(value);
        }
      }
      
      if (consumptions.length > 0) {
        // Take the largest reasonable monthly consumption
        result.consumption = Math.max(...consumptions.filter(c => c <= 1000)) || consumptions[0];
      }
      
      return result;
    },
  },
};

/**
 * Generic fallback extractor for unknown providers.
 * 
 * @param {string} text - Extracted text from PDF
 * @returns {Object} Extracted data
 */
function extractGeneric(text) {
  const result = { provider: 'Desconhecido' };
  
  // Power
  const powerMatch = text.match(/(\d{1,2}[,\.]\d{1,2})\s*kVA/i);
  if (powerMatch) {
    result.power = parseFloat(powerMatch[1].replace(',', '.'));
  }
  
  // Tariff type
  if (/bi[- ]?hor[aá]ri/i.test(text)) {
    result.tariffType = 2;
    result.tariffTypeName = 'Bi-horária';
  } else if (/tri[- ]?hor[aá]ri/i.test(text)) {
    result.tariffType = 3;
    result.tariffTypeName = 'Tri-horária';
  } else {
    result.tariffType = 1;
    result.tariffTypeName = 'Simples';
  }
  
  // Consumption - look for reasonable monthly values
  const consumptions = [];
  const regexConsumption = /(\d{2,4})\s*kWh/gi;
  let match;
  while ((match = regexConsumption.exec(text)) !== null) {
    consumptions.push(parseInt(match[1]));
  }
  
  if (consumptions.length > 0) {
    // Filter to reasonable monthly consumption values
    const reasonable = consumptions.filter(c => c >= 50 && c <= 1500);
    if (reasonable.length > 0) {
      result.consumption = reasonable.reduce((a, b) => a + b, 0);
    }
  }
  
  return result;
}

/**
 * Normalize power value to nearest valid option.
 * 
 * @param {number} power - Extracted power value
 * @returns {number} Nearest valid power option
 */
export function normalizePower(power) {
  let closest = POTENCIAS_VALIDAS[0];
  let minDiff = Math.abs(power - closest);
  
  for (const option of POTENCIAS_VALIDAS) {
    const diff = Math.abs(power - option);
    if (diff < minDiff) {
      minDiff = diff;
      closest = option;
    }
  }
  
  return closest;
}

/**
 * Extract data from a PDF file.
 * Requires pdf.js to be loaded globally (pdfjsLib).
 * 
 * @param {File} file - PDF file from input
 * @returns {Promise<Object>} Extracted data
 */
export async function extractFromPDF(file) {
  // Check if pdf.js is available
  if (typeof pdfjsLib === 'undefined') {
    throw new Error('pdf.js not loaded');
  }
  
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = '';
  
  // Extract text from all pages
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    fullText += pageText + '\n';
  }
  
  // Try each provider extractor
  for (const [name, extractor] of Object.entries(EXTRACTORS)) {
    if (extractor.detect(fullText)) {
      const data = extractor.extract(fullText);
      
      // Normalize power if found
      if (data.power) {
        data.normalizedPower = normalizePower(data.power);
      }
      
      return data;
    }
  }
  
  // Fallback to generic extractor
  const data = extractGeneric(fullText);
  
  if (data.power) {
    data.normalizedPower = normalizePower(data.power);
  }
  
  return data;
}

/**
 * Check if PDF extraction is available.
 * 
 * @returns {boolean} True if pdf.js is loaded
 */
export function isPDFExtractionAvailable() {
  return typeof pdfjsLib !== 'undefined';
}
