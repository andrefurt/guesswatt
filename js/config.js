/**
 * Configuration Constants
 * Application-wide constants and configuration values
 */

// VAT (ERSExplica "Aplicação do IVA na fatura de eletricidade"; Lei 38/2024; DL 60/2019)
export const VAT = 1.23;                     // standard rate
export const VAT_REDUCED = 1.06;             // reduced rate
export const REDUCED_VAT_MAX_POWER = 6.9;    // kVA: energy gets the reduced rate up to the threshold
export const REDUCED_VAT_KWH = 200;          // kWh per 30 days
export const REDUCED_VAT_KWH_LARGE_HOUSEHOLD = 300; // households of 5 or more
export const REDUCED_FIXED_VAT_MAX_POWER = 3.45;    // kVA: the TAR share of the fixed term gets the reduced rate
export const DGEG_FEE = 0.07;                // €/month, taxed at the standard rate (Portaria 311/2002)
export const DAYS_PER_MONTH = 30;
export const DEFAULT_POWER = 4.6; // kVA mais comum
export const AUDIOVISUAL_TAX = 2.85; // €/mês, taxed at the reduced rate

// Display names for ERSE supplier codes (COM). ERSE publishes codes only, so the names are
// kept here. A code with no name still shows (as the code) and the refresh opens an issue to name it
// (validate-data.js --supplier-names); a name with no offers this week is left out of the dropdown.
export const PROVIDERS = {
  'ALFAENERGIA': 'Alfa Energia',
  'AUDAX': 'Audax Renovables',
  'COOP': 'Coopérnico',
  'EDPC': 'EDP Comercial',
  'END': 'Endesa',
  'ENIPLENITUDE': 'Plenitude',
  'EZUENERGIA': 'EZU Energia',
  'GALP': 'Galp',
  'GOLD': 'Goldenergy',
  'IBD': 'Iberdrola',
  'JAFPLUS': 'JAF Plus',
  'LUZBOA': 'Luzboa',
  'MEOENERGIA': 'MEO Energia',
  'NABALIAENERGIA': 'Nabalia Energia',
  'NOSSAENERGIA': 'Nossa Energia',
  'OENEO': 'Oeneo',
  'PORTULOGOS': 'Portulogos',
  'REPSOL': 'Repsol',
  'TUR': 'SU Eletricidade', // regulated price (was EDPSU until 2026)
  'YESENERGY': 'Yes Energy',
  'ZUG POWER': 'ZUG Power'
};

