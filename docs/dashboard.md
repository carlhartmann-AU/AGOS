## 13. DASHBOARD SPEC (Vercel App)

### Tech stack

- **Next.js 14** (App Router) + React + Tailwind CSS
- **Supabase JS client** (real-time subscriptions for queues and events)
- **Supabase Auth** (email/password + Google OAuth)
- **Hosted on Vercel** (auto-deploy from `main` branch)
- **Domain:** `dashboard.plasmaide.com` (single multi-brand dashboard with brand selector)

### Authentication & authorisation

- Users log in via Supabase Auth
- `user_metadata.brand_ids` controls which brands a user can see
- RLS policies enforce brand isolation at the database level
- Carl and Steve: access to all brands
- Future: role-based access (admin, approver, viewer)

### Navigation structure

```
[Brand Selector Dropdown]  ← switches all data/context
├── 🏠 Dashboard
│   ├── KPI cards: ROAS, CAC, revenue, spend (live from Supabase)
│   ├── Active campaigns (list)
│   ├── Content queue depth (count by status)
│   └── Active alerts (from Alert Log)
├── 📋 Approval Queues
│   ├── Content Approvals (content_queue WHERE status = 'pending')
│   └── Financial Approvals (financial_queue WHERE status = 'pending')
├── 📊 Performance
│   ├── Campaign metrics (from events)
│   ├── Email metrics (from events)
│   ├── CS metrics (ticket volume, resolution time, CSAT)
│   └── Agent health (from audit_log)
├── 🎙️ COO Interface
│   ├── Text input (sends to COO Agent via webhook)
│   └── Voice (ElevenLabs — Phase 5)
└── ⚙️ Settings
    ├── Brand profile (name, logo, industry)
    ├── Integrations (connection status + masked credentials)
    ├── Alert thresholds (min_roas, max_cac, etc.)
    ├── Reporting schedule (day, time, timezone)
    ├── Content guardrails (compliance rules text)
    ├── Brand voice (upload examples → embedded to agent_memory)
    └── COO channel preferences (Slack + Artifact for Phase 1)
```

### Content Approval UI (per item)

```
┌──────────────────────────────────────────────────┐
│ [Content type badge]  [Audience badge]           │
│ [Platform destination]                           │
│                                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │ Preview (rendered as it will appear)         │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ Compliance: ✅ PASS (or details of violations)   │
│                                                  │
│ [✅ Approve]  [✏️ Edit]  [❌ Reject]             │
│                                                  │
│ On Approve:                                      │
│ ┌──────────────────────────────────────────────┐ │
│ │ Confirm publish to [platform] on [date]?     │ │
│ │ [Confirm] [Cancel]                           │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

Edit flow: clicking Edit opens inline editor → on save, content is re-sent through
Compliance Agent → if PASS, returns to approval queue with `edited: true` flag.

### Financial Approval UI (per item)

```
┌──────────────────────────────────────────────────┐
│ [Action type]  [Amount: $X AUD]                  │
│                                                  │
│ Rationale: [CFO Agent's analysis]                │
│ Current state: [e.g., current budget allocation] │
│ Proposed state: [e.g., new allocation]           │
│ Risk assessment: [from CFO Agent]                │
│                                                  │
│ [✅ Approve]  [❌ Reject]  [🔍 Request Detail]   │
└──────────────────────────────────────────────────┘
```

### Settings — Security rules

- API keys displayed as masked (last 4 chars only) in dashboard
- Keys written to n8n credential store via n8n API on save
- Never stored in Supabase or readable from dashboard after save
- `[Test Connection]` button validates credential before saving
- Connection status indicators: 🟢 Connected | 🔴 Error | ⚪ Not configured

---

