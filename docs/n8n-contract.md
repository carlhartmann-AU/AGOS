## 8. n8n EXECUTION CONTRACT

### Core rule

Agents output structured JSON. n8n receives via webhook and executes.
n8n **never** reasons. n8n **never** decides. n8n retries on failure.

### Standard payload structure (agent → n8n)

```json
{
  "action": "string (verb_noun format: publish_content, send_email, create_draft, etc.)",
  "brand_id": "string",
  "platform": "string (dotdigital | klaviyo | shopify_blog | shopify_page | meta_ig | meta_fb | tiktok | linkedin | gorgias | xero)",
  "priority": "normal | urgent",
  "payload": {
    "// platform-specific data"
  },
  "source_queue_id": "uuid (content_queue or financial_queue ID for status updates)",
  "source_queue_table": "content_queue | financial_queue",
  "callback_webhook": "https://[supabase-url]/rest/v1/events",
  "retry_config": {
    "max_attempts": 3,
    "backoff_seconds": 30
  }
}
```

### Standard callback structure (n8n → Supabase)

On completion (success or final failure), n8n POSTs to Supabase:
```json
{
  "brand_id": "string",
  "event_type": "content_published | content_failed | campaign_sent | financial_executed | ...",
  "source": "n8n",
  "payload": {
    "action": "original action",
    "platform": "original platform",
    "status": "success | failure",
    "error": "string (if failure)",
    "platform_response": {},
    "source_queue_id": "uuid",
    "source_queue_table": "string"
  }
}
```

n8n also updates the source queue record status (e.g., `content_queue.status = 'published'`
or `'failed'`).

### `publish_pending` semantics

**`publish_pending` means "create a draft on the platform, not send."**

When the dashboard sets a content_queue item to `publish_pending` and fires the
`plasmaide-content-publish` webhook, n8n creates an **unsent draft campaign** in
DotDigital (or equivalent draft on other platforms). It does not trigger a send.

**Manual send required (DotDigital):** Until the send-confirmation step is built
(Phase 3+), campaigns must be manually sent inside the DotDigital UI after the
draft is created. The `dd_campaign_id` returned by DotDigital is stored in the
`content_published` event payload so the draft can be located.

**Status flow:**
```
approved → publish_pending → published (draft created on platform)
```
A future `send_pending` status and corresponding n8n workflow will handle the
send trigger once send-confirmation is implemented.

### DotDigital campaign creation payload (`plasmaide-content-publish-v1`)

Posted to `https://r3-api.dotdigital.com/v2/campaigns`:

```json
{
  "name": "{brand_id} — {subject} — {queue_id_prefix}",
  "subject": "string",
  "fromName": "string (from n8n variable DD_FROM_NAME)",
  "fromAddress": { "id": "number (from n8n variable DD_FROM_ADDRESS_ID)" },
  "htmlContent": "string (body_html from content_queue)",
  "plainTextContent": "string (body_plain from content_queue)",
  "templateId": "number — OPTIONAL"
}
```

**`templateId` / `dd_template_id`:** If `content.template_id` exists on the
content_queue item, it is passed as `templateId` and DotDigital applies that
template's layout around the HTML. If absent, DotDigital creates a basic
freeform HTML campaign. This field is never required — omitting it is valid.

### n8n workflow naming convention

`[brand_id]-[function]-[version]`

Examples:
- `plasmaide-email-publish-v1`
- `plasmaide-social-publish-v1`
- `plasmaide-cs-ticket-handler-v1`
- `plasmaide-coo-weekly-report-v1`
- `global-threshold-poller-v1` (brand-agnostic scheduler)

### n8n responsibilities (exhaustive list)

| Responsibility | Details |
|---------------|---------|
| DotDigital API calls | Plasmaide email send/schedule |
| Meta Graph API | Instagram + Facebook posting |
| TikTok API | TikTok posting |
| LinkedIn API | LinkedIn posting |
| Cron scheduling | Reads Config sheet for schedule, fires agent invocations |
| Threshold polling | Reads Config sheet for thresholds, checks Shopify/Xero, fires COO if breach |
| Error handling | Retry with backoff per retry_config |
| Status callbacks | POST to Supabase events + update queue statuses |
| Gorgias webhook receiver | Routes new tickets to CS Agent invocation |
| WhatsApp inbound | Routes inbound messages to COO Agent (Phase 5) |
| Ad spend aggregation | Polls Meta/TikTok/LinkedIn for spend data, writes to Supabase for CFO |
| PII aggregation | Pre-aggregates customer data into segments before Intelligence invocation |

### n8n does NOT

- Make decisions about content, routing, or priority
- Store business logic or branching conditions beyond "if platform = X, use X node"
- Hold state between executions (stateless — all context from payload)
- Access Claude API directly for reasoning (only for agent invocation with full payload)

---

