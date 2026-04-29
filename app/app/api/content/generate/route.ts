import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAgentConfig } from '@/lib/llm/provider'
import { writeContentToQueue } from '@/lib/content/queue-writer'
import { maxTokensForContentType } from '@/lib/content/token-budgets'
import { uploadFile, ShopifyFilesError } from '@/lib/shopify/files-client'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'
const DEFAULT_MODEL = 'claude-sonnet-4-6'
const SHOPIFY_BLOG_ID = '94553112861'
const MAX_HERO_SIZE = 5 * 1024 * 1024
const ALLOWED_HERO_MIME = ['image/jpeg', 'image/png']
const NO_STORE = { 'Cache-Control': 'no-store' }

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
Guidelines: Educational, not promotional (80/20 rule: 80% value, 20% product). 800-1200 words. Structured with H2/H3 hierarchy. Link to peer-reviewed studies where possible. Include a soft CTA at the end.
IMPORTANT: The article body must contain text only. Do NOT include any <img> tags, markdown image syntax, or image placeholder tokens of any kind. Hero images are managed separately by the publishing workflow.
Output schema:
{
  "title": "Article title",
  "handle": "url-slug-kebab-case",
  "body_html": "<full article HTML with H2/H3 structure — text only, no images>",
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
IMPORTANT: Do NOT include any <img> tags or image references in the generated HTML. Do not embed images, reference placeholder filenames, or use markdown image syntax. All imagery is managed separately by the publishing workflow.
Output schema:
{
  "title": "Page title",
  "handle": "page-handle-slug",
  "body_html": "<full page HTML with inline CSS — hero, social proof, benefits, trust signals, CTA sections — no images>",
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
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })
  }

  // Resolve brand_id from session profile
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('brand_id')
    .eq('id', user.id)
    .single()

  if (!profile?.brand_id) {
    return NextResponse.json(
      { error: 'No brand associated with this user' },
      { status: 403, headers: NO_STORE },
    )
  }
  const brand_id = profile.brand_id as string

  const agentCfg = await getAgentConfig(brand_id, 'content')
  if (!agentCfg.enabled) {
    return NextResponse.json(
      { disabled: true, message: 'Content agent disabled for this brand' },
      { status: 200, headers: NO_STORE },
    )
  }

  // Parse multipart/form-data
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid request body — expected multipart/form-data' }, { status: 400, headers: NO_STORE })
  }

  const topic = (formData.get('topic') as string | null)?.trim() ?? ''
  const content_type = (formData.get('content_type') as string | null) ?? 'blog'
  const additional_context = (formData.get('additional_context') as string | null)?.trim() || undefined
  const product_id = formData.get('product_id') as string | null
  const heroImageFile = formData.get('hero_image') as File | null

  let target_keywords: string[] = []
  try {
    const kw = formData.get('target_keywords') as string | null
    target_keywords = kw ? JSON.parse(kw) as string[] : []
  } catch { /* ignore */ }

  let images: Array<{ name: string; base64: string; mediaType: string }> = []
  try {
    const imgs = formData.get('images') as string | null
    images = imgs ? JSON.parse(imgs) as typeof images : []
  } catch { /* ignore */ }

  if (!topic) {
    return NextResponse.json({ error: 'Missing required field: topic' }, { status: 400, headers: NO_STORE })
  }

  const typeGuidance = TYPE_GUIDANCE[content_type]
  if (!typeGuidance) {
    return NextResponse.json({ error: `Unsupported content_type: ${content_type}` }, { status: 400, headers: NO_STORE })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500, headers: NO_STORE })
  }

  // ── Validate hero image if present ──────────────────────────────────────────
  const hasHeroFile = heroImageFile && heroImageFile.size > 0
  if (hasHeroFile) {
    if (!ALLOWED_HERO_MIME.includes(heroImageFile.type)) {
      return NextResponse.json(
        { error_code: 'INVALID_IMAGE', error_message: `Hero image must be JPEG or PNG, got ${heroImageFile.type}` },
        { status: 400, headers: NO_STORE },
      )
    }
    if (heroImageFile.size > MAX_HERO_SIZE) {
      return NextResponse.json(
        { error_code: 'INVALID_IMAGE', error_message: 'Hero image must be ≤ 5MB' },
        { status: 400, headers: NO_STORE },
      )
    }
  }

  // ── Hero image upload BEFORE Claude (fail-fast on cheap op) ─────────────────
  let heroImageResult: {
    status: 'uploaded' | 'failed' | 'omitted'
    cdn_url: string | null
    file_id: string | null
    error_code: string | null
    error_message: string | null
  } = { status: 'omitted', cdn_url: null, file_id: null, error_code: null, error_message: null }

  if (hasHeroFile) {
    const { data: conn } = await admin
      .from('shopify_connections')
      .select('shop_domain, access_token')
      .eq('brand_id', brand_id)
      .neq('sync_status', 'disconnected')
      .neq('access_token', '')
      .order('connected_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!conn) {
      heroImageResult = {
        status: 'failed',
        cdn_url: null,
        file_id: null,
        error_code: 'NO_SHOPIFY_CONNECTION',
        error_message: 'No active Shopify connection — article will generate without hero image',
      }
      console.error('[content/generate] hero upload skipped: no shopify_connection for brand', brand_id)
    } else {
      try {
        const ext = heroImageFile.type === 'image/png' ? 'png' : 'jpg'
        const fileName = `agos-hero-${Date.now()}.${ext}`
        const arrayBuffer = await heroImageFile.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        const result = await uploadFile({
          shopDomain: conn.shop_domain,
          accessToken: conn.access_token,
          fileName,
          mimeType: heroImageFile.type,
          fileSize: buffer.byteLength,
          body: buffer,
        })
        heroImageResult = {
          status: 'uploaded',
          cdn_url: result.cdnUrl,
          file_id: result.fileId,
          error_code: null,
          error_message: null,
        }
      } catch (err) {
        const stage = err instanceof ShopifyFilesError ? err.stage : 'unknown'
        const errorCode = err instanceof ShopifyFilesError ? err.errorCode : 'UNKNOWN_ERROR'
        const message = err instanceof Error ? err.message : String(err)
        console.error('[content/generate] hero upload failed (soft-proceed):', {
          brand_id, stage, errorCode, message,
          retry_count: err instanceof ShopifyFilesError ? err.retryCount : undefined,
        })
        heroImageResult = {
          status: 'failed',
          cdn_url: null,
          file_id: null,
          error_code: errorCode,
          error_message: `Upload failed at ${stage}: ${message}`,
        }
      }
    }
  }

  // ── Optional: lean product context (≤200 tokens) ─────────────────────────────
  let productContext: string | null = null
  if (product_id) {
    try {
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

  // ── Build system prompt ───────────────────────────────────────────────────────
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

  // ── Build message content ────────────────────────────────────────────────────
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

  const max_tokens = maxTokensForContentType(content_type)

  // ── Call Claude ────────────────────────────────────────────────────────────
  const claudeRes = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: agentCfg.model ?? DEFAULT_MODEL,
      max_tokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: messageContent }],
    }),
  })

  if (!claudeRes.ok) {
    const errBody = await claudeRes.json().catch(() => ({}))
    return NextResponse.json(
      { error: `Claude API error: ${claudeRes.status}`, detail: errBody },
      { status: 502, headers: NO_STORE },
    )
  }

  const claudeData = (await claudeRes.json()) as {
    content: Array<{ type: string; text: string }>
    stop_reason: string
  }

  const rawText = claudeData.content?.[0]?.text ?? ''
  const stopReason = claudeData.stop_reason
  if (stopReason === 'max_tokens') {
    console.error('[content/generate] Response truncated at max_tokens', {
      content_type,
      max_tokens,
      stop_reason: stopReason,
      raw_length: rawText.length,
    })
    return NextResponse.json(
      {
        error: 'Generation truncated — content too long for token budget',
        detail: `Claude hit the ${max_tokens} token ceiling before completing the response. Try a more concise topic, or contact the team if this persists.`,
        stop_reason: stopReason,
      },
      { status: 502 },
    )
  }
  console.log('[content/generate] raw Claude response:', rawText.slice(0, 1000))

  let generated: Record<string, unknown>
  try {
    generated = extractJson(rawText)
  } catch {
    console.error('[content/generate] JSON parse failed. Raw text:', rawText)
    return NextResponse.json(
      { error: 'Claude returned invalid JSON', raw: rawText.slice(0, 500) },
      { status: 502, headers: NO_STORE },
    )
  }

  if (content_type === 'blog') {
    generated.shopify_blog_id = SHOPIFY_BLOG_ID
  }

  let queueResult: { content_id: string; compliance_result: { status: string; notes?: string[] } }
  try {
    queueResult = await writeContentToQueue({
      brand_id,
      content_type,
      content: { ...generated, ...(product_id ? { product_id } : {}) },
      platform: PLATFORM_MAP[content_type] ?? null,
      audience: null,
      source: 'user_generation',
      actor: user.email ?? undefined,
      runComplianceSync: false,
      hero_image_url: heroImageResult.cdn_url,
      hero_image_status: heroImageResult.status === 'omitted' ? null : heroImageResult.status,
      hero_image_file_id: heroImageResult.file_id,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[content/generate] queue write failed:', msg)
    return NextResponse.json({ error: msg }, { status: 500, headers: NO_STORE })
  }

  return NextResponse.json(
    {
      ok: true,
      id: queueResult.content_id,
      content_type,
      compliance_result: queueResult.compliance_result,
      hero_image: heroImageResult,
    },
    { headers: NO_STORE },
  )
}
