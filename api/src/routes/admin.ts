import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { createSupabaseClient } from '../services/supabase';
import { authMiddleware } from '../middleware/auth';
import { OwnerRezService } from '../services/ownerrez';
import { getValidOwnerRezToken } from '../services/ownerrez-token';
import { mapToBlockRow } from '../utils/blocks';
import { requestTenantDeletion, purgeTenant, StripeCancellationError } from '../services/account-deletion';
import type { AppEnv } from '../types';

const admin = new Hono<AppEnv>();

const ERROR_LIMIT = 50;

function isAdmin(env: Env, email: string | undefined): boolean {
	const admins = env.ADMIN_EMAILS?.split(',').map((e) => e.trim().toLowerCase()) ?? [];
	return !!email && admins.includes(email.toLowerCase());
}

// responds 404 rather than 403 so the admin api is not discoverable
const adminMiddleware = createMiddleware<AppEnv>(async (c, next) => {
	if (!isAdmin(c.env, c.get('user').email)) {
		return c.json({ error: 'Not found' }, 404);
	}
	await next();
});

admin.get('/verify', authMiddleware, (c) => c.json({ isAdmin: isAdmin(c.env, c.get('user').email) }));

// everything the Admin Dashboard shows, one row per tenant from admin_tenant_overview, plus the
// latest failures from both webhook sources. the dashboard computes every widget from these same
// rows, so a widget count always matches the users it filters to.
admin.get('/overview', authMiddleware, adminMiddleware, async (c) => {
	const supabase = createSupabaseClient(c.env);

	try {
		const [tenants, ownerrezErrors, stripeErrors] = await Promise.all([
			supabase.from('admin_tenant_overview').select('*').order('created_at', { ascending: false }),
			supabase
				.from('webhook_events')
				.select('tenant_id, created_at, entity_type, action, processing_error')
				.not('processing_error', 'is', null)
				.order('created_at', { ascending: false })
				.limit(ERROR_LIMIT),
			supabase
				.from('stripe_webhook_events')
				.select('tenant_id, created_at, event_type, processing_error')
				.not('processing_error', 'is', null)
				.order('created_at', { ascending: false })
				.limit(ERROR_LIMIT),
		]);
		if (tenants.error) throw tenants.error;

		const errors = [
			...(ownerrezErrors.data ?? []).map((e) => ({
				source: 'ownerrez' as const,
				tenantId: e.tenant_id as string | null,
				at: e.created_at as string,
				event: [e.entity_type, e.action].filter(Boolean).join(' '),
				message: e.processing_error as string,
			})),
			...(stripeErrors.data ?? []).map((e) => ({
				source: 'stripe' as const,
				tenantId: e.tenant_id as string | null,
				at: e.created_at as string,
				event: e.event_type as string,
				message: e.processing_error as string,
			})),
		]
			.sort((a, b) => b.at.localeCompare(a.at))
			.slice(0, ERROR_LIMIT);

		return c.json({ tenants: tenants.data ?? [], errors, generatedAt: new Date().toISOString() });
	} catch (error) {
		console.error('Failed to build admin overview:', error);
		return c.json({ error: 'Failed to load the admin overview' }, 500);
	}
});

// get single user details
admin.get('/users/:tenantId', authMiddleware, adminMiddleware, async (c) => {
	const tenantId = c.req.param('tenantId');
	const supabase = createSupabaseClient(c.env);

	try {
		const [{ data: tenant }, { data: subscription }, { count: propertiesCount }, { count: bookingsCount }, { data: syncStatus }] =
			await Promise.all([
				supabase.from('tenants').select('*').eq('id', tenantId).single(),
				supabase.from('subscriptions').select('*').eq('tenant_id', tenantId).maybeSingle(),
				supabase.from('properties').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
				supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId),
				supabase.from('sync_status').select('*').eq('tenant_id', tenantId),
			]);

		return c.json({
			tenant,
			subscription,
			stats: {
				properties: propertiesCount || 0,
				bookings: bookingsCount || 0,
			},
			syncStatus,
		});
	} catch (error) {
		console.error('Failed to get user details:', error);
		return c.json({ error: 'Failed to get user details' }, 500);
	}
});

// grant subscription exemption
admin.post('/users/:tenantId/exempt', authMiddleware, adminMiddleware, async (c) => {
	const tenantId = c.req.param('tenantId');
	const body = await c.req.json();
	const exempt = body.exempt;

	// validate exempt is a boolean
	if (typeof exempt !== 'boolean') {
		return c.json({ error: 'Invalid request: exempt must be a boolean' }, 400);
	}

	const supabase = createSupabaseClient(c.env);

	try {
		const { error } = await supabase
			.from('tenants')
			.update({
				subscription_exempt: exempt,
				updated_at: new Date().toISOString(),
			})
			.eq('id', tenantId);

		if (error) throw error;

		return c.json({ success: true, message: exempt ? 'Exemption granted' : 'Exemption revoked' });
	} catch (error) {
		console.error('Failed to update exemption:', error);
		return c.json({ error: 'Failed to update exemption' }, 500);
	}
});

// delete user account (admin only)
admin.delete('/users/:tenantId', authMiddleware, adminMiddleware, async (c) => {
	const tenantId = c.req.param('tenantId');
	const supabase = createSupabaseClient(c.env);

	try {
		await requestTenantDeletion(c.env, supabase, tenantId, c.get('user').email || 'unknown');
	} catch (error) {
		if (error instanceof StripeCancellationError) {
			return c.json(
				{
					error:
						"Could not cancel the tenant's Stripe subscription. The account was not deleted to prevent continued billing. Retry in a few minutes or cancel the subscription manually in Stripe first.",
					code: 'STRIPE_CANCELLATION_FAILED',
				},
				500,
			);
		}
		console.error('Failed to delete account:', error);
		return c.json({ error: 'Failed to delete account' }, 500);
	}

	c.executionCtx.waitUntil(purgeTenant(supabase, tenantId));
	return c.json({ success: true, message: 'Account deleted successfully' });
});

// reset initial sync state for a tenant and return an impersonation link.
// the impersonated tab will auto-run the client-side sync flow because
// initial_sync_needed is marked pending.
admin.post('/users/:tenantId/reset-sync', authMiddleware, adminMiddleware, async (c) => {
	const tenantId = c.req.param('tenantId');
	const supabase = createSupabaseClient(c.env);

	try {
		const { data: tenant } = await supabase.from('tenants').select('email').eq('id', tenantId).single();

		if (!tenant?.email) {
			return c.json({ error: 'Tenant not found' }, 404);
		}

		await supabase.from('sync_status').delete().eq('tenant_id', tenantId).eq('sync_type', 'initial_sync_completed');

		await supabase.from('sync_status').upsert(
			{
				tenant_id: tenantId,
				sync_type: 'initial_sync_needed',
				last_sync: new Date().toISOString(),
				status: 'pending',
				records_synced: 0,
			},
			{ onConflict: 'tenant_id,sync_type' },
		);

		const { data, error } = await supabase.auth.admin.generateLink({
			type: 'magiclink',
			email: tenant.email,
			options: {
				redirectTo: `${c.env.FRONTEND_URL}/auth/callback?impersonate=1&sync=initial`,
			},
		});

		if (error || !data?.properties?.action_link) {
			console.error('Failed to generate impersonation link for resync:', error);
			return c.json({ error: 'Sync reset, but failed to generate impersonation link' }, 500);
		}

		return c.json({ success: true, url: data.properties.action_link });
	} catch (error) {
		console.error('Failed to reset sync:', error);
		return c.json({ error: 'Failed to reset sync' }, 500);
	}
});

// impersonate user — generate a magic link to log in as them
admin.post('/users/:tenantId/impersonate', authMiddleware, adminMiddleware, async (c) => {
	const tenantId = c.req.param('tenantId');
	const supabase = createSupabaseClient(c.env);

	try {
		const { data: tenant } = await supabase.from('tenants').select('email').eq('id', tenantId).single();

		if (!tenant?.email) {
			return c.json({ error: 'Tenant not found' }, 404);
		}

		const { data, error } = await supabase.auth.admin.generateLink({
			type: 'magiclink',
			email: tenant.email,
			options: {
				redirectTo: `${c.env.FRONTEND_URL}/auth/callback?impersonate=1`,
			},
		});

		if (error || !data?.properties?.action_link) {
			console.error('Failed to generate impersonation link:', error);
			return c.json({ error: 'Failed to generate link' }, 500);
		}

		return c.json({ url: data.properties.action_link });
	} catch (error) {
		console.error('Failed to impersonate user:', error);
		return c.json({ error: 'Failed to impersonate' }, 500);
	}
});

// OwnerRez pages hold 100 bookings; 20 lean pages finish well inside the 30s API timeout
const REFRESH_BLOCKS_PAGES_PER_CALL = 20;

// Refresh blocks for a single tenant by re-fetching from OwnerRez.
// Covers cases where the blocks table drifts from OwnerRez: dropped webhooks,
// retry ceiling exceeded, interrupted initial sync. Default window is 1y back
// to 2y forward, narrowable via ?from=YYYY-MM-DD&to=YYYY-MM-DD. Each call covers
// a bounded number of pages; while next is non-null, call again with
// ?next=<next> (and the same from/to) to continue.
admin.post('/users/:tenantId/refresh-blocks', authMiddleware, adminMiddleware, async (c) => {
	const tenantId = c.req.param('tenantId');
	const supabase = createSupabaseClient(c.env);

	const tokenResult = await getValidOwnerRezToken(c.env, tenantId);
	if (tokenResult.error) {
		return c.json({ error: tokenResult.error.message }, tokenResult.error.status);
	}

	const { data: properties, error: propError } = await supabase.from('properties').select('ownerrez_id').eq('tenant_id', tenantId);

	if (propError) {
		console.error('Failed to load properties for block refresh:', propError);
		return c.json({ error: 'Failed to load properties' }, 500);
	}

	const orPropertyIds = (properties || []).map((p) => p.ownerrez_id).filter((id): id is string => !!id);

	if (orPropertyIds.length === 0) {
		return c.json({ error: 'Tenant has no OwnerRez-linked properties' }, 400);
	}

	// integer set so we can reject orphan blocks that reference properties
	// we no longer have (deleted / deactivated since last property sync)
	const knownIntIds = new Set(orPropertyIds.map((id) => parseInt(id, 10)).filter((n) => !Number.isNaN(n)));

	const now = new Date();
	const qFrom = c.req.query('from');
	const qTo = c.req.query('to');
	const isValidDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
	const from =
		qFrom && isValidDate(qFrom) ? qFrom : new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), 1)).toISOString().slice(0, 10);
	const to = qTo && isValidDate(qTo) ? qTo : new Date(Date.UTC(now.getUTCFullYear() + 2, now.getUTCMonth(), 1)).toISOString().slice(0, 10);
	const resume = c.req.query('next') || null;

	const ownerRez = new OwnerRezService(tokenResult.accessToken, c.env.CACHE);
	const nowIso = new Date().toISOString();

	// stream pages through: filter+upsert each 100-item page as it arrives so
	// partial progress survives a worker crash or edge timeout (upsert is
	// idempotent on the retry). memory stays bounded at one page regardless
	// of tenant size.
	let upserted = 0;
	let upsertErrorMessage: string | null = null;
	let totalItems = 0;
	let next: string | null = null;
	try {
		const result = await ownerRez.fetchBookingsChunked(
			orPropertyIds,
			from,
			to,
			resume,
			REFRESH_BLOCKS_PAGES_PER_CALL,
			async (pageItems) => {
				const rows = pageItems
					.filter((b) => (b.is_block || b.type === 'block') && knownIntIds.has(Number(b.property_id)))
					.map((b) => mapToBlockRow(b, tenantId, nowIso));
				if (rows.length === 0) return;
				const { error } = await supabase.from('blocks').upsert(rows, { onConflict: 'ownerrez_block_id,tenant_id' });
				if (error) {
					upsertErrorMessage = error.message;
					throw new Error('upsert failed');
				}
				upserted += rows.length;
			},
			{ withDetails: false },
		);
		totalItems = result.totalItems;
		next = result.next;
	} catch (err) {
		if (upsertErrorMessage) {
			console.error('Block upsert failed during admin refresh:', upsertErrorMessage);
			return c.json({ error: 'Upsert failed', upserted }, 500);
		}
		console.error('OwnerRez fetch failed during block refresh:', err);
		return c.json({ error: 'Failed to fetch from OwnerRez', upserted }, 502);
	}

	return c.json({
		success: true,
		fetched: totalItems,
		blocks: upserted,
		propertiesScanned: orPropertyIds.length,
		range: { from, to },
		next,
	});
});

export { admin };
