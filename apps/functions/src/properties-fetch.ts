import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import axios, { AxiosError } from 'axios';
import { OWNERREZ_API } from '@baileys/constants';
import { createSuccessResponse, createErrorResponse } from './utils/httpResponses';

type OwnerRezAddress = {
  street1?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
};

type OwnerRezProperty = {
  id: number;
  name: string;
  address: OwnerRezAddress;
  bedrooms: number;
  bathrooms: number;
  max_guests: number;
  active: boolean;
  latitude?: number;
  longitude?: number;
  thumbnail_url?: string;
  public_url?: string;
};

type OwnerRezResponse = {
  status: string;
  total_count: number;
  page_count: number;
  items: OwnerRezProperty[];
};

type FetchPropertiesState =
  | { status: 'loading' }
  | { status: 'success'; data: TransformedProperty[]; totalCount: number }
  | { status: 'error'; error: string; details?: unknown };

type TransformedProperty = {
  ownerRezId: string;
  name: string;
  address: string;
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  active: boolean;
  coordinates?: { lat: number; lng: number };
  thumbnailUrl?: string;
  publicUrl?: string;
};

const formatAddress = (address: OwnerRezAddress): string => {
  return [
    address.street1,
    address.city,
    address.state,
    address.postal_code
  ]
    .filter(Boolean)
    .join(', ');
};

const transformProperty = (prop: OwnerRezProperty): TransformedProperty => {
  const base: TransformedProperty = {
    ownerRezId: prop.id.toString(),
    name: prop.name,
    address: formatAddress(prop.address),
    bedrooms: prop.bedrooms,
    bathrooms: prop.bathrooms,
    maxGuests: prop.max_guests,
    active: prop.active
  };

  if (prop.latitude && prop.longitude) {
    base.coordinates = { lat: prop.latitude, lng: prop.longitude };
  }

  if (prop.thumbnail_url) {
    base.thumbnailUrl = prop.thumbnail_url;
  }

  if (prop.public_url) {
    base.publicUrl = prop.public_url;
  }

  return base;
};

const transformProperties = (response: OwnerRezResponse): FetchPropertiesState => ({
  status: 'success',
  data: response.items.map(transformProperty),
  totalCount: response.total_count
});

const getErrorDetails = (error: unknown): { message: string; details?: unknown } => {
  if (axios.isAxiosError(error)) {
    return {
      message: `OwnerRez API Error: ${error.response?.status} ${error.response?.statusText}`,
      details: error.response?.data
    };
  }

  if (error instanceof Error) {
    return { message: error.message };
  }

  return { message: 'Unknown error occurred' };
};

const stateToHttpResponse = (state: FetchPropertiesState): HttpResponseInit => {
  switch (state.status) {
    case 'success':
      return createSuccessResponse({
        totalCount: state.totalCount,
        properties: state.data
      });

    case 'error':
      return createErrorResponse(state.error, 500);

    case 'loading':
      return createErrorResponse('Unexpected loading state');
  }
};

export async function fetchProperties(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const token = process.env.OWNERREZ_PAT;

  if (!token) {
    return stateToHttpResponse({
      status: 'error',
      error: 'OWNERREZ_PAT environment variable not set'
    });
  }

  try {
    const response = await axios.get<OwnerRezResponse>(`${OWNERREZ_API.BASE_URL}/properties`, {
      auth: {
        username: 'test@example.com',
        password: token
      },
      headers: {
        'Accept': 'application/json'
      },
      params: {
        active: true,
        include_fields: true,
        include_tags: true
      }
    });

    const state = transformProperties(response.data);
    return stateToHttpResponse(state);

  } catch (error) {
    const { message, details } = getErrorDetails(error);
    context.error('Failed to fetch properties:', { message, details });

    return stateToHttpResponse({
      status: 'error',
      error: message,
      details
    });
  }
}

app.http('fetch-properties', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: fetchProperties
});
