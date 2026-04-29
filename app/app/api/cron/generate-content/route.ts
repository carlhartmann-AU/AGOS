import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { writeContentToQueue } from '@/lib/content/queue-writer'
import type { ContentType, ContentSchedule } from '@/types'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-6'

const SHOPIFY_BLOG_ID = '94553112861'

const BRAND_RULES: Record<string, string> = {
  plasmaide: `
BRAND: Plasmaide — pine bark extract supplement (AU/UK/US/EU)
TONE: Confident, science-backed, athletic, premium, accessible. Not clinical. Not hype.

CARDINAL RULES:
- No medical claims (no cure/treat/diagnose language)
- No mention of ashwagandha, mushrooms, or other adaptogens
- All health benefits attributed to Pine Bark Extract specifically
- Use qualifiers: "may help", "supports", "contributes to"
- TGA/FDA/EFSA/MHRA compliant language
- Include disclaimer on health-adjacent content
- No absolute guarantees ("will", "guaranteed to")
`.trim(),
}

const TYPE_PROMPTS: Partial<Record<ContentType, string>> = {
  blog: `Generate a Plasmaide blog article. Output valid JSON only:
{"title":"...","handle":"url-slug","body_html":"<HTML 800-1200 words with H2/H3>","summary_html":"<2-3 sentence excerpt>","meta_title":"<60 chars","meta_description":"<155 chars","tags":[],"shopify_blog_id":"${SHOPIFY_BLOG_ID}","target_keywords":[],"author":"Plasmaide"}`,
  email: `Generate a Plasmaide marketing email for DotDigital. Output valid JSON only:
{"subject":"...","preview_text":"<90 chars","body_html":"<responsive email HTML>","body_plain":"<plain text fallback>","target_keywords":[]}`,
  social_caption: `Generate a Plasmaide Instagram caption. Output valid JSON only:
{"caption":"...","hashtags":[],"platform":"instagram","image_brief":"<describe ideal visual>"}`,
  landing_page: `Generate a Plasmaide Shopify landing page. Output valid JSON only:
{"title":"...","handle":"page-slug","body_html":"<self-contained HTML with inline CSS>","meta_title":"<60 chars","meta_description":"<155 chars","target_keywords":[]}`,
}

const PLATFORM_MAP: Partial<Record<ContentType, string>> = {
  blog: 'shopify_blog',
  landing_page: 'shopify_page',
  email: 'dotdigital',
  social_caption: 'instagram',
}

function isTimeToGenerate(schedule: ContentSchedule): boolean {
  if (!schedule.enabled) return false

  const now = new Date(new Date().toLocaleString('en-US', { timeZone: schedule.timezone }))
  const [schedHour] = schedule.time.split(':').map(Number)
  const nowHour = now.getHours()
  const nowMin = now.getMinutes()

  // Allow within the current hour window (cron runs hourly)
  if (nowHour !== schedHour) return false
  if (nowMin > 5) return false // only first 5 mins of the hour

  const day = now.getDay() // 0=Sun, 6=Sat
  if (schedule.frequency === 'weekdays' && (day === 0 || day === 6)) return false
  if (schedule.frequency === 'weekly' && day !== 1) return false // Monday

  return true
}

function extractJson(raw: string): Record<string, unknown> {
  const stripped = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  const match = stripped.match(/\{[\s\S]*\}/)
  return JSON.parse(match ? match[0] : stripped) as Record<string, unknown>
}

async function generateForBrand(
  brandId: string,
  schedule: ContentSchedule,
  apiKey: string,
): Promise<{ ok: boolean; error?: string; contentType?: string }> {
  // Pick a content type that's in the schedule
  const types = schedule.content_types.filter((t) => TYPE_PROMPTS[t as ContentType])
  if (types.length === 0) return { ok: false, error: 'No valid content types configured' }

  const contentType = types[Math.floor(Math.random() * types.length)] as ContentType

  // Pick next topic from queue (rotate)
  const topic = schedule.topics_queue.length > 0
    ? schedule.topics_queue[Math.floor(Date.now() / 86400000) % schedule.topics_queue.length]
    : 'Pine bark extract benefits for athletic performance'

  const brandRules = BRAND_RULES[brandId] ?? ''
  const typePrompt = TYPE_PROMPTS[contentType] ?? ''
  const systemPrompt = [brandRules, typePrompt, 'Respond ONLY with valid JSON. No markdown fences.'].join('\n\n')

  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Generate ${contentType.replace('_', ' ')} content. Topic: ${topic}` }],
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return { ok: false, error: `Claude API error: ${res.status} — ${JSON.stringify(err)}` }
  }

  const data = (await res.json()) as { content: Array<{ type: string; text: string }> }
  const rawText = data.content?.[0]?.text ?? ''

  let generated: Record<string, unknown>
  try {
    generated = extractJson(rawText)
  } catch {
    return { ok: false, error: `JSON parse failed. Raw: ${rawText.slice(0, 200)}` }
  }

  if (contentType === 'blog') generated.shopify_blog_id = SHOPIFY_BLOG_ID

  try {
    await writeContentToQueue({
      brand_id: brandId,
      content_type: contentType,
      content: generated,
      platform: PLATFORM_MAP[contentType] ?? null,
      audience: null,
      source: 'cron',
    })
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }

  return { ok: true, contentType }
}

export async function GET(request: NextRequest) {
  // Vercel cron auth: only allow from Vercel or with correct secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  const isVercelCron = request.headers.get('x-vercel-cron') === '1'
  const isManual = authHeader === `Bearer ${cronSecret}`
  const isForced = request.nextUrl.searchParams.get('force') === '1'

  if (!isVercelCron && !isManual && !isForced) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const forceBrandId = request.nextUrl.searchParams.get('brand_id')
  const supabase = createAdminClient()

  // Load all brands with content schedule enabled (or the forced brand)
  let query = supabase
    .from('brand_settings')
    .select('brand_id, content_schedule, llm_api_key_encrypted')
    .eq('content_schedule->>enabled', 'true')

  if (forceBrandId) {
    query = supabase
      .from('brand_settings')
      .select('brand_id, content_schedule, llm_api_key_encrypted')
      .eq('brand_id', forceBrandId)
  }

  const { data: brands, error } = await query

  if (error) {
    console.error('[cron/generate-content] DB error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const results: Array<{ brand_id: string; ok: boolean; contentType?: string; error?: string }> = []
  const globalApiKey = process.env.ANTHROPIC_API_KEY ?? ''

  for (const brand of brands ?? []) {
    const schedule = brand.content_schedule as ContentSchedule

    // Skip if not forced and it's not time
    if (!isForced && forceBrandId !== brand.brand_id && !isTimeToGenerate(schedule)) continue

    const apiKey = brand.llm_api_key_encrypted ?? globalApiKey
    if (!apiKey) {
      results.push({ brand_id: brand.brand_id, ok: false, error: 'No API key configured' })
      continue
    }

    const result = await generateForBrand(brand.brand_id, schedule, apiKey)
    results.push({ brand_id: brand.brand_id, ...result })
  }

  return NextResponse.json({ ok: true, processed: results.length, results })
}
