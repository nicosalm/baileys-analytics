import { useState } from 'react'
import { formatCurrency } from '@baileys/utils'
import type { PacingProperty } from '@/hooks/use-api'
import { useModal } from '@/contexts/modal'
import { Pagination } from '@/components/Pagination'
import { PaceDelta, pctChange } from './PaceDelta'

const PAGE_SIZE = 10

export function PropertyPacingTable({ properties }: { properties: PacingProperty[] }) {
  const { openModal } = useModal()
  const [page, setPage] = useState(1)
  const rows = properties.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th className="py-2 pr-4 text-left font-medium">Property</th>
              <th className="py-2 px-3 text-right font-medium">Booked</th>
              <th className="py-2 px-3 text-right font-medium">Last yr now</th>
              <th className="py-2 px-3 text-right font-medium">Pace</th>
              <th className="py-2 px-3 text-right font-medium">ADR</th>
              <th className="py-2 pl-3 text-right font-medium">Last yr final</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const adr = p.currentNights > 0 ? p.currentRevenue / p.currentNights : 0
              const priorAdr = p.priorNightsAtThisPoint > 0 ? p.priorRevenueAtThisPoint / p.priorNightsAtThisPoint : 0
              const priorAvail = p.priorAvailableNights ?? p.availableNights
              return (
                <tr
                  key={p.propertyId}
                  tabIndex={0}
                  onClick={() => openModal({ type: 'property', propertyId: p.propertyId, propertyName: p.propertyName })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') openModal({ type: 'property', propertyId: p.propertyId, propertyName: p.propertyName })
                  }}
                  className="border-b border-border/50 last:border-0 hover:bg-muted/40 focus-visible:bg-muted/40 outline-none cursor-pointer transition-colors"
                >
                  <td className="py-2 pr-4">
                    <span className="font-medium">{p.propertyCode || p.propertyName}</span>
                    {p.propertyCode && <span className="ml-1.5 text-xs text-muted-foreground hidden md:inline">{p.propertyName}</span>}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums">
                    {p.currentNights}/{p.availableNights}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums text-muted-foreground">
                    {p.priorNightsAtThisPoint}/{priorAvail}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <PaceDelta value={p.paceDelta} />
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums">
                    {adr > 0 ? formatCurrency(adr) : '—'}
                    {priorAdr > 0 && adr > 0 && <PaceDelta value={pctChange(adr, priorAdr)} unit="%" className="ml-1.5" />}
                  </td>
                  <td className="py-2 pl-3 text-right tabular-nums text-muted-foreground">
                    {p.priorNightsFinal}/{priorAvail}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {properties.length > PAGE_SIZE && (
        <Pagination
          currentPage={page}
          totalPages={Math.ceil(properties.length / PAGE_SIZE)}
          totalItems={properties.length}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}
