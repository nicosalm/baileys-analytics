#!/bin/bash

# Deploy to Cloudflare Pages - Production

echo "🚀 Deploying Baileys Dashboard to Cloudflare Pages (Production)..."
echo ""

# Ensure we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "❌ Error: You must be on the main branch to deploy to production"
    echo "Current branch: $CURRENT_BRANCH"
    echo ""
    echo "To deploy to production:"
    echo "1. git checkout main"
    echo "2. git pull origin main"
    echo "3. ./scripts/deploy-web.sh"
    exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "❌ Error: You have uncommitted changes"
    echo "Please commit or stash your changes before deploying to production"
    exit 1
fi

# Pull latest changes
echo "📥 Pulling latest changes from main..."
git pull origin main

# Navigate to web directory
cd apps/web

# Build the project for production
echo "📦 Building the project for production..."
pnpm build

# Deploy using Wrangler Pages
echo "☁️  Deploying to Cloudflare Pages..."
wrangler pages deploy dist --project-name=baileys-dashboard --branch=main

echo ""
echo "✅ Production deployment complete!"
echo ""
echo "Your app is live at: https://baileys-dashboard.pages.dev"
echo ""
echo "Preview deployments will be created automatically when you push to dev or feature branches."