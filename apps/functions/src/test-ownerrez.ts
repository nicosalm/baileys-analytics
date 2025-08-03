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
        username: 'martina@***REMOVED***',
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

export async function debugTags(
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
    // Fetch just one property to see its structure
    const propertiesResponse = await axios.get(`${OWNERREZ_API.BASE_URL}/properties`, {
      auth: {
        username: 'martina@***REMOVED***',
        password: token
      },
      headers: { 'Accept': 'application/json' },
      params: {
        limit: 1
      }
    });

    const property = propertiesResponse.data.items?.[0];

    return {
      status: 200,
      jsonBody: {
        message: 'Check the property object for a tags field',
        propertyStructure: property ? Object.keys(property) : 'No properties found',
        fullProperty: property || null
      }
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      return {
        status: error.response?.status || 500,
        jsonBody: {
          error: 'API call failed',
          details: error.response?.data || error.message
        }
      };
    }

    return {
      status: 500,
      jsonBody: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

app.http('test-ownerrez', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: testOwnerRez
});

app.http('debug-tags', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: debugTags
});
