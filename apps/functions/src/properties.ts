import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { query } from './services/database';
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth';

export async function getProperties(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') {
    return handleOptions();
  }

  const authCheck = await requireAuth(request);
  if (!authCheck.authenticated) {
    return authCheck.response;
  }

  const { auth } = authCheck.request;

  if (!auth.tenantId) {
    return {
      status: 403,
      headers: corsHeaders(),
      jsonBody: {
        error: 'OwnerRez connection required',
        code: 'NO_OWNERREZ_CONNECTION'
      }
    };
  }

  try {
    const result = await query<{
      id: string;
      ownerrez_id: string;
      name: string;
      address: string;
      city: string;
      state: string;
      bedrooms: number;
      bathrooms: number;
      max_guests: number;
      active: boolean;
    }>(
      `SELECT id, ownerrez_id, name, address, city, state, bedrooms, bathrooms, max_guests, active
       FROM properties
       WHERE tenant_id = $1 AND active = true
       ORDER BY name`,
      [auth.tenantId]
    );

    if (!result.success) {
      throw new Error('Failed to fetch properties');
    }

    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: {
        properties: result.data
      }
    };
  } catch (error) {
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: {
        error: error instanceof Error ? error.message : 'Failed to fetch properties'
      }
    };
  }
}

app.http('properties', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: getProperties
});
