import { NextRequest, NextResponse } from 'next/server'
import { getAuthorizationUrl } from '@/lib/integrations/xero/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!process.env.XERO_CLIENT_ID) {
    return NextResponse.json({ error: 'Xero not configured — add XERO_CLIENT_ID to environment variables' }, { status: 503 })
  }

  const brand_id = req.nextUrl.searchParams.get('brand_id')
  if (!brand_id) {
    return NextResponse.json({ error: 'brand_id is required' }, { status: 400 })
  }

  // Option B: encode brand_id in state — stateless, no extra cookies
  const uuid = crypto.randomUUID()
  const state = `${uuid}:${brand_id}`

  const res = NextResponse.redirect(getAuthorizationUrl(state))

  // Also store state in cookie for CSRF verification (10 min, httpOnly)
  res.cookies.set('xero_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  return res
}
