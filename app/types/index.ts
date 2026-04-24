// TypeScript types matching the Supabase schema

export type Brand = {
  brand_id: string
  name: string
  status: 'active' | 'paused' | 'archived'
  industry: string | null
  base_locale: string
  logo_url: string | null
  created_at: string
}

export type ContentType =
  | 'email' | 'blog' | 'social_caption' | 'ad'
  | 'landing_page' | 'b2b_email' | 'cs_response' | 'review_response'

export type ContentQueueStatus =
  | 'pending' | 'compliance_check' | 'compliance_fail'
  | 'escalated' | 'approved' | 'rejected'
  | 'publish_pending' | 'published' | 'failed'

export type ComplianceViolation = {
  check: string
  severity: 'critical' | 'warning'
  location: string
  original: string
  suggestion: string
  rule_reference: string
}

export type ComplianceResult = {
  content_id: string
  result: 'PASS' | 'FAIL' | 'ESCALATE'
  violations: ComplianceViolation[]
  escalation_reason?: string
}

export type ComplianceStatus = 'passed' | 'warnings' | 'escalated' | 'blocked' | 'pending' | 'skipped'

export type ContentQueueItem = {
  id: string
  brand_id: string
  content_type: ContentType
  status: ContentQueueStatus
  content: Record<string, unknown>
  compliance_result: ComplianceResult | null
  compliance_status: ComplianceStatus | null
  latest_compliance_check_id: string | null
  platform: string | null
  audience: string | null
  approved_by: string | null
  approved_at: string | null
  published_at: string | null
  created_at: string
  updated_at: string
}

export type FinancialActionType =
  | 'budget_reallocation' | 'xero_journal' | 'refund_approval'
  | 'invoice_update' | 'spend_pause' | 'spend_increase'

export type FinancialQueueStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'failed'

export type FinancialQueueItem = {
  id: string
  brand_id: string
  action_type: FinancialActionType
  status: FinancialQueueStatus
  details: Record<string, unknown>
  amount_aud: number | null
  requested_by: string
  approved_by: string | null
  approved_at: string | null
  executed_at: string | null
  created_at: string
}

export type AuditLogEntry = {
  id: string
  brand_id: string
  agent: string
  action: string
  tool_called: string | null
  input_summary: string | null
  output_summary: string | null
  tokens_in: number | null
  tokens_out: number | null
  latency_ms: number | null
  status: 'success' | 'failure' | 'escalated'
  error_message: string | null
  human_override: boolean
  created_at: string
}

export type AgentMemoryType =
  | 'campaign_outcome' | 'customer_segment' | 'brand_learning'
  | 'tone_preference' | 'compliance_pattern' | 'brand_voice_example'
  | 'product_knowledge' | 'financial_model' | 'cro_test_result'
  | 'outreach_pattern' | 'cs_resolution_pattern' | 'faq_knowledge'
  | 'review_sentiment' | 'market_research'

export type AgentMemory = {
  id: string
  brand_id: string
  agent: string
  memory_type: AgentMemoryType
  content: string
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export type BrandConfig = {
  id: string
  brand_id: string
  key: string
  value: string | null
  updated_at: string
}

export type BrandSettings = {
  min_roas: string
  max_cac: string
  spend_anomaly_pct: string
  report_day: string
  report_time: string
  report_timezone: string
  alert_email: string
  slack_channel: string
  coo_channel_slack: string
  coo_channel_artifact: string
  shopify_store: string
  email_platform: string
  shopify_markets: string
  base_locale: string
  cs_platform: string
  refund_threshold_aud: string
  b2b_daily_outreach_limit: string
}

export type AppEvent = {
  id: string
  brand_id: string
  event_type: string
  source: string
  payload: Record<string, unknown> | null
  created_at: string
}

// ─── Fiscal year config ───────────────────────────────────────────────────────

export type FYType = 'au' | 'us' | 'uk' | 'custom'

export type FYConfig = {
  type: FYType
  start_month: number
  start_day: number
  end_month: number
  end_day: number
}

// ─── New: brand_settings table ────────────────────────────────────────────────

export type Plan = 'starter' | 'growth' | 'scale' | 'enterprise'

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid'

export type ContentSchedule = {
  enabled: boolean
  frequency: 'daily' | 'weekdays' | 'weekly' | 'custom'
  time: string
  timezone: string
  content_types: ContentType[]
  topics_queue: string[]
  auto_approve: boolean
}

export type IntegrationsConfig = {
  shopify: { connected: boolean }  // OAuth token lives in shopify_connections table
  dotdigital: { connected: boolean; endpoint: string | null }
  gorgias: { connected: boolean }
  triple_whale: { connected: boolean }
  n8n_webhook_base: string | null
}

export type BrandSettingsRow = {
  id: string
  brand_id: string
  content_schedule: ContentSchedule
  llm_provider: string
  llm_model: string
  llm_api_key_encrypted: string | null
  integrations: IntegrationsConfig
  fy_config: FYConfig
  plan: Plan
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  subscription_status: SubscriptionStatus
  trial_ends_at: string | null
  generations_this_month: number
  generations_reset_at: string | null
  created_at: string
  updated_at: string
}

// ─── New: profiles table ──────────────────────────────────────────────────────

export type UserRole = 'admin' | 'approver' | 'viewer'

export type Profile = {
  id: string
  email: string
  full_name: string | null
  brand_id: string
  role: UserRole
  invited_by: string | null
  created_at: string
}
