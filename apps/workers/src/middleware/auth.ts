import { Context, Next } from 'hono';
import { createSupabaseClient } from '../services/supabase';

export async function authMiddleware(c: Context<{ Bindings: Env; Variables: { user: any; tenantId: string } }>, next: Next) {
	const authorization = c.req.header('Authorization');
	
	if (!authorization || !authorization.startsWith('Bearer ')) {
		return c.json({ error: 'Unauthorized' }, 401);
	}

	const token = authorization.substring(7);
	
	const supabase = createSupabaseClient(c.env);
	const { data: { user }, error } = await supabase.auth.getUser(token);
	
	if (error || !user) {
		return c.json({ error: 'Invalid token' }, 401);
	}

	c.set('user', user);
	
	const { data: tenant } = await supabase
		.from('tenants')
		.select('id')
		.eq('user_id', user.id)
		.maybeSingle();
	
	if (tenant) {
		c.set('tenantId', tenant.id);
	} else {
		// create tenant if it doesn't exist
		const { data: newTenant } = await supabase
			.from('tenants')
			.insert({
				user_id: user.id,
				email: user.email || '',
				company_name: 'My Company',
				ownerrez_connected: false
			})
			.select('id')
			.single();
			
		if (newTenant) {
			c.set('tenantId', newTenant.id);
		}
	}

	await next();
}