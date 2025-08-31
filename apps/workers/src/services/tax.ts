import { SupabaseClient } from '@supabase/supabase-js';

export class TaxService {
	constructor(private supabase: SupabaseClient) {}

	async calculateTaxes(
		tenantId: string,
		year: number,
		quarter?: number,
		propertyId?: string
	) {
		let startDate: string;
		let endDate: string;

		if (quarter) {
			const quarterRanges = {
				1: ['01-01', '03-31'],
				2: ['04-01', '06-30'],
				3: ['07-01', '09-30'],
				4: ['10-01', '12-31']
			};
			const range = quarterRanges[quarter as 1 | 2 | 3 | 4];
			startDate = `${year}-${range[0]}`;
			endDate = `${year}-${range[1]}`;
		} else {
			startDate = `${year}-01-01`;
			endDate = `${year}-12-31`;
		}

		let bookingQuery = this.supabase
			.from('bookings')
			.select('*')
			.eq('tenant_id', tenantId)
			.gte('arrival', startDate)
			.lte('departure', endDate)
			.neq('booking_status', 'canceled');

		if (propertyId) {
			bookingQuery = bookingQuery.eq('property_id', propertyId);
		}

		const { data: bookings } = await bookingQuery;

		const { data: taxConfigs } = await this.supabase
			.from('property_tax_configs')
			.select('*')
			.eq('tenant_id', tenantId)
			.eq('active', true);

		const propertyTaxMap = new Map(
			taxConfigs?.map(config => [config.property_id, config]) || []
		);

		const taxCalculations = bookings?.map(booking => {
			const config = propertyTaxMap.get(booking.property_id);
			const taxRate = config?.tax_rate || 0.08;
			const taxableAmount = booking.total_amount || 0;
			const taxAmount = taxableAmount * taxRate;

			const nights = booking.arrival && booking.departure
				? Math.ceil((new Date(booking.departure).getTime() - new Date(booking.arrival).getTime()) / (1000 * 60 * 60 * 24))
				: 0;

			return {
				bookingId: booking.id,
				propertyId: booking.property_id,
				guestName: booking.guest_name,
				arrival: booking.arrival,
				departure: booking.departure,
				nights,
				totalAmount: booking.total_amount,
				taxableAmount,
				taxRate: taxRate * 100,
				taxAmount,
				jurisdiction: config?.jurisdiction || 'Default',
				taxType: config?.tax_type || 'Sales Tax'
			};
		}) || [];

		const totalRevenue = taxCalculations.reduce((sum, calc) => sum + calc.totalAmount, 0);
		const totalTaxable = taxCalculations.reduce((sum, calc) => sum + calc.taxableAmount, 0);
		const totalTax = taxCalculations.reduce((sum, calc) => sum + calc.taxAmount, 0);

		const byJurisdiction = taxCalculations.reduce((acc, calc) => {
			if (!acc[calc.jurisdiction]) {
				acc[calc.jurisdiction] = {
					jurisdiction: calc.jurisdiction,
					bookingCount: 0,
					revenue: 0,
					taxable: 0,
					tax: 0
				};
			}
			acc[calc.jurisdiction].bookingCount++;
			acc[calc.jurisdiction].revenue += calc.totalAmount;
			acc[calc.jurisdiction].taxable += calc.taxableAmount;
			acc[calc.jurisdiction].tax += calc.taxAmount;
			return acc;
		}, {} as Record<string, any>);

		return {
			period: { year, quarter, startDate, endDate },
			summary: {
				totalRevenue,
				totalTaxable,
				totalTax,
				effectiveTaxRate: totalRevenue > 0 ? (totalTax / totalRevenue) * 100 : 0,
				bookingCount: taxCalculations.length
			},
			byJurisdiction: Object.values(byJurisdiction),
			details: taxCalculations
		};
	}

	async getRemittanceSchedule(tenantId: string) {
		const { data: configs } = await this.supabase
			.from('property_tax_configs')
			.select('*')
			.eq('tenant_id', tenantId)
			.eq('active', true);

		const currentDate = new Date();
		const currentMonth = currentDate.getMonth() + 1;
		const currentQuarter = Math.ceil(currentMonth / 3);
		const currentYear = currentDate.getFullYear();

		const remittances = configs?.map(config => {
			let nextDue: Date;
			let period: string;

			switch (config.remittance_frequency) {
				case 'monthly':
					nextDue = new Date(currentYear, currentMonth, 15);
					if (nextDue < currentDate) {
						nextDue.setMonth(nextDue.getMonth() + 1);
					}
					period = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
					break;
				
				case 'quarterly':
					const quarterMonth = currentQuarter * 3;
					nextDue = new Date(currentYear, quarterMonth, 15);
					if (nextDue < currentDate) {
						nextDue.setMonth(nextDue.getMonth() + 3);
					}
					period = `${currentYear} Q${currentQuarter}`;
					break;
				
				case 'annually':
				default:
					nextDue = new Date(currentYear + 1, 0, 31);
					period = String(currentYear);
					break;
			}

			return {
				propertyId: config.property_id,
				jurisdiction: config.jurisdiction,
				taxType: config.tax_type,
				taxRate: config.tax_rate * 100,
				remittanceFrequency: config.remittance_frequency,
				nextDueDate: nextDue.toISOString().split('T')[0],
				period,
				status: nextDue < new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) ? 'due_soon' : 'upcoming'
			};
		}) || [];

		return remittances.sort((a, b) => 
			new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime()
		);
	}
}