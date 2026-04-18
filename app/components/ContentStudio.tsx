'use client'

import { useCallback, useRef, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type ContentType = 'blog' | 'landing_page' | 'email' | 'social_caption'

type Template = {
  id: string
  label: string
  topic: string
  keywords: string
  context: string
}

type UploadedImage = {
  name: string
  base64: string
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp'
  preview: string
  sizeKb: number
}

// ─── Template definitions ─────────────────────────────────────────────────────

const TEMPLATES: Record<ContentType, Template[]> = {
  blog: [
    {
      id: 'science-explainer',
      label: 'Science explainer',
      topic: 'How Pine Bark Extract supports nitric oxide production and blood flow',
      keywords: 'pine bark extract, nitric oxide, blood flow, pycnogenol',
      context: 'Include references to peer-reviewed studies. Explain the mechanism clearly for a wellness-curious audience. Aim for 1000 words.',
    },
    {
      id: 'athlete-spotlight',
      label: 'Athlete spotlight',
      topic: 'How elite athletes use Pine Bark Extract for training and recovery',
      keywords: 'athlete recovery, pine bark extract, endurance, performance supplement',
      context: 'Use first-person athlete voice. Highlight recovery benefits. Mention Informed Sport certification.',
    },
    {
      id: 'product-deep-dive',
      label: 'Product deep dive',
      topic: 'Everything you need to know about Plasmaide Pine Bark Extract',
      keywords: 'plasmaide, pine bark extract supplement, what is pycnogenol, pine bark dosage',
      context: 'Cover what it is, how it works, who it\'s for, and how to use it. Answer the top 5 questions customers ask.',
    },
    {
      id: 'myth-busting',
      label: 'Myth busting',
      topic: '5 myths about Pine Bark Extract (and what the science actually says)',
      keywords: 'pine bark extract myths, supplement facts, antioxidants, pycnogenol research',
      context: 'Debunk common misconceptions with evidence. Use a bold "MYTH" / "FACT" structure for scanability.',
    },
    {
      id: 'how-to-guide',
      label: 'How-to guide',
      topic: 'How to use Pine Bark Extract for optimal recovery and performance',
      keywords: 'pine bark extract dosage, how to take pine bark, recovery supplement guide',
      context: 'Practical, actionable. Cover timing, dosage, stacking considerations, and what to expect.',
    },
  ],
  email: [
    {
      id: 'welcome',
      label: 'Welcome series',
      topic: 'Welcome to Plasmaide — your Pine Bark Extract journey starts here',
      keywords: 'welcome, pine bark extract, plasmaide, getting started',
      context: 'This is step 1 of the welcome series. Warm, encouraging tone. Introduce the brand story and key benefits. CTA: Shop now.',
    },
    {
      id: 'product-launch',
      label: 'Product launch',
      topic: 'Introducing our latest Plasmaide formula — engineered for peak performance',
      keywords: 'product launch, new supplement, plasmaide, pine bark extract',
      context: 'Build anticipation. Lead with the problem this solves, then reveal the product. Include an early access or launch offer.',
    },
    {
      id: 'educational',
      label: 'Educational newsletter',
      topic: 'The science behind Pine Bark Extract and how it works in your body',
      keywords: 'pine bark extract science, nitric oxide, antioxidants, educational',
      context: 'One key insight per email. No hard sell. End with a soft link to the product. Aim for 300-400 words.',
    },
    {
      id: 're-engagement',
      label: 'Re-engagement',
      topic: 'We\'ve missed you — here\'s what\'s new at Plasmaide',
      keywords: 're-engagement, winback, plasmaide update, new products',
      context: 'Acknowledge the gap without guilt-tripping. Lead with value (what\'s new / what they\'ve missed). Include an incentive.',
    },
    {
      id: 'post-purchase',
      label: 'Post-purchase',
      topic: 'Your Plasmaide order is confirmed — here\'s how to get the most from it',
      keywords: 'post-purchase, onboarding, how to use, dosage guide',
      context: 'Sent after first purchase. Practical onboarding. Set expectations for results timeline. Reduce buyer\'s remorse.',
    },
  ],
  landing_page: [
    {
      id: 'campaign',
      label: 'Campaign landing',
      topic: 'Peak performance season — fuel your training with Pine Bark Extract',
      keywords: 'performance supplement, endurance training, pine bark extract, plasmaide',
      context: 'Seasonal campaign page. Clear hero with a countdown or seasonal hook. Urgency-driven CTA. Highlight Informed Sport certification.',
    },
    {
      id: 'product-feature',
      label: 'Product feature',
      topic: 'Plasmaide Pine Bark Extract — the complete performance supplement',
      keywords: 'pine bark extract, supplement features, plasmaide benefits, pycnogenol capsules',
      context: 'Core product page supplement to PDP. Cover every angle: ingredients, certifications, who it\'s for, how it works. Include FAQ section.',
    },
    {
      id: 'athlete-endorsement',
      label: 'Athlete endorsement',
      topic: 'Trusted by elite athletes — why professionals choose Plasmaide',
      keywords: 'athlete endorsed, trusted by athletes, elite sport supplement, informed sport',
      context: 'Social proof-heavy. Lead with athlete testimonials (use placeholders). Multiple trust signals. Clean, premium aesthetic.',
    },
  ],
  social_caption: [
    {
      id: 'product-shot',
      label: 'Product shot caption',
      topic: 'Hero product shot caption for Plasmaide Pine Bark Extract capsules',
      keywords: 'plasmaide, pine bark extract, performance supplement, clean label',
      context: 'Clean, minimal caption to accompany a product flat-lay. Let the visual do the work. 80-120 chars.',
    },
    {
      id: 'science-fact',
      label: 'Science fact',
      topic: 'Shareable fact about Pine Bark Extract and nitric oxide production',
      keywords: 'science, nitric oxide, pine bark extract, sports science',
      context: 'Educational carousel or single-image post. Start with a hook stat or question. End with a subtle brand tie-in.',
    },
    {
      id: 'testimonial',
      label: 'User testimonial',
      topic: 'Customer result story — athlete using Plasmaide for recovery',
      keywords: 'testimonial, results, plasmaide review, customer story',
      context: 'Use a first-person voice for the testimonial. Keep it authentic. Include image brief for a real-looking photo.',
    },
    {
      id: 'behind-scenes',
      label: 'Behind the scenes',
      topic: 'Behind the scenes at Plasmaide — formulation and quality testing',
      keywords: 'behind the scenes, brand story, quality testing, supplement manufacturing',
      context: 'Humanise the brand. Show process or team. Approachable, curious tone.',
    },
  ],
}

// ─── Content type cards ───────────────────────────────────────────────────────

const CONTENT_TYPES: { id: ContentType; label: string; description: string; icon: string }[] = [
  { id: 'blog', label: 'Blog article', description: 'SEO-optimised articles for Shopify blog', icon: '✍️' },
  { id: 'landing_page', label: 'Landing page', description: 'Campaign pages with inline HTML/CSS', icon: '🖥' },
  { id: 'email', label: 'Email', description: 'DotDigital-ready HTML email campaigns', icon: '✉️' },
  { id: 'social_caption', label: 'Social caption', description: 'Instagram / LinkedIn captions + image briefs', icon: '📸' },
]

// ─── Image upload helpers ─────────────────────────────────────────────────────

const ACCEPTED_TYPES: Record<string, 'image/jpeg' | 'image/png' | 'image/webp'> = {
  'image/jpeg': 'image/jpeg',
  'image/png': 'image/png',
  'image/webp': 'image/webp',
}

function fileToUploadedImage(file: File): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    const mediaType = ACCEPTED_TYPES[file.type]
    if (!mediaType) {
      reject(new Error(`Unsupported file type: ${file.type}. Use JPG, PNG, or WebP.`))
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // result is "data:image/jpeg;base64,<data>" — strip the prefix
      const base64 = result.split(',')[1]
      resolve({
        name: file.name,
        base64,
        mediaType,
        preview: URL.createObjectURL(file),
        sizeKb: Math.round(file.size / 1024),
      })
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

// ─── ImageUploadArea ──────────────────────────────────────────────────────────

function ImageUploadArea({
  images,
  onAdd,
  onRemove,
  disabled,
}: {
  images: UploadedImage[]
  onAdd: (imgs: UploadedImage[]) => void
  onRemove: (index: number) => void
  disabled?: boolean
}) {
  const [dragging, setDragging] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function processFiles(files: FileList | null) {
    if (!files?.length) return
    setUploadError(null)
    const newImages: UploadedImage[] = []
    for (const file of Array.from(files)) {
      try {
        const img = await fileToUploadedImage(file)
        newImages.push(img)
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : 'Upload failed')
        return
      }
    }
    onAdd(newImages)
  }

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      if (!disabled) processFiles(e.dataTransfer.files)
    },
    [disabled]
  )

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-gray-700">
        Reference images <span className="text-gray-400 font-normal">(optional — brand assets, competitor screenshots, mood board)</span>
      </label>

      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg px-4 py-5 text-center cursor-pointer transition-colors
          ${dragging ? 'border-gray-500 bg-gray-50' : 'border-gray-200 hover:border-gray-400'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <p className="text-xs text-gray-500">
          Drag & drop images here, or <span className="text-gray-900 font-medium">click to browse</span>
        </p>
        <p className="text-xs text-gray-400 mt-0.5">JPG, PNG, WebP · Max 4 MB each</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          disabled={disabled}
          onChange={(e) => processFiles(e.target.files)}
        />
      </div>

      {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}

      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-1">
          {images.map((img, i) => (
            <div key={i} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.preview}
                alt={img.name}
                className="w-16 h-16 object-cover rounded border border-gray-200"
              />
              <button
                onClick={() => onRemove(i)}
                disabled={disabled}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gray-900 text-white text-xs rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
              <p className="text-xs text-gray-400 text-center mt-0.5 max-w-16 truncate">{img.sizeKb}KB</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ContentStudio() {
  const [contentType, setContentType] = useState<ContentType>('blog')
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [topic, setTopic] = useState('')
  const [keywords, setKeywords] = useState('')
  const [additionalContext, setAdditionalContext] = useState('')
  const [images, setImages] = useState<UploadedImage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successId, setSuccessId] = useState<string | null>(null)

  function applyTemplate(templateId: string) {
    setSelectedTemplate(templateId)
    if (!templateId) return
    const tpl = TEMPLATES[contentType].find((t) => t.id === templateId)
    if (!tpl) return
    setTopic(tpl.topic)
    setKeywords(tpl.keywords)
    setAdditionalContext(tpl.context)
  }

  function switchContentType(type: ContentType) {
    setContentType(type)
    setSelectedTemplate('')
    setTopic('')
    setKeywords('')
    setAdditionalContext('')
    setImages([])
    setError(null)
    setSuccessId(null)
  }

  function addImages(newImgs: UploadedImage[]) {
    setImages((prev) => [...prev, ...newImgs])
  }

  function removeImage(index: number) {
    setImages((prev) => {
      const next = [...prev]
      URL.revokeObjectURL(next[index].preview)
      next.splice(index, 1)
      return next
    })
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!topic.trim() || loading) return
    setLoading(true)
    setError(null)
    setSuccessId(null)

    try {
      const target_keywords = keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean)

      const res = await fetch('/api/content/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: topic.trim(),
          target_keywords,
          content_type: contentType,
          additional_context: additionalContext.trim() || undefined,
          images: images.map(({ name, base64, mediaType }) => ({ name, base64, mediaType })),
        }),
      })

      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? `Request failed: ${res.status}`)

      setSuccessId(body.id)
      // Reset form
      setTopic('')
      setKeywords('')
      setAdditionalContext('')
      setSelectedTemplate('')
      setImages((prev) => {
        prev.forEach((img) => URL.revokeObjectURL(img.preview))
        return []
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setLoading(false)
    }
  }

  const templates = TEMPLATES[contentType]

  return (
    <div className="max-w-2xl space-y-6">
      {/* Content type selector */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Content type</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CONTENT_TYPES.map((ct) => (
            <button
              key={ct.id}
              onClick={() => switchContentType(ct.id)}
              className={`flex flex-col gap-1 p-3 rounded-lg border text-left transition-colors
                ${contentType === ct.id
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                }`}
            >
              <span className="text-lg">{ct.icon}</span>
              <span className="text-xs font-semibold">{ct.label}</span>
              <span className={`text-xs leading-tight ${contentType === ct.id ? 'text-gray-300' : 'text-gray-400'}`}>
                {ct.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Generation form */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <form onSubmit={handleGenerate} className="space-y-4">
          {/* Template selector */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Start from template <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <select
              value={selectedTemplate}
              onChange={(e) => applyTemplate(e.target.value)}
              disabled={loading}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:opacity-50 bg-white"
            >
              <option value="">— Choose a template —</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.label}
                </option>
              ))}
            </select>
            {selectedTemplate && (
              <p className="text-xs text-gray-400 mt-1">
                Template applied — fields pre-filled and editable.
              </p>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-gray-100" />

          {/* Topic */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Topic <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={loading}
              placeholder={contentType === 'email' ? 'e.g. Welcome series — step 1' : 'e.g. Pine Bark Extract and endurance training'}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:opacity-50"
            />
          </div>

          {/* Keywords */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Target keywords <span className="text-gray-400 font-normal">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              disabled={loading}
              placeholder="e.g. pine bark extract, nitric oxide, endurance"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:opacity-50"
            />
          </div>

          {/* Additional context */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Additional context <span className="text-gray-400 font-normal">(optional — extra instructions for Claude)</span>
            </label>
            <textarea
              value={additionalContext}
              onChange={(e) => setAdditionalContext(e.target.value)}
              disabled={loading}
              rows={3}
              placeholder="e.g. Focus on the Australian market. Mention Informed Sport certification prominently. Include a comparison to beetroot juice."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:opacity-50 resize-y"
            />
          </div>

          {/* Image upload */}
          <ImageUploadArea
            images={images}
            onAdd={addImages}
            onRemove={removeImage}
            disabled={loading}
          />

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Success */}
          {successId && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700">
              Content generated and added to the approval queue.{' '}
              <a href="/approvals/web-designer" className="font-medium underline">
                Review it now →
              </a>
            </div>
          )}

          {/* Submit */}
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={loading || !topic.trim()}
              className="px-5 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {loading ? (
                <>
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating…
                </>
              ) : (
                'Generate'
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Info callout */}
      <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
        <p className="text-xs text-blue-700">
          <span className="font-semibold">How it works:</span> Claude generates content using the Web Designer agent prompt and Plasmaide brand rules. The result is added to the <strong>Pending Review</strong> queue — nothing publishes without approval.
        </p>
      </div>
    </div>
  )
}
