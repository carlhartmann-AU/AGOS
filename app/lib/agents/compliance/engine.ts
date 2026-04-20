// lib/agents/compliance/engine.ts
// Core compliance engine. Pure function of (content, config, deps) -> result.
// No Next.js, no Supabase, no n8n. Portable to any runtime.

import Anthropic from '@anthropic-ai/sdk'
import type {
  ComplianceConfig,
  ComplianceResult,
  ComplianceRule,
  ContentItem,
  RuleResult,
  Severity,
  SeverityAction,
  RulePack,
} from '@/types/compliance'

import {
  evaluateForbiddenTerms,
  evaluateRequiredText,
  evaluateLengthCheck,
} from './rules/deterministic'

import {
  evaluateLLMCheck,
  evaluateToneCheck,
  calculateCost,
} from './rules/llm'

export interface ComplianceEngineDeps {
  anthropic: Anthropic
  getRulePack: (packId: string) => Promise<RulePack | null>
  brandProfile?: Record<string, unknown>
}

/**
 * Merge all enabled rules from rule packs + custom rules.
 * Custom rules win if there's an ID collision (brands can override pack defaults).
 */
async function resolveRules(
  config: ComplianceConfig,
  getRulePack: (id: string) => Promise<RulePack | null>
): Promise<ComplianceRule[]> {
  const rulesById = new Map<string, ComplianceRule>()

  for (const packId of config.rule_packs) {
    const pack = await getRulePack(packId)
    if (!pack) continue
    for (const rule of pack.rules) {
      if (rule.enabled === false) continue
      rulesById.set(rule.id, rule)
    }
  }

  // Custom rules override pack rules with same ID
  for (const rule of config.custom_rules) {
    if (rule.enabled === false) {
      rulesById.delete(rule.id)
      continue
    }
    rulesById.set(rule.id, rule)
  }

  return Array.from(rulesById.values())
}

/**
 * Resolve what action to take for a failed rule.
 * Rule-level action overrides brand-level severity_actions map.
 */
function resolveAction(
  rule: ComplianceRule,
  config: ComplianceConfig
): SeverityAction {
  return rule.action ?? config.severity_actions[rule.severity]
}

/**
 * Evaluate a single rule. Deterministic rules are sync, LLM rules are async.
 */
async function evaluateRule(
  rule: ComplianceRule,
  content: ContentItem,
  deps: ComplianceEngineDeps,
  llmConfig?: ComplianceConfig['llm_config'],
  contentType?: string
): Promise<RuleResult> {
  try {
    switch (rule.type) {
      case 'forbidden_terms':
        return evaluateForbiddenTerms(rule, content)
      case 'required_text':
        return evaluateRequiredText(rule, content)
      case 'length_check':
        return evaluateLengthCheck(rule, content, contentType)
      case 'llm_check':
        return await evaluateLLMCheck(rule, content, deps.anthropic, llmConfig)
      case 'tone_check':
        return await evaluateToneCheck(
          rule,
          content,
          deps.brandProfile ?? {},
          deps.anthropic,
          llmConfig
        )
    }
  } catch (err) {
    // Rule evaluation failed — flag as escalated so a human reviews
    return {
      rule_id: rule.id,
      rule_name: rule.name,
      severity: rule.severity,
      passed: false,
      explanation: `Rule evaluation failed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

/**
 * Apply auto-fixes from rule results to content.
 * Currently handles body_html replacements from required_text rules.
 * Returns { fixed_content, fixes_applied } where fixed_content is the updated ContentItem.
 */
function applyAutoFixes(
  content: ContentItem,
  results: RuleResult[],
  rules: ComplianceRule[],
  config: ComplianceConfig
): { fixed_content: ContentItem; fixes_applied: number } {
  let fixed: ContentItem = { ...content }
  let count = 0

  for (const result of results) {
    if (result.passed) continue
    const rule = rules.find(r => r.id === result.rule_id)
    if (!rule) continue

    const action = resolveAction(rule, config)
    if (action !== 'auto_fix') continue

    // required_text auto-fix: replace body_html with fix_template output
    if (rule.type === 'required_text' && result.fixed_content) {
      fixed = { ...fixed, body_html: result.fixed_content }
      result.auto_fixed = true
      count++
    }

    // LLM rules with suggested_fix: only apply if explicitly marked auto_fix
    // and only for minor issues to avoid silent content mutation
    // (future: could have a separate "apply_llm_fixes" flag per rule)
  }

  return { fixed_content: fixed, fixes_applied: count }
}

/**
 * Determine overall status based on rule results and configured actions.
 *
 * Logic:
 * - If any rule triggered "block" action on fail → blocked
 * - Else if any rule triggered "escalate" action on fail → escalated
 * - Else if any rules failed (even if auto-fixed) → warnings
 * - Else → passed
 */
function computeOverallStatus(
  results: RuleResult[],
  rules: ComplianceRule[],
  config: ComplianceConfig
): ComplianceResult['overall_status'] {
  let hasBlock = false
  let hasEscalate = false
  let hasAnyFail = false

  for (const result of results) {
    if (result.passed) continue
    hasAnyFail = true
    const rule = rules.find(r => r.id === result.rule_id)
    if (!rule) continue
    const action = resolveAction(rule, config)
    if (action === 'block') hasBlock = true
    else if (action === 'escalate') hasEscalate = true
  }

  if (hasBlock) return 'blocked'
  if (hasEscalate) return 'escalated'
  if (hasAnyFail) return 'warnings'
  return 'passed'
}

/**
 * Main entry point. Evaluates content against a brand's compliance config.
 *
 * This is the portable core — no framework dependencies beyond the Anthropic SDK
 * and the injected getRulePack dep. Can be lifted into any runtime.
 */
export async function runCompliance(
  content: ContentItem,
  config: ComplianceConfig,
  deps: ComplianceEngineDeps,
  meta: { content_id: string; brand_id: string; content_type?: string }
): Promise<ComplianceResult> {
  const startedAt = Date.now()

  if (!config.enabled) {
    return {
      content_id: meta.content_id,
      brand_id: meta.brand_id,
      overall_status: 'passed',
      rule_results: [],
      auto_fixes_applied: 0,
      issues_by_severity: { minor: 0, major: 0, critical: 0 },
      content_modified: false,
      ran_at: new Date().toISOString(),
      total_tokens: { input: 0, output: 0 },
      duration_ms: Date.now() - startedAt,
    }
  }

  const rules = await resolveRules(config, deps.getRulePack)

  // Run all rules in parallel — safe because they don't mutate content
  const results = await Promise.all(
    rules.map(rule => evaluateRule(rule, content, deps, config.llm_config, meta.content_type))
  )

  // Apply auto-fixes (mutates rule results to set auto_fixed flags)
  const { fixed_content, fixes_applied } = applyAutoFixes(content, results, rules, config)
  const content_modified = fixes_applied > 0

  // Tally severity counts
  const issues_by_severity: Record<Severity, number> = { minor: 0, major: 0, critical: 0 }
  for (const r of results) {
    if (!r.passed && !r.auto_fixed) {
      issues_by_severity[r.severity]++
    }
  }

  // Aggregate token usage
  const total_tokens = results.reduce(
    (acc, r) => ({
      input: acc.input + (r.tokens_used?.input ?? 0),
      output: acc.output + (r.tokens_used?.output ?? 0),
    }),
    { input: 0, output: 0 }
  )

  const overall_status = computeOverallStatus(results, rules, config)

  return {
    content_id: meta.content_id,
    brand_id: meta.brand_id,
    overall_status,
    rule_results: results,
    auto_fixes_applied: fixes_applied,
    issues_by_severity,
    content_modified,
    final_content: content_modified ? fixed_content : undefined,
    ran_at: new Date().toISOString(),
    total_tokens,
    duration_ms: Date.now() - startedAt,
  }
}

/**
 * Helper: calculate total cost of a compliance result based on models used.
 */
export function calculateResultCost(result: ComplianceResult): number {
  let total = 0
  for (const r of result.rule_results) {
    if (r.model_used && r.tokens_used) {
      total += calculateCost(r.model_used, r.tokens_used)
    }
  }
  return total
}
