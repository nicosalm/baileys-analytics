export async function onRequest(context: any) {
  const url = new URL(context.request.url);
  const pathname = url.pathname;
  
  // Proxy to production Workers API
  const destinationURL = `https://baileys-analytics-api-production.nicosalm.workers.dev${pathname}${url.search}`;
  
  const response = await fetch(destinationURL, {
    method: context.request.method,
    headers: context.request.headers,
    body: context.request.method !== 'GET' && context.request.method !== 'HEAD' 
      ? context.request.body 
      : undefined,
  });
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}