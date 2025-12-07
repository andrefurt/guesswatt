/**
 * UI Renderer Module
 * Generates pixel-perfect HTML matching design.html structure
 * Uses design system classes for proper styling
 */

import { PROVIDERS } from './config.js';
import { formatPhone } from './utils.js';
import { initTooltips } from './ui-components.js';
import { showResults, getPillMode } from './ui-handlers.js';

/**
 * Generate provider icon SVG
 * @param {string} providerCode - Provider code
 * @returns {string} SVG HTML string
 */
function getProviderIcon(providerCode) {
  // Default energy icon
  return `
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 2C10 2 4 6 4 11C4 14.5 6.5 17 10 17C13.5 17 16 14.5 16 11C16 6 10 2 10 2Z" fill="#0066CC"/>
      <path d="M10 8C10 8 7 10 7 12.5C7 14.5 8.5 16 10 16C11.5 16 13 14.5 13 12.5C13 10 10 8 10 8Z" fill="#00AAFF"/>
    </svg>
  `;
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
  
  const providerName = PROVIDERS[enrichedBest.COM] || enrichedBest.COM;
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
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 3C8 3 4.5 5.5 4.5 8.5C4.5 10.5 6 12 8 12C10 12 11.5 10.5 11.5 8.5C11.5 5.5 8 3 8 3Z" stroke="#40594c" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M8 12V14" stroke="#40594c" stroke-width="1.2" stroke-linecap="round"/>
            <path d="M6 14H10" stroke="#40594c" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
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
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10.5 9.625V11.375C10.5 11.6511 10.2761 11.875 10 11.875H4C3.72386 11.875 3.5 11.6511 3.5 11.375V9.625" stroke="#35443D" stroke-width="1.2" stroke-linecap="round"/>
              <path d="M7 2.125V8.75M7 8.75L9.625 6.125M7 8.75L4.375 6.125" stroke="#35443D" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
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
        <a href="${enrichedBest.website}" target="_blank" rel="noopener" class="btn btn-suffix" style="padding: 8px;" aria-label="Visitar website da ${providerName}">
          <span class="btn-icon">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="7" cy="7" r="5.25" stroke="#35443D" stroke-width="1.2"/>
              <path d="M2 7H12" stroke="#35443D" stroke-width="1.2"/>
              <path d="M7 1.75C8.5 3 9.25 5 9.25 7C9.25 9 8.5 11 7 12.25" stroke="#35443D" stroke-width="1.2"/>
              <path d="M7 1.75C5.5 3 4.75 5 4.75 7C4.75 9 5.5 11 7 12.25" stroke="#35443D" stroke-width="1.2"/>
            </svg>
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
          ${getProviderIcon(enrichedBest.COM)}
        </div>
        <div class="result-card-actions">
          ${phoneButtonHTML}
          ${websiteButtonHTML}
        </div>
      </div>
      <div class="result-card-info">
        <p class="provider-name">${providerName}</p>
        <p class="provider-plan">${enrichedBest.tariffName || 'Tarifa Simples'}</p>
      </div>
    </div>

    <!-- Card Data -->
    <div class="result-data">
      <div class="data-row">
        <div class="data-row-inner">
          <div class="data-row-label">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 8H14" stroke="#35443D" stroke-width="1.2" stroke-linecap="round"/>
              <path d="M5 4V12" stroke="#35443D" stroke-width="1.2" stroke-linecap="round"/>
              <path d="M11 4V12" stroke="#35443D" stroke-width="1.2" stroke-linecap="round"/>
            </svg>
            <span>Consumo estimado <span class="muted">(mês)</span></span>
          </div>
          <span class="data-row-value">${consumption} kWh</span>
        </div>
      </div>
      <div class="data-row">
        <div class="data-row-inner">
          <div class="data-row-label">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M8 2L8 14" stroke="#35443D" stroke-width="1.2" stroke-linecap="round"/>
              <path d="M5 5L8 2L11 5" stroke="#35443D" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M5 11L8 14L11 11" stroke="#35443D" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Potência</span>
          </div>
          <span class="data-row-value">${power} kVA</span>
        </div>
      </div>
      <div class="data-row">
        <div class="data-row-inner">
          <div class="data-row-label">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="2" y="4" width="12" height="9" rx="1" stroke="#35443D" stroke-width="1.2"/>
              <path d="M5 2V4" stroke="#35443D" stroke-width="1.2" stroke-linecap="round"/>
              <path d="M11 2V4" stroke="#35443D" stroke-width="1.2" stroke-linecap="round"/>
              <path d="M2 7H14" stroke="#35443D" stroke-width="1.2"/>
            </svg>
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
          <span class="info-row-value">Diz que queres aderir à "${enrichedBest.tariffName || 'tarifa'}"</span>
        </div>
      </div>
      <div class="info-row">
        <div class="info-row-inner">
          <span class="info-row-label">Dados necessários</span>
          <div class="tags-group">
            <div class="tag">
              <div class="tag-inner">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="1.5" y="2.5" width="9" height="7" rx="1" stroke="#35443D" stroke-width="1"/>
                  <path d="M4 5H8" stroke="#35443D" stroke-width="1" stroke-linecap="round"/>
                  <path d="M4 7H6" stroke="#35443D" stroke-width="1" stroke-linecap="round"/>
                </svg>
                <span>CPE</span>
              </div>
            </div>
            <div class="tag">
              <div class="tag-inner">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="2" y="1.5" width="8" height="9" rx="1" stroke="#35443D" stroke-width="1"/>
                  <path d="M4 4H8" stroke="#35443D" stroke-width="1" stroke-linecap="round"/>
                  <path d="M4 6H8" stroke="#35443D" stroke-width="1" stroke-linecap="round"/>
                  <path d="M4 8H6" stroke="#35443D" stroke-width="1" stroke-linecap="round"/>
                </svg>
                <span>NIF</span>
              </div>
            </div>
            <div class="tag">
              <div class="tag-inner">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6 10.5C6 10.5 10 7.5 10 5C10 3.067 8.209 1.5 6 1.5C3.791 1.5 2 3.067 2 5C2 7.5 6 10.5 6 10.5Z" stroke="#35443D" stroke-width="1"/>
                  <circle cx="6" cy="5" r="1.5" stroke="#35443D" stroke-width="1"/>
                </svg>
                <span>MORADA</span>
              </div>
            </div>
            <div class="tag">
              <div class="tag-inner">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M10.5 8.5V10C10.5 10.276 10.276 10.5 10 10.5H8.5C4.634 10.5 1.5 7.366 1.5 3.5V2C1.5 1.724 1.724 1.5 2 1.5H4L5 4L3.5 5C4.214 6.571 5.429 7.786 7 8.5L8 7L10.5 8.5Z" stroke="#35443D" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
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
}
