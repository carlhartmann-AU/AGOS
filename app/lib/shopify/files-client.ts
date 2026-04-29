// Shopify Files API client — stagedUploadsCreate → binary POST → fileCreate → poll READY
// Uses the GraphQL Admin API (2026-04). Requires write_files scope.

import { shopifyGraphQL } from './client'

export class ShopifyFilesError extends Error {
  constructor(
    public stage: 'staged_upload_create' | 'binary_put' | 'file_create' | 'poll_ready',
    public errorCode: 'SHOPIFY_GRAPHQL_ERROR' | 'SHOPIFY_USER_ERROR' | 'NETWORK_ERROR' | 'TIMEOUT',
    message: string,
    public shopifyResponse?: unknown,
  ) {
    super(message)
    this.name = 'ShopifyFilesError'
  }
}

export interface UploadFileInput {
  shopDomain: string
  accessToken: string
  fileName: string
  mimeType: string
  fileSize: number
  body: Buffer
}

export interface UploadFileResult {
  fileId: string
  cdnUrl: string
  durationMs: number
  finalShopifyResponse: unknown
}

// ─── GraphQL documents ────────────────────────────────────────────────────────

const STAGED_UPLOADS_CREATE = `
  mutation StagedUploadsCreate($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters { name value }
      }
      userErrors { field message }
    }
  }
`

const FILE_CREATE = `
  mutation FileCreate($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files {
        id
        fileStatus
        ... on MediaImage {
          image { url }
        }
      }
      userErrors { field message }
    }
  }
`

const FILE_STATUS_QUERY = `
  query FileStatus($id: ID!) {
    node(id: $id) {
      ... on MediaImage {
        id
        fileStatus
        image { url }
      }
    }
  }
`

// ─── Types ────────────────────────────────────────────────────────────────────

type StagedTarget = {
  url: string
  resourceUrl: string
  parameters: Array<{ name: string; value: string }>
}

type UserError = { field: string[]; message: string }

type FileNode = {
  id: string
  fileStatus: string
  image?: { url: string } | null
}

// ─── uploadFile ───────────────────────────────────────────────────────────────

export async function uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
  const startTime = Date.now()

  // Step 1 — stagedUploadsCreate
  const stageResult = await shopifyGraphQL<{
    stagedUploadsCreate: {
      stagedTargets: StagedTarget[]
      userErrors: UserError[]
    }
  }>(input.shopDomain, input.accessToken, STAGED_UPLOADS_CREATE, {
    input: [{
      filename: input.fileName,
      mimeType: input.mimeType,
      httpMethod: 'POST',
      resource: 'FILE',
      fileSize: String(input.fileSize),
    }],
  })

  if (stageResult.errors && stageResult.errors.length > 0) {
    throw new ShopifyFilesError(
      'staged_upload_create',
      'SHOPIFY_GRAPHQL_ERROR',
      stageResult.errors[0].message,
      stageResult,
    )
  }

  const stageUserErrors = stageResult.data?.stagedUploadsCreate?.userErrors ?? []
  if (stageUserErrors.length > 0) {
    throw new ShopifyFilesError(
      'staged_upload_create',
      'SHOPIFY_USER_ERROR',
      stageUserErrors[0].message,
      stageResult,
    )
  }

  const stagedTarget = stageResult.data?.stagedUploadsCreate?.stagedTargets?.[0]
  if (!stagedTarget) {
    throw new ShopifyFilesError(
      'staged_upload_create',
      'SHOPIFY_USER_ERROR',
      'No staged upload target returned',
      stageResult,
    )
  }

  // Step 2 — Binary POST to staging URL
  // Shopify staged uploads use POST + multipart/form-data (S3-compatible).
  // Parameters from stagedTarget must precede the file field per S3 spec.
  const form = new FormData()
  for (const { name, value } of stagedTarget.parameters) {
    form.append(name, value)
  }
  form.append('file', new Blob([new Uint8Array(input.body)], { type: input.mimeType }), input.fileName)

  let putRes: Response
  try {
    putRes = await fetch(stagedTarget.url, {
      method: 'POST',
      body: form,
    })
  } catch (err) {
    throw new ShopifyFilesError(
      'binary_put',
      'NETWORK_ERROR',
      err instanceof Error ? err.message : 'Binary upload fetch failed',
    )
  }

  if (!putRes.ok) {
    const bodyText = await putRes.text().catch(() => '')
    throw new ShopifyFilesError(
      'binary_put',
      'NETWORK_ERROR',
      `Binary upload failed: HTTP ${putRes.status}`,
      { status: putRes.status, body: bodyText.slice(0, 500) },
    )
  }

  // Step 3 — fileCreate
  const createResult = await shopifyGraphQL<{
    fileCreate: {
      files: FileNode[]
      userErrors: UserError[]
    }
  }>(input.shopDomain, input.accessToken, FILE_CREATE, {
    files: [{
      originalSource: stagedTarget.resourceUrl,
      contentType: 'IMAGE',
      alt: input.fileName,
    }],
  })

  if (createResult.errors && createResult.errors.length > 0) {
    throw new ShopifyFilesError(
      'file_create',
      'SHOPIFY_GRAPHQL_ERROR',
      createResult.errors[0].message,
      createResult,
    )
  }

  const createUserErrors = createResult.data?.fileCreate?.userErrors ?? []
  if (createUserErrors.length > 0) {
    throw new ShopifyFilesError(
      'file_create',
      'SHOPIFY_USER_ERROR',
      createUserErrors[0].message,
      createResult,
    )
  }

  const createdFile = createResult.data?.fileCreate?.files?.[0]
  if (!createdFile) {
    throw new ShopifyFilesError(
      'file_create',
      'SHOPIFY_USER_ERROR',
      'fileCreate returned no file',
      createResult,
    )
  }

  // Step 4 — Poll until READY
  const TIMEOUT_MS = 10_000
  const POLL_INTERVAL_MS = 500
  const fileId = createdFile.id
  const pollStart = Date.now()
  let lastResponse: FileNode = createdFile

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (lastResponse.fileStatus === 'READY' && lastResponse.image?.url) {
      return {
        fileId,
        cdnUrl: lastResponse.image.url,
        durationMs: Date.now() - startTime,
        finalShopifyResponse: lastResponse,
      }
    }
    if (lastResponse.fileStatus === 'FAILED') {
      throw new ShopifyFilesError(
        'poll_ready',
        'SHOPIFY_USER_ERROR',
        'File processing failed on Shopify side',
        lastResponse,
      )
    }
    if (Date.now() - pollStart > TIMEOUT_MS) {
      throw new ShopifyFilesError(
        'poll_ready',
        'TIMEOUT',
        `File not READY within ${TIMEOUT_MS}ms`,
        lastResponse,
      )
    }

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS))

    const pollResult = await shopifyGraphQL<{
      node: FileNode | null
    }>(input.shopDomain, input.accessToken, FILE_STATUS_QUERY, { id: fileId })

    lastResponse = pollResult.data?.node ?? lastResponse
  }
}
