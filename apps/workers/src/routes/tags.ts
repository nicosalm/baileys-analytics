import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
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
    // Using Supabase's ability to join and aggregate in a single query
    const { data, error } = await supabase
      .from('tags')
      .select(`
        id,
        name,
        color,
        property_tags(count),
        booking_tags(count)
      `)
      .eq('tenant_id', tenantId)
      .order('name');

    if (error) {
      // Fallback to manual query if the above doesn't work
      const { data: tagsData, error: tagsError } = await supabase
        .from('tags')
        .select('id, name, color')
        .eq('tenant_id', tenantId)
        .order('name');

      if (tagsError) {
        throw tagsError;
      }

      // Get usage counts separately
      const tagIds = tagsData?.map(t => t.id) || [];
      
      const [propertyTagsResult, bookingTagsResult] = await Promise.all([
        supabase
          .from('property_tags')
          .select('tag_id', { count: 'exact' })
          .in('tag_id', tagIds),
        
        supabase
          .from('booking_tags')
          .select('tag_id', { count: 'exact' })
          .in('tag_id', tagIds)
      ]);

      const propertyUsage = new Map<string, number>();
      const bookingUsage = new Map<string, number>();

      // Count usage per tag
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

      const tags: Tag[] = (tagsData || []).map(tag => ({
        id: tag.id,
        name: tag.name,
        color: tag.color || undefined,
        usageCount: (propertyUsage.get(tag.id) || 0) + (bookingUsage.get(tag.id) || 0)
      }));

      return c.json(tags);
    }

    // If the joined query worked, format the response
    const tags: Tag[] = (data || []).map(row => ({
      id: row.id,
      name: row.name,
      color: row.color || undefined,
      usageCount: (row.property_tags?.[0]?.count || 0) + (row.booking_tags?.[0]?.count || 0)
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

  const { name, color } = body;

  if (!name) {
    return c.json({ error: 'Tag name is required' }, 400);
  }

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

  const { name, color } = body;

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
    // Supabase handles cascade deletes if configured in the database
    const { error } = await supabase
      .from('tags')
      .delete()
      .eq('id', tagId)
      .eq('tenant_id', tenantId);

    if (error) {
      throw error;
    }

    return c.json({ success: true });
  } catch (error) {
    return c.json({ 
      error: error instanceof Error ? error.message : 'Failed to delete tag' 
    }, 500);
  }
});

export { tags };