import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import axios from 'axios';
import { OWNERREZ_API } from '@baileys/constants';
import { query, transaction } from './services/database';

type SyncState =
  | { status: 'loading' }
  | { status: 'success'; propertiesSynced: number; tenantId: string }
  | { status: 'error'; error: string; details?: unknown };

const JERRY_TENANT_ID = '00000000-0000-0000-0000-000000000001'; // Temporary hardcoded ID

async function ensureTenant(email: string, ownerrezUserId: string, companyName?: string): Promise<string> {
  const existingResult = await query<{ id: string }>(
    'SELECT id FROM tenants WHERE email = $1',
    [email]
  );

  if (existingResult.success && existingResult.data.length > 0) {
    return existingResult.data[0].id;
  }

  const insertResult = await query<{ id: string }>(
    `INSERT INTO tenants (id, email, company_name, ownerrez_user_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE
     SET company_name = EXCLUDED.company_name,
         ownerrez_user_id = EXCLUDED.ownerrez_user_id
     RETURNING id`,
    [JERRY_TENANT_ID, email, companyName, ownerrezUserId]
  );

  if (!insertResult.success) {
    throw new Error(`Failed to create tenant: ${insertResult.error}`);
  }

  return insertResult.data[0].id;
}

async function syncProperty(tenantId: string, property: any): Promise<void> {
  const result = await query(
    `INSERT INTO properties (
      tenant_id, ownerrez_id, name, address, city, state, postal_code,
      bedrooms, bathrooms, max_guests, latitude, longitude,
      thumbnail_url, public_url, active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    ON CONFLICT (tenant_id, ownerrez_id) DO UPDATE SET
      name = EXCLUDED.name,
      address = EXCLUDED.address,
      city = EXCLUDED.city,
      state = EXCLUDED.state,
      postal_code = EXCLUDED.postal_code,
      bedrooms = EXCLUDED.bedrooms,
      bathrooms = EXCLUDED.bathrooms,
      max_guests = EXCLUDED.max_guests,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      thumbnail_url = EXCLUDED.thumbnail_url,
      public_url = EXCLUDED.public_url,
      active = EXCLUDED.active,
      updated_at = CURRENT_TIMESTAMP`,
    [
      tenantId,
      property.id.toString(),
      property.name,
      property.address?.street1 || '',
      property.address?.city || '',
      property.address?.state || '',
      property.address?.postal_code || '',
      property.bedrooms,
      property.bathrooms,
      property.max_guests,
      property.latitude,
      property.longitude,
      property.thumbnail_url,
      property.public_url,
      property.active
    ]
  );

  if (!result.success) {
    throw new Error(`Failed to sync property ${property.name}: ${result.error}`);
  }
}

export async function syncProperties(
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
    // Fetch user info
    const userResponse = await axios.get(`${OWNERREZ_API.BASE_URL}/users/me`, {
      auth: {
        username: 'jerry@***REMOVED***',
        password: token
      },
      headers: { 'Accept': 'application/json' }
    });

    const { email_address, id: ownerrezUserId, company_name } = userResponse.data;

    // Ensure tenant exists
    const tenantId = await ensureTenant(email_address, ownerrezUserId.toString(), company_name);

    // Fetch properties
    const propertiesResponse = await axios.get(`${OWNERREZ_API.BASE_URL}/properties`, {
      auth: {
        username: 'jerry@***REMOVED***',
        password: token
      },
      headers: { 'Accept': 'application/json' },
      params: { active: true }
    });

    // Sync each property
    let syncedCount = 0;
    for (const property of propertiesResponse.data.items) {
      await syncProperty(tenantId, property);
      syncedCount++;
    }

    const state: SyncState = {
      status: 'success',
      propertiesSynced: syncedCount,
      tenantId
    };

    return {
      status: 200,
      jsonBody: state
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    context.error('Sync failed:', error);

    return {
      status: 500,
      jsonBody: {
        status: 'error',
        error: errorMessage
      }
    };
  }
}

app.http('sync-properties', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: syncProperties
});
