// JWT Algorithm
export const JWT_ALGORITHM = 'ES256'

// Product Types
export const PRODUCTS = {
  ADMIN: 'admin',
  DASHBOARD: 'dashboard',
} as const

// Environment/Stage Values
export const ENVIRONMENTS = {
  PRODUCTION: 'prod',
  PRODUCTION_ALT: 'production',
  DEVELOPMENT: 'dev',
  STAGING: 'staging',
} as const

// Default Values
export const DEFAULTS = {
  TOKEN_EXPIRATION_SECS: 3600,
  MAGIC_EXPIRATION_SECS: 3600 * 24, // 1 day
  REFRESH_DURATION: 365 * 24 * 60 * 60, // 1 year in seconds
  MAX_ENABLED_CLIENTS: 8,
  MIN_CLIENT_TURNOVER_SECS: 3600,
  STAGE: 'dev',
  IGNORE_MAX_CLIENTS_DOMAIN: '@360mediadirect.com',
} as const

// AWS Regions
export const AWS_REGIONS = {
  US_EAST_1: 'us-east-1',
} as const

// SSM Configuration
export const SSM_CONFIG = {
  API_VERSION: '2014-11-06',
  DEFAULT_REGION: AWS_REGIONS.US_EAST_1,
} as const

// Parameter Store Paths
export const PARAMETER_PATHS = {
  PRIVATE_KEY: (kid: string) => `/example/auth/keys/private/${kid}`,
  PUBLIC_KEY: (kid: string) => `/example/auth/keys/public/${kid}`,
} as const

// Audience Configuration
export const AUDIENCE_CONFIG = {
  AUDIENCE_PREFIX: 'api',
  AUDIENCE_SUFFIX: '.example',
} as const
