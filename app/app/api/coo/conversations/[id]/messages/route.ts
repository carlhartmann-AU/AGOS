import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const conversationId = params.id
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10)
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('coo_messages')
    .select('id, conversation_id, role, content, cards, tool_calls, tokens_input, tokens_output, cost_usd, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  return NextResponse.json({ messages: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } })
}
