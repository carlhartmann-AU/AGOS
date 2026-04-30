// lib/config/types.ts
// Domain types and validators for brand_content_config.
// No external validation library — hand-written validators per project convention.

// ─── Enums ────────────────────────────────────────────────────────────────────

export type ContentType = 'blog' | 'email' | 'landing_page' | 'social_post'
export type DestinationPlatform =
  | 'shopify_blog'
  | 'shopify_pages'
  | 'dotdigital'
  | 'klaviyo'
  | 'meta_business'
  | 'manual'
export type ComplianceGating =
  | 'always_block'
  | 'block_on_critical'
  | 'block_on_major'
  | 'never_block'

// ─── Per-platform config shapes ───────────────────────────────────────────────

export interface ShopifyBlogPlatformConfig {
  blog_handle: string
  default_author?: string
  default_tags?: string[]
}

export interface ShopifyPagesPlatformConfig {
  default_template_suffix?: string | null
  is_published?: boolean
}

export interface DotDigitalPlatformConfig {
  region: 'r1' | 'r2' | 'r3'
  api_base_url: string
  address_book_id: number
  from_address_id: number
  from_name: string
  unsubscribe_token: string
  merge_token_format: string
  n8n_webhook_url: string
  auto_send_after_create: boolean
}

export interface KlaviyoPlatformConfig {
  api_key_secret_ref: string
  from_email: string
  from_name: string
  unsubscribe_token: string
  merge_token_format: string
  default_list_id?: string
}

export type MetaBusinessPlatformConfig = Record<string, unknown> // TBD when Item 15 ships
export type ManualPlatformConfig = Record<string, never>

export type PlatformConfig =
  | ({ destination_platform: 'shopify_blog' } & ShopifyBlogPlatformConfig)
  | ({ destination_platform: 'shopify_pages' } & ShopifyPagesPlatformConfig)
  | ({ destination_platform: 'dotdigital' } & DotDigitalPlatformConfig)
  | ({ destination_platform: 'klaviyo' } & KlaviyoPlatformConfig)
  | ({ destination_platform: 'meta_business' } & MetaBusinessPlatformConfig)
  | ({ destination_platform: 'manual' } & ManualPlatformConfig)

// ─── Row type ─────────────────────────────────────────────────────────────────

export interface BrandContentConfig {
  id: string
  brand_id: string
  content_type: ContentType
  destination_platform: DestinationPlatform
  platform_label: string
  platform_config: PlatformConfig
  hitl_required: boolean
  compliance_gating: ComplianceGating
  auto_approve_threshold: number | null
  is_active: boolean
  created_at: string
  updated_at: string
  created_by: string | null
}

// ─── Error classes ────────────────────────────────────────────────────────────

export class ConfigNotFoundError extends Error {
  public readonly brandId: string
  public readonly contentType: string
  constructor(brandId: string, contentType: string) {
    super(`No active content config found for brand '${brandId}' and content_type '${contentType}'.`)
    this.name = 'ConfigNotFoundError'
    this.brandId = brandId
    this.contentType = contentType
  }
}

export class ConfigShapeError extends Error {
  public readonly brandId: string
  public readonly contentType: string
  public readonly destinationPlatform: string
  public readonly validationDetails: string[]
  constructor(
    brandId: string,
    contentType: string,
    destinationPlatform: string,
    validationDetails: string[],
  ) {
    super(
      `platform_config for brand '${brandId}' / content_type '${contentType}' / platform '${destinationPlatform}' failed validation: ${validationDetails.join('; ')}`,
    )
    this.name = 'ConfigShapeError'
    this.brandId = brandId
    this.contentType = contentType
    this.destinationPlatform = destinationPlatform
    this.validationDetails = validationDetails
  }
}

export class ConfigValidationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'ConfigValidationError'
  }
}

// ─── Validators ───────────────────────────────────────────────────────────────

type ValidationResult = { valid: true } | { valid: false; errors: string[] }

function required(obj: Record<string, unknown>, fields: string[]): string[] {
  return fields
    .filter((f) => obj[f] === undefined || obj[f] === null || obj[f] === '')
    .map((f) => `missing required field '${f}'`)
}

export function validateShopifyBlog(config: Record<string, unknown>): ValidationResult {
  const errors = required(config, ['blog_handle'])
  if (typeof config.blog_handle !== 'string') errors.push("'blog_handle' must be a string")
  return errors.length ? { valid: false, errors } : { valid: true }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function validateShopifyPages(config: Record<string, unknown>): ValidationResult {
  // All fields optional for pages — template_suffix and is_published have defaults
  return { valid: true }
}

export function validateDotDigital(config: Record<string, unknown>): ValidationResult {
  const errors = required(config, [
    'region', 'api_base_url', 'address_book_id', 'from_address_id',
    'from_name', 'unsubscribe_token', 'merge_token_format', 'n8n_webhook_url',
  ])
  if (config.region !== undefined && !['r1', 'r2', 'r3'].includes(config.region as string)) {
    errors.push("'region' must be one of r1, r2, r3")
  }
  if (config.address_book_id !== undefined && typeof config.address_book_id !== 'number') {
    errors.push("'address_book_id' must be a number")
  }
  if (config.from_address_id !== undefined && typeof config.from_address_id !== 'number') {
    errors.push("'from_address_id' must be a number")
  }
  return errors.length ? { valid: false, errors } : { valid: true }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function validateKlaviyo(config: Record<string, unknown>): ValidationResult {
  throw new ConfigValidationError(
    "Klaviyo platform config validation not yet implemented (Tier 1 Item 9).",
  )
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function validateMetaBusiness(config: Record<string, unknown>): ValidationResult {
  throw new ConfigValidationError(
    "Meta Business platform config validation not yet implemented (Tier 1 Item 15).",
  )
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function validateManual(_config: Record<string, unknown>): ValidationResult {
  return { valid: true }
}

export function validatePlatformConfig(
  destinationPlatform: DestinationPlatform,
  platformConfig: Record<string, unknown>,
): ValidationResult {
  switch (destinationPlatform) {
    case 'shopify_blog':  return validateShopifyBlog(platformConfig)
    case 'shopify_pages': return validateShopifyPages(platformConfig)
    case 'dotdigital':    return validateDotDigital(platformConfig)
    case 'klaviyo':       return validateKlaviyo(platformConfig)
    case 'meta_business': return validateMetaBusiness(platformConfig)
    case 'manual':        return validateManual(platformConfig)
  }
}
