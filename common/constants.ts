// Auth Error Codes
export const AUTH_ERROR_CODES = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  INVALID_TOKEN: 'INVALID_TOKEN',
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  CLIENT_RECENTLY_DISABLED: 'CLIENT_RECENTLY_DISABLED',
  TOO_MANY_CLIENTS: 'TOO_MANY_CLIENTS',
  TOKEN_NOT_LINKED: 'TOKEN_NOT_LINKED',
} as const

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
  TOKEN_EXPIRATION_SECS: 3600, // 1 hour
  MAGIC_EXPIRATION_SECS: 3600 * 24, // 1 day
  REFRESH_DURATION: 3600000, // 1 hour (in milliseconds)
  MAX_ENABLED_CLIENTS: 8,
  MIN_CLIENT_TURNOVER_SECS: 3600, // 1 hour
  IGNORE_MAX_CLIENTS_DOMAIN: '@360mediadirect.com',
  STAGE: 'dev',
} as const

// Magic Link Templates
export const MAGIC_LINK_TEMPLATES = {
  ADMIN: 'admin',
  DASHBOARD: 'dashboard',
} as const

// Allowed URL Domains
export const ALLOWED_URL_DOMAINS = ['localhost', '360mediadirect.net'] as const

// Warehouse Status Types
export const WAREHOUSE_STATUS = {
  OK: 'OK',
  DISCREPANCY: 'DISCREPANCY',
  ERROR: 'ERROR',
} as const

// Test Constants
export const TEST_CONSTANTS = {
  TEST_USER_ID: 'test',
} as const
