#!/bin/bash

echo "Setting up Baileys Analytics monorepo..."

# Initialize git if not already done
if [ ! -d .git ]; then
    git init
    echo "Git repository initialized"
fi

# Create directory structure
mkdir -p apps/functions/src
mkdir -p packages/shared-types/src
mkdir -p packages/constants/src
mkdir -p packages/utils/src

# Create root package.json
cat > package.json << 'EOF'
{
  "name": "baileys-analytics",
  "version": "0.0.1",
  "private": true,
  "description": "Multi-tenant vacation rental analytics platform",
  "scripts": {
    "dev": "echo 'Run pnpm dev in specific workspace'",
    "build": "echo 'Run pnpm build in specific workspace'",
    "test": "echo 'No tests yet'"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "typescript": "^5.3.3"
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=8.0.0"
  }
}
EOF

# Create pnpm workspace configuration
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - 'apps/*'
  - 'packages/*'
EOF

# Create root TypeScript config
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "incremental": true,
    "composite": true
  },
  "references": [
    { "path": "./packages/shared-types" },
    { "path": "./packages/constants" },
    { "path": "./packages/utils" },
    { "path": "./apps/functions" }
  ]
}
EOF

# Create .gitignore
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
.pnp.*
.yarn/*

# Build outputs
dist/
build/
*.tsbuildinfo
.turbo/

# Environment files
.env
.env.local
.env.*.local

# IDE
.vscode/*
!.vscode/extensions.json
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Testing
coverage/
.nyc_output/

# Azure Functions
local.settings.json
.python_packages/
EOF

# Create README
cat > README.md << 'EOF'
# Baileys Analytics

Multi-tenant vacation rental analytics platform with automated tax reporting for OwnerRez users.

## Features

- **Automated Data Sync**: Pulls properties and bookings from OwnerRez every 12 hours
- **Tax Reporting**: Generate detailed tax reports by property and month
- **CSV Export**: Download tax data for easy filing
- **Multi-tenant**: Each user's data is completely isolated
- **OAuth Integration**: Secure connection to OwnerRez accounts

## Quick Start

1. **Prerequisites**
   - Node.js 20+
   - Docker (for PostgreSQL)
   - pnpm (`npm install -g pnpm`)
   - OwnerRez account with API access

2. **Setup**
   ```bash
   # Clone repository
   git clone https://github.com/yourusername/baileys-analytics-platform.git
   cd baileys-analytics-platform

   # Run setup script
   ./setup.sh

   # Install dependencies
   pnpm install

   # Start database
   docker run --name baileys-postgres \
     -e POSTGRES_PASSWORD=localdev123 \
     -e POSTGRES_DB=baileys_analytics \
     -p 5432:5432 -d postgres:15

   # Apply database schema
   psql -h localhost -U postgres -d baileys_analytics -f schema.sql
   psql -h localhost -U postgres -d baileys_analytics -f oauth-schema.sql
   ```

3. **Configure**

   Add your credentials to `apps/functions/local.settings.json`:
   ```json
   {
     "Values": {
       "OWNERREZ_PAT": "your-personal-access-token",
       "DATABASE_URL": "postgresql://postgres:localdev123@localhost:5432/baileys_analytics",
       "OWNERREZ_CLIENT_ID": "your-oauth-client-id",
       "OWNERREZ_CLIENT_SECRET": "your-oauth-client-secret",
       "OAUTH_REDIRECT_URI": "http://localhost:7071/api/oauth/callback"
     }
   }
   ```

4. **Run**
   ```bash
   cd apps/functions
   pnpm dev
   ```

## Usage

### Sync Your Data

```bash
# Sync properties
curl -X POST http://localhost:7071/api/sync-properties

# Sync bookings
curl -X POST http://localhost:7071/api/sync-bookings
```

### Generate Tax Reports

```bash
# JSON report
curl "http://localhost:7071/api/tax-report?from=2024-01-01&to=2024-12-31"

# CSV export
curl "http://localhost:7071/api/tax-report-csv?from=2024-01-01&to=2024-12-31" -o taxes-2024.csv
```

## API Documentation

See [TECHNICAL.md](TECHNICAL.md) for detailed API documentation.

## License

MIT
EOF

# Create shared-types package
cat > packages/shared-types/package.json << 'EOF'
{
  "name": "@baileys/shared-types",
  "version": "0.0.1",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc -b",
    "clean": "rm -rf dist *.tsbuildinfo"
  }
}
EOF

cat > packages/shared-types/tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "composite": true
  },
  "include": ["src/**/*"]
}
EOF

cat > packages/shared-types/src/index.ts << 'EOF'
// Shared TypeScript types for Baileys Analytics

export interface User {
  id: string;
  email: string;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Property {
  id: string;
  tenantId: string;
  ownerRezId: string;
  name: string;
  address: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Booking {
  id: string;
  tenantId: string;
  propertyId: string;
  ownerRezBookingId: string;
  checkIn: Date;
  checkOut: Date;
  totalAmount: number;
  guestName: string;
  guestEmail?: string;
  status: 'confirmed' | 'cancelled' | 'pending';
  createdAt: Date;
  updatedAt: Date;
}
EOF

# Create constants package
cat > packages/constants/package.json << 'EOF'
{
  "name": "@baileys/constants",
  "version": "0.0.1",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc -b",
    "clean": "rm -rf dist *.tsbuildinfo"
  }
}
EOF

cat > packages/constants/tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "composite": true
  },
  "include": ["src/**/*"]
}
EOF

cat > packages/constants/src/index.ts << 'EOF'
// Constants for Baileys Analytics

export const API_VERSION = 'v1';

export const OWNERREZ_API = {
  BASE_URL: 'https://api.ownerrez.com/v2',
  ENDPOINTS: {
    PROPERTIES: '/properties',
    BOOKINGS: '/bookings',
    GUESTS: '/guests',
  },
} as const;

export const TAX_TYPES = {
  STATE: 'state',
  COUNTY: 'county',
  CITY: 'city',
  TOURISM: 'tourism',
  OCCUPANCY: 'occupancy',
} as const;

export const BOOKING_STATUS = {
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  PENDING: 'pending',
} as const;
EOF

# Create utils package
cat > packages/utils/package.json << 'EOF'
{
  "name": "@baileys/utils",
  "version": "0.0.1",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc -b",
    "clean": "rm -rf dist *.tsbuildinfo"
  },
  "dependencies": {
    "@baileys/shared-types": "workspace:*",
    "@baileys/constants": "workspace:*"
  }
}
EOF

cat > packages/utils/tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist",
    "composite": true
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../shared-types" },
    { "path": "../constants" }
  ]
}
EOF

cat > packages/utils/src/index.ts << 'EOF'
// Utility functions for Baileys Analytics

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function calculateNights(checkIn: Date, checkOut: Date): number {
  const diffTime = Math.abs(checkOut.getTime() - checkIn.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export function calculateTax(amount: number, taxRate: number): number {
  return Math.round(amount * taxRate * 100) / 100;
}
EOF

# Create basic Azure Functions app
cat > apps/functions/package.json << 'EOF'
{
  "name": "@baileys/functions",
  "version": "0.0.1",
  "private": true,
  "main": "dist/src/index.js",
  "scripts": {
    "build": "tsc -b",
    "clean": "rm -rf dist *.tsbuildinfo",
    "dev": "func start",
    "predev": "npm run build",
    "test": "echo 'No tests yet'"
  },
  "dependencies": {
    "@azure/functions": "^4.0.0",
    "@baileys/shared-types": "workspace:*",
    "@baileys/constants": "workspace:*",
    "@baileys/utils": "workspace:*",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "@types/node": "20.x",
    "azure-functions-core-tools": "^4.x",
    "typescript": "^5.0.0"
  }
}
EOF

cat > apps/functions/tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "outDir": "./dist",
    "rootDir": "./src",
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../../packages/shared-types" },
    { "path": "../../packages/constants" },
    { "path": "../../packages/utils" }
  ]
}
EOF

cat > apps/functions/host.json << 'EOF'
{
  "version": "2.0",
  "logging": {
    "applicationInsights": {
      "samplingSettings": {
        "isEnabled": true,
        "excludedTypes": "Request"
      }
    }
  },
  "extensionBundle": {
    "id": "Microsoft.Azure.Functions.ExtensionBundle",
    "version": "[4.*, 5.0.0)"
  }
}
EOF

# Create a test function to verify OwnerRez connection
cat > apps/functions/src/test-ownerrez.ts << 'EOF'
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import axios from 'axios';
import { OWNERREZ_API } from '@baileys/constants';

export async function testOwnerRez(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const token = process.env.OWNERREZ_PAT;

  if (!token) {
    return {
      status: 500,
      body: 'OWNERREZ_PAT environment variable not set'
    };
  }

  try {
    context.log('Testing OwnerRez API connection...');

    const response = await axios.get(`${OWNERREZ_API.BASE_URL}/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    return {
      status: 200,
      jsonBody: {
        message: 'OwnerRez API connection successful!',
        user: response.data
      }
    };
  } catch (error) {
    context.error('OwnerRez API error:', error);
    return {
      status: 500,
      body: `Error connecting to OwnerRez: ${error.message}`
    };
  }
}

app.http('test-ownerrez', {
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: testOwnerRez
});
EOF

# Create environment example file
cat > .env.example << 'EOF'
# OwnerRez API Credentials
OWNERREZ_PAT=your_personal_access_token_here
OWNERREZ_CLIENT_ID=your_oauth_client_id
OWNERREZ_CLIENT_SECRET=your_oauth_client_secret

# Database (for later)
DATABASE_URL=postgresql://user:password@localhost:5432/baileys_analytics

# Azure (for later)
AZURE_STORAGE_CONNECTION_STRING=
EOF

# Create local.settings.json for Azure Functions
cat > apps/functions/local.settings.json << 'EOF'
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "OWNERREZ_PAT": "YOUR_PAT_HERE"
  }
}
EOF

echo "Basic monorepo structure created!"
echo ""
echo "Next steps:"
echo "1. Install pnpm globally: npm install -g pnpm"
echo "2. Install dependencies: pnpm install"
echo "3. Add your OwnerRez PAT to apps/functions/local.settings.json"
echo "4. Build packages: pnpm -r build"
echo "5. Test OwnerRez connection: cd apps/functions && pnpm dev"
echo ""
echo "Then visit: http://localhost:7071/api/test-ownerrez"
EOF

chmod +x setup.sh
