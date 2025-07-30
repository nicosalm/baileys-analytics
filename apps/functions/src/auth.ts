import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { query } from './services/database';
import {
  hashPassword,
  verifyPassword,
  generateTokenPair,
  verifyRefreshToken,
  revokeRefreshToken,
  cleanupExpiredTokens
} from './services/auth';
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth';

type SignupRequest = {
  email: string;
  password: string;
};

type LoginRequest = {
  email: string;
  password: string;
};

type RefreshRequest = {
  refreshToken: string;
};

// Signup endpoint
export async function signup(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') {
    return handleOptions();
  }

  try {
    const body = await request.json() as SignupRequest;
    const { email, password } = body;

    if (!email || !password) {
      return {
        status: 400,
        headers: corsHeaders(),
        jsonBody: { error: 'Email and password are required' }
      };
    }

    if (password.length < 8) {
      return {
        status: 400,
        headers: corsHeaders(),
        jsonBody: { error: 'Password must be at least 8 characters' }
      };
    }

    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingUser.success && existingUser.data.length > 0) {
      return {
        status: 409,
        headers: corsHeaders(),
        jsonBody: { error: 'User already exists' }
      };
    }

    // Create user
    const passwordHash = await hashPassword(password);
    const createResult = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id`,
      [email.toLowerCase(), passwordHash]
    );

    if (!createResult.success) {
      throw new Error('Failed to create user');
    }

    const userId = createResult.data[0].id;
    const tokens = await generateTokenPair(userId, email);

    return {
      status: 201,
      headers: corsHeaders(),
      jsonBody: {
        userId,
        email,
        ...tokens
      }
    };
  } catch (error) {
    context.error('Signup error:', error);
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: { error: 'Internal server error' }
    };
  }
}

// Login endpoint
export async function login(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') {
    return handleOptions();
  }

  try {
    const body = await request.json() as LoginRequest;
    const { email, password } = body;

    if (!email || !password) {
      return {
        status: 400,
        headers: corsHeaders(),
        jsonBody: { error: 'Email and password are required' }
      };
    }

    // Get user
    const userResult = await query<{
      id: string;
      email: string;
      password_hash: string;
      tenant_id?: string;
    }>(
      'SELECT id, email, password_hash, tenant_id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (!userResult.success || userResult.data.length === 0) {
      return {
        status: 401,
        headers: corsHeaders(),
        jsonBody: { error: 'Invalid email or password' }
      };
    }

    const user = userResult.data[0];

    // Verify password
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return {
        status: 401,
        headers: corsHeaders(),
        jsonBody: { error: 'Invalid email or password' }
      };
    }

    // Generate tokens
    const tokens = await generateTokenPair(user.id, user.email, user.tenant_id);

    // Clean up old tokens
    await cleanupExpiredTokens();

    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: {
        userId: user.id,
        email: user.email,
        tenantId: user.tenant_id,
        ...tokens
      }
    };
  } catch (error) {
    context.error('Login error:', error);
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: { error: 'Internal server error' }
    };
  }
}

// Refresh token endpoint
export async function refresh(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  if (request.method === 'OPTIONS') {
    return handleOptions();
  }

  try {
    const body = await request.json() as RefreshRequest;
    const { refreshToken } = body;

    if (!refreshToken) {
      return {
        status: 400,
        headers: corsHeaders(),
        jsonBody: { error: 'Refresh token is required' }
      };
    }

    // Verify refresh token
    const authResult = await verifyRefreshToken(refreshToken);
    if (!authResult.success) {
      return {
        status: authResult.status || 401,
        headers: corsHeaders(),
        jsonBody: { error: authResult.error }
      };
    }

    // Revoke old token
    await revokeRefreshToken(authResult.userId);

    // Generate new token pair
    const tokens = await generateTokenPair(
      authResult.userId,
      authResult.email,
      authResult.tenantId
    );

    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: {
        userId: authResult.userId,
        email: authResult.email,
        tenantId: authResult.tenantId,
        ...tokens
      }
    };
  } catch (error) {
    context.error('Refresh error:', error);
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: { error: 'Internal server error' }
    };
  }
}

// Get current user endpoint
export async function me(
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

  try {
    // Get user with tenant info
    const result = await query<{
      id: string;
      email: string;
      tenant_id?: string;
      company_name?: string;
      created_at: string;
    }>(
      `SELECT u.id, u.email, u.tenant_id, t.company_name, u.created_at
       FROM users u
       LEFT JOIN tenants t ON u.tenant_id = t.id
       WHERE u.id = $1`,
      [auth.userId]
    );

    if (!result.success || result.data.length === 0) {
      return {
        status: 404,
        headers: corsHeaders(),
        jsonBody: { error: 'User not found' }
      };
    }

    const user = result.data[0];

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
    };
  } catch (error) {
    context.error('Get user error:', error);
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: { error: 'Internal server error' }
    };
  }
}

// Logout endpoint (revoke refresh tokens)
export async function logout(
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

  try {
    await revokeRefreshToken(auth.userId);

    return {
      status: 200,
      headers: corsHeaders(),
      jsonBody: { message: 'Logged out successfully' }
    };
  } catch (error) {
    context.error('Logout error:', error);
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: { error: 'Internal server error' }
    };
  }
}

// Register endpoints
app.http('auth-signup', {
  methods: ['POST', 'OPTIONS'],
  route: 'auth/signup',
  authLevel: 'anonymous',
  handler: signup
});

app.http('auth-login', {
  methods: ['POST', 'OPTIONS'],
  route: 'auth/login',
  authLevel: 'anonymous',
  handler: login
});

app.http('auth-refresh', {
  methods: ['POST', 'OPTIONS'],
  route: 'auth/refresh',
  authLevel: 'anonymous',
  handler: refresh
});

app.http('auth-me', {
  methods: ['GET', 'OPTIONS'],
  route: 'auth/me',
  authLevel: 'anonymous',
  handler: me
});

app.http('auth-logout', {
  methods: ['POST', 'OPTIONS'],
  route: 'auth/logout',
  authLevel: 'anonymous',
  handler: logout
});
