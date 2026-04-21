import type { SupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-sonnet-4-6'
const BATCH_SIZE = 20

export interface ReviewAnalysisResult {
  ok: boolean
  inserted: number
  analysed: number
  sentiment_summary: { positive: number; neutral: number; negative: number }
  top_themes: string[]
  best_quotes: string[]
  needs_response: number
}

export interface ReviewDigest {
  ok: boolean
  period_days: number
  total: number
  sentiment: { positive: number; neutral: number; negative: number }
  top_positive_themes: Array<{ theme: string; count: number }>
  top_negative_themes: Array<{ theme: string; count: number }>
  best_quotes: string[]
  needs_response: number
  content_ideas: string[]
}

type BatchResult = {
  id: string
  sentiment: 'positive' | 'neutral' | 'negative'
  themes: string[]
  key_quote: string | null
  repurpose_suggestions: Record<string, string> | null
  response_needed: boolean
}

export async function analyseReviews(
  supabase: SupabaseClient,
  brandId: string,
  reviews: Array<{
    source: string
    reviewer_name?: string
    rating: number
    title?: string
    body: string
    review_date?: string
  }>,
): Promise<ReviewAnalysisResult> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const { data: inserted } = await supabase
    .from('reviews')
    .insert(reviews.map(r => ({
      brand_id: brandId,
      source: r.source,
      reviewer_name: r.reviewer_name,
      rating: r.rating,
      title: r.title,
      body: r.body,
      review_date: r.review_date ?? new Date().toISOString(),
    })))
    .select('id')

  const ids = inserted?.map(r => r.id) ?? []
  if (!ids.length) return { ok: false, inserted: 0, analysed: 0, sentiment_summary: { positive: 0, neutral: 0, negative: 0 }, top_themes: [], best_quotes: [], needs_response: 0 }

  const { data: toAnalyse } = await supabase.from('reviews').select('*').in('id', ids)
  if (!toAnalyse?.length) return { ok: true, inserted: ids.length, analysed: 0, sentiment_summary: { positive: 0, neutral: 0, negative: 0 }, top_themes: [], best_quotes: [], needs_response: 0 }

  let analysedCount = 0
  const allThemes: string[] = []
  const allQuotes: string[] = []
  const sentimentTotals = { positive: 0, neutral: 0, negative: 0 }
  let needsResponseCount = 0

  for (let i = 0; i < toAnalyse.length; i += BATCH_SIZE) {
    const batch = toAnalyse.slice(i, i + BATCH_SIZE)

    const prompt = `Analyse these Plasmaide customer reviews (pine bark extract supplement).

Reviews:
${JSON.stringify(batch.map(r => ({ id: r.id, rating: r.rating, title: r.title, body: r.body })), null, 2)}

For each review provide:
- sentiment: "positive" | "neutral" | "negative"
- themes: 1-3 from: energy, recovery, sleep, circulation, blood_flow, trust, certification, value, shipping, packaging, side_effects, taste, product_feedback, returns, support, other
- key_quote: best marketing-ready quote (max 20 words), null if not quotable
- repurpose_suggestions: { "social_proof_ad": "...", "email_testimonial": "...", "pdp_quote": "...", "blog_hook": "..." } — null for negative reviews
- response_needed: true if rating <= 2 or customer has unresolved complaint

Return ONLY a valid JSON array (no markdown):
[{"id":"uuid","sentiment":"positive","themes":["recovery"],"key_quote":"...","repurpose_suggestions":{...},"response_needed":false}]`

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '[]'
    let batchResults: BatchResult[] = []
    try {
      batchResults = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())
    } catch {
      // Fallback: basic heuristic scoring
      batchResults = batch.map(r => ({
        id: r.id,
        sentiment: (r.rating >= 4 ? 'positive' : r.rating === 3 ? 'neutral' : 'negative') as 'positive' | 'neutral' | 'negative',
        themes: ['other'],
        key_quote: null,
        repurpose_suggestions: null,
        response_needed: r.rating <= 2,
      }))
    }

    for (const r of batchResults) {
      sentimentTotals[r.sentiment] = (sentimentTotals[r.sentiment] ?? 0) + 1
      if (r.themes) allThemes.push(...r.themes)
      if (r.key_quote) allQuotes.push(r.key_quote)
      if (r.response_needed) needsResponseCount++

      await supabase.from('reviews').update({
        sentiment: r.sentiment,
        themes: r.themes,
        key_quote: r.key_quote,
        repurpose_suggestions: r.repurpose_suggestions,
        response_status: r.response_needed ? 'flagged' : 'pending',
      }).eq('id', r.id)

      analysedCount++
    }

    if (i + BATCH_SIZE < toAnalyse.length) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }

  const themeCounts: Record<string, number> = {}
  for (const t of allThemes) themeCounts[t] = (themeCounts[t] ?? 0) + 1
  const topThemes = Object.entries(themeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([t]) => t)

  return {
    ok: true,
    inserted: ids.length,
    analysed: analysedCount,
    sentiment_summary: sentimentTotals,
    top_themes: topThemes,
    best_quotes: allQuotes.slice(0, 3),
    needs_response: needsResponseCount,
  }
}

export async function generateReviewDigest(
  supabase: SupabaseClient,
  brandId: string,
  days = 7,
): Promise<ReviewDigest> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const since = new Date(Date.now() - days * 86400000).toISOString()

  const { data: reviews } = await supabase
    .from('reviews')
    .select('*')
    .eq('brand_id', brandId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })

  if (!reviews?.length) {
    return { ok: false, period_days: days, total: 0, sentiment: { positive: 0, neutral: 0, negative: 0 }, top_positive_themes: [], top_negative_themes: [], best_quotes: [], needs_response: 0, content_ideas: [] }
  }

  const positive = reviews.filter(r => r.sentiment === 'positive').length
  const neutral = reviews.filter(r => r.sentiment === 'neutral').length
  const negative = reviews.filter(r => r.sentiment === 'negative').length
  const needsResponse = reviews.filter(r => ['flagged', 'pending'].includes(r.response_status ?? '')).length
  const quotes = reviews.filter(r => r.key_quote).map(r => r.key_quote as string).slice(0, 5)

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Analyse these Plasmaide customer reviews and identify themes and content opportunities.

Reviews (last ${days} days):
${JSON.stringify(reviews.map(r => ({ rating: r.rating, sentiment: r.sentiment, themes: r.themes, body: r.body?.slice(0, 200) })))}

Return ONLY valid JSON:
{
  "top_positive_themes": [{"theme": "recovery", "count": 3}],
  "top_negative_themes": [{"theme": "side_effects", "count": 1}],
  "content_ideas": ["Cycling recovery case study — 6-week transformation", "Why Informed Sport certification matters for elite athletes", "Circulation benefits: what customers are saying"]
}`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
  let digest = { top_positive_themes: [] as Array<{ theme: string; count: number }>, top_negative_themes: [] as Array<{ theme: string; count: number }>, content_ideas: [] as string[] }
  try {
    digest = { ...digest, ...JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim()) }
  } catch { /* keep defaults */ }

  return {
    ok: true,
    period_days: days,
    total: reviews.length,
    sentiment: { positive, neutral, negative },
    ...digest,
    best_quotes: quotes,
    needs_response: needsResponse,
  }
}

export async function generateReviewResponse(
  supabase: SupabaseClient,
  reviewId: string,
): Promise<{ draft: string }> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const { data: review } = await supabase.from('reviews').select('*').eq('id', reviewId).single()
  if (!review) return { draft: '' }

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: `Write a professional ${review.rating}-star review response for Plasmaide (pine bark extract supplement).

Review: ${review.title ? `"${review.title}" — ` : ''}${review.body}
Sentiment: ${review.sentiment}

Guidelines:
- Positive: thank them warmly, reinforce brand value, invite them to share with friends
- Negative: apologise sincerely, address the concern directly, offer resolution, provide contact email
- 2-3 sentences max, warm and professional
- Never make therapeutic claims (no "treats", "cures", "prevents")

Return only the response text.`,
    }],
  })

  const draft = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
  if (draft) await supabase.from('reviews').update({ ai_response_draft: draft }).eq('id', reviewId)

  return { draft }
}
