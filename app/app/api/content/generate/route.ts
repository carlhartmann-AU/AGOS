import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAgentConfig } from '@/lib/llm/provider'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const DEFAULT_MODEL = 'claude-sonnet-4-6'
const SHOPIFY_BLOG_ID = '94553112861'

// ─── Brand + compliance rules (shared across all types) ───────────────────────

const BRAND_RULES = `
BRAND: Plasmaide — pine bark extract supplement (AU/UK/US/EU)
TONE: Confident, science-backed, athletic, premium, accessible. Not clinical. Not hype.
Think "elite sport meets everyday wellness."

CARDINAL RULES:
- No medical claims (no cure/treat/diagnose language)
- No mention of ashwagandha, mushrooms, or other adaptogens
- All health benefits attributed to Pine Bark Extract specifically
- Use qualifiers: "may help", "supports", "contributes to" — never absolute guarantees
- TGA/FDA/EFSA/MHRA compliant language
- Include disclaimer on health-adjacent content: "Pine Bark Extract is a dietary supplement. These statements have not been evaluated by the relevant regulatory authority. This product is not intended to diagnose, treat, cure, or prevent any disease."
- No absolute guarantees ("will", "guaranteed to")

ALLOWED TOPICS: Nitric oxide and blood flow, exercise recovery and endurance, pine bark extract research and benefits, athletic performance, cardiovascular health support, antioxidant properties, healthy ageing and vitality, hydration, sports nutrition fundamentals.

PROHIBITED: Ashwagandha/adaptogens, COVID/cancer/mental health treatment claims, weight loss, sexual performance, competitor comparisons.
`.trim()

// ─── Per-type system prompts ───────────────────────────────────────────────────

const TYPE_GUIDANCE: Record<string, string> = {
  blog: `You generate blog articles for Plasmaide's Shopify store.
Guidelines: Educational, not promotional (80/20 rule: 80% value, 20% product). 800-1200 words. Structured with H2/H3 hierarchy. Link to peer-reviewed studies where possible. Include a soft CTA at the end. Images: reference placeholders the team fills in.
Output schema:
{
  "title": "Article title",
  "handle": "url-slug-kebab-case",
  "body_html": "<full article HTML with H2/H3 structure>",
  "summary_html": "<2-3 sentence excerpt for listings>",
  "meta_title": "SEO title (max 60 chars)",
  "meta_description": "SEO description (max 155 chars)",
  "tags": ["tag1", "tag2", "tag3"],
  "shopify_blog_id": "94553112861",
  "target_keywords": ["primary", "secondary"],
  "author": "Plasmaide"
}`,

  landing_page: `You generate Shopify landing pages for Plasmaide campaigns.
Guidelines: Self-contained HTML with inline CSS. No JavaScript. Mobile-first using CSS Grid/Flexbox and relative units. Structure: Hero (value prop) → Social proof (athletes, certifications) → Benefits (Pine Bark Extract specific) → Trust signals (Informed Sport, firstFlagX) → CTA. Shopify's theme handles chrome.
Output schema:
{
  "title": "Page title",
  "handle": "page-handle-slug",
  "body_html": "<full page HTML with inline CSS — hero, social proof, benefits, trust signals, CTA sections>",
  "meta_title": "SEO title (max 60 chars)",
  "meta_description": "SEO description (max 155 chars)",
  "target_keywords": ["keyword1", "keyword2"]
}`,

  email: `You generate marketing emails for Plasmaide (sent via DotDigital).
Guidelines: Clear subject line, compelling preview text. HTML email compatible with major clients. Plain text fallback required. Lead with value. One clear CTA per email. Personalisation tokens use {{FIRST_NAME}} format.
Output schema:
{
  "subject": "Email subject line",
  "preview_text": "Preview text shown in inbox (max 90 chars)",
  "body_html": "<full email HTML — inline CSS, responsive, major-client compatible>",
  "body_plain": "Plain text version",
  "target_keywords": ["keyword1", "keyword2"]
}`,

  social_caption: `You generate social media captions for Plasmaide (primarily Instagram, also LinkedIn).
Guidelines: Punchy and engaging. 150-220 chars for Instagram (excluding hashtags). Natural brand voice — not forced. Include an image brief describing the ideal visual. 5-10 relevant hashtags.
Output schema:
{
  "caption": "Full caption text with natural line breaks",
  "hashtags": ["hashtag1", "hashtag2"],
  "platform": "instagram",
  "image_brief": "Detailed description of the ideal image/creative to pair with this caption"
}`,
}

const PLATFORM_MAP: Record<string, string> = {
  blog: 'shopify_blog',
  landing_page: 'shopify_page',
  email: 'dotdigital',
  social_caption: 'instagram',
}

// ─── Request body type ────────────────────────────────────────────────────────

type GenerateBody = {
  topic?: string
  target_keywords?: string[]
  content_type?: string
  additional_context?: string
  product_id?: string
  images?: Array<{ name: string; base64: string; mediaType: string }>
}

// ─── JSON extraction helper ───────────────────────────────────────────────────

function extractJson(raw: string): Record<string, unknown> {
  const stripped = raw
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()
  const match = stripped.match(/\{[\s\S]*\}/)
  const jsonStr = match ? match[0] : stripped
  return JSON.parse(jsonStr) as Record<string, unknown>
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }

  const agentCfg = await getAgentConfig('plasmaide', 'content')
  if (!agentCfg.enabled) {
    return NextResponse.json(
      { disabled: true, message: 'Content agent disabled for this brand' },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  let body: GenerateBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    topic,
    target_keywords = [],
    content_type = 'blog',
    additional_context,
    product_id,
    images = [],
  } = body

  if (!topic) {
    return NextResponse.json({ error: 'Missing required field: topic' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }

  const typeGuidance = TYPE_GUIDANCE[content_type]
  if (!typeGuidance) {
    return NextResponse.json({ error: `Unsupported content_type: ${content_type}` }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }

  // Optional: fetch lean product context (≤200 tokens)
  let productContext: string | null = null
  if (product_id) {
    try {
      const admin = createAdminClient()
      const { data: product } = await admin
        .from('products')
        .select('title, description_html, handle, status, product_variants(price, currency, position)')
        .eq('id', product_id)
        .single()

      if (product) {
        const firstVariant = (product.product_variants as Array<{ price: string; currency: string; position: number }> | null)
          ?.sort((a, b) => a.position - b.position)[0]
        const plainDesc = (product.description_html as string | null ?? '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 500)
        const parts = [
          `Title: ${product.title}`,
          `Handle: ${product.handle}`,
          `Status: ${product.status}`,
          firstVariant ? `Price: ${firstVariant.price} ${firstVariant.currency}` : null,
          plainDesc ? `Description: ${plainDesc}` : null,
          `Link: /products/${product.handle}`,
        ].filter(Boolean)
        productContext = `FEATURED PRODUCT:\n${parts.join('\n')}`
      }
    } catch (err) {
      console.warn('[content/generate] product fetch failed:', err)
    }
  }

  // Build system prompt
  const systemPrompt = [
    `You are the Content Studio agent for Plasmaide's Autonomous Growth Operating System (AGOS).`,
    BRAND_RULES,
    typeGuidance,
    productContext,
    `Respond ONLY with a valid JSON object. No markdown, no code fences, no explanation before or after.`,
    additional_context ? `\nADDITIONAL INSTRUCTIONS FROM USER:\n${additional_context}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  // Build user message content blocks (text + optional images)
  type TextBlock = { type: 'text'; text: string }
  type ImageBlock = {
    type: 'image'
    source: { type: 'base64'; media_type: string; data: string }
  }
  type ContentBlock = TextBlock | ImageBlock

  const textPrompt = `Generate ${content_type.replace('_', ' ')} content for Plasmaide with the following brief:

Topic: ${topic}
Target keywords: ${target_keywords.length > 0 ? target_keywords.join(', ') : 'none specified'}

Produce structured JSON output following the schema in your system prompt.`

  const messageContent: ContentBlock[] = []

  // Prepend images before the text prompt so Claude can reference them
  for (const img of images) {
    messageContent.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: img.mediaType,
        data: img.base64,
      },
    })
  }

  messageContent.push({ type: 'text', text: textPrompt })

  // Call Claude
  const claudeRes = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: agentCfg.model ?? DEFAULT_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: messageContent }],
    }),
  })

  if (!claudeRes.ok) {
    const errBody = await claudeRes.json().catch(() => ({}))
    return NextResponse.json(
      { error: `Claude API error: ${claudeRes.status}`, detail: errBody },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const claudeData = (await claudeRes.json()) as {
    content: Array<{ type: string; text: string }>
  }

  const rawText = claudeData.content?.[0]?.text ?? ''
  console.log('[content/generate] raw Claude response:', rawText.slice(0, 1000))

  let generated: Record<string, unknown>
  try {
    generated = extractJson(rawText)
  } catch {
    console.error('[content/generate] JSON parse failed. Raw text:', rawText)
    return NextResponse.json(
      { error: 'Claude returned invalid JSON', raw: rawText.slice(0, 500) },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  // Ensure shopify_blog_id on blog content
  if (content_type === 'blog') {
    generated.shopify_blog_id = SHOPIFY_BLOG_ID
  }

  const { data: row, error: insertError } = await supabase
    .from('content_queue')
    .insert({
      brand_id: 'plasmaide',
      content_type,
      status: 'pending',
      platform: PLATFORM_MAP[content_type] ?? null,
      content: { ...generated, ...(product_id ? { product_id } : {}) },
      compliance_result: { status: 'pending', notes: [] },
    })
    .select('id')
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }

  // Fire-and-forget compliance check — result writes back asynchronously
  fetch(`${request.nextUrl.origin}/api/agents/compliance/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content_id: row.id }),
  }).catch((err) => console.error('[content/generate] compliance trigger failed:', err))

  return NextResponse.json({ ok: true, id: row.id, content_type }, { headers: { 'Cache-Control': 'no-store' } })
}
