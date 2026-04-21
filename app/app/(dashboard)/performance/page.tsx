import { createAdminClient } from '@/lib/supabase/admin'

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchCSMetrics(brandId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('cs_tickets')
    .select('status, priority')
    .eq('brand_id', brandId)
  if (!data) return null

  const open = data.filter(t => t.status === 'open').length
  const inProgress = data.filter(t => t.status === 'in_progress').length
  const resolved = data.filter(t => t.status === 'resolved').length
  const escalated = data.filter(t => t.status === 'escalated').length
  const critical = data.filter(t => t.priority === 'critical').length
  const high = data.filter(t => t.priority === 'high').length
  return { total: data.length, open, inProgress, resolved, escalated, critical, high }
}

async function fetchAgentHealth(brandId: string) {
  const supabase = createAdminClient()
  const now = Date.now()

  const [intRow, compRow, cooRow, cfoRow, b2bRow, csRow, reviewRow] = await Promise.all([
    supabase.from('intelligence_reports').select('created_at').eq('brand_id', brandId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('compliance_checks').select('created_at').eq('brand_id', brandId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('coo_messages').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('cfo_reports').select('created_at').eq('brand_id', brandId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('b2b_prospects').select('updated_at').eq('brand_id', brandId).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('cs_tickets').select('created_at').eq('brand_id', brandId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('reviews').select('created_at').eq('brand_id', brandId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])

  function status(ts: string | null | undefined, warnHours: number): 'healthy' | 'warning' | 'error' {
    if (!ts) return 'error'
    const h = (now - new Date(ts).getTime()) / 3600000
    return h < warnHours ? 'healthy' : h < warnHours * 2.5 ? 'warning' : 'error'
  }

  function lastRun(ts: string | null | undefined): string {
    if (!ts) return 'Never'
    const diff = now - new Date(ts).getTime()
    const m = Math.floor(diff / 60000)
    const h = Math.floor(m / 60)
    const d = Math.floor(h / 24)
    if (d > 0) return `${d}d ago`
    if (h > 0) return `${h}h ago`
    if (m > 0) return `${m}m ago`
    return 'Just now'
  }

  return [
    { agent: 'Intelligence Agent', lastRun: lastRun(intRow.data?.created_at), status: status(intRow.data?.created_at, 168), detail: 'Weekly market & performance report' },
    { agent: 'Compliance Agent', lastRun: lastRun(compRow.data?.created_at), status: status(compRow.data?.created_at, 72), detail: 'Content health claim checks' },
    { agent: 'COO Agent', lastRun: lastRun(cooRow.data?.created_at), status: status(cooRow.data?.created_at, 48), detail: 'Orchestration & dashboard chat' },
    { agent: 'CFO Agent', lastRun: lastRun(cfoRow.data?.created_at), status: status(cfoRow.data?.created_at, 168), detail: 'Financial analysis & alerts' },
    { agent: 'B2B Outreach', lastRun: lastRun(b2bRow.data?.updated_at), status: status(b2bRow.data?.updated_at, 336), detail: 'Prospect scoring & copy drafts' },
    { agent: 'Customer Service', lastRun: lastRun(csRow.data?.created_at), status: status(csRow.data?.created_at, 48), detail: 'Ticket classification & drafts' },
    { agent: 'Review Harvester', lastRun: lastRun(reviewRow.data?.created_at), status: status(reviewRow.data?.created_at, 168), detail: 'Sentiment & theme analysis' },
  ]
}

async function fetchCampaignMetrics(brandId: string) {
  const supabase = createAdminClient()
  const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  const { data } = await supabase
    .from('tw_daily_summary')
    .select('date, revenue, orders, ad_spend, roas, source_currency')
    .eq('brand_id', brandId)
    .gte('date', since)
    .order('date', { ascending: false })

  if (!data?.length) return null

  const totalRevenue = data.reduce((s, r) => s + (Number(r.revenue) || 0), 0)
  const totalOrders = data.reduce((s, r) => s + (Number(r.orders) || 0), 0)
  const totalAdSpend = data.reduce((s, r) => s + (Number(r.ad_spend) || 0), 0)
  const roas = totalAdSpend > 0 ? totalRevenue / totalAdSpend : null
  const cpa = totalOrders > 0 ? totalAdSpend / totalOrders : null
  const currency = data[0].source_currency ?? 'AUD'

  return { totalRevenue, totalOrders, totalAdSpend, roas, cpa, currency, days: data.length }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

type HealthStatus = 'healthy' | 'warning' | 'error'

function StatusDot({ s }: { s: HealthStatus }) {
  const color = s === 'healthy' ? 'var(--ok)' : s === 'warning' ? 'var(--warn)' : 'var(--bad)'
  return (
    <span style={{
      display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
      background: color, flexShrink: 0, marginTop: 1,
    }} />
  )
}

function StatRow({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '5px 0', borderBottom: '1px solid var(--line-2)' }}>
      <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, fontVariantNumeric: 'tabular-nums', display: 'flex', alignItems: 'baseline', gap: 5 }}>
        {value}
        {sub && <span style={{ fontSize: 11, color: 'var(--ink-4)', fontWeight: 400 }}>{sub}</span>}
      </span>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 10,
      padding: '18px 20px', boxShadow: 'var(--shadow-1)', display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', letterSpacing: '-.01em' }}>{title}</h3>
      {children}
    </div>
  )
}

function Placeholder({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--panel-2)', border: '1px dashed var(--line-3)', borderRadius: 7 }}>
      <span style={{ fontSize: 11, color: 'var(--ink-4)' }}>{label}</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic'

export default async function PerformancePage() {
  const brandId = 'plasmaide'

  const [csMetrics, agentHealth, campaignMetrics] = await Promise.all([
    fetchCSMetrics(brandId),
    fetchAgentHealth(brandId),
    fetchCampaignMetrics(brandId),
  ])

  const fmt = (n: number, currency: string) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n)

  const healthCounts = agentHealth
    ? {
        healthy: agentHealth.filter(a => a.status === 'healthy').length,
        warning: agentHealth.filter(a => a.status === 'warning').length,
        error: agentHealth.filter(a => a.status === 'error').length,
      }
    : null

  return (
    <div className="page">
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title">Performance</h1>
        <p className="page-sub">Campaign metrics, email analytics, CS stats, and agent health.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 16 }}>

        {/* ── Campaign metrics ── */}
        <Card title="Campaign metrics — last 7 days">
          {campaignMetrics ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <StatRow label="Revenue" value={fmt(campaignMetrics.totalRevenue, campaignMetrics.currency)} />
              <StatRow label="Ad spend" value={fmt(campaignMetrics.totalAdSpend, campaignMetrics.currency)} />
              <StatRow
                label="ROAS"
                value={campaignMetrics.roas != null ? `${campaignMetrics.roas.toFixed(2)}×` : '—'}
                sub={campaignMetrics.roas != null ? 'return on ad spend' : undefined}
              />
              <StatRow
                label="CPA"
                value={campaignMetrics.cpa != null ? fmt(campaignMetrics.cpa, campaignMetrics.currency) : '—'}
                sub={campaignMetrics.cpa != null ? 'cost per order' : undefined}
              />
              <StatRow label="Orders" value={campaignMetrics.totalOrders.toLocaleString()} />
            </div>
          ) : (
            <Placeholder label="No ad spend data yet — connect Triple Whale in Settings to populate campaign metrics." />
          )}
        </Card>

        {/* ── Email metrics ── */}
        <Card title="Email metrics">
          <Placeholder label="DotDigital direct integration pending — open rate, CTR, and revenue-per-send will appear here." />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <StatRow label="Open rate" value="—" />
            <StatRow label="Click rate" value="—" />
            <StatRow label="Revenue per send" value="—" />
            <StatRow label="Unsubscribes (7d)" value="—" />
          </div>
        </Card>

        {/* ── CS metrics ── */}
        <Card title="Customer service">
          {csMetrics ? (
            <>
              <div style={{ display: 'flex', gap: 10 }}>
                {[
                  { label: 'Open', value: csMetrics.open + csMetrics.inProgress, color: 'var(--accent)', bg: 'var(--accent-bg)' },
                  { label: 'Resolved', value: csMetrics.resolved, color: 'var(--ok)', bg: 'var(--ok-bg)' },
                  { label: 'Escalated', value: csMetrics.escalated, color: 'var(--bad)', bg: 'var(--bad-bg)' },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} style={{ flex: 1, background: bg, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{value}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                <StatRow label="Total tickets" value={csMetrics.total} />
                <StatRow label="Critical priority" value={csMetrics.critical} />
                <StatRow label="High priority" value={csMetrics.high} />
                <StatRow label="In progress" value={csMetrics.inProgress} />
              </div>
            </>
          ) : (
            <Placeholder label="No CS ticket data yet." />
          )}
        </Card>

        {/* ── Agent health ── */}
        <Card title="Agent health">
          {agentHealth && healthCounts ? (
            <>
              <div style={{ display: 'flex', gap: 10 }}>
                {[
                  { label: 'Healthy', value: healthCounts.healthy, color: 'var(--ok)', bg: 'var(--ok-bg)' },
                  { label: 'Warning', value: healthCounts.warning, color: 'var(--warn)', bg: 'var(--warn-bg)' },
                  { label: 'Error', value: healthCounts.error, color: 'var(--bad)', bg: 'var(--bad-bg)' },
                ].map(({ label, value, color, bg }) => (
                  <div key={label} style={{ flex: 1, background: bg, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ fontSize: 22, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{value}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {agentHealth.map(({ agent, lastRun, status, detail }) => (
                  <div key={agent} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '8px 10px', background: 'var(--panel-2)',
                    border: '1px solid var(--line-2)', borderRadius: 7,
                  }}>
                    <StatusDot s={status} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink-2)' }}>{agent}</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 1 }}>{detail}</div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--ink-4)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', paddingTop: 1 }}>
                      {lastRun}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <Placeholder label="No agent activity data yet." />
          )}
        </Card>

      </div>
    </div>
  )
}
