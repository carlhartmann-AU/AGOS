// lib/config/brand-content-config.ts
// Resolver service for per-brand-per-content-type platform configuration.
// Phase 1 — service exists but is not yet called from production code paths.
// Phase 2+ will wire consumers (generate/route.ts, queue-approver.ts, etc.).
//
// CACHE NOTE: Configs are read on every publish. At Plasmaide-today
// volume (~10 publishes/week) this is trivial. At 50 brands ×
// 1k publishes/day, consider in-memory cache with 60s TTL.
// Defer until pressure is real.

import { createAdminClient } from '@/lib/supabase/admin'
import {
  BrandContentConfig,
  ContentType,
  DestinationPlatform,
  ConfigNotFoundError,
  ConfigShapeError,
  ConfigValidationError,
  validatePlatformConfig,
} from './types'

type RawConfigRow = {
  id: string
  brand_id: string
  content_type: string
  destination_platform: string
  platform_label: string
  platform_config: Record<string, unknown>
  hitl_required: boolean
  compliance_gating: string
  auto_approve_threshold: number | null
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string | null
}

const VALID_CONTENT_TYPES = new Set<string>(['blog', 'email', 'landing_page', 'social_post'])
const VALID_PLATFORMS = new Set<string>([
  'shopify_blog', 'shopify_pages', 'dotdigital', 'klaviyo', 'meta_business', 'manual',
])
const VALID_GATING = new Set<string>([
  'always_block', 'block_on_critical', 'block_on_major', 'never_block',
])

export async function resolveContentConfig(
  brandId: string,
  contentType: ContentType,
): Promise<BrandContentConfig> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('brand_content_config')
    .select('*')
    .eq('brand_id', brandId)
    .eq('content_type', contentType)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new ConfigValidationError(
      `Supabase error resolving config for brand '${brandId}' / content_type '${contentType}': ${error.message}`,
      { cause: error },
    )
  }

  if (!data) {
    throw new ConfigNotFoundError(brandId, contentType)
  }

  const row = data as RawConfigRow

  // Validate enum fields from DB
  if (!VALID_CONTENT_TYPES.has(row.content_type)) {
    throw new ConfigValidationError(
      `Unexpected content_type '${row.content_type}' in DB row for brand '${brandId}'.`,
    )
  }
  if (!VALID_PLATFORMS.has(row.destination_platform)) {
    throw new ConfigValidationError(
      `Unexpected destination_platform '${row.destination_platform}' in DB row for brand '${brandId}'.`,
    )
  }
  if (!VALID_GATING.has(row.compliance_gating)) {
    throw new ConfigValidationError(
      `Unexpected compliance_gating '${row.compliance_gating}' in DB row for brand '${brandId}'.`,
    )
  }

  const destinationPlatform = row.destination_platform as DestinationPlatform
  const platformConfig = (row.platform_config ?? {}) as Record<string, unknown>

  const validation = validatePlatformConfig(destinationPlatform, platformConfig)
  if (!validation.valid) {
    throw new ConfigShapeError(brandId, contentType, destinationPlatform, validation.errors)
  }

  return {
    id: row.id,
    brand_id: row.brand_id,
    content_type: row.content_type as ContentType,
    destination_platform: destinationPlatform,
    platform_label: row.platform_label,
    platform_config: { destination_platform: destinationPlatform, ...platformConfig } as BrandContentConfig['platform_config'],
    hitl_required: row.hitl_required,
    compliance_gating: row.compliance_gating as BrandContentConfig['compliance_gating'],
    auto_approve_threshold: row.auto_approve_threshold,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by,
  }
}
