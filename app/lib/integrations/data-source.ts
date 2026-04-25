import { createAdminClient } from '@/lib/supabase/admin'

export interface DataSource {
  integration_slug: string
  config: Record<string, unknown>
}

export interface BrandIntegrationRow {
  integration_slug: string
  status: string
  config: Record<string, unknown>
  data_roles_active: string[]
  connected_at: string | null
}

export interface IntegrationRegistryRow {
  slug: string
  name: string
  description: string | null
  category: string
  icon_code: string | null
  icon_color: string | null
  status: 'live' | 'coming_soon'
  roadmap_eta: string | null
  data_roles: string[]
  auth_type: string | null
}

export interface IntegrationWithStatus extends IntegrationRegistryRow {
  connection: BrandIntegrationRow | null
}

// Returns which integration is active for a given data role for a brand.
// Usage: const src = await getDataSource('plasmaide', 'commerce_data')
// Returns: { integration_slug: 'shopify', config: {...} } | null
export async function getDataSource(
  brandId: string,
  dataRole: string,
): Promise<DataSource | null> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('brand_integrations')
    .select('integration_slug, config')
    .eq('brand_id', brandId)
    .eq('status', 'connected')
    .contains('data_roles_active', [dataRole])
    .limit(1)
    .maybeSingle()

  if (!data) return null

  return {
    integration_slug: data.integration_slug,
    config: (data.config ?? {}) as Record<string, unknown>,
  }
}

// Returns all integrations for a brand, grouped by category, with connection state merged in.
// Used by the Integrations page to render the category grid.
export async function getAllIntegrations(
  brandId: string,
): Promise<Record<string, IntegrationWithStatus[]>> {
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

  const connections = connectionsRes.data ?? []
  const connectionMap = new Map(connections.map(c => [c.integration_slug, c]))

  const grouped: Record<string, IntegrationWithStatus[]> = {}

  for (const reg of registryRes.data ?? []) {
    const raw = connectionMap.get(reg.slug) ?? null
    const item: IntegrationWithStatus = {
      slug: reg.slug,
      name: reg.name,
      description: reg.description,
      category: reg.category,
      icon_code: reg.icon_code,
      icon_color: reg.icon_color,
      status: reg.status as 'live' | 'coming_soon',
      roadmap_eta: reg.roadmap_eta,
      data_roles: reg.data_roles ?? [],
      auth_type: reg.auth_type,
      connection: raw
        ? {
            integration_slug: raw.integration_slug,
            status: raw.status,
            config: (raw.config ?? {}) as Record<string, unknown>,
            data_roles_active: raw.data_roles_active ?? [],
            connected_at: raw.connected_at,
          }
        : null,
    }

    if (!grouped[reg.category]) grouped[reg.category] = []
    grouped[reg.category].push(item)
  }

  return grouped
}
