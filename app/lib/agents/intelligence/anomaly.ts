// lib/agents/intelligence/anomaly.ts
import type { RevenueSummary, ContentSummary, ComplianceSummary, Anomaly } from './types'

export function detectAnomalies(
  revenue: RevenueSummary,
  content: ContentSummary,
  compliance: ComplianceSummary
): Anomaly[] {
  if (revenue.daily.length < 3) return []

  const anomalies: Anomaly[] = []
  const meanRevenue = revenue.total_revenue / revenue.daily.length
  const meanOrders = revenue.total_orders / revenue.daily.length

  for (const day of revenue.daily) {
    if (meanRevenue > 0 && day.revenue > 2 * meanRevenue) {
      anomalies.push({
        type: 'revenue_spike',
        severity: 'warning',
        title: `Revenue spike on ${day.date}`,
        description: `${day.date} revenue of ${revenue.display_currency} ${day.revenue.toLocaleString()} is ${(day.revenue / meanRevenue).toFixed(1)}× the period mean of ${revenue.display_currency} ${Math.round(meanRevenue).toLocaleString()}.`,
        data: { date: day.date, revenue: day.revenue, mean: Math.round(meanRevenue), orders: day.orders },
      })
    }

    if (meanRevenue > 0 && day.revenue < 0.5 * meanRevenue) {
      anomalies.push({
        type: 'revenue_drop',
        severity: 'warning',
        title: `Revenue drop on ${day.date}`,
        description: `${day.date} revenue of ${revenue.display_currency} ${day.revenue.toLocaleString()} is only ${Math.round((day.revenue / meanRevenue) * 100)}% of the period mean of ${revenue.display_currency} ${Math.round(meanRevenue).toLocaleString()}.`,
        data: { date: day.date, revenue: day.revenue, mean: Math.round(meanRevenue), orders: day.orders },
      })
    }

    if (meanOrders > 0 && day.orders > 3 * meanOrders) {
      anomalies.push({
        type: 'order_anomaly',
        severity: 'warning',
        title: `Order spike on ${day.date}`,
        description: `${day.date} had ${day.orders} orders — ${(day.orders / meanOrders).toFixed(1)}× the period mean of ${Math.round(meanOrders)}.`,
        data: { date: day.date, orders: day.orders, mean: Math.round(meanOrders), revenue: day.revenue },
      })
    }
  }

  if (compliance.pass_rate_delta < -20) {
    anomalies.push({
      type: 'compliance_surge',
      severity: 'critical',
      title: 'Compliance pass rate dropped sharply',
      description: `Compliance pass rate fell ${Math.abs(compliance.pass_rate_delta)} points vs prior period (from ${compliance.prior_pass_rate}% to ${compliance.pass_rate}%). ${compliance.blocked_count} content items blocked.`,
      data: {
        current_pass_rate: compliance.pass_rate,
        prior_pass_rate: compliance.prior_pass_rate,
        delta: compliance.pass_rate_delta,
        blocked: compliance.blocked_count,
        escalated: compliance.escalated_count,
      },
    })
  }

  return anomalies
}
