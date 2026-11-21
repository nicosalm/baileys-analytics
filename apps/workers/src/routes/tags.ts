import { Hono } from 'hono';
import { createSupabaseClient } from '../services/supabase';

import { authMiddleware } from '../middleware/auth';
import type { AppEnv } from '../types';

const tags = new Hono<AppEnv>();

tags.use('*', authMiddleware);

interface Tag {
  id: string;
  name: string;
  color?: string;
  usageCount: number;
}

tags.get('/', async (c) => {
  const supabase = createSupabaseClient(c.env);
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
export { tags };