import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { performSync } from './auto-sync';

export async function manualSync(
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
    const result = await performSync(token);

    return {
      status: 200,
      jsonBody: result
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      status: 500,
      jsonBody: {
        error: errorMessage
      }
    };
  }
}

app.http('manual-sync', {
  methods: ['POST'],
  authLevel: 'anonymous',
  handler: manualSync
});
