import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_MAX_ROWS } from '../constants';

type GoalPeriod = 'monthly' | 'quarterly' | 'yearly';

interface PeriodRange {
	from: string;
	to: string;
	label: string;
}

function getPeriodRange(period: GoalPeriod): PeriodRange {
	const now = new Date();
	const today = now.toISOString().split('T')[0];
	let from: string;
	let label: string;

	switch (period) {
		case 'monthly': {
			const start = new Date(now.getFullYear(), now.getMonth(), 1);
			from = start.toISOString().split('T')[0];
			label = `${start.toLocaleDateString('en-US', { month: 'long' })} to Date`;
			break;
		}
		case 'quarterly': {
			const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
			const start = new Date(now.getFullYear(), quarterMonth, 1);
			from = start.toISOString().split('T')[0];
			const q = Math.floor(quarterMonth / 3) + 1;
			label = `Q${q} to Date`;
			break;
		}
		case 'yearly': {
			const start = new Date(now.getFullYear(), 0, 1);
			from = start.toISOString().split('T')[0];
			label = 'Year to Date';
			break;
		}
	}

	return { from, to: today, label };
}

interface GoalMetrics {
	revenue: number;
	bookings: number;
	occupancy: number;
	guests: number;
	avgBookingValue: number;
	repeatRate: number;
	avgStayLength: number;
}

async function getGoalMetrics(
	supabase: SupabaseClient,
	tenantId: string,
	from: string,
	to: string
): Promise<GoalMetrics> {
	const { data: bookings } = await supabase
		.from('bookings')
		.select('*')
		.eq('tenant_id', tenantId)
		.lte('arrival', to)
		.gte('departure', from)
		.neq('status', 'canceled')
		.limit(SUPABASE_MAX_ROWS);

	const { count: propertyCount } = await supabase
		.from('properties')
		.select('*', { count: 'exact', head: true })
		.eq('tenant_id', tenantId)
		.eq('active', true);

	const totalRevenue = bookings?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;
	const totalBookings = bookings?.length || 0;
	const avgBookingValue = totalBookings > 0 ? totalRevenue / totalBookings : 0;

	let totalNights = 0;
	bookings?.forEach(b => {
		const nights = Math.ceil(
			(new Date(b.departure).getTime() - new Date(b.arrival).getTime()) / (1000 * 60 * 60 * 24)
		);
		totalNights += nights;
	});
	const avgStayLength = totalBookings > 0 ? totalNights / totalBookings : 0;

	const startDate = new Date(from);
	const endDate = new Date(to);
	const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
	const totalPossibleNights = totalDays * (propertyCount || 1);
	const occupancy = totalPossibleNights > 0 ? (totalNights / totalPossibleNights) * 100 : 0;

	const uniqueGuests = new Set(
		bookings?.map(b => b.ownerrez_guest_id || b.guest_name?.toLowerCase()).filter(Boolean)
	);
	const totalGuests = uniqueGuests.size;

	const { data: historicalBookings } = await supabase
		.from('bookings')
		.select('ownerrez_guest_id, guest_name')
		.eq('tenant_id', tenantId)
		.lt('arrival', from)
		.neq('status', 'canceled')
		.limit(SUPABASE_MAX_ROWS);

	const historicalGuestIds = new Set(
		historicalBookings?.map(b => b.ownerrez_guest_id || b.guest_name?.toLowerCase()).filter(Boolean) || []
	);

	let repeatGuests = 0;
	uniqueGuests.forEach(guestId => {
		if (historicalGuestIds.has(guestId)) {
			repeatGuests++;
		}
	});

	const repeatRate = totalGuests > 0 ? (repeatGuests / totalGuests) * 100 : 0;

	return {
		revenue: totalRevenue,
		bookings: totalBookings,
		occupancy,
		guests: totalGuests,
		avgBookingValue,
		repeatRate,
		avgStayLength,
	};
}

const METRIC_KEY_MAP: Record<string, keyof GoalMetrics> = {
	revenue: 'revenue',
	bookings: 'bookings',
	occupancy: 'occupancy',
	guests: 'guests',
	avgBookingValue: 'avgBookingValue',
	repeatRate: 'repeatRate',
	avgStayLength: 'avgStayLength',
};

export async function getGoalProgress(
	supabase: SupabaseClient,
	tenantId: string
) {
	const { data: goals, error } = await supabase
		.from('goals')
		.select('*')
		.eq('tenant_id', tenantId)
		.eq('is_enabled', true);

	if (error || !goals || goals.length === 0) {
		return [];
	}

	// Group goals by period to minimize queries
	const periodGroups = new Map<GoalPeriod, typeof goals>();
	for (const goal of goals) {
		const period = (goal.period || 'yearly') as GoalPeriod;
		if (!periodGroups.has(period)) {
			periodGroups.set(period, []);
		}
		periodGroups.get(period)!.push(goal);
	}

	// Fetch metrics once per unique period
	const periodMetrics = new Map<GoalPeriod, { metrics: GoalMetrics; range: PeriodRange }>();
	for (const period of periodGroups.keys()) {
		const range = getPeriodRange(period);
		const metrics = await getGoalMetrics(supabase, tenantId, range.from, range.to);
		periodMetrics.set(period, { metrics, range });
	}

	// Map results back to goals
	const results = goals.map(goal => {
		const period = (goal.period || 'yearly') as GoalPeriod;
		const { metrics, range } = periodMetrics.get(period)!;
		const metricKey = METRIC_KEY_MAP[goal.metric_key];
		const currentValue = metricKey ? metrics[metricKey] : 0;
		const targetValue = Number(goal.target_value);
		const progress = targetValue > 0 ? Math.min((currentValue / targetValue) * 100, 100) : 0;

		return {
			metricKey: goal.metric_key,
			targetValue,
			currentValue,
			progress,
			period,
			periodLabel: range.label,
			dateRange: { from: range.from, to: range.to },
		};
	});

	return results;
}
