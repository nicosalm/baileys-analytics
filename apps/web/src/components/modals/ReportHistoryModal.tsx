import { Modal } from '@/components/Modal'
import { useModal } from '@/contexts/modal'
import { Clock, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ReportHistoryModalProps {
  templateId: string
  templateName: string
}

export const ReportHistoryModal = ({ templateId, templateName }: ReportHistoryModalProps) => {
  const { closeModal, openModal } = useModal()

  const handleGenerate = () => {
    closeModal()
    openModal({
      type: 'report-preview',
      templateId,
      templateName
    })
  }

  return (
    <Modal
      isOpen={true}
      onClose={closeModal}
      title="Report History"
      subtitle={templateName}
      size="xl"
    >
      <div className="space-y-6">
        <div className="text-center py-12">
          <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No report history yet</h3>
          <p className="text-sm text-gray-500 mb-6">
            Generate your first report to start tracking history.
          </p>
          <Button onClick={handleGenerate}>
            <ExternalLink className="w-4 h-4" />
            Generate Report
          </Button>
        </div>
      </div>
    </Modal>
  )
}
