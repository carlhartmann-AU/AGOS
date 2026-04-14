## 15. KNOWN ISSUES AND WORKAROUNDS

### TripleWhale API

- **Status:** Broken — persistent 400 errors on all Data Out endpoints
- **Support ticket:** Trace ID `b99527300c65f3b2111765a8eb71e9a5`
- **Workaround:** Stub with Shopify + platform-native analytics (Meta, TikTok, LinkedIn)
- **Action required:** Rotate both TripleWhale API keys (exposed in previous Claude session)
- **Impact:** Performance Analytics Agent operates without TripleWhale data until resolved

### DotDigital Wait Node (n8n)

- **Status:** n8n loses execution context after webhook resume in Wait nodes
- **Root cause:** `$('NodeName').item.json` references, Set nodes, and Code nodes all
  fail to access pre-Wait data after webhook resume
- **Fix:** Store content in Supabase before Wait node, read back after resume.
  Or split into two workflows passing data via webhook payload.
- **Architecture note:** The Supabase-first design in AGOS avoids this issue entirely —
  all data lives in Supabase, n8n references queue IDs not in-memory data.

### WhatsApp HITL (outbound)

- **Status:** Blocked by Meta message template requirement
- **Root cause:** Meta requires pre-approved message templates for outbound WhatsApp.
  Template `content_published` needs creation in Meta Business → WhatsApp → Message Templates.
- **Workaround:** WhatsApp inbound only (user messages COO). Outbound alerts → Slack or Gmail.
- **Phase:** Deferred to Phase 5.

### n8n API Manipulation

- Use `javascript_exec` in browser tab — sandbox cannot reach n8n.cloud due to proxy
- Prefer API-first manipulation: fetch workflow → modify nodes array → PUT full payload
- Always include in PUT: `name`, `nodes`, `connections`, `settings: { executionOrder: 'v1' }`
- When renaming nodes: sync connection references with `JSON.stringify(wf.connections).replace(/OldName/g, 'NewName')`
- PowerShell: use `$body` variable for JSON payloads; use `curl.exe` (not `curl` alias)
- Always do hard refresh (`Cmd+Shift+R`) after saves to confirm state

---

