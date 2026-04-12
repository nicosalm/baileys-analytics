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

	// stripe configuration
	STRIPE_SECRET_KEY: string;
	STRIPE_PUBLISHABLE_KEY: string;
	STRIPE_WEBHOOK_SECRET: string;

	// stripe price ids - legacy single-tier (kept for grandfathered subscribers,
	// not referenced by checkout flow anymore)
	STRIPE_PRICE_MONTHLY: string;
	STRIPE_PRICE_YEARLY: string;

	// stripe price ids - tiered pricing
	STRIPE_PRICE_STARTER_MONTHLY: string;
	STRIPE_PRICE_STARTER_YEARLY: string;
	STRIPE_PRICE_GROWTH_MONTHLY: string;
	STRIPE_PRICE_GROWTH_YEARLY: string;
	STRIPE_PRICE_PORTFOLIO_MONTHLY: string;
	STRIPE_PRICE_PORTFOLIO_YEARLY: string;

	// email service
	RESEND_API_KEY: string;

	// admin panel (optional)
	ADMIN_EMAILS?: string; // comma-separated list of admin emails
}