import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BrandProvider } from '@/context/BrandContext'
import { Sidebar } from '@/components/Sidebar'
import type { Brand, UserRole } from '@/types'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [{ data: allBrands }, { data: profile }] = await Promise.all([
    supabase.from('brands').select('*').eq('status', 'active').order('name'),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
  ])

  const brands = allBrands as Brand[] ?? []
  const role: UserRole = profile?.role ?? 'viewer'

  const rawBrandIds: string = user.user_metadata?.brand_ids ?? ''
  const allowedIds = rawBrandIds.split(',').map((s) => s.trim()).filter(Boolean)

  const accessibleBrands =
    allowedIds.length === 0
      ? brands
      : brands.filter((b) => allowedIds.includes(b.brand_id))

  return (
    <BrandProvider brands={accessibleBrands}>
      <div className="flex h-screen bg-gray-50">
        <Sidebar user={user} role={role} />
        <main className="flex-1 overflow-y-auto px-8 py-6">
          {children}
        </main>
      </div>
    </BrandProvider>
  )
}
