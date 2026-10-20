/**
 * UI Renderer Module
 * Generates pixel-perfect HTML matching design.html structure
 * Uses design system classes for proper styling
 */

import { PROVIDERS } from './config.js';
import { formatPhone, toTitleCase, formatTariffName, formatShortDataMonth } from './utils.js';
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
 * Provider logo with hybrid fallback approach
 * @param {string} providerCode - Provider code
 * @param {string|null} websiteUrl - Provider website URL
 * @returns {Node[]} Logo image and fallback icon, or the fallback icon alone
 */
function createProviderIcon(providerCode, websiteUrl = null) {
  const domain = extractDomain(websiteUrl);
  const icon = document.createElement('i');
  icon.className = 'ph-duotone ph-lightning';

  // If no domain, return default icon
  if (!domain) {
    return [icon];
  }

  // Fallback URLs live in data attributes for the error handler
  const img = document.createElement('img');
  img.src = `https://logo.clearbit.com/${encodeURIComponent(domain)}`;
  img.alt = providerCode;
  img.className = 'provider-logo';
  img.dataset.favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
  img.dataset.provider = providerCode;

  icon.classList.add('provider-icon-fallback');
  icon.style.display = 'none';
  return [img, icon];
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
  
  // Every ERSE value goes in through textContent or a DOM property, never through markup
  const card = document.getElementById('result-card-template').content.cloneNode(true);
  const slot = name => card.querySelector(`[data-slot="${name}"]`);

  slot('provider-icon').append(...createProviderIcon(enrichedBest.COM, enrichedBest.website));
  slot('provider-name').textContent = providerName;
  slot('provider-plan').textContent = toTitleCase(formatTariffName(enrichedBest.tariffName || 'Tarifa Simples', enrichedBest.Contagem || 1, enrichedBest.cycleType || null));
  slot('consumption').textContent = `${consumption} kWh`;
  slot('power').textContent = `${power} kVA`;
  slot('monthly-cost').textContent = `€${enrichedBest.monthlyCost.toFixed(2)}`;

  if (formattedPhone) {
    slot('phone').querySelector('button').dataset.phone = rawPhone;
    slot('phone-text').textContent = formattedPhone;
  } else {
    slot('phone').remove();
  }

  if (enrichedBest.website) {
    const link = slot('website').querySelector('a');
    link.href = enrichedBest.website;
    link.setAttribute('aria-label', `Visitar website da ${providerName}`);
  } else {
    slot('website').remove();
  }

  // Ranked offers are always active today (isOfferEligible), so a promotion on one is current
  if (!enrichedBest.promotion) {
    slot('campaign').remove();
  }

  // Indexed prices follow the wholesale market: the cost shown uses the prices of the data date
  if (enrichedBest.isIndexed) {
    slot('indexed-date').textContent = enrichedBest.dataDate ? `valores de ${formatShortDataMonth(enrichedBest.dataDate)}` : 'varia com o mercado';
  } else {
    slot('indexed').remove();
  }

  if (savings && savings.yearly > 0) {
    slot('savings-monthly').textContent = `€${savings.monthly.toFixed(2)}/mês,`;
    slot('savings-yearly').textContent = `€${savings.yearly.toFixed(2)}/ano`;
  } else {
    slot('savings').remove();
  }

  // Estimate mode knows the bill, not the tariff behind it, so it places the best offer in the
  // market instead of claiming a saving (ADR-011 superseded); "Poupas" is for Preciso only
  if (isEstimate && typeof enrichedBest.marketMedianCost === 'number') {
    slot('market-text').textContent = `A melhor oferta custa cerca de €${Math.round(enrichedBest.monthlyCost)}/mês. Metade das ofertas custa mais de €${Math.round(enrichedBest.marketMedianCost)}/mês.`;
  } else {
    slot('market').remove();
  }

  const info = document.getElementById('result-info-template').content.firstElementChild.cloneNode(true);
  info.querySelector('[data-slot="how-to-switch"]').textContent = `Diz que queres aderir à "${toTitleCase(enrichedBest.tariffName || 'tarifa')}"`;

  // Update result div content
  resultDiv.replaceChildren(card);
  resultDiv.style.display = 'block';

  // Cache result for tab switching (serialised from the DOM above, so already escaped)
  if (currentMode && setTabResult) {
    setTabResult(currentMode, resultDiv.innerHTML + info.outerHTML);
  }

  // Insert info section AFTER result-card-slot (matches design.html structure)
  const resultCardSlot = document.querySelector('.result-card-slot');
  if (resultCardSlot) {
    // Check if info already exists and remove it
    const existingInfo = document.querySelector('.result-card-container > .result-info');
    if (existingInfo) {
      existingInfo.remove();
    }
    // Insert info section after result-card-slot (inside result-card-container)
    resultCardSlot.after(info);
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
  
