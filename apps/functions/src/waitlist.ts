import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";

interface WaitlistEntry {
  email: string;
  company?: string;
  properties?: string;
  timestamp: string;
}

// In-memory storage for development (replace with database in production)
const waitlistEntries: Map<string, WaitlistEntry> = new Map();

export async function waitlistHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Waitlist function processing request');

  // Handle CORS preflight
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return {
      status: 204,
      headers: corsHeaders,
    };
  }

  if (request.method !== 'POST') {
    return {
      status: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    };
  }

  try {
    const bodyText = await request.text();
    const body = bodyText ? JSON.parse(bodyText) : {};
    const { email, company, properties } = body;

    // Validate email
    if (!email || !email.includes('@')) {
      return {
        status: 400,
        body: JSON.stringify({ error: 'Invalid email address' }),
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      };
    }

    // Create entry
    const entry: WaitlistEntry = {
      email: email.toLowerCase(),
      company: company || '',
      properties: properties || '',
      timestamp: new Date().toISOString(),
    };

    // Check if email already exists
    const existingEntry = waitlistEntries.get(email.toLowerCase());
    
    if (existingEntry) {
      // Update existing entry
      waitlistEntries.set(email.toLowerCase(), entry);
      
      context.log(`Updated waitlist entry for: ${email}`);
      
      return {
        status: 200,
        body: JSON.stringify({ 
          success: true, 
          message: 'Waitlist entry updated',
          isUpdate: true 
        }),
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      };
    } else {
      // Add new entry
      waitlistEntries.set(email.toLowerCase(), entry);
      
      context.log(`Added to waitlist: ${email}, Company: ${company}, Properties: ${properties}`);
      
      // Log all entries (for development)
      context.log(`Total waitlist entries: ${waitlistEntries.size}`);
      
      return {
        status: 201,
        body: JSON.stringify({ 
          success: true, 
          message: 'Successfully joined waitlist',
          isUpdate: false 
        }),
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      };
    }
  } catch (error) {
    context.log('Error processing waitlist request:', error);
    
    return {
      status: 500,
      body: JSON.stringify({ error: 'Failed to process request' }),
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    };
  }
}

app.http('waitlist', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  handler: waitlistHandler,
});