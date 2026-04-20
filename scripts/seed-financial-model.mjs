/**
 * Seed financial_snapshots from working/plasmaide_financial_model.json
 *
 * Usage (from repo root):
 *   node scripts/seed-financial-model.mjs
 *
 * Requires: app/.env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// ── Load env vars from app/.env.local ────────────────────────────────────────

function loadEnv(path) {
  try {
    const raw = readFileSync(path, 'utf-8')
    const env = {}
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
    }
    return env
  } catch {
    return {}
  }
}

const env = loadEnv(join(ROOT, 'app', '.env.local'))
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY  || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  console.error('Set them in app/.env.local or as environment variables.')
  process.exit(1)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTH_MAP = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
}

/** 'Jul-25' → '2025-07-01' */
function monthToDate(m) {
  const [mon, yr] = m.split('-')
  return `20${yr}-${MONTH_MAP[mon]}-01`
}

/** Upsert rows into financial_snapshots via Supabase REST API */
async function upsert(rows) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/financial_snapshots`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Supabase upsert failed (${res.status}): ${body}`)
  }
}

// ── Load model ────────────────────────────────────────────────────────────────

const model = JSON.parse(
  readFileSync(join(ROOT, 'working', 'plasmaide_financial_model.json'), 'utf-8')
)

const BRAND_ID = model.brand  // 'plasmaide'
const SOURCE   = 'financial_model_v2'

// Build month → fiscal_year lookup from fy_boundaries
const monthFY = {}
for (const [fy, bounds] of Object.entries(model.fy_boundaries)) {
  const startIdx = bounds.start_idx ?? 0
  // FY30 only has 1 month with no end_idx; guard accordingly
  const endIdx = bounds.end_idx ?? (model.months.length - 1)
  for (let i = startIdx; i <= endIdx && i < model.months.length; i++) {
    monthFY[model.months[i]] = fy
  }
}

// ── Seed monthly reports ──────────────────────────────────────────────────────

async function seedMonthly(reportType, rows) {
  const mapped = rows.map((row) => ({
    brand_id:      BRAND_ID,
    report_type:   reportType,
    period:        row.month,
    fiscal_year:   monthFY[row.month] ?? 'unknown',
    snapshot_date: monthToDate(row.month),
    data:          row,
    source:        SOURCE,
  }))

  await upsert(mapped)
  console.log(`  ✓ ${reportType}: ${mapped.length} rows`)
}

// ── Seed annual summaries ─────────────────────────────────────────────────────

async function seedAnnual() {
  const mapped = model.annual_summary.map((row) => ({
    brand_id:      BRAND_ID,
    report_type:   'annual_summary',
    period:        row.fiscal_year,
    fiscal_year:   row.fiscal_year,
    snapshot_date: null,
    data:          row,
    source:        SOURCE,
  }))

  await upsert(mapped)
  console.log(`  ✓ annual_summary: ${mapped.length} rows`)
}

// ── Seed drivers (assumptions) ────────────────────────────────────────────────

async function seedDrivers() {
  // Store all driver assumptions as a single row per brand
  await upsert([{
    brand_id:      BRAND_ID,
    report_type:   'drivers',
    period:        'assumptions',
    fiscal_year:   'all',
    snapshot_date: null,
    data:          model.drivers,
    source:        SOURCE,
  }])
  console.log(`  ✓ drivers: 1 row`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

console.log(`\nSeeding financial snapshots for brand: ${BRAND_ID}`)
console.log(`Supabase: ${SUPABASE_URL}\n`)

try {
  await seedMonthly('pl_monthly', model.pl_monthly)
  await seedMonthly('bs_monthly', model.bs_monthly)
  await seedMonthly('cf_monthly', model.cf_monthly)
  await seedAnnual()
  await seedDrivers()

  console.log('\nDone. Verify with:')
  console.log("  SELECT count(*), report_type FROM financial_snapshots WHERE brand_id = 'plasmaide' GROUP BY report_type;")
} catch (err) {
  console.error('\nFailed:', err.message)
  process.exit(1)
}
