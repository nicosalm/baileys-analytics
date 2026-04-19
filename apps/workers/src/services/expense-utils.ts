import { SupabaseClient } from '@supabase/supabase-js'
import { fetchAllRows } from '../utils/fetch-all'
import { buildYearMonthFilter } from '../utils/date-filters'

export async function getExpensesWithTemplateFallback(
  supabase: SupabaseClient,
  tenantId: string,
  from: string,
  to: string,
  propertyIds: string[],
  propertyFilter?: string
): Promise<{ property_id: string; category: string; amount: number }[]> {
  if (propertyIds.length === 0) return []

  // parse the YYYY-MM-DD string directly; new Date(from).getFullYear/Month
  // uses local TZ and drifts into the prior year in non-UTC runtimes.
  const [fromYear, fromMonth] = from.split('-').map(Number)
  const [toYear, toMonth] = to.split('-').map(Number)

  const filteredIds = propertyFilter ? [propertyFilter] : propertyIds

  const [expenses, templatesResult] = await Promise.all([
    fetchAllRows(() =>
      supabase
        .from('operating_expenses')
        .select('property_id, year, month, category, amount')
        .eq('tenant_id', tenantId)
        .in('property_id', filteredIds)
        .or(buildYearMonthFilter(fromYear, fromMonth, toYear, toMonth))
        .order('property_id')
    ),
    supabase
      .from('expense_templates')
      .select('property_id, category, amount')
      .eq('tenant_id', tenantId)
      .in('property_id', filteredIds)
  ])

  const templates = templatesResult.data || []

  // build a set of property-year-month combos that have at least one explicit entry
  const explicitKeys = new Set<string>()
  expenses.forEach(e => {
    explicitKeys.add(`${e.property_id}_${e.year}_${e.month}`)
  })

  // group templates by property_id
  const templatesByProperty = new Map<string, { category: string; amount: number }[]>()
  templates.forEach((t: any) => {
    const list = templatesByProperty.get(t.property_id) || []
    list.push({ category: t.category, amount: parseFloat(t.amount) || 0 })
    templatesByProperty.set(t.property_id, list)
  })

  // generate fallback entries for months without explicit entries
  const fallback: { property_id: string; category: string; amount: number }[] = []
  for (let year = fromYear; year <= toYear; year++) {
    const monthStart = year === fromYear ? fromMonth : 1
    const monthEnd = year === toYear ? toMonth : 12
    for (let month = monthStart; month <= monthEnd; month++) {
      for (const propertyId of filteredIds) {
        const key = `${propertyId}_${year}_${month}`
        if (!explicitKeys.has(key)) {
          const propTemplates = templatesByProperty.get(propertyId)
          if (propTemplates) {
            fallback.push(...propTemplates.map(t => ({ ...t, property_id: propertyId })))
          }
        }
      }
    }
  }

  return [
    ...expenses.map((e: any) => ({ property_id: e.property_id, category: e.category, amount: parseFloat(e.amount) || 0 })),
    ...fallback
  ]
}
