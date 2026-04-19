// app/api/kpis/route.ts
// GET /api/kpis?brand_id=X&window=24h|7d|30d|mtd&currency=AUD
//
// If currency is omitted, uses brand_settings.display_currency (or USD fallback).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getKPIs, type WindowKey } from '@/lib/triple-whale/kpis'

export const dynamic = 'force-dynamic'

const VALID_WINDOWS: WindowKey[] = ['24h', '7d', '30d', 'mtd']
const SUPPORTED_CURRENCIES = ['AUD', 'USD', 'GBP', 'EUR']

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
    const requestedCurrency = searchParams.get('currency')?.toUpperCase()

    if (!VALID_WINDOWS.includes(window)) {
      return NextResponse.json(
        { error: `Invalid window. Must be one of: ${VALID_WINDOWS.join(', ')}` },
        { status: 400 }
      )
    }

    if (!brandId) {
      return NextResponse.json({ error: 'brand_id required' }, { status: 400 })
    }

    if (requestedCurrency && !SUPPORTED_CURRENCIES.includes(requestedCurrency)) {
      return NextResponse.json(
        { error: `Unsupported currency. Supported: ${SUPPORTED_CURRENCIES.join(', ')}` },
        { status: 400 }
      )
    }

    const supabase = admin()

    // Resolve display currency: query param > brand default > USD fallback
    let displayCurrency = requestedCurrency
    if (!displayCurrency) {
      const { data: brand } = await supabase
        .from('brand_settings')
        .select('display_currency')
        .eq('brand_id', brandId)
        .maybeSingle()
      displayCurrency = brand?.display_currency ?? 'USD'
    }

    const kpis = await getKPIs(supabase, brandId, window, displayCurrency ?? 'USD')
    return NextResponse.json(kpis)
  } catch (err) {
    console.error('KPI read error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
