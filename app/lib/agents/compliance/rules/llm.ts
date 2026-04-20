// lib/agents/compliance/rules/llm.ts
// LLM-powered rule evaluators — for nuanced checks requiring judgment

import Anthropic from '@anthropic-ai/sdk'
import type {
  LLMCheckRule,
  ToneCheckRule,
  ContentItem,
  RuleResult,
  ModelTier,
} from '@/types/compliance'

// Default model map — overridden by brand_settings.compliance.llm_config
const DEFAULT_MODELS: Record<ModelTier, string> = {
  fast: 'claude-haiku-4-5-20251001',
  accurate: 'claude-sonnet-4-6',
  premium: 'claude-opus-4-7',
}

// Pricing per million tokens (for cost tracking)
// Update these if Anthropic pricing changes
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 1.00, output: 5.00 },
  'claude-sonnet-4-6':         { input: 3.00, output: 15.00 },
  'claude-opus-4-7':           { input: 15.00, output: 75.00 },
}

function resolveModel(tier: ModelTier | undefined, llmConfig?: Record<ModelTier, string>): string {
  const resolvedTier = tier ?? 'fast'
  return llmConfig?.[resolvedTier] ?? DEFAULT_MODELS[resolvedTier]
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function contentToText(content: ContentItem): string {
  const parts: string[] = []
  if (content.title) parts.push(`TITLE: ${content.title}`)
  if (content.meta_description) parts.push(`META: ${content.meta_description}`)
  if (content.summary_html) parts.push(`SUMMARY: ${stripHtml(content.summary_html)}`)
  if (content.body_html) parts.push(`BODY:\n${stripHtml(content.body_html)}`)
  if (content.tags?.length) parts.push(`TAGS: ${content.tags.join(', ')}`)
  return parts.join('\n\n')
}

// Shared JSON schema instruction — Claude is good at this when given tight constraints
const STRUCTURED_OUTPUT_INSTRUCTION = `
Respond ONLY with a valid JSON object matching this exact schema — no preamble, no markdown fences, no commentary:
{
  "passed": boolean,
  "explanation": string,
  "suggested_fix": string | null
}

Rules:
- "passed": true if the content complies with the rule, false if it violates
- "explanation": concise (1-2 sentences) reason for the verdict, quoting specific problematic phrases if relevant
- "suggested_fix": if passed=false, propose a compliant rewrite of the problematic portion; otherwise null
`.trim()

interface LLMVerdict {
  passed: boolean
  explanation: string
  suggested_fix: string | null
}

function parseVerdict(raw: string): LLMVerdict {
  // Be forgiving: strip markdown fences if present, extract first JSON object
  const cleaned = raw.replace(/```json|```/g, '').trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) {
    throw new Error(`Could not parse LLM verdict from response: ${raw.slice(0, 200)}`)
  }
  const parsed = JSON.parse(match[0])
  if (typeof parsed.passed !== 'boolean' || typeof parsed.explanation !== 'string') {
    throw new Error(`LLM verdict missing required fields`)
  }
  return {
    passed: parsed.passed,
    explanation: parsed.explanation,
    suggested_fix: parsed.suggested_fix ?? null,
  }
}

export async function evaluateLLMCheck(
  rule: LLMCheckRule,
  content: ContentItem,
  anthropic: Anthropic,
  llmConfig?: Record<ModelTier, string>
): Promise<RuleResult> {
  const model = resolveModel(rule.model_tier, llmConfig)
  const contentText = contentToText(content)

  const systemPrompt = `You are a compliance reviewer for marketing content. Evaluate the content against the specific rule provided. Be precise: only flag actual violations, not hypothetical concerns. Quote specific phrases when flagging issues.`

  const userPrompt = `RULE: ${rule.name}
${rule.description ? `DESCRIPTION: ${rule.description}\n` : ''}
EVALUATION CRITERIA: ${rule.prompt}

CONTENT TO EVALUATE:
---
${contentText}
---

${STRUCTURED_OUTPUT_INSTRUCTION}`

  const response = await anthropic.messages.create({
    model,
    max_tokens: 600,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from LLM')
  }

  const verdict = parseVerdict(textBlock.text)

  return {
    rule_id: rule.id,
    rule_name: rule.name,
    severity: rule.severity,
    passed: verdict.passed,
    explanation: verdict.explanation,
    suggested_fix: verdict.suggested_fix ?? undefined,
    model_used: model,
    tokens_used: {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
    },
  }
}

export async function evaluateToneCheck(
  rule: ToneCheckRule,
  content: ContentItem,
  brandProfile: Record<string, unknown>,
  anthropic: Anthropic,
  llmConfig?: Record<ModelTier, string>
): Promise<RuleResult> {
  const model = resolveModel(rule.model_tier, llmConfig)
  const contentText = contentToText(content)

  const brandVoice = [
    brandProfile.voice && `Voice: ${brandProfile.voice}`,
    brandProfile.tone && `Tone: ${brandProfile.tone}`,
    brandProfile.values && `Values: ${Array.isArray(brandProfile.values) ? brandProfile.values.join(', ') : brandProfile.values}`,
    brandProfile.forbidden_phrases && `Never use: ${Array.isArray(brandProfile.forbidden_phrases) ? brandProfile.forbidden_phrases.join(', ') : brandProfile.forbidden_phrases}`,
  ].filter(Boolean).join('\n')

  const userPrompt = `You are evaluating whether marketing content matches a brand's voice.

BRAND VOICE PROFILE:
${brandVoice || '(No brand profile configured)'}

CONTENT TO EVALUATE:
---
${contentText}
---

Does this content align with the brand voice? Flag only clear mismatches (wrong register, off-brand phrasing, contradictions with stated values). Minor stylistic variation is acceptable.

${STRUCTURED_OUTPUT_INSTRUCTION}`

  const response = await anthropic.messages.create({
    model,
    max_tokens: 600,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text response from LLM')
  }

  const verdict = parseVerdict(textBlock.text)

  return {
    rule_id: rule.id,
    rule_name: rule.name,
    severity: rule.severity,
    passed: verdict.passed,
    explanation: verdict.explanation,
    suggested_fix: verdict.suggested_fix ?? undefined,
    model_used: model,
    tokens_used: {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
    },
  }
}

export function calculateCost(model: string, tokens: { input: number; output: number }): number {
  const pricing = PRICING[model]
  if (!pricing) return 0
  return (tokens.input / 1_000_000) * pricing.input + (tokens.output / 1_000_000) * pricing.output
}
