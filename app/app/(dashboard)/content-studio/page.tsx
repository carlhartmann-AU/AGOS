import { ContentStudio } from '@/components/ContentStudio'

export default function ContentStudioPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Content Studio</h1>
        <p className="text-sm text-gray-500 mt-1">
          Generate brand-compliant content for Plasmaide — blog articles, landing pages, emails, and social captions.
        </p>
      </div>
      <ContentStudio />
    </div>
  )
}
