import { HttpRequest, HttpResponseInit } from '@azure/functions';
import { verifyAccessToken } from '../services/auth';

export type AuthenticatedRequest = HttpRequest & {
  auth: {
    userId: string;
    email: string;
    tenantId?: string;
  };
};

export const requireAuth = async (
  request: HttpRequest
): Promise<{ authenticated: true; request: AuthenticatedRequest } | { authenticated: false; response: HttpResponseInit }> => {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      authenticated: false,
      response: {
        status: 401,
        jsonBody: { error: 'Missing authorization header' }
      }
    };
  }

  const token = authHeader.substring(7);
  const authResult = await verifyAccessToken(token);

  if (!authResult.success) {
    return {
      authenticated: false,
      response: {
        status: authResult.status || 401,
        jsonBody: { error: authResult.error }
      }
    };
  }

  // Add auth info to request
  const authenticatedRequest = request as AuthenticatedRequest;
  authenticatedRequest.auth = {
    userId: authResult.userId,
    email: authResult.email,
    tenantId: authResult.tenantId
  };

  return {
    authenticated: true,
    request: authenticatedRequest
  };
};

// Helper to add CORS headers
export const corsHeaders = (origin?: string) => ({
  'Access-Control-Allow-Origin': origin || process.env.FRONTEND_URL || 'http://localhost:5173',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Credentials': 'true'
});

// Options handler for CORS preflight
export const handleOptions = (): HttpResponseInit => ({
  status: 204,
  headers: corsHeaders()
});
