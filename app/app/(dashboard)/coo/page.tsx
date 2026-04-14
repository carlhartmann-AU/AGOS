import { PageHeader } from '@/components/PageHeader'

export default function COOPage() {
  return (
    <div className="p-6">
      <PageHeader
        title="COO Interface"
        description="Send instructions to the COO Agent."
      />

      <div className="mt-6 max-w-2xl">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-4">
            The COO Agent interface will be wired up in Phase 5. For now, use
            Slack or manually trigger n8n workflows.
          </p>
          <textarea
            disabled
            rows={4}
            placeholder="COO Agent not yet connected..."
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm
                       text-gray-400 bg-gray-50 resize-none cursor-not-allowed"
          />
          <div className="mt-3 flex justify-end">
            <button
              disabled
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-300
                         rounded-md cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
