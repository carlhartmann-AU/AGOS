import { PageHeader } from '@/components/PageHeader'

export default function ContentApprovalsPage() {
  return (
    <div className="p-6">
      <PageHeader
        title="Content Approvals"
        description="Review and approve content before it publishes."
      />

      <div className="mt-6 bg-white rounded-lg border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Pending approval</span>
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">0</span>
        </div>
        <div className="px-5 py-10 text-center text-sm text-gray-400">
          No content awaiting approval — Phase 2
        </div>
      </div>
    </div>
  )
}
