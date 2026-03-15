export function normalizePlatform(platform: string | null): string {
  if (!platform) return 'Direct';
  const normalized = platform.toLowerCase().trim();

  if (normalized === 'unassigned') return 'Direct';
  if (normalized.includes('airbnb')) return 'Airbnb';
  if (normalized.includes('vrbo') || normalized.includes('homeaway')) return 'VRBO';
  if (normalized.includes('booking')) return 'Booking.com';
  if (normalized.includes('google')) return 'Google Vacation Rentals';
  if (normalized.includes('hopper')) return 'Hopper';
  if (normalized.includes('hometogo')) return 'HomeToGo';
  if (normalized.includes('tripadvisor')) return 'TripAdvisor';
  if (normalized.includes('expedia') || normalized.includes('hotels.com')) return 'Expedia';
  if (normalized.includes('direct') || normalized.includes('owner') || normalized.includes('website') || normalized.includes('repeat')) return 'Direct';

  // custom domains (e.g. doorcountystay.com) are the tenant's own booking site
  if (/\.\w{2,}$/.test(normalized)) return 'Direct';

  return 'Other';
}
