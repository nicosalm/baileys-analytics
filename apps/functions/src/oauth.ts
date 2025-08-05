import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import axios from 'axios';
import { query, DbResult } from './services/database';
import { randomBytes } from 'crypto';
import { requireAuth, corsHeaders, handleOptions } from './middleware/auth';

type OAuthState =
  | { status: 'pending'; authUrl: string }
  | { status: 'success'; tenantId: string }
  | { status: 'error'; error: string }

type TokenResponse = {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token: string
  scope: string
}

type UserInfo = {
  id: number
  company_name: string
}

type StoredState = {
  email: string
  user_id?: string
}

const OWNERREZ_OAUTH_BASE = 'https://app.ownerrez.com/oauth'
const CLIENT_ID = process.env.OWNERREZ_CLIENT_ID || ''
const CLIENT_SECRET = process.env.OWNERREZ_CLIENT_SECRET || ''
const REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || 'https://grub-live-enormously.ngrok-free.app/api/oauth/callback'

const generateState = (): string => randomBytes(16).toString('hex')

const buildAuthUrl = (state: string): string => {
  const authUrl = new URL(`${OWNERREZ_OAUTH_BASE}/authorize`)
  authUrl.searchParams.append('client_id', CLIENT_ID)
  authUrl.searchParams.append('response_type', 'code')
  authUrl.searchParams.append('redirect_uri', REDIRECT_URI)
  authUrl.searchParams.append('scope', 'properties bookings')
  authUrl.searchParams.append('state', state)
  return authUrl.toString()
}

const storeOAuthState = async (
  state: string,
  email: string,
  userId: string
): Promise<DbResult<void>> => {
  const result = await query(
    `INSERT INTO oauth_states (state, email, user_id, created_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
     ON CONFLICT (state) DO UPDATE SET email = $2, user_id = $3`,
    [state, email, userId]
  )

  return result.success
    ? { success: true, data: undefined }
    : result
}

const verifyOAuthState = async (state: string): Promise<DbResult<StoredState>> => {
  const result = await query<{ email: string; user_id?: string }>(
    `DELETE FROM oauth_states
     WHERE state = $1 AND created_at > CURRENT_TIMESTAMP - INTERVAL '10 minutes'
     RETURNING email, user_id`,
    [state]
  )

  if (!result.success || result.data.length === 0) {
    return { success: false, error: 'Invalid or expired state' }
  }

  return { success: true, data: result.data[0] }
}

const exchangeCodeForToken = async (code: string): Promise<DbResult<TokenResponse>> => {
  try {
    const response = await axios.post<TokenResponse>(
      `${OWNERREZ_OAUTH_BASE}/token`,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    )

    return { success: true, data: response.data }
  } catch (error) {
    return {
      success: false,
      error: axios.isAxiosError(error)
        ? `OAuth token exchange failed: ${error.response?.status}`
        : 'Token exchange failed'
    }
  }
}

const fetchUserInfo = async (accessToken: string): Promise<DbResult<UserInfo>> => {
  try {
    const response = await axios.get('https://api.ownerrez.com/v2/users/me', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })

    return { success: true, data: response.data }
  } catch (error) {
    return {
      success: false,
      error: axios.isAxiosError(error)
        ? `Failed to fetch user info: ${error.response?.status}`
        : 'Failed to fetch user info'
    }
  }
}

const createOrUpdateTenant = async (
  email: string,
  companyName: string,
  ownerrezUserId: string
): Promise<DbResult<string>> => {
  const result = await query<{ id: string }>(
    `INSERT INTO tenants (email, company_name, ownerrez_user_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE
     SET company_name = $2,
         ownerrez_user_id = $3,
         updated_at = CURRENT_TIMESTAMP
     RETURNING id`,
    [email, companyName, ownerrezUserId]
  )

  if (!result.success || result.data.length === 0) {
    return { success: false, error: 'Failed to create tenant' }
  }

  return { success: true, data: result.data[0].id }
}

const storeOAuthTokens = async (
  tenantId: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number
): Promise<DbResult<void>> => {
  const result = await query(
    `INSERT INTO oauth_tokens (
      tenant_id, access_token, refresh_token, expires_at
    ) VALUES ($1, $2, $3, $4)
    ON CONFLICT (tenant_id) DO UPDATE
    SET access_token = $2,
        refresh_token = $3,
        expires_at = $4,
        updated_at = CURRENT_TIMESTAMP`,
    [
      tenantId,
      accessToken,
      refreshToken,
      new Date(Date.now() + expiresIn * 1000)
    ]
  )

  return result.success
    ? { success: true, data: undefined }
    : result
}

const linkUserToTenant = async (
  userId: string | undefined,
  tenantId: string
): Promise<void> => {
  if (!userId) return

  await query(
    `UPDATE users SET tenant_id = $1 WHERE id = $2`,
    [tenantId, userId]
  )

  await query(
    `UPDATE tenants SET user_id = $1 WHERE id = $2`,
    [userId, tenantId]
  )
}

const buildSuccessPage = (tenantId: string, userId?: string): string => `
  <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
               display: flex; align-items: center; justify-content: center;
               height: 100vh; margin: 0; background: #f5f5f5; }
        .container { text-align: center; background: white; padding: 40px;
                    border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        h2 { color: #22c55e; margin: 0 0 16px 0; }
        p { color: #666; margin: 0 0 24px 0; }
        .close { background: #3b82f6; color: white; border: none;
                padding: 12px 24px; border-radius: 6px; cursor: pointer; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>✓ Successfully Connected</h2>
        <p>Your OwnerRez account has been connected to Baileys Analytics.</p>
        <button class="close" onclick="window.close()">Close Window</button>
      </div>
      <script>
        if (window.opener) {
          window.opener.postMessage({
            type: 'oauth-success',
            tenantId: '${tenantId}',
            userId: '${userId || ''}'
          }, '*');
        }
      </script>
    </body>
  </html>
`

const buildErrorPage = (error: string): string => `
  <html>
    <body>
      <h2>Connection Failed</h2>
      <p>${error}</p>
    </body>
  </html>
`

export async function oauthInitiate(
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
  const state = generateState()

  const storeResult = await storeOAuthState(state, auth.email, auth.userId)
  if (!storeResult.success) {
    return {
      status: 500,
      headers: corsHeaders(),
      jsonBody: {
        status: 'error',
        error: 'Failed to initiate OAuth'
      }
    }
  }

  const authUrl = buildAuthUrl(state)

  return {
    status: 200,
    headers: corsHeaders(),
    jsonBody: {
      status: 'pending',
      authUrl
    }
  }
}

export async function oauthCallback(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const code = request.query.get('code')
  const state = request.query.get('state')
  const error = request.query.get('error')

  if (error) {
    return {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
      body: buildErrorPage(error)
    }
  }

  if (!code || !state) {
    return {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
      body: buildErrorPage('Missing code or state')
    }
  }

  const stateResult = await verifyOAuthState(state)
  if (!stateResult.success) {
    return {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
      body: buildErrorPage(stateResult.error)
    }
  }

  const { email, user_id } = stateResult.data

  const tokenResult = await exchangeCodeForToken(code)
  if (!tokenResult.success) {
    context.error('Token exchange failed:', tokenResult.error)
    return {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
      body: buildErrorPage(tokenResult.error)
    }
  }

  const { access_token, refresh_token, expires_in } = tokenResult.data

  const userResult = await fetchUserInfo(access_token)
  if (!userResult.success) {
    context.error('User info fetch failed:', userResult.error)
    return {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
      body: buildErrorPage(userResult.error)
    }
  }

  const { id: ownerrezUserId, company_name } = userResult.data

  const tenantResult = await createOrUpdateTenant(email, company_name, ownerrezUserId.toString())
  if (!tenantResult.success) {
    return {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
      body: buildErrorPage(tenantResult.error)
    }
  }

  const tenantId = tenantResult.data

  const storeTokenResult = await storeOAuthTokens(tenantId, access_token, refresh_token, expires_in)
  if (!storeTokenResult.success) {
    return {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
      body: buildErrorPage('Failed to store OAuth tokens')
    }
  }

  await linkUserToTenant(user_id, tenantId)

  return {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
    body: buildSuccessPage(tenantId, user_id)
  }
}

app.http('oauth-initiate', {
  methods: ['GET', 'OPTIONS'],
  route: 'oauth/initiate',
  authLevel: 'anonymous',
  handler: oauthInitiate
})

app.http('oauth-callback', {
  methods: ['GET'],
  route: 'oauth/callback',
  authLevel: 'anonymous',
  handler: oauthCallback
})
