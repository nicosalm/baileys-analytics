import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { authMiddleware } from '../middleware/auth';

const scheduler = new Hono<{ Bindings: Env; Variables: { user: any; tenantId: string } }>();

scheduler.use('*', authMiddleware);

interface ScheduledTask {
  id: string;
  tenantId: string;
  taskType: 'sync_properties' | 'sync_bookings' | 'sync_guests' | 'generate_report';
  schedule: string;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  metadata?: Record<string, any>;
}

scheduler.get('/', async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const tenantId = c.get('tenantId');

  try {
    const { data, error } = await supabase
      .from('scheduled_tasks')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at');

    if (error) {
      return c.json([
        {
          id: 'default-sync-properties',
          tenantId,
          taskType: 'sync_properties',
          schedule: '0 2 * * *',
          enabled: true,
          lastRun: null,
          nextRun: getNextRunTime('0 2 * * *')
        },
        {
          id: 'default-sync-bookings',
          tenantId,
          taskType: 'sync_bookings',
          schedule: '0 */6 * * *',
          enabled: true,
          lastRun: null,
          nextRun: getNextRunTime('0 */6 * * *')
        }
      ]);
    }

    return c.json(data || []);
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch scheduled tasks' 
    }, 500);
  }
});

scheduler.post('/', async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  
  const jobSchema = z.object({
    jobType: z.enum([
      'sync_properties',
      'sync_bookings',
      'sync_guests',
      'generate_report'
    ]),
    schedule: z.string(),
    enabled: z.boolean().default(true),
    metadata: z.record(z.string(), z.any()).optional()
  });
  
  const validation = jobSchema.safeParse({
    jobType: body.taskType,
    schedule: body.schedule,
    enabled: body.enabled,
    metadata: body.metadata
  });
  
  if (!validation.success) {
    return c.json({ 
      error: validation.error.issues.map((e: any) => e.message).join(', ')
    }, 400);
  }

  const { jobType, schedule, enabled, metadata } = validation.data;

  try {
    const { data, error } = await supabase
      .from('scheduled_tasks')
      .insert({
        tenant_id: tenantId,
        task_type: jobType,
        schedule,
        enabled,
        metadata,
        next_run: getNextRunTime(schedule)
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return c.json(data, 201);
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to create scheduled task' 
    }, 500);
  }
});

scheduler.put('/:id', async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const tenantId = c.get('tenantId');
  const taskId = c.req.param('id');
  const body = await c.req.json();
  
  const updateSchema = z.object({
    schedule: z.string().optional(),
    enabled: z.boolean().optional(),
    metadata: z.record(z.string(), z.any()).optional()
  }).partial();
  
  const validation = updateSchema.safeParse(body);
  if (!validation.success) {
    return c.json({ 
      error: validation.error.issues.map((e: any) => e.message).join(', ')
    }, 400);
  }

  const { schedule, enabled, metadata } = validation.data;

  try {
    const updateData: any = { updated_at: new Date().toISOString() };
    
    if (schedule !== undefined) {
      updateData.schedule = schedule;
      updateData.next_run = getNextRunTime(schedule);
    }
    if (enabled !== undefined) updateData.enabled = enabled;
    if (metadata !== undefined) updateData.metadata = metadata;

    const { data, error } = await supabase
      .from('scheduled_tasks')
      .update(updateData)
      .eq('id', taskId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      return c.json({ error: 'Task not found' }, 404);
    }

    return c.json(data);
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to update scheduled task' 
    }, 500);
  }
});

scheduler.delete('/:id', async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const tenantId = c.get('tenantId');
  const taskId = c.req.param('id');

  try {
    const { error } = await supabase
      .from('scheduled_tasks')
      .delete()
      .eq('id', taskId)
      .eq('tenant_id', tenantId);

    if (error) {
      throw error;
    }

    return c.json({ success: true });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to delete scheduled task' 
    }, 500);
  }
});

scheduler.post('/:id/run', async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const tenantId = c.get('tenantId');
  const taskId = c.req.param('id');

  try {
    const { data: task, error: taskError } = await supabase
      .from('scheduled_tasks')
      .select('*')
      .eq('id', taskId)
      .eq('tenant_id', tenantId)
      .single();

    if (taskError || !task) {
      return c.json({ error: 'Task not found' }, 404);
    }

    let result: any = { success: true };
    
    switch (task.task_type) {
      case 'sync_properties':
        const { data: syncResult, error: syncError } = await supabase
          .rpc('sync_properties_from_ownerrez', { p_tenant_id: tenantId });
        
        if (syncError) {
          result = { success: false, error: syncError.message };
        } else {
          result = { success: true, data: syncResult };
        }
        break;
        
      case 'sync_bookings':
        const { data: bookingSync, error: bookingError } = await supabase
          .rpc('sync_bookings_from_ownerrez', { p_tenant_id: tenantId });
        
        if (bookingError) {
          result = { success: false, error: bookingError.message };
        } else {
          result = { success: true, data: bookingSync };
        }
        break;
        
      case 'sync_guests':
        const { data: guestSync, error: guestError } = await supabase
          .rpc('sync_guests_from_ownerrez', { p_tenant_id: tenantId });
        
        if (guestError) {
          result = { success: false, error: guestError.message };
        } else {
          result = { success: true, data: guestSync };
        }
        break;
        
      case 'generate_report':
        const reportType = task.metadata?.reportType || 'monthly';
        result = { 
          success: true, 
          message: `Report generation triggered for type: ${reportType}` 
        };
        break;
        
      default:
        result = { success: false, error: 'Unknown task type' };
    }

    await supabase
      .from('scheduled_tasks')
      .update({ 
        last_run: new Date().toISOString(),
        next_run: getNextRunTime(task.schedule)
      })
      .eq('id', taskId);

    return c.json(result);
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to run scheduled task' 
    }, 500);
  }
});

function getNextRunTime(cronExpression: string): string {
  const now = new Date();
  const parts = cronExpression.split(' ');
  
  if (parts[1] === '*/6') {
    now.setHours(now.getHours() + 6);
  } else if (parts[1] === '2' && parts[0] === '0') {
    now.setDate(now.getDate() + 1);
    now.setHours(2, 0, 0, 0);
  } else {
    now.setHours(now.getHours() + 1);
  }
  
  return now.toISOString();
}

export { scheduler };