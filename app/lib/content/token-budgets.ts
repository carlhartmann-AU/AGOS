export const MAX_TOKENS_BY_TYPE: Record<string, number> = {
  blog: 8192,
  landing_page: 8192,
  email: 4096,
  social: 2048,
  ad: 2048,
}

export const DEFAULT_MAX_TOKENS = 4096

export function maxTokensForContentType(content_type: string): number {
  return MAX_TOKENS_BY_TYPE[content_type] ?? DEFAULT_MAX_TOKENS
}
