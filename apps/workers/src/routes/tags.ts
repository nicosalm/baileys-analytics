import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createTagSchema, updateTagSchema } from '@baileys/schemas';

import { authMiddleware } from '../middleware/auth';

const tags = new Hono<{ Bindings: Env; Variables: { user: any; tenantId: string } }>();

tags.use('*', authMiddleware);

interface Tag {
  id: string;
  name: string;
  color?: string;
  usageCount: number;
}

tags.get('/', async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const tenantId = c.get('tenantId');

  try {
    const { data, error } = await supabase
      .from('tags')
      .select(`
        id,
        name,
        color,
        property_tags(count),
        booking_tags(count),
        guest_tags(count)
      `)
      .eq('tenant_id', tenantId)
      .order('name');

    if (error) {
      const { data: tagsData, error: tagsError } = await supabase
        .from('tags')
        .select('id, name, color')
        .eq('tenant_id', tenantId)
        .order('name');

      if (tagsError) {
        throw tagsError;
      }

      const tagIds = tagsData?.map(t => t.id) || [];
      
      const [propertyTagsResult, bookingTagsResult, guestTagsResult] = await Promise.all([
        supabase
          .from('property_tags')
          .select('tag_id', { count: 'exact' })
          .in('tag_id', tagIds),
        
        supabase
          .from('booking_tags')
          .select('tag_id', { count: 'exact' })
          .in('tag_id', tagIds),
        
        supabase
          .from('guest_tags')
          .select('tag_id', { count: 'exact' })
          .in('tag_id', tagIds)
      ]);

      const propertyUsage = new Map<string, number>();
      const bookingUsage = new Map<string, number>();
      const guestUsage = new Map<string, number>();

      if (propertyTagsResult.data) {
        propertyTagsResult.data.forEach(pt => {
          propertyUsage.set(pt.tag_id, (propertyUsage.get(pt.tag_id) || 0) + 1);
        });
      }

      if (bookingTagsResult.data) {
        bookingTagsResult.data.forEach(bt => {
          bookingUsage.set(bt.tag_id, (bookingUsage.get(bt.tag_id) || 0) + 1);
        });
      }

      if (guestTagsResult.data) {
        guestTagsResult.data.forEach(gt => {
          guestUsage.set(gt.tag_id, (guestUsage.get(gt.tag_id) || 0) + 1);
        });
      }

      const tags: Tag[] = (tagsData || []).map(tag => ({
        id: tag.id,
        name: tag.name,
        color: tag.color || undefined,
        usageCount: (propertyUsage.get(tag.id) || 0) + (bookingUsage.get(tag.id) || 0) + (guestUsage.get(tag.id) || 0)
      }));

      return c.json(tags);
    }

    const tags: Tag[] = (data || []).map(row => ({
      id: row.id,
      name: row.name,
      color: row.color || undefined,
      usageCount: (row.property_tags?.[0]?.count || 0) + (row.booking_tags?.[0]?.count || 0) + (row.guest_tags?.[0]?.count || 0)
    }));

    return c.json(tags);
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to fetch tags' 
    }, 500);
  }
});

tags.post('/', async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const tenantId = c.get('tenantId');
  const body = await c.req.json();
  
  const validation = createTagSchema.safeParse(body);
  if (!validation.success) {
    return c.json({ 
      error: validation.error.issues.map((e: any) => e.message).join(', ')
    }, 400);
  }

  const { name, color } = validation.data;

  try {
    const { data, error } = await supabase
      .from('tags')
      .insert({
        tenant_id: tenantId,
        name,
        color
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    const { invalidateDashboardCache } = await import('../utils/cache');
    await invalidateDashboardCache(c.env.CACHE, c.get('user').id);

    return c.json({
      id: data.id,
      name: data.name,
      color: data.color || undefined,
      usageCount: 0
    }, 201);
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to create tag' 
    }, 500);
  }
});

tags.put('/:id', async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const tenantId = c.get('tenantId');
  const tagId = c.req.param('id');
  const body = await c.req.json();
  
  const validation = updateTagSchema.safeParse(body);
  if (!validation.success) {
    return c.json({ 
      error: validation.error.issues.map((e: any) => e.message).join(', ')
    }, 400);
  }

  const { name, color } = validation.data;

  try {
    const { data, error } = await supabase
      .from('tags')
      .update({ name, color })
      .eq('id', tagId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    if (!data) {
      return c.json({ error: 'Tag not found' }, 404);
    }

    const { invalidateDashboardCache } = await import('../utils/cache');
    await invalidateDashboardCache(c.env.CACHE, c.get('user').id);

    return c.json({
      id: data.id,
      name: data.name,
      color: data.color || undefined
    });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to update tag' 
    }, 500);
  }
});

tags.delete('/:id', async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const tenantId = c.get('tenantId');
  const tagId = c.req.param('id');

  try {
    const { error } = await supabase
      .from('tags')
      .delete()
      .eq('id', tagId)
      .eq('tenant_id', tenantId);

    if (error) {
      throw error;
    }

    const { invalidateDashboardCache } = await import('../utils/cache');
    await invalidateDashboardCache(c.env.CACHE, c.get('user').id);

    return c.json({ success: true });
  } catch (error) {
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to delete tag'
    }, 500);
  }
});

export { tags };