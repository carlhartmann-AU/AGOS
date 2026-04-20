// lib/agents/compliance/rules/deterministic.ts
// Rule evaluators that don't require an LLM — fast and free

import type {
  ForbiddenTermsRule,
  RequiredTextRule,
  LengthCheckRule,
  ContentItem,
  RuleResult,
} from '@/types/compliance'

/**
 * Flatten content to searchable text.
 * Strips HTML tags so "<p>ashwagandha</p>" matches "ashwagandha".
 */
function extractSearchableText(content: ContentItem): string {
  const fields = [
    content.title,
    content.body_html,
    content.summary_html,
    content.meta_title,
    content.meta_description,
    ...(content.tags ?? []),
  ].filter((v): v is string => typeof v === 'string')

  return fields
    .join(' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extract text from a specific target field for length checks.
 */
function getTargetText(content: ContentItem, target: LengthCheckRule['target']): string {
  const raw = (() => {
    switch (target) {
      case 'body': return content.body_html ?? ''
      case 'title': return content.title ?? ''
      case 'meta_description': return content.meta_description ?? ''
      case 'summary': return content.summary_html ?? ''
    }
  })()
  return typeof raw === 'string' ? raw.replace(/<[^>]+>/g, ' ').trim() : ''
}

export function evaluateForbiddenTerms(
  rule: ForbiddenTermsRule,
  content: ContentItem
): RuleResult {
  const text = extractSearchableText(content)
  const searchText = rule.case_sensitive ? text : text.toLowerCase()

  const matches: string[] = []
  for (const term of rule.terms) {
    const searchTerm = rule.case_sensitive ? term : term.toLowerCase()
    const pattern = rule.whole_word
      ? new RegExp(`\\b${escapeRegex(searchTerm)}\\b`, rule.case_sensitive ? 'g' : 'gi')
      : new RegExp(escapeRegex(searchTerm), rule.case_sensitive ? 'g' : 'gi')

    if (pattern.test(searchText)) {
      matches.push(term)
    }
  }

  const passed = matches.length === 0

  return {
    rule_id: rule.id,
    rule_name: rule.name,
    severity: rule.severity,
    passed,
    matches: matches.length > 0 ? matches : undefined,
    explanation: passed
      ? `No forbidden terms found.`
      : `Content contains forbidden term${matches.length > 1 ? 's' : ''}: ${matches.map(m => `"${m}"`).join(', ')}.`,
  }
}

export function evaluateRequiredText(
  rule: RequiredTextRule,
  content: ContentItem
): RuleResult {
  const text = extractSearchableText(content)
  const regex = new RegExp(rule.pattern, rule.flags ?? 'i')
  const passed = regex.test(text)

  // Auto-fix: append fix_template if available and rule failed
  let auto_fixed = false
  let fixed_content: string | undefined
  if (!passed && rule.fix_template && rule.action === 'auto_fix') {
    const currentBody = content.body_html ?? ''
    fixed_content = rule.fix_template.replace('{content}', currentBody)
    auto_fixed = true
  }

  return {
    rule_id: rule.id,
    rule_name: rule.name,
    severity: rule.severity,
    passed,
    explanation: passed
      ? `Required text pattern found.`
      : `Content is missing required text matching pattern: ${rule.pattern}${auto_fixed ? ' — auto-fixed by appending template.' : '.'}`,
    auto_fixed,
    fixed_content,
  }
}

export function evaluateLengthCheck(
  rule: LengthCheckRule,
  content: ContentItem
): RuleResult {
  const text = getTargetText(content, rule.target)
  const count = rule.unit === 'chars'
    ? text.length
    : text.split(/\s+/).filter(Boolean).length

  const tooShort = rule.min !== undefined && count < rule.min
  const tooLong = count > rule.max
  const passed = !tooShort && !tooLong

  let explanation = ''
  if (passed) {
    explanation = `${rule.target} length (${count} ${rule.unit}) within limits.`
  } else if (tooShort) {
    explanation = `${rule.target} too short: ${count} ${rule.unit} (minimum ${rule.min}).`
  } else {
    explanation = `${rule.target} too long: ${count} ${rule.unit} (maximum ${rule.max}).`
  }

  return {
    rule_id: rule.id,
    rule_name: rule.name,
    severity: rule.severity,
    passed,
    explanation,
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
