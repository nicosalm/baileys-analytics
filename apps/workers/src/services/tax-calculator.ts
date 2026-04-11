import { SupabaseClient } from '@supabase/supabase-js';
import { PropertyTaxJurisdiction } from '@baileys/schemas';

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
    _jurisdiction: PropertyTaxJurisdiction,
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
}