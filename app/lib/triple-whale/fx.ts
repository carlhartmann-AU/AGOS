// lib/triple-whale/fx.ts
// Frankfurter FX rate client (https://frankfurter.dev)
// - Free, no API key, no quotas
// - Uses ECB daily rates (published ~16:00 CET on working days)
// - Rate limited but no caps

const FRANKFURTER_BASE = 'https://api.frankfurter.dev/v2'

export interface FXRates {
  base: string                // e.g. 'GBP'
  date: string                // YYYY-MM-DD — the date of the rates
  rates: Record<string, number>  // e.g. { AUD: 1.92, USD: 1.27, EUR: 1.17 }
}

const DEFAULT_QUOTES = ['AUD', 'USD', 'EUR', 'GBP']

/**
 * Fetch FX rates for a specific date, with the given base currency.
 *
 * Frankfurter returns the latest rate available on or before the requested date
 * (rates don't publish on weekends/holidays).
 *
 * For the same currency (base -> base), returns 1.
 */
export async function fetchFXRates(
  baseCurrency: string,
  date: string,
  quotes: string[] = DEFAULT_QUOTES
): Promise<FXRates> {
  // Frankfurter doesn't return base in the quotes; we need to add it manually.
  const quotesList = Array.from(new Set(quotes.filter(q => q !== baseCurrency)))
  const url = `${FRANKFURTER_BASE}/rates?date=${date}&base=${baseCurrency}&quotes=${quotesList.join(',')}`

  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Frankfurter FX fetch failed ${res.status}: ${await res.text()}`)
  }

  const data = await res.json()
  // Frankfurter v2 response shape: { base, date, rates: { QUOTE: number, ... } }
  const rates = { ...(data.rates ?? {}), [baseCurrency]: 1 }

  return {
    base: baseCurrency,
    date: data.date ?? date,
    rates,
  }
}

/**
 * Convert an amount from source currency to target currency using stored rates.
 * If the rate is missing, returns the original amount (graceful degradation).
 */
export function convertAmount(
  amount: number,
  sourceCurrency: string,
  targetCurrency: string,
  rates: Record<string, number>
): number {
  if (sourceCurrency === targetCurrency) return amount
  const rate = rates[targetCurrency]
  if (typeof rate !== 'number' || !isFinite(rate)) return amount
  return amount * rate
}
