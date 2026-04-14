import { PageHeader } from '@/components/PageHeader'

export default function FinancialApprovalsPage() {
  return (
    <div className="p-6">
      <PageHeader
        title="Financial Approvals"
        description="Review and approve financial actions before execution."
      />

      <div className="mt-6 bg-white rounded-lg border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Pending approval</span>
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">0</span>
        </div>
        <div className="px-5 py-10 text-center text-sm text-gray-400">
          No financial actions awaiting approval — Phase 5
        </div>
      </div>
    </div>
  )
}
