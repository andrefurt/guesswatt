/**
 * GuessWatt - Provider Names
 * 
 * Maps provider codes from ERSE CSV to human-readable names.
 * Update as new providers appear in data.
 */

export const PROVIDERS = {
  // Major providers
  'GALP': 'Galp',
  'EDP': 'EDP',
  'EDPC': 'EDP Comercial',
  'EDPSU': 'SU Eletricidade',
  'GOLD': 'Goldenergy',
  'END': 'Endesa',
  'IBER': 'Iberdrola',
  'IBD': 'Iberdrola',
  'MEO': 'MEO Energia',
  'MEOENERGIA': 'MEO Energia',
  'REPSOL': 'Repsol',
  
  // Medium providers
  'ENI': 'Eni Plenitude',
  'ENIPLENITUDE': 'Eni Plenitude',
  'COOP': 'Coopérnico',
  'NOS': 'NOS Energia',
  'VOLT': 'Voltalia',
  'PRIO': 'Prio',
  'AUDAX': 'Audax',
  
  // Smaller providers
  'IBELECTRA': 'Ibelectra',
  'LUZBOA': 'Luzboa',
  'LUZIGAS': 'Luzigas',
  'ELEC': 'Eletrão',
  'MUON': 'Muon Electric',
  'YLCE': 'YLce',
  'ENAT': 'Energia Natural',
  'LOGICA': 'Logica',
  'PLUZ': 'Pluz',
  'OMIE': 'Omie',
  'SU': 'SU Eletricidade',
  'ROUG': 'Rougga',
  'OLIV': 'Oliveira & Irmão',
  'ACCIONA': 'Acciona',
  'AXPO': 'Axpo',
  'CLEANWATTS': 'Cleanwatts',
  'EASYC': 'Easy Energia',
  'FACTOR': 'Factor Energia',
  'FORTIA': 'Fortia',
  'HELEXIA': 'Helexia',
  'HOLA': 'Holaluz',
  'INCWATT': 'IncWatt',
  'LENERG': 'Lenerg',
  'LOJAELE': 'Loja de Eletricidade',
  'LUZ': 'LUZ',
  'MEOS': 'MEO Soluções',
  'NELECTR': 'N Energia',
  'OHMIA': 'Ohmia',
  'SELECTRA': 'Selectra',
  'SMART': 'Smart Energy',
  'TREL': 'Trel',
  'WATIO': 'Watio',
  'ALFAENERGIA': 'Alfa Energia',
  'DOUROGAS': 'Douro Gás',
  'ELERGONE': 'Elergone',
  'EZUENERGIA': 'EZU Energia',
  'G9ENERGY': 'G9 Energy',
  'JAFPLUS': 'JAF Plus',
  'MOEVE': 'Moeve',
  'NABALIAENERGIA': 'Nabalia Energia',
  'NOSSAENERGIA': 'Nossa Energia',
  'OENEO': 'Oeneo',
  'PORTULOGOS': 'Portulogos',
  'SUNCORE': 'Suncore',
  'USENERGY': 'US Energy',
  'YESENERGY': 'Yes Energy',
  'ZUG POWER': 'Zug Power',
};

/**
 * Get human-readable provider name.
 * Falls back to code if not found.
 * 
 * @param {string} code - Provider code from CSV
 * @returns {string} Human-readable name
 */
export function getProviderName(code) {
  return PROVIDERS[code] || code;
}
