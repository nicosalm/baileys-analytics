import { Context, Next } from 'hono';
import { createSupabaseClient } from '../services/supabase';

export async function authMiddleware(c: Context<{ Bindings: Env; Variables: { user: any; tenantId: string } }>, next: Next) {
	// already authenticated by an app-level middleware earlier in the chain
	if (c.get('user')) {
		return next();
	}

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

	// anonymous users map to the demo tenant
	if (user.is_anonymous) {
		const { data: demoTenant } = await supabase
			.from('tenants')
			.select('id')
			.eq('email', 'demo@baileysanalytics.com')
			.maybeSingle();

		if (demoTenant) {
			c.set('tenantId', demoTenant.id);
		}
		return next();
	}

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