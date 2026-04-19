// __tests__/tw-currency-and-extraction.test.ts
import { describe, it, expect } from 'vitest'
import { convertAmount } from '@/lib/triple-whale/fx'

describe('convertAmount', () => {
  const rates = { AUD: 1.92, USD: 1.27, EUR: 1.17, GBP: 1.0 }

  it('returns amount unchanged when source equals target', () => {
    expect(convertAmount(100, 'GBP', 'GBP', rates)).toBe(100)
  })

  it('converts GBP to AUD using the rate', () => {
    expect(convertAmount(100, 'GBP', 'AUD', rates)).toBe(192)
  })

  it('converts GBP to USD', () => {
    expect(convertAmount(100, 'GBP', 'USD', rates)).toBe(127)
  })

  it('returns original amount when rate is missing (graceful degradation)', () => {
    expect(convertAmount(100, 'GBP', 'JPY', rates)).toBe(100)
  })

  it('returns original amount when rate is not a number', () => {
    const badRates = { AUD: 'not a number' as unknown as number }
    expect(convertAmount(100, 'GBP', 'AUD', badRates)).toBe(100)
  })

  it('handles empty rates object', () => {
    expect(convertAmount(100, 'GBP', 'AUD', {})).toBe(100)
  })

  it('handles zero amount', () => {
    expect(convertAmount(0, 'GBP', 'AUD', rates)).toBe(0)
  })

  it('handles negative amount (refunds)', () => {
    expect(convertAmount(-50, 'GBP', 'AUD', rates)).toBe(-96)
  })
})

// Simulate the TW response extraction logic from client.ts
// We'd ideally import getMetric/getMobyAnswer but they're internal to client.ts
// Re-implement the extraction here for testability

function getMetric(summary: unknown, metricId: string): number {
  const obj = summary as { metrics?: Array<{ id?: string; values?: { current?: number } }> }
  const metric = obj?.metrics?.find(m => m?.id === metricId)
  return typeof metric?.values?.current === 'number' ? metric.values.current : 0
}

function getMobyAnswer(moby: unknown, field: string): number {
  const obj = moby as { responses?: Array<{ answer?: Record<string, number[] | undefined>; isError?: boolean }> }
  const first = obj?.responses?.[0]
  if (!first || first.isError) return 0
  const arr = first.answer?.[field]
  return Array.isArray(arr) && typeof arr[0] === 'number' ? arr[0] : 0
}

describe('getMetric (TW Summary Page shape)', () => {
  it('extracts sales from metrics array', () => {
    const response = {
      metrics: [
        { id: 'sales', values: { current: 3871 } },
        { id: 'orders', values: { current: 42 } },
      ],
    }
    expect(getMetric(response, 'sales')).toBe(3871)
    expect(getMetric(response, 'orders')).toBe(42)
  })

  it('returns 0 for missing metric', () => {
    const response = { metrics: [{ id: 'sales', values: { current: 100 } }] }
    expect(getMetric(response, 'roas')).toBe(0)
  })

  it('returns 0 for malformed response', () => {
    expect(getMetric(null, 'sales')).toBe(0)
    expect(getMetric({}, 'sales')).toBe(0)
    expect(getMetric({ metrics: null }, 'sales')).toBe(0)
  })
})

describe('getMobyAnswer (TW Moby shape)', () => {
  it('extracts first value from answer array', () => {
    const response = {
      responses: [{
        isError: false,
        answer: {
          aov: [92.15],
          new_customer_orders: [12],
          returning_customer_orders: [30],
        },
      }],
    }
    expect(getMobyAnswer(response, 'aov')).toBe(92.15)
    expect(getMobyAnswer(response, 'new_customer_orders')).toBe(12)
    expect(getMobyAnswer(response, 'returning_customer_orders')).toBe(30)
  })

  it('returns 0 when isError is true', () => {
    const response = { responses: [{ isError: true, answer: { aov: [100] } }] }
    expect(getMobyAnswer(response, 'aov')).toBe(0)
  })

  it('returns 0 for missing field', () => {
    const response = { responses: [{ isError: false, answer: { aov: [100] } }] }
    expect(getMobyAnswer(response, 'missing_field')).toBe(0)
  })

  it('returns 0 for malformed response', () => {
    expect(getMobyAnswer(null, 'aov')).toBe(0)
    expect(getMobyAnswer({}, 'aov')).toBe(0)
    expect(getMobyAnswer({ responses: [] }, 'aov')).toBe(0)
  })
})
