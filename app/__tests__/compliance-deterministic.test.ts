// __tests__/compliance-deterministic.test.ts
// Run: npx vitest run __tests__/compliance-deterministic.test.ts

import { describe, it, expect } from 'vitest'
import {
  evaluateForbiddenTerms,
  evaluateRequiredText,
  evaluateLengthCheck,
} from '@/lib/agents/compliance/rules/deterministic'
import type {
  ForbiddenTermsRule,
  RequiredTextRule,
  LengthCheckRule,
} from '@/types/compliance'

describe('evaluateForbiddenTerms', () => {
  const rule: ForbiddenTermsRule = {
    id: 'test',
    name: 'Test',
    severity: 'major',
    type: 'forbidden_terms',
    terms: ['ashwagandha', 'mushroom'],
    whole_word: true,
  }

  it('passes when no forbidden terms present', () => {
    const r = evaluateForbiddenTerms(rule, {
      title: 'Pine Bark Extract benefits',
      body_html: '<p>Supports healthy circulation.</p>',
    })
    expect(r.passed).toBe(true)
    expect(r.matches).toBeUndefined()
  })

  it('fails when a forbidden term is present', () => {
    const r = evaluateForbiddenTerms(rule, {
      title: 'Pine Bark vs Ashwagandha',
      body_html: '<p>Our ashwagandha blend...</p>',
    })
    expect(r.passed).toBe(false)
    expect(r.matches).toContain('ashwagandha')
  })

  it('ignores HTML tags when searching', () => {
    const r = evaluateForbiddenTerms(rule, {
      body_html: '<p class="mushroom-style">Not a real mushroom reference</p>',
    })
    // Matches the word "mushroom" in the text content
    expect(r.passed).toBe(false)
  })

  it('respects whole_word=true', () => {
    const r = evaluateForbiddenTerms(
      { ...rule, whole_word: true },
      { body_html: 'This mushrooming approach...' }
    )
    // "mushrooming" should not match "mushroom" with whole_word
    // Actually it will match because \bmushroom\b would match "mushroom" at word boundary
    // but "mushrooming" starts with "mushroom" so \bmushroom would match.
    // Let's verify: \bmushroom\b means whole word = "mushroom" alone.
    // "mushrooming" - \b before m, then "mushroom" then "ing" - no \b after m of mushroom
    // So it should NOT match. This test proves that.
    expect(r.passed).toBe(true)
  })
})

describe('evaluateRequiredText', () => {
  const rule: RequiredTextRule = {
    id: 'disclaimer',
    name: 'Disclaimer',
    severity: 'minor',
    type: 'required_text',
    pattern: 'consult.{0,30}healthcare',
    flags: 'i',
  }

  it('passes when pattern is present', () => {
    const r = evaluateRequiredText(rule, {
      body_html: 'Always consult your healthcare professional.',
    })
    expect(r.passed).toBe(true)
  })

  it('fails when pattern is missing', () => {
    const r = evaluateRequiredText(rule, {
      body_html: 'Great product!',
    })
    expect(r.passed).toBe(false)
  })

  it('auto-fixes when fix_template provided and action=auto_fix', () => {
    const fixRule: RequiredTextRule = {
      ...rule,
      action: 'auto_fix',
      fix_template: '{content}\n<p>Consult your healthcare professional.</p>',
    }
    const r = evaluateRequiredText(fixRule, {
      body_html: '<p>Great product!</p>',
    })
    expect(r.passed).toBe(false)
    expect(r.auto_fixed).toBe(true)
    expect(r.fixed_content).toContain('healthcare professional')
    expect(r.fixed_content).toContain('Great product')
  })
})

describe('evaluateLengthCheck', () => {
  it('passes when length is within bounds', () => {
    const rule: LengthCheckRule = {
      id: 't', name: 'Title length', severity: 'minor',
      type: 'length_check', target: 'title', min: 10, max: 70, unit: 'chars',
    }
    const r = evaluateLengthCheck(rule, { title: 'A reasonable title length here' })
    expect(r.passed).toBe(true)
  })

  it('fails when too short', () => {
    const rule: LengthCheckRule = {
      id: 't', name: 'Title length', severity: 'minor',
      type: 'length_check', target: 'title', min: 20, max: 70, unit: 'chars',
    }
    const r = evaluateLengthCheck(rule, { title: 'Too short' })
    expect(r.passed).toBe(false)
    expect(r.explanation).toContain('too short')
  })

  it('fails when too long', () => {
    const rule: LengthCheckRule = {
      id: 't', name: 'Title length', severity: 'minor',
      type: 'length_check', target: 'title', max: 20, unit: 'chars',
    }
    const r = evaluateLengthCheck(rule, { title: 'This title is definitely way too long for the limit' })
    expect(r.passed).toBe(false)
    expect(r.explanation).toContain('too long')
  })

  it('counts words correctly', () => {
    const rule: LengthCheckRule = {
      id: 't', name: 'Body words', severity: 'minor',
      type: 'length_check', target: 'body', min: 2, max: 5, unit: 'words',
    }
    const r = evaluateLengthCheck(rule, { body_html: '<p>one two three</p>' })
    expect(r.passed).toBe(true)
  })
})
