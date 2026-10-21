/**
 * Build Offers JSON
 * 
 * Reads Precos_ELEGN.csv and CondComerciais.csv, joins them,
 * normalizes data, and outputs offers.json for runtime use.
 * 
 * Usage:
 *   node scripts/build-offers.js
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PRECOS_PATH = path.join(DATA_DIR, 'Precos_ELEGN.csv');
const COND_PATH = path.join(DATA_DIR, 'CondComerciais.csv');
const OUTPUT_PATH = path.join(DATA_DIR, 'offers.json');
const META_PATH = path.join(DATA_DIR, 'meta.json');

/**
 * Parse CSV text into array of objects
 */
function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV file has no data rows');
  }
  
  const headers = lines[0].split(';').map(h => h.trim());
  
  return lines.slice(1).map(line => {
    const values = line.split(';');
    const obj = {};
    
    headers.forEach((header, i) => {
      let value = values[i]?.trim() || '';
      
      // Convert numbers (comma to dot)
      if (value !== '' && /^-?\d+[,.]\d+/.test(value)) {
        value = parseFloat(value.replace(',', '.'));
      } else if (value !== '' && /^-?\d+$/.test(value)) {
        value = parseFloat(value);
      }
      
      obj[header] = value;
    });
    
    return obj;
  });
}

/**
 * Normalize number field (handles comma decimals, strings, etc.)
 */
function normalizeNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(',', '.').trim();
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/**
 * Number field that may be empty: null when empty, the number otherwise
 */
function optionalNumber(value) {
  if (normalizeString(value) === '') return null;
  return normalizeNumber(value);
}

/**
 * Normalize string field (trim, handle empty)
 */
function normalizeString(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/**
 * ERSE free text shown on the page: drops the characters that could break out of markup
 * (< > ") and control characters. The page renders with textContent; this is the second layer.
 */
function safeText(value) {
  return normalizeString(value).replace(/[<>"\u0000-\u001f\u007f]/g, '');
}

/**
 * ERSE link shown on the page: the first value that parses as an http or https URL, else ''.
 * Some LinkOfertaCom cells hold plain text, so the supplier's LinkCOM is the fallback.
 */
function safeUrl(...values) {
  for (const value of values) {
    const text = normalizeString(value);
    if (!text) continue;
    try {
      const url = new URL(text);
      if ((url.protocol === 'https:' || url.protocol === 'http:') && !/[<>"\s]/.test(text)) {
        return text;
      }
    } catch (e) {
      // Not a URL: try the next value
    }
  }
  return '';
}

/**
 * Normalize text for token matching (lowercase, remove accents)
 */
function normalizeTextForTokens(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove accents
}

/**
 * Discover promotion-related fields in CSV data
 * Returns: { promotionFieldHits: Array, samplePromotionSnippets: Array, lockInSamples: Array }
 */
function discoverPromotionFields(conditions) {
  const PROMOTION_TOKENS = [
    'desconto', '€', 'euros', 'mês', 'meses', '/mês', 'por mês', 'ano', '1 ano', 
    '12 meses', 'fatura', 'campanha', 'bónus', 'bonus', 'voucher', 'cartão', 
    'cartao', 'cashback', 'reembolso', 'mensal'
  ];
  
  // Track hits per column
  const columnHits = new Map();
  const columnSamples = new Map();
  
  // Analyze each condition row
  conditions.forEach(condition => {
    // Check all string-like columns
    Object.keys(condition).forEach(columnName => {
      const value = condition[columnName];
      if (typeof value === 'string' && value.trim().length > 0) {
        const normalized = normalizeTextForTokens(value);
        
        // Count token matches
        let hitCount = 0;
        PROMOTION_TOKENS.forEach(token => {
          const normalizedToken = normalizeTextForTokens(token);
          if (normalized.includes(normalizedToken)) {
            hitCount++;
          }
        });
        
        if (hitCount > 0) {
          if (!columnHits.has(columnName)) {
            columnHits.set(columnName, 0);
            columnSamples.set(columnName, []);
          }
          columnHits.set(columnName, columnHits.get(columnName) + hitCount);
          
          // Store sample (max 5 per column)
          if (columnSamples.get(columnName).length < 5) {
            const snippet = value.substring(0, 160).replace(/\s+/g, ' ').trim();
            columnSamples.get(columnName).push({
              COM: condition.COM || '',
              COD_Proposta: condition.COD_Proposta || '',
              snippet: snippet
            });
          }
        }
      }
    });
  });
  
  // Sort by hit count (descending)
  const sortedColumns = Array.from(columnHits.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15); // Top 15
  
  const promotionFieldHits = sortedColumns.map(([columnName, hits]) => ({
    column: columnName,
    hits: hits
  }));
  
  // Build sample snippets (max 25 total)
  const samplePromotionSnippets = [];
  for (const [columnName, hits] of sortedColumns.slice(0, 10)) {
    const samples = columnSamples.get(columnName) || [];
    for (const sample of samples) {
      if (samplePromotionSnippets.length >= 25) break;
      samplePromotionSnippets.push({
        ...sample,
        columnName: columnName
      });
    }
    if (samplePromotionSnippets.length >= 25) break;
  }
  
  // Collect lock-in samples (max 20) and track breakdown by source
  const lockInSamples = [];
  const lockInBySource = { field: 0, text: 0 };
  
  conditions.forEach(condition => {
    if (lockInSamples.length >= 20) return;
    
    const lockInFlag = normalizeString(condition.FiltroFidelização || '');
    if (lockInFlag === 'S' || lockInFlag === 'N') {
      const lockIn = detectLockIn(condition);
      if (lockIn.hasLockIn) {
        // Track source breakdown
        if (lockIn.lockInSource === 'field') {
          lockInBySource.field++;
        } else if (lockIn.lockInSource === 'text') {
          lockInBySource.text++;
        }
        
        const textFields = [
          condition.TxTFidelização || '',
          condition.TxTOferta || '',
          condition.TxTRestricoesAdic || ''
        ].join(' ').trim();
        
        const snippet = textFields.substring(0, 160).replace(/\s+/g, ' ').trim();
        lockInSamples.push({
          COM: condition.COM || '',
          COD_Proposta: condition.COD_Proposta || '',
          NomeProposta: condition.NomeProposta || '',
          lockInSource: lockIn.lockInSource,
          lockInMonths: lockIn.lockInMonths,
          snippet: snippet || (lockIn.lockInSource === 'field' ? 'From DuracaoContrato field' : '')
        });
      }
    }
  });
  
  return {
    promotionFieldHits,
    samplePromotionSnippets,
    lockInSamples,
    lockInBySource
  };
}

/**
 * Extract a lock-in duration in months from free text ("12 meses", "1 ano")
 * @returns {number|null}
 */
function extractLockInMonths(text) {
  const monthMatch = text.match(/(\d+)\s*(?:meses?|mês)/i);
  if (monthMatch) return parseInt(monthMatch[1], 10);
  const yearMatch = text.match(/(\d+)\s*(?:anos?|ano)/i);
  if (yearMatch) return parseInt(yearMatch[1], 10) * 12;
  return null;
}

/**
 * Detect lock-in from condition data
 * ERSE's FiltroFidelização (S/N) decides. The text is read only when the flag is empty,
 * and a negated phrase ("sem fidelização", "não tem fidelização") never counts.
 * Returns: { hasLockIn: boolean, lockInMonths: number|null, lockInSource: 'field'|'text'|null }
 */
function detectLockIn(condition) {
  const explicitFlag = normalizeString(condition.FiltroFidelização || '');
  const textFields = [
    condition.TxTFidelização || '',
    condition.TxTOferta || '',
    condition.TxTRestricoesAdic || ''
  ].join(' ').toLowerCase();

  if (explicitFlag === 'S') {
    const duracao = normalizeString(condition.DuracaoContrato || '');
    const months = /^\d+$/.test(duracao) ? parseInt(duracao, 10) : extractLockInMonths(textFields);
    return { hasLockIn: true, lockInMonths: months, lockInSource: 'field' };
  }

  if (explicitFlag === 'N') {
    return { hasLockIn: false, lockInMonths: null, lockInSource: null };
  }

  // Flag missing: infer from text, ignoring negated mentions
  const withoutNegations = textFields.replace(/(sem|não tem|nao tem|não há|nao ha|isento de)\s+(período de\s+)?(fideliza\w*|permanência|permanencia)/g, '');
  const lockInKeywords = ['fideliza', 'permanência', 'permanencia', 'penaliza'];
  if (lockInKeywords.some(keyword => withoutNegations.includes(keyword))) {
    return { hasLockIn: true, lockInMonths: extractLockInMonths(withoutNegations), lockInSource: 'text' };
  }

  return { hasLockIn: false, lockInMonths: null, lockInSource: null };
}

/**
 * Extract promotion from text fields
 * Uses prioritized column list based on discovery
 * Returns: { fixedEuroMonth: number, durationMonthsExtracted: number|null, durationMonthsApplied: number, durationAssumed: boolean } | null
 */
function extractPromotion(condition, prioritizedColumns = null) {
  // Build text from prioritized columns or fallback to default
  let textFields = '';
  
  if (prioritizedColumns && prioritizedColumns.length > 0) {
    // Use discovered high-value columns first
    textFields = prioritizedColumns
      .map(col => condition[col] || '')
      .filter(v => v && typeof v === 'string')
      .join(' ')
      .toLowerCase();
  } else {
    // Fallback to default columns
    textFields = [
      condition.TxTOferta || '',
      condition.DetalheOutrosDesc || '',
      condition.DetalheOutrosDescbenefi || '',
      condition.TxTReembolsos || '',
      condition.TxTFatura || ''
    ].join(' ').toLowerCase();
  }
  
  if (!textFields.trim()) {
    return null;
  }
  
  // Look for fixed monthly discount patterns with context validation
  // Must have context indicating "per month" or "on the bill" to avoid one-time vouchers
  const discountPatterns = [
    // Pattern: "2€", "2 €", "2 euros", "2,00€" with monthly context
    /(\d+(?:[.,]\d+)?)\s*(?:€|euros?|eur)\s*(?:\/|por)\s*(?:mês|mes|mensal)/i,
    /(\d+(?:[.,]\d+)?)\s*(?:€|euros?|eur)\s+(?:desconto|discount|redução|reducao|reembolso)\s+(?:de|na|por)\s*(?:mês|mes|mensal|fatura|faturação|faturacao)/i,
    /(?:desconto|discount|redução|reducao|reembolso)\s+(?:de\s+)?(\d+(?:[.,]\d+)?)\s*(?:€|euros?|eur)\s+(?:na|por|\/)\s*(?:fatura|faturação|faturacao|mês|mes|mensal)/i,
    /[-–]\s*(\d+(?:[.,]\d+)?)\s*(?:€|euros?|eur)\s*(?:\/|por)\s*(?:mês|mes|mensal)/i,
    // Pattern: "2€ na fatura" (on the bill)
    /(\d+(?:[.,]\d+)?)\s*(?:€|euros?|eur)\s+(?:na|por)\s+(?:fatura|faturação|faturacao)\s+(?:mensal|por mês)?/i
  ];
  
  let fixedEuroMonth = null;
  let discountContext = '';
  
  // "até ao max de 450€/mês" is a cap on some other benefit, not a discount on the bill
  const capBefore = /(?:m[aá]x(?:imo)?\.?|até|limite|teto|tecto)(?:\s+(?:ao|a|o|de))*\s*$/i;

  for (const pattern of discountPatterns) {
    const match = textFields.match(pattern);
    if (match && capBefore.test(textFields.slice(Math.max(0, match.index - 20), match.index))) {
      continue;
    }
    if (match) {
      const amount = parseFloat(match[1].replace(',', '.'));
      if (amount > 0 && isFinite(amount)) {
        // Verify context indicates monthly/bill-based (not one-time)
        const context = match[0].toLowerCase();
        const hasMonthlyContext = /(?:mês|mes|mensal|fatura|faturação|faturacao)/i.test(context);
        
        if (hasMonthlyContext) {
          fixedEuroMonth = amount;
          discountContext = context;
          break;
        }
      }
    }
  }
  
  if (!fixedEuroMonth || fixedEuroMonth <= 0) {
    return null; // No valid discount found
  }
  
  // Look for duration patterns:
  // "durante 12 meses", "por 1 ano", "12 meses", "primeiro ano"
  let durationMonthsExtracted = null;
  let durationAssumed = false;
  
  const durationPatterns = [
    /(?:durante|por|para|nos|no|primeiros?)\s+(\d+)\s*(?:meses?|mês)/i,
    /(\d+)\s*(?:meses?|mês)\s*(?:de|de\s+desconto|de\s+promoção|consecutivos?)/i,
    /(?:durante|por|para|no|no|primeiro|1º|1o)\s+(\d+)\s*(?:anos?|ano)/i,
    /(?:primeiro|1º|1o)\s+(?:ano|year)/i
  ];
  
  for (const pattern of durationPatterns) {
    const match = textFields.match(pattern);
    if (match) {
      if (match[1]) {
        const value = parseInt(match[1], 10);
        if (textFields.match(/ano/i)) {
          durationMonthsExtracted = value * 12;
        } else {
          durationMonthsExtracted = value;
        }
      } else {
        // "primeiro ano" pattern
        durationMonthsExtracted = 12;
      }
      break;
    }
  }
  
  // Clamp extracted duration to reasonable bounds (1-24 months)
  if (durationMonthsExtracted !== null) {
    durationMonthsExtracted = Math.max(1, Math.min(24, durationMonthsExtracted));
  }
  
  // For annual effective cost calculation, clamp to 0..12 months
  const durationMonthsApplied = durationMonthsExtracted !== null 
    ? Math.max(0, Math.min(12, durationMonthsExtracted))
    : null;
  
  // If duration not found but discount exists, assume 12 months conservatively
  // But mark as assumed so we know it's not guaranteed
  if (durationMonthsApplied === null) {
    // Only assume if we have a clear monthly discount
    durationAssumed = true;
  }
  
  return {
    fixedEuroMonth: fixedEuroMonth,
    durationMonthsExtracted: durationMonthsExtracted,
    durationMonthsApplied: durationMonthsApplied !== null ? durationMonthsApplied : (durationAssumed ? 12 : null),
    durationAssumed: durationAssumed
  };
}

/**
 * Detect cycle type from tariff name
 * @param {string} tariffName - Tariff name from NomeProposta
 * @returns {string|null} 'daily' | 'weekly' | null
 */
function detectCycleType(tariffName) {
  if (!tariffName) return null;
  
  const normalized = normalizeTextForTokens(tariffName);
  
  // Check for daily cycle indicators
  if (normalized.includes('ciclo diario') || 
      normalized.includes('ciclo diário') ||
      normalized.includes('diario') ||
      normalized.includes('diário')) {
    return 'daily';
  }
  
  // Check for weekly cycle indicators
  if (normalized.includes('ciclo semanal') ||
      normalized.includes('semanal') ||
      normalized.includes('sem feriados')) {
    return 'weekly';
  }
  
  return null;
}

/**
 * Extract campaign/conditions metadata from condition row
 * @param {Object} condition - Condition row from CSV
 * @param {Array<string>} prioritizedColumns - Optional: prioritized column names for promotion extraction
 */
function extractCampaignMetadata(condition, prioritizedColumns = null) {
  const lockIn = detectLockIn(condition);
  const promotion = extractPromotion(condition, prioritizedColumns);
  
  const tariffName = safeText(condition.NomeProposta || condition.COD_Proposta);
  const cycleType = detectCycleType(tariffName);
  
  const metadata = {
    tariffName: tariffName,
    cycleType: cycleType, // 'daily' | 'weekly' | null
    website: safeUrl(condition.LinkOfertaCom, condition.LinkCOM),
    phone: safeText(condition.ContactoComercialTel),
    fornecimento: normalizeString(condition.Fornecimento || ''),
    segmento: normalizeString(condition.Segmento || ''),
    validFrom: normalizeString(condition['Data ini'] || ''),
    validTo: normalizeString(condition['Data fim'] || ''),
    // ERSE renamed the column FiltroPrecosIndex_ELE in 2026; older exports use the plain name
    isIndexed: normalizeString(condition.FiltroPrecosIndex_ELE ?? condition.FiltroPrecosIndex ?? '') === 'S',
    // Conditioned offer (members, referral codes, other contracts): kept as a savings baseline for
    // its own customers, never recommended
    isRestricted: normalizeString(condition['FiltroRestrições'] || '') === 'S',
    // Eligibility: annual consumption band (kWh/year) and mandatory services (€/year, with VAT)
    consMinYear: optionalNumber(condition.ConsIni_ELE),
    consMaxYear: optionalNumber(condition.ConsFim_ELE),
    serviceCostYear: optionalNumber(condition['CustoServicos_c/IVA (€/ano)']) || 0,
    hasLockIn: lockIn.hasLockIn,
    lockInMonths: lockIn.lockInMonths,
    lockInSource: lockIn.lockInSource,
    promotion: promotion,
    newCustomerOnly: false, // Not directly in CSV, could be inferred from conditions
    requiresDirectDebit: false, // Not directly in CSV
    requiresEBill: false, // Not directly in CSV
    campaignSummary: ''
  };
  
  // Build campaign summary from available text fields
  const summaryParts = [];
  if (condition.TxTOferta) {
    summaryParts.push(safeText(condition.TxTOferta).substring(0, 100));
  }
  if (condition.TxTFidelização && lockIn.hasLockIn) {
    summaryParts.push(`Fidelização: ${safeText(condition.TxTFidelização).substring(0, 50)}`);
  }
  metadata.campaignSummary = summaryParts.join(' | ').substring(0, 200);
  
  // Whether the offer is active depends on the day it is viewed, so the browser decides it
  // from validFrom/validTo (isOfferEligible in js/calculator.js); nothing date-dependent is baked in.

  // Update promotion object with isActive field if promotion exists
  if (promotion) {
    // Since we don't have promo-specific dates, use offer validity as proxy
    // But mark it as null to indicate we don't have true promo dates
    promotion.isActive = null; // Unknown - no promo-specific dates available
  }
  
  return metadata;
}

/**
 * Main build function
 */
function buildOffers() {
  console.log('🔨 Building offers.json...');
  
  // Read CSVs
  if (!fs.existsSync(PRECOS_PATH)) {
    throw new Error(`Missing ${PRECOS_PATH}`);
  }
  if (!fs.existsSync(COND_PATH)) {
    throw new Error(`Missing ${COND_PATH}`);
  }
  
  console.log('📖 Reading CSVs...');
  const precosText = fs.readFileSync(PRECOS_PATH, 'utf8');
  const condText = fs.readFileSync(COND_PATH, 'utf8');
  
  const prices = parseCSV(precosText);
  const conditions = parseCSV(condText);
  
  console.log(`   - Prices: ${prices.length} rows`);
  console.log(`   - Conditions: ${conditions.length} rows`);
  
  // Run discovery to find promotion-related fields
  console.log('🔍 Discovering promotion fields...');
  const discovery = discoverPromotionFields(conditions);
  const prioritizedColumns = discovery.promotionFieldHits
    .slice(0, 5)
    .map(item => item.column);
  console.log(`   - Top promotion columns: ${prioritizedColumns.slice(0, 3).join(', ')}${prioritizedColumns.length > 3 ? '...' : ''}`);
  
  // Create lookup map for conditions (COM + COD_Proposta)
  const conditionsMap = new Map();
  conditions.forEach(cond => {
    const key = `${cond.COM}|${cond.COD_Proposta}`;
    if (!conditionsMap.has(key)) {
      conditionsMap.set(key, cond);
    }
  });
  
  console.log('🔗 Joining data...');
  
  // Join and normalize offers
  const offers = [];
  const seen = new Set();
  
  for (const price of prices) {
    const key = `${price.COM}|${price.COD_Proposta}`;
    const condition = conditionsMap.get(key);
    
    // Filter: electricity-only (ELE only, exclude GN and DUAL)
    if (!condition || condition.Fornecimento !== 'ELE') {
      continue; // Skip GN, DUAL, and offers without condition data
    }

    // Filter: domestic only (ADR-020); 'Tod' offers are open to everyone
    if (normalizeString(condition.Segmento) === 'Ndom') {
      continue;
    }
    
    // Normalize price fields
    const tvField = normalizeNumber(price['TV|TVFV|TVP'] || price.TV || 0);
    const tvv = normalizeNumber(price['TVV|TVC'] || price.TVV || 0);
    const tvvz = normalizeNumber(price.TVVz || 0);
    const tf = normalizeNumber(price.TF || 0);
    const potCont = normalizeNumber(price.Pot_Cont || 0);
    const contagem = normalizeNumber(price.Contagem || 1);
    
    // Skip invalid offers
    if (tf <= 0 || tvField <= 0 || potCont <= 0) {
      continue;
    }
    
    // Create unique key for deduplication
    const uniqueKey = `${price.COM}|${price.COD_Proposta}|${potCont}|${contagem}`;
    if (seen.has(uniqueKey)) {
      continue;
    }
    seen.add(uniqueKey);
    
    // Extract campaign metadata (use prioritized columns from discovery)
    const campaign = condition ? extractCampaignMetadata(condition, prioritizedColumns) : {
      tariffName: safeText(price.COD_Proposta),
      cycleType: null, // No cycle info without condition data
      website: '',
      phone: '',
      fornecimento: '',
      segmento: '',
      validFrom: '',
      validTo: '',
      isIndexed: false,
      isRestricted: false,
      hasLockIn: false,
      newCustomerOnly: false,
      requiresDirectDebit: false,
      requiresEBill: false,
      campaignSummary: '',
      consMinYear: null,
      consMaxYear: null,
      serviceCostYear: 0
    };
    
    // Build offer object
    const offer = {
      // Core identifiers
      COM: normalizeString(price.COM),
      COD_Proposta: normalizeString(price.COD_Proposta),
      
      // Power and tariff
      Pot_Cont: potCont,
      Contagem: contagem,
      
      // Price fields
      TF: tf,
      'TV|TVFV|TVP': tvField,
      'TVV|TVC': tvv,
      TVVz: tvvz,
      
      // Campaign/conditions metadata
      ...campaign
    };
    
    offers.push(offer);
  }
  
  // Count statistics
  const lockInCount = offers.filter(o => o.hasLockIn === true).length;
  const promotionMetadataCount = offers.filter(o => o.promotion !== null).length;
  
  // Lock-in totals by source (across ALL offers, not just samples)
  const lockInBySourceTotals = { field: 0, text: 0 };
  offers.forEach(offer => {
    if (offer.hasLockIn === true) {
      if (offer.lockInSource === 'field') {
        lockInBySourceTotals.field++;
      } else if (offer.lockInSource === 'text') {
        lockInBySourceTotals.text++;
      }
    }
  });
  
  // Promotion statistics
  const promotionsWithKnownActiveStatus = offers.filter(o => 
    o.promotion !== null && 
    o.promotion.isActive !== null && 
    o.promotion.isActive !== undefined
  ).length;
  const promotionsActiveCount = offers.filter(o => 
    o.promotion !== null && 
    o.promotion.isActive === true
  ).length;
  // Promotions are NOT applied to calculations (set to 0)
  const promotionAppliedCount = 0;
  
  // Collect promotion parsed samples (max 10)
  const promotionParsedSamples = [];
  offers.forEach(offer => {
    if (promotionParsedSamples.length >= 10) return;
    if (offer.promotion !== null) {
      // Find the condition to get source column info
      const condition = conditionsMap.get(`${offer.COM}|${offer.COD_Proposta}`);
      let sourceColumn = 'unknown';
      if (condition) {
        // Determine which column likely contained the promotion text
        const prioritizedCols = discovery.promotionFieldHits.slice(0, 5).map(item => item.column);
        for (const col of prioritizedCols) {
          if (condition[col] && typeof condition[col] === 'string' && condition[col].trim().length > 0) {
            sourceColumn = col;
            break;
          }
        }
      }
      
      const snippet = (condition && condition[sourceColumn]) 
        ? String(condition[sourceColumn]).substring(0, 160).replace(/\s+/g, ' ').trim()
        : '';
      
      promotionParsedSamples.push({
        COM: offer.COM,
        COD_Proposta: offer.COD_Proposta,
        NomeProposta: offer.tariffName || '',
        sourceColumn: sourceColumn,
        snippet: snippet,
        parsed: {
          fixedEuroMonth: offer.promotion.fixedEuroMonth,
          durationMonthsExtracted: offer.promotion.durationMonthsExtracted,
          durationMonthsApplied: offer.promotion.durationMonthsApplied,
          durationAssumed: offer.promotion.durationAssumed
        }
      });
    }
  });
  
  console.log(`✅ Built ${offers.length} offers`);
  console.log(`   - Lock-in offers (excluded): ${lockInCount}`);
  console.log(`   - Lock-in by source: field=${lockInBySourceTotals.field}, text=${lockInBySourceTotals.text}`);
  console.log(`   - Offers with promotion metadata: ${promotionMetadataCount} (not applied to calculations)`);
  console.log(`   - Promotions with known active status: ${promotionsWithKnownActiveStatus}`);
  console.log(`   - Promotions active: ${promotionsActiveCount}`);
  console.log(`   - Promotions applied: ${promotionAppliedCount} (promotions not used in ranking)`);
  
  // Print discovery summary
  if (discovery.promotionFieldHits.length > 0) {
    console.log(`\n📊 Promotion Discovery Summary:`);
    console.log(`   Top 5 columns by hits:`);
    discovery.promotionFieldHits.slice(0, 5).forEach((item, idx) => {
      console.log(`   ${idx + 1}. ${item.column}: ${item.hits} hits`);
    });
  }
  
  // Warn if tokens found but no promotions extracted
  if (discovery.promotionFieldHits.length > 0 && promotionMetadataCount === 0) {
    console.log(`\n⚠️  WARNING: Promotion tokens found in data but no promotions extracted.`);
    console.log(`   This may indicate pattern matching needs refinement.`);
  }
  
  // Write offers.json
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(offers, null, 2));
  console.log(`💾 Wrote ${OUTPUT_PATH}`);
  
  // Update meta.json with build info
  let meta = {};
  if (fs.existsSync(META_PATH)) {
    try {
      meta = JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
    } catch (e) {
      // If meta.json is invalid, start fresh
      meta = {};
    }
  }
  
  // Date of the prices: ERSE's export date when the downloader just ran, else the one the previous build kept.
  // Never the build time: rebuilding old CSVs must not make them look fresh.
  const sourceUpdatedAt = meta.updatedAt || meta.build?.sourceUpdatedAt || null;
  const sourceDateNote = meta.updatedAt ? "ERSE's export date, from the name of the ZIP the downloader fetched" : (meta.build?.sourceDateNote || null);
  
  meta.build = {
    builtAt: new Date().toISOString(),
    sourceUpdatedAt: sourceUpdatedAt,
    sourceDateNote: sourceDateNote,
    offersCount: offers.length,
    rowCounts: {
      prices: prices.length,
      conditions: conditions.length
    },
    filtersApplied: {
      fornecimento: 'ELE only (excluded GN and DUAL)',
      segmento: 'Dom and Tod only (excluded Ndom)',
      restricted: 'kept with isRestricted; never ranked (js/calculator.js)',
      lockInExcluded: false // Note: lock-in filtering happens at runtime
    },
    // Supplier codes present in offers.json (js/config.js PROVIDERS names each one)
    providers: offers.reduce((counts, offer) => {
      counts[offer.COM] = (counts[offer.COM] || 0) + 1;
      return counts;
    }, {}),
    statistics: {
      lockInCount: lockInCount,
      lockInBySourceTotals: lockInBySourceTotals,
      promotionsWithMetadataCount: promotionMetadataCount,
      promotionsWithKnownActiveStatusCount: promotionsWithKnownActiveStatus,
      promotionsActiveCount: promotionsActiveCount,
      promotionsAppliedCount: promotionAppliedCount
    },
    scriptVersion: '2.1.0' // Version tracking for build script
  };
  
  // Store discovery results
  meta.discovery = {
    promotionFieldHits: discovery.promotionFieldHits,
    samplePromotionSnippets: discovery.samplePromotionSnippets,
    lockInSamples: discovery.lockInSamples,
    lockInBySource: discovery.lockInBySource,
    promotionParsedSamples: promotionParsedSamples
  };
  
  fs.writeFileSync(META_PATH, JSON.stringify(meta, null, 2));
  console.log(`📝 Updated ${META_PATH}`);
  
  return offers;
}

// Run
if (require.main === module) {
  try {
    buildOffers();
    console.log('✅ Build complete!');
  } catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
  }
}

module.exports = { buildOffers, safeText, safeUrl, detectLockIn };

