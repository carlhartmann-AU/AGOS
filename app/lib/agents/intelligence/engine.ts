// lib/agents/intelligence/engine.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { IntelligenceReport, Anomaly } from './types'
import { gatherRevenue } from './gatherers/revenue'
import { gatherContent } from './gatherers/content'
import { gatherCompliance } from './gatherers/compliance'
import { detectAnomalies } from './anomaly'
import { runNarrator } from './narrator'

export async function runIntelligence(
  supabase: SupabaseClient,
  brandId: string,
  windowStart: string,
  windowEnd: string,
  triggeredBy: 'cron' | 'manual',
  model?: string,
): Promise<IntelligenceReport> {
  const startedAt = Date.now()

  // 1. Gather all data in parallel
  const [revenue, content, compliance] = await Promise.all([
    gatherRevenue(supabase, brandId, windowStart, windowEnd),
    gatherContent(supabase, brandId, windowStart, windowEnd),
    gatherCompliance(supabase, brandId, windowStart, windowEnd),
  ])

  // 2. Check for empty data
  const isEmpty = revenue.total_revenue === 0 && revenue.daily.length === 0
    && content.total_generated === 0 && compliance.total_checks === 0

  let narrative: string | null = null
  let recommendations: IntelligenceReport['recommendations'] = []
  let anomalies: Anomaly[] = []
  let narrator_enabled = false
  let tokens = { input: 0, output: 0 }
  let estimated_cost_usd = 0
  let model_used: string | null = null

  if (isEmpty) {
    narrative = 'Insufficient data for analysis.'
  } else {
    // 3. Anomaly detection
    anomalies = detectAnomalies(revenue, content, compliance)

    // 4. Narrator (optional — graceful degradation)
    const hasLLM = !!process.env.ANTHROPIC_API_KEY
    if (hasLLM) {
      try {
        // Read llm_config from brand_settings.compliance if available
        const { data: bsRow } = await supabase
          .from('brand_settings')
          .select('compliance')
          .eq('brand_id', brandId)
          .single()
        const llmConfig = (bsRow?.compliance as Record<string, Record<string, string>> | null)?.llm_config

        const narResult = await runNarrator(revenue, content, compliance, anomalies, llmConfig, model)
        narrative = narResult.narrative
        recommendations = narResult.recommendations
        tokens = narResult.tokens
        estimated_cost_usd = narResult.cost_usd
        model_used = narResult.model_used
        narrator_enabled = true
      } catch (err) {
        console.error('[intelligence/engine] narrator failed, continuing data-only:', err)
      }
    }
  }

  const duration_ms = Date.now() - startedAt

  // 5. Persist report
  const { error: insertErr } = await supabase
    .from('intelligence_reports')
    .insert({
      brand_id: brandId,
      report_type: triggeredBy === 'cron' ? 'weekly' : 'on_demand',
      window_start: windowStart,
      window_end: windowEnd,
      revenue_summary: revenue,
      content_summary: content,
      compliance_summary: compliance,
      anomalies,
      narrative,
      recommendations,
      narrator_enabled,
      tokens_input: tokens.input,
      tokens_output: tokens.output,
      estimated_cost_usd,
      duration_ms,
      triggered_by: triggeredBy,
      model_used,
    })
    .select('id')
    .single()

  if (insertErr) {
    console.error('[intelligence/engine] failed to persist report:', insertErr)
  }

  // 6. Persist anomalies as alerts (deduplicate by type + brand + day)
  if (anomalies.length > 0) {
    const today = new Date().toISOString().slice(0, 10)

    for (const anomaly of anomalies) {
      // Check for existing unacknowledged alert of same type today
      const { data: existing } = await supabase
        .from('intelligence_alerts')
        .select('id')
        .eq('brand_id', brandId)
        .eq('alert_type', anomaly.type)
        .eq('acknowledged', false)
        .gte('created_at', `${today}T00:00:00Z`)
        .limit(1)
        .maybeSingle()

      if (!existing) {
        await supabase.from('intelligence_alerts').insert({
          brand_id: brandId,
          alert_type: anomaly.type,
          severity: anomaly.severity,
          title: anomaly.title,
          description: anomaly.description,
          data: anomaly.data,
        })
      }
    }
  }

  const report: IntelligenceReport = {
    brand_id: brandId,
    report_type: triggeredBy === 'cron' ? 'weekly' : 'on_demand',
    window_start: windowStart,
    window_end: windowEnd,
    revenue_summary: revenue,
    content_summary: content,
    compliance_summary: compliance,
    anomalies,
    narrative,
    recommendations,
    narrator_enabled,
    tokens,
    estimated_cost_usd,
    duration_ms,
    model_used,
    triggered_by: triggeredBy,
  }

  return report
}
