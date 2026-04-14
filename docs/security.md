## 10. SECURITY MODEL

### Credential management

| Storage | What goes here |
|---------|---------------|
| n8n credential store | ALL API keys, tokens, OAuth credentials, service accounts |
| `.env.local` (Vercel) | Supabase URL, anon key, service role key |
| Google Sheets | Non-sensitive config values ONLY |
| Supabase | No credentials stored. Service role key used by n8n only. |
| Git repo | NO secrets. `.env.local` in `.gitignore` |

### MCP permissions matrix (least privilege)

| Agent | MCP Access | Scope |
|-------|-----------|-------|
| COO | Xero, Sheets, Slack, Gmail, n8n | Xero: **read only**. Gmail: Phase 4+. |
| Intelligence | Shopify, web search | Read only. Klaviyo read via n8n. |
| Content Strategy | Shopify, web search | Read only (product context). |
| Compliance | **None** | Pure reasoning. No external access. |
| Campaign Execution | Shopify, Klaviyo | Shopify: write pages/blogs. Klaviyo: Folle only. |
| CFO | Xero, Shopify, Sheets | Xero: read + write **with approval gate**. Shopify: read. |
| Web Designer | Shopify | Write **drafts only**. Theme changes flagged for dev review. |
| B2B Outreach | Gmail, Sheets, web search | Gmail: **draft only, never send**. |
| Review Harvester | Gorgias, Shopify, web search | **Read only**. |
| CS Agent | Gorgias, Shopify | Gorgias: read + write. Shopify: read. |
| Customer Intelligence | Shopify | Read only. Receives pre-aggregated data. |
| Performance Analytics | Shopify | Read only. |

### Sensitive action gates

These **always** require human approval before execution, regardless of agent confidence:

- Any Xero write operation (journal, invoice, payment)
- Campaign launch (activate from draft)
- Store page/product publish (draft → live)
- Refund processing (any amount)
- Any B2B outreach email send
- Adverse reaction escalation response
- Customer-facing content publish (any channel)
- Budget reallocation
- Theme/Liquid code deployment

### Data privacy rules

- Claude API **never** receives individual customer PII in prompts
- Customer Intelligence receives aggregated segment data only (n8n pre-aggregates)
- All Gorgias conversations logged to `audit_log` (summaries, not full transcripts)
- GDPR / AU Privacy Act: customer data is brand-scoped, never cross-brand
- Customer deletion requests: process via Gorgias → Shopify → purge from `customer_identity`
- No customer data stored in Google Sheets

---

