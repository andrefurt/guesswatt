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
// kept here; the selftest fails if a code in data/offers.json has no name, or a name has no offers.
export const PROVIDERS = {
  'ALFAENERGIA': 'Alfa Energia',
  'AUDAX': 'Audax Renovables',
  'COOP': 'Coopérnico',
  'EDPC': 'EDP Comercial',
  'EDPSU': 'SU Eletricidade',
  'END': 'Endesa',
  'ENIPLENITUDE': 'Plenitude',
  'EZUENERGIA': 'EZU Energia',
  'G9ENERGY': 'G9 Energy',
  'GALP': 'Galp',
  'GOLD': 'Goldenergy',
  'IBD': 'Iberdrola',
  'IBELECTRA': 'Ibelectra',
  'JAFPLUS': 'JAF Plus',
  'LOGICA': 'Lógica Energy',
  'LUZBOA': 'Luzboa',
  'LUZIGAS': 'Luzigás',
  'MEOENERGIA': 'MEO Energia',
  'MUON': 'Muon',
  'NABALIAENERGIA': 'Nabalia Energia',
  'NOSSAENERGIA': 'Nossa Energia',
  'OENEO': 'Oeneo',
  'PORTULOGOS': 'Portulogos',
  'REPSOL': 'Repsol',
  'USENERGY': 'US Energy',
  'YESENERGY': 'Yes Energy'
};

