// __tests__/tw-window-resolver.test.ts
import { describe, it, expect } from 'vitest'
import { resolveWindow } from '@/lib/triple-whale/kpis'

describe('resolveWindow', () => {
  // Pin to a known date: April 19, 2026 (mid-month Sunday)
  const now = new Date('2026-04-19T10:00:00Z')

  it('24h: start and end are today', () => {
    const r = resolveWindow('24h', now)
    expect(r.start).toBe('2026-04-19')
    expect(r.end).toBe('2026-04-19')
    expect(r.expectedDays).toBe(1)
  })

  it('7d: start is 6 days ago (inclusive 7 days total)', () => {
    const r = resolveWindow('7d', now)
    expect(r.start).toBe('2026-04-13')
    expect(r.end).toBe('2026-04-19')
    expect(r.expectedDays).toBe(7)
  })

  it('30d: start is 29 days ago (inclusive 30 days total)', () => {
    const r = resolveWindow('30d', now)
    expect(r.start).toBe('2026-03-21')
    expect(r.end).toBe('2026-04-19')
    expect(r.expectedDays).toBe(30)
  })

  it('mtd: starts on first of the month', () => {
    const r = resolveWindow('mtd', now)
    expect(r.start).toBe('2026-04-01')
    expect(r.end).toBe('2026-04-19')
    expect(r.expectedDays).toBe(19)
  })

  it('mtd on first of month returns 1 day', () => {
    const firstOfMonth = new Date('2026-04-01T10:00:00Z')
    const r = resolveWindow('mtd', firstOfMonth)
    expect(r.start).toBe('2026-04-01')
    expect(r.end).toBe('2026-04-01')
    expect(r.expectedDays).toBe(1)
  })

  it('30d crosses year boundary correctly', () => {
    const jan10 = new Date('2026-01-10T10:00:00Z')
    const r = resolveWindow('30d', jan10)
    expect(r.start).toBe('2025-12-12')
    expect(r.end).toBe('2026-01-10')
    expect(r.expectedDays).toBe(30)
  })

  it('7d crosses month boundary correctly', () => {
    const mar3 = new Date('2026-03-03T10:00:00Z')
    const r = resolveWindow('7d', mar3)
    expect(r.start).toBe('2026-02-25')
    expect(r.end).toBe('2026-03-03')
    expect(r.expectedDays).toBe(7)
  })
})
