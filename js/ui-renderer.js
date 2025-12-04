/**
 * UI Renderer Module
 * Functions that generate HTML strings for results and UI components
 */

import { PROVIDERS } from './config.js';
import { formatPhone } from './utils.js';
import { initTooltips } from './ui-components.js';

/**
 * Render calculation result
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
  if (!resultDiv) return;
  
  const providerName = PROVIDERS[enrichedBest.COM] || enrichedBest.COM;
  const formattedPhone = formatPhone(enrichedBest.phone);
  
  // Calcular poupança para modo Estimativa (quando monthlyBill é fornecido)
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
  
  // Usar savings do modo Preciso se disponível, senão usar estimateSavings
  const displaySavings = savings || estimateSavings;
  
  // Secção de contexto para modo Estimativa
  const contextHtml = isEstimate ? `
    <div class="estimate-context">
      <p><strong>💡 Estimativa baseada em:</strong></p>
      <ul>
        <li>Perfil típico: família com 2 adultos e 1 criança</li>
        <li>Potência: 4.6 kVA<span class="tooltip-trigger" data-tooltip="kva">ⓘ</span> (a mais comum em Portugal)</li>
        <li>Tarifa: Simples<span class="tooltip-trigger" data-tooltip="tarifa-simples">ⓘ</span> (preço único todo o dia)</li>
        <li>Consumo estimado a partir do valor da tua fatura</li>
      </ul>
      <p class="context-hint">Para um cálculo mais preciso, usa a tab "Preciso".</p>
    </div>
  ` : '';
  
  // Só mostrar consumo e potência no modo Estimativa (no Preciso já estão no formulário)
  const consumptionHtml = isEstimate ? `
            <tr>
              <td>Consumo estimado</td>
              <td>${consumption} kWh<span class="tooltip-trigger" data-tooltip="kwh">ⓘ</span>/mês</td>
            </tr>
            <tr>
              <td>Potência</td>
              <td>${power} kVA<span class="tooltip-trigger" data-tooltip="kva">ⓘ</span></td>
            </tr>
            ` : '';
  
  // Proposal card structure
  const proposalCardHTML = `
    <article aria-label="Proposta de tarifa">
      <header>
        <div>
          <span>${providerName}</span>
        </div>
        <div>
          ${formattedPhone ? `<button type="button" class="copy-phone-btn" data-phone="${String(enrichedBest.phone || '').replace(/\D/g, '')}">Copiar telefone</button>` : ''}
          ${enrichedBest.website ? `<a href="${enrichedBest.website}" target="_blank" rel="noopener" aria-label="Abrir website da ${providerName}">🌐</a>` : ''}
        </div>
      </header>
      
      <div>
        <table>
          <tbody>
            <tr>
              <td>Tarifa</td>
              <td>${enrichedBest.tariffName}</td>
            </tr>
            <tr>
              <td>Custo mensal</td>
              <td>€${enrichedBest.monthlyCost.toFixed(2)}</td>
            </tr>
            ${consumptionHtml}
          </tbody>
        </table>
      </div>
      
      ${displaySavings ? `
      <div role="status">
        <span>💰</span>
        <p>Poupas €${displaySavings.monthly.toFixed(2)} por mês e €${displaySavings.yearly.toFixed(2)} por ano${savings?.vsProvider ? ` vs ${savings.vsProvider}` : ''}</p>
      </div>
      ` : ''}
    </article>
  `;
  
  // How to change info block
  const howToChangeHTML = `
    <div>
      <h3>Como mudar para ${providerName}</h3>
      <table>
        <tbody>
          <tr>
            <td>Diz que queres aderir à</td>
            <td>"${enrichedBest.tariffName}"</td>
          </tr>
          <tr>
            <td>Vão pedir-te</td>
            <td>
              <ul>
                <li>CPE<span class="tooltip-trigger" data-tooltip="cpe">ⓘ</span> (está na tua factura)</li>
                <li>NIF</li>
                <li>Morada</li>
                <li>Telefone ou email</li>
              </ul>
            </td>
          </tr>
        </tbody>
      </table>
      <p>Eles tratam do resto. Demora cerca de uma semana.</p>
      <p><strong>Não precisas de:</strong></p>
      <ul>
        <li>Avisar o fornecedor actual</li>
        <li>Mudar nada físico</li>
        <li>Pagar nada</li>
      </ul>
    </div>
  `;
  
  const resultHTML = `
    <section aria-labelledby="result-title">
      <h2 id="result-title">Resultado</h2>
      ${contextHtml}
      ${proposalCardHTML}
      ${howToChangeHTML}
    </section>
  `;
  
  // Guardar resultado na tab atual (via callback)
  if (currentMode && setTabResult) {
    setTabResult(currentMode, resultHTML);
  }
  
  // Mostrar resultado
  resultDiv.innerHTML = resultHTML;
  resultDiv.style.display = 'block';
  
  // Reinicializar tooltips após renderizar resultado
  initTooltips();
}

