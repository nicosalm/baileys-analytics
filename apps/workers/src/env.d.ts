interface Env {
	// kv namespace (optional for local development)
	CACHE?: KVNamespace;

	// required environment variables
	FRONTEND_URL: string;
	DATABASE_URL: string;
	SUPABASE_URL: string;
	SUPABASE_SERVICE_KEY: string;
	SUPABASE_ANON_KEY: string;
	
	// ownerrez oauth credentials
	OWNERREZ_CLIENT_ID: string;
	OWNERREZ_CLIENT_SECRET: string;
	
	// ownerrez webhook authentication
	OWNERREZ_WEBHOOK_USER: string;
	OWNERREZ_WEBHOOK_PASSWORD: string;
}