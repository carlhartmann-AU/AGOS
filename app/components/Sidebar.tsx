'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BrandSelector } from './BrandSelector'
import type { User } from '@supabase/supabase-js'
import type { UserRole } from '@/types'

type NavItem =
  | { href: string; label: string; roles?: UserRole[] }
  | { label: string; children: { href: string; label: string; roles?: UserRole[] }[] }

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/content-studio', label: 'Content Studio', roles: ['admin', 'approver'] },
  {
    label: 'Approvals',
    children: [
      { href: '/approvals/content', label: 'Content' },
      { href: '/approvals/web-designer', label: 'Web Designer' },
      { href: '/approvals/financial', label: 'Financial', roles: ['admin'] },
    ],
  },
  { href: '/performance', label: 'Performance' },
  { href: '/coo', label: 'COO Interface', roles: ['admin'] },
  { href: '/settings', label: 'Settings', roles: ['admin', 'approver'] },
]

function isVisible(item: { roles?: UserRole[] }, role: UserRole): boolean {
  return !item.roles || item.roles.includes(role)
}

const navBg: React.CSSProperties = { background: 'var(--nav-bg)', borderRight: '1px solid var(--nav-border)' }
const navBorderB: React.CSSProperties = { borderBottom: '1px solid var(--nav-border)' }
const navBorderT: React.CSSProperties = { borderTop: '1px solid var(--nav-border)' }

export function Sidebar({ user, role }: { user: User; role: UserRole }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <aside style={navBg} className="w-56 flex-shrink-0 flex flex-col h-screen">
      {/* Brand lockup */}
      <div style={navBorderB} className="px-5 py-4 flex items-center gap-2.5">
        <div className="w-6 h-6 rounded-md bg-indigo-600 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xs font-bold leading-none">A</span>
        </div>
        <span style={{ color: 'var(--nav-text-active)' }} className="font-semibold text-sm tracking-tight">
          AGOS
        </span>
      </div>

      {/* Brand selector */}
      <div style={navBorderB} className="py-1">
        <BrandSelector />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">
        {NAV.map((item) => {
          if ('children' in item) {
            const visibleChildren = item.children.filter((c) => isVisible(c, role))
            if (visibleChildren.length === 0) return null
            const parentActive = visibleChildren.some((c) => isActive(c.href))
            return (
              <div key={item.label} className="pt-3 first:pt-0">
                <span
                  className="block px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest"
                  style={{ color: parentActive ? 'var(--nav-text-active)' : 'var(--nav-text)', opacity: 0.5 }}
                >
                  {item.label}
                </span>
                <div className="space-y-0.5">
                  {visibleChildren.map((child) => {
                    const active = isActive(child.href)
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        style={{
                          background: active ? 'var(--nav-item-active)' : undefined,
                          color: active ? 'var(--nav-text-active)' : 'var(--nav-text)',
                        }}
                        className="flex items-center px-3 py-1.5 text-sm rounded-md transition-colors hover:bg-white/5 hover:text-white"
                      >
                        {child.label}
                      </Link>
                    )
                  })}
                </div>
              </div>
            )
          }

          if (!isVisible(item, role)) return null

          const active = isActive(item.href!)
          return (
            <Link
              key={item.href}
              href={item.href!}
              style={{
                background: active ? 'var(--nav-item-active)' : undefined,
                color: active ? 'var(--nav-text-active)' : 'var(--nav-text)',
              }}
              className="flex items-center px-3 py-2 text-sm rounded-md font-medium transition-colors hover:bg-white/5 hover:text-white"
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div style={navBorderT} className="px-3 py-3">
        <div className="flex items-center gap-2 px-1 mb-2">
          <div className="w-6 h-6 rounded-full bg-indigo-700 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[10px] font-semibold">
              {(user.email?.[0] ?? '?').toUpperCase()}
            </span>
          </div>
          <p className="text-xs truncate flex-1" style={{ color: 'var(--nav-text)' }}>
            {user.email}
          </p>
          <span
            className="text-[10px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0"
            style={{
              background: role === 'admin' ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.08)',
              color: role === 'admin' ? '#a5b4fc' : 'var(--nav-text)',
            }}
          >
            {role}
          </span>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full text-left text-xs px-1 transition-colors"
          style={{ color: 'var(--nav-text)', opacity: 0.6 }}
          onMouseEnter={e => { (e.target as HTMLElement).style.opacity = '1' }}
          onMouseLeave={e => { (e.target as HTMLElement).style.opacity = '0.6' }}
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
