/**
 * UI Renderer Module
 * Generates pixel-perfect HTML matching design.html structure
 * Uses design system classes for proper styling
 */

import { PROVIDERS } from './config.js';
import { formatPhone, toTitleCase, formatTariffName, formatShortDataMonth, formatEuro, formatNumber } from './utils.js';
import { initTooltips } from './ui-components.js';
import { showResults, getPillMode } from './ui-handlers.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

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
 * An icon from the page's inline sprite
 * @param {string} id - Symbol id, such as 'ph-lightning-duotone'
 * @returns {SVGSVGElement}
 */
function createIcon(id) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#${id}`);
  svg.append(use);
  return svg;
}

/**
 * Provider logo with hybrid fallback approach
 * @param {string} providerCode - Provider code
 * @param {string|null} websiteUrl - Provider website URL
 * @returns {Node[]} Logo image and fallback icon, or the fallback icon alone
 */
function createProviderIcon(providerCode, websiteUrl = null) {
  const domain = extractDomain(websiteUrl);
  const icon = createIcon('ph-lightning-duotone');

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

// A saving at or below this (€/month) is not worth a switch: the result says the tariff is fine
const GOOD_TARIFF_MARGIN = 1;

/**
 * The line a result shows when it has no saving to report
 * @param {Object} best - Best offer; currentProvider is the code the person gave (Preciso)
 * @param {number|null} monthlyBill - Bill in estimate mode
 * @param {Object|null} savings - Saving against the current supplier, when it could be computed
 * @param {boolean} isEstimate
 * @returns {{text: string, chooseProvider?: boolean}|null} null when the saving speaks for itself
 */
function resultVerdict(best, monthlyBill, savings, isEstimate) {
  if (isEstimate) {
    return monthlyBill && monthlyBill <= best.monthlyCost + GOOD_TARIFF_MARGIN
      ? { text: 'Já tens uma boa tarifa. A tua fatura já está ao nível da oferta mais barata.' }
      : null;
  }
  if (savings) {
    return savings.monthly > GOOD_TARIFF_MARGIN
      ? null
      : { text: `Já tens uma boa tarifa. Nenhuma oferta te poupa mais de ${formatEuro(GOOD_TARIFF_MARGIN, 0)}/mês.` };
  }
  if (!best.currentProvider) {
    return { text: 'Escolhe o teu fornecedor para saberes quanto poupas.', chooseProvider: true };
  }
  if (best.currentProvider === 'outro') {
    return { text: 'O teu fornecedor não está nos dados da ERSE que usamos, por isso não sabemos quanto poupas.' };
  }
  const name = toTitleCase(PROVIDERS[best.currentProvider] || best.currentProvider);
  return { text: `Não encontrámos tarifas de ${name} com esta potência e este tipo de tarifa, por isso não sabemos quanto poupas.` };
}

const TARIFF_LABELS = { 1: 'tarifa simples', 2: 'tarifa bi-horária', 3: 'tarifa tri-horária' };

/**
 * Preciso subtitle: the data used, and the baseline of the saving when there is one
 * @returns {string}
 */
function preciseSubtitle(best, consumption, power, savings) {
  const data = `Com os teus dados: ${formatNumber(consumption)} kWh por mês, ${formatNumber(power)} kVA, ${TARIFF_LABELS[best.Contagem] || TARIFF_LABELS[1]}.`;
  if (!savings || !best.currentProvider) return data;
  const name = toTitleCase(PROVIDERS[best.currentProvider] || best.currentProvider);
  return `${data} A poupança compara com a oferta mais barata do teu fornecedor (${name}) para este perfil.`;
}

/**
 * Render calculation result with design system structure
 * @param {Object} enrichedBest - Enriched best offer object
 * @param {number} consumption - Consumption in kWh
 * @param {number} power - Power in kVA
 * @param {number|null} monthlyBill - Monthly bill amount (for estimate mode)
 * @param {Object|null} savings - Savings object with monthly/yearly properties
 * @param {boolean} isEstimate - Whether this is estimate mode
 */
export function renderResult(enrichedBest, consumption, power, monthlyBill = null, savings = null, isEstimate = false) {
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
  // Preciso uses the person's own consumption, so it is not an estimate there
  slot('consumption-label').textContent = isEstimate ? 'Consumo estimado' : 'Consumo';
  slot('consumption').textContent = `${formatNumber(consumption)} kWh`;
  slot('power').textContent = `${formatNumber(power)} kVA`;
  slot('monthly-cost').textContent = formatEuro(enrichedBest.monthlyCost);

  if (formattedPhone) {
    // A call, not a copy: on a phone it dials (PT numbers, +351)
    slot('phone').querySelector('a').href = `tel:${rawPhone.length === 9 ? '+351' : ''}${rawPhone}`;
    slot('phone-text').textContent = formattedPhone;
  } else {
    slot('phone').remove();
  }

  if (enrichedBest.website) {
    const link = slot('website').querySelector('a');
    link.href = enrichedBest.website;
    // Named by where it goes: ERSE's link is the offer's page, sometimes a PDF
    const isPDF = /\.pdf($|[?#])/i.test(enrichedBest.website);
    link.setAttribute('aria-label', `Ver a oferta no site do fornecedor${isPDF ? ' (PDF)' : ''}, abre numa nova janela`);
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

  if (savings && savings.monthly > GOOD_TARIFF_MARGIN) {
    slot('savings-monthly').textContent = `${formatEuro(savings.monthly)}/mês,`;
    slot('savings-yearly').textContent = `${formatEuro(savings.yearly)}/ano`;
  } else {
    slot('savings').remove();
  }

  // When there is no saving to show, say why instead of leaving the card silent
  const verdict = resultVerdict(enrichedBest, monthlyBill, savings, isEstimate);
  if (verdict && isEstimate) {
    // Estimate mode already has a market box: the verdict leads it instead of a second box
    const line = document.createElement('p');
    line.textContent = verdict.text;
    slot('market-text').before(line);
    slot('verdict').remove();
  } else if (verdict) {
    slot('verdict-text').textContent = verdict.text;
    const choose = slot('choose-provider');
    if (verdict.chooseProvider) {
      // The way back to the form keeps what was entered (main.js)
      Object.assign(choose.dataset, { consumption: consumption, power: power, tariff: enrichedBest.Contagem || 1 });
    } else {
      choose.remove();
    }
  } else {
    slot('verdict').remove();
  }

  // Estimate mode knows the bill, not the tariff behind it, so it places the best offer in the
  // market instead of claiming a saving (ADR-011 superseded); "Poupas" is for Preciso only
  if (isEstimate && typeof enrichedBest.marketMedianCost === 'number') {
    slot('market-text').textContent = `A melhor oferta custa cerca de ${formatEuro(enrichedBest.monthlyCost, 0)}/mês. Metade das ofertas custa mais de ${formatEuro(enrichedBest.marketMedianCost, 0)}/mês.`;
  } else {
    slot('market').remove();
  }

  const info = document.getElementById('result-info-template').content.firstElementChild.cloneNode(true);
  info.querySelector('[data-slot="how-to-switch"]').textContent = `Liga ou entra no site e pede a oferta "${toTitleCase(enrichedBest.tariffName || 'tarifa')}"`;

  // Update result div content
  resultDiv.replaceChildren(card);
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
    resultCardSlot.after(info);
  }
  
  // The subtitle says what the result rests on: the assumptions in estimate mode, and in Preciso the
  // data and what the saving is measured against
  const resultsSubtitle = document.getElementById('results-subtitle');
  if (resultsSubtitle) {
    resultsSubtitle.textContent = isEstimate
      ? `Estimativa a partir de uma fatura de ${formatEuro(monthlyBill, Number.isInteger(monthlyBill) ? 0 : 2)}: tarifa simples, ${formatNumber(power)} kVA e o consumo que esse valor paga numa oferta típica.`
      : preciseSubtitle(enrichedBest, consumption, power, savings);
  }
  
  // Update input pill amount (only for estimado mode, preciso uses setInvoiceData)
  if (pillAmount && monthlyBill && getPillMode() === 'estimado') {
    pillAmount.textContent = formatEuro(monthlyBill, Number.isInteger(monthlyBill) ? 0 : 2);
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
}
