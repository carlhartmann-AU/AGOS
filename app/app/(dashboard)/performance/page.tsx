import { PageHeader } from '@/components/PageHeader'

export default function PerformancePage() {
  return (
    <div className="p-6">
      <PageHeader
        title="Performance"
        description="Campaign metrics, email analytics, CS stats, and agent health."
      />

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[
          { title: 'Campaign metrics', phase: 'Phase 3' },
          { title: 'Email metrics', phase: 'Phase 2' },
          { title: 'CS metrics', phase: 'Phase 3' },
          { title: 'Agent health', phase: 'Phase 4' },
        ].map(({ title, phase }) => (
          <div key={title} className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-sm font-medium text-gray-700 mb-3">{title}</h3>
            <p className="text-sm text-gray-400">No data yet — {phase}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
