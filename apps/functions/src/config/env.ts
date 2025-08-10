import { z } from 'zod'

// Environment variable schemas
const envSchema = z.object({
  // Required
  DATABASE_URL: z.string().url().optional().default('postgresql://localhost:5432/baileys'),
  JWT_SECRET: z.string().min(32).optional().default('development-secret-change-in-production'),
  
  // Optional
  OWNERREZ_PAT: z.string().optional(),
  OWNERREZ_API_URL: z.string().url().optional().default('https://api.ownerrez.com/v2'),
  
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).optional().default('development'),
  
  // Azure Functions
  AZURE_FUNCTIONS_ENVIRONMENT: z.string().optional(),
  
  // Feature flags
  ENABLE_AUTO_SYNC: z.string().transform(val => val === 'true').optional().default('false'),
  SYNC_INTERVAL_HOURS: z.string().transform(val => parseInt(val, 10)).optional().default('24'),
  
  // Rate limiting
  MAX_REQUESTS_PER_MINUTE: z.string().transform(val => parseInt(val, 10)).optional().default('60'),
  
  // Email config (for reports)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(val => parseInt(val, 10)).optional().default('587'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),
})

// Parse and validate environment variables
const parseEnv = () => {
  try {
    return envSchema.parse(process.env)
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid environment variables:')
      error.errors.forEach(err => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`)
      })
      
      // In production, fail fast
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Invalid environment configuration')
      }
      
      // In development, use defaults
      console.warn('⚠️ Using default values for missing environment variables')
      return envSchema.parse({})
    }
    throw error
  }
}

// Export validated config
export const config = parseEnv()

// Type-safe config access
export type Config = z.infer<typeof envSchema>

// Helper functions for specific configs
export const isDevelopment = () => config.NODE_ENV === 'development'
export const isProduction = () => config.NODE_ENV === 'production'
export const hasOwnerRezPAT = () => !!config.OWNERREZ_PAT
export const hasEmailConfig = () => !!(config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASS)

// JWT configuration
export const jwtConfig = {
  secret: new TextEncoder().encode(config.JWT_SECRET),
  issuer: 'baileys-analytics',
  audience: 'baileys-analytics-api',
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d',
}

// Database configuration
export const dbConfig = {
  connectionString: config.DATABASE_URL,
  max: 20, // max pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
}

// OwnerRez API configuration
export const ownerRezConfig = {
  baseUrl: config.OWNERREZ_API_URL,
  pat: config.OWNERREZ_PAT,
  hasCredentials: hasOwnerRezPAT(),
}