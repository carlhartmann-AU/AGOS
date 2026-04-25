import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runCFOAnalysis } from '@/lib/agents/cfo/engine'
import { getAgentConfig } from '@/lib/llm/provider'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Get all active brands
  const { data: brands, error } = await supabase
    .from('brands')
    .select('brand_id')
    .eq('status', 'active')

  if (error || !brands?.length) {
    return NextResponse.json({ error: error?.message ?? 'No active brands' }, { status: 500 })
  }

  const today = new Date()
  const fyStart = new Date(today.getFullYear(), 6, 1)
  if (today < fyStart) fyStart.setFullYear(fyStart.getFullYear() - 1)

  const window_start = fyStart.toISOString().slice(0, 10)
  const window_end = today.toISOString().slice(0, 10)

  const results: Array<{ brand_id: string; status: string; report_id?: string; error?: string; reason?: string }> = []

  for (const brand of brands) {
    const agentCfg = await getAgentConfig(brand.brand_id, 'cfo')
    if (!agentCfg.enabled) {
      console.log(`Agent cfo disabled for brand ${brand.brand_id}, skipping cron.`)
      results.push({ brand_id: brand.brand_id, status: 'disabled' })
      continue
    }
    try {
      const report = await runCFOAnalysis(supabase, brand.brand_id, window_start, window_end, 'cron', agentCfg.model)
      results.push({ brand_id: brand.brand_id, status: 'ok', report_id: report.id })
    } catch (err) {
      console.error(`[cfo-weekly] ${brand.brand_id} failed:`, err)
      results.push({ brand_id: brand.brand_id, status: 'error', error: String(err) })
    }
  }

  return NextResponse.json({ ran_at: today.toISOString(), results })
}
