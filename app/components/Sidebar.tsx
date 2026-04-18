'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { BrandSelector } from './BrandSelector'
import type { User } from '@supabase/supabase-js'

const NAV = [
  {
    href: '/dashboard',
    label: 'Dashboard',
  },
  {
    href: '/content-studio',
    label: 'Content Studio',
  },
  {
    label: 'Approvals',
    children: [
      { href: '/approvals/content', label: 'Content' },
      { href: '/approvals/web-designer', label: 'Web Designer' },
      { href: '/approvals/financial', label: 'Financial' },
    ],
  },
  {
    href: '/performance',
    label: 'Performance',
  },
  {
    href: '/coo',
    label: 'COO Interface',
  },
  {
    href: '/settings',
    label: 'Settings',
  },
]

export function Sidebar({ user }: { user: User }) {
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
    <aside className="w-56 flex-shrink-0 bg-gray-900 flex flex-col h-screen">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-gray-800">
        <span className="text-white font-semibold tracking-tight">AGOS</span>
      </div>

      {/* Brand selector */}
      <div className="border-b border-gray-800 py-2">
        <BrandSelector />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV.map((item) => {
          if (item.children) {
            const parentActive = item.children.some((c) => isActive(c.href))
            return (
              <div key={item.label}>
                <span
                  className={`flex items-center px-3 py-2 text-sm rounded-md font-medium
                    ${parentActive ? 'text-white' : 'text-gray-400'}`}
                >
                  {item.label}
                </span>
                <div className="ml-3 space-y-0.5">
                  {item.children.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={`flex items-center px-3 py-1.5 text-sm rounded-md
                        ${isActive(child.href)
                          ? 'bg-gray-800 text-white'
                          : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                        }`}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              </div>
            )
          }

          return (
            <Link
              key={item.href}
              href={item.href!}
              className={`flex items-center px-3 py-2 text-sm rounded-md font-medium
                ${isActive(item.href!)
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User + sign out */}
      <div className="px-3 py-4 border-t border-gray-800">
        <p className="text-xs text-gray-400 truncate mb-2">{user.email}</p>
        <button
          onClick={handleSignOut}
          className="w-full text-left text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
