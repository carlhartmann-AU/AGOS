// lib/triple-whale/client.ts
// Thin wrapper around Triple Whale API. Keeps all TW-specific shape knowledge here
// so the rest of the codebase talks to our cache table, not the API.

export interface TWDailyMetrics {
  date: string               // YYYY-MM-DD
  revenue: number
  orders: number
  aov: number
  new_customers: number
  returning_customers: number
  raw_response?: Record<string, unknown>
}

export interface TWFetchOptions {
  apiKey: string
  shopDomain: string         // e.g. 'plasmaide-uk.myshopify.com'
  date: string               // YYYY-MM-DD
}

const TW_BASE = 'https://api.triplewhale.com/api/v2'

/**
 * Fetch a single day's metrics from Triple Whale.
 * Returns a normalised row ready to upsert into tw_daily_summary.
 *
 * Triple Whale returns data in different shapes across endpoints; this function
 * owns the knowledge of how to read each response.
 */
export async function fetchDailyMetrics(opts: TWFetchOptions): Promise<TWDailyMetrics> {
  const { apiKey, shopDomain, date } = opts

  // Call summary-page endpoint for revenue + orders
  const summaryRes = await fetch(`${TW_BASE}/summary-page/get-data`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      shopDomain,
      period: { startDate: date, endDate: date },
      todayHour: new Date().getUTCHours(),
    }),
  })

  if (!summaryRes.ok) {
    throw new Error(`TW summary-page failed: ${summaryRes.status} ${await summaryRes.text()}`)
  }

  const summary = await summaryRes.json()

  // Call moby NL endpoint for AOV + customer breakdown
  // (per handover notes, ad metrics are blocked until ad accounts connected,
  // but these attribution-free metrics do work)
  const mobyRes = await fetch(`${TW_BASE}/orcabase/api/moby`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      shopDomain,
      question: `On ${date}, what was the AOV, new customer count, and returning customer count?`,
    }),
  })

  const moby = mobyRes.ok ? await mobyRes.json() : { data: {} }

  // Normalise — defensively extract, fall back to 0 if structure changes
  const revenue = Number(summary?.data?.revenue ?? summary?.revenue ?? 0)
  const orders = Number(summary?.data?.orders ?? summary?.orders ?? 0)
  const aov = Number(moby?.data?.aov ?? (orders > 0 ? revenue / orders : 0))
  const newCustomers = Number(moby?.data?.new_customers ?? 0)
  const returningCustomers = Number(moby?.data?.returning_customers ?? 0)

  return {
    date,
    revenue,
    orders,
    aov,
    new_customers: newCustomers,
    returning_customers: returningCustomers,
    raw_response: { summary, moby },
  }
}

/**
 * Fetch multiple days in parallel with a concurrency cap.
 * TW rate limits are unclear, so we cap at 3 concurrent to be safe.
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
