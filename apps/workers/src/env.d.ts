interface Env {
	// absent in local dev unless a KV namespace is bound
	CACHE?: KVNamespace;

	FRONTEND_URL: string;
	SUPABASE_URL: string;
	SUPABASE_SERVICE_KEY: string;

	OWNERREZ_CLIENT_ID: string;
	OWNERREZ_CLIENT_SECRET: string;
	OWNERREZ_WEBHOOK_USER: string;
	OWNERREZ_WEBHOOK_PASSWORD: string;

	STRIPE_SECRET_KEY: string;
	STRIPE_WEBHOOK_SECRET: string;
	// legacy single-tier prices, kept for grandfathered subscribers
	STRIPE_PRICE_MONTHLY: string;
	STRIPE_PRICE_YEARLY: string;
	STRIPE_PRICE_STARTER_MONTHLY: string;
	STRIPE_PRICE_STARTER_YEARLY: string;
	STRIPE_PRICE_GROWTH_MONTHLY: string;
	STRIPE_PRICE_GROWTH_YEARLY: string;
	STRIPE_PRICE_PORTFOLIO_MONTHLY: string;
	STRIPE_PRICE_PORTFOLIO_YEARLY: string;

	RESEND_API_KEY: string;

	// comma-separated
	ADMIN_EMAILS?: string;
}
