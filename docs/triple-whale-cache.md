# AGOS Triple Whale Cache Layer

Fixes slow dashboard loads by adding a cache-first read path + cron-driven sync.

## File structure

```
agos-tw-cache/
├── migrations/
│   └── 003_tw_cache_infrastructure.sql        # Schema: tw_daily_summary cols, tw_sync_log, RLS, view
├── lib/triple-whale/
│   ├── client.ts                              # Triple Whale API wrapper
│   ├── sync.ts                                # syncTripleWhale() — reused by cron/manual/backfill
│   └── kpis.ts                                # Window resolver + getKPIs() cache read
├── app/api/
│   ├── kpis/route.ts                          # GET /api/kpis?window=24h|7d|30d|mtd (fast cache read)
│   ├── triple-whale/sync/route.ts             # POST sync endpoint (manual refresh + backfill)
│   └── cron/triple-whale-daily/route.ts       # Vercel cron target
├── components/dashboard/KPIDashboard.tsx      # Window toggle, freshness pill, KPI tiles
├── vercel.json.example                        # Cron schedule
└── __tests__/tw-window-resolver.test.ts       # 7 tests — all passing
```

## Install steps

1. **Run migration**: paste `migrations/003_tw_cache_infrastructure.sql` into Supabase SQL editor. Additive — won't break existing data.
2. **Copy files** into matching paths in `carlhartmann-AU/AGOS`.
3. **Set env var**: add `CRON_SECRET` to Vercel (generate with `openssl rand -hex 32`). Vercel cron auto-passes this as `Authorization: Bearer <secret>`.
4. **Update vercel.json**: merge `vercel.json.example` crons array into your existing `vercel.json`.
5. **Replace dashboard KPI section**: swap the old "fetches Triple Whale on every load" component for `<KPIDashboard brandId={brand.id} />`.
6. **Deploy** (remember: `rm -rf .next` first — it's in the handover notes).
7. **Backfill** (optional, one-time): `curl -X POST /api/triple-whale/sync -H 'Content-Type: application/json' -d '{"brand_id":"<uuid>","days":30,"triggered_by":"backfill"}'`

## How it works

**Read path (every page load):**
```
User → /api/kpis?window=7d → Supabase SELECT from tw_daily_summary → 50ms response
```
Zero Triple Whale calls on page load. Sub-second.

**Write path (cron, manual, backfill — all same function):**
```
Trigger → syncTripleWhale() → TW API (3 concurrent) → upsert tw_daily_summary → log to tw_sync_log
```

**Window toggle:**
- Changing 24h → 7d → 30d → MTD re-queries the cache with a new date range
- No Triple Whale calls triggered by window changes

## Freshness UX (as agreed)

- Pill: "Last updated 3h ago" (neutral), "Syncing…" (blue, spinner), "Data is stale" (amber, when > 48h)
- Refresh button with spinning icon when sync is running
- Stale banner if cache > 48h old (signals silent cron failure)
- Partial cache banner if window has fewer days than expected (e.g. selected 30d, only 5 days cached)

## Key design decisions

- **Daily rows, aggregate on read**: adding new windows later (YTD, QTD, custom ranges) = zero migrations
- **Sync is one function**: cron, manual, backfill all use `syncTripleWhale()` — one place to fix bugs
- **Concurrency cap at 3**: Triple Whale rate limits unclear; 3 parallel calls is safe, still 3x faster than sequential
- **Cron hits its own wrapper**: `/api/cron/triple-whale-daily` iterates all brands so future multi-brand onboarding (Folle) just works
- **Currency hardcoded GBP for now**: pulls from `brand_settings` in a future pass — flagged as TODO in `KPIDashboard.tsx`

## Backlog items (parked, per your direction)

- [ ] Higher-frequency sync (hourly, 15-min) when a client asks
- [ ] Sparkline charts using the `daily` array already returned by `/api/kpis`
- [ ] Currency-aware formatting from `brand_settings`
- [ ] Brand-level TTL config (some brands may want different staleness thresholds)
- [ ] Cron failure alerting (email/Slack when sync status = failed for >2 days)
