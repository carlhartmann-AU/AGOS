import type { SupabaseClient } from '@supabase/supabase-js'
import { runIntelligence } from '@/lib/agents/intelligence/engine'
import { runCFOAnalysis } from '@/lib/agents/cfo/engine'
import { generateProspectResearch, generateOutreachCopy } from '@/lib/agents/b2b/engine'
import { handleCustomerInquiry } from '@/lib/agents/cs/engine'
import { generateReviewDigest, analyseReviews } from '@/lib/agents/reviews/engine'

function formatLastRun(ts: string | null | undefined): string {
  if (!ts) return 'Never'
  const diff = Date.now() - new Date(ts).getTime()
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  return 'Recently'
}

function agentHealth(ts: string | null | undefined, warnHours: number): 'healthy' | 'warning' | 'error' {
  if (!ts) return 'error'
  const h = (Date.now() - new Date(ts).getTime()) / 3600000
  return h < warnHours ? 'healthy' : h < warnHours * 2 ? 'warning' : 'error'
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function daysAgoISO(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

// Forbidden terms for quick compliance check
const COMPLIANCE_FORBIDDEN = [
  'cure', 'cures', 'treats', 'treat', 'prevent', 'prevents',
  'diagnose', 'diagnoses', 'FDA approved', 'TGA approved',
  'clinically proven', 'scientifically proven', 'guaranteed',
  'miracle', 'magic', 'instant results',
]

export async function executeToolCall(
  supabase: SupabaseClient,
  brandId: string,
  toolName: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  switch (toolName) {
    case 'get_kpis': {
      const days = (input.days as number | undefined) ?? 7
      const start = daysAgoISO(days - 1)
      const end = todayISO()

      const { data: rows } = await supabase
        .from('tw_daily_summary')
        .select('date, revenue, orders, aov, new_customers, ad_spend, roas, source_currency')
        .eq('brand_id', brandId)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: true })

      if (!rows?.length) {
        return { ok: false, message: `No revenue data found for the last ${days} days.` }
      }

      const totalRevenue = rows.reduce((s, r) => s + (Number(r.revenue) || 0), 0)
      const totalOrders = rows.reduce((s, r) => s + (Number(r.orders) || 0), 0)
      const totalAdSpend = rows.reduce((s, r) => s + (Number(r.ad_spend) || 0), 0)
      const avgAov = totalOrders > 0 ? totalRevenue / totalOrders : 0
      const roas = totalAdSpend > 0 ? totalRevenue / totalAdSpend : null
      const newCustomers = rows.reduce((s, r) => s + (Number(r.new_customers) || 0), 0)

      return {
        ok: true,
        period: { start, end, days },
        currency: rows[0].source_currency ?? 'AUD',
        revenue: Math.round(totalRevenue * 100) / 100,
        orders: totalOrders,
        aov: Math.round(avgAov * 100) / 100,
        new_customers: newCustomers,
        ad_spend: Math.round(totalAdSpend * 100) / 100,
        roas: roas != null ? Math.round(roas * 100) / 100 : null,
        daily: rows.map(r => ({
          date: r.date,
          revenue: Number(r.revenue) || 0,
          orders: Number(r.orders) || 0,
        })),
      }
    }

    case 'get_financial_summary': {
      const { data } = await supabase
        .from('cfo_reports')
        .select('unit_economics, budget_vs_actual, cash_forecast, margin_alerts, recommendations, fiscal_year, created_at')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!data) return { ok: false, message: 'No CFO report found. Run a financial analysis first.' }
      return { ok: true, ...data }
    }

    case 'get_intelligence_report': {
      const reportType = (input.report_type as string | undefined) ?? 'intelligence'

      if (reportType === 'cfo') {
        const { data } = await supabase
          .from('cfo_reports')
          .select('*')
          .eq('brand_id', brandId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        return data
          ? { ok: true, type: 'cfo', report: data }
          : { ok: false, message: 'No CFO report found.' }
      }

      const { data } = await supabase
        .from('intelligence_reports')
        .select('report_type, window_start, window_end, narrative, anomalies, recommendations, created_at')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      return data
        ? { ok: true, type: 'intelligence', report: data }
        : { ok: false, message: 'No intelligence report found. Run an intelligence report first.' }
    }

    case 'get_compliance_status': {
      const days = (input.days as number | undefined) ?? 7
      const status = input.status as string | undefined

      let query = supabase
        .from('compliance_checks')
        .select('id, content_id, overall_status, rule_results, created_at')
        .eq('brand_id', brandId)
        .gte('created_at', new Date(Date.now() - days * 86400000).toISOString())
        .order('created_at', { ascending: false })
        .limit(20)

      if (status) query = query.eq('overall_status', status)

      const { data } = await query

      const total = data?.length ?? 0
      const passed = data?.filter(r => r.overall_status === 'passed').length ?? 0
      const failed = data?.filter(r => r.overall_status === 'blocked').length ?? 0
      const flagged = data?.filter(r => r.overall_status === 'warnings' || r.overall_status === 'escalated').length ?? 0

      return {
        ok: true,
        period_days: days,
        total_checks: total,
        passed,
        failed,
        flagged,
        pass_rate: total > 0 ? Math.round((passed / total) * 100) : null,
        recent: data?.slice(0, 5) ?? [],
      }
    }

    case 'get_content_queue': {
      const status = input.status as string | undefined
      const limit = (input.limit as number | undefined) ?? 10

      let query = supabase
        .from('content_queue')
        .select('id, content_type, title, status, compliance_status, created_at, updated_at')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (status) query = query.eq('status', status)

      const { data } = await query

      return {
        ok: true,
        count: data?.length ?? 0,
        items: data ?? [],
      }
    }

    case 'get_alerts': {
      const severityFilter = input.severity as string | undefined
      const alerts: Array<{ source: string; severity: string; title: string; description: string; created_at?: string }> = []

      // Intelligence anomalies
      const { data: intReport } = await supabase
        .from('intelligence_reports')
        .select('anomalies, created_at')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (intReport?.anomalies) {
        const anomalies = Array.isArray(intReport.anomalies) ? intReport.anomalies : []
        for (const a of anomalies) {
          const sev = a.severity === 'high' ? 'critical' : a.severity === 'medium' ? 'warning' : 'info'
          if (!severityFilter || sev === severityFilter) {
            alerts.push({
              source: 'Intelligence Agent',
              severity: sev,
              title: a.metric ?? 'Anomaly',
              description: a.description ?? '',
              created_at: intReport.created_at,
            })
          }
        }
      }

      // CFO margin alerts
      const { data: cfoReport } = await supabase
        .from('cfo_reports')
        .select('margin_alerts, created_at')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (cfoReport?.margin_alerts) {
        const marginAlerts = Array.isArray(cfoReport.margin_alerts) ? cfoReport.margin_alerts : []
        for (const a of marginAlerts) {
          const sev = a.severity ?? 'warning'
          if (!severityFilter || sev === severityFilter) {
            alerts.push({
              source: 'CFO Agent',
              severity: sev,
              title: a.metric ?? 'Margin Alert',
              description: a.message ?? '',
              created_at: cfoReport.created_at,
            })
          }
        }
      }

      return {
        ok: true,
        count: alerts.length,
        alerts,
        message: alerts.length === 0 ? 'No active alerts.' : undefined,
      }
    }

    case 'get_agent_status': {
      const [intReport, cfoReport, complianceCheck, contentItem, b2bProspect, csTicket, review] = await Promise.all([
        supabase.from('intelligence_reports').select('created_at, report_type').eq('brand_id', brandId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('cfo_reports').select('created_at').eq('brand_id', brandId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('compliance_checks').select('created_at').eq('brand_id', brandId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('content_queue').select('created_at').eq('brand_id', brandId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('b2b_prospects').select('created_at').eq('brand_id', brandId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('cs_tickets').select('created_at').eq('brand_id', brandId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('reviews').select('created_at').eq('brand_id', brandId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ])

      return {
        ok: true,
        agents: [
          {
            agent: 'Intelligence Agent',
            last_run: formatLastRun(intReport.data?.created_at),
            status: agentHealth(intReport.data?.created_at, 168),
            summary: intReport.data ? `Last ${intReport.data.report_type} report` : 'No reports found',
          },
          {
            agent: 'CFO Agent',
            last_run: formatLastRun(cfoReport.data?.created_at),
            status: agentHealth(cfoReport.data?.created_at, 168),
            summary: cfoReport.data ? 'Financial analysis complete' : 'No CFO reports found',
          },
          {
            agent: 'Compliance Agent',
            last_run: formatLastRun(complianceCheck.data?.created_at),
            status: agentHealth(complianceCheck.data?.created_at, 72),
            summary: 'Checks compliance on content queue items',
          },
          {
            agent: 'Content Strategy',
            last_run: formatLastRun(contentItem.data?.created_at),
            status: agentHealth(contentItem.data?.created_at, 72),
            summary: 'Generates content drafts',
          },
          {
            agent: 'Campaign Execution',
            last_run: 'Never',
            status: 'warning' as const,
            summary: 'Awaiting approved content to publish',
          },
          {
            agent: 'B2B Outreach',
            last_run: formatLastRun(b2bProspect.data?.created_at),
            status: agentHealth(b2bProspect.data?.created_at, 336),
            summary: b2bProspect.data ? 'Prospects tracked' : 'No prospects yet',
          },
          {
            agent: 'Customer Service',
            last_run: formatLastRun(csTicket.data?.created_at),
            status: agentHealth(csTicket.data?.created_at, 48),
            summary: csTicket.data ? 'Tickets handled' : 'No tickets yet',
          },
          {
            agent: 'Review Harvester',
            last_run: formatLastRun(review.data?.created_at),
            status: agentHealth(review.data?.created_at, 168),
            summary: review.data ? 'Reviews analysed' : 'No reviews yet',
          },
        ],
      }
    }

    case 'approve_content': {
      const contentId = input.content_id as string
      const { error } = await supabase
        .from('content_queue')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', contentId)
        .eq('brand_id', brandId)

      if (error) return { ok: false, message: `Failed to approve: ${error.message}` }
      return { ok: true, message: `Content item ${contentId} approved successfully.` }
    }

    case 'reject_content': {
      const contentId = input.content_id as string
      const reason = input.reason as string
      const { error } = await supabase
        .from('content_queue')
        .update({ status: 'rejected', rejection_reason: reason, updated_at: new Date().toISOString() })
        .eq('id', contentId)
        .eq('brand_id', brandId)

      if (error) return { ok: false, message: `Failed to reject: ${error.message}` }
      return { ok: true, message: `Content item ${contentId} rejected. Reason: ${reason}` }
    }

    case 'run_intelligence_report': {
      const end = todayISO()
      const start = daysAgoISO(6)
      // Fire and forget
      runIntelligence(supabase, brandId, start, end, 'manual')
        .catch(err => console.error('[coo-tool] intelligence report failed:', err))
      return { ok: true, message: 'Intelligence report triggered. Results will be available in ~30 seconds.' }
    }

    case 'run_cfo_report': {
      // Fire and forget
      const cfoEnd = todayISO()
      const cfoStart = daysAgoISO(6)
      runCFOAnalysis(supabase, brandId, cfoStart, cfoEnd, 'manual')
        .catch(err => console.error('[coo-tool] cfo report failed:', err))
      return { ok: true, message: 'CFO financial analysis triggered. Results will be available in ~30 seconds.' }
    }

    case 'run_compliance_check': {
      const content = input.content as string
      const lower = content.toLowerCase()
      const issues = COMPLIANCE_FORBIDDEN
        .filter(term => lower.includes(term.toLowerCase()))
        .map(term => ({ type: 'forbidden_term', term, rule: 'TGA/FDA health claim restriction' }))

      return {
        ok: true,
        result: issues.length > 0 ? 'FAIL' : 'PASS',
        issues,
        message: issues.length > 0
          ? `Found ${issues.length} compliance issue(s). Review before publishing.`
          : 'Content appears compliant. No forbidden terms detected.',
      }
    }

    case 'get_b2b_pipeline': {
      const status = input.status as string | undefined
      const limit = (input.limit as number | undefined) ?? 10

      let query = supabase
        .from('b2b_prospects')
        .select('id, company_name, contact_name, country, prospect_type, status, score, last_contacted_at, created_at')
        .eq('brand_id', brandId)
        .order('score', { ascending: false })
        .limit(limit)

      if (status) query = query.eq('status', status)

      const { data } = await query

      const newCount = data?.filter(p => p.status === 'new').length ?? 0
      const contactedCount = data?.filter(p => p.status === 'contacted').length ?? 0
      const qualifiedCount = data?.filter(p => p.status === 'qualified').length ?? 0

      return {
        ok: true,
        count: data?.length ?? 0,
        summary: { new: newCount, contacted: contactedCount, qualified: qualifiedCount },
        prospects: data ?? [],
      }
    }

    case 'research_prospects': {
      const result = await generateProspectResearch(supabase, brandId, {
        country: input.country as string | undefined,
        prospect_type: input.prospect_type as string | undefined,
        count: input.count as number | undefined,
      })
      return result
    }

    case 'draft_outreach': {
      const prospectId = input.prospect_id as string
      const channel = input.channel as 'email' | 'linkedin'
      const result = await generateOutreachCopy(supabase, prospectId, channel)
      return result
    }

    case 'get_cs_summary': {
      const status = input.status as string | undefined
      const limit = (input.limit as number | undefined) ?? 10

      let query = supabase
        .from('cs_tickets')
        .select('id, subject, status, priority, category, customer_name, created_at')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (status) query = query.eq('status', status)

      const { data } = await query

      const openCount = data?.filter(t => t.status === 'open').length ?? 0
      const criticalCount = data?.filter(t => t.priority === 'critical').length ?? 0
      const highCount = data?.filter(t => t.priority === 'high').length ?? 0

      return {
        ok: true,
        count: data?.length ?? 0,
        summary: { open: openCount, critical: criticalCount, high: highCount },
        tickets: data ?? [],
      }
    }

    case 'handle_customer_inquiry': {
      const result = await handleCustomerInquiry(supabase, brandId, {
        subject: input.subject as string,
        message: input.message as string,
        customer_name: input.customer_name as string | undefined,
        customer_email: input.customer_email as string | undefined,
        channel: input.channel as string | undefined,
      })
      return result
    }

    case 'get_review_summary': {
      const days = (input.days as number | undefined) ?? 7
      const result = await generateReviewDigest(supabase, brandId, days)
      return result
    }

    case 'get_products': {
      const status = input.status as string | undefined
      const search = input.search as string | undefined
      const limit = Math.min((input.limit as number | undefined) ?? 20, 20)

      let query = supabase
        .from('products')
        .select('id, shopify_product_id, title, status, vendor, product_type, tags, featured_image_url, product_variants(title, sku, price, currency, inventory_quantity)')
        .eq('brand_id', brandId)
        .order('title', { ascending: true })
        .limit(limit)

      if (status) query = query.eq('status', status)
      if (search) query = query.ilike('title', `%${search}%`)

      const { data } = await query

      const totalInventory = (data ?? []).reduce((sum, p) => {
        const inv = (p.product_variants as Array<{ inventory_quantity: number | null }> ?? [])
          .reduce((s, v) => s + (v.inventory_quantity ?? 0), 0)
        return sum + inv
      }, 0)

      return {
        ok: true,
        count: data?.length ?? 0,
        total_inventory: totalInventory,
        products: (data ?? []).map(p => ({
          id: p.id,
          title: p.title,
          status: p.status,
          vendor: p.vendor,
          product_type: p.product_type,
          variants_count: (p.product_variants as unknown[]).length,
          price_range: (() => {
            const prices = (p.product_variants as Array<{ price: number | null }> ?? [])
              .map(v => v.price ?? 0)
              .filter(n => n > 0)
            if (!prices.length) return null
            const min = Math.min(...prices)
            const max = Math.max(...prices)
            return min === max ? `${min}` : `${min}–${max}`
          })(),
          inventory: (p.product_variants as Array<{ inventory_quantity: number | null }> ?? [])
            .reduce((s, v) => s + (v.inventory_quantity ?? 0), 0),
        })),
      }
    }

    case 'analyse_reviews': {
      const reviews = input.reviews as Array<{
        source: string
        rating: number
        body: string
        reviewer_name?: string
        title?: string
        review_date?: string
      }>
      const result = await analyseReviews(supabase, brandId, reviews)
      return result
    }

    default:
      return { ok: false, message: `Unknown tool: ${toolName}` }
  }
}
