#!/bin/bash

# Setup script for local development
# This script sets up the database and seeds initial data for local development

set -e  # Exit on error

echo "🚀 Starting local development setup..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Database configuration
DB_HOST="localhost"
DB_USER="postgres"
DB_PASSWORD="localdev123"
DB_NAME="baileys_analytics"

# Check if PostgreSQL is running
if ! pg_isready -h $DB_HOST -U $DB_USER > /dev/null 2>&1; then
    echo -e "${RED}❌ PostgreSQL is not running or not accessible${NC}"
    echo "Please ensure PostgreSQL is running and try again."
    exit 1
fi

echo "✅ PostgreSQL is running"

# Drop and recreate database
echo -e "${YELLOW}⚠️  This will drop and recreate the database '$DB_NAME'${NC}"
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Setup cancelled."
    exit 0
fi

echo "📦 Dropping existing database (if exists)..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -c "DROP DATABASE IF EXISTS $DB_NAME" 2>/dev/null || true

echo "📦 Creating new database..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -c "CREATE DATABASE $DB_NAME"

echo "📋 Loading schema..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f schema.sql

# Extract PAT from local.settings.json
PAT=$(grep -o '"OWNERREZ_PAT": "[^"]*' apps/functions/local.settings.json | grep -o '[^"]*$')

if [ -z "$PAT" ]; then
    echo -e "${RED}❌ Could not find OWNERREZ_PAT in local.settings.json${NC}"
    exit 1
fi

echo "🔑 Found OwnerRez PAT in local.settings.json"

# Create default tenant with PAT authentication
echo "👤 Creating default tenant for martina@***REMOVED***..."
TENANT_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')

PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME <<EOF
-- Create default tenant
INSERT INTO tenants (id, email, company_name, ownerrez_user_id, created_at, updated_at)
VALUES ('$TENANT_ID', 'martina@***REMOVED***', 'Door County Stay', 'martina@***REMOVED***', NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Store PAT as OAuth token for the tenant
INSERT INTO oauth_tokens (tenant_id, access_token, refresh_token, expires_at, created_at, updated_at)
VALUES ('$TENANT_ID', '$PAT', NULL, NOW() + INTERVAL '10 years', NOW(), NOW())
ON CONFLICT (tenant_id) 
DO UPDATE SET 
  access_token = EXCLUDED.access_token,
  updated_at = NOW();

-- Create default user with password hash for 'password123'
-- This hash is for 'password123' using bcrypt with 12 rounds
INSERT INTO users (id, email, password_hash, tenant_id, created_at, updated_at)
VALUES (gen_random_uuid(), 'martina@***REMOVED***', 
        '\$2b\$12\$3JIvhY13qLo.vynGlUUwk.IbuAGrY8QqoUgb9f9YP.2rgvt4QKSTO', 
        '$TENANT_ID', NOW(), NOW())
ON CONFLICT (email) DO NOTHING;
EOF

echo -e "${GREEN}✅ Default tenant created with ID: $TENANT_ID${NC}"

# Initialize season configurations
echo "🗓️ Creating default season configurations..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -U $DB_USER -d $DB_NAME <<EOF
-- Insert default season configurations for the tenant
INSERT INTO season_configurations (tenant_id, season_name, start_date, end_date, is_active, created_at, updated_at)
VALUES 
  ('$TENANT_ID', 'Peak Summer', '2024-06-15', '2024-08-31', true, NOW(), NOW()),
  ('$TENANT_ID', 'Fall Shoulder', '2024-09-01', '2024-10-31', true, NOW(), NOW()),
  ('$TENANT_ID', 'Winter', '2024-11-01', '2025-03-31', true, NOW(), NOW()),
  ('$TENANT_ID', 'Spring Shoulder', '2025-04-01', '2025-06-14', true, NOW(), NOW())
ON CONFLICT DO NOTHING;
EOF

# Build functions
echo "🔨 Building Azure Functions..."
cd apps/functions
pnpm install
pnpm build
cd ../..

# Build web app
echo "🔨 Building web application..."
cd apps/web
pnpm install
pnpm build
cd ../..

echo ""
echo -e "${GREEN}✨ Setup complete!${NC}"
echo ""
echo "📝 Next steps:"
echo "  1. Start the Azure Functions:"
echo "     cd apps/functions && pnpm start"
echo ""
echo "  2. In a new terminal, start the web app:"
echo "     cd apps/web && pnpm dev"
echo ""
echo "  3. Open http://localhost:5173 in your browser"
echo ""
echo "  4. Login with:"
echo "     Email: martina@***REMOVED***"
echo "     Password: password123"
echo ""
echo -e "${YELLOW}Note: The first time you access the app, it will sync data from OwnerRez.${NC}"
echo -e "${YELLOW}This may take a few minutes depending on the amount of data.${NC}"