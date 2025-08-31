import { Hono } from 'hono';
import { createSupabaseClient } from '../services/supabase';
import { authMiddleware } from '../middleware/auth';

const waitlist = new Hono<{ Bindings: Env; Variables: { user: any } }>();

waitlist.post('/', async (c) => {
	const body = await c.req.json().catch(() => ({}));
	const { email, company, properties } = body;
	
	if (!email || !email.includes('@')) {
		return c.json({ error: 'Invalid email address' }, 400);
	}
	
	const supabase = createSupabaseClient(c.env);
	
	const { data: existingEntry } = await supabase
		.from('waitlist')
		.select('id')
		.eq('email', email.toLowerCase())
		.single();
	
	if (existingEntry) {
		const { error } = await supabase
			.from('waitlist')
			.update({
				company: company || '',
				properties: properties || '',
				updated_at: new Date().toISOString()
			})
			.eq('email', email.toLowerCase());
		
		if (error) {
			console.error('Error updating waitlist entry:', error);
			return c.json({ error: 'Failed to update waitlist entry' }, 500);
		}
		
		return c.json({ 
			success: true, 
			message: 'Waitlist entry updated',
			isUpdate: true 
		});
	} else {
		const { error } = await supabase
			.from('waitlist')
			.insert({
				email: email.toLowerCase(),
				company: company || '',
				properties: properties || '',
				created_at: new Date().toISOString()
			});
		
		if (error) {
			console.error('Error adding to waitlist:', error);
			return c.json({ error: 'Failed to join waitlist' }, 500);
		}
		
		return c.json({ 
			success: true, 
			message: 'Successfully joined waitlist',
			isUpdate: false 
		}, 201);
	}
});

waitlist.get('/', authMiddleware, async (c) => {
	const supabase = createSupabaseClient(c.env);
	
	const { data: entries, error } = await supabase
		.from('waitlist')
		.select('*')
		.order('created_at', { ascending: false });
	
	if (error) {
		console.error('Error fetching waitlist:', error);
		return c.json({ error: 'Failed to fetch waitlist' }, 500);
	}
	
	return c.json({
		total: entries?.length || 0,
		entries: entries || []
	});
});

export { waitlist };