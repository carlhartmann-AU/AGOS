export interface UnitEconomics {
  cac: number | null
  ltv: number | null
  ltv_cac_ratio: number | null
  aov: number | null
  payback_months: number | null
  roas: number | null
  gross_margin_pct: number | null
  ad_spend: number | null
  revenue: number | null
  health: 'healthy' | 'warning' | 'critical'
  notes: string[]
}

export interface BudgetLine {
  metric: string
  label: string
  target: number
  actual: number | null
  variance: number | null
  variance_pct: number | null
  status: 'on_track' | 'behind' | 'ahead' | 'no_data'
}

export interface BudgetVsActual {
  fiscal_year: string
  lines: BudgetLine[]
  ytd_revenue_pct: number | null
}

export interface CashForecast {
  latest_closing_cash: number | null
  month_label: string | null
  avg_monthly_net: number | null
  runway_months: number | null
  trend: 'improving' | 'stable' | 'declining' | 'unknown'
}

export type AlertSeverity = 'high' | 'medium' | 'low'

export interface MarginAlert {
  type: string
  severity: AlertSeverity
  title: string
  description: string
  value: number | null
  threshold: number | null
}

export interface CFORecommendation {
  priority: 'high' | 'medium' | 'low'
  category: 'unit_economics' | 'cash' | 'budget' | 'margin' | 'operations'
  title: string
  description: string
  suggested_action: string
}

export interface CFOReport {
  id?: string
  brand_id: string
  fiscal_year: string
  window_start: string
  window_end: string
  triggered_by: string
  unit_economics: UnitEconomics
  budget_vs_actual: BudgetVsActual
  cash_forecast: CashForecast
  margin_alerts: MarginAlert[]
  narrative: string | null
  recommendations: CFORecommendation[]
  tokens_used: number
  cost_usd: number
  model_used: string | null
  created_at?: string
}
