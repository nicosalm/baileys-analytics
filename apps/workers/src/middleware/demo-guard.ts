import { Context, Next } from 'hono';
import type { AppEnv } from '../types';

// blocks write operations for anonymous/demo users
export async function demoGuard(c: Context<AppEnv>, next: Next) {
	const user = c.get('user');
	if (user?.is_anonymous) {
		return c.json({ error: 'This action is not available in demo mode' }, 403);
	}
	return next();
}
