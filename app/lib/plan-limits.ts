import { createAdminClient } from '@/lib/supabase/admin'
import type { Plan } from '@/types'
import {
  PLAN_USER_LIMITS,
  getContentTypesAllowed,
  isPlanFeatureEnabled,
} from '@/lib/permissions'

export type UserLimitResult = {
  allowed: boolean
  current: number
  limit: number
  plan: Plan
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

export { getContentTypesAllowed, isPlanFeatureEnabled }
