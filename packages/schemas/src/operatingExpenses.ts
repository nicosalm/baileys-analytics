import { z } from 'zod'

export const expenseCategoryEnum = z.enum([
  'cleaning',
  'management',
  'utilities',
  'maintenance',
  'insurance',
  'other'
])

export type ExpenseCategory = z.infer<typeof expenseCategoryEnum>

export const operatingExpenseSchema = z.object({
  id: z.string().uuid().optional(),
  tenantId: z.string().uuid(),
  propertyId: z.string().uuid(),
  category: expenseCategoryEnum,
  amount: z.number().min(0),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  description: z.string().max(255).optional().nullable(),
  notes: z.string().optional().nullable(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional()
})

export type OperatingExpense = z.infer<typeof operatingExpenseSchema>

export const operatingExpenseFormSchema = z.object({
  propertyId: z.string().uuid(),
  category: expenseCategoryEnum,
  amount: z.number().min(0),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Month must be in YYYY-MM format'),
  description: z.string().max(255).optional(),
  notes: z.string().optional()
})

export type OperatingExpenseForm = z.infer<typeof operatingExpenseFormSchema>

export const bulkOperatingExpenseSchema = z.object({
  propertyId: z.string().uuid(),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  expenses: z.array(z.object({
    category: expenseCategoryEnum,
    amount: z.number().min(0),
    description: z.string().max(255).optional()
  }))
})

export type BulkOperatingExpense = z.infer<typeof bulkOperatingExpenseSchema>

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  cleaning: 'Cleaning',
  management: 'Management',
  utilities: 'Utilities',
  maintenance: 'Maintenance',
  insurance: 'Insurance',
  other: 'Other'
}
