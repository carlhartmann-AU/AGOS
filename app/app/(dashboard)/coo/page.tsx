'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useBrand } from '@/context/BrandContext'
import { PageHeader } from '@/components/PageHeader'
import type { COOMessage, COOConversation, COOCard } from '@/lib/agents/coo/types'

// ─── Card renderers ───────────────────────────────────────────────────────────

function KpiTile({ card }: { card: Extract<COOCard, { type: 'kpi_tile' }> }) {
  const color = card.status === 'up' ? '#0f8a5f' : card.status === 'down' ? '#c02525' : '#5c677d'
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '12px 16px', background: 'var(--panel)', minWidth: 120 }}>
      <div style={{ fontSize: 11, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>{card.label}</div>
      <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{card.value}</div>
      {card.delta && <div style={{ fontSize: 11, color, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{card.delta}</div>}
    </div>
  )
}

function AlertCard({ card }: { card: Extract<COOCard, { type: 'alert_card' }> }) {
  const colors: Record<string, { bg: string; border: string; text: string; dot: string }> = {
    critical: { bg: '#fbe2e2', border: '#f0b0b0', text: '#c02525', dot: '#c02525' },
    warning:  { bg: '#fbf0de', border: '#e8c87a', text: '#b8741a', dot: '#b8741a' },
    info:     { bg: '#eaf1ff', border: '#c9dbff', text: '#2f6feb', dot: '#2f6feb' },
  }
  const c = colors[card.severity] ?? colors.info
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8, padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.dot, marginTop: 4, flexShrink: 0 }} />
      <div>
        <div style={{ fontWeight: 500, fontSize: 13, color: c.text }}>{card.title}</div>
        <div style={{ fontSize: 12, color: '#5c677d', marginTop: 2 }}>{card.description}</div>
      </div>
    </div>
  )
}

function StatusCard({ card }: { card: Extract<COOCard, { type: 'status_card' }> }) {
  const dot = card.status === 'healthy' ? '#0f8a5f' : card.status === 'warning' ? '#b8741a' : '#c02525'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 8 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{card.agent}</div>
        <div style={{ fontSize: 11, color: 'var(--ink-4)' }}>{card.summary}</div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-4)', whiteSpace: 'nowrap' }}>{card.last_run}</div>
    </div>
  )
}

function ActionResult({ card }: { card: Extract<COOCard, { type: 'action_result' }> }) {
  const ok = card.success
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: ok ? 'var(--ok-bg)' : 'var(--bad-bg)', border: `1px solid ${ok ? '#a7e3c4' : '#f0b0b0'}`, borderRadius: 8 }}>
      <span style={{ color: ok ? 'var(--ok)' : 'var(--bad)' }}>{ok ? '✓' : '✕'}</span>
      <div style={{ fontSize: 13 }}>
        <span style={{ fontWeight: 500 }}>{card.action}</span>
        <span style={{ color: 'var(--ink-3)', marginLeft: 8 }}>{card.message}</span>
      </div>
    </div>
  )
}

function TableCard({ card }: { card: Extract<COOCard, { type: 'table' }> }) {
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 8, overflow: 'hidden', fontSize: 12 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: 'var(--panel-2)' }}>
            {card.headers.map((h, i) => (
              <th key={i} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--ink-3)', borderBottom: '1px solid var(--line)', fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {card.rows.map((row, ri) => (
            <tr key={ri} style={{ borderBottom: '1px solid var(--line-2)' }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{ padding: '8px 12px', color: 'var(--ink-2)' }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CardsBlock({ cards }: { cards: COOCard[] }) {
  const kpis = cards.filter(c => c.type === 'kpi_tile') as Extract<COOCard, { type: 'kpi_tile' }>[]
  const alerts = cards.filter(c => c.type === 'alert_card') as Extract<COOCard, { type: 'alert_card' }>[]
  const statuses = cards.filter(c => c.type === 'status_card') as Extract<COOCard, { type: 'status_card' }>[]
  const actions = cards.filter(c => c.type === 'action_result') as Extract<COOCard, { type: 'action_result' }>[]
  const tables = cards.filter(c => c.type === 'table') as Extract<COOCard, { type: 'table' }>[]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
      {kpis.length > 0 && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {kpis.map((c, i) => <KpiTile key={i} card={c} />)}
        </div>
      )}
      {alerts.map((c, i) => <AlertCard key={i} card={c} />)}
      {statuses.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {statuses.map((c, i) => <StatusCard key={i} card={c} />)}
        </div>
      )}
      {actions.map((c, i) => <ActionResult key={i} card={c} />)}
      {tables.map((c, i) => <TableCard key={i} card={c} />)}
    </div>
  )
}

// ─── Message rendering ────────────────────────────────────────────────────────

function cleanContent(text: string): string {
  return text.replace(/<<<CARDS>>>[\s\S]*?<<<END_CARDS>>>/g, '').trim()
}

function MessageBubble({ msg }: { msg: COOMessage }) {
  const isUser = msg.role === 'user'
  const text = cleanContent(msg.content)
  const cards = msg.cards ?? []
  const cost = msg.cost_usd
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 16 }}>
      <div style={{ maxWidth: '80%', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{
          padding: '10px 14px',
          borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
          background: isUser ? '#0f1423' : 'var(--panel)',
          border: isUser ? 'none' : '1px solid var(--line)',
          color: isUser ? '#e8ecf7' : 'var(--ink)',
          fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {text}
        </div>
        {cards.length > 0 && <CardsBlock cards={cards} />}
        {cost != null && !isUser && (
          <div style={{ fontSize: 10, color: 'var(--ink-5)', fontFamily: 'monospace', paddingLeft: 4 }}>
            {msg.tokens_input}↑ {msg.tokens_output}↓ · ${cost.toFixed(4)}
          </div>
        )}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
      <div style={{ padding: '12px 16px', background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: '12px 12px 12px 4px', display: 'flex', gap: 4, alignItems: 'center' }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ink-4)', animation: `typing-dot 1.2s ease-in-out ${i * 0.2}s infinite`, display: 'inline-block' }} />
        ))}
      </div>
    </div>
  )
}

// ─── Voice modal ──────────────────────────────────────────────────────────────

function VoiceModal({ onClose }: { onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 32, maxWidth: 480, width: '100%', boxShadow: '0 24px 64px -12px rgba(0,0,0,.3)' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🎙️</div>
        <h2 style={{ fontSize: 20, fontWeight: 500, margin: '0 0 8px', letterSpacing: '-0.01em' }}>Voice interface — coming Q3 2026</h2>
        <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6, margin: '0 0 20px' }}>
          Imagine asking your COO questions by phone or from the dashboard — and getting a spoken response. Powered by <strong>ElevenLabs</strong> for natural AI speech and <strong>Twilio</strong> for phone access.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {['Phone call briefings', 'Dashboard voice mode', 'Spoken alerts', 'Hands-free approvals'].map(f => (
            <span key={f} style={{ fontSize: 12, padding: '3px 10px', background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent-line)', borderRadius: 20 }}>{f}</span>
          ))}
        </div>
        <button onClick={onClose} style={{ padding: '8px 20px', background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
          Got it
        </button>
      </div>
    </div>
  )
}

// ─── Suggested prompts ────────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  "What's our revenue this week?",
  'Any alerts I should know about?',
  'Show me the content queue',
  'Run a financial analysis',
  "What's the status of all agents?",
]

// ─── Main page ────────────────────────────────────────────────────────────────

export default function COOPage() {
  const { activeBrand } = useBrand()
  const brandId = activeBrand?.brand_id ?? 'plasmaide'

  const [conversations, setConversations] = useState<COOConversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<COOMessage[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [streamingCards, setStreamingCards] = useState<COOCard[]>([])
  const [voiceModal, setVoiceModal] = useState(false)
  const [convLoading, setConvLoading] = useState(true)
  const [msgLoading, setMsgLoading] = useState(false)
  const [cooEnabled, setCooEnabled] = useState<boolean | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const skipNextMsgFetch = useRef(false)

  useEffect(() => {
    setCooEnabled(null)
    fetch(`/api/agent-config?brand_id=${brandId}`)
      .then(r => r.json())
      .then(data => {
        const coo = (data.agents ?? []).find((a: { agent_key: string; enabled: boolean }) => a.agent_key === 'coo')
        setCooEnabled(coo ? coo.enabled : true)
      })
      .catch(() => setCooEnabled(true))
  }, [brandId])

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch(`/api/coo/conversations?brand_id=${brandId}&limit=30`)
      if (res.ok) {
        const data = await res.json()
        setConversations(data.conversations ?? [])
      }
    } finally {
      setConvLoading(false)
    }
  }, [brandId])

  useEffect(() => { loadConversations() }, [loadConversations])

  useEffect(() => {
    if (!activeConvId) { setMessages([]); return }
    if (skipNextMsgFetch.current) { skipNextMsgFetch.current = false; return }
    setMsgLoading(true)
    fetch(`/api/coo/conversations/${activeConvId}/messages?limit=50`)
      .then(r => r.json())
      .then(data => setMessages(data.messages ?? []))
      .catch(() => {})
      .finally(() => setMsgLoading(false))
  }, [activeConvId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingText])

  async function selectConversation(id: string) {
    setActiveConvId(id)
  }

  async function newConversation() {
    setActiveConvId(null)
    setMessages([])
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Delete this conversation?')) return
    await fetch('/api/coo/conversations', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: id }),
    })
    if (activeConvId === id) { setActiveConvId(null); setMessages([]) }
    setConversations(cs => cs.filter(c => c.id !== id))
  }

  async function sendMessage(text: string) {
    if (!text.trim() || streaming) return
    setInput('')
    setStreaming(true)
    setStreamingText('')
    setStreamingCards([])

    const tempId = 'temp-user-' + Date.now()
    const tempUserMsg: COOMessage = {
      id: tempId,
      conversation_id: activeConvId ?? '',
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempUserMsg])

    try {
      const res = await fetch('/api/coo/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: brandId, conversation_id: activeConvId, message: text }),
      })
      if (!res.body) throw new Error('No stream')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let convId = activeConvId
      let fullText = ''
      let finalCards: COOCard[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          try {
            const chunk = JSON.parse(line)
            if (chunk.type === 'meta' && chunk.conversation_id) {
              convId = chunk.conversation_id
            } else if (chunk.type === 'text') {
              fullText += chunk.content ?? ''
              setStreamingText(fullText)
            } else if (chunk.type === 'done') {
              if (chunk.cards) { finalCards = chunk.cards; setStreamingCards(finalCards) }
            }
          } catch { /* skip */ }
        }
      }

      // Build messages from local streamed state — no DB fetch.
      // Fetching from DB races with the write and returns stale history on fast responses.
      const resolvedConvId = convId ?? activeConvId ?? ''
      const committedUserMsg: COOMessage = { ...tempUserMsg, id: 'u-' + Date.now(), conversation_id: resolvedConvId }
      const assistantMsg: COOMessage = {
        id: 'a-' + Date.now(),
        conversation_id: resolvedConvId,
        role: 'assistant',
        content: fullText,
        cards: finalCards.length > 0 ? finalCards : undefined,
        created_at: new Date().toISOString(),
      }

      // For new conversations: update activeConvId and suppress the useEffect fetch it triggers.
      if (convId && convId !== activeConvId) {
        skipNextMsgFetch.current = true
        setActiveConvId(convId)
      }

      // Replace temp user msg and append assistant msg — single batch render.
      setMessages(prev => [...prev.filter(m => m.id !== tempId), committedUserMsg, assistantMsg])

      // Refresh sidebar conversation list in the background (title, last_message_at).
      fetch(`/api/coo/conversations?brand_id=${brandId}&limit=30`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.conversations) setConversations(data.conversations) })
        .catch(() => {})

    } catch (err) {
      console.error('[coo]', err)
      setMessages(prev => [
        ...prev.filter(m => m.id !== tempId),
        { id: 'err-' + Date.now(), conversation_id: activeConvId ?? '', role: 'assistant', content: 'Something went wrong. Please try again.', created_at: new Date().toISOString() },
      ])
    } finally {
      setStreaming(false)
      setStreamingText('')
      setStreamingCards([])
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
  }

  function relativeTime(ts: string): string {
    const diff = Date.now() - new Date(ts).getTime()
    const m = Math.floor(diff / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24)
    if (d > 0) return `${d}d ago`
    if (h > 0) return `${h}h ago`
    if (m > 0) return `${m}m ago`
    return 'just now'
  }

  return (
    <>
      <style>{`
        @keyframes typing-dot {
          0%, 60%, 100% { opacity: .25; transform: scale(0.85); }
          30% { opacity: 1; transform: scale(1); }
        }
        @keyframes cursor-blink {
          0%, 100% { opacity: 1; } 50% { opacity: 0; }
        }
      `}</style>

      {voiceModal && <VoiceModal onClose={() => setVoiceModal(false)} />}

      <div className="page" style={{ display: 'flex', height: '100%', overflow: 'hidden', flexDirection: 'column', padding: '20px 24px 0' }}>
        <PageHeader title="COO Agent" description="Your digital chief operating officer" />

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Sidebar */}
          <aside style={{ width: 260, background: 'var(--panel)', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: '12px 10px', borderBottom: '1px solid var(--line-2)' }}>
              <button
                onClick={newConversation}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px dashed var(--line-3)', background: 'transparent', color: 'var(--ink-3)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <span style={{ fontSize: 14 }}>+</span> New conversation
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
              {convLoading ? (
                <div style={{ padding: '10px 8px', color: 'var(--ink-4)', fontSize: 12 }}>Loading…</div>
              ) : conversations.length === 0 ? (
                <div style={{ padding: '10px 8px', color: 'var(--ink-4)', fontSize: 12 }}>No conversations yet</div>
              ) : conversations.map(conv => (
                <div
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  style={{
                    padding: '8px 10px', borderRadius: 6, cursor: 'pointer', marginBottom: 2,
                    background: activeConvId === conv.id ? 'var(--accent-bg)' : 'transparent',
                    border: `1px solid ${activeConvId === conv.id ? 'var(--accent-line)' : 'transparent'}`,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: activeConvId === conv.id ? 'var(--accent)' : 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {conv.title ?? 'Untitled'}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--ink-4)', marginTop: 1 }}>{relativeTime(conv.last_message_at)}</div>
                  </div>
                  <button
                    onClick={e => deleteConversation(conv.id, e)}
                    style={{ padding: '1px 4px', background: 'none', border: 'none', color: 'var(--ink-5)', cursor: 'pointer', fontSize: 11, flexShrink: 0 }}
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </aside>

          {/* Main chat */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg)' }}>

            {/* Disabled banner */}
            {cooEnabled === false && (
              <div style={{ padding: '10px 20px', background: '#fbe2e2', borderBottom: '1px solid #f0b0b0', fontSize: 13, color: '#c02525', textAlign: 'center', flexShrink: 0 }}>
                COO Agent is currently disabled for this brand.
              </div>
            )}

            {/* Top bar */}
            <div style={{ padding: '10px 20px', background: 'var(--panel)', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: cooEnabled === false ? '#c02525' : '#0f8a5f', boxShadow: `0 0 0 2px ${cooEnabled === false ? 'rgba(192,37,37,.2)' : 'rgba(15,138,95,.2)'}`, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink-2)', flex: 1 }}>COO Agent</span>
              <span style={{ fontSize: 11, color: 'var(--ink-4)', fontFamily: 'monospace' }}>claude-sonnet-4-6</span>
              <button
                onClick={() => setVoiceModal(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', border: '1px solid var(--line-3)', borderRadius: 6, background: 'var(--panel-2)', fontSize: 11, color: 'var(--ink-3)', cursor: 'pointer' }}
              >
                🎙️ Voice — coming soon
              </button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
              {!activeConvId && messages.length === 0 && !streaming ? (
                <div style={{ maxWidth: 560, margin: '48px auto 0', textAlign: 'center' }}>
                  <div style={{ width: 52, height: 52, borderRadius: 13, background: 'linear-gradient(140deg,#2f6feb 0%,#0b1a3a 100%)', display: 'grid', placeItems: 'center', margin: '0 auto 18px', boxShadow: '0 8px 24px -6px rgba(47,111,235,.4)' }}>
                    <svg viewBox="0 0 24 24" width="26" height="26" fill="none">
                      <circle cx="12" cy="12" r="7.5" stroke="rgba(255,255,255,.4)" strokeWidth="0.8" strokeDasharray="1.5 2" />
                      {[0, 60, 120, 180, 240, 300].map((deg, i) => {
                        const rad = (deg - 90) * Math.PI / 180
                        return <circle key={i} cx={12 + 7.5 * Math.cos(rad)} cy={12 + 7.5 * Math.sin(rad)} r="1.1" fill="#b7ccff" />
                      })}
                      <circle cx="12" cy="12" r="3.2" fill="#fff" />
                      <circle cx="12" cy="12" r="1.3" fill="#2f6feb" />
                    </svg>
                  </div>
                  <h2 style={{ fontSize: 20, fontWeight: 500, margin: '0 0 8px', letterSpacing: '-0.02em' }}>Welcome to your COO</h2>
                  <p style={{ fontSize: 14, color: 'var(--ink-3)', lineHeight: 1.6, margin: '0 0 24px' }}>
                    I have full visibility across all AGOS agents. Ask me anything about your business.
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {SUGGESTED_PROMPTS.map(p => (
                      <button
                        key={p}
                        onClick={() => sendMessage(p)}
                        style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid var(--line-3)', background: 'var(--panel)', fontSize: 12, color: 'var(--ink-2)', cursor: 'pointer' }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {msgLoading ? (
                    <div style={{ textAlign: 'center', color: 'var(--ink-4)', fontSize: 13, padding: 40 }}>Loading…</div>
                  ) : (
                    messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)
                  )}
                  {streaming && (
                    streamingText ? (
                      <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 16 }}>
                        <div style={{ maxWidth: '80%' }}>
                          <div style={{ padding: '10px 14px', borderRadius: '12px 12px 12px 4px', background: 'var(--panel)', border: '1px solid var(--line)', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {cleanContent(streamingText)}
                            <span style={{ display: 'inline-block', width: 2, height: 14, background: 'var(--accent)', marginLeft: 2, animation: 'cursor-blink 1s ease-in-out infinite', verticalAlign: 'text-bottom' }} />
                          </div>
                          {streamingCards.length > 0 && <CardsBlock cards={streamingCards} />}
                        </div>
                      </div>
                    ) : <TypingIndicator />
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--line)', background: 'var(--panel)', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', maxWidth: 800, margin: '0 auto' }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={streaming || cooEnabled === false}
                  placeholder={cooEnabled === false ? 'COO Agent is disabled' : 'Ask your COO anything… (Enter to send, Shift+Enter for new line)'}
                  rows={1}
                  style={{ flex: 1, padding: '9px 12px', borderRadius: 7, border: '1px solid var(--line-3)', background: streaming || cooEnabled === false ? 'var(--panel-2)' : '#fff', fontSize: 13, lineHeight: 1.5, resize: 'none', outline: 'none', fontFamily: 'inherit', color: 'var(--ink)', maxHeight: 160, overflowY: 'auto' }}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={streaming || !input.trim() || cooEnabled === false}
                  style={{ padding: '9px 16px', borderRadius: 7, border: 'none', background: streaming || !input.trim() || cooEnabled === false ? 'var(--line)' : 'var(--accent)', color: streaming || !input.trim() || cooEnabled === false ? 'var(--ink-4)' : '#fff', fontSize: 13, fontWeight: 500, cursor: streaming || !input.trim() || cooEnabled === false ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', height: 40 }}
                >
                  {streaming ? 'Thinking…' : 'Send'}
                </button>
              </div>
              <div style={{ textAlign: 'center', marginTop: 6, fontSize: 10, color: 'var(--ink-5)', fontFamily: 'monospace' }}>
                ~$0.02–0.05 per message · No actions without your approval
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
