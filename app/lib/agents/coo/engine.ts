import type { SupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import type { COOCard, COOStreamChunk } from './types'
import { getAnthropicTools } from './tools'
import { executeToolCall } from './tool-executors'

const MODEL = 'claude-sonnet-4-6'
const MAX_TOKENS = 2000
const MAX_TOOL_ITERATIONS = 5
const HISTORY_LIMIT = 20

const PRICING = { input: 3.00, output: 15.00 } // per 1M tokens

function calcCost(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * PRICING.input + (outputTokens / 1_000_000) * PRICING.output
}

function parseCards(text: string): COOCard[] {
  const match = text.match(/<<<CARDS>>>([\s\S]*?)<<<END_CARDS>>>/)
  if (!match) return []
  try {
    const parsed = JSON.parse(match[1].trim())
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const COO_SYSTEM_PROMPT = `You are the COO (Chief Operating Officer) of AGOS — an Autonomous Growth Operating System for the e-commerce brand Plasmaide.

You are the sole orchestrator of a 12-agent system. You route, delegate, monitor, and report. You do NOT do domain work yourself — you use tools to query agents and data, then synthesise insights.

Brand context:
- Plasmaide sells premium pine bark extract supplements
- Markets: ANZ (primary), UK, US, EU via Shopify Markets
- Display currency: AUD (A$)
- Fiscal year: July to June (FY26 = Jul 2025 - Jun 2026)

Your agents:
1. Intelligence Agent — market research, trend analysis, weekly reports
2. Content Strategy — blog/email/social content creation
3. Compliance Agent — health claim checking, regulatory compliance
4. CFO Agent — financial analysis, unit economics, cash forecasting
5. Campaign Execution — publishing approved content
6. B2B Outreach — wholesale prospect scoring, outreach copy (queued for approval)
7. Customer Service — ticket intake, classification, draft responses, adverse reaction escalation
8. Review Harvester — batch review analysis, sentiment, themes, repurpose quotes

Communication style:
- Executive-level: concise, data-driven, actionable
- Lead with the number, then the context
- Flag problems proactively
- When presenting data, use structured formats the UI can render as cards

When you have KPI data, alerts, or status info to show, include a cards block AFTER your text:
<<<CARDS>>>
[
  {"type":"kpi_tile","label":"Revenue (7d)","value":"A$24,500","delta":"+12%","status":"up"},
  {"type":"alert_card","severity":"warning","title":"CAC Spike","description":"CAC increased 25% WoW"}
]
<<<END_CARDS>>>

Available card types:
- kpi_tile: label, value, delta (optional), status (up/down/neutral)
- alert_card: severity (info/warning/critical), title, description
- status_card: agent, last_run, status (healthy/warning/error), summary
- action_result: action, success (boolean), message
- table: headers (string[]), rows (string[][])

Always use tools to get fresh data — never guess. If the user asks you to do something not yet available, say so clearly.`

export async function runCOOChat(
  supabase: SupabaseClient,
  brandId: string,
  conversationId: string,
  userMessage: string,
  onChunk: (chunk: COOStreamChunk) => void,
): Promise<void> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  // 1. Load conversation history
  const { data: historyRows } = await supabase
    .from('coo_messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(HISTORY_LIMIT)

  // 2. Build message array
  type MessageParam = Anthropic.MessageParam
  const messages: MessageParam[] = [
    ...((historyRows ?? [])
      .filter(r => r.role === 'user' || r.role === 'assistant')
      .map(r => ({ role: r.role as 'user' | 'assistant', content: r.content }))),
    { role: 'user', content: userMessage },
  ]

  const tools = getAnthropicTools() as Anthropic.Tool[]
  let fullText = ''
  const allToolCalls: unknown[] = []
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let toolIterations = 0

  // 3. Tool-use streaming loop
  while (true) {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: COO_SYSTEM_PROMPT,
      tools,
      messages,
    })

    // Track current tool_use block being assembled
    let currentToolBlock: { id: string; name: string; inputJson: string } | null = null
    const completedToolBlocks: { id: string; name: string; input: unknown }[] = []

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        const block = event.content_block
        if (block.type === 'tool_use') {
          currentToolBlock = { id: block.id, name: block.name, inputJson: '' }
        }
      } else if (event.type === 'content_block_delta') {
        const delta = event.delta
        if (delta.type === 'text_delta') {
          fullText += delta.text
          onChunk({ type: 'text', content: delta.text })
        } else if (delta.type === 'input_json_delta' && currentToolBlock) {
          currentToolBlock.inputJson += delta.partial_json
        }
      } else if (event.type === 'content_block_stop') {
        if (currentToolBlock) {
          let input: unknown = {}
          try { input = JSON.parse(currentToolBlock.inputJson || '{}') } catch { /* empty input */ }
          completedToolBlocks.push({ id: currentToolBlock.id, name: currentToolBlock.name, input })
          currentToolBlock = null
        }
      }
    }

    const finalMessage = await stream.finalMessage()
    totalInputTokens += finalMessage.usage.input_tokens
    totalOutputTokens += finalMessage.usage.output_tokens

    // Add the complete assistant message to conversation
    messages.push({ role: 'assistant', content: finalMessage.content })

    // Check if we're done
    if (
      finalMessage.stop_reason !== 'tool_use' ||
      completedToolBlocks.length === 0 ||
      toolIterations >= MAX_TOOL_ITERATIONS
    ) {
      break
    }

    // 4. Execute tools and add results
    toolIterations++
    const toolResults: Anthropic.ToolResultBlockParam[] = []

    for (const tool of completedToolBlocks) {
      allToolCalls.push(tool)
      try {
        const result = await executeToolCall(supabase, brandId, tool.name, tool.input as Record<string, unknown>)
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tool.id,
          content: JSON.stringify(result),
        })
      } catch (err) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tool.id,
          content: JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Tool error' }),
          is_error: true,
        })
      }
    }

    messages.push({ role: 'user', content: toolResults })
  }

  // 5. Parse cards from the full response
  const cards = parseCards(fullText)

  // 6. Save messages to DB
  const costUsd = calcCost(totalInputTokens, totalOutputTokens)
  const now = new Date().toISOString()

  await supabase.from('coo_messages').insert([
    { conversation_id: conversationId, role: 'user', content: userMessage },
    {
      conversation_id: conversationId,
      role: 'assistant',
      content: fullText,
      cards: cards.length > 0 ? cards : null,
      tool_calls: allToolCalls.length > 0 ? allToolCalls : null,
      tokens_input: totalInputTokens,
      tokens_output: totalOutputTokens,
      cost_usd: costUsd,
    },
  ])

  // 7. Update conversation last_message_at + auto-title
  const updatePayload: Record<string, unknown> = { last_message_at: now }

  const { data: conv } = await supabase
    .from('coo_conversations')
    .select('title')
    .eq('id', conversationId)
    .single()

  if (!conv?.title) {
    updatePayload.title = userMessage.slice(0, 50).trim() + (userMessage.length > 50 ? '…' : '')
  }

  await supabase.from('coo_conversations').update(updatePayload).eq('id', conversationId)

  // 8. Emit done chunk
  onChunk({
    type: 'done',
    usage: { input: totalInputTokens, output: totalOutputTokens, cost: costUsd },
    cards: cards.length > 0 ? cards : undefined,
  })
}

// Non-streaming variant for Telegram
export async function runCOOChatSync(
  supabase: SupabaseClient,
  brandId: string,
  conversationId: string,
  userMessage: string,
): Promise<{ text: string; cards: COOCard[] }> {
  let fullText = ''
  const cards: COOCard[] = []

  await runCOOChat(supabase, brandId, conversationId, userMessage, (chunk) => {
    if (chunk.type === 'text') fullText += chunk.content ?? ''
    if (chunk.type === 'done' && chunk.cards) cards.push(...chunk.cards)
  })

  return { text: fullText, cards }
}
