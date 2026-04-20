'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useBrand } from '@/context/BrandContext'
import {
  DEFAULT_FY_CONFIG,
  getAllFiscalYears,
  getCurrentFiscalYear,
  getFiscalYearRangeLabel,
  getPriorFiscalYear,
} from '@/lib/utils/fiscal-year'
import type { FYConfig } from '@/types'
import type { CFOReport } from '@/lib/agents/cfo/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type Snap = {
  id: string
  report_type: string
  period: string
  fiscal_year: string
  snapshot_date: string | null
  data: Record<string, number>
}

type TabId = 'overview' | 'pl' | 'bs' | 'cf'

// ─── Formatting ───────────────────────────────────────────────────────────────

function fmtAUD(v: number | null | undefined, compact = false): string {
  if (v === null || v === undefined) return '—'
  const abs = Math.abs(v)
  let s: string
  if (compact && abs >= 1_000_000) {
    s = 'A$' + (abs / 1_000_000).toFixed(1) + 'M'
  } else if (compact && abs >= 1_000) {
    s = 'A$' + (abs / 1_000).toFixed(0) + 'K'
  } else {
    s = 'A$' + Math.round(abs).toLocaleString('en-AU')
  }
  return v < 0 ? `(${s})` : s
}

function fmtPct(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  const pct = (v * 100).toFixed(1) + '%'
  return v < 0 ? `(${pct})` : pct
}

function numColor(v: number | null | undefined): string {
  if (v === null || v === undefined || v === 0) return 'inherit'
  return v < 0 ? 'var(--bad)' : 'inherit'
}

function growthColor(v: number | null | undefined): string {
  if (v === null || v === undefined) return 'var(--ink-4)'
  return v >= 0 ? 'var(--ok)' : 'var(--bad)'
}

function growthVal(curr: number, prior: number): number | null {
  if (!prior) return null
  return (curr - prior) / Math.abs(prior)
}

// ─── P&L Row definitions ──────────────────────────────────────────────────────

type RowDef = {
  label: string
  key?: string
  type?: 'aud' | 'pct'
  bold?: boolean
  header?: boolean
  indent?: boolean
  highlight?: boolean
}

const PL_ROWS: RowDef[] = [
  { label: 'REVENUE', header: true },
  { label: 'DTC',                    key: 'dtc_revenue',          type: 'aud', indent: true },
  { label: 'Wholesale',              key: 'wholesale_revenue',    type: 'aud', indent: true },
  { label: 'Retail',                 key: 'retail_revenue',       type: 'aud', indent: true },
  { label: 'Total Revenue',          key: 'total_revenue',        type: 'aud', bold: true },
  { label: 'COST OF GOODS', header: true },
  { label: 'Product Cost',           key: 'product_cost',         type: 'aud', indent: true },
  { label: 'Fulfillment',            key: 'fulfillment',          type: 'aud', indent: true },
  { label: 'Transaction Fees',       key: 'transaction_fees',     type: 'aud', indent: true },
  { label: 'Total COGS',             key: 'total_cogs',           type: 'aud', bold: true },
  { label: 'GROSS PROFIT',           key: 'gross_profit',         type: 'aud', bold: true, highlight: true },
  { label: 'Gross Margin',           key: 'gross_margin_pct',     type: 'pct', indent: true },
  { label: 'OPEX', header: true },
  { label: 'Performance Mktg',       key: 'performance_marketing',type: 'aud', indent: true },
  { label: 'Brand Marketing',        key: 'brand_marketing',      type: 'aud', indent: true },
  { label: 'Salaries',               key: 'salaries',             type: 'aud', indent: true },
  { label: 'R&D',                    key: 'rnd',                  type: 'aud', indent: true },
  { label: 'G&A',                    key: 'general_admin',        type: 'aud', indent: true },
  { label: 'Platform / Tech',        key: 'platform_tech',        type: 'aud', indent: true },
  { label: 'Wholesale Sales',        key: 'wholesale_sales_cost', type: 'aud', indent: true },
  { label: 'Retail Sales',           key: 'retail_sales_cost',    type: 'aud', indent: true },
  { label: 'Depreciation',           key: 'depreciation',         type: 'aud', indent: true },
  { label: 'Total OpEx',             key: 'total_opex',           type: 'aud', bold: true },
  { label: 'EBITDA',                 key: 'ebitda',               type: 'aud', bold: true, highlight: true },
  { label: 'EBITDA Margin',          key: 'ebitda_margin_pct',    type: 'pct', indent: true },
  { label: 'EBIT',                   key: 'ebit',                 type: 'aud', indent: true },
  { label: 'Tax',                    key: 'tax',                  type: 'aud', indent: true },
  { label: 'NET INCOME',             key: 'net_income',           type: 'aud', bold: true, highlight: true },
  { label: 'Net Margin',             key: 'net_margin_pct',       type: 'pct', indent: true },
]

const BS_ROWS: RowDef[] = [
  { label: 'CURRENT ASSETS', header: true },
  { label: 'Cash',                   key: 'cash',                    type: 'aud', indent: true },
  { label: 'Accounts Receivable',    key: 'accounts_receivable',     type: 'aud', indent: true },
  { label: 'Inventory',              key: 'inventory',               type: 'aud', indent: true },
  { label: 'Total Current Assets',   key: 'total_current_assets',    type: 'aud', bold: true },
  { label: 'FIXED ASSETS', header: true },
  { label: 'PP&E (Net)',             key: 'ppe_net',                 type: 'aud', indent: true },
  { label: 'TOTAL ASSETS',           key: 'total_assets',            type: 'aud', bold: true, highlight: true },
  { label: 'LIABILITIES', header: true },
  { label: 'Accounts Payable',       key: 'accounts_payable',        type: 'aud', indent: true },
  { label: 'Tax Payable',            key: 'tax_payable',             type: 'aud', indent: true },
  { label: 'Total Liabilities',      key: 'total_current_liabilities', type: 'aud', bold: true },
  { label: 'EQUITY', header: true },
  { label: 'Retained Earnings',      key: 'retained_earnings',       type: 'aud', indent: true },
  { label: 'Contributed Capital',    key: 'contributed_capital',     type: 'aud', indent: true },
  { label: 'Total Equity',           key: 'total_equity',            type: 'aud', bold: true },
  { label: 'TOTAL L + E',            key: 'total_liabilities_equity',type: 'aud', bold: true, highlight: true },
  { label: 'Balance Check',          key: 'balance_check',           type: 'aud', indent: true },
]

const CF_ROWS: RowDef[] = [
  { label: 'OPERATING ACTIVITIES', header: true },
  { label: 'Net Income',             key: 'net_income',              type: 'aud', indent: true },
  { label: '+ Depreciation',         key: 'depreciation_add_back',   type: 'aud', indent: true },
  { label: '∆ Accounts Receivable',  key: 'change_ar',               type: 'aud', indent: true },
  { label: '∆ Inventory',            key: 'change_inventory',        type: 'aud', indent: true },
  { label: '∆ Accounts Payable',     key: 'change_ap',               type: 'aud', indent: true },
  { label: '∆ Tax Payable',          key: 'change_tax_payable',      type: 'aud', indent: true },
  { label: 'Total WC Change',        key: 'total_working_capital_change', type: 'aud', bold: true },
  { label: 'Net Cash — Operating',   key: 'net_cash_operating',      type: 'aud', bold: true, highlight: true },
  { label: 'INVESTING ACTIVITIES', header: true },
  { label: 'CapEx',                  key: 'capex',                   type: 'aud', indent: true },
  { label: 'Net Cash — Investing',   key: 'net_cash_investing',      type: 'aud', bold: true },
  { label: 'FINANCING ACTIVITIES', header: true },
  { label: 'Equity Injection',       key: 'equity_injection',        type: 'aud', indent: true },
  { label: 'Net Cash — Financing',   key: 'net_cash_financing',      type: 'aud', bold: true },
  { label: 'NET CHANGE IN CASH',     key: 'net_change_cash',         type: 'aud', bold: true, highlight: true },
  { label: 'Opening Cash',           key: 'opening_cash',            type: 'aud', indent: true },
  { label: 'CLOSING CASH',           key: 'closing_cash',            type: 'aud', bold: true, highlight: true },
]

// ─── Mini bar chart ───────────────────────────────────────────────────────────

function BarChart({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(...values.map(Math.abs), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 100, padding: '0 4px' }}>
      {values.map((v, i) => {
        const h = Math.max(2, (Math.abs(v) / max) * 88)
        const isNeg = v < 0
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, height: '100%', justifyContent: 'flex-end' }}>
            <div style={{
              width: '100%', height: h,
              background: isNeg ? 'var(--bad)' : 'var(--accent)',
              borderRadius: '3px 3px 0 0', opacity: 0.85,
            }} />
            <span style={{ fontSize: 9, color: 'var(--ink-4)', fontFamily: 'Geist Mono, monospace', lineHeight: 1, whiteSpace: 'nowrap' }}>
              {labels[i]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Mini line chart ──────────────────────────────────────────────────────────

function LineChart({ values, labels }: { values: number[]; labels: string[] }) {
  const W = 600
  const H = 80
  const pad = { t: 8, r: 4, b: 24, l: 4 }
  const innerW = W - pad.l - pad.r
  const innerH = H - pad.t - pad.b

  if (values.length < 2) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const pts = values.map((v, i) => ({
    x: pad.l + (i / (values.length - 1)) * innerW,
    y: pad.t + (1 - (v - min) / range) * innerH,
  }))

  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const areaD = `${pathD} L ${pts[pts.length - 1].x.toFixed(1)} ${(H - pad.b).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(H - pad.b).toFixed(1)} Z`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="cf-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#cf-fill)" />
      <path d={pathD} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="2.5" fill="var(--accent)" />
          <text x={p.x} y={H - 4} textAnchor="middle" fontSize="8" fill="var(--ink-4)"
            fontFamily="Geist Mono, monospace">
            {labels[i]}
          </text>
        </g>
      ))}
    </svg>
  )
}

// ─── Financial table ──────────────────────────────────────────────────────────

function FinTable({
  rows,
  monthCols,
  annualData,
  sums,
}: {
  rows: RowDef[]
  monthCols: { label: string; data: Record<string, number> }[]
  annualData: Record<string, number> | null
  sums: Record<string, number>
}) {
  function cellVal(row: RowDef, data: Record<string, number> | null): string {
    if (!row.key || !data) return '—'
    const v = data[row.key]
    if (v === undefined || v === null) return '—'
    if (row.type === 'pct') return fmtPct(v)
    return fmtAUD(v)
  }

  function cellColor(row: RowDef, data: Record<string, number> | null): string {
    if (!row.key || !data || row.type === 'pct') return 'inherit'
    return numColor(data[row.key])
  }

  function annualVal(row: RowDef): string {
    if (!row.key) return '—'
    if (row.type === 'pct' && annualData) {
      const v = annualData[row.key]
      return v !== undefined ? fmtPct(v) : '—'
    }
    const v = sums[row.key]
    if (v !== undefined) return fmtAUD(v)
    if (annualData) {
      const av = annualData[row.key]
      return av !== undefined ? fmtAUD(av) : '—'
    }
    return '—'
  }

  function annualColor(row: RowDef): string {
    if (!row.key || row.type === 'pct') return 'inherit'
    const v = sums[row.key] ?? annualData?.[row.key]
    return v !== undefined ? numColor(v) : 'inherit'
  }

  const headerStyle: React.CSSProperties = {
    fontFamily: 'Geist Mono, monospace',
    fontSize: 10,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--ink-4)',
    background: 'var(--panel)',
    padding: '8px 12px',
    borderBottom: '1px solid var(--line)',
    whiteSpace: 'nowrap',
    position: 'sticky',
    top: 0,
    zIndex: 2,
  }

  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--line)', borderRadius: 'var(--radius)' }}>
      <table style={{ borderCollapse: 'collapse', minWidth: '100%', fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ ...headerStyle, left: 0, zIndex: 3, position: 'sticky', minWidth: 160, textAlign: 'left' }}>
              Line Item
            </th>
            {monthCols.map((col, i) => (
              <th key={i} style={{ ...headerStyle, textAlign: 'right', minWidth: 88 }}>{col.label}</th>
            ))}
            <th style={{ ...headerStyle, textAlign: 'right', minWidth: 104, background: 'var(--panel-2)', borderLeft: '1px solid var(--line)' }}>
              Annual
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => {
            if (row.header) {
              return (
                <tr key={ri}>
                  <td colSpan={monthCols.length + 2} style={{
                    background: 'var(--panel-2)',
                    fontFamily: 'Geist Mono, monospace',
                    fontSize: 10,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'var(--ink-3)',
                    fontWeight: 600,
                    padding: '6px 12px',
                    borderTop: ri > 0 ? '1px solid var(--line)' : undefined,
                    borderBottom: '1px solid var(--line)',
                  }}>
                    {row.label}
                  </td>
                </tr>
              )
            }

            const rowBg = row.highlight ? 'var(--panel-2)' : ri % 2 === 0 ? 'var(--panel)' : 'var(--panel)'
            const fw = row.bold ? 600 : 400

            return (
              <tr key={ri} style={{ background: rowBg }}>
                <td style={{
                  padding: '6px 12px',
                  paddingLeft: row.indent ? 24 : 12,
                  color: 'var(--ink-2)',
                  fontWeight: fw,
                  whiteSpace: 'nowrap',
                  borderBottom: '1px solid var(--line-2)',
                  position: 'sticky',
                  left: 0,
                  background: rowBg,
                  zIndex: 1,
                  fontSize: row.bold ? 13 : 12,
                }}>
                  {row.label}
                </td>
                {monthCols.map((col, ci) => (
                  <td key={ci} style={{
                    padding: '6px 12px',
                    textAlign: 'right',
                    fontFamily: 'Geist Mono, monospace',
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: 12,
                    color: cellColor(row, col.data),
                    fontWeight: fw,
                    borderBottom: '1px solid var(--line-2)',
                    whiteSpace: 'nowrap',
                  }}>
                    {cellVal(row, col.data)}
                  </td>
                ))}
                <td style={{
                  padding: '6px 12px',
                  textAlign: 'right',
                  fontFamily: 'Geist Mono, monospace',
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: 12,
                  fontWeight: fw,
                  color: annualColor(row),
                  borderBottom: '1px solid var(--line-2)',
                  borderLeft: '1px solid var(--line)',
                  background: 'var(--panel-2)',
                  whiteSpace: 'nowrap',
                }}>
                  {annualVal(row)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── KPI Tile ─────────────────────────────────────────────────────────────────

function KPITile({
  label, value, sub, growth, priorLabel,
}: {
  label: string
  value: string
  sub?: string
  growth?: number | null
  priorLabel?: string
}) {
  return (
    <div style={{
      background: 'var(--panel)',
      border: '1px solid var(--line)',
      borderRadius: 'var(--radius)',
      padding: '18px 20px',
    }}>
      <div style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-0.02em', color: 'var(--ink)', lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>{sub}</div>
      )}
      {growth !== undefined && growth !== null && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 12, fontWeight: 600, color: growthColor(growth),
            background: growth >= 0 ? 'var(--ok-bg)' : 'var(--bad-bg)',
            padding: '2px 6px', borderRadius: 4,
          }}>
            {growth >= 0 ? '+' : ''}{(growth * 100).toFixed(1)}%
          </span>
          {priorLabel && <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>vs {priorLabel}</span>}
        </div>
      )}
    </div>
  )
}

// ─── CFO helpers ──────────────────────────────────────────────────────────────

function fmtRatio(v: number | null | undefined): string {
  if (v == null) return '—'
  return v.toFixed(1) + 'x'
}

function fmtMo(v: number | null | undefined): string {
  if (v == null) return '—'
  return v.toFixed(1) + ' mo'
}

function fmtVariancePct(v: number | null | undefined): string {
  if (v == null) return '—'
  return (v >= 0 ? '+' : '') + v.toFixed(1) + '%'
}

function statusColor(s: string): string {
  if (s === 'ahead') return 'var(--ok)'
  if (s === 'behind') return 'var(--bad)'
  return 'var(--ink-3)'
}

function statusBg(s: string): string {
  if (s === 'ahead') return 'var(--ok-bg)'
  if (s === 'behind') return 'var(--bad-bg)'
  return 'var(--panel-2)'
}

function healthColor(h: string): string {
  if (h === 'healthy') return 'var(--ok)'
  if (h === 'critical') return 'var(--bad)'
  return '#e8a23a'
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab({
  annual, priorAnnual, monthlyPL, selectedFY, priorFY, cfoReport,
}: {
  annual: Record<string, number> | null
  priorAnnual: Record<string, number> | null
  monthlyPL: { label: string; data: Record<string, number> }[]
  selectedFY: string
  priorFY: string
  cfoReport: CFOReport | null
}) {
  if (!annual) {
    return <div style={{ color: 'var(--ink-4)', padding: '32px 0', textAlign: 'center' }}>No annual summary available for {selectedFY}.</div>
  }

  const totalRev  = annual.total_revenue ?? 0
  const priorRev  = priorAnnual?.total_revenue ?? 0
  const dtcPct    = totalRev ? (annual.dtc_revenue ?? 0) / totalRev : 0
  const wsPct     = totalRev ? (annual.wholesale_revenue ?? 0) / totalRev : 0
  const retPct    = totalRev ? (annual.retail_revenue ?? 0) / totalRev : 0

  const revValues = monthlyPL.map((m) => m.data.total_revenue ?? 0)
  const revLabels = monthlyPL.map((m) => m.label)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPI grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <KPITile
          label="Total Revenue"
          value={fmtAUD(annual.total_revenue)}
          growth={growthVal(annual.total_revenue ?? 0, priorRev)}
          priorLabel={priorFY}
        />
        <KPITile
          label="Gross Margin"
          value={fmtPct(annual.gross_margin_pct)}
          sub={fmtAUD(annual.gross_profit)}
          growth={priorAnnual ? growthVal(annual.gross_margin_pct ?? 0, priorAnnual.gross_margin_pct ?? 0) : null}
          priorLabel={priorFY}
        />
        <KPITile
          label="EBITDA"
          value={fmtAUD(annual.ebitda)}
          sub={fmtPct(annual.ebitda_margin_pct) + ' margin'}
          growth={priorAnnual ? growthVal(annual.ebitda ?? 0, priorAnnual.ebitda ?? 0) : null}
          priorLabel={priorFY}
        />
        <KPITile
          label="Net Income"
          value={fmtAUD(annual.net_income)}
          sub={fmtPct(annual.net_margin_pct) + ' margin'}
          growth={priorAnnual ? growthVal(annual.net_income ?? 0, priorAnnual.net_income ?? 0) : null}
          priorLabel={priorFY}
        />
      </div>

      {/* Channel mix + Revenue chart */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
        {/* Channel mix */}
        <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '18px 20px' }}>
          <div style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>
            Channel Mix
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { label: 'DTC', key: 'dtc_revenue', pct: dtcPct, color: 'var(--accent)' },
              { label: 'Wholesale', key: 'wholesale_revenue', pct: wsPct, color: '#7c5cbf' },
              { label: 'Retail', key: 'retail_revenue', pct: retPct, color: 'var(--ok)' },
            ].map((ch) => (
              <div key={ch.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: 'var(--ink-2)', fontWeight: 500 }}>{ch.label}</span>
                  <span style={{ fontSize: 12, fontFamily: 'Geist Mono, monospace', color: 'var(--ink-3)' }}>
                    {fmtAUD(annual[ch.key] ?? 0, true)} · {(ch.pct * 100).toFixed(0)}%
                  </span>
                </div>
                <div style={{ height: 6, background: 'var(--line)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.max(ch.pct * 100, 0)}%`, background: ch.color, borderRadius: 3 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly revenue bar chart */}
        <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '18px 20px' }}>
          <div style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>
            Monthly Revenue — {selectedFY}
          </div>
          {revValues.length > 0
            ? <BarChart values={revValues} labels={revLabels} />
            : <div style={{ color: 'var(--ink-4)', fontSize: 13, paddingTop: 24 }}>No monthly data</div>
          }
        </div>
      </div>

      {/* Secondary KPIs row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Performance Mktg', val: fmtAUD(annual.performance_marketing, true) },
          { label: 'Total OpEx', val: fmtAUD(annual.total_opex, true) },
          { label: 'EBIT', val: fmtAUD(annual.ebit, true) },
          { label: 'Tax', val: fmtAUD(annual.tax, true) },
        ].map((k) => (
          <div key={k.label} style={{
            background: 'var(--panel-2)', border: '1px solid var(--line)',
            borderRadius: 'var(--radius)', padding: '14px 16px',
          }}>
            <div style={{ fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--ink)' }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* ── CFO Analysis (when report available) ── */}
      {cfoReport && (
        <>
          {/* Unit Economics */}
          <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Unit Economics
              </div>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                color: healthColor(cfoReport.unit_economics.health),
                background: cfoReport.unit_economics.health === 'healthy' ? 'var(--ok-bg)' : cfoReport.unit_economics.health === 'critical' ? 'var(--bad-bg)' : '#fef3e2',
              }}>
                {cfoReport.unit_economics.health.toUpperCase()}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12 }}>
              {[
                { label: 'CAC', val: fmtAUD(cfoReport.unit_economics.cac, true) },
                { label: 'LTV', val: fmtAUD(cfoReport.unit_economics.ltv, true) },
                { label: 'LTV:CAC', val: fmtRatio(cfoReport.unit_economics.ltv_cac_ratio) },
                { label: 'ROAS', val: fmtRatio(cfoReport.unit_economics.roas) },
                { label: 'Payback', val: fmtMo(cfoReport.unit_economics.payback_months) },
                { label: 'Gross Margin', val: cfoReport.unit_economics.gross_margin_pct != null ? fmtPct(cfoReport.unit_economics.gross_margin_pct) : '—' },
              ].map((k) => (
                <div key={k.label}>
                  <div style={{ fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>{k.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 500, fontFamily: 'Geist Mono, monospace', color: 'var(--ink)' }}>{k.val}</div>
                </div>
              ))}
            </div>
            {cfoReport.unit_economics.notes.length > 0 && (
              <div style={{ marginTop: 12, fontSize: 11, color: 'var(--ink-4)', fontStyle: 'italic' }}>
                {cfoReport.unit_economics.notes.join(' · ')}
              </div>
            )}
          </div>

          {/* Budget vs Actual */}
          <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Budget vs Actual — {cfoReport.budget_vs_actual.fiscal_year}
              </div>
              {cfoReport.budget_vs_actual.ytd_revenue_pct != null && (
                <span style={{ fontSize: 12, color: 'var(--ink-3)', fontFamily: 'Geist Mono, monospace' }}>
                  {cfoReport.budget_vs_actual.ytd_revenue_pct.toFixed(0)}% of revenue target
                </span>
              )}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    {['Metric', 'Target', 'Actual', 'Variance', 'Status'].map(h => (
                      <th key={h} style={{ padding: '6px 12px', textAlign: h === 'Metric' ? 'left' : 'right', fontSize: 10, fontFamily: 'Geist Mono, monospace', letterSpacing: '0.06em', color: 'var(--ink-4)', textTransform: 'uppercase', fontWeight: 500 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cfoReport.budget_vs_actual.lines.map((line) => (
                    <tr key={line.metric} style={{ borderBottom: '1px solid var(--line-2)' }}>
                      <td style={{ padding: '7px 12px', color: 'var(--ink-2)', fontWeight: 500 }}>{line.label}</td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'Geist Mono, monospace', color: 'var(--ink-3)' }}>
                        {line.target > 0 ? (line.metric.endsWith('_pct') ? fmtPct(line.target / 100) : fmtAUD(line.target, true)) : '—'}
                      </td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'Geist Mono, monospace', color: 'var(--ink)' }}>
                        {line.actual != null ? (line.metric.endsWith('_pct') ? fmtPct(line.actual / 100) : fmtAUD(line.actual, true)) : '—'}
                      </td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', fontFamily: 'Geist Mono, monospace', color: line.variance_pct != null && line.variance_pct < 0 ? 'var(--bad)' : 'var(--ok)' }}>
                        {fmtVariancePct(line.variance_pct)}
                      </td>
                      <td style={{ padding: '7px 12px', textAlign: 'right' }}>
                        {line.status !== 'no_data' && (
                          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 6px', borderRadius: 4, color: statusColor(line.status), background: statusBg(line.status) }}>
                            {line.status.replace('_', ' ').toUpperCase()}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cash Forecast + CFO Report row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
            {/* Cash Forecast */}
            <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '18px 20px' }}>
              <div style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16 }}>
                Cash Forecast
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Est. Cash Position</div>
                  <div style={{ fontSize: 22, fontWeight: 500, fontFamily: 'Geist Mono, monospace' }}>
                    {fmtAUD(cfoReport.cash_forecast.latest_closing_cash, true)}
                  </div>
                  {cfoReport.cash_forecast.month_label && (
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>as of {cfoReport.cash_forecast.month_label}</div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Avg Monthly Net</div>
                  <div style={{ fontSize: 16, fontWeight: 500, fontFamily: 'Geist Mono, monospace', color: (cfoReport.cash_forecast.avg_monthly_net ?? 0) < 0 ? 'var(--bad)' : 'inherit' }}>
                    {fmtAUD(cfoReport.cash_forecast.avg_monthly_net, true)}
                  </div>
                </div>
                {cfoReport.cash_forecast.runway_months != null && (
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Runway</div>
                    <div style={{ fontSize: 16, fontWeight: 500, fontFamily: 'Geist Mono, monospace', color: cfoReport.cash_forecast.runway_months < 6 ? 'var(--bad)' : 'inherit' }}>
                      {cfoReport.cash_forecast.runway_months} mo
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Trend</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: cfoReport.cash_forecast.trend === 'improving' ? 'var(--ok)' : cfoReport.cash_forecast.trend === 'declining' ? 'var(--bad)' : 'var(--ink-3)' }}>
                    {cfoReport.cash_forecast.trend.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            {/* CFO Report */}
            <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  CFO Analysis
                </div>
                {cfoReport.model_used && (
                  <span style={{ fontSize: 10, color: 'var(--ink-4)', fontFamily: 'Geist Mono, monospace' }}>
                    {cfoReport.model_used} · {cfoReport.cost_usd > 0 ? `$${cfoReport.cost_usd.toFixed(3)}` : 'data-only'}
                  </span>
                )}
              </div>
              {cfoReport.narrative ? (
                <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6, marginBottom: 16 }}>
                  {cfoReport.narrative}
                </p>
              ) : (
                <p style={{ fontSize: 13, color: 'var(--ink-4)', fontStyle: 'italic', marginBottom: 16 }}>
                  Run CFO analysis to generate narrative.
                </p>
              )}
              {cfoReport.recommendations.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {cfoReport.recommendations.slice(0, 3).map((r, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', background: 'var(--panel-2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line-2)' }}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 5px', borderRadius: 3, flexShrink: 0, marginTop: 1,
                        color: r.priority === 'high' ? 'var(--bad)' : r.priority === 'medium' ? '#e8a23a' : 'var(--ink-3)',
                        background: r.priority === 'high' ? 'var(--bad-bg)' : r.priority === 'medium' ? '#fef3e2' : 'var(--panel)',
                      }}>
                        {r.priority.toUpperCase()}
                      </span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>{r.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-3)' }}>{r.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {cfoReport.margin_alerts.length > 0 && (
                <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {cfoReport.margin_alerts.map((a, i) => (
                    <span key={i} style={{
                      fontSize: 11, fontWeight: 500, padding: '3px 8px', borderRadius: 4,
                      color: a.severity === 'high' ? 'var(--bad)' : a.severity === 'medium' ? '#c87d1a' : 'var(--ink-3)',
                      background: a.severity === 'high' ? 'var(--bad-bg)' : a.severity === 'medium' ? '#fef3e2' : 'var(--panel-2)',
                      border: '1px solid currentColor', opacity: 0.85,
                    }}>
                      ⚠ {a.title}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Cash Flow Tab ────────────────────────────────────────────────────────────

function CashFlowTab({
  monthCols,
  annualData,
  sums,
}: {
  monthCols: { label: string; data: Record<string, number> }[]
  annualData: Record<string, number> | null
  sums: Record<string, number>
}) {
  const cashValues = monthCols.map((m) => m.data.closing_cash ?? 0)
  const cashLabels = monthCols.map((m) => m.label)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {cashValues.length > 1 && (
        <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '18px 20px' }}>
          <div style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
            Closing Cash Position
          </div>
          <LineChart values={cashValues} labels={cashLabels} />
        </div>
      )}
      <FinTable rows={CF_ROWS} monthCols={monthCols} annualData={annualData} sums={sums} />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function FinancialPage() {
  const { activeBrand } = useBrand()

  const [fyConfig, setFyConfig] = useState<FYConfig>(DEFAULT_FY_CONFIG)
  const [fyOptions, setFyOptions] = useState<string[]>([])
  const [selectedFY, setSelectedFY] = useState<string>('')

  const [snapshots, setSnapshots] = useState<Snap[]>([])
  const [allAnnual, setAllAnnual] = useState<Snap[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [cfoReport, setCfoReport] = useState<CFOReport | null>(null)

  // ── Load fy_config on brand change ──────────────────────────────────────────

  useEffect(() => {
    if (!activeBrand) return
    fetch(`/api/financial/snapshots?brand_id=${activeBrand.brand_id}&report_type=drivers`)
      .then(() => {})
      .catch(() => {})

    // Load fy_config from brand_settings via Supabase directly in client
    import('@/lib/supabase/client').then(({ createClient }) => {
      createClient()
        .from('brand_settings')
        .select('fy_config')
        .eq('brand_id', activeBrand.brand_id)
        .single()
        .then(({ data }) => {
          const cfg: FYConfig = data?.fy_config ?? DEFAULT_FY_CONFIG
          setFyConfig(cfg)
          const opts = getAllFiscalYears(cfg, 6)
          setFyOptions(opts)
          setSelectedFY(getCurrentFiscalYear(cfg))
        })
    })
  }, [activeBrand?.brand_id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch latest CFO report ──────────────────────────────────────────────────

  useEffect(() => {
    if (!activeBrand) return
    fetch(`/api/agents/cfo/report?brand_id=${activeBrand.brand_id}`)
      .then((r) => r.json())
      .then((data) => setCfoReport(data ?? null))
      .catch(() => setCfoReport(null))
  }, [activeBrand?.brand_id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch all annual summaries ───────────────────────────────────────────────

  useEffect(() => {
    if (!activeBrand) return
    fetch(`/api/financial/snapshots?brand_id=${activeBrand.brand_id}&report_type=annual_summary`)
      .then((r) => r.json())
      .then((data: Snap[]) => setAllAnnual(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [activeBrand?.brand_id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch monthly snapshots for selected FY ─────────────────────────────────

  const fetchMonthly = useCallback(async (brandId: string, fy: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/financial/snapshots?brand_id=${brandId}&fy=${fy}&report_type=pl_monthly,bs_monthly,cf_monthly`
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: Snap[] = await res.json()
      setSnapshots(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!activeBrand || !selectedFY) return
    fetchMonthly(activeBrand.brand_id, selectedFY)
  }, [activeBrand?.brand_id, selectedFY, fetchMonthly]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derive typed data ────────────────────────────────────────────────────────

  const plMonthly = useMemo(() =>
    snapshots
      .filter((s) => s.report_type === 'pl_monthly')
      .sort((a, b) => (a.snapshot_date ?? '').localeCompare(b.snapshot_date ?? '')),
    [snapshots]
  )
  const bsMonthly = useMemo(() =>
    snapshots
      .filter((s) => s.report_type === 'bs_monthly')
      .sort((a, b) => (a.snapshot_date ?? '').localeCompare(b.snapshot_date ?? '')),
    [snapshots]
  )
  const cfMonthly = useMemo(() =>
    snapshots
      .filter((s) => s.report_type === 'cf_monthly')
      .sort((a, b) => (a.snapshot_date ?? '').localeCompare(b.snapshot_date ?? '')),
    [snapshots]
  )

  const annualSnap = useMemo(() =>
    allAnnual.find((s) => s.period === selectedFY) ?? null,
    [allAnnual, selectedFY]
  )
  const priorFY = selectedFY ? getPriorFiscalYear(selectedFY, fyConfig) : ''
  const priorAnnualSnap = useMemo(() =>
    allAnnual.find((s) => s.period === priorFY) ?? null,
    [allAnnual, priorFY]
  )

  // Month column headers: abbreviated month name from period 'Jul-25'
  function toMonthLabel(period: string): string {
    return period.split('-')[0] // 'Jul'
  }

  const plCols = plMonthly.map((s) => ({ label: toMonthLabel(s.period), data: s.data }))
  const bsCols = bsMonthly.map((s) => ({ label: toMonthLabel(s.period), data: s.data }))
  const cfCols = cfMonthly.map((s) => ({ label: toMonthLabel(s.period), data: s.data }))

  // Sums of all currency fields across months (for Annual column)
  function computeSums(rows: Snap[]): Record<string, number> {
    const out: Record<string, number> = {}
    for (const snap of rows) {
      for (const [k, v] of Object.entries(snap.data)) {
        if (typeof v === 'number' && !k.endsWith('_pct') && k !== 'month') {
          out[k] = (out[k] ?? 0) + v
        }
      }
    }
    return out
  }

  const plSums = useMemo(() => computeSums(plMonthly), [plMonthly])
  const bsSums = useMemo(() => computeSums(bsMonthly), [bsMonthly])
  const cfSums = useMemo(() => computeSums(cfMonthly), [cfMonthly])

  const rangeLabel = selectedFY ? getFiscalYearRangeLabel(selectedFY, fyConfig) : ''

  // ── Render ───────────────────────────────────────────────────────────────────

  if (!activeBrand) {
    return (
      <div className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Financial</h1>
            <div className="page-sub">P&L, Balance Sheet, and Cash Flow from the financial model.</div>
          </div>
        </div>
        <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', padding: '40px 20px', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
          Select a brand to view financial data.
        </div>
      </div>
    )
  }

  const TABS: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'pl',       label: 'P&L' },
    { id: 'bs',       label: 'Balance Sheet' },
    { id: 'cf',       label: 'Cash Flow' },
  ]

  return (
    <div className="page">
      {/* Header */}
      <div className="page-head">
        <div>
          <h1 className="page-title">Financial</h1>
          <div className="page-sub">
            {selectedFY
              ? `${selectedFY} · ${rangeLabel} · ${activeBrand.name}`
              : 'P&L, Balance Sheet, and Cash Flow from the financial model.'}
          </div>
        </div>
        {/* FY selector */}
        {fyOptions.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Fiscal Year
            </span>
            <select
              value={selectedFY}
              onChange={(e) => setSelectedFY(e.target.value)}
              style={{
                fontSize: 13, border: '1px solid var(--line-3)',
                borderRadius: 'var(--radius-sm)', padding: '5px 10px',
                background: 'var(--panel)', color: 'var(--ink)',
                cursor: 'pointer',
              }}
            >
              {fyOptions.map((fy) => (
                <option key={fy} value={fy}>{fy}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 0, borderBottom: '1px solid var(--line)',
        marginBottom: 20,
      }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 18px',
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? 'var(--ink)' : 'var(--ink-3)',
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${activeTab === tab.id ? 'var(--accent)' : 'transparent'}`,
              cursor: 'pointer',
              marginBottom: -1,
              transition: 'color 120ms',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: 'var(--bad-bg)', border: '1px solid #eccaca', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 13, color: 'var(--bad)', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && !error && (
        <div style={{ display: 'flex', gap: 12, flexDirection: 'column' }}>
          {[80, 60, 100, 60].map((h, i) => (
            <div key={i} style={{ height: h, background: 'var(--line-2)', borderRadius: 'var(--radius)', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      )}

      {/* Content */}
      {!loading && (
        <>
          {activeTab === 'overview' && (
            <OverviewTab
              annual={annualSnap?.data ?? null}
              priorAnnual={priorAnnualSnap?.data ?? null}
              monthlyPL={plCols}
              selectedFY={selectedFY}
              priorFY={priorFY}
              cfoReport={cfoReport}
            />
          )}

          {activeTab === 'pl' && (
            <FinTable
              rows={PL_ROWS}
              monthCols={plCols}
              annualData={annualSnap?.data ?? null}
              sums={plSums}
            />
          )}

          {activeTab === 'bs' && (
            <FinTable
              rows={BS_ROWS}
              monthCols={bsCols}
              annualData={null}
              sums={bsSums}
            />
          )}

          {activeTab === 'cf' && (
            <CashFlowTab
              monthCols={cfCols}
              annualData={null}
              sums={cfSums}
            />
          )}
        </>
      )}
    </div>
  )
}
