/**
 * Supabase admin client — uses the service role key, bypasses RLS.
 *
 * Use ONLY in server-side API routes called by trusted systems (n8n, internal crons).
 * Never expose this client to the browser.
 * Never use this for user-facing data access — use the cookie-based server client instead.
 */
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase admin credentials: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(url, key, {
    auth: {
      // Service role — no session management needed
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
