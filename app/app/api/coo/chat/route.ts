import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runCOOChat } from '@/lib/agents/coo/engine'
import type { COOStreamChunk } from '@/lib/agents/coo/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      brand_id?: string
      conversation_id?: string
      message?: string
    }

    const brandId = body.brand_id ?? 'plasmaide'
    const message = body.message?.trim()

    if (!message) {
      return new Response(JSON.stringify({ error: 'message is required' }), { status: 400 })
    }

    const supabase = createAdminClient()

    // Create or load conversation
    let conversationId = body.conversation_id
    if (!conversationId) {
      const { data: conv, error } = await supabase
        .from('coo_conversations')
        .insert({ brand_id: brandId, channel: 'web' })
        .select('id')
        .single()
      if (error || !conv) {
        return new Response(JSON.stringify({ error: 'Failed to create conversation' }), { status: 500 })
      }
      conversationId = conv.id
    }

    // Stream NDJSON response
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const encoder = new TextEncoder()

    const writeChunk = (chunk: COOStreamChunk) => {
      writer.write(encoder.encode(JSON.stringify(chunk) + '\n'))
    }

    // First chunk: conversation ID (needed if newly created)
    writeChunk({ type: 'text', content: '' })

    // Run engine in background
    ;(async () => {
      try {
        // Send conversation_id as first metadata chunk
        writer.write(encoder.encode(JSON.stringify({ type: 'meta', conversation_id: conversationId }) + '\n'))

        await runCOOChat(supabase, brandId, conversationId!, message, writeChunk)
      } catch (err) {
        writeChunk({
          type: 'error',
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      } finally {
        writer.close()
      }
    })()

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('[coo/chat] error:', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 })
  }
}
