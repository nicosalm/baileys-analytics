import { Hono } from 'hono';
import { createClient } from '@supabase/supabase-js';
import { authMiddleware } from '../middleware/auth';
import { cache, clearCache } from '../middleware/cache';

const announcements = new Hono<{ Bindings: Env; Variables: { user: any; tenantId: string } }>();

const adminMiddleware = async (c: any, next: any) => {
  const user = c.get('user');
  const adminEmails = c.env.ADMIN_EMAILS?.split(',').map((e: string) => e.trim().toLowerCase()) || [];
  const userEmail = user.email?.toLowerCase() || '';
  if (!adminEmails.includes(userEmail)) {
    return c.json({ error: 'Not found' }, 404);
  }
  await next();
};

const ANNOUNCEMENTS_CACHE_PREFIX = 'announcements:public';

// public: list published announcements
announcements.get('/', cache({ ttl: 1800, key: (c) => `${ANNOUNCEMENTS_CACHE_PREFIX}:${c.req.url}` }), async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const limit = Math.min(parseInt(c.req.query('limit') || '20', 10) || 20, 50);
  const offset = parseInt(c.req.query('offset') || '0', 10) || 0;

  const { data, error, count } = await supabase
    .from('announcements')
    .select('id, title, body, author, created_at', { count: 'exact' })
    .eq('published', true)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('Failed to fetch announcements:', error);
    return c.json({ error: 'Failed to fetch announcements' }, 500);
  }

  return c.json({ announcements: data || [], total: count || 0 });
});

// admin: list all announcements (including drafts)
announcements.get('/all', authMiddleware, adminMiddleware, async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  const { data, error } = await supabase
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch announcements:', error);
    return c.json({ error: 'Failed to fetch announcements' }, 500);
  }

  return c.json({ announcements: data || [] });
});

// admin: create announcement
announcements.post('/', authMiddleware, adminMiddleware, clearCache(ANNOUNCEMENTS_CACHE_PREFIX), async (c) => {
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const { title, body, author, published } = await c.req.json();

  if (!title || !body) {
    return c.json({ error: 'Title and body are required' }, 400);
  }

  const { data, error } = await supabase
    .from('announcements')
    .insert({ title, body, author: author || 'Baileys Team', published: published ?? false })
    .select()
    .single();

  if (error) {
    console.error('Failed to create announcement:', error);
    return c.json({ error: 'Failed to create announcement' }, 500);
  }

  return c.json({ announcement: data });
});

// admin: update announcement
announcements.put('/:id', authMiddleware, adminMiddleware, clearCache(ANNOUNCEMENTS_CACHE_PREFIX), async (c) => {
  const id = c.req.param('id');
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);
  const { title, body, author, published } = await c.req.json();

  const updates: Record<string, any> = { updated_at: new Date().toISOString() };
  if (title !== undefined) updates.title = title;
  if (body !== undefined) updates.body = body;
  if (author !== undefined) updates.author = author;
  if (published !== undefined) updates.published = published;

  const { data, error } = await supabase
    .from('announcements')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Failed to update announcement:', error);
    return c.json({ error: 'Failed to update announcement' }, 500);
  }

  return c.json({ announcement: data });
});

// admin: delete announcement
announcements.delete('/:id', authMiddleware, adminMiddleware, clearCache(ANNOUNCEMENTS_CACHE_PREFIX), async (c) => {
  const id = c.req.param('id');
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY);

  const { error } = await supabase
    .from('announcements')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Failed to delete announcement:', error);
    return c.json({ error: 'Failed to delete announcement' }, 500);
  }

  return c.json({ success: true });
});

export { announcements };
