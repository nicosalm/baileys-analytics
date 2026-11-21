import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { createSupabaseClient } from '../services/supabase';
import type { AppEnv } from '../types';

const operatingExpenses = new Hono<AppEnv>();

operatingExpenses.use('/*', authMiddleware);

const expenseCategoryEnum = z.enum(['cleaning', 'management', 'utilities', 'maintenance', 'insurance', 'other']);

const singleExpenseSchema = z.object({
	propertyId: z.string().uuid(),
	category: expenseCategoryEnum,
	amount: z.number().min(0),
	month: z.string().regex(/^\d{4}-\d{2}$/),
	description: z.string().max(255).optional(),
	notes: z.string().optional(),
});

const bulkExpenseSchema = z.object({
	propertyId: z.string().uuid(),
	year: z.number().int().min(2020).max(2100),
	month: z.number().int().min(1).max(12),
	expenses: z.array(
		z.object({
			category: expenseCategoryEnum,
			amount: z.number().min(0),
			description: z.string().max(255).optional(),
		}),
	),
});

operatingExpenses.get('/', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');

	if (!tenantId) {
		return c.json({ error: 'Tenant not found' }, 404);
	}

	const yearParam = c.req.query('year');
	const monthParam = c.req.query('month');
	const propertyId = c.req.query('property');
	const category = c.req.query('category');

	let query = supabase.from('operating_expenses').select('*').eq('tenant_id', tenantId);

	if (monthParam?.includes('-')) {
		const [year, month] = monthParam.split('-');
		query = query.eq('year', parseInt(year, 10)).eq('month', parseInt(month, 10));
	} else if (yearParam && monthParam) {
		query = query.eq('year', parseInt(yearParam, 10)).eq('month', parseInt(monthParam, 10));
	} else if (yearParam) {
		query = query.eq('year', parseInt(yearParam, 10));
	}

	if (propertyId) {
		query = query.eq('property_id', propertyId);
	}

	if (category) {
		query = query.eq('category', category);
	}

	const { data, error } = await query.order('created_at', { ascending: false });

	if (error) {
		console.error('Failed to fetch operating expenses:', error);
		return c.json({ error: 'Failed to fetch operating expenses' }, 500);
	}

	return c.json({ success: true, data });
});

operatingExpenses.post('/', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');

	if (!tenantId) {
		return c.json({ error: 'Tenant not found' }, 404);
	}

	const body = await c.req.json();
	const validation = singleExpenseSchema.safeParse(body);

	if (!validation.success) {
		return c.json(
			{
				error: 'Invalid input',
				details: validation.error.issues,
			},
			400,
		);
	}

	const { propertyId, category, amount, month, description, notes } = validation.data;
	const [year, monthNum] = month.split('-');

	const { data: property } = await supabase.from('properties').select('id').eq('id', propertyId).eq('tenant_id', tenantId).single();

	if (!property) {
		return c.json({ error: 'Property not found' }, 404);
	}

	const { data, error } = await supabase
		.from('operating_expenses')
		.insert({
			tenant_id: tenantId,
			property_id: propertyId,
			category,
			amount,
			year: parseInt(year, 10),
			month: parseInt(monthNum, 10),
			description: description || null,
			notes: notes || null,
		})
		.select()
		.single();

	if (error) {
		console.error('Failed to create operating expense:', error);
		return c.json({ error: 'Failed to create operating expense' }, 500);
	}

	const { invalidateConfigViews } = await import('../utils/cache');
	await invalidateConfigViews(c.env.CACHE, c.get('tenantId'), 'operatingExpenses');

	return c.json({ success: true, data });
});

operatingExpenses.post('/bulk', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');

	if (!tenantId) {
		return c.json({ error: 'Tenant not found' }, 404);
	}

	const body = await c.req.json();
	const validation = bulkExpenseSchema.safeParse(body);

	if (!validation.success) {
		return c.json(
			{
				error: 'Invalid input',
				details: validation.error.issues,
			},
			400,
		);
	}

	const { propertyId, year, month, expenses } = validation.data;

	const { data: property } = await supabase.from('properties').select('id').eq('id', propertyId).eq('tenant_id', tenantId).single();

	if (!property) {
		return c.json({ error: 'Property not found' }, 404);
	}

	const rows = expenses.map((expense) => ({
		category: expense.category,
		amount: expense.amount,
		description: expense.description || null,
	}));

	const { error: rpcError } = await supabase.rpc('replace_operating_expenses', {
		p_tenant_id: tenantId,
		p_property_id: propertyId,
		p_year: year,
		p_month: month,
		p_rows: rows,
	});

	if (rpcError) {
		console.error('Failed to save operating expenses:', rpcError);
		return c.json({ error: 'Failed to save operating expenses' }, 500);
	}

	// fetch the newly inserted rows
	const { data } = await supabase
		.from('operating_expenses')
		.select('*')
		.eq('tenant_id', tenantId)
		.eq('property_id', propertyId)
		.eq('year', year)
		.eq('month', month)
		.order('created_at', { ascending: false });

	const { invalidateConfigViews } = await import('../utils/cache');
	await invalidateConfigViews(c.env.CACHE, c.get('tenantId'), 'operatingExpenses');

	return c.json({ success: true, data });
});

operatingExpenses.put('/:id', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');

	if (!tenantId) {
		return c.json({ error: 'Tenant not found' }, 404);
	}

	const id = c.req.param('id');
	const body = await c.req.json();

	const updateSchema = z.object({
		category: expenseCategoryEnum.optional(),
		amount: z.number().min(0).optional(),
		description: z.string().max(255).optional().nullable(),
		notes: z.string().optional().nullable(),
	});

	const validation = updateSchema.safeParse(body);

	if (!validation.success) {
		return c.json(
			{
				error: 'Invalid input',
				details: validation.error.issues,
			},
			400,
		);
	}

	const { data, error } = await supabase
		.from('operating_expenses')
		.update({
			...validation.data,
			updated_at: new Date().toISOString(),
		})
		.eq('id', id)
		.eq('tenant_id', tenantId)
		.select()
		.single();

	if (error) {
		console.error('Failed to update operating expense:', error);
		return c.json({ error: 'Failed to update operating expense' }, 500);
	}

	const { invalidateConfigViews } = await import('../utils/cache');
	await invalidateConfigViews(c.env.CACHE, c.get('tenantId'), 'operatingExpenses');

	return c.json({ success: true, data });
});

operatingExpenses.delete('/:id', async (c) => {
	const supabase = createSupabaseClient(c.env);
	const tenantId = c.get('tenantId');

	if (!tenantId) {
		return c.json({ error: 'Tenant not found' }, 404);
	}

	const id = c.req.param('id');

	const { error } = await supabase.from('operating_expenses').delete().eq('id', id).eq('tenant_id', tenantId);

	if (error) {
		console.error('Failed to delete operating expense:', error);
		return c.json({ error: 'Failed to delete operating expense' }, 500);
	}

	const { invalidateConfigViews } = await import('../utils/cache');
	await invalidateConfigViews(c.env.CACHE, c.get('tenantId'), 'operatingExpenses');

	return c.json({ success: true });
});

export { operatingExpenses };
