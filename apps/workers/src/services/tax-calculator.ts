import { SupabaseClient } from '@supabase/supabase-js';
import { Booking, PropertyTaxJurisdiction } from '@baileys/schemas';

interface TaxConfig {
  property_id: string;
  jurisdictions: PropertyTaxJurisdiction[];
  platform_settings?: {
    airbnb?: { remitsTax: boolean };
    vrbo?: { remitsTax: boolean };
    [key: string]: { remitsTax: boolean } | undefined;
  };
}

interface PlatformRemittanceConfig {
  platform: string;
  remits_occupancy_tax: boolean;
  remits_on_guest_fees: boolean;
}

export class TaxCalculator {
  constructor(private supabase: SupabaseClient) {}

  async calculateBookingTax(
    booking: { total_amount?: number; platform?: string; booking_charges?: Array<{ type: string; amount: number }> } & Record<string, any>,
    taxConfig: TaxConfig | null,
    platformRemittance: PlatformRemittanceConfig | null
  ) {
    if (!taxConfig || !taxConfig.jurisdictions) {
      return {
        totalTax: 0,
        ownerRemitted: 0,
        platformRemitted: 0,
        breakdown: []
      };
    }

    const baseAmount = booking.total_amount || 0;
    const platform = booking.platform?.toLowerCase() || 'direct';
    
    let totalTax = 0;
    let ownerRemitted = 0;
    let platformRemitted = 0;
    const breakdown = [];

    for (const jurisdiction of taxConfig.jurisdictions) {
      const taxAmount = (baseAmount * jurisdiction.rate) / 100;
      totalTax += taxAmount;

      const isPlatformRemitting = this.isPlatformRemitting(
        platform,
        jurisdiction,
        taxConfig.platform_settings,
        platformRemittance
      );

      if (isPlatformRemitting) {
        platformRemitted += taxAmount;
      } else {
        ownerRemitted += taxAmount;
      }

      breakdown.push({
        jurisdiction: jurisdiction.name,
        type: jurisdiction.type,
        rate: jurisdiction.rate,
        amount: taxAmount,
        remittedBy: isPlatformRemitting ? 'platform' : 'owner'
      });
    }

    return {
      totalTax,
      ownerRemitted,
      platformRemitted,
      breakdown
    };
  }

  private isPlatformRemitting(
    platform: string,
    jurisdiction: PropertyTaxJurisdiction,
    platformSettings: TaxConfig['platform_settings'],
    platformRemittance: PlatformRemittanceConfig | null
  ): boolean {
    if (!platformRemittance) return false;
    
    if (platformSettings && platformSettings[platform]) {
      return platformSettings[platform].remitsTax || false;
    }

    return platformRemittance.remits_occupancy_tax;
  }

  async getPropertyTaxConfig(propertyId: string, tenantId: string, date: string): Promise<TaxConfig | null> {
    const { data } = await this.supabase
      .from('property_tax_configs')
      .select('*')
      .eq('property_id', propertyId)
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .lte('effective_from', date)
      .order('effective_from', { ascending: false })
      .limit(1)
      .single();

    return data;
  }

  async getPlatformRemittanceConfig(platform: string, tenantId: string): Promise<PlatformRemittanceConfig | null> {
    const { data } = await this.supabase
      .from('tenant_platform_configs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('platform', platform.toLowerCase())
      .single();

    return data;
  }

  async calculatePeriodTaxes(
    tenantId: string,
    from: string,
    to: string,
    propertyId?: string
  ) {
    let bookingsQuery = this.supabase
      .from('bookings')
      .select(`
        *,
        properties!inner(id, name, internal_code),
        booking_charges(amount, type, description)
      `)
      .eq('tenant_id', tenantId)
      .lte('arrival', to)
      .gte('departure', from)
      .neq('status', 'canceled');

    if (propertyId) {
      bookingsQuery = bookingsQuery.eq('property_id', propertyId);
    }

    const { data: bookings } = await bookingsQuery;

    const { data: taxConfigs } = await this.supabase
      .from('property_tax_configs')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true);

    const { data: platformConfigs } = await this.supabase
      .from('tenant_platform_configs')
      .select('*')
      .eq('tenant_id', tenantId);

    const platformConfigMap = new Map(
      platformConfigs?.map(pc => [pc.platform.toLowerCase(), pc]) || []
    );

    const taxConfigMap = new Map(
      taxConfigs?.map(tc => [tc.property_id, tc]) || []
    );

    let totalRevenue = 0;
    let totalTax = 0;
    let ownerRemittedTax = 0;
    let platformRemittedTax = 0;
    const propertyTaxData = new Map();
    const monthlyTaxData = new Map();
    const jurisdictionTotals = new Map();

    for (const booking of bookings || []) {
      totalRevenue += booking.total_amount || 0;
      
      const existingTaxCharges = booking.booking_charges?.filter((c: any) => c.type === 'tax') || [];
      const existingTaxAmount = existingTaxCharges.reduce((sum: number, c: any) => sum + c.amount, 0);

      const taxConfig = taxConfigMap.get(booking.property_id);
      const platformConfig = platformConfigMap.get(booking.platform?.toLowerCase() || 'direct');

      let calculatedTax;
      if (taxConfig) {
        calculatedTax = await this.calculateBookingTax(booking, taxConfig, platformConfig);
      } else {
        calculatedTax = {
          totalTax: existingTaxAmount,
          ownerRemitted: existingTaxAmount,
          platformRemitted: 0,
          breakdown: []
        };
      }

      totalTax += calculatedTax.totalTax || existingTaxAmount;
      ownerRemittedTax += calculatedTax.ownerRemitted;
      platformRemittedTax += calculatedTax.platformRemitted;

      const propertyId = booking.property_id;
      if (!propertyTaxData.has(propertyId)) {
        propertyTaxData.set(propertyId, {
          propertyId,
          propertyName: booking.properties?.name || 'Unknown',
          propertyCode: booking.properties?.internal_code || null,
          totalRevenue: 0,
          totalTax: 0,
          ownerRemitted: 0,
          platformRemitted: 0,
          bookingCount: 0
        });
      }

      const propertyData = propertyTaxData.get(propertyId);
      propertyData.totalRevenue += booking.total_amount || 0;
      propertyData.totalTax += calculatedTax.totalTax || existingTaxAmount;
      propertyData.ownerRemitted += calculatedTax.ownerRemitted;
      propertyData.platformRemitted += calculatedTax.platformRemitted;
      propertyData.bookingCount++;

      const month = booking.arrival.substring(0, 7);
      if (!monthlyTaxData.has(month)) {
        monthlyTaxData.set(month, {
          month,
          totalRevenue: 0,
          totalTax: 0,
          ownerRemitted: 0,
          platformRemitted: 0,
          bookingCount: 0
        });
      }

      const monthData = monthlyTaxData.get(month);
      monthData.totalRevenue += booking.total_amount || 0;
      monthData.totalTax += calculatedTax.totalTax || existingTaxAmount;
      monthData.ownerRemitted += calculatedTax.ownerRemitted;
      monthData.platformRemitted += calculatedTax.platformRemitted;
      monthData.bookingCount++;

      for (const item of calculatedTax.breakdown) {
        const key = `${item.jurisdiction}_${item.type}`;
        if (!jurisdictionTotals.has(key)) {
          jurisdictionTotals.set(key, {
            name: item.jurisdiction,
            type: item.type,
            totalAmount: 0,
            ownerRemitted: 0,
            platformRemitted: 0
          });
        }
        const jData = jurisdictionTotals.get(key);
        jData.totalAmount += item.amount;
        if (item.remittedBy === 'platform') {
          jData.platformRemitted += item.amount;
        } else {
          jData.ownerRemitted += item.amount;
        }
      }
    }

    const effectiveRate = totalRevenue > 0 ? (totalTax / totalRevenue) * 100 : 0;

    return {
      summary: {
        totalRevenue,
        totalTax,
        ownerRemittedTax,
        platformRemittedTax,
        effectiveRate,
        bookingCount: bookings?.length || 0
      },
      byProperty: Array.from(propertyTaxData.values()).map(p => ({
        ...p,
        effectiveRate: p.totalRevenue > 0 ? (p.totalTax / p.totalRevenue) * 100 : 0
      })),
      byMonth: Array.from(monthlyTaxData.values()).map(m => ({
        ...m,
        effectiveRate: m.totalRevenue > 0 ? (m.totalTax / m.totalRevenue) * 100 : 0
      })).sort((a, b) => a.month.localeCompare(b.month)),
      byJurisdiction: Array.from(jurisdictionTotals.values())
    };
  }
}