/**
 * Logging configuration to control verbosity
 */

/**
 * Messages that should be logged at debug level in production
 * to reduce console noise
 */
export const TECHNICAL_LOG_PATTERNS = [
  'Entry signal generated',
  'Multi-timeframe',
  'technical analysis',
  'Rating calculation',
  'Enhanced rating',
  'Optimized multi-timeframe',
  'Starting enhanced rating',
  'Step 3 skipped',
  'Parallel processing completed',
  'Circuit breaker statistics',
  'Performance statistics',
  'System health degraded but operational',
  'Generating entry signal',
  'chart data fetched',
  'aggregation completed',
  'data request initiated',
  'analysis completed for'
];

/**
 * Check if a log message should be suppressed in simple mode
 */
export function shouldSuppressLog(message: string): boolean {
  const isSimpleMode = process.env.LOG_FORMAT === 'simple' || 
    (process.env.LOG_FORMAT !== 'detailed' && process.env.NODE_ENV === 'production');
  
  if (!isSimpleMode) {
    return false;
  }
  
  // Check if message matches any technical pattern
  return TECHNICAL_LOG_PATTERNS.some(pattern => 
    message.toLowerCase().includes(pattern.toLowerCase())
  );
}