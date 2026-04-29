// PATCH /api/content/[id]/hero-image
// Re-upload hero image from the approval surface.
// Uses admin client for DB writes — consistent with sibling content_queue update routes.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { uploadFile, ShopifyFilesError } from '@/lib/shopify/files-client'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_SIZE = 5 * 1024 * 1024
const ALLOWED_MIME = ['image/jpeg', 'image/png']
const NO_STORE = { 'Cache-Control': 'no-store' }

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })
  }

  const contentId = params.id
  if (!contentId) {
    return NextResponse.json({ error: 'Missing content id' }, { status: 400, headers: NO_STORE })
  }

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles')
    .select('brand_id')
    .eq('id', user.id)
    .single()

  if (!profile?.brand_id) {
    return NextResponse.json(
      { error: 'No brand associated with this user' },
      { status: 403, headers: NO_STORE },
    )
  }
  const brand_id = profile.brand_id as string

  // Verify the content row exists and belongs to this brand
  const { data: contentRow, error: contentErr } = await admin
    .from('content_queue')
    .select('id, brand_id, content_type')
    .eq('id', contentId)
    .eq('brand_id', brand_id)
    .single()

  if (contentErr || !contentRow) {
    return NextResponse.json({ error: 'Content item not found' }, { status: 404, headers: NO_STORE })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart body' }, { status: 400, headers: NO_STORE })
  }

  const file = formData.get('hero_image') as File | null
  if (!file || file.size === 0) {
    return NextResponse.json(
      { ok: false, error_code: 'MISSING_FILE', error_message: 'hero_image file required' },
      { status: 400, headers: NO_STORE },
    )
  }

  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json(
      { ok: false, error_code: 'INVALID_IMAGE', error_message: `Must be JPEG or PNG, got ${file.type}` },
      { status: 400, headers: NO_STORE },
    )
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { ok: false, error_code: 'INVALID_IMAGE', error_message: 'File must be ≤ 5MB' },
      { status: 400, headers: NO_STORE },
    )
  }

  const { data: conn, error: connErr } = await admin
    .from('shopify_connections')
    .select('shop_domain, access_token')
    .eq('brand_id', brand_id)
    .neq('sync_status', 'disconnected')
    .neq('access_token', '')
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (connErr || !conn) {
    return NextResponse.json(
      { ok: false, error_code: 'NO_SHOPIFY_CONNECTION', error_message: 'No active Shopify connection' },
      { status: 502, headers: NO_STORE },
    )
  }

  const ext = file.type === 'image/png' ? 'png' : 'jpg'
  const fileName = `agos-hero-${Date.now()}.${ext}`
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  let cdnUrl: string
  let fileId: string
  try {
    const result = await uploadFile({
      shopDomain: conn.shop_domain,
      accessToken: conn.access_token,
      fileName,
      mimeType: file.type,
      fileSize: buffer.byteLength,
      body: buffer,
    })
    cdnUrl = result.cdnUrl
    fileId = result.fileId
  } catch (err) {
    const stage = err instanceof ShopifyFilesError ? err.stage : 'unknown'
    const errorCode = err instanceof ShopifyFilesError ? err.errorCode : 'UNKNOWN_ERROR'
    const message = err instanceof Error ? err.message : String(err)
    console.error('[hero-image/patch] upload failed:', { brand_id, contentId, stage, errorCode, message })
    return NextResponse.json(
      { ok: false, error_code: errorCode, error_message: message },
      { status: 502, headers: NO_STORE },
    )
  }

  const { data: updatedRows, error: updateErr } = await admin
    .from('content_queue')
    .update({
      hero_image_url: cdnUrl,
      hero_image_status: 'uploaded',
      hero_image_file_id: fileId,
    })
    .eq('id', contentId)
    .eq('brand_id', brand_id)
    .select('id')

  if (updateErr) {
    console.error('[hero-image/patch] DB update failed:', updateErr)
    return NextResponse.json(
      { error: 'DB update failed', detail: updateErr.message },
      { status: 500, headers: NO_STORE },
    )
  }

  if (!updatedRows || updatedRows.length === 0) {
    return NextResponse.json(
      { error: 'No rows updated — possible race condition' },
      { status: 409, headers: NO_STORE },
    )
  }

  return NextResponse.json(
    { ok: true, hero_image: { cdn_url: cdnUrl, file_id: fileId, status: 'uploaded' } },
    { headers: NO_STORE },
  )
}
