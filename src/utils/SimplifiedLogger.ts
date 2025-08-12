import { Logger } from './Logger';
import { shouldSuppressLog } from '../config/logging-config';

/**
 * Wrapper around Logger that filters technical messages in simple mode
 */
export class SimplifiedLogger {
  private logger: Logger;
  private useSimpleMode: boolean;

  constructor(logger: Logger) {
    this.logger = logger;
    this.useSimpleMode = process.env.LOG_FORMAT === 'simple' || 
      (process.env.LOG_FORMAT !== 'detailed' && process.env.NODE_ENV === 'production');
  }

  // Override info to filter technical messages
  info(message: string, meta?: any): void {
    if (this.useSimpleMode && shouldSuppressLog(message)) {
      // Convert to debug level in simple mode
      this.logger.debug(message, { ...meta, technical: true });
    } else {
      this.logger.info(message, meta);
    }
  }

  // Pass through other methods unchanged
  error(message: string, meta?: any): void {
    this.logger.error(message, meta);
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  verbose(message: string, meta?: any): void {
    this.logger.verbose(message, meta);
  }

  silly(message: string, meta?: any): void {
    this.logger.silly(message, meta);
  }
}

/**
 * Create a simplified logger instance
 */
export function createSimplifiedLogger(logger: Logger): SimplifiedLogger {
  return new SimplifiedLogger(logger);
}