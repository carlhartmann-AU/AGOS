// Bundled test asset sourced from https://picsum.photos/id/630/1200/800, license Unsplash
// (free to use, no attribution required). Used by this endpoint to verify the upload pipeline.
//
// POST /api/dev/test-shopify-upload
// Dev-only: validates the Shopify Files API pipeline against the live Plasmaide connection.
// Protected by CRON_SECRET bearer token.

import { readFile } from 'fs/promises'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { uploadFile, ShopifyFilesError } from '@/lib/shopify/files-client'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function POST(req: NextRequest) {
  // 1. Bearer check
  const auth = req.headers.get('authorization')
  if (!auth || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })
  }

  // 2. Fetch Plasmaide's shopify_connection
  // TODO Prompt 3: resolve brand_id from content item, not hardcoded
  const supabase = createAdminClient()
  const { data: connection } = await supabase
    .from('shopify_connections')
    .select('shop_domain, access_token, scopes')
    .eq('brand_id', 'plasmaide')
    .neq('sync_status', 'disconnected')
    .neq('access_token', '')
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!connection) {
    return NextResponse.json(
      {
        success: false,
        stage: 'connection_lookup',
        error_code: 'CONNECTION_NOT_FOUND',
        error_message: 'Plasmaide Shopify connection not found',
      },
      { status: 404, headers: NO_STORE },
    )
  }

  const { shop_domain: shopDomain, access_token: accessToken } = connection

  // 3. Live scope pre-flight — DB scopes column is stale; check live access_scopes.json
  let scopeCheckRes: Response
  try {
    scopeCheckRes = await fetch(
      `https://${shopDomain}/admin/oauth/access_scopes.json`,
      { headers: { 'X-Shopify-Access-Token': accessToken } },
    )
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        stage: 'scope_check',
        error_code: 'NETWORK_ERROR',
        error_message: err instanceof Error ? err.message : 'Scope check request failed',
      },
      { status: 502, headers: NO_STORE },
    )
  }

  if (!scopeCheckRes.ok) {
    return NextResponse.json(
      {
        success: false,
        stage: 'scope_check',
        error_code: 'NETWORK_ERROR',
        error_message: `access_scopes.json returned HTTP ${scopeCheckRes.status}`,
      },
      { status: 502, headers: NO_STORE },
    )
  }

  const scopeBody = await scopeCheckRes.json() as { access_scopes?: Array<{ handle: string }> }
  const currentScopes = (scopeBody.access_scopes ?? []).map((s) => s.handle)

  if (!currentScopes.includes('write_files')) {
    return NextResponse.json(
      {
        success: false,
        stage: 'scope_missing',
        error_code: 'SCOPE_MISSING',
        error_message:
          'Reconnect Shopify to grant write_files scope. Visit /settings/integrations and click Reconnect.',
        current_scopes: currentScopes,
      },
      { status: 200, headers: NO_STORE },
    )
  }

  // 4. Read bundled test asset
  const assetPath = path.join(process.cwd(), 'app/lib/shopify/test-asset.jpg')
  const buffer = await readFile(assetPath)

  // 5. Construct timestamped filename
  const timestamp = Date.now()
  const fileName = `agos-test-asset-${timestamp}.jpg`

  // 6. Upload
  try {
    const result = await uploadFile({
      shopDomain,
      accessToken,
      fileName,
      mimeType: 'image/jpeg',
      fileSize: buffer.byteLength,
      body: buffer,
    })
    return NextResponse.json(
      {
        success: true,
        stage: 'ready',
        file_id: result.fileId,
        cdn_url: result.cdnUrl,
        duration_ms: result.durationMs,
        shopify_response: result.finalShopifyResponse,
      },
      { headers: NO_STORE },
    )
  } catch (err) {
    if (err instanceof ShopifyFilesError) {
      return NextResponse.json(
        {
          success: false,
          stage: err.stage,
          error_code: err.errorCode,
          error_message: err.message,
          shopify_response: err.shopifyResponse ?? null,
        },
        { status: 502, headers: NO_STORE },
      )
    }
    return NextResponse.json(
      {
        success: false,
        stage: 'unknown',
        error_code: 'UNKNOWN_ERROR',
        error_message: err instanceof Error ? err.message : String(err),
      },
      { status: 500, headers: NO_STORE },
    )
  }
}
