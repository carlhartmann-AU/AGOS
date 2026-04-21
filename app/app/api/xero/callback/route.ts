import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  exchangeCodeForTokens,
  getConnectedTenants,
  XERO_SCOPES,
} from '@/lib/integrations/xero/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const redirectBase = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app-tau-black-82.vercel.app'

  if (error) {
    return NextResponse.redirect(`${redirectBase}/settings?tab=integrations&xero=error&reason=${encodeURIComponent(error)}`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${redirectBase}/settings?tab=integrations&xero=error&reason=missing_params`)
  }

  // CSRF: verify state cookie matches
  const storedState = req.cookies.get('xero_oauth_state')?.value
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(`${redirectBase}/settings?tab=integrations&xero=error&reason=state_mismatch`)
  }

  // Parse brand_id from state (format: uuid:brand_id)
  const colonIdx = state.indexOf(':')
  const brand_id = colonIdx !== -1 ? state.slice(colonIdx + 1) : null
  if (!brand_id) {
    return NextResponse.redirect(`${redirectBase}/settings?tab=integrations&xero=error&reason=missing_brand`)
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code)
    const tenants = await getConnectedTenants(tokens.access_token)

    if (!tenants.length) {
      return NextResponse.redirect(`${redirectBase}/settings?tab=integrations&xero=error&reason=no_tenants`)
    }

    const supabase = createAdminClient()
    const now = new Date().toISOString()
    const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

    // Upsert each tenant
    for (const tenant of tenants) {
      await supabase
        .from('xero_connections')
        .upsert({
          brand_id,
          xero_tenant_id: tenant.tenantId,
          xero_tenant_name: tenant.tenantName,
          xero_tenant_type: tenant.tenantType,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: tokenExpiry,
          scopes: XERO_SCOPES.split(' '),
          status: 'connected',
          connected_at: now,
          updated_at: now,
        }, { onConflict: 'brand_id,xero_tenant_id' })
    }

    // Clear state cookie and redirect to settings with success
    const successRes = NextResponse.redirect(`${redirectBase}/settings?tab=integrations&xero=connected`)
    successRes.cookies.set('xero_oauth_state', '', { maxAge: 0, path: '/' })
    return successRes
  } catch (err) {
    console.error('[xero/callback] error:', (err as Error).message)
    return NextResponse.redirect(`${redirectBase}/settings?tab=integrations&xero=error&reason=token_exchange_failed`)
  }
}
