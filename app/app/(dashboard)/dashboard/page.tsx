import { PageHeader } from '@/components/PageHeader'

export default function DashboardPage() {
  return (
    <div className="p-6">
      <PageHeader
        title="Dashboard"
        description="KPI overview, active campaigns, and alerts."
      />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {['ROAS', 'CAC', 'Revenue', 'Ad Spend'].map((label) => (
          <div
            key={label}
            className="bg-white rounded-lg border border-gray-200 p-5"
          >
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-gray-400">—</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Content queue</h3>
          <p className="text-sm text-gray-400">No data yet — Phase 2</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Active alerts</h3>
          <p className="text-sm text-gray-400">No alerts</p>
        </div>
      </div>
    </div>
  )
}
