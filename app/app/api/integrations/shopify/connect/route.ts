import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SCOPES = 'read_products,write_products,read_content,write_content,read_orders,read_customers,read_inventory,read_analytics,read_reports'

export async function GET(req: NextRequest) {
  const { SHOPIFY_CLIENT_ID, SHOPIFY_REDIRECT_URI, SHOPIFY_SHOP_DOMAIN } = process.env

  if (!SHOPIFY_CLIENT_ID) {
    return NextResponse.json(
      { error: 'Shopify not configured — add SHOPIFY_CLIENT_ID to environment variables' },
      { status: 503 },
    )
  }

  const brand_id = req.nextUrl.searchParams.get('brand_id')
  if (!brand_id) {
    return NextResponse.json({ error: 'brand_id is required' }, { status: 400 })
  }

  const shop = SHOPIFY_SHOP_DOMAIN ?? 'plasmaide-uk.myshopify.com'
  const state = `${crypto.randomUUID()}:${brand_id}`

  const authUrl = new URL(`https://${shop}/admin/oauth/authorize`)
  authUrl.searchParams.set('client_id', SHOPIFY_CLIENT_ID)
  authUrl.searchParams.set('scope', SCOPES)
  authUrl.searchParams.set('redirect_uri', SHOPIFY_REDIRECT_URI ?? '')
  authUrl.searchParams.set('state', state)

  const res = NextResponse.redirect(authUrl.toString())
  res.cookies.set('shopify_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/api/integrations/shopify',
  })

  return res
}
