import type { UserRole, Plan } from '@/types'

export const PLAN_GENERATION_LIMITS: Record<Plan, number> = {
  starter: 50,
  growth: 200,
  scale: Infinity,
  enterprise: Infinity,
}

export const PLAN_USER_LIMITS: Record<Plan, number> = {
  starter: 1,
  growth: 3,
  scale: 10,
  enterprise: Infinity,
}

export const PLAN_CONTENT_TYPES: Record<Plan, string[]> = {
  starter: ['blog', 'email'],
  growth: ['blog', 'email', 'social_caption', 'ad', 'landing_page', 'b2b_email', 'cs_response', 'review_response'],
  scale: ['blog', 'email', 'social_caption', 'ad', 'landing_page', 'b2b_email', 'cs_response', 'review_response'],
  enterprise: ['blog', 'email', 'social_caption', 'ad', 'landing_page', 'b2b_email', 'cs_response', 'review_response'],
}

const PLAN_FEATURES: Record<Plan, Record<string, boolean>> = {
  starter:    { shopify_publish: false, auto_approve: false, all_integrations: false },
  growth:     { shopify_publish: true,  auto_approve: true,  all_integrations: false },
  scale:      { shopify_publish: true,  auto_approve: true,  all_integrations: true },
  enterprise: { shopify_publish: true,  auto_approve: true,  all_integrations: true },
}

export function isPlanFeatureEnabled(plan: Plan, feature: string): boolean {
  return PLAN_FEATURES[plan]?.[feature] ?? false
}

export function getContentTypesAllowed(plan: Plan): string[] {
  return PLAN_CONTENT_TYPES[plan]
}

// Role-based permission checks
export function canAdmin(role: UserRole): boolean {
  return role === 'admin'
}

export function canApprove(role: UserRole): boolean {
  return role === 'admin' || role === 'approver'
}

export function canViewSettings(role: UserRole): boolean {
  return role === 'admin' || role === 'approver'
}

export function canGoLive(role: UserRole): boolean {
  return role === 'admin'
}

export function canGenerateContent(role: UserRole): boolean {
  return role === 'admin' || role === 'approver'
}
