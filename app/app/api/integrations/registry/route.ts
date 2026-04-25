import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get('brand_id') ?? 'plasmaide'
  const supabase = createAdminClient()

  const [registryRes, connectionsRes] = await Promise.all([
    supabase
      .from('integration_registry')
      .select('slug,name,description,category,icon_code,icon_color,status,roadmap_eta,data_roles,auth_type')
      .order('category')
      .order('name'),
    supabase
      .from('brand_integrations')
      .select('integration_slug,status,config,data_roles_active,connected_at')
      .eq('brand_id', brandId),
  ])

  if (registryRes.error) {
    return NextResponse.json(
      { error: registryRes.error.message },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  return NextResponse.json(
    {
      registry: registryRes.data ?? [],
      connections: connectionsRes.data ?? [],
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
