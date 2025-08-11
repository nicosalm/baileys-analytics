import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { query, DbResult } from './services/database';
import { loginRequestSchema, signupRequestSchema } from '@baileys/shared-types';
import { z } from 'zod';
import {
  hashPassword,
  verifyPassword,
  generateTokenPair,
  verifyRefreshToken,
  revokeRefreshToken,
  cleanupExpiredTokens
} from './services/auth';
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth';
import { authLimiter, withRateLimit } from './middleware/rateLimiter';

const refreshRequestSchema = z.object({
  refreshToken: z.string()
})

type SignupRequest = z.infer<typeof signupRequestSchema>
type LoginRequest = z.infer<typeof loginRequestSchema>
type RefreshRequest = z.infer<typeof refreshRequestSchema>

type UserResponse = {
  userId: string
  email: string
  tenantId?: string
  accessToken: string
  refreshToken: string
}



const checkUserExists = async (email: string): Promise<DbResult<boolean>> => {
  const result = await query(
    'SELECT id FROM users WHERE email = $1',
    [email.toLowerCase()]
  )

  if (!result.success) {
    return result
  }

  return { success: true, data: result.data.length > 0 }
}

const createUser = async (email: string, passwordHash: string): Promise<DbResult<string>> => {
  const result = await query<{ id: string }>(
    `INSERT INTO users (email, password_hash)
     VALUES ($1, $2)
     RETURNING id`,
    [email.toLowerCase(), passwordHash]
  )

  if (!result.success) {
    return result
  }

  return { success: true, data: result.data[0].id }
}

const findUserByEmail = async (email: string): Promise<DbResult<{
  id: string
  email: string
  password_hash: string
  tenant_id?: string
}>> => {
  const result = await query<{
    id: string
    email: string
    password_hash: string
    tenant_id?: string
  }>(
    'SELECT id, email, password_hash, tenant_id FROM users WHERE email = $1',
    [email.toLowerCase()]
  )

  if (!result.success) {
    return result
  }

  if (result.data.length === 0) {
    return { success: false, error: 'User not found' }
  }

  return { success: true, data: result.data[0] }
}

const createUserResponse = async (
  userId: string,
  email: string,
  tenantId?: string
): Promise<DbResult<UserResponse>> => {
  try {
    const tokens = await generateTokenPair(userId, email, tenantId)
    return {
      success: true,
      data: {
        userId,
        email,
        tenantId,
        ...tokens
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate tokens'
    }
  }
}

export async function signup(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') {
    return handleOptions()
  }

  try {
    const bodyData = await request.json()
    const parseResult = signupRequestSchema.safeParse(bodyData)

    if (!parseResult.success) {
      return {
        status: 400,
        headers: corsHeaders(),
        jsonBody: { 
          error: 'Validation error',
          details: parseResult.error.issues.map((e: any) => ({
            path: e.path.join('.'),
            message: e.message
          }))
        }
      }
    }
    
    const body = parseResult.data

    const existsResult = await checkUserExists(body.email)
    if (!existsResult.success) {
      throw new Error('Failed to check user existence')
    }

    if (existsResult.data) {
      return {
        status: 409,
        headers: corsHeaders(),
        jsonBody: { error: 'User already exists' }
      }
    }

    const passwordHash = await hashPassword(body.password)
    const createResult = await createUser(body.email, passwordHash)

    if (!createResult.success) {
      throw new Error('Failed to create user')
    }

    const responseResult = await createUserResponse(createResult.data, body.email)
    if (!responseResult.success) {
      throw new Error(responseResult.error)
    }

    return {
      status: 201,
      headers: corsHeaders(),
      jsonBody: responseResult.data
    }
  } catch (error) {
    context.error('Signup error:', error)
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: { error: 'Internal server error' }
    }
  }
}

export async function login(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') {
    return handleOptions()
  }

  try {
    const bodyData = await request.json()
    const parseResult = loginRequestSchema.safeParse(bodyData)

    if (!parseResult.success) {
      return {
        status: 400,
        headers: corsHeaders(),
        jsonBody: { 
          error: 'Validation error',
          details: parseResult.error.issues.map((e: any) => ({
            path: e.path.join('.'),
            message: e.message
          }))
        }
      }
    }
    
    const body = parseResult.data

    const userResult = await findUserByEmail(body.email)
    if (!userResult.success) {
      return {
        status: 401,
        headers: corsHeaders(),
        jsonBody: { error: 'Invalid email or password' }
      }
    }

    const isValid = await verifyPassword(body.password, userResult.data.password_hash)
    if (!isValid) {
      return {
        status: 401,
        headers: corsHeaders(),
        jsonBody: { error: 'Invalid email or password' }
      }
    }

    const responseResult = await createUserResponse(
      userResult.data.id,
      userResult.data.email,
      userResult.data.tenant_id
    )

    if (!responseResult.success) {
      throw new Error(responseResult.error)
    }

    await cleanupExpiredTokens()

    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: responseResult.data
    }
  } catch (error) {
    context.error('Login error:', error)
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: { error: 'Internal server error' }
    }
  }
}

export async function refresh(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') {
    return handleOptions()
  }

  try {
    const bodyData = await request.json()
    const parseResult = refreshRequestSchema.safeParse(bodyData)
    
    if (!parseResult.success) {
      return {
        status: 400,
        headers: corsHeaders(),
        jsonBody: { 
          error: 'Invalid refresh token format'
        }
      }
    }
    
    const body = parseResult.data
    const { refreshToken } = body

    if (!refreshToken) {
      return {
        status: 400,
        headers: corsHeaders(),
        jsonBody: { error: 'Refresh token is required' }
      }
    }

    const authResult = await verifyRefreshToken(refreshToken)
    if (!authResult.success) {
      return {
        status: authResult.status || 401,
        headers: corsHeaders(),
        jsonBody: { error: authResult.error }
      }
    }

    await revokeRefreshToken(authResult.userId)

    const responseResult = await createUserResponse(
      authResult.userId,
      authResult.email,
      authResult.tenantId
    )

    if (!responseResult.success) {
      throw new Error(responseResult.error)
    }

    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: responseResult.data
    }
  } catch (error) {
    context.error('Refresh error:', error)
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: { error: 'Internal server error' }
    }
  }
}

export async function me(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') {
    return handleOptions()
  }

  const authCheck = await requireAuth(request)
  if (!authCheck.authenticated) {
    return authCheck.response
  }

  const { auth } = authCheck.request

  const result = await query<{
    id: string
    email: string
    tenant_id?: string
    company_name?: string
    created_at: string
  }>(
    `SELECT u.id, u.email, u.tenant_id, t.company_name, u.created_at
     FROM users u
     LEFT JOIN tenants t ON u.tenant_id = t.id
     WHERE u.id = $1`,
    [auth.userId]
  )

  if (!result.success || result.data.length === 0) {
    return {
      status: 404,
      headers: corsHeaders(),
      jsonBody: { error: 'User not found' }
    }
  }

  const user = result.data[0]

  return {
    status: 200,
    headers: corsHeaders(),
    jsonBody: {
      id: user.id,
      email: user.email,
      tenantId: user.tenant_id,
      companyName: user.company_name,
      hasOwnerRezConnection: !!user.tenant_id,
      createdAt: user.created_at
    }
  }
}

export async function logout(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') {
    return handleOptions()
  }

  const authCheck = await requireAuth(request)
  if (!authCheck.authenticated) {
    return authCheck.response
  }

  const { auth } = authCheck.request

  try {
    await revokeRefreshToken(auth.userId)

    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: { message: 'Logged out successfully' }
    }
  } catch (error) {
    context.error('Logout error:', error)
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: { error: 'Internal server error' }
    }
  }
}

export async function createTestUser(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const email = 'martina@***REMOVED***'
    const password = 'password123'

    const tenantResult = await query<{ id: string }>(
      `SELECT id FROM tenants WHERE LOWER(email) = LOWER($1)`,
      [email]
    )

    if (!tenantResult.success || tenantResult.data.length === 0) {
      return {
        status: 400,
        jsonBody: { error: 'Tenant not found' }
      }
    }

    const tenantId = tenantResult.data[0].id

    await query(
      `DELETE FROM users WHERE LOWER(email) = LOWER($1)`,
      [email]
    )

    const passwordHash = await hashPassword(password)
    const createResult = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, tenant_id)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [email.toLowerCase(), passwordHash, tenantId]
    )

    if (!createResult.success) {
      return {
        status: 500,
        jsonBody: {
          error: 'Failed to create user',
          details: createResult.error,
          email: email.toLowerCase(),
          tenantId: tenantId
        }
      }
    }

    const userId = createResult.data[0].id

    await query(
      `UPDATE tenants SET user_id = $1 WHERE id = $2`,
      [userId, tenantId]
    )

    return {
      status: 200,
      jsonBody: {
        message: 'User created successfully',
        email: email,
        password: password,
        instruction: 'Now you can login at http://localhost:5173'
      }
    }
  } catch (error) {
    return {
      status: 500,
      jsonBody: { error: error instanceof Error ? error.message : 'Failed' }
    }
  }
}

app.http('auth-signup', {
  methods: ['POST', 'OPTIONS'],
  route: 'auth/signup',
  authLevel: 'anonymous',
  handler: (req, ctx) => req.method === 'OPTIONS'
    ? handleOptions()
    : withRateLimit(authLimiter, signup)(req, ctx)
})

app.http('auth-login', {
  methods: ['POST', 'OPTIONS'],
  route: 'auth/login',
  authLevel: 'anonymous',
  handler: (req, ctx) => req.method === 'OPTIONS'
    ? handleOptions()
    : withRateLimit(authLimiter, login)(req, ctx)
})

app.http('auth-refresh', {
  methods: ['POST', 'OPTIONS'],
  route: 'auth/refresh',
  authLevel: 'anonymous',
  handler: refresh
})

app.http('auth-me', {
  methods: ['GET', 'OPTIONS'],
  route: 'auth/me',
  authLevel: 'anonymous',
  handler: me
})

app.http('auth-logout', {
  methods: ['POST', 'OPTIONS'],
  route: 'auth/logout',
  authLevel: 'anonymous',
  handler: logout
})

app.http('create-test-user', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: createTestUser
})
