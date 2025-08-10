/**
 * API Integration Layer
 * 
 * Centralized access to all external API integrations for the memecoin analyzer.
 * This module provides production-ready API clients with comprehensive error handling,
 * rate limiting, caching, and monitoring capabilities.
 */

// ============================================================================
// Solana Tracker API Integration (Primary)
// ============================================================================

export * from './solana-tracker';

// Re-export commonly used components with clear naming
export {
  SolanaTrackerClient as ApiClient,
  SolanaTrackerSystemComponent as ApiSystemComponent,
  createMemecoinAnalyzerClient as createApiClient,
  createMemecoinAnalyzerSystemComponent as createApiSystemComponent,
  DEFAULT_MEMECOIN_MARKET_CAP_RANGE as DEFAULT_MARKET_CAP_FILTER,
  SolanaTrackerError as ApiError,
} from './solana-tracker';

// ============================================================================
// Future API Integrations
// ============================================================================

// Placeholder for additional API integrations that might be added:
// - Coingecko API for additional market data
// - DexScreener API for DEX-specific data  
// - Jupiter API for swap/liquidity data
// - Social media APIs for sentiment analysis
// 
// Example structure:
// export * from './coingecko';
// export * from './dexscreener';
// export * from './jupiter';
// export * from './social';

// ============================================================================
// API Integration Registry
// ============================================================================

/**
 * Registry of available API integrations
 */
export const API_INTEGRATIONS = {
  SOLANA_TRACKER: 'solana-tracker',
  // COINGECKO: 'coingecko',
  // DEXSCREENER: 'dexscreener', 
  // JUPITER: 'jupiter',
} as const;

/**
 * Type for available API integration names
 */
export type ApiIntegrationName = typeof API_INTEGRATIONS[keyof typeof API_INTEGRATIONS];

// ============================================================================
// Common API Types and Utilities
// ============================================================================

/**
 * Common API response wrapper for consistency across integrations
 */
export interface CommonApiResponse<T = any> {
  success: boolean;
  data: T;
  source: ApiIntegrationName;
  timestamp: string;
  cached?: boolean;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
}

/**
 * Common API error interface
 */
export interface CommonApiError {
  code: string;
  message: string;
  status: number;
  retryable: boolean;
  source: ApiIntegrationName;
  details?: any;
}

/**
 * Common rate limiting information
 */
export interface RateLimitInfo {
  remaining: number;
  reset: number;
  limit: number;
  retryAfter?: number;
}

// ============================================================================
// Integration Health Monitoring
// ============================================================================

/**
 * Health status for an API integration
 */
export interface ApiIntegrationHealth {
  name: ApiIntegrationName;
  healthy: boolean;
  lastCheck: string;
  responseTime?: number;
  errorRate?: number;
  details: {
    connectivity: boolean;
    rateLimit: boolean;
    authentication: boolean;
    cache?: boolean;
    circuitBreaker?: boolean;
  };
}

/**
 * Overall API health status
 */
export interface ApiHealthStatus {
  healthy: boolean;
  integrations: Record<ApiIntegrationName, ApiIntegrationHealth>;
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
  };
  timestamp: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a standardized API response
 */
export function createApiResponse<T>(
  data: T,
  source: ApiIntegrationName,
  cached = false
): CommonApiResponse<T> {
  return {
    success: true,
    data,
    source,
    timestamp: new Date().toISOString(),
    cached,
  };
}

/**
 * Create a standardized API error response
 */
export function createApiErrorResponse(
  error: CommonApiError
): CommonApiResponse<null> {
  return {
    success: false,
    data: null,
    source: error.source,
    timestamp: new Date().toISOString(),
    error: {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
    },
  };
}

/**
 * Check if an API response indicates success
 */
export function isSuccessResponse<T>(
  response: CommonApiResponse<T>
): response is CommonApiResponse<T> & { success: true } {
  return response.success;
}

/**
 * Extract data from API response with type safety
 */
export function extractResponseData<T>(
  response: CommonApiResponse<T>
): T {
  if (!isSuccessResponse(response)) {
    throw new Error(`API request failed: ${response.error?.message || 'Unknown error'}`);
  }
  return response.data;
}

// ============================================================================
// Configuration Helpers
// ============================================================================

/**
 * Default configuration for API integrations
 */
export const DEFAULT_API_CONFIG = {
  timeout: 30000,
  maxRetries: 3,
  retryDelayMs: 1000,
  enableCache: true,
  enableMetrics: true,
  enableCircuitBreaker: true,
} as const;

/**
 * Validate API configuration
 */
export function validateApiConfig(config: any): boolean {
  return config &&
         typeof config.apiKey === 'string' &&
         config.apiKey.length > 0 &&
         typeof config.baseUrl === 'string' &&
         config.baseUrl.startsWith('http');
}