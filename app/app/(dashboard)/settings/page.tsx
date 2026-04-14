import { PageHeader } from '@/components/PageHeader'

const SETTING_SECTIONS = [
  { title: 'Brand profile', description: 'Name, logo, industry' },
  { title: 'Integrations', description: 'Connection status and credentials' },
  { title: 'Alert thresholds', description: 'Min ROAS, max CAC, spend anomaly %' },
  { title: 'Reporting schedule', description: 'Day, time, timezone' },
  { title: 'Content guardrails', description: 'Compliance rules and banned phrases' },
  { title: 'Brand voice', description: 'Upload examples for agent memory' },
  { title: 'COO channels', description: 'Slack channel, notification preferences' },
]

export default function SettingsPage() {
  return (
    <div className="p-6">
      <PageHeader
        title="Settings"
        description="Brand configuration, integrations, and thresholds."
      />

      <div className="mt-6 space-y-3 max-w-2xl">
        {SETTING_SECTIONS.map(({ title, description }) => (
          <div
            key={title}
            className="bg-white rounded-lg border border-gray-200 px-5 py-4
                       flex items-center justify-between"
          >
            <div>
              <p className="text-sm font-medium text-gray-700">{title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{description}</p>
            </div>
            <span className="text-xs text-gray-300">Coming soon</span>
          </div>
        ))}
      </div>
    </div>
  )
}
