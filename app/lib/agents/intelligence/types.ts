// lib/agents/intelligence/types.ts

export type AlertSeverity = 'info' | 'warning' | 'critical'
export type ReportType = 'weekly' | 'on_demand'
export type RecommendationPriority = 'high' | 'medium' | 'low'
export type RecommendationCategory = 'revenue' | 'content' | 'compliance' | 'operations'

export interface RevenueSummary {
  period: { start: string; end: string }
  display_currency: string
  total_revenue: number
  total_orders: number
  avg_aov: number
  new_customers: number
  returning_customers: number
  prior_revenue: number
  prior_orders: number
  prior_aov: number
  revenue_wow_pct: number
  orders_wow_pct: number
  aov_wow_pct: number
  daily: Array<{
    date: string
    revenue: number
    orders: number
    aov: number
    new_customers: number
  }>
  best_day: { date: string; revenue: number; orders: number }
  worst_day: { date: string; revenue: number; orders: number }
}

export interface ContentSummary {
  period: { start: string; end: string }
  total_generated: number
  total_approved: number
  total_rejected: number
  total_published: number
  approval_rate: number
  publish_rate: number
  avg_time_to_approve_hours: number
  by_type: Array<{
    content_type: string
    count: number
    approved: number
    published: number
  }>
  compliance_pass_rate: number
  compliance_escalated: number
  compliance_blocked: number
}

export interface ComplianceSummary {
  period: { start: string; end: string }
  total_checks: number
  pass_count: number
  warnings_count: number
  escalated_count: number
  blocked_count: number
  auto_fixes_applied: number
  pass_rate: number
  total_tokens: { input: number; output: number }
  total_cost_usd: number
  top_triggered_rules: Array<{
    rule_id: string
    rule_name: string
    trigger_count: number
    severity: string
  }>
  prior_pass_rate: number
  pass_rate_delta: number
}

export interface Anomaly {
  type: string
  severity: AlertSeverity
  title: string
  description: string
  data: Record<string, unknown>
}

export interface Recommendation {
  priority: RecommendationPriority
  category: RecommendationCategory
  title: string
  description: string
  suggested_action: string
}

export interface IntelligenceReport {
  brand_id: string
  report_type: ReportType
  window_start: string
  window_end: string
  revenue_summary: RevenueSummary
  content_summary: ContentSummary
  compliance_summary: ComplianceSummary
  anomalies: Anomaly[]
  narrative: string | null
  recommendations: Recommendation[]
  narrator_enabled: boolean
  tokens: { input: number; output: number }
  estimated_cost_usd: number
  duration_ms: number
  model_used: string | null
  triggered_by: 'cron' | 'manual'
}
