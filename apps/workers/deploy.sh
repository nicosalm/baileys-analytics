#!/bin/bash

set -e

echo "🚀 Deploying Baileys Analytics API to Cloudflare Workers"

# Check environment
if [ "$1" = "production" ]; then
    ENV="production"
    echo "📦 Deploying to PRODUCTION"
elif [ "$1" = "staging" ]; then
    ENV="staging"
    echo "📦 Deploying to STAGING"
else
    ENV="development"
    echo "📦 Deploying to DEVELOPMENT"
fi

# Build
echo "🔨 Building..."
pnpm build

# Deploy
echo "☁️  Deploying to Cloudflare..."
if [ "$ENV" = "development" ]; then
    pnpm wrangler deploy
else
    pnpm wrangler deploy --env $ENV
fi

# Set secrets
echo "🔐 Setting secrets..."
if [ "$ENV" = "production" ]; then
    pnpm wrangler secret put SUPABASE_SERVICE_KEY --env production
    pnpm wrangler secret put JWT_SECRET --env production
    pnpm wrangler secret put DATABASE_URL --env production
    pnpm wrangler secret put OWNERREZ_PAT --env production
    pnpm wrangler secret put OWNERREZ_CLIENT_ID --env production
    pnpm wrangler secret put OWNERREZ_CLIENT_SECRET --env production
elif [ "$ENV" = "staging" ]; then
    pnpm wrangler secret put SUPABASE_SERVICE_KEY --env staging
    pnpm wrangler secret put JWT_SECRET --env staging
    pnpm wrangler secret put DATABASE_URL --env staging
    pnpm wrangler secret put OWNERREZ_PAT --env staging
    pnpm wrangler secret put OWNERREZ_CLIENT_ID --env staging
    pnpm wrangler secret put OWNERREZ_CLIENT_SECRET --env staging
fi

echo "✅ Deployment complete!"