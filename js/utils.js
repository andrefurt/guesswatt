/**
 * Utility Functions
 * Generic helper functions for CSV parsing, phone formatting, etc.
 */

/**
 * Parse CSV text into array of objects
 * @param {string} text - CSV text content
 * @returns {Array<Object>} Parsed CSV data as array of objects
 */
export function parseCSV(text) {
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

/**
 * Load and parse CSV file from URL
 * @param {string} url - URL to CSV file
 * @returns {Promise<Array<Object>>} Parsed CSV data
 */
export async function loadCSV(url) {
  const response = await fetch(url);
  const text = await response.text();
  return parseCSV(text);
}

/**
 * Load offers.json (preferred) or fallback to CSV files
 * @returns {Promise<{prices: Array<Object>, conditions: Array<Object>}>} Parsed data
 */
export async function loadOffers() {
  try {
    // Try to load offers.json first
    const response = await fetch('data/offers.json');
    if (response.ok) {
      const offers = await response.json();
      console.log(`✅ Loaded ${offers.length} offers from offers.json`);
      
      // Convert offers.json format back to prices/conditions format for compatibility
      // This allows existing calculator functions to work without changes
      const prices = offers.map(offer => ({
        COM: offer.COM,
        COD_Proposta: offer.COD_Proposta,
        Pot_Cont: offer.Pot_Cont,
        Contagem: offer.Contagem,
        TF: offer.TF,
        'TV|TVFV|TVP': offer['TV|TVFV|TVP'],
        'TVV|TVC': offer['TVV|TVC'],
        TVVz: offer.TVVz
      }));
      
      // Create conditions lookup from offers
      const conditionsMap = new Map();
      offers.forEach(offer => {
        const key = `${offer.COM}|${offer.COD_Proposta}`;
        if (!conditionsMap.has(key)) {
          conditionsMap.set(key, {
            COM: offer.COM,
            COD_Proposta: offer.COD_Proposta,
            NomeProposta: offer.tariffName,
            ContactoComercialTel: offer.phone,
            LinkOfertaCom: offer.website,
            LinkCOM: offer.website,
            Fornecimento: offer.fornecimento,
            Segmento: offer.segmento,
            'Data ini': offer.validFrom,
            'Data fim': offer.validTo,
            FiltroFidelização: offer.hasLockIn ? 'S' : 'N',
            FiltroPrecosIndex: offer.isIndexed ? 'S' : 'N',
            // Store enriched metadata for enrichOffer to use
            _enriched: {
              tariffName: offer.tariffName,
              website: offer.website,
              phone: offer.phone,
              fornecimento: offer.fornecimento,
              segmento: offer.segmento,
              validFrom: offer.validFrom,
              validTo: offer.validTo,
              isIndexed: offer.isIndexed,
              hasLockIn: offer.hasLockIn,
              lockInMonths: offer.lockInMonths,
              lockInSource: offer.lockInSource,
              promotion: offer.promotion,
              newCustomerOnly: offer.newCustomerOnly,
              requiresDirectDebit: offer.requiresDirectDebit,
              requiresEBill: offer.requiresEBill,
              campaignSummary: offer.campaignSummary,
              isCampaignActive: offer.isCampaignActive
            }
          });
        }
      });
      const conditions = Array.from(conditionsMap.values());
      
      return { prices, conditions, offers }; // Include raw offers for new code
    }
  } catch (error) {
    console.warn('⚠️  Could not load offers.json, falling back to CSV:', error.message);
  }
  
  // Fallback to CSV loading
  const prices = await loadCSV('data/Precos_ELEGN.csv');
  const conditions = await loadCSV('data/CondComerciais.csv');
  console.log(`✅ Loaded ${prices.length} prices and ${conditions.length} conditions from CSV`);
  return { prices, conditions, offers: null };
}

/**
 * Format phone number to Portuguese format (XXX XXX XXX)
 * @param {string|number} phone - Phone number to format
 * @returns {string|null} Formatted phone number or null if invalid
 */
export function formatPhone(phone) {
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

/**
 * Convert all-caps names to title case (e.g., "ENIPLENITUDE" → "Eniplenitude")
 * @param {string} name - Name to convert
 * @returns {string} Title case name
 */
export function toTitleCase(name) {
  if (!name) return name;
  
  // Check if string is all uppercase (ignoring spaces and special chars)
  const hasLowercase = /[a-záàâãéêíóôõúç]/.test(name);
  
  // If already has lowercase, return as-is (e.g., "Tárifa Tendência")
  if (hasLowercase) {
    return name;
  }
  
  // Convert all-caps to title case: lowercase first, then capitalize each word
  return name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

