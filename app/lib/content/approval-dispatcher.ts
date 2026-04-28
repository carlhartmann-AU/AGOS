import type { ContentQueueItem } from '@/types'

export class ApprovalActionError extends Error {
  public detail?: string
  public status?: number
  constructor(message: string, detail?: string, status?: number) {
    super(message)
    this.name = 'ApprovalActionError'
    this.detail = detail
    this.status = status
  }
}

async function postJson(url: string, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({})) as Record<string, unknown>
    throw new ApprovalActionError(
      (errBody.error as string) ?? `Request failed (${res.status})`,
      errBody.detail as string | undefined,
      res.status,
    )
  }
  return res.json()
}

export async function approve(item: ContentQueueItem) {
  return postJson('/api/web-designer/approve', {
    id: item.id,
    action: 'draft',
    brand_id: item.brand_id,
  })
}

export async function goLive(item: ContentQueueItem) {
  return postJson('/api/web-designer/approve', {
    id: item.id,
    action: 'go_live',
    brand_id: item.brand_id,
  })
}

export async function confirmPublish(item: ContentQueueItem) {
  return postJson('/api/content/publish', {
    content_id: item.id,
  })
}

export async function reject(item: ContentQueueItem) {
  return postJson('/api/web-designer/approve', {
    id: item.id,
    action: 'reject',
    brand_id: item.brand_id,
  })
}

export async function pullBack(item: ContentQueueItem) {
  return postJson('/api/web-designer/approve', {
    id: item.id,
    action: 'pull_back',
    brand_id: item.brand_id,
  })
}
