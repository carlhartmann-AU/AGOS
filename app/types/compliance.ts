// types/compliance.ts
// Core type definitions for the Compliance Agent

export type Severity = 'minor' | 'major' | 'critical'
export type SeverityAction = 'auto_fix' | 'escalate' | 'block'
export type ModelTier = 'fast' | 'accurate' | 'premium'

// Rule types supported by the engine
export type RuleType =
  | 'forbidden_terms'   // Deterministic keyword/regex match
  | 'required_text'     // Must contain pattern
  | 'length_check'      // Character/word limits
  | 'llm_check'         // Natural language rule via LLM
  | 'tone_check'        // Brand voice alignment via LLM

// Base rule — all rules share these fields
interface BaseRule {
  id: string
  name: string
  description?: string
  severity: Severity
  enabled?: boolean
  action?: SeverityAction // Overrides severity_actions map if set
}

export interface ForbiddenTermsRule extends BaseRule {
  type: 'forbidden_terms'
  terms: string[]
  case_sensitive?: boolean
  whole_word?: boolean
}

export interface RequiredTextRule extends BaseRule {
  type: 'required_text'
  pattern: string // Regex pattern
  flags?: string  // Regex flags, default 'i'
  fix_template?: string // If action=auto_fix, append this. Use {content} placeholder.
}

export interface LengthCheckRule extends BaseRule {
  type: 'length_check'
  target: 'body' | 'title' | 'meta_description' | 'summary'
  min?: number
  max: number
  unit: 'chars' | 'words'
  content_types?: string[] // If set, rule only runs for these content types
}

export interface LLMCheckRule extends BaseRule {
  type: 'llm_check'
  prompt: string // What to ask the LLM
  model_tier?: ModelTier
  // LLM returns { passed: boolean, explanation: string, suggested_fix?: string }
}

export interface ToneCheckRule extends BaseRule {
  type: 'tone_check'
  model_tier?: ModelTier
  // Uses brand_settings.brand_profile as reference
}

export type ComplianceRule =
  | ForbiddenTermsRule
  | RequiredTextRule
  | LengthCheckRule
  | LLMCheckRule
  | ToneCheckRule

// Per-brand compliance configuration (stored in brand_settings.compliance JSONB)
export interface ComplianceConfig {
  enabled: boolean
  rule_packs: string[]        // IDs of enabled pre-built packs
  custom_rules: ComplianceRule[]
  severity_actions: Record<Severity, SeverityAction>
  llm_config?: {
    fast: string              // e.g. 'claude-haiku-4-5'
    accurate: string          // e.g. 'claude-sonnet-4-6'
    premium: string           // e.g. 'claude-opus-4-7'
  }
}

// Rule pack definition (pre-built, shared across brands)
export interface RulePack {
  id: string
  name: string
  description: string
  jurisdiction?: string       // e.g. 'AU', 'US', 'EU', 'global'
  category: string            // e.g. 'health_supplements', 'alcohol', 'financial'
  rules: ComplianceRule[]
}

// Result of evaluating a single rule
export interface RuleResult {
  rule_id: string
  rule_name: string
  severity: Severity
  passed: boolean
  matches?: string[]          // What triggered the rule (e.g. forbidden terms found)
  explanation: string         // Human-readable reason
  suggested_fix?: string      // Optional LLM-generated fix
  auto_fixed?: boolean        // Was this auto-fixed?
  fixed_content?: string      // The fixed content if auto_fixed
  model_used?: string         // For LLM rules, which model ran it
  tokens_used?: { input: number; output: number }
}

// Final verdict from running all rules
export interface ComplianceResult {
  content_id: string
  brand_id: string
  overall_status: 'passed' | 'warnings' | 'escalated' | 'blocked'
  rule_results: RuleResult[]
  auto_fixes_applied: number
  issues_by_severity: Record<Severity, number>
  content_modified: boolean
  final_content?: ContentItem  // If auto-fixes were applied
  ran_at: string
  total_tokens: { input: number; output: number }
  duration_ms: number
}

// The content shape being evaluated (maps to content_queue.content JSONB)
export interface ContentItem {
  title?: string
  handle?: string
  body_html?: string
  summary_html?: string
  meta_title?: string
  meta_description?: string
  tags?: string[]
  // ... other fields from content_queue JSONB
  [key: string]: unknown
}

// What the API route receives
export interface ComplianceCheckRequest {
  content_id: string
  // Optional: force re-check even if already checked
  force?: boolean
}

// What the API route returns
export interface ComplianceCheckResponse {
  success: boolean
  result?: ComplianceResult
  error?: string
}
