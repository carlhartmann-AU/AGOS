import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateProspectResearch } from '@/lib/agents/b2b/engine'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { brand_id?: string; country?: string; prospect_type?: string; count?: number }
    const brandId = body.brand_id ?? 'plasmaide'
    const supabase = createAdminClient()
    const result = await generateProspectResearch(supabase, brandId, {
      country: body.country,
      prospect_type: body.prospect_type,
      count: body.count,
    })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[b2b/research]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
