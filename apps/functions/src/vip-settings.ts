import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { query } from './services/database';
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth';
import { vipSettingsUpdateSchema, numericStringSchema, integerStringSchema } from '@baileys/shared-types';
import { z } from 'zod';

type VIPSettings = z.infer<typeof vipSettingsUpdateSchema>;

export async function vipSettings(
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

  if (request.method === 'GET') {
    try {
      const result = await query<{
        vip_spend_threshold: string;
        vip_booking_threshold: string;
      }>(
        `SELECT vip_spend_threshold, vip_booking_threshold
         FROM users
         WHERE id = $1`,
        [auth.userId]
      );

      if (!result.success || result.data.length === 0) {
        return {
          status: 404,
          headers: corsHeaders(),
          jsonBody: {
            error: 'User settings not found',
            code: 'USER_NOT_FOUND'
          }
        };
      }

      const settings = result.data[0];
      
      // Use Zod for safe parsing
      const vipSettingsDbSchema = z.object({
        vip_spend_threshold: numericStringSchema,
        vip_booking_threshold: integerStringSchema,
      });
      
      const parsed = vipSettingsDbSchema.parse(settings);

      return {
        status: 200,
        headers: corsHeaders(),
        jsonBody: {
          status: 'success',
          data: {
            vipSpendThreshold: parsed.vip_spend_threshold,
            vipBookingThreshold: parsed.vip_booking_threshold
          }
        }
      };
    } catch (error) {
      return {
        status: 500,
        headers: corsHeaders(),
        jsonBody: {
          error: error instanceof Error ? error.message : 'Failed to fetch VIP settings'
        }
      };
    }
  }

  if (request.method === 'PUT') {
    try {
      const body = await request.json() as Partial<VIPSettings>;

      if (body.vipSpendThreshold !== undefined) {
        if (typeof body.vipSpendThreshold !== 'number' || body.vipSpendThreshold < 0) {
          return {
            status: 400,
            headers: corsHeaders(),
            jsonBody: {
              error: 'Invalid VIP spend threshold',
              code: 'INVALID_SPEND_THRESHOLD'
            }
          };
        }
      }

      if (body.vipBookingThreshold !== undefined) {
        if (!Number.isInteger(body.vipBookingThreshold) || body.vipBookingThreshold < 1) {
          return {
            status: 400,
            headers: corsHeaders(),
            jsonBody: {
              error: 'Invalid VIP booking threshold',
              code: 'INVALID_BOOKING_THRESHOLD'
            }
          };
        }
      }

      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (body.vipSpendThreshold !== undefined) {
        updates.push(`vip_spend_threshold = $${paramIndex}`);
        values.push(body.vipSpendThreshold);
        paramIndex++;
      }

      if (body.vipBookingThreshold !== undefined) {
        updates.push(`vip_booking_threshold = $${paramIndex}`);
        values.push(body.vipBookingThreshold);
        paramIndex++;
      }

      if (updates.length === 0) {
        return {
          status: 400,
          headers: corsHeaders(),
          jsonBody: {
            error: 'No settings to update',
            code: 'NO_UPDATES'
          }
        };
      }

      values.push(auth.userId);

      const updateResult = await query<{
        vip_spend_threshold: string;
        vip_booking_threshold: string;
      }>(
        `UPDATE users
         SET ${updates.join(', ')}, updated_at = NOW()
         WHERE id = $${paramIndex}
         RETURNING vip_spend_threshold, vip_booking_threshold`,
        values
      );

      if (!updateResult.success || updateResult.data.length === 0) {
        return {
          status: 500,
          headers: corsHeaders(),
          jsonBody: {
            error: 'Failed to update VIP settings'
          }
        };
      }

      const updatedSettings = updateResult.data[0];

      return {
        status: 200,
        headers: corsHeaders(),
        jsonBody: {
          status: 'success',
          data: {
            vipSpendThreshold: parseFloat(updatedSettings.vip_spend_threshold),
            vipBookingThreshold: parseInt(updatedSettings.vip_booking_threshold)
          }
        }
      };
    } catch (error) {
      return {
        status: 500,
        headers: corsHeaders(),
        jsonBody: {
          error: error instanceof Error ? error.message : 'Failed to update VIP settings'
        }
      };
    }
  }

  return {
    status: 405,
    headers: corsHeaders(),
    jsonBody: {
      error: 'Method not allowed',
      code: 'METHOD_NOT_ALLOWED'
    }
  };
}

app.http('vip-settings', {
  methods: ['GET', 'PUT', 'OPTIONS'],
  route: 'vip-settings',
  authLevel: 'anonymous',
  handler: vipSettings
});
