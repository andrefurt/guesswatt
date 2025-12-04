/**
 * PDF Service Module
 * PDF.js interaction and invoice text parsing logic
 */

import { PROVIDERS } from './config.js';
import { findBestOfferForTariff, calculateMonthlyCost, enrichOffer } from './calculator.js';
import { loadCSV } from './utils.js';
import { initTooltips } from './ui-components.js';

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
 * Parse invoice text using regex patterns
 * @param {string} text - Full text content from PDF
 * @returns {Object|null} Parsed invoice data or null
 */
export function parseInvoiceText(text) {
  // Patterns para diferentes operadores
  const patterns = {
    // Consumo em kWh
    consumption: /consumo[:\s]*(\d+)\s*kwh/i,
    consumptionAlt: /(\d+)\s*kwh/i,
    
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
  
  // Extrair consumo
  let consumption = null;
  const consumptionMatch = text.match(patterns.consumption) || text.match(patterns.consumptionAlt);
  if (consumptionMatch) {
    consumption = parseInt(consumptionMatch[1]);
  }
  
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
  
  // Retornar dados se tiver pelo menos consumo ou potência
  if (consumption || power) {
    return {
      consumption: consumption || 250,  // Default se não encontrar
      power: power || 4.6,              // Default se não encontrar
      provider: provider,
      tariffType: tariffType
    };
  }
  
  return null;
}

/**
 * Show PDF loading state
 */
export function showPDFLoading() {
  const emptyState = document.getElementById('pdf-empty');
  if (emptyState) {
    emptyState.innerHTML = '<p>A processar PDF...</p>';
  }
}

/**
 * Display extracted PDF data in UI
 * @param {Object} data - Extracted invoice data
 * @param {Function} onDataShown - Callback to call after showing data (for auto-calculation)
 */
export function showPDFData(data, onDataShown) {
  const uploadBox = document.getElementById('pdf-upload-box');
  const emptyState = document.getElementById('pdf-empty');
  const loadedState = document.getElementById('pdf-loaded');
  const dataContainer = document.getElementById('pdf-extracted-data');
  const toggleManual = document.getElementById('toggle-manual');
  const preciseForm = document.getElementById('precise-form');
  
  if (!uploadBox || !emptyState || !loadedState || !dataContainer) return;
  
  // Esconder estado vazio, mostrar estado carregado
  emptyState.style.display = 'none';
  loadedState.style.display = 'flex';
  uploadBox.classList.add('has-file');
  
  // Mostrar dados extraídos
  const providerName = data.provider ? (PROVIDERS[data.provider] || data.provider) : 'Não detectado';
  const tariffName = data.tariffType === 1 ? 'Simples' : data.tariffType === 2 ? 'Bi-horária' : 'Tri-horária';
  
  const tariffTooltip = data.tariffType === 1 ? 'tarifa-simples' : data.tariffType === 2 ? 'tarifa-bihoraria' : 'tarifa-trihoraria';
  
  dataContainer.innerHTML = `
    <p><strong>Operador:</strong> ${providerName}</p>
    <p><strong>Consumo:</strong> ${data.consumption} kWh<span class="tooltip-trigger" data-tooltip="kwh">ⓘ</span></p>
    <p><strong>Potência:</strong> ${data.power} kVA<span class="tooltip-trigger" data-tooltip="kva">ⓘ</span></p>
    <p><strong>Tarifa:</strong> ${tariffName}<span class="tooltip-trigger" data-tooltip="${tariffTooltip}">ⓘ</span></p>
  `;
  
  // Reinicializar tooltips após mostrar dados do PDF
  initTooltips();
  
  // Esconder link manual e form
  if (toggleManual) toggleManual.style.display = 'none';
  if (preciseForm) preciseForm.style.display = 'none';
  
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
  const uploadBox = document.getElementById('pdf-upload-box');
  const emptyState = document.getElementById('pdf-empty');
  const loadedState = document.getElementById('pdf-loaded');
  const toggleManual = document.getElementById('toggle-manual');
  const pdfInput = document.getElementById('pdf-input');
  
  // Reset estado
  pdfData = null;
  if (pdfInput) pdfInput.value = '';
  
  // Restaurar UI
  if (emptyState) {
    emptyState.style.display = 'flex';
    emptyState.innerHTML = `
      <span class="pdf-icon">📄</span>
      <p>Arrasta a tua factura PDF</p>
      <p class="pdf-hint">ou clica para seleccionar</p>
    `;
  }
  if (loadedState) loadedState.style.display = 'none';
  if (uploadBox) uploadBox.classList.remove('has-file');
  
  // Mostrar link manual
  if (toggleManual) {
    toggleManual.style.display = 'block';
    toggleManual.textContent = 'Introduzir dados manualmente';
  }
  
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
    
    // Carregar dados
    const prices = await loadCSV('data/Precos_ELEGN.csv');
    const conditions = await loadCSV('data/CondComerciais.csv');
    
    // Encontrar melhor oferta
    const best = findBestOfferForTariff(
      prices, 
      pdfData.consumption, 
      pdfData.power, 
      pdfData.tariffType
    );
    
    if (!best) {
      alert('Não encontrámos ofertas para este perfil.');
      return;
    }
    
    // Enriquecer com dados comerciais
    const enrichedBest = enrichOffer(best, conditions);
    
    // Calcular poupança vs operador actual (se detectado)
    let savings = null;
    if (pdfData.provider) {
      const currentProviderOffers = prices.filter(o => {
        const tvField = o['TV|TVFV|TVP'] || o.TV || 0;
        const potCont = typeof o.Pot_Cont === 'number' ? o.Pot_Cont : parseFloat(String(o.Pot_Cont || '').replace(',', '.'));
        return o.COM === pdfData.provider && 
               o.TF > 0 &&
               tvField > 0 &&
               potCont === pdfData.power &&
               o.Contagem === pdfData.tariffType;
      });
      
      if (currentProviderOffers.length > 0) {
        const currentProviderCosts = currentProviderOffers.map(offer => ({
          ...offer,
          monthlyCost: calculateMonthlyCost(offer, pdfData.consumption, pdfData.power)
        }));
        
        currentProviderCosts.sort((a, b) => a.monthlyCost - b.monthlyCost);
        const bestCurrentOffer = currentProviderCosts[0];
        
        const currentProviderCost = bestCurrentOffer.monthlyCost;
        const monthlySavings = currentProviderCost - enrichedBest.monthlyCost;
        
        if (monthlySavings > 0) {
          savings = {
            monthly: monthlySavings,
            yearly: monthlySavings * 12,
            vsProvider: PROVIDERS[pdfData.provider] || pdfData.provider
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
 * Initialize PDF upload functionality
 * @param {Function} clearTabResult - Function to clear tab result
 * @param {Function} setManualFormVisible - Function to set manual form visibility
 * @param {Function} getManualFormVisible - Function to get manual form visibility
 * @param {Function} onDataShown - Callback to call after showing PDF data
 */
export function initPDFUpload(clearTabResult, setManualFormVisible, getManualFormVisible, onDataShown) {
  const uploadBox = document.getElementById('pdf-upload-box');
  const pdfInput = document.getElementById('pdf-input');
  const toggleManual = document.getElementById('toggle-manual');
  const preciseForm = document.getElementById('precise-form');
  const pdfRemove = document.getElementById('pdf-remove');
  
  if (!uploadBox || !pdfInput) return;
  
  // Clicar na caixa abre file picker
  uploadBox.addEventListener('click', (e) => {
    if (!pdfData && e.target !== pdfRemove && !e.target.closest('#pdf-loaded')) {
      pdfInput.click();
    }
  });
  
  // Drag and drop
  uploadBox.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (!pdfData) uploadBox.classList.add('drag-over');
  });
  
  uploadBox.addEventListener('dragleave', () => {
    uploadBox.classList.remove('drag-over');
  });
  
  uploadBox.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadBox.classList.remove('drag-over');
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
  
  // Toggle manual form
  if (toggleManual) {
    toggleManual.addEventListener('click', () => {
      const isVisible = !getManualFormVisible();
      setManualFormVisible(isVisible);
      if (preciseForm) {
        preciseForm.style.display = isVisible ? 'block' : 'none';
      }
      toggleManual.textContent = isVisible 
        ? 'Esconder formulário' 
        : 'Introduzir dados manualmente';
    });
  }
  
  // Remove PDF
  if (pdfRemove) {
    pdfRemove.addEventListener('click', (e) => {
      e.stopPropagation();
      clearPDF(clearTabResult);
    });
  }
}

