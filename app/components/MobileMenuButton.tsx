'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export function MobileMenuButton() {
  const pathname = usePathname()

  useEffect(() => {
    document.querySelector('.nav')?.classList.remove('open')
    document.querySelector('.nav-overlay')?.classList.remove('active')
  }, [pathname])

  function toggleNav() {
    document.querySelector('.nav')?.classList.toggle('open')
    document.querySelector('.nav-overlay')?.classList.toggle('active')
  }

  function closeNav() {
    document.querySelector('.nav')?.classList.remove('open')
    document.querySelector('.nav-overlay')?.classList.remove('active')
  }

  return (
    <>
      <div className="nav-overlay" onClick={closeNav} />
      <button className="nav-hamburger" onClick={toggleNav} aria-label="Open navigation">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M2 4h12M2 8h12M2 12h12" />
        </svg>
      </button>
    </>
  )
}
