import { ContentStudio } from '@/components/ContentStudio'

export default function ContentStudioPage() {
  return (
    <div className="page">
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title">Content Studio</h1>
        <p className="page-sub">
          Generate brand-compliant content for Plasmaide — blog articles, landing pages, emails, and social captions.
        </p>
      </div>
      <ContentStudio />
    </div>
  )
}
