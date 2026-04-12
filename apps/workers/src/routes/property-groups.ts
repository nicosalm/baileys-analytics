import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { createPropertyGroupSchema, updatePropertyGroupSchema } from '@baileys/schemas';

import { authMiddleware } from '../middleware/auth';

const propertyGroups = new Hono<{ Bindings: Env; Variables: { user: any; tenantId: string } }>();

propertyGroups.use('*', authMiddleware);

interface PropertyGroupResponse {
  id: string;
  name: string;
  description?: string;
  propertyIds: string[];
  memberCount: number;
}

propertyGroups.get('/', async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const tenantId = c.get('tenantId');

  try {
    const { data: groups, error } = await supabase
      .from('property_groups')
      .select('id, name, description')
      .eq('tenant_id', tenantId)
      .order('name');

    if (error) throw error;

    const groupIds = (groups || []).map(g => g.id);

    let membersByGroup: Record<string, string[]> = {};
    if (groupIds.length > 0) {
      const { data: members, error: membersError } = await supabase
        .from('property_group_members')
        .select('property_group_id, property_id')
        .in('property_group_id', groupIds);

      if (membersError) throw membersError;

      for (const m of members || []) {
        if (!membersByGroup[m.property_group_id]) {
          membersByGroup[m.property_group_id] = [];
        }
        membersByGroup[m.property_group_id].push(m.property_id);
      }
    }

    const result: PropertyGroupResponse[] = (groups || []).map(g => ({
      id: g.id,
      name: g.name,
      description: g.description || undefined,
      propertyIds: membersByGroup[g.id] || [],
      memberCount: (membersByGroup[g.id] || []).length
    }));

    return c.json(result);
  } catch (error) {
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to fetch property groups'
    }, 500);
  }
});

propertyGroups.post('/', async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const tenantId = c.get('tenantId');
  const body = await c.req.json();

  const validation = createPropertyGroupSchema.safeParse(body);
  if (!validation.success) {
    return c.json({
      error: validation.error.issues.map((e: any) => e.message).join(', ')
    }, 400);
  }

  const { name, description, propertyIds } = validation.data;

  try {
    const { data: group, error } = await supabase
      .from('property_groups')
      .insert({ tenant_id: tenantId, name, description: description || null })
      .select()
      .single();

    if (error) throw error;

    if (propertyIds.length > 0) {
      const members = propertyIds.map((pid: string) => ({
        property_group_id: group.id,
        property_id: pid,
        tenant_id: tenantId
      }));

      const { error: membersError } = await supabase
        .from('property_group_members')
        .insert(members);

      if (membersError) throw membersError;
    }

    const { invalidateConfigViews } = await import('../utils/cache');
    await invalidateConfigViews(c.env.CACHE, c.get('user').id, 'propertyGroups');

    return c.json({
      id: group.id,
      name: group.name,
      description: group.description || undefined,
      propertyIds,
      memberCount: propertyIds.length
    } satisfies PropertyGroupResponse, 201);
  } catch (error) {
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to create property group'
    }, 500);
  }
});

propertyGroups.put('/:id', async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const tenantId = c.get('tenantId');
  const groupId = c.req.param('id');
  const body = await c.req.json();

  const validation = updatePropertyGroupSchema.safeParse(body);
  if (!validation.success) {
    return c.json({
      error: validation.error.issues.map((e: any) => e.message).join(', ')
    }, 400);
  }

  const { name, description, propertyIds } = validation.data;

  try {
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description || null;

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      const { error } = await supabase
        .from('property_groups')
        .update(updates)
        .eq('id', groupId)
        .eq('tenant_id', tenantId);

      if (error) throw error;
    }

    if (propertyIds !== undefined) {
      const { error: deleteError } = await supabase
        .from('property_group_members')
        .delete()
        .eq('property_group_id', groupId)
        .eq('tenant_id', tenantId);

      if (deleteError) throw deleteError;

      if (propertyIds.length > 0) {
        const members = propertyIds.map((pid: string) => ({
          property_group_id: groupId,
          property_id: pid,
          tenant_id: tenantId
        }));

        const { error: insertError } = await supabase
          .from('property_group_members')
          .insert(members);

        if (insertError) throw insertError;
      }
    }

    const { data: updated, error: fetchError } = await supabase
      .from('property_groups')
      .select('id, name, description')
      .eq('id', groupId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError) throw fetchError;
    if (!updated) return c.json({ error: 'Property group not found' }, 404);

    const { data: members } = await supabase
      .from('property_group_members')
      .select('property_id')
      .eq('property_group_id', groupId);

    const finalPropertyIds = (members || []).map(m => m.property_id);

    const { invalidateConfigViews } = await import('../utils/cache');
    await invalidateConfigViews(c.env.CACHE, c.get('user').id, 'propertyGroups');

    return c.json({
      id: updated.id,
      name: updated.name,
      description: updated.description || undefined,
      propertyIds: finalPropertyIds,
      memberCount: finalPropertyIds.length
    } satisfies PropertyGroupResponse);
  } catch (error) {
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to update property group'
    }, 500);
  }
});

propertyGroups.delete('/:id', async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const tenantId = c.get('tenantId');
  const groupId = c.req.param('id');

  try {
    const { error } = await supabase
      .from('property_groups')
      .delete()
      .eq('id', groupId)
      .eq('tenant_id', tenantId);

    if (error) throw error;

    const { invalidateConfigViews } = await import('../utils/cache');
    await invalidateConfigViews(c.env.CACHE, c.get('user').id, 'propertyGroups');

    return c.json({ success: true });
  } catch (error) {
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to delete property group'
    }, 500);
  }
});

export { propertyGroups };
