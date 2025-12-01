/**
 * GuessWatt - Constants
 * 
 * Tax rates, fees, and configuration values.
 * Source: ERSE documentation
 * See: docs/DATA_MODEL.mdc
 */

// Tax rates
export const IVA = 0.23;
export const IVA_REDUZIDO = 0.06;

// Monthly fees (€)
export const CONTRIB_AUDIOVISUAL = 2.85;
export const TAXA_DGEG = 0.07;

// Per kWh taxes (€)
export const IMPOSTO_ESPECIAL = 0.001;

// Calculation defaults
export const DIAS_MES = 30;

// UI configuration
export const TOP_OFERTAS = 4;

// Valid power options (kVA) - declared first for use in aliases
const POTENCIAS_VALIDAS_ARRAY = [
  1.15, 2.3, 3.45, 4.6, 5.75, 6.9, 10.35, 13.8, 17.25, 20.7
];

// Export with different name to avoid hoisting issues
export const POTENCIAS_VALIDAS = POTENCIAS_VALIDAS_ARRAY;

// Default assumptions for estimation
export const DEFAULTS = {
  potencia: 4.6,           // kVA - most common in Portugal
  tipoTarifa: 1,           // Simple tariff
  percentagemVazio: 0.35,  // 35% off-peak for bi-hourly
};

// Exported aliases for app.js compatibility
export const DEFAULT_POWER = DEFAULTS.potencia;
export const DEFAULT_TARIFF_TYPE = DEFAULTS.tipoTarifa;
export const DEFAULT_VAZIO_PERCENT = DEFAULTS.percentagemVazio;
export const VALID_POWERS = POTENCIAS_VALIDAS_ARRAY;

// Consumption distribution assumptions
export const DISTRIBUICAO = {
  biHoraria: {
    vazio: 0.35,
    foraVazio: 0.65,
  },
  triHoraria: {
    vazio: 0.30,
    cheias: 0.50,
    ponta: 0.20,
  },
};
