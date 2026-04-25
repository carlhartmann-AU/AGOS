import { Suspense } from 'react'
import { ContentStudio } from '@/components/ContentStudio'

function ContentStudioSkeleton() {
  return (
    <div className="max-w-2xl space-y-6 animate-pulse">
      <div className="h-24 bg-gray-100 rounded-xl" />
      <div className="h-64 bg-gray-100 rounded-xl" />
    </div>
  )
}

export default function ContentStudioPage() {
  return (
    <div className="page">
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title">Content Studio</h1>
        <p className="page-sub">
          Generate brand-compliant content for Plasmaide — blog articles, landing pages, emails, and social captions.
        </p>
      </div>
      <Suspense fallback={<ContentStudioSkeleton />}>
        <ContentStudio />
      </Suspense>
    </div>
  )
}
