import { z } from 'zod'
import { uuidSchema } from './common'

export const scheduleFrequencySchema = z.enum([
  'daily',
  'weekly', 
  'monthly',
  'hourly',
  'custom'
])

export const scheduledJobSchema = z.object({
  id: uuidSchema,
  tenantId: uuidSchema,
  jobType: z.enum([
    'sync_properties',
    'sync_bookings',
    'sync_guest_details',
    'generate_report',
    'calculate_taxes',
    'update_platform_fees'
  ]),
  frequency: scheduleFrequencySchema,
  cronExpression: z.string().optional(),
  config: z.record(z.any()).optional(),
  isActive: z.boolean().default(true),
  lastRun: z.string().datetime().nullable(),
  nextRun: z.string().datetime().nullable(),
  lastStatus: z.enum(['success', 'failure', 'running', 'pending']).nullable(),
  lastError: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
})

const createScheduledJobBase = z.object({
  jobType: scheduledJobSchema.shape.jobType,
  frequency: scheduleFrequencySchema,
  cronExpression: z.string().optional(),
  config: z.record(z.any()).optional(),
  isActive: z.boolean().default(true)
})

export const createScheduledJobSchema = createScheduledJobBase.refine((data) => {
  if (data.frequency === 'custom' && !data.cronExpression) {
    return false
  }
  return true
}, {
  message: 'Cron expression is required for custom frequency'
})

export const updateScheduledJobSchema = createScheduledJobBase.partial()

export const runJobManuallySchema = z.object({
  jobId: uuidSchema,
  skipNextRun: z.boolean().default(false)
})

export const jobExecutionLogSchema = z.object({
  id: uuidSchema,
  jobId: uuidSchema,
  tenantId: uuidSchema,
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  status: z.enum(['success', 'failure', 'running']),
  result: z.record(z.any()).optional(),
  error: z.string().nullable(),
  duration: z.number().nullable() // in milliseconds
})

export type ScheduleFrequency = z.infer<typeof scheduleFrequencySchema>
export type ScheduledJob = z.infer<typeof scheduledJobSchema>
export type CreateScheduledJob = z.infer<typeof createScheduledJobSchema>
export type UpdateScheduledJob = z.infer<typeof updateScheduledJobSchema>
export type RunJobManually = z.infer<typeof runJobManuallySchema>
export type JobExecutionLog = z.infer<typeof jobExecutionLogSchema>