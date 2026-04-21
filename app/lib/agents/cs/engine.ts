import type { SupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { broadcastAlert } from '@/lib/agents/coo/telegram'

const MODEL = 'claude-sonnet-4-6'

const PLASMAIDE_CS_CONTEXT = `
Plasmaide sells premium pine bark extract (proanthocyanidins from French maritime pine bark).

Key product facts:
- Dosage: 1-2 capsules daily with food, morning preferred for best absorption
- Certifications: Informed Sport certified, TGA listed, NSF certified
- Benefits supported by research: antioxidant, cardiovascular support, athletic performance, circulation
- Not for: pregnant or breastfeeding (consult GP), children under 16
- Return/refund policy: 30-day money-back guarantee on unopened product
- Shipping: 2-5 business days AU, 7-14 days international
- Contact: support@plasmaide.com

Brand voice: Warm, knowledgeable, athlete-focused. Always use customer's first name.
COMPLIANCE: Never claim the product "treats", "cures", "prevents" or "diagnoses" any condition.
`

const ESCALATION_KEYWORDS = [
  'pregnant', 'breastfeeding', 'nursing', 'medication', 'blood thinner',
  'anticoagulant', 'warfarin', 'legal', 'lawyer', 'sue', 'solicitor',
  'adverse reaction', 'allergic reaction', 'anaphylaxis',
]

export interface CSResponse {
  ticket_id: string
  category: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  escalated: boolean
  escalation_reason?: string
  draft_response?: string
  confidence?: number
}

export async function handleCustomerInquiry(
  supabase: SupabaseClient,
  brandId: string,
  inquiry: {
    customer_name?: string
    customer_email?: string
    subject: string
    message: string
    channel?: string
  },
): Promise<CSResponse> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const { data: ticket } = await supabase
    .from('cs_tickets')
    .insert({
      brand_id: brandId,
      customer_name: inquiry.customer_name,
      customer_email: inquiry.customer_email,
      subject: inquiry.subject,
      message: inquiry.message,
      channel: inquiry.channel ?? 'email',
    })
    .select('id')
    .single()

  const ticketId = ticket?.id ?? 'unknown'
  const fullText = (inquiry.subject + ' ' + inquiry.message).toLowerCase()

  // Check for adverse reactions (physical symptoms)
  const adverseSymptoms = ['dizz', 'nausea', 'sick', 'vomit', 'pain', 'rash',
    'swelling', 'breathing', 'chest', 'heart', 'adverse', 'side effect', 'reaction']
  const isAdverseReaction = adverseSymptoms.some(s => fullText.includes(s))

  // Check escalation keywords
  const triggeredKeyword = ESCALATION_KEYWORDS.find(k => fullText.includes(k))

  if (isAdverseReaction || triggeredKeyword) {
    const reason = isAdverseReaction
      ? 'Potential adverse reaction reported — requires medical review'
      : `Escalation trigger detected: "${triggeredKeyword}"`

    await supabase.from('cs_tickets').update({
      status: 'escalated',
      priority: 'critical',
      category: isAdverseReaction ? 'adverse_reaction' : 'other',
      draft_response: 'ESCALATED — Do not auto-respond. Requires human review by qualified team member.',
      updated_at: new Date().toISOString(),
    }).eq('id', ticketId)

    await supabase.from('intelligence_alerts').insert({
      brand_id: brandId,
      alert_type: 'cs_escalation',
      severity: 'critical',
      title: `CS Escalation: ${inquiry.subject}`,
      description: `${reason} — Customer: ${inquiry.customer_name ?? 'Unknown'}`,
      data: { ticket_id: ticketId, trigger: triggeredKeyword ?? 'adverse_reaction' },
    })

    await broadcastAlert(supabase, brandId, {
      severity: 'critical',
      title: `CS Escalation: ${inquiry.subject.slice(0, 60)}`,
      description: reason,
    })

    return {
      ticket_id: ticketId,
      category: isAdverseReaction ? 'adverse_reaction' : 'other',
      priority: 'critical',
      escalated: true,
      escalation_reason: reason,
    }
  }

  // Classify and draft response
  const prompt = `You are a customer service agent for Plasmaide.

${PLASMAIDE_CS_CONTEXT}

Customer inquiry:
Name: ${inquiry.customer_name ?? 'Customer'}
Subject: ${inquiry.subject}
Message: ${inquiry.message}

1. Classify category: order_status | product_question | returns_refunds | shipping | subscription | wholesale_inquiry | other
2. Classify priority: low | medium | high | urgent
3. Write a warm, helpful draft response (2-4 sentences). Use the customer's first name. No therapeutic claims.
4. Rate confidence 0.0–1.0 that this fully resolves the inquiry without human review.

Return ONLY valid JSON:
{
  "category": "product_question",
  "priority": "medium",
  "draft_response": "Hi Sarah, ...",
  "confidence": 0.92
}`

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
  let result = { category: 'other', priority: 'medium', draft_response: '', confidence: 0.5 }
  try {
    result = { ...result, ...JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim()) }
  } catch { /* keep defaults */ }

  await supabase.from('cs_tickets').update({
    category: result.category,
    priority: result.priority,
    status: 'in_progress',
    draft_response: result.draft_response,
    updated_at: new Date().toISOString(),
  }).eq('id', ticketId)

  return {
    ticket_id: ticketId,
    category: result.category,
    priority: result.priority as 'low' | 'medium' | 'high' | 'critical',
    escalated: false,
    draft_response: result.draft_response,
    confidence: result.confidence,
  }
}

export async function generateTicketResponse(
  supabase: SupabaseClient,
  ticketId: string,
): Promise<{ draft: string; confidence: number }> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const { data: ticket } = await supabase.from('cs_tickets').select('*').eq('id', ticketId).single()
  if (!ticket) return { draft: '', confidence: 0 }

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `${PLASMAIDE_CS_CONTEXT}\n\nGenerate a helpful customer service response for this ticket:\nSubject: ${ticket.subject}\nMessage: ${ticket.message}\n\nReturn JSON: { "draft_response": "...", "confidence": 0.9 }`,
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
  let result = { draft_response: '', confidence: 0.5 }
  try {
    result = { ...result, ...JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim()) }
  } catch { /* keep defaults */ }

  await supabase.from('cs_tickets').update({
    draft_response: result.draft_response,
    updated_at: new Date().toISOString(),
  }).eq('id', ticketId)

  return { draft: result.draft_response, confidence: result.confidence }
}
