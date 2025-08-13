import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import axios from 'axios';
import { OWNERREZ_API } from '@baileys/constants';
import { formatDateISO } from './utils/dates';

type BookingCharge = {
  amount: number;
  description: string;
  type: 'rent' | 'tax' | 'fee' | 'surcharge' | 'damage_waiver' | 'other';
  is_taxable: boolean;
  tax_id?: number;
  position: number;
};

type OwnerRezBooking = {
  id: number;
  property_id: number;
  guest_id: number;
  arrival: string;
  departure: string;
  adults: number;
  children: number;
  infants: number;
  pets: number;
  status: string;
  total_amount: number;
  charges?: BookingCharge[];
  guest?: {
    id: number;
    first_name: string;
    last_name: string;
  };
  listing_site?: string;
  platform_reservation_number?: string;
  booked_utc: string;
  canceled_utc?: string;
};

type FetchBookingsState =
  | { status: 'loading' }
  | { status: 'success'; bookings: any[]; totalCount: number }
  | { status: 'error'; error: string; details?: unknown };

export async function fetchBookings(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const token = process.env.OWNERREZ_PAT;

  if (!token) {
    return {
      status: 500,
      body: 'OWNERREZ_PAT environment variable not set'
    };
  }

  try {
    const propertyIds = request.query.get('property_ids') || '';
    const fromDate = request.query.get('from') || formatDateISO(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));
    const toDate = request.query.get('to') || formatDateISO(new Date());

    context.log('Fetching bookings:', { propertyIds, fromDate, toDate });

    const response = await axios.get(`${OWNERREZ_API.BASE_URL}/bookings`, {
      auth: {
        username: 'martina@***REMOVED***',
        password: token
      },
      headers: {
        'Accept': 'application/json'
      },
      params: {
        property_ids: propertyIds,
        from: fromDate,
        to: toDate,
        include_charges: true,
        include_guest: true,
        limit: 100
      }
    });

    context.log('Sample booking:', JSON.stringify(response.data.items[0], null, 2));

    const state: FetchBookingsState = {
      status: 'success',
      bookings: response.data.items,
      totalCount: response.data.items.length
    };

    return {
      status: 200,
      jsonBody: state
    };

  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 500;
      const statusText = error.response?.statusText || 'Unknown error';
      context.error('OwnerRez API error:', {
        status,
        statusText,
        data: error.response?.data
      });

      return {
        status,
        jsonBody: {
          status: 'error',
          error: `OwnerRez API Error: ${status} ${statusText}`,
          details: error.response?.data
        }
      };
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      status: 500,
      jsonBody: {
        status: 'error',
        error: errorMessage
      }
    };
  }
}

app.http('fetch-bookings', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: fetchBookings
});
