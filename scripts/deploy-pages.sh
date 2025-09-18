#!/bin/bash

# Deploy to Cloudflare Pages

echo "🚀 Deploying Baileys Dashboard to Cloudflare Pages..."
echo ""

# Navigate to web directory
cd apps/web

# Build the project for production
echo "📦 Building the project..."
pnpm build

# Deploy using Wrangler Pages
echo "☁️  Deploying to Cloudflare Pages..."
wrangler pages deploy dist --project-name=baileys-dashboard --branch=main

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Your app will be available at: https://baileys-dashboard.pages.dev"
echo ""
echo "Note: It may take a few minutes for the deployment to be fully live."