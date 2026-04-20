# AGOS Compliance Agent — Phase 4.1

## What's in this drop

```
agos-compliance/
├── types/compliance.ts                          # All type definitions
├── lib/agents/compliance/
│   ├── engine.ts                                # Core engine (portable, no framework deps)
│   ├── rules/
│   │   ├── deterministic.ts                     # forbidden_terms, required_text, length_check
│   │   └── llm.ts                               # llm_check, tone_check + cost tracking
│   └── packs/seed.ts                            # Pre-built rule packs
├── app/api/agents/compliance/check/route.ts     # Next.js API adapter
├── migrations/
│   ├── 001_compliance_infrastructure.sql        # Tables + columns + RLS
│   └── 002_plasmaide_initial_config.sql         # Plasmaide brand config
├── scripts/seed-rule-packs.ts                   # Seed rule packs to Supabase
└── __tests__/compliance-deterministic.test.ts   # 11 unit tests — all passing
```

## Install into the AGOS dashboard repo

1. Copy everything except the migrations to matching paths in `carlhartmann-AU/AGOS`
2. Migrations: run `001` then `002` in the Supabase SQL editor
3. Seed rule packs: `npx tsx scripts/seed-rule-packs.ts`
4. Wire up: in `ContentStudio` after insert to `content_queue`, POST to `/api/agents/compliance/check` with `{ content_id }`
5. Approvals UI: read `latest_compliance_check_id` → render `rule_results` as a flag list with severity badges

## Key design decisions (from our discussion)

- **Multi-tenant**: `rule_packs` (shared library) + `custom_rules` (per-brand). Plasmaide enables `health_supplements_au`, `general_marketing`, `brand_voice` plus custom `pine_bark_only` rule.
- **Future-proof**: Engine is a pure function with no Next.js/Supabase coupling. When you move off Vercel, `runCompliance` lifts as-is into a container.
- **Severity/action split**: Brands set `severity_actions: { minor: auto_fix, major: escalate, critical: block }` — rules can override per-rule via `action` field.
- **Per-rule model tier**: Each LLM rule declares `model_tier: fast|accurate|premium`; brand's `llm_config` maps tiers to specific models. Swap Anthropic for any provider later by changing the mapping.
- **Auto-fix for minor, escalate for major**: Plasmaide config does this. Missing TGA disclaimer → auto-appended. Competing ingredient mention → escalated to human review.
- **Explanations included**: Every LLM verdict returns a natural-language reason + suggested fix. Deterministic rules generate mechanical explanations ("Contains forbidden term: 'ashwagandha'").

## Cost expectations

Realistic Plasmaide blog post runs ~5 LLM rules (2 llm_check + 1 tone_check ≈ 3 LLM calls after filtering deterministic rules):
- Haiku tier (`fast`): ~$0.003 per check
- Sonnet tier (`accurate`): ~$0.010 per check

At 5 pieces/day × 365 days = ~$5-18/year per brand. Effectively free.

## What's NOT in this drop (remaining work for Phase 4.1)

- [ ] Settings UI: new "Compliance" tab in dashboard settings (toggle packs, manage custom rules, set severity actions)
- [ ] Approvals UI update: render compliance flags with severity badges + "why flagged" expandable sections
- [ ] Content Studio wiring: call `/api/agents/compliance/check` after insert, show inline warnings
- [ ] Metrics: add compliance check count + cost to dashboard KPIs
- [ ] Event log entries: emit on escalation for the Intelligence Agent to consume later

Next sprint ideas after this lands: Intelligence Agent reads `compliance_checks` table as one of its signals.
