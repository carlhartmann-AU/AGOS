# AGOS Regression Tests

Each script here covers a previously-fixed bug. They MUST continue to pass — a failure means the bug has returned.

| Script | Bug |
|---|---|
| shopify_connected_with_empty_token.sh | UI showed Connected when access_token was empty string |
| kpi_window_includes_today.sh | KPI date window was off-by-one and excluded today's data |
| agent_model_id_no_date_suffix.sh | Agent llm_model had invalid date suffix like claude-X-20250415 |
| sync_no_silent_error_swallow.sh | Supabase errors were caught and returned $0 instead of failing |
| sync_no_single_row_upserts.sh | Sync ran row-by-row upserts causing timeouts |
| currency_conversion_endpoint_format.sh | Currency conversion used wrong Frankfurter API URL (bare path, no /v1/) |

Tests that assert on running state query Supabase. Tests that assert on code paths grep the source. The latter run from inside the repo and check that the fix is still present in the relevant file.

## Adding a new regression test

When you fix a bug:
1. Create a file here named `<short_snake_case_description>.sh`
2. Source config.sh with the `../` prefix: `source "$(dirname "$0")/../config.sh"`
3. Add a comment block explaining the original bug, how it manifested, and what the fix was
4. Write one or more assertions that verify the bug is gone
5. Add a row to the table above with the commit hash

## Running

```bash
# Individual
bash tests/regression/currency_conversion_endpoint_format.sh

# All regression tests (via master runner)
bash tests/run-all.sh
```
