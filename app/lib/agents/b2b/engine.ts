import type { SupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-sonnet-4-6'

const PLASMAIDE_B2B_CONTEXT = `
Plasmaide is a premium pine bark extract supplement brand.
Products: Pine Bark Extract capsules (60ct and 120ct)
Wholesale pricing: 60ct ~$22 RRP, wholesale ~$13; 120ct ~$38 RRP, wholesale ~$22
Certifications: Informed Sport certified (anti-doping/elite sport), TGA listed, NSF certified
Key benefits: Antioxidant support, cardiovascular health, athletic performance, circulation, recovery
Target markets: AU (primary), NZ, UK, US, DE, FR, JP, KR, AE, SG
MOQ: 24 units per SKU, lead time 4-6 weeks from AU warehouse
Current retail presence: Independent pharmacies and health food stores
`

export interface B2BResearchResult {
  ok: boolean
  enriched: number
  prospects: Array<{
    id: string
    company_name: string
    country: string
    status: string
    score: number
    score_rationale: string
  }>
}

export interface OutreachCopyResult {
  ok: boolean
  prospect_id: string
  company_name: string
  channel: 'email' | 'linkedin'
  copy: { subject?: string; body: string }
  content_queue_id?: string
  warning?: string
}

export async function generateProspectResearch(
  supabase: SupabaseClient,
  brandId: string,
  params: { country?: string; prospect_type?: string; count?: number },
): Promise<B2BResearchResult> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const limit = params.count ?? 5

  let query = supabase
    .from('b2b_prospects')
    .select('*')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (params.country) query = query.eq('country', params.country)
  if (params.prospect_type) query = query.eq('prospect_type', params.prospect_type)

  const { data: prospects } = await query
  if (!prospects?.length) return { ok: false, enriched: 0, prospects: [] } as unknown as B2BResearchResult

  const prompt = `You are a B2B sales analyst for Plasmaide.

${PLASMAIDE_B2B_CONTEXT}

Analyse these prospects and score each (0–100) using this weighting:
- Fit/alignment (40%): How well do their existing brands align with Plasmaide?
- Reach/size (30%): Store count, market presence, revenue potential
- Accessibility (20%): Ease of listing — premium vs mass market
- Urgency/timing (10%): Market trends favouring action now?

Prospects:
${JSON.stringify(prospects.map(p => ({
  id: p.id,
  company: p.company_name,
  country: p.country,
  type: p.prospect_type,
  current_brands: p.current_brands,
  store_count: p.store_count,
  estimated_deal_value: p.estimated_deal_value,
  status: p.status,
})), null, 2)}

Return ONLY a valid JSON array (no markdown):
[
  {
    "id": "uuid",
    "score": 85,
    "score_rationale": "Strong supplement focus, 150+ stores nationally. Sells BioCeuticals which validates premium positioning."
  }
]`

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
  let scored: Array<{ id: string; score: number; score_rationale: string }> = []
  try {
    scored = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
  } catch { /* no scoring update */ }

  for (const s of scored) {
    await supabase
      .from('b2b_prospects')
      .update({ score: s.score, score_rationale: s.score_rationale, updated_at: new Date().toISOString() })
      .eq('id', s.id)
      .eq('brand_id', brandId)
  }

  return {
    ok: true,
    enriched: scored.length,
    prospects: prospects.map(p => {
      const s = scored.find(u => u.id === p.id)
      return {
        id: p.id,
        company_name: p.company_name,
        country: p.country,
        status: p.status,
        score: s?.score ?? p.score ?? 0,
        score_rationale: s?.score_rationale ?? p.score_rationale ?? '',
      }
    }),
  }
}

export async function generateOutreachCopy(
  supabase: SupabaseClient,
  prospectId: string,
  channel: 'email' | 'linkedin',
  model?: string,
): Promise<OutreachCopyResult> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const { data: prospect } = await supabase
    .from('b2b_prospects')
    .select('*')
    .eq('id', prospectId)
    .single()

  if (!prospect) {
    return { ok: false, prospect_id: prospectId, company_name: '', channel, copy: { body: '' }, warning: 'Prospect not found' }
  }

  // Anti-spam: outreach sent in last 30 days?
  const since = new Date(Date.now() - 30 * 86400000).toISOString()
  const { data: recentOutreach } = await supabase
    .from('b2b_outreach_log')
    .select('sent_at')
    .eq('prospect_id', prospectId)
    .eq('channel', channel)
    .gte('sent_at', since)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let warning: string | undefined
  if (recentOutreach) {
    const sentDate = new Date(recentOutreach.sent_at).toLocaleDateString('en-AU')
    warning = `Outreach already sent to this prospect on ${sentDate}. Copy generated anyway for review.`
  }

  const prompt = `You are a B2B sales copywriter for Plasmaide.

${PLASMAIDE_B2B_CONTEXT}

Write personalised ${channel} outreach for:
Company: ${prospect.company_name}
Website: ${prospect.website ?? 'N/A'}
Country: ${prospect.country}
Type: ${prospect.prospect_type}
Decision maker: ${prospect.decision_maker_name ?? 'Category Manager'} — ${prospect.decision_maker_title ?? ''}
Existing brands they stock: ${(prospect.current_brands ?? []).join(', ') || 'Unknown'}
Store count: ${prospect.store_count ?? 'Unknown'}

Guidelines:
- Professional and warm, not salesy
- Reference their existing brands to show research
- Highlight Informed Sport certification (key differentiator for sports/fitness retailers)
- Clear CTA: 15-min intro call or product sample request
${channel === 'linkedin'
    ? '- LinkedIn: MAX 300 characters total. Short, human, professional.'
    : '- Email: clear subject line + concise body (150–200 words). No fluff.'}
- Never make therapeutic claims

Return ONLY valid JSON (no markdown):
${channel === 'email'
    ? '{ "subject": "...", "body": "..." }'
    : '{ "body": "..." }'
}`

  const response = await anthropic.messages.create({
    model: model ?? MODEL,
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
  let copy: { subject?: string; body: string } = { body: '' }
  try {
    copy = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
  } catch { copy = { body: text } }

  // Save copy to prospect + update status
  await supabase
    .from('b2b_prospects')
    .update({
      outreach_copy: { ...(prospect.outreach_copy ?? {}), [channel]: copy },
      status: 'contacted',
      updated_at: new Date().toISOString(),
    })
    .eq('id', prospectId)

  // Push to content_queue for human approval
  const { data: cqRow } = await supabase
    .from('content_queue')
    .insert({
      brand_id: prospect.brand_id,
      content_type: 'b2b_email',
      content: { prospect_id: prospectId, company_name: prospect.company_name, channel, copy },
      status: 'pending',
    })
    .select('id')
    .single()

  return {
    ok: true,
    prospect_id: prospectId,
    company_name: prospect.company_name,
    channel,
    copy,
    content_queue_id: cqRow?.id,
    warning,
  }
}
