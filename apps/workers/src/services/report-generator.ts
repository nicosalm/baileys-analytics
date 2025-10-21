import { SupabaseClient } from '@supabase/supabase-js';
import { TaxCalculator } from './tax-calculator';

export class ReportGenerator {
	constructor(private supabase: SupabaseClient) {}

	async generate(tenantId: string, template: any, parameters: any): Promise<any> {
		switch (template.type) {
			case 'occupancy':
				return this.generateOccupancyReport(tenantId, parameters);
			case 'financial':
				return this.generateFinancialReport(tenantId, parameters);
			case 'tax':
				return this.generateTaxReport(tenantId, parameters);
			default:
				throw new Error(`Unknown report type: ${template.type}`);
		}
	}

	private async generateOccupancyReport(tenantId: string, params: any) {
		const { startDate, endDate, propertyId } = params;
		
		let query = this.supabase
			.from('bookings')
			.select('*')
			.eq('tenant_id', tenantId);
		
		if (propertyId) {
			query = query.eq('property_id', propertyId);
		}
		
		if (startDate) {
			query = query.gte('arrival', startDate);
		}
		
		if (endDate) {
			query = query.lte('departure', endDate);
		}
		
		const { data: bookings } = await query;
		
		const totalNights = bookings?.reduce((sum, b) => {
			if (b.arrival && b.departure) {
				const nights = Math.ceil(
					(new Date(b.departure).getTime() - new Date(b.arrival).getTime()) / 
					(1000 * 60 * 60 * 24)
				);
				return sum + nights;
			}
			return sum;
		}, 0) || 0;
		
		const dayRange = startDate && endDate ? 
			Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) : 
			365;
		
		return {
			period: { startDate, endDate },
			totalBookings: bookings?.length || 0,
			totalNights,
			occupancyRate: (totalNights / dayRange) * 100,
			bookings: bookings || []
		};
	}

	private async generateFinancialReport(tenantId: string, params: any) {
		const { startDate, endDate, propertyId } = params;
		
		let query = this.supabase
			.from('bookings')
			.select('*')
			.eq('tenant_id', tenantId);
		
		if (propertyId) {
			query = query.eq('property_id', propertyId);
		}
		
		if (startDate) {
			query = query.gte('arrival', startDate);
		}
		
		if (endDate) {
			query = query.lte('departure', endDate);
		}
		
		const { data: bookings } = await query;
		
		const totalRevenue = bookings?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;
		const averageBookingValue = bookings?.length ? totalRevenue / bookings.length : 0;
		
		const monthlyRevenue: Record<string, number> = {};
		bookings?.forEach(b => {
			if (b.arrival) {
				const month = new Date(b.arrival).toISOString().slice(0, 7);
				monthlyRevenue[month] = (monthlyRevenue[month] || 0) + (b.total_amount || 0);
			}
		});
		
		return {
			period: { startDate, endDate },
			totalRevenue,
			totalBookings: bookings?.length || 0,
			averageBookingValue,
			monthlyRevenue,
			bookings: bookings || []
		};
	}

	private async generateTaxReport(tenantId: string, params: any) {
		const { year, quarter, propertyId } = params;
		
		let startDate: string;
		let endDate: string;
		
		if (quarter) {
			const quarterStarts = ['01-01', '04-01', '07-01', '10-01'];
			const quarterEnds = ['03-31', '06-30', '09-30', '12-31'];
			startDate = `${year}-${quarterStarts[quarter - 1]}`;
			endDate = `${year}-${quarterEnds[quarter - 1]}`;
		} else {
			startDate = `${year}-01-01`;
			endDate = `${year}-12-31`;
		}
		
		let query = this.supabase
			.from('bookings')
			.select('*')
			.eq('tenant_id', tenantId)
			.gte('arrival', startDate)
			.lte('departure', endDate);
		
		if (propertyId) {
			query = query.eq('property_id', propertyId);
		}
		
		const { data: bookings } = await query;
		
		const totalRevenue = bookings?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;
		const taxableRevenue = totalRevenue * 0.9;
		const estimatedTax = taxableRevenue * 0.08;
		
		return {
			period: { year, quarter, startDate, endDate },
			totalRevenue,
			taxableRevenue,
			estimatedTax,
			bookingCount: bookings?.length || 0,
			bookings: bookings || []
		};
	}

	async generateQuickReport(tenantId: string, config: any): Promise<any> {
		const { modules = [], dateRange = 'last30days', format = 'pdf' } = config;
		
		const dates = this.getDateRangeFromConfig(dateRange);
		const reportData: any = {
			generatedAt: new Date().toISOString(),
			tenantId,
			period: dates,
			sections: []
		};
		
		for (const module of modules) {
			try {
				const sectionData = await this.generateSection(tenantId, module, dates);
				// Only add non-null sections
				if (sectionData && sectionData.data !== undefined) {
					reportData.sections.push(sectionData);
				}
			} catch (error) {
				console.error(`Error generating section ${module}:`, error);
				reportData.sections.push({
					module,
					title: this.formatHeader(module),
					data: null,
					error: 'Failed to generate this section'
				});
			}
		}
		
		return reportData;
	}
	
	private getDateRangeFromConfig(dateRange: string) {
		const today = new Date();
		const todayStr = today.toISOString().split('T')[0];
		
		switch (dateRange) {
			case 'today':
				return { from: todayStr, to: todayStr };
			case 'last7days':
				const last7 = new Date(today);
				last7.setDate(today.getDate() - 7);
				return { from: last7.toISOString().split('T')[0], to: todayStr };
			case 'last30days':
				const last30 = new Date(today);
				last30.setDate(today.getDate() - 30);
				return { from: last30.toISOString().split('T')[0], to: todayStr };
			case 'lastMonth':
				const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
				const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
				return { 
					from: lastMonth.toISOString().split('T')[0], 
					to: lastMonthEnd.toISOString().split('T')[0] 
				};
			case 'last90days':
				const last90 = new Date(today);
				last90.setDate(today.getDate() - 90);
				return { from: last90.toISOString().split('T')[0], to: todayStr };
			case 'lastQuarter':
				const quarter = Math.floor(today.getMonth() / 3);
				const quarterStart = new Date(today.getFullYear(), (quarter - 1) * 3, 1);
				const quarterEnd = new Date(today.getFullYear(), quarter * 3, 0);
				return { 
					from: quarterStart.toISOString().split('T')[0], 
					to: quarterEnd.toISOString().split('T')[0] 
				};
			case 'lastYear':
				const lastYear = new Date(today.getFullYear() - 1, 0, 1);
				const lastYearEnd = new Date(today.getFullYear() - 1, 11, 31);
				return { 
					from: lastYear.toISOString().split('T')[0], 
					to: lastYearEnd.toISOString().split('T')[0] 
				};
			default:
				return { from: todayStr, to: todayStr };
		}
	}
	
	private async generateSection(tenantId: string, module: string, dates: any) {
		switch (module) {
			case 'arrivals':
			case 'departures':
				return this.generateOperationalSection(tenantId, module, dates);
			case 'bookings':
				return this.generateBookingsSection(tenantId, dates);
			case 'properties':
			case 'occupancy':
			case 'revenue_by_property':
				return this.generatePropertySection(tenantId, module, dates);
			case 'pl':
			case 'revenue':
			case 'expenses':
			case 'trends':
				return this.generateFinancialSection(tenantId, module, dates);
			case 'tax':
			case 'jurisdictions':
			case 'tax_breakdown':
				return this.generateTaxSection(tenantId, module, dates);
			case 'guests':
			case 'repeat_rate':
				return this.generateGuestSection(tenantId, module, dates);
			case 'channels':
			case 'conversion':
			case 'revenue_by_channel':
				return this.generateChannelSection(tenantId, module, dates);
			case 'availability':
			case 'seasonal_trends':
				return this.generateTrendsSection(tenantId, module, dates);
			default:
				// Unknown module - skip it
				return null;
		}
	}
	
	private async generateOperationalSection(tenantId: string, type: string, dates: any) {
		const { data: bookings } = await this.supabase
			.from('bookings')
			.select('*, properties!inner(name)')
			.eq('tenant_id', tenantId)
			.eq(type === 'arrivals' ? 'arrival' : 'departure', dates.from)
			.neq('status', 'canceled');
		
		return {
			module: type,
			title: type === 'arrivals' ? 'Today\'s Arrivals' : 'Today\'s Departures',
			data: bookings?.map(b => ({
				guestName: b.guest_name,
				guestEmail: b.guest_email,
				guestPhone: b.guest_phone,
				propertyName: b.properties?.name,
				time: type === 'arrivals' ? b.arrival : b.departure,
				arrival: b.arrival,
				departure: b.departure,
				amount: b.total_amount,
				totalAmount: b.total_amount,
				nights: Math.ceil((new Date(b.departure).getTime() - new Date(b.arrival).getTime()) / (1000 * 60 * 60 * 24)),
				status: b.status,
				platform: b.platform || 'Direct'
			})) || []
		};
	}
	
	private async generateBookingsSection(tenantId: string, dates: any) {
		const { data: bookings } = await this.supabase
			.from('bookings')
			.select('*, properties!inner(name)')
			.eq('tenant_id', tenantId)
			.gte('arrival', dates.from)
			.lte('arrival', dates.to)
			.neq('status', 'canceled')
			.order('arrival', { ascending: false });
		
		return {
			module: 'bookings',
			title: 'Booking Details',
			data: bookings || []
		};
	}
	
	private async generatePropertySection(tenantId: string, module: string, dates: any) {
		const { data: properties } = await this.supabase
			.from('properties')
			.select('*')
			.eq('tenant_id', tenantId)
			.eq('active', true);
		
		const { data: bookings } = await this.supabase
			.from('bookings')
			.select('*')
			.eq('tenant_id', tenantId)
			.gte('arrival', dates.from)
			.lte('departure', dates.to)
			.neq('status', 'canceled')
			.order('property_id')
			.order('arrival');

		// Calculate gap analysis per property
		let singleNightGaps = 0;
		let twoNightGaps = 0;
		let threeNightGaps = 0;

		if (properties && bookings) {
			for (const property of properties) {
				const propertyBookings = bookings
					.filter(b => b.property_id === property.id)
					.sort((a, b) => new Date(a.arrival).getTime() - new Date(b.arrival).getTime());

				for (let i = 0; i < propertyBookings.length - 1; i++) {
					const currentDeparture = new Date(propertyBookings[i].departure);
					const nextArrival = new Date(propertyBookings[i + 1].arrival);
					const gapDays = Math.floor((nextArrival.getTime() - currentDeparture.getTime()) / (1000 * 60 * 60 * 24));

					if (gapDays === 1) singleNightGaps++;
					else if (gapDays === 2) twoNightGaps++;
					else if (gapDays === 3) threeNightGaps++;
				}
			}
		}
		
		const propertyMetrics = properties?.map(p => {
			const propertyBookings = bookings?.filter(b => b.property_id === p.id) || [];
			const revenue = propertyBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
			const nights = propertyBookings.reduce((sum, b) => {
				const n = Math.ceil(
					(new Date(b.departure).getTime() - new Date(b.arrival).getTime()) / 
					(1000 * 60 * 60 * 24)
				);
				return sum + n;
			}, 0);
			
			const totalDays = Math.ceil(
				(new Date(dates.to).getTime() - new Date(dates.from).getTime()) / 
				(1000 * 60 * 60 * 24)
			) + 1;
			
			return {
				propertyName: p.name,
				revenue,
				bookings: propertyBookings.length,
				nights,
				occupancyRate: nights / totalDays
			};
		}) || [];
		
		const result: any = {
			module,
			title: module === 'properties' ? 'Property Performance' : 
			       module === 'occupancy' ? 'Occupancy Report' : 'Revenue by Property',
			data: propertyMetrics
		};
		
		if (module === 'occupancy' || module === 'properties') {
			result.data = {
				...result.data,
				gapAnalysis: {
					singleNightGaps,
					twoNightGaps,
					threeNightGaps
				}
			};
			if (Array.isArray(propertyMetrics)) {
				result.data = propertyMetrics;
				result.data.gapAnalysis = {
					singleNightGaps,
					twoNightGaps,
					threeNightGaps
				};
			}
		}
		
		return result;
	}
	
	private async generateFinancialSection(tenantId: string, module: string, dates: any) {
		const { data: bookings } = await this.supabase
			.from('bookings')
			.select('*')
			.eq('tenant_id', tenantId)
			.gte('arrival', dates.from)
			.lte('arrival', dates.to)
			.neq('status', 'canceled');

		const revenue = bookings?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0;

		// Fetch actual platform fees from the database
		const { data: platformFeeRecords } = await this.supabase
			.from('platform_fees')
			.select('*')
			.eq('tenant_id', tenantId)
			.gte('booking_date', dates.from)
			.lte('booking_date', dates.to);

		// Calculate fees by platform from actual data
		const platformFees = platformFeeRecords?.reduce((sum, f) => sum + (f.fee_amount || 0), 0) || 0;

		const feesByPlatform = new Map<string, number>();
		platformFeeRecords?.forEach(f => {
			const platform = f.platform || 'Unknown';
			feesByPlatform.set(platform, (feesByPlatform.get(platform) || 0) + (f.fee_amount || 0));
		});

		const airbnbFees = feesByPlatform.get('Airbnb') || 0;
		const vrboFees = feesByPlatform.get('VRBO') || feesByPlatform.get('Vrbo') || 0;
		const bookingFees = feesByPlatform.get('Booking.com') || 0;
		const otherFees = Array.from(feesByPlatform.entries())
			.filter(([p]) => !['Airbnb', 'VRBO', 'Vrbo', 'Booking.com'].includes(p))
			.reduce((sum, [, fee]) => sum + fee, 0);

		const netRevenue = revenue - platformFees;
		const expenses = platformFees; // For now, expenses = platform fees (can expand later)
		const netProfit = netRevenue - expenses;
		const profitMargin = revenue > 0 ? netProfit / revenue : 0;
		
		const monthlyRevenue: any[] = [];
		const monthMap = new Map();
		bookings?.forEach(b => {
			if (b.arrival) {
				const month = b.arrival.substring(0, 7);
				if (!monthMap.has(month)) {
					monthMap.set(month, { revenue: 0, bookings: 0 });
				}
				const m = monthMap.get(month);
				m.revenue += b.total_amount || 0;
				m.bookings++;
			}
		});
		
		monthMap.forEach((value, key) => {
			monthlyRevenue.push({ month: key, ...value });
		});
		monthlyRevenue.sort((a, b) => a.month.localeCompare(b.month));
		
		return {
			module,
			title: module === 'pl' ? 'Profit & Loss' :
			       module === 'revenue' ? 'Revenue Summary' :
			       module === 'expenses' ? 'Expense Report' : 'Financial Trends',
			data: {
				revenue,
				platformFees,
				airbnbFees,
				vrboFees,
				bookingFees,
				otherFees,
				netRevenue,
				expenses,
				netProfit,
				profitMargin,
				bookingCount: bookings?.length || 0,
				avgBookingValue: bookings?.length ? revenue / bookings.length : 0,
				monthlyRevenue
			}
		};
	}
	
	private async generateTaxSection(tenantId: string, module: string, dates: any) {
		const taxCalculator = new TaxCalculator(this.supabase);
		const taxData = await taxCalculator.calculatePeriodTaxes(
			tenantId,
			dates.from,
			dates.to
		);
		
		return {
			module,
			title: 'Tax Report',
			data: {
				totalRevenue: taxData.summary.totalRevenue,
				taxableRevenue: taxData.summary.totalRevenue,
				estimatedTax: taxData.summary.totalTax,
				actualTax: taxData.summary.totalTax,
				ownerRemitted: taxData.summary.ownerRemittedTax,
				platformRemitted: taxData.summary.platformRemittedTax,
				effectiveRate: taxData.summary.effectiveRate,
				bookingCount: taxData.summary.bookingCount,
				byProperty: taxData.byProperty,
				byMonth: taxData.byMonth,
				byJurisdiction: taxData.byJurisdiction
			}
		};
	}
	
	private async generateGuestSection(tenantId: string, module: string, dates: any) {
		const { data: bookings } = await this.supabase
			.from('bookings')
			.select('*')
			.eq('tenant_id', tenantId)
			.gte('arrival', dates.from)
			.lte('arrival', dates.to)
			.neq('status', 'canceled');
		
		const guestMap = new Map();
		bookings?.forEach(b => {
			// Use email as primary identifier when available, fall back to guest_name
			// This prevents treating guests with same names as the same person
			const guestId = b.guest_email?.toLowerCase() || `name:${b.guest_name?.toLowerCase()}`;
			if (guestId && (b.guest_email || b.guest_name)) {
				if (!guestMap.has(guestId)) {
					guestMap.set(guestId, {
						name: b.guest_name || b.guest_email,
						bookings: 0,
						revenue: 0,
						nights: 0
					});
				}
				const guest = guestMap.get(guestId);
				guest.bookings++;
				guest.revenue += b.total_amount || 0;
				const nights = Math.ceil(
					(new Date(b.departure).getTime() - new Date(b.arrival).getTime()) /
					(1000 * 60 * 60 * 24)
				);
				guest.nights += nights;
			}
		});
		
		const guests = Array.from(guestMap.values());
		const repeatGuests = guests.filter(g => g.bookings > 1).length;
		const totalRevenue = guests.reduce((sum, g) => sum + g.revenue, 0);
		const totalNights = guests.reduce((sum, g) => sum + g.nights, 0);
		const avgSpend = guests.length > 0 ? totalRevenue / guests.length : 0;
		const avgStayLength = guests.length > 0 ? totalNights / bookings?.length! : 0;
		
		return {
			module,
			title: 'Guest Analytics',
			data: {
				totalGuests: guests.length,
				repeatGuests,
				returningGuests: repeatGuests,
				repeatRate: guests.length > 0 ? repeatGuests / guests.length : 0,
				avgSpend,
				avgStayLength,
				totalRevenue,
				topGuests: guests.sort((a, b) => b.revenue - a.revenue).slice(0, 10)
			}
		};
	}
	
	private async generateChannelSection(tenantId: string, module: string, dates: any) {
		const { data: bookings } = await this.supabase
			.from('bookings')
			.select('*')
			.eq('tenant_id', tenantId)
			.gte('arrival', dates.from)
			.lte('arrival', dates.to)
			.neq('status', 'canceled');
		
		const channelMap = new Map();
		bookings?.forEach(b => {
			const channel = b.platform || 'Direct';
			if (!channelMap.has(channel)) {
				channelMap.set(channel, { count: 0, revenue: 0 });
			}
			const ch = channelMap.get(channel);
			ch.count++;
			ch.revenue += b.total_amount || 0;
		});
		
		return {
			module,
			title: 'Channel Analysis',
			data: Array.from(channelMap.entries()).map(([channel, data]) => ({
				channel,
				bookings: data.count,
				revenue: data.revenue,
				avgValue: data.count > 0 ? data.revenue / data.count : 0
			}))
		};
	}
	
	private async generateTrendsSection(tenantId: string, module: string, dates: any) {
		const { data: bookings } = await this.supabase
			.from('bookings')
			.select('*')
			.eq('tenant_id', tenantId)
			.gte('arrival', dates.from)
			.lte('departure', dates.to)
			.neq('status', 'canceled');
		
		const monthlyData = new Map();
		bookings?.forEach(b => {
			const month = b.arrival.substring(0, 7);
			if (!monthlyData.has(month)) {
				monthlyData.set(month, { bookings: 0, revenue: 0, nights: 0 });
			}
			const m = monthlyData.get(month);
			m.bookings++;
			m.revenue += b.total_amount || 0;
			m.nights += Math.ceil(
				(new Date(b.departure).getTime() - new Date(b.arrival).getTime()) / 
				(1000 * 60 * 60 * 24)
			);
		});
		
		return {
			module,
			title: 'Occupancy Trends',
			data: Array.from(monthlyData.entries()).map(([month, data]) => ({
				month,
				...data
			})).sort((a, b) => a.month.localeCompare(b.month))
		};
	}
	
	async generatePDF(reportData: any): Promise<string> {
		return this.generateHTML(reportData);
	}
	
	private generateHTML(reportData: any): string {
		const { sections, period } = reportData;
		
		let html = `
		<!DOCTYPE html>
		<html>
		<head>
			<meta charset="UTF-8">
			<title>Report - ${period.from} to ${period.to}</title>
			<style>
				@media print {
					body { margin: 0; }
					.pagebreak { page-break-after: always; }
					@page { margin: 0.5in; }
				}
				body { 
					font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
					margin: 40px;
					color: #333;
					line-height: 1.6;
				}
				h1 { 
					color: #1a1a1a;
					border-bottom: 3px solid #3b82f6;
					padding-bottom: 12px;
					margin-bottom: 24px;
					font-size: 28px;
				}
				h2 { 
					color: #4b5563;
					margin-top: 32px;
					margin-bottom: 16px;
					font-size: 20px;
					border-bottom: 1px solid #e5e7eb;
					padding-bottom: 8px;
				}
				h3 {
					color: #6b7280;
					margin-top: 24px;
					margin-bottom: 12px;
					font-size: 16px;
				}
				table { 
					width: 100%;
					border-collapse: collapse;
					margin: 20px 0;
					font-size: 14px;
				}
				th, td { 
					padding: 10px;
					text-align: left;
					border-bottom: 1px solid #e5e7eb;
				}
				th { 
					background-color: #f9fafb;
					font-weight: 600;
					color: #374151;
					border-top: 1px solid #e5e7eb;
				}
				tr:hover { background-color: #f9fafb; }
				.metric { 
					display: inline-block;
					margin: 12px 24px 12px 0;
					padding: 16px;
					background: #f9fafb;
					border-radius: 8px;
					border: 1px solid #e5e7eb;
				}
				.metric-label { 
					color: #6b7280;
					font-size: 12px;
					text-transform: uppercase;
					letter-spacing: 0.5px;
					margin-bottom: 4px;
				}
				.metric-value { 
					font-size: 28px;
					font-weight: bold;
					color: #1a1a1a;
				}
				.period { 
					color: #6b7280;
					font-size: 14px;
					margin-bottom: 24px;
					padding: 12px;
					background: #f3f4f6;
					border-radius: 6px;
				}
				.footer {
					margin-top: 48px;
					padding-top: 24px;
					border-top: 1px solid #e5e7eb;
					color: #9ca3af;
					font-size: 12px;
					text-align: center;
				}
			</style>
		</head>
		<body>
			<h1>Property Management Report</h1>
			<div class="period">Report Period: ${new Date(period.from).toLocaleDateString()} to ${new Date(period.to).toLocaleDateString()}</div>
		`;
		
		for (const section of sections) {
			if (!section || !section.title) continue;
			
			html += `<h2>${section.title}</h2>`;
			
			if (!section.data) {
				html += '<p>No data available</p>';
				continue;
			}
			
			if (Array.isArray(section.data)) {
				html += '<table><thead><tr>';
				if (section.data.length > 0) {
					Object.keys(section.data[0]).forEach(key => {
						html += `<th>${this.formatHeader(key)}</th>`;
					});
					html += '</tr></thead><tbody>';
					section.data.forEach((row: any) => {
						html += '<tr>';
						Object.values(row).forEach((val: any) => {
							html += `<td>${this.formatValue(val)}</td>`;
						});
						html += '</tr>';
					});
					html += '</tbody>';
				} else {
					html += '</tr></thead><tbody><tr><td>No records found</td></tr></tbody>';
				}
				html += '</table>';
			} else if (typeof section.data === 'object' && section.data !== null) {
				const entries = Object.entries(section.data).filter(([key, value]) => 
					!Array.isArray(value) && typeof value !== 'object'
				);
				
				if (entries.length > 0) {
					entries.forEach(([key, value]) => {
						html += `
							<div class="metric">
								<div class="metric-label">${this.formatHeader(key)}</div>
								<div class="metric-value">${this.formatValue(value)}</div>
							</div>
						`;
					});
				}
				
				const arrayEntries = Object.entries(section.data).filter(([key, value]) => 
					Array.isArray(value)
				);
				
				arrayEntries.forEach(([key, value]: [string, any]) => {
					if (value.length > 0) {
						html += `<h3>${this.formatHeader(key)}</h3><table><thead><tr>`;
						Object.keys(value[0]).forEach(k => {
							html += `<th>${this.formatHeader(k)}</th>`;
						});
						html += '</tr></thead><tbody>';
						value.forEach((row: any) => {
							html += '<tr>';
							Object.values(row).forEach((val: any) => {
								html += `<td>${this.formatValue(val)}</td>`;
							});
							html += '</tr>';
						});
						html += '</tbody></table>';
					}
				});
			}
		}
		
		html += `
			<div class="footer">
				<p>Generated on ${new Date().toLocaleString()}</p>
				<p>© ${new Date().getFullYear()} Property Management System</p>
			</div>
		</body>
		</html>`;
		
		return html;
	}
	
	private formatHeader(key: string): string {
		return key
			.replace(/([A-Z])/g, ' $1')
			.replace(/_/g, ' ')
			.replace(/^./, str => str.toUpperCase());
	}
	
	private formatValue(value: any): string {
		if (value === null || value === undefined) return '-';
		if (typeof value === 'number') {
			if (value > 1000) return `$${value.toFixed(2)}`;
			if (value < 1) return `${(value * 100).toFixed(1)}%`;
			return value.toFixed(0);
		}
		if (value instanceof Date) return value.toLocaleDateString();
		if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/)) {
			return new Date(value).toLocaleDateString();
		}
		return String(value);
	}
}