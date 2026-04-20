'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { UserRole } from '@/types'

// ─── Icon SVGs ────────────────────────────────────────────────────────────────

function NavIcon({ name }: { name: string }) {
  const props = { width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (name) {
    case 'dash':     return <svg {...props}><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>
    case 'studio':   return <svg {...props}><path d="M3 3h10v8H3z"/><path d="M3 7l3-2 3 3 4-4"/></svg>
    case 'approve':  return <svg {...props}><path d="M3 8l3 3 7-7"/><path d="M3 13h10"/></svg>
    case 'perf':     return <svg {...props}><path d="M2 13h12"/><rect x="3" y="8" width="2" height="5"/><rect x="7" y="5" width="2" height="8"/><rect x="11" y="10" width="2" height="3"/></svg>
    case 'fin':      return <svg {...props}><path d="M3 10h10M3 6h4M3 14h6"/><path d="M11 4v8M9 6l2-2 2 2"/></svg>
    case 'coo':      return <svg {...props}><path d="M9 1L3 9h4l-1 6 6-8H8z"/></svg>
    case 'settings': return <svg {...props}><circle cx="8" cy="8" r="2"/><path d="M8 1v3M8 12v3M1 8h3M12 8h3M3 3l2 2M11 11l2 2M3 13l2-2M11 5l2-2"/></svg>
    case 'chev':     return <svg {...props}><path d="M4 6l4 4 4-4"/></svg>
    default:         return null
  }
}

function AgosGlyph() {
  const sats = [0, 60, 120, 180, 240, 300].map((deg, i) => {
    const r = (deg - 90) * Math.PI / 180
    return <circle key={i} cx={12 + 7.5 * Math.cos(r)} cy={12 + 7.5 * Math.sin(r)} r="1.05" fill="#b7ccff" />
  })
  return (
    <div style={{ width: 22, height: 22, borderRadius: 5, flexShrink: 0, background: 'linear-gradient(140deg,#2f6feb 0%,#0b1a3a 100%)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.14)', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
      <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none">
        <circle cx="12" cy="12" r="7.5" stroke="rgba(255,255,255,.28)" strokeWidth="0.7" strokeDasharray="1.2 1.6" />
        {sats}
        <circle cx="12" cy="12" r="3.2" fill="#fff" />
        <circle cx="12" cy="12" r="1.3" fill="#2f6feb" />
      </svg>
    </div>
  )
}

// ─── Nav items config ─────────────────────────────────────────────────────────

type NavItem = { key: string; href: string; label: string; icon: string; roles?: UserRole[] }

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard',      href: '/dashboard',       label: 'Dashboard',       icon: 'dash' },
  { key: 'content-studio', href: '/content-studio',  label: 'Content Studio',  icon: 'studio', roles: ['admin', 'approver'] },
  { key: 'approvals',      href: '/approvals/content', label: 'Approvals',     icon: 'approve' },
  { key: 'financial',      href: '/financial',        label: 'Financial',       icon: 'fin' },
  { key: 'performance',    href: '/performance',     label: 'Performance',     icon: 'perf' },
  { key: 'coo',            href: '/coo',             label: 'COO Interface',   icon: 'coo',  roles: ['admin'] },
  { key: 'settings',       href: '/settings',        label: 'Settings',        icon: 'settings', roles: ['admin', 'approver'] },
]

// ─── Sidebar ──────────────────────────────────────────────────────────────────

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

  function isVisible(item: NavItem) {
    return !item.roles || item.roles.includes(role)
  }

  const initials = (user.email ?? '?')
    .split('@')[0]
    .slice(0, 2)
    .toUpperCase()

  const displayName = user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? 'User'

  return (
    <aside className="nav">
      {/* Brand lockup */}
      <div className="nav-brand">
        <div className="nav-brand-top">
          <AgosGlyph />
          <div className="stack" style={{ lineHeight: 1.1, gap: 2 }}>
            <span style={{ fontSize: 12, letterSpacing: '-0.01em', color: '#fff', fontWeight: 500 }}>AGOS</span>
            <span style={{ fontSize: 9, letterSpacing: '0.14em', color: 'var(--nav-ink-3)', textTransform: 'uppercase' }}>AUTONOMOUS GROWTH OS</span>
          </div>
        </div>
        <div className="brand-switcher">
          <div className="brand-mark">Pl</div>
          <div className="stack" style={{ flex: 1, minWidth: 0 }}>
            <div className="brand-name">Plasmaide</div>
            <div className="brand-sub mono">AU · PRIMARY BRAND</div>
          </div>
          <span className="caret"><NavIcon name="chev" /></span>
        </div>
      </div>

      {/* Workspace section */}
      <div className="nav-section-label">Workspace</div>
      <div className="nav-items">
        {NAV_ITEMS.filter(isVisible).map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`nav-item${active ? ' active' : ''}`}
            >
              <NavIcon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </div>

      {/* Footer */}
      <div className="nav-footer">
        <div className="nav-user">
          <div className="avatar">{initials}</div>
          <div className="stack" style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#f0f2fa', fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</div>
            <div className="mono" style={{ color: 'var(--nav-ink-3)', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'uppercase' }}>
              {role} · {user.email}
            </div>
          </div>
        </div>
        <div className="nav-sync">
          <span className="mono">LAST SYNC · 18h ago</span>
          <span className="pulse" />
        </div>
        <button
          onClick={handleSignOut}
          style={{ marginTop: 8, padding: '4px 4px', fontSize: 11, color: 'var(--nav-ink-3)', background: 'transparent', border: 0, textAlign: 'left', transition: 'color 120ms', width: '100%' }}
          onMouseEnter={e => { (e.target as HTMLElement).style.color = 'var(--nav-ink)' }}
          onMouseLeave={e => { (e.target as HTMLElement).style.color = 'var(--nav-ink-3)' }}
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
