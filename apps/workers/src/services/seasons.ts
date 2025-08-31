import { SupabaseClient } from '@supabase/supabase-js';

export interface Season {
	id: string;
	tenant_id: string;
	name: string;
	start_month: number;
	start_day: number;
	end_month: number;
	end_day: number;
	is_active: boolean;
}

export async function getActiveSeasons(supabase: SupabaseClient, tenantId: string): Promise<Season[]> {
	const { data, error } = await supabase
		.from('season_configurations')
		.select('*')
		.eq('tenant_id', tenantId)
		.eq('is_active', true)
		.order('start_month', { ascending: true })
		.order('start_day', { ascending: true });

	if (error || !data) return [];
	return data;
}

export function buildSeasonFilter(seasons: Season[], tableAlias?: string): string {
	if (seasons.length === 0) return '';
	
	const table = tableAlias ? `${tableAlias}.` : '';
	
	const seasonConditions = seasons.map(season => {
		const withinYear = season.start_month <= season.end_month;
		
		if (withinYear) {
			return `(
				(EXTRACT(MONTH FROM ${table}arrival)::int > ${season.start_month} OR 
				 (EXTRACT(MONTH FROM ${table}arrival)::int = ${season.start_month} AND EXTRACT(DAY FROM ${table}arrival)::int >= ${season.start_day}))
				AND
				(EXTRACT(MONTH FROM ${table}arrival)::int < ${season.end_month} OR 
				 (EXTRACT(MONTH FROM ${table}arrival)::int = ${season.end_month} AND EXTRACT(DAY FROM ${table}arrival)::int <= ${season.end_day}))
			)`;
		} else {
			// Season crosses year boundary (e.g., Dec to Feb)
			return `(
				(EXTRACT(MONTH FROM ${table}arrival)::int > ${season.start_month} OR 
				 (EXTRACT(MONTH FROM ${table}arrival)::int = ${season.start_month} AND EXTRACT(DAY FROM ${table}arrival)::int >= ${season.start_day}))
				OR
				(EXTRACT(MONTH FROM ${table}arrival)::int < ${season.end_month} OR 
				 (EXTRACT(MONTH FROM ${table}arrival)::int = ${season.end_month} AND EXTRACT(DAY FROM ${table}arrival)::int <= ${season.end_day}))
			)`;
		}
	}).join(' OR ');
	
	return `AND (${seasonConditions})`;
}

export function buildBlockedTagFilter(tableAlias?: string): string {
	const table = tableAlias ? `${tableAlias}.` : '';
	
	return `AND NOT EXISTS (
		SELECT 1 
		FROM booking_tags bt
		JOIN tags t ON bt.tag_id = t.id
		WHERE bt.booking_id = ${table}id
		AND LOWER(t.name) = 'blocked'
	)`;
}

export function buildBookingFilters(seasons: Season[], tableAlias?: string): string {
	const filters: string[] = [];
	
	filters.push(buildBlockedTagFilter(tableAlias));
	
	if (seasons.length > 0) {
		filters.push(buildSeasonFilter(seasons, tableAlias));
	}
	
	return filters.join(' ');
}