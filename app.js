// =============================================================================
// CONSTANTS
// =============================================================================

const VAT = 1.23;
const DAYS_PER_MONTH = 30;
const DEFAULT_POWER = 4.6; // kVA mais comum
const AUDIOVISUAL_TAX = 2.85; // €/mês

const PROVIDERS = {
  'EDPSU': 'SU Eletricidade',
  'EDPC': 'EDP Comercial', 
  'END': 'Endesa',
  'GALP': 'Galp',
  'GOLD': 'Goldenergy',
  'IBER': 'Iberdrola',
  'MEO': 'MEO Energia',
  'REPSOL': 'Repsol',
  'ACCIONA': 'Acciona',
  'ENAT': 'Energia Naturalis',
  'LUZBOA': 'Luzboa',
  'MUON': 'Muon',
  'PLEN': 'Plenitude',
  'AQUILA': 'Aquila',
  'COOPERNICO': 'Coopérnico',
  'YLCE': 'Ylce'
};

// =============================================================================
// TOOLTIP COMPONENT
// =============================================================================

const tooltipContent = {
  'kwh': 'Unidade de energia. 1 kWh = um aparelho de 1000W ligado durante 1 hora.',
  'kva': 'A potência máxima que podes usar ao mesmo tempo. Se ligares muitos aparelhos, o quadro dispara.',
  'tarifa-simples': 'Preço único a qualquer hora do dia.',
  'tarifa-bihoraria': 'Dois preços: mais barato à noite (22h-8h), mais caro de dia.',
  'tarifa-trihoraria': 'Três preços: vazio (noite), cheias (dia), ponta (mais caro, horas de pico).',
  'cpe': 'Código de Ponto de Entrega. Identifica o teu contador. Está na factura, normalmente no canto superior.',
  'consumo-mensal': 'Quantidade de energia que gastas por mês, medida em kWh.',
  'termo-fixo': 'Valor que pagas por dia, independentemente do consumo.',
  'termo-variavel': 'Preço por cada kWh que consomes.',
  'potencia-contratada': 'A "largura do cano" da tua instalação. Mais potência = mais aparelhos em simultâneo.'
};

let tooltipEl = null;
let activeTrigger = null;
let tooltipTimeout = null;

function createTooltip() {
  if (tooltipEl) return tooltipEl;
  
  tooltipEl = document.createElement('div');
  tooltipEl.className = 'tooltip';
  tooltipEl.setAttribute('role', 'tooltip');
  tooltipEl.hidden = true;
  document.body.appendChild(tooltipEl);
  return tooltipEl;
}

function showTooltip(trigger) {
  const key = trigger.dataset.tooltip;
  const content = tooltipContent[key];
  
  if (!content) return;
  
  createTooltip();
  tooltipEl.textContent = content;
  tooltipEl.hidden = false;
  
  // Position tooltip
  const rect = trigger.getBoundingClientRect();
  const tooltipRect = tooltipEl.getBoundingClientRect();
  const padding = 8;
  
  let top = rect.top - tooltipRect.height - padding;
  let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
  
  // If would overflow top, position below
  if (top < padding) {
    top = rect.bottom + padding;
  }
  
  // Constrain horizontally
  const maxLeft = window.innerWidth - tooltipRect.width - padding;
  left = Math.max(padding, Math.min(left, maxLeft));
  
  tooltipEl.style.top = `${top + window.scrollY}px`;
  tooltipEl.style.left = `${left}px`;
  tooltipEl.classList.add('is-visible');
  
  activeTrigger = trigger;
}

function hideTooltip() {
  if (tooltipEl) {
    tooltipEl.classList.remove('is-visible');
    tooltipEl.hidden = true;
  }
  activeTrigger = null;
  if (tooltipTimeout) {
    clearTimeout(tooltipTimeout);
    tooltipTimeout = null;
  }
}

function initTooltips() {
  createTooltip();
  
  // Handle hover (desktop)
  document.addEventListener('mouseover', (e) => {
    const trigger = e.target.closest('.tooltip-trigger');
    if (trigger && trigger.dataset.tooltip) {
      clearTimeout(tooltipTimeout);
      tooltipTimeout = setTimeout(() => showTooltip(trigger), 300);
    } else if (!e.target.closest('.tooltip')) {
      hideTooltip();
    }
  });
  
  document.addEventListener('mouseout', (e) => {
    if (!e.target.closest('.tooltip-trigger')) {
      hideTooltip();
    }
  });
  
  // Handle click (mobile)
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.tooltip-trigger');
    if (trigger && trigger.dataset.tooltip) {
      e.preventDefault();
      if (activeTrigger === trigger) {
        hideTooltip();
      } else {
        showTooltip(trigger);
      }
    } else if (!e.target.closest('.tooltip')) {
      hideTooltip();
    }
  });
  
  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideTooltip();
    }
  });
}

// =============================================================================
// CSV PARSING
// =============================================================================

function parseCSV(text) {
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

async function loadCSV(url) {
  const response = await fetch(url);
  const text = await response.text();
  return parseCSV(text);
}

// =============================================================================
// CONSUMPTION ESTIMATION
// =============================================================================

function estimateConsumption(monthlyBill) {
  // Fórmula inversa: dado o valor da factura, estimar kWh
  // monthlyBill = (fixedTerm + variableTerm + taxes) * VAT
  // Assumindo valores médios, resolver para consumo
  
  const withoutVAT = monthlyBill / VAT;
  const withoutFixed = withoutVAT - (0.25 * DAYS_PER_MONTH) - AUDIOVISUAL_TAX;
  const consumption = withoutFixed / 0.16; // preço médio €/kWh
  
  return Math.max(50, Math.round(consumption)); // mínimo 50 kWh
}

// =============================================================================
// COST CALCULATION
// =============================================================================

function calculateMonthlyCost(offer, consumption, power) {
  // O CSV tem "TV|TVFV|TVP" como nome do campo, mas quando parseado vira "TV|TVFV|TVP"
  // Para tarifa simples (Contagem=1), usar o primeiro valor deste campo
  const tvField = offer['TV|TVFV|TVP'] || offer.TV || 0;
  const fixedTerm = (offer.TF || 0) * DAYS_PER_MONTH;
  const variableTerm = consumption * tvField;
  const subtotal = fixedTerm + variableTerm + AUDIOVISUAL_TAX;
  return subtotal * VAT;
}

// =============================================================================
// OFFER FILTERING & SELECTION
// =============================================================================

function findBestOffer(offers, consumption, power) {
  // Filtrar ofertas válidas
  const valid = offers.filter(o => {
    const tvField = o['TV|TVFV|TVP'] || o.TV || 0;
    const potCont = typeof o.Pot_Cont === 'number' ? o.Pot_Cont : parseFloat(String(o.Pot_Cont || '').replace(',', '.'));
    return o.TF > 0 && 
           tvField > 0 && 
           potCont === power &&
           o.Contagem === 1; // tarifa simples
  });
  
  if (valid.length === 0) {
    throw new Error('Nenhuma oferta válida encontrada');
  }
  
  // Calcular custo para cada uma
  const withCosts = valid.map(o => ({
    ...o,
    monthlyCost: calculateMonthlyCost(o, consumption, power)
  }));
  
  // Filtrar ofertas com custo válido
  const withValidCosts = withCosts.filter(o => 
    o.monthlyCost > 0 && !isNaN(o.monthlyCost)
  );
  
  if (withValidCosts.length === 0) {
    throw new Error('Nenhuma oferta com custo válido encontrada');
  }
  
  // Ordenar por custo (mais barato primeiro)
  withValidCosts.sort((a, b) => a.monthlyCost - b.monthlyCost);
  
  return withValidCosts[0]; // melhor oferta
}

// =============================================================================
// OFFER ENRICHMENT
// =============================================================================

function enrichOffer(offer, conditions) {
  const condition = conditions.find(c => 
    c.COM === offer.COM && 
    c.COD_Proposta === offer.COD_Proposta
  );
  
  return {
    ...offer,
    tariffName: condition?.NomeProposta || offer.COD_Proposta,
    phone: condition?.ContactoComercialTel || null,
    website: condition?.LinkOfertaCom || condition?.LinkCOM || null
  };
}

function formatPhone(phone) {
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

// =============================================================================
// TAB MANAGEMENT
// =============================================================================

// Guardar resultados por tab
const tabResults = {
  estimate: null,
  precise: null
};

let currentMode = 'estimate';

function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  const forms = document.querySelectorAll('.mode-form');
  const resultDiv = document.getElementById('result');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const mode = tab.dataset.mode;
      currentMode = mode;
      
      // Update tab active state
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Show/hide forms
      forms.forEach(form => {
        form.classList.remove('active');
      });
      
      if (mode === 'estimate') {
        document.getElementById('estimate-form').classList.add('active');
      } else if (mode === 'precise') {
        document.getElementById('precise-mode').classList.add('active');
      }
      
      // Mostrar/esconder resultado da tab atual
      if (tabResults[mode]) {
        resultDiv.innerHTML = tabResults[mode];
        resultDiv.style.display = 'block';
      } else {
        resultDiv.innerHTML = '';
        resultDiv.style.display = 'none';
      }
    });
  });
}

// =============================================================================
// PROVIDERS DROPDOWN
// =============================================================================

function populateProvidersDropdown() {
  const providerSelect = document.getElementById('current-provider');
  if (!providerSelect) return;
  
  Object.entries(PROVIDERS).forEach(([code, name]) => {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = name;
    providerSelect.appendChild(option);
  });
}

// =============================================================================
// OFFER FILTERING & SELECTION (Extended for tariff types)
// =============================================================================

function findBestOfferForTariff(offers, consumption, power, tariffType = 1) {
  // Filtrar ofertas válidas
  const valid = offers.filter(o => {
    const tvField = o['TV|TVFV|TVP'] || o.TV || 0;
    const potCont = typeof o.Pot_Cont === 'number' ? o.Pot_Cont : parseFloat(String(o.Pot_Cont || '').replace(',', '.'));
    return o.TF > 0 && 
           tvField > 0 && 
           potCont === power &&
           o.Contagem === tariffType; // usar tipo de tarifa fornecido
  });
  
  if (valid.length === 0) {
    throw new Error('Nenhuma oferta válida encontrada');
  }
  
  // Calcular custo para cada uma
  const withCosts = valid.map(o => ({
    ...o,
    monthlyCost: calculateMonthlyCost(o, consumption, power)
  }));
  
  // Filtrar ofertas com custo válido
  const withValidCosts = withCosts.filter(o => 
    o.monthlyCost > 0 && !isNaN(o.monthlyCost)
  );
  
  if (withValidCosts.length === 0) {
    throw new Error('Nenhuma oferta com custo válido encontrada');
  }
  
  // Ordenar por custo (mais barato primeiro)
  withValidCosts.sort((a, b) => a.monthlyCost - b.monthlyCost);
  
  return withValidCosts[0]; // melhor oferta
}

// =============================================================================
// RESULT RENDERING (Shared function)
// =============================================================================

function renderResult(enrichedBest, consumption, power, monthlyBill = null, savings = null, isEstimate = false) {
  const resultDiv = document.getElementById('result');
  const debugDiv = document.getElementById('debug');
  
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
    <p><strong>Consumo estimado:</strong> ${consumption} kWh<span class="tooltip-trigger" data-tooltip="kwh">ⓘ</span>/mês</p>
    <p><strong>Potência:</strong> ${power} kVA<span class="tooltip-trigger" data-tooltip="kva">ⓘ</span></p>
  ` : '';
  
  // Guia de mudança (sempre presente quando há resultado)
  const switchGuideHtml = `
    <div class="switch-guide">
      <h4>Como mudar para ${providerName}</h4>
      <p>Diz que queres aderir à "${enrichedBest.tariffName}"</p>
      <p>Vão pedir-te:</p>
      <ul>
        <li>CPE<span class="tooltip-trigger" data-tooltip="cpe">ⓘ</span> (está na tua factura)</li>
        <li>NIF</li>
        <li>Morada</li>
        <li>Telefone ou email</li>
      </ul>
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
    <h2>Resultado</h2>
    ${consumptionHtml}
    <h3>${providerName}</h3>
    <p>${enrichedBest.tariffName}</p>
    <p><strong>Custo mensal:</strong> €${enrichedBest.monthlyCost.toFixed(2)}</p>
    ${displaySavings ? `<p><strong>Poupança:</strong> €${displaySavings.monthly.toFixed(2)}/mês · €${displaySavings.yearly.toFixed(2)}/ano${savings?.vsProvider ? ` vs ${savings.vsProvider}` : ''}</p>` : ''}
    ${formattedPhone ? `<p><strong>Telefone:</strong> <a href="tel:${String(enrichedBest.phone || '').replace(/\D/g, '')}">${formattedPhone}</a></p>` : ''}
    ${enrichedBest.website ? `<p><a href="${enrichedBest.website}" target="_blank" rel="noopener">Ver oferta no site →</a></p>` : ''}
    ${contextHtml}
    ${switchGuideHtml}
  `;
  
  // Guardar resultado na tab atual
  tabResults[currentMode] = resultHTML;
  
  // Mostrar resultado
  resultDiv.innerHTML = resultHTML;
  resultDiv.style.display = 'block';
  
  // Reinicializar tooltips após renderizar resultado
  initTooltips();
  
  // Debug info
  debugDiv.innerHTML = `
    <details>
      <summary>Debug</summary>
      <pre>${JSON.stringify({ consumption, power, best: enrichedBest, savings: displaySavings }, null, 2)}</pre>
    </details>
  `;
}

// =============================================================================
// FORM HANDLERS
// =============================================================================

// Handler para modo Estimativa (mantém código existente)
async function handleEstimateSubmit(e) {
  e.preventDefault();
  
  const monthlyBill = parseFloat(document.getElementById('monthly-bill').value);
  const resultDiv = document.getElementById('result');
  const debugDiv = document.getElementById('debug');
  
  resultDiv.innerHTML = '<p>A calcular...</p>';
  debugDiv.innerHTML = '';
  
  try {
    // 1. Estimar consumo
    const consumption = estimateConsumption(monthlyBill);
    
    // 2. Carregar dados
    const prices = await loadCSV('data/Precos_ELEGN.csv');
    const conditions = await loadCSV('data/CondComerciais.csv');
    
    // 3. Encontrar melhor oferta
    const best = findBestOffer(prices, consumption, DEFAULT_POWER);
    
    // 4. Enriquecer com nome da tarifa
    const enrichedBest = enrichOffer(best, conditions);
    
    // 5. Renderizar resultado (usa monthlyBill para calcular poupança)
    renderResult(enrichedBest, consumption, DEFAULT_POWER, monthlyBill, null, true);
    
  } catch (error) {
    resultDiv.innerHTML = `<p class="error">Erro: ${error.message}</p>`;
    console.error(error);
  }
}

// Handler para modo Preciso (nova função)
async function handlePreciseSubmit(e) {
  e.preventDefault();
  
  const consumption = parseFloat(document.getElementById('consumption').value);
  const power = parseFloat(document.getElementById('power').value);
  const tariffType = parseInt(document.getElementById('tariff-type').value);
  const currentProvider = document.getElementById('current-provider').value;
  
  const resultDiv = document.getElementById('result');
  const debugDiv = document.getElementById('debug');
  
  resultDiv.innerHTML = '<p>A calcular...</p>';
  debugDiv.innerHTML = '';
  
  try {
    // 1. Validar inputs
    if (!consumption || consumption <= 0) {
      throw new Error('Introduz um consumo válido');
    }
    
    // 2. Carregar dados
    const prices = await loadCSV('data/Precos_ELEGN.csv');
    const conditions = await loadCSV('data/CondComerciais.csv');
    
    // 3. Encontrar melhor oferta (usando tipo de tarifa)
    const best = findBestOfferForTariff(prices, consumption, power, tariffType);
    
    // 4. Enriquecer com nome da tarifa
    const enrichedBest = enrichOffer(best, conditions);
    
    // 5. Calcular poupança se houver operador actual
    let savings = null;
    if (currentProvider) {
      // Encontrar ofertas do operador actual com mesma potência e tarifa
      const currentProviderOffers = prices.filter(o => {
        const tvField = o['TV|TVFV|TVP'] || o.TV || 0;
        const potCont = typeof o.Pot_Cont === 'number' ? o.Pot_Cont : parseFloat(String(o.Pot_Cont || '').replace(',', '.'));
        return o.COM === currentProvider && 
               o.TF > 0 &&
               tvField > 0 &&
               potCont === power &&
               o.Contagem === tariffType;
      });
      
      if (currentProviderOffers.length > 0) {
        // Calcular custo com a melhor oferta do operador actual
        const currentProviderCosts = currentProviderOffers.map(offer => ({
          ...offer,
          monthlyCost: calculateMonthlyCost(offer, consumption, power)
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
            vsProvider: PROVIDERS[currentProvider] || currentProvider
          };
        }
      }
    }
    
    // 6. Renderizar resultado (isEstimate: false para modo Preciso)
    renderResult(enrichedBest, consumption, power, null, savings, false);
    
  } catch (error) {
    resultDiv.innerHTML = `<p class="error">Erro: ${error.message}</p>`;
    console.error(error);
  }
}

// =============================================================================
// PDF UPLOAD & PROCESSING
// =============================================================================

let pdfData = null;
let manualFormVisible = false;

function loadPDFJS() {
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

async function extractPDFData(file) {
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

function parseInvoiceText(text) {
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

function showPDFLoading() {
  const emptyState = document.getElementById('pdf-empty');
  emptyState.innerHTML = '<p>A processar PDF...</p>';
}

function showPDFData(data) {
  const uploadBox = document.getElementById('pdf-upload-box');
  const emptyState = document.getElementById('pdf-empty');
  const loadedState = document.getElementById('pdf-loaded');
  const dataContainer = document.getElementById('pdf-extracted-data');
  const toggleManual = document.getElementById('toggle-manual');
  const preciseForm = document.getElementById('precise-form');
  
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
  toggleManual.style.display = 'none';
  preciseForm.style.display = 'none';
  manualFormVisible = false;
  
  // Calcular automaticamente após mostrar dados
  calculateFromPDF();
}

function clearPDF() {
  const uploadBox = document.getElementById('pdf-upload-box');
  const emptyState = document.getElementById('pdf-empty');
  const loadedState = document.getElementById('pdf-loaded');
  const toggleManual = document.getElementById('toggle-manual');
  const pdfInput = document.getElementById('pdf-input');
  
  // Reset estado
  pdfData = null;
  pdfInput.value = '';
  
  // Restaurar UI
  emptyState.style.display = 'flex';
  emptyState.innerHTML = `
    <span class="pdf-icon">📄</span>
    <p>Arrasta a tua factura PDF</p>
    <p class="pdf-hint">ou clica para seleccionar</p>
  `;
  loadedState.style.display = 'none';
  uploadBox.classList.remove('has-file');
  
  // Mostrar link manual
  toggleManual.style.display = 'block';
  toggleManual.textContent = 'Introduzir dados manualmente';
  
  // Esconder resultado quando PDF é removido
  const resultDiv = document.getElementById('result');
  if (resultDiv) {
    resultDiv.style.display = 'none';
    resultDiv.innerHTML = '';
  }
  
  // Limpar resultado da tab
  tabResults.precise = null;
}

async function handlePDFFile(file) {
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
      showPDFData(extracted);
    } else {
      alert('Não foi possível extrair dados desta factura. Tenta introduzir manualmente.');
      clearPDF();
    }
  } catch (error) {
    console.error('Erro ao processar PDF:', error);
    alert('Erro ao processar o PDF. Tenta introduzir manualmente.');
    clearPDF();
  }
}

async function calculateFromPDF() {
  if (!pdfData) return;
  
  try {
    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = '<p>A calcular...</p>';
    resultDiv.style.display = 'block';
    
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
    renderResult(enrichedBest, pdfData.consumption, pdfData.power, null, savings, false);
    
  } catch (error) {
    console.error('Erro ao calcular:', error);
    alert('Erro ao calcular. Tenta novamente.');
  }
}

function initPDFUpload() {
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
      handlePDFFile(e.dataTransfer.files[0]);
    }
  });
  
  // File input change
  pdfInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
      handlePDFFile(e.target.files[0]);
    }
  });
  
  // Toggle manual form
  if (toggleManual) {
    toggleManual.addEventListener('click', () => {
      manualFormVisible = !manualFormVisible;
      if (preciseForm) {
        preciseForm.style.display = manualFormVisible ? 'block' : 'none';
      }
      toggleManual.textContent = manualFormVisible 
        ? 'Esconder formulário' 
        : 'Introduzir dados manualmente';
    });
  }
  
  // Remove PDF
  if (pdfRemove) {
    pdfRemove.addEventListener('click', (e) => {
      e.stopPropagation();
      clearPDF();
    });
  }
}

// =============================================================================
// INITIALIZATION
// =============================================================================

function init() {
  // Popular dropdown de operadores
  populateProvidersDropdown();
  
  // Esconder resultado inicialmente
  const resultDiv = document.getElementById('result');
  if (resultDiv) {
    resultDiv.style.display = 'none';
  }
  
  // Inicializar tabs
  initTabs();
  
  // Inicializar PDF upload
  initPDFUpload();
  
  // Inicializar tooltips
  initTooltips();
  
  // Attach form handlers
  const estimateForm = document.getElementById('estimate-form');
  const preciseForm = document.getElementById('precise-form');
  
  if (estimateForm) {
    estimateForm.addEventListener('submit', handleEstimateSubmit);
  }
  
  if (preciseForm) {
    preciseForm.addEventListener('submit', handlePreciseSubmit);
  }
}

// Setup quando DOM estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  // DOM já está pronto
  init();
}

