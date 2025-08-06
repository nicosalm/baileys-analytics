import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { query } from './services/database';
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth';

type Tag = {
  id: string;
  name: string;
  color?: string;
  usageCount: number;
}

export async function getTags(
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
    // Get all tags with usage counts
    const result = await query<{
      id: string;
      name: string;
      color: string | null;
      property_count: string;
      booking_count: string;
    }>(
      `SELECT
        t.id,
        t.name,
        t.color,
        COUNT(DISTINCT pt.property_id) as property_count,
        COUNT(DISTINCT bt.booking_id) as booking_count
      FROM tags t
      LEFT JOIN property_tags pt ON t.id = pt.tag_id
      LEFT JOIN booking_tags bt ON t.id = bt.tag_id
      WHERE t.tenant_id = $1
      GROUP BY t.id, t.name, t.color
      ORDER BY t.name`,
      [auth.tenantId]
    );

    if (!result.success) {
      throw new Error('Failed to fetch tags');
    }

    const tags: Tag[] = result.data.map(row => ({
      id: row.id,
      name: row.name,
      color: row.color || undefined,
      usageCount: parseInt(row.property_count) + parseInt(row.booking_count)
    }));

    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: tags
    };
  } catch (error) {
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: {
        error: error instanceof Error ? error.message : 'Failed to fetch tags'
      }
    };
  }
}

app.http('tags', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: getTags
});
