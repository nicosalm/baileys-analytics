import { useState } from 'react'
import { FileText, Play, Info } from 'lucide-react'
import { DCTZReportModal } from './DCTZReportModal'

interface DCTZReportCardProps {
  hasDCTZAccess: boolean
}

export const DCTZReportCard = ({ hasDCTZAccess }: DCTZReportCardProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false)

  if (!hasDCTZAccess) return null

  return (
    <>
      <div className="h-full bg-white rounded-lg border border-teal-200 hover:bg-teal-50/30 transition-colors p-4 flex flex-col">
        <div className="flex items-start justify-between mb-3 flex-1">
          <div className="flex items-start gap-3 flex-1">
            <div className="p-2 rounded-lg bg-teal-50">
              <FileText className="w-4 h-4 text-teal-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-gray-900">DCTZ Tax Report</h4>
                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-teal-100 text-teal-700 rounded">
                  WI
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Door County Tourism Zone tax filing
              </p>
              <div className="flex items-center gap-1 mt-1 text-xs text-teal-600">
                <Info className="w-3 h-3" />
                <span>Includes guest fee tracking</span>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full flex items-center justify-center px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors mt-auto cursor-pointer"
        >
          <Play className="w-3 h-3 mr-1.5" />
          Generate
        </button>
      </div>

      {isModalOpen && (
        <DCTZReportModal onClose={() => setIsModalOpen(false)} />
      )}
    </>
  )
}
