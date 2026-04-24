import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

function timingSafeEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a)
    const bufB = Buffer.from(b)
    if (bufA.length !== bufB.length) return false
    return crypto.timingSafeEqual(bufA, bufB)
  } catch {
    return false
  }
}

function validateHmac(params: URLSearchParams, secret: string): boolean {
  const hmac = params.get('hmac')
  if (!hmac) return false

  const pairs: string[] = []
  params.forEach((value, key) => {
    if (key === 'hmac' || key === 'signature') return
    pairs.push(`${key}=${value}`)
  })
  pairs.sort()

  const message = pairs.join('&')
  const digest = crypto.createHmac('sha256', secret).update(message).digest('hex')
  return timingSafeEqual(digest, hmac)
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const redirectBase = process.env.NEXT_PUBLIC_APP_URL ?? 'https://dashboard.agos-app.com'
  const errorRedirect = (reason: string) =>
    NextResponse.redirect(`${redirectBase}/settings?tab=integrations&shopify=error&reason=${encodeURIComponent(reason)}`)

  const error = searchParams.get('error')
  if (error) return errorRedirect(error)

  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const shop = searchParams.get('shop')

  if (!code || !state || !shop) return errorRedirect('missing_params')

  const { SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET } = process.env
  if (!SHOPIFY_CLIENT_ID || !SHOPIFY_CLIENT_SECRET) return errorRedirect('not_configured')

  // HMAC validation (required by Shopify)
  if (!validateHmac(searchParams, SHOPIFY_CLIENT_SECRET)) return errorRedirect('hmac_invalid')

  // CSRF: verify state cookie
  const storedState = req.cookies.get('shopify_oauth_state')?.value
  if (!storedState || storedState !== state) return errorRedirect('state_mismatch')

  // Parse brand_id from state (format: uuid:brand_id)
  const colonIdx = state.indexOf(':')
  const brand_id = colonIdx !== -1 ? state.slice(colonIdx + 1) : null
  if (!brand_id) return errorRedirect('missing_brand')

  try {
    // Exchange code for access token
    const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: SHOPIFY_CLIENT_ID, client_secret: SHOPIFY_CLIENT_SECRET, code }),
    })

    if (!tokenRes.ok) return errorRedirect('token_exchange_failed')

    const { access_token, scope } = await tokenRes.json() as { access_token: string; scope: string }

    // Fetch basic shop info
    const shopRes = await fetch(`https://${shop}/admin/api/2026-04/shop.json`, {
      headers: { 'X-Shopify-Access-Token': access_token },
    })
    const shopData = shopRes.ok ? await shopRes.json() as { shop: { id: number; name: string } } : null

    const supabase = createAdminClient()
    const now = new Date().toISOString()

    await supabase.from('shopify_connections').upsert({
      brand_id,
      shop_domain: shop,
      access_token,
      scopes: scope,
      shopify_shop_id: shopData?.shop?.id ? String(shopData.shop.id) : null,
      shop_name: shopData?.shop?.name ?? null,
      connected_at: now,
      sync_status: 'pending',
      updated_at: now,
    }, { onConflict: 'brand_id,shop_domain' })

    const successRes = NextResponse.redirect(`${redirectBase}/settings?tab=integrations&shopify=connected`)
    successRes.cookies.set('shopify_oauth_state', '', { maxAge: 0, path: '/api/integrations/shopify' })
    return successRes
  } catch (err) {
    console.error('[shopify/callback] error:', err)
    return errorRedirect('token_exchange_failed')
  }
}
