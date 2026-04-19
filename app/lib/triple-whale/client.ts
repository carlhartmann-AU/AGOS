// lib/triple-whale/client.ts
// Triple Whale API client — CORRECTED to match working spec.
// Reference: handover note after OpenClaw fix (April 2026).
//
// Key corrections from previous version:
// - Summary Page: period uses { start, end } (NOT startDate/endDate)
// - Summary Page: todayHour is 1-25 base-1; use 25 for historical
// - Summary Page: revenue/orders extracted from metrics[] array, not flat data object
// - Moby: body uses shopId (NOT shopDomain)
// - Moby: always returns 200 — check responses[0].isError for actual errors
// - Moby: AOV + customers extracted from responses[0].answer.X[0]

export interface TWDailyMetrics {
  date: string               // YYYY-MM-DD
  revenue: number
  orders: number
  aov: number
  new_customers: number
  returning_customers: number
  source_currency: string    // NEW: what currency TW reported in (typically store base)
  raw_response?: Record<string, unknown>
}

export interface TWFetchOptions {
  apiKey: string
  shopDomain: string         // e.g. 'plasmaide-uk.myshopify.com'
  date: string               // YYYY-MM-DD — single-day fetch
  /**
   * todayHour: 1-25 base-1 per TW API.
   * - Use 25 for historical days (fetches full day).
   * - Use current hour+1 for today (partial day).
   * Default: 25 for safety (backfills work; today gets latest complete hour).
   */
  todayHour?: number
}

const TW_BASE = 'https://api.triplewhale.com/api/v2'

/**
 * Extract a metric from the summary-page response shape.
 * TW returns: { metrics: [ { id: 'sales', values: { current: 123 } }, ... ] }
 */
function getMetric(summary: unknown, metricId: string): number {
  const obj = summary as { metrics?: Array<{ id?: string; values?: { current?: number } }> }
  const metric = obj?.metrics?.find(m => m?.id === metricId)
  const value = metric?.values?.current
  return typeof value === 'number' ? value : 0
}

/**
 * Extract the first value from a Moby answer array.
 * Moby returns: { responses: [ { answer: { aov: [123.45], new_customer_orders: [5], ... }, isError: false } ] }
 */
function getMobyAnswer(moby: unknown, field: string): number {
  const obj = moby as { responses?: Array<{ answer?: Record<string, number[] | undefined>; isError?: boolean }> }
  const first = obj?.responses?.[0]
  if (!first || first.isError) return 0
  const arr = first.answer?.[field]
  return Array.isArray(arr) && typeof arr[0] === 'number' ? arr[0] : 0
}

/**
 * Best-effort currency extraction from TW summary response.
 * TW doesn't always expose this cleanly — fall back to assumed GBP for Plasmaide UK store.
 */
function extractCurrency(summary: unknown, fallback = 'GBP'): string {
  const obj = summary as { currency?: string; shop?: { currency?: string } }
  return obj?.currency ?? obj?.shop?.currency ?? fallback
}

/**
 * Fetch a single day's metrics from Triple Whale.
 *
 * Uses the working spec from the OpenClaw handover:
 * - Summary Page for revenue + orders
 * - Moby NL for AOV + customer breakdown
 */
export async function fetchDailyMetrics(opts: TWFetchOptions): Promise<TWDailyMetrics> {
  const { apiKey, shopDomain, date, todayHour = 25 } = opts

  // ----- Summary Page: revenue, orders -----
  const summaryRes = await fetch(`${TW_BASE}/summary-page/get-data`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      shopDomain,
      period: { start: date, end: date },   // { start, end } NOT { startDate, endDate }
      todayHour,                             // required, 1-25 base-1
    }),
  })

  if (!summaryRes.ok) {
    const errBody = await summaryRes.text()
    console.error(`[tw-client] summary-page ${summaryRes.status} for ${date}:`, errBody.slice(0, 500))
    throw new Error(`TW summary-page failed ${summaryRes.status}: ${errBody.slice(0, 300)}`)
  }

  const summary = await summaryRes.json()
  console.log(`[tw-client] summary-page raw ${date}:`, JSON.stringify(summary).slice(0, 500))
  const revenue = getMetric(summary, 'sales')    // 'sales' = gross-discounts+tax+ship (matches TW dashboard)
  const orders = getMetric(summary, 'orders')
  const source_currency = extractCurrency(summary, 'GBP')

  // ----- Moby NL: AOV, customer split -----
  // Moby always returns 200 — need to inspect responses[0].isError
  const mobyRes = await fetch(`${TW_BASE}/orcabase/api/moby`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      shopId: shopDomain,  // NOTE: Moby uses shopId, not shopDomain
      question: 'What is my AOV, new customer orders, and returning customer orders?',
    }),
  })

  if (!mobyRes.ok) {
    console.error(`[tw-client] moby non-200 ${mobyRes.status} for ${date}`)
  }
  const moby = mobyRes.ok ? await mobyRes.json() : { responses: [{ isError: true }] }
  console.log(`[tw-client] moby raw ${date}:`, JSON.stringify(moby).slice(0, 500))
  const aov = getMobyAnswer(moby, 'aov') || (orders > 0 ? revenue / orders : 0)
  const new_customers = getMobyAnswer(moby, 'new_customer_orders')
  const returning_customers = getMobyAnswer(moby, 'returning_customer_orders')

  return {
    date,
    revenue,
    orders,
    aov,
    new_customers,
    returning_customers,
    source_currency,
    raw_response: { summary, moby },
  }
}

/**
 * Fetch multiple days in parallel with a concurrency cap.
 * Respects TW rate limits: Summary Page 100/min, Moby 60/min (10/sec).
 */
export async function fetchMultipleDays(
  opts: Omit<TWFetchOptions, 'date'>,
  dates: string[],
  concurrency = 3
): Promise<Array<{ date: string; metrics?: TWDailyMetrics; error?: string }>> {
  const results: Array<{ date: string; metrics?: TWDailyMetrics; error?: string }> = []
  const queue = [...dates]

  async function worker() {
    while (queue.length > 0) {
      const date = queue.shift()
      if (!date) return
      try {
        const metrics = await fetchDailyMetrics({ ...opts, date })
        results.push({ date, metrics })
      } catch (err) {
        results.push({
          date,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker))
  return results
}

/**
 * Validate a Triple Whale API key.
 * Used by the Settings → Integrations "Test connection" button.
 */
export async function validateApiKey(apiKey: string): Promise<{ valid: boolean; user?: { name: string; email: string }; error?: string }> {
  try {
    const res = await fetch(`${TW_BASE}/users/api-keys/me`, {
      headers: { 'x-api-key': apiKey },
    })
    if (!res.ok) return { valid: false, error: `HTTP ${res.status}` }
    const data = await res.json()
    return { valid: true, user: data?.user }
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
