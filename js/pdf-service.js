/**
 * PDF Service Module
 * PDF.js interaction and invoice text parsing logic
 */

import { PROVIDERS } from './config.js';
import { findBestOfferForTariff, calculateMonthlyCost, enrichOffer } from './calculator.js';
import { loadOffers, toTitleCase, formatTariffName } from './utils.js';
import { initTooltips } from './ui-components.js';
import { setInvoiceData } from './ui-handlers.js';

// PDF data state (managed by this module)
let pdfData = null;

/**
 * Load PDF.js library dynamically
 * @returns {Promise<void>}
 */
export function loadPDFJS() {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) {
      resolve();
      return;
    }
    
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/**
 * Extract text content from PDF file
 * @param {File} file - PDF file object
 * @returns {Promise<Object|null>} Extracted invoice data or null
 */
export async function extractPDFData(file) {
  // Carregar pdf.js se não estiver carregado
  if (!window.pdfjsLib) {
    await loadPDFJS();
  }
  
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    fullText += textContent.items.map(item => item.str).join(' ') + '\n';
  }
  
  // Tentar extrair dados com regex
  return parseInvoiceText(fullText);
}

/**
 * Extract consumption from invoice text by summing all consumption lines
 * Handles multiple VAT brackets, bi-hourly/tri-hourly tariffs, and validates against IEC line
 * @param {string} text - Full text content from PDF
 * @returns {Object|null} Extracted consumption data or null
 */
function extractConsumption(text) {
  // Normalize text: replace multiple spaces/newlines with single space for better regex matching
  const normalizedText = text.replace(/\s+/g, ' ');
  
  // Step 1: Try to extract from IEC (Imposto Especial Consumo) line - most reliable
  // Format: "Imposto Especial Consumo (Real) 347 kWh 0,001000€/kWh 0,35 €"
  const iecPattern = /imposto\s+especial\s+consumo[^(]*\(?(?:real|estimado)?\)?\s*(\d+)\s*kwh/gi;
  const iecMatches = [...normalizedText.matchAll(iecPattern)];
  let iecTotal = null;
  if (iecMatches.length > 0) {
    // Take the largest value (in case of multiple matches)
    iecTotal = Math.max(...iecMatches.map(m => parseInt(m[1])));
  }
  
  // Step 2: Extract all consumption lines from billing period sections
  // Look for consumption lines in billing period contexts (not cumulative meter readings)
  
  // Pattern to match billing periods: "Consumo (Real) 12 ago 2025 a 11 set 2025"
  const billingPeriodPattern = /consumo\s*\(?(?:real|estimado)\)?\s*(\d{1,2}\s+\w+\s+\d{4})\s*a\s*(\d{1,2}\s+\w+\s+\d{4})/gi;
  const periodMatches = [...normalizedText.matchAll(billingPeriodPattern)];
  
  // Consumption patterns for different period types
  // These match "Termo de Energia" lines with kWh values
  const consumptionPatterns = {
    // Cheio/F.Vazio/Fora de Vazio (full/off-peak)
    foraVazio: /termo\s+de\s+energia\s+(?:cheio\/f\.?vazio|cheio\/fora\s+de\s+vazio|fora\s+de\s+vazio|cheio)\s+(\d+)\s*kwh/gi,
    // Vazio (off-peak)
    vazio: /termo\s+de\s+energia\s+vazio\s+(\d+)\s*kwh/gi,
    // Ponta (peak) - for tri-hourly
    ponta: /termo\s+de\s+energia\s+ponta\s+(\d+)\s*kwh/gi,
    // Cheia (mid-day) - for tri-hourly
    cheia: /termo\s+de\s+energia\s+cheia\s+(\d+)\s*kwh/gi,
    // Simple tariff (no period type specified)
    simples: /termo\s+de\s+energia\s+(\d+)\s*kwh/gi,
  };
  
  // Alternative patterns (more flexible, provider-agnostic)
  // Match any line with kWh that appears in consumption context
  const altPatterns = {
    // Lines like "81 kWh" near "Termo de Energia" or "Consumo"
    termoEnergia: /termo\s+de\s+energia[^k]*?(\d+)\s*kwh/gi,
    // Direct consumption values in billing sections
    consumoReal: /consumo\s*\(?(?:real|estimado)\)?[^k]*?(\d+)\s*kwh/gi,
  };
  
  // Extract all consumption values
  const consumptionValues = {
    foraVazio: [],
    vazio: [],
    ponta: [],
    cheia: [],
    simples: [],
  };
  
  // Extract using specific patterns (excluding simples to avoid double-counting)
  // Process in order: most specific first
  const specificPatterns = ['foraVazio', 'vazio', 'ponta', 'cheia'];
  specificPatterns.forEach(type => {
    const pattern = consumptionPatterns[type];
    const matches = [...normalizedText.matchAll(pattern)];
    matches.forEach(match => {
      const value = parseInt(match[1]);
      if (value > 0 && value < 100000) { // Sanity check: reasonable consumption value
        consumptionValues[type].push(value);
      }
    });
  });
  
  // Only use simples pattern if no period-specific matches found
  // This avoids double-counting when period types are present
  const hasPeriodSpecific = consumptionValues.foraVazio.length > 0 || 
                           consumptionValues.vazio.length > 0 || 
                           consumptionValues.ponta.length > 0 || 
                           consumptionValues.cheia.length > 0;
  
  if (!hasPeriodSpecific) {
    // Try simples pattern (no period type specified)
    const simplesMatches = [...normalizedText.matchAll(consumptionPatterns.simples)];
    simplesMatches.forEach(match => {
      const value = parseInt(match[1]);
      if (value > 0 && value < 100000) {
        consumptionValues.simples.push(value);
      }
    });
    
    // If still no matches, try alternative patterns
    if (consumptionValues.simples.length === 0) {
      const termoMatches = [...normalizedText.matchAll(altPatterns.termoEnergia)];
      termoMatches.forEach(match => {
        const value = parseInt(match[1]);
        if (value > 0 && value < 100000) {
          consumptionValues.simples.push(value);
        }
      });
    }
  }
  
  // Step 3: Filter out cumulative meter readings
  // These typically appear on page 1 with "A sua leitura" or "Leitura" context
  // and have very large values (e.g., 13899 kWh)
  const meterReadingPattern = /(?:a\s+sua\s+leitura|leitura|leitura\s+anterior|leitura\s+actual)[^k]*?(\d+)\s*kwh/gi;
  const meterReadings = [...normalizedText.matchAll(meterReadingPattern)];
  const meterReadingValues = meterReadings.map(m => parseInt(m[1]));
  
  // Filter out values that look like cumulative readings (typically > 1000 kWh)
  // But keep them if they're the only values we found
  const hasBillingPeriodConsumption = periodMatches.length > 0;
  const allConsumptionValues = [
    ...consumptionValues.foraVazio,
    ...consumptionValues.vazio,
    ...consumptionValues.ponta,
    ...consumptionValues.cheia,
    ...consumptionValues.simples,
  ];
  
  // If we have billing period context, filter out large values that might be meter readings
  const filteredConsumption = hasBillingPeriodConsumption
    ? allConsumptionValues.filter(v => v < 1000 || allConsumptionValues.length === 1)
    : allConsumptionValues;
  
  // Step 4: Calculate totals by period type
  const totals = {
    foraVazio: consumptionValues.foraVazio.reduce((sum, v) => sum + v, 0),
    vazio: consumptionValues.vazio.reduce((sum, v) => sum + v, 0),
    ponta: consumptionValues.ponta.reduce((sum, v) => sum + v, 0),
    cheia: consumptionValues.cheia.reduce((sum, v) => sum + v, 0),
    simples: consumptionValues.simples.reduce((sum, v) => sum + v, 0),
  };
  
  // Step 5: Determine total consumption
  let totalConsumption = 0;
  
  // If we have period-specific values, sum them
  if (totals.foraVazio > 0 || totals.vazio > 0 || totals.ponta > 0 || totals.cheia > 0) {
    totalConsumption = totals.foraVazio + totals.vazio + totals.ponta + totals.cheia;
  } else if (totals.simples > 0) {
    // For simple tariff, sum all simple consumption values
    totalConsumption = totals.simples;
  } else if (filteredConsumption.length > 0) {
    // Fallback: sum filtered values
    totalConsumption = filteredConsumption.reduce((sum, v) => sum + v, 0);
  }
  
  // Step 6: Validate against IEC if available
  if (iecTotal && totalConsumption > 0) {
    // IEC should match total consumption (allow 5% tolerance for rounding)
    const tolerance = Math.max(5, Math.floor(iecTotal * 0.05));
    if (Math.abs(totalConsumption - iecTotal) > tolerance) {
      // IEC is more reliable, use it if discrepancy is large
      console.warn(`Consumption mismatch: extracted ${totalConsumption} kWh, IEC shows ${iecTotal} kWh. Using IEC value.`);
      totalConsumption = iecTotal;
    }
  } else if (iecTotal && totalConsumption === 0) {
    // If we couldn't extract from consumption lines, use IEC
    totalConsumption = iecTotal;
  }
  
  return totalConsumption > 0 ? totalConsumption : null;
}

/**
 * Parse invoice text using regex patterns
 * @param {string} text - Full text content from PDF
 * @returns {Object|null} Parsed invoice data or null
 */
export function parseInvoiceText(text) {
  // Patterns para diferentes operadores
  const patterns = {
    // Potência em kVA
    power: /pot[êe]ncia[:\s]*([\d.,]+)\s*kva/i,
    powerAlt: /([\d.,]+)\s*kva/i,
    
    // Operador
    edp: /edp/i,
    endesa: /endesa/i,
    galp: /galp/i,
    goldenergy: /goldenergy/i,
    iberdrola: /iberdrola/i,
    
    // Tipo de tarifa
    simples: /tarifa\s*simples|simples/i,
    bihoraria: /bi[- ]?hor[aá]ria/i,
    trihoraria: /tri[- ]?hor[aá]ria/i,
  };
  
  // Extrair consumo usando método robusto
  const consumption = extractConsumption(text);
  
  // Extrair potência
  let power = null;
  const powerMatch = text.match(patterns.power) || text.match(patterns.powerAlt);
  if (powerMatch) {
    power = parseFloat(powerMatch[1].replace(',', '.'));
  }
  
  // Detectar operador
  let provider = null;
  if (patterns.edp.test(text)) provider = 'EDPC';
  else if (patterns.endesa.test(text)) provider = 'END';
  else if (patterns.galp.test(text)) provider = 'GALP';
  else if (patterns.goldenergy.test(text)) provider = 'GOLD';
  else if (patterns.iberdrola.test(text)) provider = 'IBER';
  
  // Detectar tipo de tarifa
  let tariffType = 1; // Default: simples
  if (patterns.trihoraria.test(text)) tariffType = 3;
  else if (patterns.bihoraria.test(text)) tariffType = 2;
  
  // Detectar ciclo (daily vs weekly) para bi-horária e tri-horária
  let cycleType = null;
  if (tariffType === 2 || tariffType === 3) {
    const normalizedText = text.toLowerCase();
    // Check for weekly cycle indicators
    if (normalizedText.includes('sem feriados') ||
        normalizedText.includes('ciclo semanal') ||
        normalizedText.includes('semanal')) {
      cycleType = 'weekly';
    }
    // Check for daily cycle indicators
    else if (normalizedText.includes('ciclo diário') ||
             normalizedText.includes('ciclo diario') ||
             normalizedText.includes('diário') ||
             normalizedText.includes('diario')) {
      cycleType = 'daily';
    }
  }
  
  // Retornar dados se tiver pelo menos consumo ou potência
  if (consumption || power) {
    return {
      consumption: consumption || 250,  // Default se não encontrar
      power: power || 4.6,              // Default se não encontrar
      provider: provider,
      tariffType: tariffType,
      cycleType: cycleType // 'daily' | 'weekly' | null
    };
  }
  
  return null;
}

/**
 * Show PDF loading state
 */
export function showPDFLoading() {
  const dropArea = document.getElementById('precise-mode');
  const dropAreaText = dropArea?.querySelector('.drop-area-text p');
  if (dropAreaText) {
    dropAreaText.textContent = 'A processar PDF...';
  }
}

/**
 * Display extracted PDF data in UI
 * @param {Object} data - Extracted invoice data
 * @param {Function} onDataShown - Callback to call after showing data (for auto-calculation)
 */
export function showPDFData(data, onDataShown) {
  const dropArea = document.getElementById('precise-mode');
  const dropAreaText = dropArea?.querySelector('.drop-area-text');
  const manualLink = document.getElementById('manual-link');
  
  if (!dropArea || !dropAreaText) return;
  
  // Mostrar dados extraídos no drop area
  const providerNameRaw = data.provider ? (PROVIDERS[data.provider] || data.provider) : 'Não detectado';
  const providerName = toTitleCase(providerNameRaw);
  
  // Build tariff name with cycle info if available
  const tariffNameRaw = data.tariffType === 1 ? 'Simples' : 
                        data.tariffType === 2 ? 'Bi-horária' : 'Tri-horária';
  const tariffName = formatTariffName(tariffNameRaw, data.tariffType, data.cycleType);
  
  // Update drop area text to show loaded state
  dropAreaText.innerHTML = `
    <p>✓ Factura carregada</p>
    <p class="pdf-data-summary">${providerName} · ${tariffName} · ${data.consumption} kWh · ${data.power} kVA</p>
  `;
  
  // Hide manual link
  if (manualLink) manualLink.style.display = 'none';
  
  // Mark drop area as having file
  dropArea.classList.add('has-file');
  
  // Update input pill with invoice data (from PDF)
  setInvoiceData({
    provider: providerName,
    tariff: tariffName,
    consumption: data.consumption,
    power: data.power
  }, true); // fromPDF = true
  
  // Calcular automaticamente após mostrar dados
  if (onDataShown) {
    onDataShown();
  }
}

/**
 * Clear PDF data and reset UI
 * @param {Function} clearTabResult - Function to clear tab result
 */
export function clearPDF(clearTabResult) {
  const dropArea = document.getElementById('precise-mode');
  const dropAreaText = dropArea?.querySelector('.drop-area-text');
  const manualLink = document.getElementById('manual-link');
  const pdfInput = document.getElementById('pdf-input');
  
  // Reset estado
  pdfData = null;
  if (pdfInput) pdfInput.value = '';
  
  // Restaurar UI
  if (dropAreaText) {
    dropAreaText.innerHTML = `
      <p>Clica ou arrasta a tua fatura PDF</p>
      <a href="#" id="manual-link" aria-label="Introduzir dados da fatura manualmente">Adicionar dados manualmente</a>
    `;
  }
  
  // Remove has-file class
  if (dropArea) dropArea.classList.remove('has-file');
  
  // Show manual link
  if (manualLink) manualLink.style.display = 'inline';
  
  // Esconder resultado quando PDF é removido
  const resultDiv = document.getElementById('result');
  if (resultDiv) {
    resultDiv.style.display = 'none';
    resultDiv.innerHTML = '';
  }
  
  // Limpar resultado da tab
  if (clearTabResult) {
    clearTabResult('precise');
  }
}

/**
 * Handle PDF file upload
 * @param {File} file - PDF file
 * @param {Function} clearTabResult - Function to clear tab result
 * @param {Function} onDataShown - Callback to call after showing data
 */
export async function handlePDFFile(file, clearTabResult, onDataShown) {
  if (file.type !== 'application/pdf') {
    alert('Por favor selecciona um ficheiro PDF.');
    return;
  }
  
  try {
    // Mostrar loading state
    showPDFLoading();
    
    // Extrair dados do PDF
    const extracted = await extractPDFData(file);
    
    if (extracted) {
      pdfData = extracted;
      showPDFData(extracted, onDataShown);
    } else {
      alert('Não foi possível extrair dados desta factura. Tenta introduzir manualmente.');
      clearPDF(clearTabResult);
    }
  } catch (error) {
    console.error('Erro ao processar PDF:', error);
    alert('Erro ao processar o PDF. Tenta introduzir manualmente.');
    clearPDF(clearTabResult);
  }
}

/**
 * Calculate best offer from PDF data
 * @param {Function} renderResult - Function to render result
 * @param {string} currentMode - Current mode ('estimate' or 'precise')
 * @param {Function} setTabResult - Function to set tab result
 */
export async function calculateFromPDF(renderResult, currentMode, setTabResult) {
  if (!pdfData) return;
  
  try {
    const resultDiv = document.getElementById('result');
    if (resultDiv) {
      resultDiv.innerHTML = '<p>A calcular...</p>';
      resultDiv.style.display = 'block';
    }
    
    // Carregar dados (prefers offers.json, falls back to CSV)
    const { prices, conditions, offers } = await loadOffers();
    
    // Use offers.json if available (already filtered to ELE-only at build time)
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
    
    // Encontrar melhor oferta (filters lock-in, uses annual effective cost)
    const best = findBestOfferForTariff(
      offersToSearch, 
      pdfData.consumption, 
      pdfData.power, 
      pdfData.tariffType
    );
    
    if (!best) {
      alert('Não encontrámos ofertas para este perfil.');
      return;
    }
    
    // Enriquecer com nome da tarifa e metadata (if not already enriched)
    const enrichedBest = offers ? best : enrichOffer(best, conditions);
    
    // Calcular poupança vs operador actual (se detectado)
    let savings = null;
    if (pdfData.provider) {
      // Normalize power for comparison (use same tolerance as findBestOfferForTariff)
      const normalizedPower = typeof pdfData.power === 'number' ? pdfData.power : parseFloat(String(pdfData.power).replace(',', '.'));
      const normalizedTariffType = typeof pdfData.tariffType === 'number' ? pdfData.tariffType : parseInt(pdfData.tariffType);
      
      // Encontrar ofertas do operador actual com mesma potência e tarifa
      const currentProviderOffers = offersToSearch.filter(o => {
        const tvField = o['TV|TVFV|TVP'] || o.TV || 0;
        const potCont = typeof o.Pot_Cont === 'number' ? o.Pot_Cont : parseFloat(String(o.Pot_Cont || '').replace(',', '.'));
        const contagem = typeof o.Contagem === 'number' ? o.Contagem : parseInt(o.Contagem);
        
        // Use tolerance for floating point comparison (0.01 kVA tolerance - same as findBestOfferForTariff)
        const powerMatch = Math.abs(potCont - normalizedPower) < 0.01;
        
        return o.COM === pdfData.provider && 
               o.TF > 0 &&
               tvField > 0 &&
               powerMatch &&
               contagem === normalizedTariffType;
      });
      
      if (currentProviderOffers.length > 0) {
        // Calcular custo com a melhor oferta do operador actual
        const currentProviderCosts = currentProviderOffers.map(offer => ({
          ...offer,
          monthlyCost: calculateMonthlyCost(offer, pdfData.consumption, pdfData.power)
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
            vsProvider: toTitleCase(PROVIDERS[pdfData.provider] || pdfData.provider)
          };
        }
      }
    }
    
    // Renderizar resultado
    renderResult(enrichedBest, pdfData.consumption, pdfData.power, null, savings, false, currentMode, setTabResult);
    
  } catch (error) {
    console.error('Erro ao calcular:', error);
    alert('Erro ao calcular. Tenta novamente.');
  }
}

/**
 * Get current PDF data
 * @returns {Object|null} Current PDF data or null
 */
export function getPDFData() {
  return pdfData;
}

/**
 * Reset PDF data state (called when returning to input view)
 */
export function resetPDFData() {
  pdfData = null;
}

/**
 * Initialize PDF upload functionality
 * @param {Function} clearTabResult - Function to clear tab result
 * @param {Function} setManualFormVisible - Function to set manual form visibility
 * @param {Function} getManualFormVisible - Function to get manual form visibility
 * @param {Function} onDataShown - Callback to call after showing PDF data
 */
export function initPDFUpload(clearTabResult, setManualFormVisible, getManualFormVisible, onDataShown) {
  const dropArea = document.getElementById('precise-mode');
  const pdfInput = document.getElementById('pdf-input');
  const inputSlot = document.getElementById('input-slot');
  
  if (!dropArea || !pdfInput) return;
  
  // Clicar na drop area abre file picker (exceto no link manual)
  dropArea.addEventListener('click', (e) => {
    const manualLink = e.target.closest('#manual-link');
    if (!pdfData && !manualLink) {
      pdfInput.click();
    }
  });
  
  // Drag and drop
  dropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (!pdfData && inputSlot) {
      inputSlot.classList.add('dragging');
    }
  });
  
  dropArea.addEventListener('dragleave', (e) => {
    if (inputSlot) inputSlot.classList.remove('dragging');
  });
  
  dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    if (inputSlot) inputSlot.classList.remove('dragging');
    if (!pdfData && e.dataTransfer.files.length) {
      handlePDFFile(e.dataTransfer.files[0], clearTabResult, onDataShown);
    }
  });
  
  // File input change
  pdfInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
      handlePDFFile(e.target.files[0], clearTabResult, onDataShown);
    }
  });
}
