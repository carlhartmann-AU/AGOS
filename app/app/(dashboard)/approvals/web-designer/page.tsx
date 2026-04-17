import { PageHeader } from '@/components/PageHeader'
import { WebDesignerDashboard } from '@/components/WebDesignerDashboard'

export default function WebDesignerApprovalsPage() {
  return (
    <div className="p-6">
      <PageHeader
        title="Web Designer Approvals"
        description="Review AI-generated site changes before they go live on Shopify."
      />
      <div className="mt-6">
        <WebDesignerDashboard />
      </div>
    </div>
  )
}
