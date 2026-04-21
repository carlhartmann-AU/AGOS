import type { SupabaseClient } from '@supabase/supabase-js'

const XERO_AUTH_URL = 'https://login.xero.com/identity/connect/authorize'
const XERO_TOKEN_URL = 'https://identity.xero.com/connect/token'
const XERO_CONNECTIONS_URL = 'https://api.xero.com/connections'

export const XERO_SCOPES = [
  'offline_access',
  'openid',
  'profile',
  'email',
  'accounting.invoices.read',
  'accounting.payments.read',
  'accounting.banktransactions.read',
  'accounting.contacts.read',
  'accounting.settings.read',
  'accounting.reports.read',
  'accounting.budgets.read',
].join(' ')

export interface XeroTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  token_type: string
  scope: string
}

export interface XeroTenant {
  id: string
  authEventId: string
  tenantId: string
  tenantType: string
  tenantName: string
  createdDateUtc: string
  updatedDateUtc: string
}

function basicAuth(): string {
  const clientId = process.env.XERO_CLIENT_ID!
  const clientSecret = process.env.XERO_CLIENT_SECRET!
  return Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
}

export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.XERO_CLIENT_ID!,
    redirect_uri: process.env.XERO_REDIRECT_URI!,
    scope: XERO_SCOPES,
    state,
  })
  return `${XERO_AUTH_URL}?${params.toString()}`
}

export async function exchangeCodeForTokens(code: string): Promise<XeroTokenResponse> {
  const res = await fetch(XERO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.XERO_REDIRECT_URI!,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Xero token exchange failed (${res.status}): ${body}`)
  }
  return res.json()
}

export async function refreshAccessToken(refreshToken: string): Promise<XeroTokenResponse> {
  const res = await fetch(XERO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Xero token refresh failed (${res.status}): ${body}`)
  }
  return res.json()
}

export async function getConnectedTenants(accessToken: string): Promise<XeroTenant[]> {
  const res = await fetch(XERO_CONNECTIONS_URL, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Xero connections fetch failed (${res.status}): ${body}`)
  }
  return res.json()
}

export async function revokeConnection(accessToken: string, connectionId: string): Promise<void> {
  const res = await fetch(`${XERO_CONNECTIONS_URL}/${connectionId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${accessToken}` },
  })
  if (!res.ok && res.status !== 404) {
    throw new Error(`Xero revoke failed (${res.status})`)
  }
}

/**
 * Returns a valid access token for a brand, refreshing if within 2-minute expiry buffer.
 * This is the single entry point for all Xero API calls.
 */
export async function getValidAccessToken(
  supabase: SupabaseClient,
  brandId: string,
): Promise<string> {
  const { data: conn, error } = await supabase
    .from('xero_connections')
    .select('access_token, refresh_token, token_expires_at, xero_tenant_id')
    .eq('brand_id', brandId)
    .eq('status', 'connected')
    .order('connected_at', { ascending: false })
    .limit(1)
    .single()

  if (error || !conn) throw new Error('No active Xero connection for brand')

  const expiresAt = conn.token_expires_at ? new Date(conn.token_expires_at) : null
  const bufferMs = 2 * 60 * 1000
  const needsRefresh = !expiresAt || expiresAt.getTime() - Date.now() < bufferMs

  if (!needsRefresh) return conn.access_token

  // Refresh the token
  if (!conn.refresh_token) throw new Error('No refresh token available')
  const tokens = await refreshAccessToken(conn.refresh_token)

  const newExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString()
  await supabase
    .from('xero_connections')
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expires_at: newExpiry,
      updated_at: new Date().toISOString(),
    })
    .eq('brand_id', brandId)
    .eq('xero_tenant_id', conn.xero_tenant_id)

  return tokens.access_token
}
