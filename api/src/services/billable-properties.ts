import type { SupabaseClient } from '@supabase/supabase-js';

// the one definition of a billable property. checkout, renewal reconciliation and the
// plan quote all count through here so the tier a customer buys matches the tier they keep
export async function countBillableProperties(supabase: SupabaseClient, tenantId: string): Promise<number> {
	const { count, error } = await supabase
		.from('properties')
		.select('id', { count: 'exact', head: true })
		.eq('tenant_id', tenantId)
		.eq('active', true)
		.is('deleted_at', null);
	if (error) throw error;
	return count ?? 0;
}

// a tenant that connected OwnerRez but has never paid. former customers don't count, so
// their data stays current through webhooks if they come back
export async function isUnpaidProspect(supabase: SupabaseClient, tenantId: string): Promise<boolean> {
	const [{ data: tenant }, { data: subscription }] = await Promise.all([
		supabase.from('tenants').select('subscription_exempt, first_subscription_at').eq('id', tenantId).maybeSingle(),
		supabase.from('subscriptions').select('id').eq('tenant_id', tenantId).maybeSingle(),
	]);
	return tenant?.subscription_exempt !== true && !tenant?.first_subscription_at && !subscription;
}
