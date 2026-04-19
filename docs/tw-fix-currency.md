# AGOS Triple Whale Fix + Currency Conversion

Two problems solved in one drop:

1. **TW client was using wrong payloads** — aligned with the working spec from the OpenClaw handover note
2. **Currency conversion** — AUD/USD/GBP/EUR toggle at top of dashboard, historically-correct FX via Frankfurter

## File structure

```
agos-tw-fix/
├── migrations/
│   └── 004_fx_rates.sql                       # Adds source_currency + fx_rates cols + display_currency
├── lib/triple-whale/
│   ├── client.ts                              # REWRITTEN — matches working TW spec exactly
│   ├── fx.ts                                  # NEW — Frankfurter FX client (free, no key)
│   ├── sync.ts                                # UPDATED — fetches FX alongside TW metrics
│   └── kpis.ts                                # UPDATED — converts at read time using per-day FX rate
├── app/api/kpis/route.ts                      # UPDATED — accepts ?currency=AUD, falls back to brand default
├── components/dashboard/KPIDashboard.tsx      # UPDATED — currency toggle, localStorage persistence
└── __tests__/tw-currency-and-extraction.test.ts  # 15 tests — all passing
```

## Install steps

### 1. Place files in working/ and run Claude Code
Copy these into the AGOS repo's `working/` folder. Use the same Claude Code 
install prompt pattern as before — move each file to its intended path.

### 2. Run migration 004 in Supabase SQL editor
```
[Contents of migrations/004_fx_rates.sql]
```

Additive only. Adds:
- `tw_daily_summary.source_currency` (TEXT, default 'GBP')
- `tw_daily_summary.fx_rates` (JSONB)
- `brand_settings.display_currency` (TEXT, default 'USD')
- Sets Plasmaide's display_currency to 'AUD'

### 3. Re-run the backfill
```powershell
Invoke-RestMethod -Uri "https://app-tau-black-82.vercel.app/api/triple-whale/sync" `
  -Method POST -ContentType "application/json" `
  -Body '{"brand_id":"plasmaide","days":30,"triggered_by":"backfill"}'
```

Expected: `days_synced: 30`, `status: "success"`. Will take 30-60 seconds 
(30 TW calls + 1 FX call = ~30 total external requests, capped at 3 concurrent).

### 4. Verify data landed
```sql
SELECT 
  date, revenue, orders, source_currency, 
  fx_rates->>'AUD' as aud_rate, 
  fx_rates->>'USD' as usd_rate
FROM public.tw_daily_summary
WHERE brand_id = 'plasmaide'
ORDER BY date DESC LIMIT 5;
```

Should show real GBP revenue values with AUD/USD/EUR rates attached.

### 5. Test the dashboard
- Load `app-tau-black-82.vercel.app`
- Should default to AUD (brand default)
- Toggle between AUD/USD/GBP/EUR — revenue should convert instantly (no reload)
- Choice persists to localStorage, so next load remembers pick
- Toggle between 24h/7d/30d/MTD — should work as before

## Key design decisions

**Historical integrity** — each day's revenue is converted using that day's FX 
rate, not today's. A sale on April 1 stays valued at April 1's GBP→AUD rate 
even if you view the dashboard in June.

**One FX call per sync day** — Frankfurter is called once per unique 
(source_currency, date) combo, not per TW call. 30 days of backfill = 30 
Frankfurter calls max (usually fewer since weekends share rates).

**FX failure is non-fatal** — if Frankfurter is down, the row still gets 
stored with empty `fx_rates`. Dashboard shows source currency as fallback. 
Error logged to `tw_sync_log.errors` for visibility.

**LocalStorage for user preference** — currency choice persists per-browser. 
Brand default is only used on first visit. Logging in from a different device 
starts fresh at brand default.

## Changes from my previous (broken) TW client

| Field | Before (wrong) | Now (correct) |
|---|---|---|
| Summary Page period | `{ startDate, endDate }` | `{ start, end }` |
| todayHour | `new Date().getUTCHours()` | 1-25 base-1; defaults to 25 |
| Revenue extraction | `data.revenue` | `metrics.find(id='sales').values.current` |
| Orders extraction | `data.orders` | `metrics.find(id='orders').values.current` |
| Moby body key | `shopDomain` | `shopId` |
| Moby question | Per-date narrative | Fixed prompt |
| Moby error check | HTTP status | `responses[0].isError` |
| Moby AOV extraction | `data.aov` | `responses[0].answer.aov[0]` |

## Known issues / backlog

- **Frankfurter doesn't publish weekend rates** — weekend sales use Friday's 
  rate (correct behaviour per ECB, but worth knowing)
- **ROAS/Ad Spend still blocked** — separate issue, waiting on ad accounts 
  being connected in TW
- **Attribution data not yet in sync** — working endpoint exists per handover 
  note, but not wired into this sync. Future enhancement.
- **Frankfurter rate limit** — no published cap, but shared infrastructure. 
  If abuse becomes an issue, consider self-hosting via Docker.
