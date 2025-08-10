import { HttpRequest, HttpResponseInit } from '@azure/functions'
import { z, ZodError, ZodSchema } from 'zod'
import { corsHeaders } from './auth'

export interface ValidatedRequest<T = any, Q = any, P = any> extends HttpRequest {
  validated?: {
    body?: T
    query?: Q
    params?: P
  }
}

export interface ValidationSchemas {
  body?: ZodSchema
  query?: ZodSchema
  params?: ZodSchema
}

export const validate = (schemas: ValidationSchemas) => {
  return async (
    request: HttpRequest
  ): Promise<{ valid: true; data: ValidatedRequest } | { valid: false; response: HttpResponseInit }> => {
    try {
      const validated: ValidatedRequest['validated'] = {}

      // Validate body if schema provided
      if (schemas.body) {
        const body = await request.json().catch(() => null)
        validated.body = schemas.body.parse(body)
      }

      // Validate query parameters if schema provided
      if (schemas.query) {
        const queryParams: Record<string, any> = {}
        request.query.forEach((value, key) => {
          queryParams[key] = value
        })
        validated.query = schemas.query.parse(queryParams)
      }

      // Validate route parameters if schema provided
      if (schemas.params && request.params) {
        // In Azure Functions v4, params come from the route pattern
        validated.params = schemas.params.parse(request.params)
      }

      // Attach validated data to request
      const validatedRequest = request as ValidatedRequest
      validatedRequest.validated = validated

      return { valid: true, data: validatedRequest }
    } catch (error) {
      if (error instanceof ZodError) {
        return {
          valid: false,
          response: {
            status: 400,
            headers: corsHeaders(),
            jsonBody: {
              error: 'Validation error',
              details: error.errors.map(e => ({
                path: e.path.join('.'),
                message: e.message
              }))
            }
          }
        }
      }

      return {
        valid: false,
        response: {
          status: 400,
          headers: corsHeaders(),
          jsonBody: { error: 'Invalid request data' }
        }
      }
    }
  }
}

// Helper to combine auth and validation
import { AuthCheckResult, requireAuth } from './auth'

export const requireAuthWithValidation = async (
  request: HttpRequest,
  schemas?: ValidationSchemas
): Promise<
  | { authenticated: true; valid: true; request: ValidatedRequest & { auth: any } }
  | { authenticated: false; valid: false; response: HttpResponseInit }
> => {
  // Check auth first
  const authCheck = await requireAuth(request)
  if (!authCheck.authenticated) {
    return { authenticated: false, valid: false, response: authCheck.response }
  }

  // Then validate if schemas provided
  if (schemas) {
    const validation = await validate(schemas)(authCheck.request)
    if (!validation.valid) {
      return { authenticated: false, valid: false, response: validation.response }
    }

    // Merge auth and validated data
    const finalRequest = validation.data as any
    finalRequest.auth = (authCheck.request as any).auth
    return { authenticated: true, valid: true, request: finalRequest }
  }

  return { authenticated: true, valid: true, request: authCheck.request as any }
}