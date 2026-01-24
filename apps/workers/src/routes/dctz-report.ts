import { Hono } from 'hono'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { createSupabaseClient } from '../services/supabase'
import { DCTZCalculator } from '../services/dctz-calculator'

const dctzReport = new Hono<{ Bindings: Env; Variables: { user: any; tenantId: string } }>()

dctzReport.use('/*', authMiddleware)

// tenant ids that have access to dctz report feature
// TODO: replace with jerry's actual tenant id when known
const DCTZ_ENABLED_TENANTS = [
	'df2d602d-0472-4ccc-bcfd-374de378a175', // demo tenant for testing
	'91616123-1ffc-4c54-a4ad-f1670b1ce857'
]

// middleware to check dctz access
const dctzAccessMiddleware = async (c: any, next: any) => {
	const tenantId = c.get('tenantId')

	if (!tenantId || !DCTZ_ENABLED_TENANTS.includes(tenantId)) {
		return c.json({ error: 'DCTZ report feature not enabled for this account' }, 403)
	}

	await next()
}

dctzReport.use('/*', dctzAccessMiddleware)

// looser uuid pattern to accept test data uuids
const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/

const reportRequestSchema = z.object({
	propertyId: z.string().regex(uuidPattern, 'Invalid UUID format'),
	year: z.number().int().min(2020).max(2100),
	month: z.number().int().min(1).max(12)
})

// check if tenant has dctz access
dctzReport.get('/access', async (c) => {
	const tenantId = c.get('tenantId')
	return c.json({
		hasAccess: DCTZ_ENABLED_TENANTS.includes(tenantId),
		featureName: 'Door County Tourism Zone Tax Report'
	})
})

// generate dctz report for a property/month
dctzReport.post('/generate', async (c) => {
	const tenantId = c.get('tenantId')
	const supabase = createSupabaseClient(c.env)

	const body = await c.req.json()
	const validation = reportRequestSchema.safeParse(body)

	if (!validation.success) {
		return c.json({
			error: 'Invalid request',
			details: validation.error.issues
		}, 400)
	}

	const { propertyId, year, month } = validation.data

	const calculator = new DCTZCalculator(supabase)
	const report = await calculator.calculateReport(tenantId, propertyId, year, month)

	if (!report) {
		return c.json({ error: 'Property not found or no access' }, 404)
	}

	return c.json({
		success: true,
		report
	})
})

// get list of properties for dctz report
dctzReport.get('/properties', async (c) => {
	const tenantId = c.get('tenantId')
	const supabase = createSupabaseClient(c.env)

	const { data: properties } = await supabase
		.from('properties')
		.select('id, name')
		.eq('tenant_id', tenantId)
		.eq('active', true)
		.order('name')

	return c.json({
		success: true,
		properties: properties || []
	})
})

// check if guest fees are entered for a property/month
dctzReport.get('/fee-status', async (c) => {
	const tenantId = c.get('tenantId')
	const supabase = createSupabaseClient(c.env)

	const propertyId = c.req.query('propertyId')
	const year = parseInt(c.req.query('year') || new Date().getFullYear().toString())
	const month = parseInt(c.req.query('month') || (new Date().getMonth() + 1).toString())

	if (!propertyId) {
		return c.json({ error: 'propertyId is required' }, 400)
	}

	const { data: fees } = await supabase
		.from('platform_guest_fees')
		.select('id, platform, guest_service_fee')
		.eq('tenant_id', tenantId)
		.eq('property_id', propertyId)
		.eq('year', year)
		.eq('month', month)

	const hasGuestFees = (fees || []).some(f => (f.guest_service_fee || 0) > 0)

	return c.json({
		success: true,
		propertyId,
		year,
		month,
		hasGuestFees,
		feeCount: fees?.length || 0,
		fees: fees || []
	})
})

// save guest service fee for dctz reporting
dctzReport.post('/guest-fee', async (c) => {
	const tenantId = c.get('tenantId')
	const supabase = createSupabaseClient(c.env)

	const body = await c.req.json()

	const schema = z.object({
		propertyId: z.string().regex(uuidPattern, 'Invalid UUID format'),
		platform: z.string().min(1),
		year: z.number().int().min(2020).max(2100),
		month: z.number().int().min(1).max(12),
		guestServiceFee: z.number().min(0),
		hostServiceFee: z.number().min(0).optional(),
		notes: z.string().optional()
	})

	const validation = schema.safeParse(body)

	if (!validation.success) {
		return c.json({
			error: 'Invalid request',
			details: validation.error.issues
		}, 400)
	}

	const { propertyId, platform, year, month, guestServiceFee, hostServiceFee, notes } = validation.data

	// verify property belongs to tenant
	const { data: property } = await supabase
		.from('properties')
		.select('id')
		.eq('id', propertyId)
		.eq('tenant_id', tenantId)
		.single()

	if (!property) {
		return c.json({ error: 'Property not found' }, 404)
	}

	// delete existing entry for this property/platform/month combination
	await supabase
		.from('platform_guest_fees')
		.delete()
		.eq('tenant_id', tenantId)
		.eq('property_id', propertyId)
		.eq('platform', platform)
		.eq('year', year)
		.eq('month', month)
		.is('booking_id', null)

	// insert new fee entry
	const { data, error } = await supabase
		.from('platform_guest_fees')
		.insert({
			tenant_id: tenantId,
			property_id: propertyId,
			platform,
			amount: guestServiceFee,
			year,
			month,
			guest_service_fee: guestServiceFee,
			host_service_fee: hostServiceFee || 0,
			notes: notes || null,
			booking_id: null
		})
		.select()
		.single()

	if (error) {
		console.error('Failed to save guest fee:', error)
		return c.json({ error: 'Failed to save guest fee' }, 500)
	}

	return c.json({
		success: true,
		data
	})
})

// clear all guest fees for a property/month
dctzReport.delete('/guest-fees', async (c) => {
	const tenantId = c.get('tenantId')
	const supabase = createSupabaseClient(c.env)

	const propertyId = c.req.query('propertyId')
	const year = parseInt(c.req.query('year') || '0')
	const month = parseInt(c.req.query('month') || '0')

	if (!propertyId || !year || !month) {
		return c.json({ error: 'propertyId, year, and month are required' }, 400)
	}

	// verify property belongs to tenant
	const { data: property } = await supabase
		.from('properties')
		.select('id')
		.eq('id', propertyId)
		.eq('tenant_id', tenantId)
		.single()

	if (!property) {
		return c.json({ error: 'Property not found' }, 404)
	}

	const { error } = await supabase
		.from('platform_guest_fees')
		.delete()
		.eq('tenant_id', tenantId)
		.eq('property_id', propertyId)
		.eq('year', year)
		.eq('month', month)
		.is('booking_id', null)

	if (error) {
		console.error('Failed to clear guest fees:', error)
		return c.json({ error: 'Failed to clear guest fees' }, 500)
	}

	return c.json({ success: true })
})

export { dctzReport }
