interface Env {
	CACHE: KVNamespace;

	FRONTEND_URL: string;
	JWT_SECRET: string;
	DATABASE_URL: string;
	SUPABASE_URL: string;
	SUPABASE_SERVICE_KEY: string;
	OWNERREZ_PAT: string;
	OWNERREZ_CLIENT_ID: string;
	OWNERREZ_CLIENT_SECRET: string;
}