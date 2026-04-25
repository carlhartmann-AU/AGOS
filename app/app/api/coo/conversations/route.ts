import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get('brand_id') ?? 'plasmaide'
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10)
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('coo_conversations')
    .select('id, brand_id, channel, title, created_at, last_message_at')
    .eq('brand_id', brandId)
    .eq('channel', 'web')
    .order('last_message_at', { ascending: false })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  return NextResponse.json({ conversations: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { brand_id = 'plasmaide', channel = 'web', title } = body
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('coo_conversations')
    .insert({ brand_id, channel, title: title ?? null })
    .select('id, brand_id, channel, title, created_at, last_message_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  return NextResponse.json({ conversation: data }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { conversation_id } = body
  if (!conversation_id) return NextResponse.json({ error: 'conversation_id required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })

  const supabase = createAdminClient()
  const { error } = await supabase.from('coo_conversations').delete().eq('id', conversation_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
}
