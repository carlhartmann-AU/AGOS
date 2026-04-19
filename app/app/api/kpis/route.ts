// app/api/kpis/route.ts
// GET /api/kpis?window=24h|7d|30d|mtd
//
// Fast cache read. No Triple Whale calls. Returns in ~50ms.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getKPIs, type WindowKey } from '@/lib/triple-whale/kpis'

export const dynamic = 'force-dynamic'

const VALID_WINDOWS: WindowKey[] = ['24h', '7d', '30d', 'mtd']

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const window = (searchParams.get('window') ?? '24h') as WindowKey
    const brandId = searchParams.get('brand_id')

    if (!VALID_WINDOWS.includes(window)) {
      return NextResponse.json(
        { error: `Invalid window. Must be one of: ${VALID_WINDOWS.join(', ')}` },
        { status: 400 }
      )
    }

    if (!brandId) {
      return NextResponse.json({ error: 'brand_id required' }, { status: 400 })
    }

    const supabase = admin()
    const kpis = await getKPIs(supabase, brandId, window)

    return NextResponse.json(kpis)
  } catch (err) {
    console.error('KPI read error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
