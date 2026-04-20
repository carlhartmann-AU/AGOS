import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ─── Types ────────────────────────────────────────────────────────────────────

type ContentStatusRow = { status: string; count: string }

type QueueRow = {
  id: string
  content_type: string
  status: string
  created_at: string
  title: string | null
  compliance_status: string | null
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brandId = request.nextUrl.searchParams.get('brand_id') ?? 'plasmaide'
  const admin = createAdminClient()

  // ── Content metrics ───────────────────────────────────────────────────────

  const [statusRows, recentRows] = await Promise.all([
    admin.rpc('content_status_counts', { p_brand_id: brandId }).then(async ({ data, error }) => {
      // Fallback if RPC not deployed: manual group-by
      if (error) {
        const { data: rows } = await admin
          .from('content_queue')
          .select('status')
          .eq('brand_id', brandId)
        const counts: Record<string, number> = {}
        for (const r of rows ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1
        return Object.entries(counts).map(([status, count]) => ({ status, count: String(count) }))
      }
      return (data as ContentStatusRow[]) ?? []
    }),

    admin
      .from('content_queue')
      .select('id, content_type, status, created_at, content, compliance_status')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  // Parse content counts
  const counts: Record<string, number> = {}
  for (const r of statusRows as ContentStatusRow[]) counts[r.status] = Number(r.count)
  const total = Object.values(counts).reduce((s, n) => s + n, 0)
  const pending = counts['pending'] ?? 0
  const published = counts['published'] ?? 0
  const approvedAndPub = (counts['approved'] ?? 0) + published
  const approvalRate = total > 0 ? Math.round((approvedAndPub / total) * 100) : 0

  const recentItems = (recentRows.data ?? []).map((r) => {
    const c = r.content as Record<string, unknown>
    return {
      id: r.id,
      content_type: r.content_type,
      status: r.status,
      created_at: r.created_at,
      title: (c?.title ?? c?.subject ?? c?.caption ?? null) as string | null,
      compliance_status: (r.compliance_status as string | null) ?? null,
    } as QueueRow
  })

  const contentMetrics = { total, pending, published, approvalRate }

  return NextResponse.json({
    content: contentMetrics,
    recent: recentItems,
  })
}
