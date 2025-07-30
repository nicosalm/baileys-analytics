import { SignJWT, jwtVerify } from 'jose';
import { createHash, randomBytes } from 'crypto';
import { query } from './database';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'development-secret-change-in-production'
);
const JWT_ISSUER = 'baileys-analytics';
const JWT_AUDIENCE = 'baileys-analytics-api';
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

export type AuthResult =
  | { success: true; userId: string; email: string; tenantId?: string }
  | { success: false; error: string; status?: number };

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

// Hash password using crypto (built-in to Node.js)
export const hashPassword = async (password: string): Promise<string> => {
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256')
    .update(password + salt)
    .digest('hex');
  return `${salt}:${hash}`;
};

// Verify password
export const verifyPassword = async (password: string, storedHash: string): Promise<boolean> => {
  const [salt, hash] = storedHash.split(':');
  const inputHash = createHash('sha256')
    .update(password + salt)
    .digest('hex');
  return hash === inputHash;
};

// Generate access token
export const generateAccessToken = async (
  userId: string,
  email: string,
  tenantId?: string
): Promise<string> => {
  const jwt = await new SignJWT({
    userId,
    email,
    tenantId,
    type: 'access'
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(JWT_SECRET);

  return jwt;
};

// Generate refresh token
export const generateRefreshToken = async (userId: string): Promise<string> => {
  const tokenId = randomBytes(32).toString('hex');

  // Store in database
  const tokenHash = createHash('sha256').update(tokenId).digest('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const result = await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );

  if (!result.success) {
    throw new Error('Failed to store refresh token');
  }

  const jwt = await new SignJWT({
    userId,
    tokenId,
    type: 'refresh'
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(JWT_SECRET);

  return jwt;
};

// Generate token pair
export const generateTokenPair = async (
  userId: string,
  email: string,
  tenantId?: string
): Promise<TokenPair> => {
  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(userId, email, tenantId),
    generateRefreshToken(userId)
  ]);

  return { accessToken, refreshToken };
};

// Verify access token
export const verifyAccessToken = async (token: string): Promise<AuthResult> => {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    if (payload.type !== 'access') {
      return { success: false, error: 'Invalid token type', status: 401 };
    }

    return {
      success: true,
      userId: payload.userId as string,
      email: payload.email as string,
      tenantId: payload.tenantId as string | undefined
    };
  } catch (error) {
    return {
      success: false,
      error: 'Invalid or expired token',
      status: 401
    };
  }
};

// Verify refresh token
export const verifyRefreshToken = async (token: string): Promise<AuthResult> => {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    if (payload.type !== 'refresh') {
      return { success: false, error: 'Invalid token type', status: 401 };
    }

    // Check if token exists in database and not expired
    const tokenId = payload.tokenId as string;
    const tokenHash = createHash('sha256').update(tokenId).digest('hex');

    const result = await query<{ user_id: string; email: string; tenant_id?: string }>(
      `SELECT rt.user_id, u.email, u.tenant_id
       FROM refresh_tokens rt
       JOIN users u ON rt.user_id = u.id
       WHERE rt.token_hash = $1
       AND rt.expires_at > CURRENT_TIMESTAMP`,
      [tokenHash]
    );

    if (!result.success || result.data.length === 0) {
      return { success: false, error: 'Invalid or expired token', status: 401 };
    }

    const user = result.data[0];
    return {
      success: true,
      userId: user.user_id,
      email: user.email,
      tenantId: user.tenant_id
    };
  } catch (error) {
    return {
      success: false,
      error: 'Invalid or expired token',
      status: 401
    };
  }
};

// Revoke refresh token
export const revokeRefreshToken = async (userId: string): Promise<void> => {
  await query(
    'DELETE FROM refresh_tokens WHERE user_id = $1',
    [userId]
  );
};

// Clean up expired tokens
export const cleanupExpiredTokens = async (): Promise<void> => {
  await query(
    'DELETE FROM refresh_tokens WHERE expires_at < CURRENT_TIMESTAMP'
  );
};
