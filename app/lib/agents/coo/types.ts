export interface COOTool {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

export interface COOMessage {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  cards?: COOCard[] | null
  tool_calls?: unknown[] | null
  tokens_input?: number
  tokens_output?: number
  cost_usd?: number
  created_at: string
}

export interface COOConversation {
  id: string
  brand_id: string
  channel: 'web' | 'telegram'
  title: string | null
  telegram_chat_id?: number | null
  created_at: string
  last_message_at: string
}

export type COOCard =
  | { type: 'kpi_tile'; label: string; value: string; delta?: string; status?: 'up' | 'down' | 'neutral' }
  | { type: 'alert_card'; severity: 'info' | 'warning' | 'critical'; title: string; description: string }
  | { type: 'status_card'; agent: string; last_run: string; status: 'healthy' | 'warning' | 'error'; summary: string }
  | { type: 'action_result'; action: string; success: boolean; message: string }
  | { type: 'table'; headers: string[]; rows: string[][] }

export interface COOStreamChunk {
  type: 'text' | 'cards' | 'done' | 'error'
  content?: string
  cards?: COOCard[]
  usage?: { input: number; output: number; cost: number }
  error?: string
}
