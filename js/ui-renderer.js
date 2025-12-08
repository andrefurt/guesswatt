/**
 * UI Renderer Module
 * Generates pixel-perfect HTML matching design.html structure
 * Uses design system classes for proper styling
 */

import { PROVIDERS } from './config.js';
import { formatPhone, toTitleCase } from './utils.js';
import { initTooltips } from './ui-components.js';
import { showResults, getPillMode } from './ui-handlers.js';

/**
 * Extract domain from website URL
 * @param {string} websiteUrl - Full website URL
 * @returns {string|null} Domain name or null
 */
function extractDomain(websiteUrl) {
  if (!websiteUrl) return null;
  try {
    const url = new URL(websiteUrl);
    return url.hostname.replace(/^www\./, ''); // Remove www. prefix
  } catch (e) {
    // If URL parsing fails, try simple regex extraction
    const match = websiteUrl.match(/https?:\/\/(?:www\.)?([^\/]+)/);
    return match ? match[1] : null;
  }
}

/**
 * Generate provider logo HTML with hybrid fallback approach
 * @param {string} providerCode - Provider code
 * @param {string|null} websiteUrl - Provider website URL
 * @returns {string} HTML string with logo image and fallback icon
 */
function getProviderIcon(providerCode, websiteUrl = null) {
  const domain = extractDomain(websiteUrl);
  
  // If no domain, return default icon
  if (!domain) {
    return `<i class="ph-duotone ph-lightning"></i>`;
  }
  
  // Generate logo URLs
  const clearbitUrl = `https://logo.clearbit.com/${domain}`;
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
  
  // Return HTML with image and fallback chain
  // Use data attributes to store fallback URLs for JavaScript handler
  return `
    <img 
      src="${clearbitUrl}" 
      alt="${providerCode}" 
      class="provider-logo"
      data-favicon="${faviconUrl}"
      data-provider="${providerCode}"
    />
    <i class="ph-duotone ph-lightning provider-icon-fallback" style="display:none;"></i>
  `;
}

/**
 * Initialize provider logo fallback handlers
 * Sets up error handlers for logo images to cascade through fallback options
 */
function initProviderLogoFallbacks() {
  const logoImages = document.querySelectorAll('.provider-logo');
  
  logoImages.forEach(img => {
    // First fallback: Clearbit fails -> try favicon
    img.addEventListener('error', function handleClearbitError() {
      const faviconUrl = this.dataset.favicon;
      if (faviconUrl && this.src !== faviconUrl) {
        this.src = faviconUrl;
        // Remove this handler and add favicon error handler
        this.removeEventListener('error', handleClearbitError);
        this.addEventListener('error', function handleFaviconError() {
          // Favicon also failed -> show fallback icon
          this.style.display = 'none';
          const fallback = this.nextElementSibling;
          if (fallback && fallback.classList.contains('provider-icon-fallback')) {
            fallback.style.display = 'inline-flex';
          }
        });
      } else {
        // No favicon URL or already tried -> show fallback icon
        this.style.display = 'none';
        const fallback = this.nextElementSibling;
        if (fallback && fallback.classList.contains('provider-icon-fallback')) {
          fallback.style.display = 'inline-flex';
        }
      }
    });
  });
}

/**
 * Render calculation result with design system structure
 * @param {Object} enrichedBest - Enriched best offer object
 * @param {number} consumption - Consumption in kWh
 * @param {number} power - Power in kVA
 * @param {number|null} monthlyBill - Monthly bill amount (for estimate mode)
 * @param {Object|null} savings - Savings object with monthly/yearly properties
 * @param {boolean} isEstimate - Whether this is estimate mode
 * @param {string} currentMode - Current mode ('estimate' or 'precise')
 * @param {Function} setTabResult - Function to set tab result for a mode
 */
export function renderResult(enrichedBest, consumption, power, monthlyBill = null, savings = null, isEstimate = false, currentMode, setTabResult) {
  const resultDiv = document.getElementById('result');
  const resultsView = document.getElementById('results-view');
  const pageWrapper = document.getElementById('page-wrapper');
  const inputPill = document.getElementById('input-pill');
  const pillAmount = document.getElementById('pill-amount');
  
  if (!resultDiv) return;
  
  const providerNameRaw = PROVIDERS[enrichedBest.COM] || enrichedBest.COM;
  const providerName = toTitleCase(providerNameRaw);
  const formattedPhone = formatPhone(enrichedBest.phone);
  const rawPhone = String(enrichedBest.phone || '').replace(/\D/g, '');
  
  // Calculate savings for estimate mode
  let estimateSavings = null;
  if (monthlyBill && !savings) {
    const monthlySavings = monthlyBill - enrichedBest.monthlyCost;
    if (monthlySavings > 0) {
      estimateSavings = {
        monthly: monthlySavings,
        yearly: monthlySavings * 12
      };
    }
  }
  
  const displaySavings = savings || estimateSavings;
  
  // Build campaign badge HTML
  let campaignBadgeHTML = '';
  if (enrichedBest.isCampaignActive === true || enrichedBest.promotion) {
    const promotionText = enrichedBest.promotion || 'CAMPANHA';
    campaignBadgeHTML = `
      <div class="badge">
        <div class="badge-inner">${promotionText}</div>
      </div>
    `;
  }
  
  // Build savings bar HTML
  let savingsBarHTML = '';
  if (displaySavings && displaySavings.yearly > 0) {
    savingsBarHTML = `
      <div class="savings-bar">
        <div class="savings-bar-inner">
          <i class="ph-duotone ph-lightbulb"></i>
          <span>Poupas</span>
          <span>€${displaySavings.monthly.toFixed(2)}/mês,</span>
          <span>€${displaySavings.yearly.toFixed(2)}/ano</span>
        </div>
      </div>
    `;
  }
  
  // Build phone button HTML
  let phoneButtonHTML = '';
  if (formattedPhone) {
    phoneButtonHTML = `
      <div class="btn-slot">
        <button class="btn copy-phone-btn" type="button" data-phone="${rawPhone}">
          <span class="btn-icon">
            <i class="ph-duotone ph-phone"></i>
          </span>
          <span>${formattedPhone}</span>
        </button>
      </div>
    `;
  }
  
  // Build website button HTML
  let websiteButtonHTML = '';
  if (enrichedBest.website) {
    websiteButtonHTML = `
      <div class="btn-slot">
        <a href="${enrichedBest.website}" target="_blank" rel="noopener" class="btn btn-suffix" aria-label="Visitar website da ${providerName}">
          <span class="btn-icon">
            <i class="ph-duotone ph-globe"></i>
          </span>
        </a>
      </div>
    `;
  }
  
  // Build the full result card HTML matching design.html structure
  const resultHTML = `
    <!-- Card Header -->
    <div class="result-card-header">
      <div class="result-card-top">
        <div class="provider-icon">
          ${getProviderIcon(enrichedBest.COM, enrichedBest.website)}
        </div>
        <div class="result-card-actions">
          ${phoneButtonHTML}
          ${websiteButtonHTML}
        </div>
      </div>
      <div class="result-card-info">
        <p class="provider-name">${providerName}</p>
        <p class="provider-plan">${toTitleCase(enrichedBest.tariffName || 'Tarifa Simples')}</p>
      </div>
    </div>

    <!-- Card Data -->
    <div class="result-data">
      <div class="data-row">
        <div class="data-row-inner">
          <div class="data-row-label">
            <i class="ph-duotone ph-chart-line"></i>
            <span>Consumo estimado <span class="muted">(mês)</span></span>
          </div>
          <span class="data-row-value">${consumption} kWh</span>
        </div>
      </div>
      <div class="data-row">
        <div class="data-row-inner">
          <div class="data-row-label">
            <i class="ph-duotone ph-lightning"></i>
            <span>Potência</span>
          </div>
          <span class="data-row-value">${power} kVA</span>
        </div>
      </div>
      <div class="data-row">
        <div class="data-row-inner">
          <div class="data-row-label">
            <i class="ph-duotone ph-currency-eur"></i>
            <span>Custo mensal</span>
          </div>
          <div class="data-row-value-group">
            ${campaignBadgeHTML}
            <span class="data-row-value">€${enrichedBest.monthlyCost.toFixed(2)}</span>
          </div>
        </div>
      </div>

      ${savingsBarHTML}
    </div>
  `;
  
  // Build info section HTML
  const infoHTML = `
    <div class="result-info">
      <div class="info-row">
        <div class="info-row-inner">
          <span class="info-row-label">Como mudar</span>
          <span class="info-row-value">Diz que queres aderir à "${toTitleCase(enrichedBest.tariffName || 'tarifa')}"</span>
        </div>
      </div>
      <div class="info-row">
        <div class="info-row-inner">
          <span class="info-row-label">Dados necessários</span>
          <div class="tags-group">
            <div class="tag">
              <div class="tag-inner">
                <i class="ph-duotone ph-identification-card"></i>
                <span>CPE</span>
              </div>
            </div>
            <div class="tag">
              <div class="tag-inner">
                <i class="ph-duotone ph-file-text"></i>
                <span>NIF</span>
              </div>
            </div>
            <div class="tag">
              <div class="tag-inner">
                <i class="ph-duotone ph-map-pin"></i>
                <span>MORADA</span>
              </div>
            </div>
            <div class="tag">
              <div class="tag-inner">
                <i class="ph-duotone ph-phone"></i>
                <span>TELEFONE</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="info-row">
        <div class="info-row-inner">
          <span class="info-row-label">Quanto tempo demora</span>
          <span class="info-row-value">4 a 5 dias</span>
        </div>
      </div>
      <div class="disclaimer-row">
        <p class="disclaimer-text">Não precisas de notificar o teu operador atual ou pagar qualquer valor. O novo operador trata do processo do início ao fim.</p>
      </div>
    </div>
  `;
  
  // Cache result for tab switching
  if (currentMode && setTabResult) {
    setTabResult(currentMode, resultHTML + infoHTML);
  }
  
  // Update result div content
  resultDiv.innerHTML = resultHTML;
  resultDiv.style.display = 'block';
  
  // Insert info section AFTER result-card-slot (matches design.html structure)
  const resultCardSlot = document.querySelector('.result-card-slot');
  if (resultCardSlot) {
    // Check if info already exists and remove it
    const existingInfo = document.querySelector('.result-card-container > .result-info');
    if (existingInfo) {
      existingInfo.remove();
    }
    // Insert info section after result-card-slot (inside result-card-container)
    resultCardSlot.insertAdjacentHTML('afterend', infoHTML);
  }
  
  // Update results subtitle based on mode
  const resultsSubtitle = document.getElementById('results-subtitle');
  if (resultsSubtitle) {
    if (isEstimate) {
      resultsSubtitle.textContent = `Estimativa feita tendo por base uma tarifa simples, uma família de 2 adultos e 1 criança, com uma potência contratada de ${power} kVA.`;
    } else {
      resultsSubtitle.textContent = `Cálculo preciso com base nos teus dados: ${consumption} kWh de consumo mensal e ${power} kVA de potência contratada.`;
    }
  }
  
  // Update input pill amount (only for estimado mode, preciso uses setInvoiceData)
  if (pillAmount && monthlyBill && getPillMode() === 'estimado') {
    pillAmount.textContent = `€${monthlyBill}`;
  }
  
  // Force browser to process DOM changes before triggering animations
  // This ensures CSS animations trigger correctly on dynamically rendered elements
  // 1. Force reflow to ensure elements are in the DOM
  void resultDiv.offsetWidth;
  
  // 2. Use double requestAnimationFrame for extra safety
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      showResults();
    });
  });
  
  // Reinitialize tooltips after rendering
  initTooltips();
  
  // Initialize provider logo fallback handlers
  initProviderLogoFallbacks();
  
  // Initialize electrical sparks animation
  initElectricalSparks();
}

/**
 * Initialize electrical sparks animation on result card
 * Creates random sparks that flash intermittently, mimicking electrical sparks
 */
function initElectricalSparks() {
  const resultCard = document.querySelector('.result-card');
  if (!resultCard) {
    console.log('No result card found for sparks');
    return;
  }
  
  // Remove existing sparks if any
  const existingSparks = resultCard.querySelectorAll('.spark');
  existingSparks.forEach(spark => spark.remove());
  
  // Function to trigger a spark flash
  function triggerSpark(spark) {
    spark.classList.remove('active');
    // Force reflow to restart animation
    void spark.offsetWidth;
    spark.classList.add('active');
    
    // Remove active class after animation
    setTimeout(() => {
      spark.classList.remove('active');
    }, 200);
  }
  
  // Trigger sparks at random intervals (mimicking electrical rhythm)
  function startSparkCycle(sparks) {
    if (!sparks || sparks.length === 0) return;
    
    sparks.forEach((spark, index) => {
      // Random delay between 0.3s and 2s for each spark
      const delay = Math.random() * 1700 + 300;
      const initialDelay = index * 100; // Stagger initial appearance
      
      setTimeout(() => {
        triggerSpark(spark);
        
        // Continue sparking at random intervals
        function scheduleNext() {
          // Random interval between 0.8s and 3s
          const nextDelay = Math.random() * 2200 + 800;
          setTimeout(() => {
            triggerSpark(spark);
            scheduleNext();
          }, nextDelay);
        }
        
        scheduleNext();
      }, initialDelay + delay);
    });
  }
  
  // Create 10-15 sparks randomly positioned around the card
  const sparkCount = Math.floor(Math.random() * 6) + 10; // 10-15 sparks
  
  // Use requestAnimationFrame to ensure card is fully rendered
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const cardRect = resultCard.getBoundingClientRect();
      const cardWidth = cardRect.width;
      const cardHeight = cardRect.height;
      
      if (cardWidth === 0 || cardHeight === 0) {
        console.log('Card dimensions not ready, retrying...');
        setTimeout(() => initElectricalSparks(), 200);
        return;
      }
      
      const sparks = [];
      
      for (let i = 0; i < sparkCount; i++) {
        const spark = document.createElement('div');
        spark.className = 'spark';
        
        // Random position around the card perimeter
        const side = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left
        
        let left, top;
        switch(side) {
          case 0: // top
            left = Math.random() * (cardWidth - 10) + 5;
            top = Math.random() * 15 + 2;
            break;
          case 1: // right
            left = cardWidth - Math.random() * 15 - 2;
            top = Math.random() * (cardHeight - 10) + 5;
            break;
          case 2: // bottom
            left = Math.random() * (cardWidth - 10) + 5;
            top = cardHeight - Math.random() * 15 - 2;
            break;
          case 3: // left
            left = Math.random() * 15 + 2;
            top = Math.random() * (cardHeight - 10) + 5;
            break;
        }
        
        spark.style.left = `${left}px`;
        spark.style.top = `${top}px`;
        
        resultCard.appendChild(spark);
        sparks.push(spark);
      }
      
      // Start spark cycle after all sparks are created
      startSparkCycle(sparks);
    });
  });
}
  
