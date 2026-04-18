import { createAdminClient } from '@/lib/supabase/admin'
import type { Plan } from '@/types'
import {
  PLAN_GENERATION_LIMITS,
  PLAN_USER_LIMITS,
  getContentTypesAllowed,
  isPlanFeatureEnabled,
} from '@/lib/permissions'

export type GenerationLimitResult = {
  allowed: boolean
  used: number
  limit: number
  plan: Plan
}

export type UserLimitResult = {
  allowed: boolean
  current: number
  limit: number
  plan: Plan
}

export async function checkGenerationLimit(brandId: string): Promise<GenerationLimitResult> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('brand_settings')
    .select('plan, generations_this_month, generations_reset_at')
    .eq('brand_id', brandId)
    .single()

  if (error || !data) {
    return { allowed: false, used: 0, limit: 0, plan: 'starter' }
  }

  const plan = (data.plan ?? 'starter') as Plan
  const limit = PLAN_GENERATION_LIMITS[plan]
  let used = data.generations_this_month ?? 0

  // Reset counter if past the reset date
  if (data.generations_reset_at && new Date(data.generations_reset_at) < new Date()) {
    const nextReset = new Date()
    nextReset.setMonth(nextReset.getMonth() + 1, 1)
    nextReset.setHours(0, 0, 0, 0)
    await supabase
      .from('brand_settings')
      .update({ generations_this_month: 0, generations_reset_at: nextReset.toISOString() })
      .eq('brand_id', brandId)
    used = 0
  }

  return {
    allowed: limit === Infinity || used < limit,
    used,
    limit,
    plan,
  }
}

export async function checkUserLimit(brandId: string): Promise<UserLimitResult> {
  const supabase = createAdminClient()

  const [{ data: settings }, { count }] = await Promise.all([
    supabase.from('brand_settings').select('plan').eq('brand_id', brandId).single(),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('brand_id', brandId),
  ])

  const plan = (settings?.plan ?? 'starter') as Plan
  const limit = PLAN_USER_LIMITS[plan]
  const current = count ?? 0

  return {
    allowed: limit === Infinity || current < limit,
    current,
    limit,
    plan,
  }
}

export async function incrementGenerationCount(brandId: string): Promise<void> {
  const supabase = createAdminClient()
  const { error } = await supabase.rpc('increment_generations', { p_brand_id: brandId })
  if (error) {
    // Fallback if RPC not deployed yet
    const { data: current } = await supabase
      .from('brand_settings')
      .select('generations_this_month')
      .eq('brand_id', brandId)
      .single()
    await supabase
      .from('brand_settings')
      .update({ generations_this_month: (current?.generations_this_month ?? 0) + 1 })
      .eq('brand_id', brandId)
  }
}

export { getContentTypesAllowed, isPlanFeatureEnabled }
