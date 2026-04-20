import type { FYConfig } from '@/types'

export const FY_PRESETS: Record<Exclude<FYConfig['type'], 'custom'>, Omit<FYConfig, 'type'>> = {
  au: { start_month: 7,  start_day: 1, end_month: 6,  end_day: 30 },
  us: { start_month: 1,  start_day: 1, end_month: 12, end_day: 31 },
  uk: { start_month: 4,  start_day: 6, end_month: 4,  end_day: 5  },
}

export const DEFAULT_FY_CONFIG: FYConfig = { type: 'au', ...FY_PRESETS.au }

// Does the FY span two calendar years?
function spansYears(config: FYConfig): boolean {
  if (config.start_month > config.end_month) return true
  if (config.start_month === config.end_month && config.start_day > config.end_day) return true
  return false
}

function pad2(n: number): string {
  return String(n % 100).padStart(2, '0')
}

/**
 * Returns the FY label for a FY that *starts* in startCalendarYear.
 * - AU:  "FY26"    (named by end year — Jul 2025 → FY26)
 * - US:  "FY25"    (named by start year — Jan 2025 → FY25)
 * - UK:  "FY25/26" (start/end — Apr 2025 → FY25/26)
 * - custom spans: "FY25/26"; custom same-year: "FY25"
 */
export function getFiscalYearLabel(startCalendarYear: number, config: FYConfig): string {
  if (config.type === 'us') {
    return `FY${pad2(startCalendarYear)}`
  }
  if (config.type === 'au') {
    return `FY${pad2(startCalendarYear + 1)}`
  }
  // uk and custom
  if (spansYears(config)) {
    return `FY${pad2(startCalendarYear)}/${pad2(startCalendarYear + 1)}`
  }
  return `FY${pad2(startCalendarYear)}`
}

/**
 * Returns the start calendar year encoded in a FY label given the config.
 */
function parseStartYear(fyLabel: string, config: FYConfig): number {
  const digits = fyLabel.replace('FY', '')
  if (config.type === 'au') {
    // label encodes end year
    const endShort = parseInt(digits, 10)
    const endYear = endShort < 50 ? 2000 + endShort : 1900 + endShort
    return endYear - 1
  }
  // us, uk, custom: label encodes start year (first part if slash-separated)
  const startShort = parseInt(digits.split('/')[0], 10)
  return startShort < 50 ? 2000 + startShort : 1900 + startShort
}

/**
 * Returns the { start, end } Date objects for a given FY label and config.
 * E.g. "FY26" with AU config → { start: 2025-07-01, end: 2026-06-30 }
 */
export function getFiscalYearRange(fyLabel: string, config: FYConfig): { start: Date; end: Date } {
  const startYear = parseStartYear(fyLabel, config)
  const endYear = spansYears(config) ? startYear + 1 : startYear
  return {
    start: new Date(startYear, config.start_month - 1, config.start_day),
    end:   new Date(endYear,   config.end_month   - 1, config.end_day),
  }
}

/**
 * Returns the FY label for today's date.
 */
export function getCurrentFiscalYear(config: FYConfig): string {
  const today = new Date()
  const m = today.getMonth() + 1
  const d = today.getDate()
  const y = today.getFullYear()

  const pastStart =
    m > config.start_month ||
    (m === config.start_month && d >= config.start_day)

  const startYear = pastStart ? y : y - 1
  return getFiscalYearLabel(startYear, config)
}

/**
 * Returns an array of FY labels (most recent first).
 * Includes the current FY plus (count - 1) prior FYs.
 */
export function getAllFiscalYears(config: FYConfig, count = 5): string[] {
  const currentLabel = getCurrentFiscalYear(config)
  const currentStartYear = parseStartYear(currentLabel, config)

  return Array.from({ length: count }, (_, i) =>
    getFiscalYearLabel(currentStartYear - i, config)
  )
}

/**
 * Returns the FY label immediately prior to fyLabel.
 * E.g. "FY26" (AU) → "FY25"
 */
export function getPriorFiscalYear(fyLabel: string, config: FYConfig): string {
  const startYear = parseStartYear(fyLabel, config)
  return getFiscalYearLabel(startYear - 1, config)
}

const MONTH_NAMES = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec',
]

/**
 * Returns a human-readable date range string for a FY label.
 * E.g. "FY26" with AU config → "Jul 2025 – Jun 2026"
 */
export function getFiscalYearRangeLabel(fyLabel: string, config: FYConfig): string {
  const { start, end } = getFiscalYearRange(fyLabel, config)
  const s = `${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()}`
  const e = `${MONTH_NAMES[end.getMonth()]} ${end.getFullYear()}`
  return `${s} – ${e}`
}
