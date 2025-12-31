import { SupabaseClient } from '@supabase/supabase-js'

// dctz-specific tax rates
const DCTZ_RATE = 0.08 // 8% door county tourism zone
const WI_STATE_RATE = 0.055 // 5.5% wisconsin state
const COMBINED_RATE = DCTZ_RATE + WI_STATE_RATE // 13.5%

// platforms where the platform remits tax on their OWN guest service fee
// NOTE: these platforms do NOT remit tax on the host's revenue in door county
// the host is responsible for collecting and remitting tax on their own revenue
const PLATFORM_REMITS_ON_GUEST_FEE: Record<string, boolean> = {
	'airbnb': true,
	'vrbo': true,
	'expedia': true,
	'booking.com': false, // booking.com does not remit any tax
	'evolve': true, // check with dctz - some evolve users have avalara
	'direct': false,
	'stripe': false,
	'other': false
}

export interface DCTZReportData {
	property: {
		id: string
		name: string
	}
	period: {
		month: number
		year: number
		monthName: string
	}
	lodgingEstablishment: {
		line1_availableNights: number
		line2_rentedNights: number
	}
	taxCalculation: {
		line3_grossLodgingSales: number
		line4_exemptions: number
		line5_marketplaceSales: number
		line5a_airbnbTax: number
		line5b_vrboTax: number
		line5c_expediaTax: number
		line5d_bookingComTax: number
		line5e_evolveTax: number
	}
	summary: {
		netTaxableSales: number
		taxRate: number
		totalTaxDue: number
		totalPaidOnBehalf: number
		totalAmountDue: number
		ownerTaxDue: number
	}
	breakdown: {
		ownerRevenue: number
		guestServiceFees: number
		guestFeesByPlatform: Record<string, number>
		platformSalesBySource: Record<string, number>
	}
}

export class DCTZCalculator {
	private supabase: SupabaseClient

	constructor(supabase: SupabaseClient) {
		this.supabase = supabase
	}

	async calculateReport(
		tenantId: string,
		propertyId: string,
		year: number,
		month: number
	): Promise<DCTZReportData | null> {
		console.log('DCTZ Calculator called with:', { tenantId, propertyId, year, month })

		// get property info
		const { data: property, error: propertyError } = await this.supabase
			.from('properties')
			.select('id, name')
			.eq('id', propertyId)
			.eq('tenant_id', tenantId)
			.single()

		console.log('Property lookup result:', { property, error: propertyError?.message })

		if (!property) return null

		// calculate date range for the month
		const startDate = `${year}-${String(month).padStart(2, '0')}-01`
		const endDate = new Date(year, month, 0).toISOString().split('T')[0] // last day of month

		// get bookings for this property in this month
		const { data: bookings, error: bookingsError } = await this.supabase
			.from('bookings')
			.select(`
				id,
				arrival,
				departure,
				total_amount,
				platform,
				status
			`)
			.eq('tenant_id', tenantId)
			.eq('property_id', propertyId)
			.lte('arrival', endDate)
			.gt('departure', startDate)
			.neq('status', 'canceled')

		console.log('DCTZ bookings query:', {
			tenantId,
			propertyId,
			startDate,
			endDate,
			bookingsFound: bookings?.length || 0,
			error: bookingsError?.message
		})

		// get guest service fees for this property/month
		const { data: guestFees } = await this.supabase
			.from('platform_guest_fees')
			.select('platform, guest_service_fee, host_service_fee')
			.eq('tenant_id', tenantId)
			.eq('property_id', propertyId)
			.eq('year', year)
			.eq('month', month)

		// calculate days in month
		const daysInMonth = new Date(year, month, 0).getDate()

		// calculate rented nights (accounting for bookings that span month boundaries)
		let rentedNights = 0
		const platformSales: Record<string, number> = {}

		for (const booking of bookings || []) {
			const arrivalDate = new Date(booking.arrival)
			const departureDate = new Date(booking.departure)
			const monthStart = new Date(year, month - 1, 1)
			const monthEnd = new Date(year, month, 0)

			// calculate nights within this specific month
			const effectiveStart = arrivalDate > monthStart ? arrivalDate : monthStart
			const effectiveEnd = departureDate < monthEnd ? departureDate : monthEnd
			const nightsInMonth = Math.max(0, Math.ceil(
				(effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)
			))

			rentedNights += nightsInMonth

			// prorate revenue for partial months
			const totalNights = Math.ceil(
				(departureDate.getTime() - arrivalDate.getTime()) / (1000 * 60 * 60 * 24)
			)
			const proratedRevenue = totalNights > 0
				? (booking.total_amount || 0) * (nightsInMonth / totalNights)
				: 0

			// group by platform
			const platform = this.normalizePlatform(booking.platform)
			platformSales[platform] = (platformSales[platform] || 0) + proratedRevenue
		}

		// calculate owner revenue (from bookings)
		const ownerRevenue = Object.values(platformSales).reduce((sum, val) => sum + val, 0)

		// sum guest service fees by platform from manual entries
		const guestFeesByPlatform: Record<string, number> = {}
		let totalGuestServiceFees = 0

		for (const fee of guestFees || []) {
			const platform = this.normalizePlatform(fee.platform)
			const amount = fee.guest_service_fee || 0
			guestFeesByPlatform[platform] = (guestFeesByPlatform[platform] || 0) + amount
			totalGuestServiceFees += amount
		}

		// gross lodging sales = owner revenue + guest service fees (per dctz instructions)
		const grossLodgingSales = ownerRevenue + totalGuestServiceFees

		// KEY FIX: marketplace sales = ONLY the guest service fees from platforms that remit
		// platforms do NOT remit tax on owner revenue in door county - only on their own fees
		let marketplaceSales = 0
		const platformTaxAmounts: Record<string, number> = {
			airbnb: 0,
			vrbo: 0,
			expedia: 0,
			'booking.com': 0,
			evolve: 0
		}

		for (const [platform, guestFee] of Object.entries(guestFeesByPlatform)) {
			if (PLATFORM_REMITS_ON_GUEST_FEE[platform]) {
				// only the guest service fee goes into marketplace sales
				// NOT the owner's revenue
				marketplaceSales += guestFee

				// calculate 8% dctz tax paid by platform on their guest fee
				if (platformTaxAmounts[platform] !== undefined) {
					platformTaxAmounts[platform] = guestFee * DCTZ_RATE
				}
			}
		}

		// calculate totals
		const exemptions = 0 // TODO: detect 30+ night stays

		// net taxable = gross - marketplace sales (guest fees where platform remits) - exemptions
		// this is the owner's revenue that they must pay tax on
		const netTaxableSales = grossLodgingSales - marketplaceSales - exemptions

		// total tax due on net taxable at combined rate (13.5%)
		const totalTaxDue = netTaxableSales * COMBINED_RATE

		// total paid on behalf = sum of platform taxes on guest fees (8% only)
		const totalPaidOnBehalf = Object.values(platformTaxAmounts).reduce((sum, val) => sum + val, 0)

		// owner's tax due = tax on their revenue (not reduced by platform payments)
		// platform payments are on a DIFFERENT tax base (guest fees vs owner revenue)
		const ownerTaxDue = ownerRevenue * DCTZ_RATE

		// amount due to DCTZ = owner's 8% on their revenue
		// (platforms separately remit their 8% on guest fees)
		const totalAmountDue = Math.max(0, ownerTaxDue)

		const monthNames = [
			'January', 'February', 'March', 'April', 'May', 'June',
			'July', 'August', 'September', 'October', 'November', 'December'
		]

		return {
			property: {
				id: property.id,
				name: property.name
			},
			period: {
				month,
				year,
				monthName: monthNames[month - 1]
			},
			lodgingEstablishment: {
				line1_availableNights: daysInMonth,
				line2_rentedNights: rentedNights
			},
			taxCalculation: {
				line3_grossLodgingSales: grossLodgingSales,
				line4_exemptions: exemptions,
				line5_marketplaceSales: marketplaceSales,
				line5a_airbnbTax: platformTaxAmounts.airbnb,
				line5b_vrboTax: platformTaxAmounts.vrbo,
				line5c_expediaTax: platformTaxAmounts.expedia,
				line5d_bookingComTax: platformTaxAmounts['booking.com'],
				line5e_evolveTax: platformTaxAmounts.evolve
			},
			summary: {
				netTaxableSales,
				taxRate: COMBINED_RATE,
				totalTaxDue,
				totalPaidOnBehalf,
				totalAmountDue,
				ownerTaxDue
			},
			breakdown: {
				ownerRevenue,
				guestServiceFees: totalGuestServiceFees,
				guestFeesByPlatform,
				platformSalesBySource: platformSales
			}
		}
	}

	private normalizePlatform(platform: string | null): string {
		if (!platform) return 'direct'
		const lower = platform.toLowerCase()
		if (lower.includes('airbnb')) return 'airbnb'
		if (lower.includes('vrbo') || lower.includes('homeaway')) return 'vrbo'
		if (lower.includes('expedia')) return 'expedia'
		if (lower.includes('booking.com') || lower === 'booking') return 'booking.com'
		if (lower.includes('evolve')) return 'evolve'
		if (lower.includes('stripe')) return 'stripe'
		if (lower === 'direct' || lower === 'website' || lower.includes('doorcountystay')) return 'direct'
		return 'other'
	}
}
