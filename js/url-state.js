/**
 * URL State (ADR-018, CLAUDE.md rule 3)
 * A result lives in the URL as plain parameters, so it can be bookmarked or shared. The URL holds
 * the inputs, never the result: opening it runs the comparison again on the current prices.
 *
 *   ?f=80&d=2026-10                       estimate: monthly bill in €
 *   ?c=250&p=4.6&t=1&s=IBD&h=1&d=2026-10  precise: kWh/month, kVA, tariff type, supplier (optional;
 *                                         "outro" for one not in the data)
 *   h=1  household of 5 or more (either mode)    d  month of the prices the link was made with
 *
 * Every value is coerced and range-checked on the way in: a URL is input from anyone, and these
 * values reach the page and the AI prompt links. Anything out of shape gives no state at all.
 */

import { PROVIDERS } from './config.js';

const BILL = { min: 20, max: 500 };         // €/month, as the estimate form
const CONSUMPTION = { min: 1, max: 5000 };  // kWh/month, as the manual form
const POWER = { min: 1.15, max: 41.4 };     // kVA, the normal low-voltage range
const ERSE_CODE = /^[A-Z0-9][A-Z0-9 ]{1,29}$/; // supplier codes as ERSE writes them ("EDPC", "ZUG POWER")

const number = (value, { min, max }) => {
  if (value === null || !/^\d{1,4}([.,]\d{1,2})?$/.test(value)) return null;
  const n = Number(value.replace(',', '.'));
  return n >= min && n <= max ? n : null;
};

/**
 * Read the comparison input from a query string
 * @param {string} search - location.search
 * @returns {{input: Object, largeHousehold: boolean, dataMonth: string|null}|null}
 */
export function readState(search) {
  const params = new URLSearchParams(search);
  const largeHousehold = params.get('h') === '1';
  const month = params.get('d');
  const dataMonth = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : null;

  if (params.has('f')) {
    const bill = number(params.get('f'), BILL);
    return bill === null ? null : { input: { mode: 'estimate', bill }, largeHousehold, dataMonth };
  }

  if (params.has('c')) {
    const consumption = number(params.get('c'), CONSUMPTION);
    const power = number(params.get('p'), POWER);
    const tariffType = ['1', '2', '3'].includes(params.get('t')) ? Number(params.get('t')) : null;
    if (consumption === null || power === null || tariffType === null) return null;
    const supplier = params.get('s');
    // A named supplier, "outro", or an ERSE code the data may list before PROVIDERS names it
    // (ui-components.js matchProvidersToData); the shape check keeps anything else out
    const provider = supplier && (Object.hasOwn(PROVIDERS, supplier) || supplier === 'outro' || ERSE_CODE.test(supplier)) ? supplier : null;
    return { input: { mode: 'precise', consumption, power, tariffType, provider }, largeHousehold, dataMonth };
  }

  return null;
}

/**
 * The query string for a comparison input
 * @param {Object} input - See compare() in calculator.js
 * @param {boolean} largeHousehold
 * @param {Date|null} dataDate - Date of the prices used
 * @returns {string} Starts with "?"
 */
export function writeState(input, largeHousehold, dataDate) {
  const params = new URLSearchParams();
  if (input.mode === 'estimate') {
    params.set('f', String(input.bill));
  } else {
    params.set('c', String(input.consumption));
    params.set('p', String(input.power));
    params.set('t', String(input.tariffType));
    if (input.provider) params.set('s', input.provider);
  }
  if (largeHousehold) params.set('h', '1');
  if (dataDate) params.set('d', monthOf(dataDate));
  return `?${params}`;
}

/**
 * "2026-10" for a date, in Lisbon time (the month the page shows in the footer)
 * @param {Date} date
 * @returns {string}
 */
export function monthOf(date) {
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: 'Europe/Lisbon' }).formatToParts(date);
  return `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}`;
}

