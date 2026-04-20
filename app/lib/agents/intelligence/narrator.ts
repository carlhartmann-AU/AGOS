// lib/agents/intelligence/narrator.ts
import Anthropic from '@anthropic-ai/sdk'
import type { RevenueSummary, ContentSummary, ComplianceSummary, Anomaly, Recommendation } from './types'

const PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 1.00, output: 5.00 },
  'claude-sonnet-4-6':         { input: 3.00, output: 15.00 },
  'claude-opus-4-7':           { input: 15.00, output: 75.00 },
}

function calcCost(model: string, tokens: { input: number; output: number }): number {
  const p = PRICING[model]
  if (!p) return 0
  return (tokens.input / 1_000_000) * p.input + (tokens.output / 1_000_000) * p.output
}

function parseNarratorResponse(raw: string): { narrative: string; recommendations: Recommendation[] } {
  const cleaned = raw.replace(/```json|```/g, '').trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) throw new Error(`Could not parse narrator response: ${raw.slice(0, 200)}`)
  const parsed = JSON.parse(match[0])
  return {
    narrative: typeof parsed.narrative === 'string' ? parsed.narrative : '',
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
  }
}

export interface NarratorResult {
  narrative: string
  recommendations: Recommendation[]
  tokens: { input: number; output: number }
  cost_usd: number
  model_used: string
}

export async function runNarrator(
  revenue: RevenueSummary,
  content: ContentSummary,
  compliance: ComplianceSummary,
  anomalies: Anomaly[],
  modelConfig?: { fast?: string; accurate?: string; premium?: string }
): Promise<NarratorResult> {
  const model = modelConfig?.accurate ?? 'claude-sonnet-4-6'

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const systemPrompt = `You are the Intelligence Analyst for a DTC e-commerce brand. You produce concise, data-driven weekly reports.`

  const userPrompt = `Analyse the following weekly performance data and produce a structured report.

DATA:
${JSON.stringify({ revenue, content, compliance, anomalies }, null, 2)}

Respond ONLY with a valid JSON object matching this schema — no markdown, no commentary:
{
  "narrative": "<executive summary: 3-5 sentences with actual numbers from the data>",
  "recommendations": [
    {
      "priority": "high|medium|low",
      "category": "revenue|content|compliance|operations",
      "title": "<short title>",
      "description": "<1-2 sentence description referencing specific data>",
      "suggested_action": "<concrete next action>"
    }
  ]
}

Rules:
- narrative: factual, data-driven, include WoW changes and key highlights
- recommendations: 3-5 items, ordered by priority, grounded in the data
- priority must be exactly "high", "medium", or "low"
- category must be exactly one of "revenue", "content", "compliance", "operations"`

  const response = await anthropic.messages.create({
    model,
    max_tokens: 1500,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') throw new Error('No text response from narrator')

  const tokens = { input: response.usage.input_tokens, output: response.usage.output_tokens }
  const { narrative, recommendations } = parseNarratorResponse(textBlock.text)

  return {
    narrative,
    recommendations,
    tokens,
    cost_usd: calcCost(model, tokens),
    model_used: model,
  }
}
