import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import axios from 'axios';
import { query } from './services/database';
import { randomBytes } from 'crypto';

type OAuthState =
  | { status: 'pending'; authUrl: string }
  | { status: 'success'; tenantId: string }
  | { status: 'error'; error: string };

type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
};

const OWNERREZ_OAUTH_BASE = 'https://app.ownerrez.com/oauth';
const CLIENT_ID = process.env.OWNERREZ_CLIENT_ID || '';
const CLIENT_SECRET = process.env.OWNERREZ_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || 'https://grub-live-enormously.ngrok-free.app/api/oauth/callback';

const generateState = (): string => randomBytes(16).toString('hex');

const storeOAuthState = async (state: string, email: string): Promise<void> => {
  await query(
    `INSERT INTO oauth_states (state, email, created_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (state) DO UPDATE SET email = $2`,
    [state, email]
  );
};

const verifyOAuthState = async (state: string): Promise<string | null> => {
  const result = await query<{ email: string }>(
    `DELETE FROM oauth_states
     WHERE state = $1 AND created_at > CURRENT_TIMESTAMP - INTERVAL '10 minutes'
     RETURNING email`,
    [state]
  );

  return result.success && result.data.length > 0
    ? result.data[0].email
    : null;
};

export async function oauthInitiate(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const email = request.query.get('email');
    if (!email) {
      return {
        status: 400,
        jsonBody: { status: 'error', error: 'Email is required' }
      };
    }

    const state = generateState();
    await storeOAuthState(state, email);

    const authUrl = new URL(`${OWNERREZ_OAUTH_BASE}/authorize`);
    authUrl.searchParams.append('client_id', CLIENT_ID);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.append('scope', 'properties bookings');
    authUrl.searchParams.append('state', state);

    const response: OAuthState = {
      status: 'pending',
      authUrl: authUrl.toString()
    };

    return {
      status: 200,
      jsonBody: response
    };
  } catch (error) {
    return {
      status: 500,
      jsonBody: {
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to initiate OAuth'
      }
    };
  }
}

export async function oauthCallback(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const code = request.query.get('code');
    const state = request.query.get('state');
    const error = request.query.get('error');
    const userId = request.query.get('user_id'); // New parameter

    if (error) {
      return {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
        body: `<html><body><h2>Authorization Failed</h2><p>${error}</p></body></html>`
      };
    }

    if (!code || !state) {
      return {
        status: 400,
        headers: { 'Content-Type': 'text/html' },
        body: '<html><body><h2>Invalid Request</h2><p>Missing code or state</p></body></html>'
      };
    }

    // Verify state and get email
    const stateResult = await query<{ email: string; user_id?: string }>(
      `DELETE FROM oauth_states
       WHERE state = $1 AND created_at > CURRENT_TIMESTAMP - INTERVAL '10 minutes'
       RETURNING email, user_id`,
      [state]
    );

    if (!stateResult.success || stateResult.data.length === 0) {
      return {
        status: 400,
        headers: { 'Content-Type': 'text/html' },
        body: '<html><body><h2>Invalid State</h2><p>State verification failed</p></body></html>'
      };
    }

    const { email, user_id } = stateResult.data[0];

    // Exchange code for token
    const tokenResponse = await axios.post<TokenResponse>(
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
    );

    const { access_token, refresh_token, expires_in } = tokenResponse.data;

    // Get user info using the token
    const userResponse = await axios.get('https://api.ownerrez.com/v2/users/me', {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });

    const { id: ownerrezUserId, company_name } = userResponse.data;

    // Create or update tenant
    const tenantResult = await query<{ id: string }>(
      `INSERT INTO tenants (email, company_name, ownerrez_user_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE
       SET company_name = $2,
           ownerrez_user_id = $3,
           updated_at = CURRENT_TIMESTAMP
       RETURNING id`,
      [email, company_name, ownerrezUserId.toString()]
    );

    if (!tenantResult.success) {
      throw new Error('Failed to create tenant');
    }

    const tenantId = tenantResult.data[0].id;

    // Store OAuth tokens
    await query(
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
        access_token,
        refresh_token,
        new Date(Date.now() + expires_in * 1000)
      ]
    );

    // If we have a user_id, link the tenant to the user
    if (user_id) {
      await query(
        `UPDATE users SET tenant_id = $1 WHERE id = $2`,
        [tenantId, user_id]
      );

      // Also update the tenant with the user_id
      await query(
        `UPDATE tenants SET user_id = $1 WHERE id = $2`,
        [user_id, tenantId]
      );
    }

    // Return success page
    return {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
      body: `
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
              // Notify parent window if opened as popup
              if (window.opener) {
                window.opener.postMessage({
                  type: 'oauth-success',
                  tenantId: '${tenantId}',
                  userId: '${user_id || ''}'
                }, '*');
              }
            </script>
          </body>
        </html>
      `
    };
  } catch (error) {
    context.error('OAuth callback error:', error);
    return {
      status: 200,
      headers: { 'Content-Type': 'text/html' },
      body: `
        <html>
          <body>
            <h2>Connection Failed</h2>
            <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
          </body>
        </html>
      `
    };
  }
}

app.http('oauth-initiate', {
  methods: ['GET'],
  route: 'oauth/initiate',
  authLevel: 'anonymous',
  handler: oauthInitiate
});

app.http('oauth-callback', {
  methods: ['GET'],
  route: 'oauth/callback',
  authLevel: 'anonymous',
  handler: oauthCallback
});
