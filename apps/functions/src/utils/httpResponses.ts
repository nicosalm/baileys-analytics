import { HttpResponseInit } from '@azure/functions';
import { corsHeaders, securityHeaders } from '../middleware/auth';

// Combine CORS and security headers
const getResponseHeaders = () => ({
  ...corsHeaders(),
  ...securityHeaders()
});

export const createSuccessResponse = (data: any): HttpResponseInit => ({
  status: 200,
  headers: getResponseHeaders(),
  jsonBody: data
});

export const createErrorResponse = (error: string, status: number = 500, code?: string): HttpResponseInit => ({
  status,
  headers: getResponseHeaders(),
  jsonBody: code ? { error, code } : { error }
});

export const createNotFoundResponse = (message: string = 'Resource not found'): HttpResponseInit => 
  createErrorResponse(message, 404);

export const createUnauthorizedResponse = (message: string = 'Unauthorized'): HttpResponseInit => 
  createErrorResponse(message, 401);

export const createForbiddenResponse = (message: string, code?: string): HttpResponseInit => 
  createErrorResponse(message, 403, code);

export const createValidationErrorResponse = (zodError: any): HttpResponseInit => ({
  status: 400,
  headers: getResponseHeaders(),
  jsonBody: { 
    error: 'Validation error',
    details: zodError.issues ? zodError.issues.map((e: any) => ({
      path: e.path.join('.'),
      message: e.message
    })) : zodError
  }
});

export const requireTenant = (tenantId: string | undefined): HttpResponseInit | null => {
  if (!tenantId) {
    return createForbiddenResponse('OwnerRez connection required', 'NO_OWNERREZ_CONNECTION');
  }
  return null;
};