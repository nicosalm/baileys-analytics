import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import axios from 'axios';
import { OWNERREZ_API } from '@baileys/constants';

export async function testOwnerRez(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const token = process.env.OWNERREZ_PAT;

  if (!token) {
    return {
      status: 500,
      body: 'OWNERREZ_PAT environment variable not set'
    };
  }

  try {
    context.log('Testing OwnerRez API connection...');

    const response = await axios.get(`${OWNERREZ_API.BASE_URL}/users/me`, {
      auth: {
        username: 'jerry@***REMOVED***',
        password: token
      },
      headers: {
        'Accept': 'application/json'
      }
    });

    return {
      status: 200,
      jsonBody: {
        message: 'OwnerRez API connection successful!',
        user: response.data
      }
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 500;
      const statusText = error.response?.statusText || 'Unknown error';
      context.error('OwnerRez API error:', {
        status,
        statusText,
        data: error.response?.data
      });

      return {
        status,
        jsonBody: {
          error: `OwnerRez API Error: ${status} ${statusText}`,
          details: error.response?.data
        }
      };
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      status: 500,
      body: `Error connecting to OwnerRez: ${errorMessage}`
    };
  }
}

app.http('test-ownerrez', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: testOwnerRez
});
