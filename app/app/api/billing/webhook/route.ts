import { NextRequest, NextResponse } from 'next/server'
import { handleWebhookEvent } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  const sig = request.headers.get('stripe-signature') ?? ''
  const payload = await request.text()

  try {
    await handleWebhookEvent(payload, sig)
    return NextResponse.json({ received: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
