## 7. APPROVAL FLOWS

### Content Approval Flow

```
Content Strategy Agent creates content
  │
  ▼
Compliance & Guardrail Agent (synchronous gate)
  │
  ├─ FAIL → returned to Content Strategy with violations
  │         Content Strategy regenerates (max 3 attempts)
  │         After 3 fails → ESCALATE
  │
  ├─ ESCALATE → content_queue (status = 'escalated')
  │             Slack alert to human
  │
  └─ PASS → content_queue (status = 'pending')
            │
            ▼
      Artifact: Content Approval UI
            │
            ├─ REJECT → content_queue (status = 'rejected')
            │           Event logged. Archived.
            │
            ├─ EDIT → inline Claude API call with edit instruction
            │         Re-enters Compliance check
            │
            └─ APPROVE → content_queue (status = 'approved')
                         │
                         ▼
                   Campaign Execution Agent formats for platform
                         │
                         ▼
                   n8n creates DRAFT on target platform
                         │
                         ▼
                   Artifact: Publish Confirmation UI
                         │
                         ├─ CANCEL → content_queue (status = 'rejected')
                         │
                         └─ CONFIRM → n8n publishes/activates
                                      content_queue (status = 'published')
                                      Event logged to Supabase
```

### Financial Approval Flow

```
CFO Agent detects anomaly or suggests action
  │
  ▼
financial_queue (status = 'pending')
  │
  ▼
Artifact: Financial Approval UI
  │
  ├─ REJECT → financial_queue (status = 'rejected')
  │           Event logged.
  │
  ├─ REQUEST DETAIL → COO re-invokes CFO for more analysis
  │
  └─ APPROVE → financial_queue (status = 'approved')
               n8n webhook fired
               n8n executes via Xero API / ad platform API
               financial_queue (status = 'executed')
               Event logged to Supabase
```

### Customer Service Response Flow

```
New Gorgias ticket
  │
  ▼
n8n receives webhook → assembles context → invokes CS Agent
  │
  ▼
CS Agent classifies action class
  │
  ├─ INFORM → CS Agent responds directly via Gorgias (pre-approved FAQ)
  │           Logged to audit_log
  │
  ├─ EXECUTE → Pre-approved action only (order status lookup)
  │            Logged to audit_log
  │
  ├─ DRAFT → Response passes through Compliance Agent
  │          → content_queue (type = 'cs_response', status = 'pending')
  │          → Human approves in Artifact → Gorgias response sent
  │
  ├─ PROPOSE → Resolution proposal
  │            → financial_queue (status = 'pending')
  │            → Human approves → n8n executes refund/resolution
  │
  └─ ESCALATE → Immediate Slack alert + email to alert_email
                Ticket tagged in Gorgias as 'escalated'
                Event logged
```

---

