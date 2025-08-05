import { HttpRequest, HttpResponseInit } from '@azure/functions';
import { verifyAccessToken } from '../services/auth';

export type AuthInfo = {
  userId: string
  email: string
  tenantId?: string
}

export type AuthenticatedRequest = HttpRequest & {
  auth: AuthInfo
}

export type AuthCheckResult =
  | { authenticated: true; request: AuthenticatedRequest }
  | { authenticated: false; response: HttpResponseInit }

const extractBearerToken = (authHeader: string | null): string | null => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }
  return authHeader.substring(7)
}

const createUnauthorizedResponse = (error: string): HttpResponseInit => ({
  status: 401,
  headers: corsHeaders(),
  jsonBody: { error }
})

export const requireAuth = async (
  request: HttpRequest
): Promise<AuthCheckResult> => {
  const authHeader = request.headers.get('authorization')
  const token = extractBearerToken(authHeader)

  if (!token) {
    return {
      authenticated: false,
      response: createUnauthorizedResponse('Missing authorization header')
    }
  }

  const authResult = await verifyAccessToken(token)

  if (!authResult.success) {
    return {
      authenticated: false,
      response: {
        status: authResult.status || 401,
        headers: corsHeaders(),
        jsonBody: { error: authResult.error }
      }
    }
  }

  const authenticatedRequest = request as AuthenticatedRequest
  authenticatedRequest.auth = {
    userId: authResult.userId,
    email: authResult.email,
    tenantId: authResult.tenantId
  }

  return {
    authenticated: true,
    request: authenticatedRequest
  }
}

export const corsHeaders = (origin?: string) => ({
  'Access-Control-Allow-Origin': origin || process.env.FRONTEND_URL || 'http://localhost:5173',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Credentials': 'true'
})

export const handleOptions = (): HttpResponseInit => ({
  status: 204,
  headers: corsHeaders()
})
