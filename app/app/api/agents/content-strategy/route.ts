/**
 * POST /api/agents/content-strategy
 *
 * Called by n8n. Runs the Content Strategy → Compliance pipeline and
 * inserts results into content_queue.
 *
 * Auth: Authorization: Bearer <AGENT_API_SECRET>
 *
 * Request body:
 * {
 *   brand_id: string,
 *   brief: ContentBrief
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   inserted: InsertedItem[],   // items that reached pending or escalated status
 *   failed: FailedItem[]        // items that exhausted retries (inserted as escalated)
 * }
 *
 * Flow per content piece:
 *   Attempt 1–3:
 *     Content Strategy (Claude) → Compliance (Claude)
 *     PASS      → insert status='pending', done
 *     ESCALATE  → insert status='escalated', done
 *     FAIL      → pass violations back to Content Strategy, retry
 *   After 3 failed attempts → insert status='escalated'
 */

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAgentConfig } from '@/lib/llm/provider'
import { CONTENT_STRATEGY_PROMPT, COMPLIANCE_PROMPT } from '@/lib/agents/prompts'

// ─── Types ────────────────────────────────────────────────────────────────────

type ContentBrief = {
  type: 'email' | 'blog' | 'social_caption' | 'ad' | 'landing_page' | 'b2b_email' | 'cs_response' | 'review_response'
  audience: 'professional_athlete' | 'prosumer' | 'wellness'
  platform: string
  sequence?: 'welcome' | 'post_purchase' | 'win_back' | 'standalone'
  step?: number
  instructions?: string
  intelligence_brief?: string
  market?: 'AU' | 'UK' | 'US' | 'EU'
  count?: number
}

type ContentPiece = {
  id: string
  type: string
  audience: string
  subject?: string
  body_html: string
  body_plain: string
  sequence?: string
  step?: number
  platform_format?: string
  image_brief?: string
  seo_keywords?: string[]
  compliance_notes?: string
}

type ContentStrategyOutput = {
  brand_id: string
  content_pieces: ContentPiece[]
  error?: string
}

type ComplianceViolation = {
  check: string
  severity: 'critical' | 'warning'
  location: string
  original: string
  suggestion: string
  rule_reference: string
}

type ComplianceOutput = {
  content_id: string
  result: 'PASS' | 'FAIL' | 'ESCALATE'
  violations: ComplianceViolation[]
  escalation_reason?: string
}

type InsertedItem = {
  id: string
  status: 'pending' | 'escalated'
  compliance_result: 'PASS' | 'ESCALATE'
  attempt: number
}

type FailedItem = {
  content_id: string
  reason: string
  violations: ComplianceViolation[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_COMPLIANCE_ATTEMPTS = 3
const DEFAULT_MODEL = 'claude-sonnet-4-6'

// ─── Auth ─────────────────────────────────────────────────────────────────────

function authenticate(req: NextRequest): boolean {
  const secret = process.env.AGENT_API_SECRET
  if (!secret) {
    console.error('[content-strategy] AGENT_API_SECRET is not set')
    return false
  }
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

// ─── Input validation ─────────────────────────────────────────────────────────

function validatePayload(body: unknown): { brand_id: string; brief: ContentBrief } | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>

  if (!b.brand_id || typeof b.brand_id !== 'string') return null
  if (!b.brief || typeof b.brief !== 'object') return null

  const brief = b.brief as Record<string, unknown>
  const validTypes = ['email', 'blog', 'social_caption', 'ad', 'landing_page', 'b2b_email', 'cs_response', 'review_response']
  const validAudiences = ['professional_athlete', 'prosumer', 'wellness']

  if (!brief.type || !validTypes.includes(brief.type as string)) return null
  if (!brief.audience || !validAudiences.includes(brief.audience as string)) return null
  if (!brief.platform || typeof brief.platform !== 'string') return null

  return { brand_id: b.brand_id as string, brief: brief as unknown as ContentBrief }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Strip markdown code fences that Claude sometimes wraps JSON in despite instructions. */
function stripFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
}

// ─── Claude calls ─────────────────────────────────────────────────────────────

async function callContentStrategy(
  anthropic: Anthropic,
  brandId: string,
  brief: ContentBrief,
  violations: ComplianceViolation[] | null,
  model: string,
): Promise<{ output: ContentStrategyOutput; usage: Anthropic.Usage }> {
  const userContent = violations
    ? `Brand: ${brandId}\n\nBrief:\n${JSON.stringify(brief, null, 2)}\n\nThe previous version of this content failed compliance. Fix ALL of these violations before generating new content:\n${JSON.stringify(violations, null, 2)}`
    : `Brand: ${brandId}\n\nBrief:\n${JSON.stringify(brief, null, 2)}`

  const response = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    system: [
      {
        type: 'text',
        text: CONTENT_STRATEGY_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userContent }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const stripped = stripFences(text)
  try {
    const output = JSON.parse(stripped) as ContentStrategyOutput
    return { output, usage: response.usage }
  } catch (parseErr) {
    // Surface the raw response so we can see what Claude returned
    const preview = stripped.slice(0, 500)
    throw new Error(`JSON parse failed: ${(parseErr as Error).message} — raw preview: ${preview}`)
  }
}

async function callCompliance(
  anthropic: Anthropic,
  piece: ContentPiece,
  model: string,
): Promise<{ output: ComplianceOutput; usage: Anthropic.Usage }> {
  const response = await anthropic.messages.create({
    model,
    max_tokens: 2048,
    system: [
      {
        type: 'text',
        text: COMPLIANCE_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Review this content piece for compliance:\n${JSON.stringify(piece, null, 2)}`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const output = JSON.parse(stripFences(text)) as ComplianceOutput
  return { output, usage: response.usage }
}

// ─── Database helpers ─────────────────────────────────────────────────────────

async function insertQueueItem(
  supabase: ReturnType<typeof createAdminClient>,
  brandId: string,
  brief: ContentBrief,
  piece: ContentPiece,
  complianceResult: ComplianceOutput,
  status: 'pending' | 'escalated',
) {
  const { data, error } = await supabase
    .from('content_queue')
    .insert({
      brand_id: brandId,
      content_type: piece.type,
      status,
      content: piece,
      compliance_result: complianceResult,
      platform: brief.platform ?? null,
      audience: piece.audience ?? null,
    })
    .select('id, status')
    .single()

  if (error) throw new Error(`Queue insert failed: ${error.message}`)
  return data as { id: string; status: string }
}

async function insertAuditLog(
  supabase: ReturnType<typeof createAdminClient>,
  brandId: string,
  agent: string,
  action: string,
  tokensIn: number,
  tokensOut: number,
  status: 'success' | 'failure' | 'escalated',
  inputSummary: string,
  outputSummary: string,
  errorMessage?: string,
) {
  await supabase.from('audit_log').insert({
    brand_id: brandId,
    agent,
    action,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    status,
    input_summary: inputSummary.slice(0, 500),
    output_summary: outputSummary.slice(0, 500),
    error_message: errorMessage ?? null,
  })
}

// ─── Core pipeline ────────────────────────────────────────────────────────────

/**
 * Runs a single content piece through compliance with retry.
 * Returns the piece's final disposition.
 */
async function runPieceThroughCompliance(
  anthropic: Anthropic,
  supabase: ReturnType<typeof createAdminClient>,
  brandId: string,
  brief: ContentBrief,
  piece: ContentPiece,
  attempt: number,
  csTotalTokensIn: number,
  csTotalTokensOut: number,
  complianceModel: string,
): Promise<{
  inserted?: InsertedItem
  failed?: FailedItem
  pendingViolations?: ComplianceViolation[]
  compTokensIn: number
  compTokensOut: number
}> {
  let compTokensIn = 0
  let compTokensOut = 0

  // Run compliance check
  const { output: comp, usage: compUsage } = await callCompliance(anthropic, piece, complianceModel)
  compTokensIn += compUsage.input_tokens
  compTokensOut += compUsage.output_tokens

  if (comp.result === 'PASS' || comp.result === 'ESCALATE') {
    const status = comp.result === 'PASS' ? 'pending' : 'escalated'
    const row = await insertQueueItem(supabase, brandId, brief, piece, comp, status)

    // Log compliance agent call
    await insertAuditLog(
      supabase,
      brandId,
      'compliance',
      'compliance_check',
      compTokensIn + csTotalTokensIn,
      compTokensOut + csTotalTokensOut,
      comp.result === 'ESCALATE' ? 'escalated' : 'success',
      `piece_id=${piece.id} attempt=${attempt}`,
      `result=${comp.result} violations=${comp.violations.length}`,
    )

    return {
      inserted: {
        id: row.id,
        status: status as 'pending' | 'escalated',
        compliance_result: comp.result,
        attempt,
      },
      compTokensIn,
      compTokensOut,
    }
  }

  // FAIL — return violations for retry or escalation
  return {
    pendingViolations: comp.violations,
    compTokensIn,
    compTokensOut,
  }
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Auth
  if (!authenticate(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 2. Parse and validate
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const validated = validatePayload(body)
  if (!validated) {
    return NextResponse.json(
      { error: 'Missing or invalid fields: brand_id (string), brief.type, brief.audience, brief.platform are required' },
      { status: 422 },
    )
  }

  const { brand_id, brief } = validated

  // 3. Check agent_config enabled + resolve models
  const [contentCfg, complianceCfg] = await Promise.all([
    getAgentConfig(brand_id, 'content'),
    getAgentConfig(brand_id, 'compliance'),
  ])

  if (!contentCfg.enabled) {
    return NextResponse.json(
      { error: `Agent content disabled for brand ${brand_id}`, success: false, disabled: true },
      { status: 200 },
    )
  }

  const csModel = contentCfg.model ?? DEFAULT_MODEL
  const complianceModel = complianceCfg.model ?? DEFAULT_MODEL

  // 4. Initialise clients
  let supabase: ReturnType<typeof createAdminClient>
  try {
    supabase = createAdminClient()
  } catch (err) {
    console.error('[content-strategy] Supabase admin client error:', err)
    return NextResponse.json({ error: 'Server configuration error' }, { status: 503 })
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // 5. Run the pipeline
  const inserted: InsertedItem[] = []
  const failed: FailedItem[] = []

  // Track per-piece violation history for retry
  type PieceState = {
    piece: ContentPiece
    violations: ComplianceViolation[]
    attempt: number
  }

  // Initial Content Strategy call (attempt 1)
  let csTotalTokensIn = 0
  let csTotalTokensOut = 0
  let pendingPieces: PieceState[] = []

  try {
    const { output: csOutput, usage: csUsage } = await callContentStrategy(
      anthropic,
      brand_id,
      brief,
      null,
      csModel,
    )
    csTotalTokensIn += csUsage.input_tokens
    csTotalTokensOut += csUsage.output_tokens

    await insertAuditLog(
      supabase,
      brand_id,
      'content_strategy',
      'generate_content',
      csTotalTokensIn,
      csTotalTokensOut,
      'success',
      `type=${brief.type} audience=${brief.audience} platform=${brief.platform}`,
      `pieces_generated=${csOutput.content_pieces?.length ?? 0}`,
    )

    if (!csOutput.content_pieces?.length) {
      return NextResponse.json(
        { error: csOutput.error ?? 'Content Strategy returned no content pieces', success: false },
        { status: 422 },
      )
    }

    pendingPieces = csOutput.content_pieces.map((piece) => ({
      piece,
      violations: [],
      attempt: 1,
    }))
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[content-strategy] Content Strategy call failed:', msg)

    await insertAuditLog(
      supabase,
      brand_id,
      'content_strategy',
      'generate_content',
      csTotalTokensIn,
      csTotalTokensOut,
      'failure',
      `type=${brief.type} audience=${brief.audience}`,
      '',
      msg,
    )

    return NextResponse.json({ error: `Content Strategy agent failed: ${msg}`, success: false }, { status: 502 })
  }

  // Run compliance → retry loop (up to MAX_COMPLIANCE_ATTEMPTS per piece)
  for (let attempt = 1; attempt <= MAX_COMPLIANCE_ATTEMPTS; attempt++) {
    if (pendingPieces.length === 0) break

    const stillFailing: PieceState[] = []

    for (const state of pendingPieces) {
      let compTokensIn = 0
      let compTokensOut = 0

      try {
        const result = await runPieceThroughCompliance(
          anthropic,
          supabase,
          brand_id,
          brief,
          state.piece,
          attempt,
          csTotalTokensIn,
          csTotalTokensOut,
          complianceModel,
        )
        compTokensIn += result.compTokensIn
        compTokensOut += result.compTokensOut

        if (result.inserted) {
          inserted.push(result.inserted)
          continue
        }

        // Piece failed compliance
        const violations = result.pendingViolations ?? []

        if (attempt === MAX_COMPLIANCE_ATTEMPTS) {
          // Exhausted retries — escalate
          console.warn(`[content-strategy] Piece ${state.piece.id} exceeded ${MAX_COMPLIANCE_ATTEMPTS} compliance attempts — escalating`)

          // Build a synthetic compliance output for the escalated record
          const escalatedComp: ComplianceOutput = {
            content_id: state.piece.id,
            result: 'ESCALATE',
            violations,
            escalation_reason: `Exceeded ${MAX_COMPLIANCE_ATTEMPTS} compliance attempts. Last attempt had ${violations.length} violation(s).`,
          }

          const row = await insertQueueItem(supabase, brand_id, brief, state.piece, escalatedComp, 'escalated')

          await insertAuditLog(
            supabase,
            brand_id,
            'compliance',
            'compliance_check',
            compTokensIn,
            compTokensOut,
            'escalated',
            `piece_id=${state.piece.id} attempt=${attempt}`,
            `auto_escalated violations=${violations.length}`,
          )

          failed.push({
            content_id: row.id,
            reason: `max_retries_exceeded after ${MAX_COMPLIANCE_ATTEMPTS} attempts`,
            violations,
          })
        } else {
          // Queue for retry with updated violations context
          stillFailing.push({ piece: state.piece, violations, attempt: attempt + 1 })
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[content-strategy] Compliance check error for piece ${state.piece.id}:`, msg)

        await insertAuditLog(
          supabase,
          brand_id,
          'compliance',
          'compliance_check',
          compTokensIn,
          compTokensOut,
          'failure',
          `piece_id=${state.piece.id} attempt=${attempt}`,
          '',
          msg,
        )

        // Treat unexpected errors as escalation to avoid silent data loss
        failed.push({
          content_id: state.piece.id,
          reason: `compliance_error: ${msg}`,
          violations: [],
        })
      }
    }

    // If there are pieces still failing, regenerate them via Content Strategy
    if (stillFailing.length > 0 && attempt < MAX_COMPLIANCE_ATTEMPTS) {
      const allViolations = stillFailing.flatMap((s) => s.violations)

      try {
        const retryBrief = { ...brief, compliance_violations: allViolations }
        const { output: csRetryOutput, usage: csRetryUsage } = await callContentStrategy(
          anthropic,
          brand_id,
          retryBrief as ContentBrief & { compliance_violations: ComplianceViolation[] },
          allViolations,
          csModel,
        )
        csTotalTokensIn += csRetryUsage.input_tokens
        csTotalTokensOut += csRetryUsage.output_tokens

        await insertAuditLog(
          supabase,
          brand_id,
          'content_strategy',
          'regenerate_content',
          csRetryUsage.input_tokens,
          csRetryUsage.output_tokens,
          'success',
          `retry_attempt=${attempt + 1} violations=${allViolations.length}`,
          `pieces_generated=${csRetryOutput.content_pieces?.length ?? 0}`,
        )

        // Replace failing pieces with regenerated versions
        // Match by index since UUIDs will differ
        pendingPieces = (csRetryOutput.content_pieces ?? []).map((piece, i) => ({
          piece,
          violations: stillFailing[i]?.violations ?? [],
          attempt: attempt + 1,
        }))
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[content-strategy] Retry CS call failed at attempt ${attempt + 1}:`, msg)

        await insertAuditLog(
          supabase,
          brand_id,
          'content_strategy',
          'regenerate_content',
          0,
          0,
          'failure',
          `retry_attempt=${attempt + 1}`,
          '',
          msg,
        )

        // Mark all still-failing pieces as failed — can't retry
        for (const state of stillFailing) {
          failed.push({
            content_id: state.piece.id,
            reason: `retry_cs_failed: ${msg}`,
            violations: state.violations,
          })
        }
        break
      }
    } else {
      pendingPieces = stillFailing
    }
  }

  return NextResponse.json({
    success: true,
    inserted,
    failed,
    summary: {
      total: inserted.length + failed.length,
      pending: inserted.filter((i) => i.status === 'pending').length,
      escalated: inserted.filter((i) => i.status === 'escalated').length + failed.length,
    },
  })
}
