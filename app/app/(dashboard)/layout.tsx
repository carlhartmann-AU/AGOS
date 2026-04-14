import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BrandProvider } from '@/context/BrandContext'
import { Sidebar } from '@/components/Sidebar'
import type { Brand } from '@/types'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch all brands, then filter to those the user has access to.
  // brand_ids is a comma-separated string in user_metadata e.g. "plasmaide,folle"
  // An empty brand_ids means access to all brands (admin).
  const { data: allBrands } = await supabase
    .from('brands')
    .select('*')
    .eq('status', 'active')
    .order('name')

  const brands = allBrands as Brand[] ?? []
  const rawBrandIds: string = user.user_metadata?.brand_ids ?? ''
  const allowedIds = rawBrandIds.split(',').map((s) => s.trim()).filter(Boolean)

  const accessibleBrands =
    allowedIds.length === 0
      ? brands
      : brands.filter((b) => allowedIds.includes(b.brand_id))

  return (
    <BrandProvider brands={accessibleBrands}>
      <div className="flex h-screen bg-gray-50">
        <Sidebar user={user} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </BrandProvider>
  )
}
