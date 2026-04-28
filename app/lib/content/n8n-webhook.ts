// lib/content/n8n-webhook.ts
// Server-side only. Fires the n8n publish webhook without exposing the URL to the browser.
// Called by queue-approver.ts for publish_pending and go_live transitions.
// N8N delivery is best-effort; reconciliation is out of scope (flagged as follow-up).

export async function fireN8nPublishWebhook(input: {
  content_id: string
  brand_id: string
  platform: string | null
}): Promise<void> {
  const webhookUrl = process.env.N8N_PUBLISH_WEBHOOK_URL
  if (!webhookUrl) {
    console.error('[n8n-webhook] N8N_PUBLISH_WEBHOOK_URL is not set — skipping publish webhook')
    return
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_queue_id: input.content_id,
        brand_id: input.brand_id,
        platform: input.platform,
      }),
    })
    if (!res.ok) {
      console.error(`[n8n-webhook] Webhook responded ${res.status} for content_id=${input.content_id}`)
    }
  } catch (err) {
    console.error('[n8n-webhook] Webhook delivery failed:', err)
  }
}
