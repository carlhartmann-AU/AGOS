import type { COOTool } from './types'

export const COO_TOOLS: COOTool[] = [
  {
    name: 'get_kpis',
    description: 'Get current KPI summary: revenue, orders, AOV, ad spend, ROAS from Triple Whale data. Accepts a date window.',
    input_schema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Number of days to look back. Default 7.' },
      },
    },
  },
  {
    name: 'get_financial_summary',
    description: 'Get financial overview: unit economics (CAC, LTV, LTV:CAC), budget vs actual, cash forecast. Returns the latest CFO report.',
    input_schema: {
      type: 'object',
      properties: {
        fiscal_year: { type: 'string', description: 'Fiscal year e.g. FY26. Defaults to current.' },
      },
    },
  },
  {
    name: 'get_intelligence_report',
    description: 'Get the latest Intelligence Agent report including trends, anomalies, and recommendations.',
    input_schema: {
      type: 'object',
      properties: {
        report_type: { type: 'string', description: 'intelligence or cfo. Default intelligence.' },
      },
    },
  },
  {
    name: 'get_compliance_status',
    description: 'Get recent compliance check results and any flagged content.',
    input_schema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Days to look back. Default 7.' },
        status: { type: 'string', description: 'Filter by status: pass, fail, warning. Optional.' },
      },
    },
  },
  {
    name: 'get_content_queue',
    description: 'Get content items from the content queue. Can filter by status.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter: draft, pending_review, approved, published, rejected. Optional.' },
        limit: { type: 'number', description: 'Max items to return. Default 10.' },
      },
    },
  },
  {
    name: 'get_alerts',
    description: 'Get active alerts and margin alerts from all agents.',
    input_schema: {
      type: 'object',
      properties: {
        severity: { type: 'string', description: 'Filter by severity: info, warning, critical. Optional.' },
      },
    },
  },
  {
    name: 'get_agent_status',
    description: 'Get operational status of all AGOS agents — last run time, health, recent errors.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'approve_content',
    description: 'Approve a content item in the content queue for publishing.',
    input_schema: {
      type: 'object',
      properties: {
        content_id: { type: 'string', description: 'The UUID of the content item to approve.' },
      },
      required: ['content_id'],
    },
  },
  {
    name: 'reject_content',
    description: 'Reject a content item with a reason.',
    input_schema: {
      type: 'object',
      properties: {
        content_id: { type: 'string', description: 'The UUID of the content item to reject.' },
        reason: { type: 'string', description: 'Reason for rejection.' },
      },
      required: ['content_id', 'reason'],
    },
  },
  {
    name: 'run_intelligence_report',
    description: 'Trigger a new Intelligence Agent report generation.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'run_cfo_report',
    description: 'Trigger a new CFO Agent financial analysis.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'run_compliance_check',
    description: 'Run a compliance check on specific content text.',
    input_schema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The content text to check for compliance.' },
      },
      required: ['content'],
    },
  },
  {
    name: 'get_b2b_pipeline',
    description: 'Get B2B prospect pipeline — scored prospects, statuses, and outreach history.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by status: new, contacted, qualified, rejected. Optional.' },
        limit: { type: 'number', description: 'Max prospects to return. Default 10.' },
      },
    },
  },
  {
    name: 'research_prospects',
    description: 'Trigger B2B Outreach Agent to score and rank existing prospects for outreach.',
    input_schema: {
      type: 'object',
      properties: {
        country: { type: 'string', description: 'Filter prospects by country. Optional.' },
        prospect_type: { type: 'string', description: 'e.g. retailer, distributor, gym_chain. Optional.' },
        count: { type: 'number', description: 'Max prospects to score. Default 5.' },
      },
    },
  },
  {
    name: 'draft_outreach',
    description: 'Generate AI outreach copy for a prospect (email or LinkedIn). Queued for approval before sending.',
    input_schema: {
      type: 'object',
      properties: {
        prospect_id: { type: 'string', description: 'UUID of the prospect.' },
        channel: { type: 'string', description: 'email or linkedin.' },
      },
      required: ['prospect_id', 'channel'],
    },
  },
  {
    name: 'get_cs_summary',
    description: 'Get Customer Service summary — open tickets, priority breakdown, recent escalations.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by status: open, in_progress, resolved. Optional.' },
        limit: { type: 'number', description: 'Max tickets to return. Default 10.' },
      },
    },
  },
  {
    name: 'handle_customer_inquiry',
    description: 'Submit a customer inquiry to the CS Agent for classification and draft response.',
    input_schema: {
      type: 'object',
      properties: {
        subject: { type: 'string', description: 'Inquiry subject.' },
        message: { type: 'string', description: 'Full customer message.' },
        customer_name: { type: 'string', description: 'Customer name. Optional.' },
        customer_email: { type: 'string', description: 'Customer email. Optional.' },
        channel: { type: 'string', description: 'email, chat, or social. Optional.' },
      },
      required: ['subject', 'message'],
    },
  },
  {
    name: 'get_review_summary',
    description: 'Get review digest — sentiment breakdown, top themes, best quotes, content ideas.',
    input_schema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Days to look back. Default 7.' },
      },
    },
  },
  {
    name: 'analyse_reviews',
    description: 'Submit new customer reviews for sentiment analysis and theme extraction.',
    input_schema: {
      type: 'object',
      properties: {
        reviews: {
          type: 'array',
          description: 'Array of review objects with source, rating, body (required), reviewer_name, title, review_date (optional).',
          items: {
            type: 'object',
            properties: {
              source: { type: 'string' },
              rating: { type: 'number' },
              body: { type: 'string' },
              reviewer_name: { type: 'string' },
              title: { type: 'string' },
              review_date: { type: 'string' },
            },
            required: ['source', 'rating', 'body'],
          },
        },
      },
      required: ['reviews'],
    },
  },
]

// Format tools for the Anthropic API
export function getAnthropicTools() {
  return COO_TOOLS.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }))
}
