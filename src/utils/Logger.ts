import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { MonitoringConfig } from '../types/config';
import { ConsoleFormatter, shouldUseSimpleLogging } from './ConsoleFormatter';

/**
 * Singleton Logger class for application-wide logging
 */
export class Logger {
  private static instance: Logger;
  private logger: winston.Logger;

  private constructor() {
    // Initialize with default configuration
    this.logger = this.createDefaultLogger();
  }

  /**
   * Get singleton instance of Logger
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Initialize logger with specific configuration
   */
  public initialize(config: MonitoringConfig): void {
    this.logger = this.createConfiguredLogger(config);
  }

  /**
   * Create default logger for initial use
   */
  private createDefaultLogger(): winston.Logger {
    const useSimpleFormat = shouldUseSimpleLogging();
    
    return winston.createLogger({
      level: 'info',
      format: useSimpleFormat 
        ? ConsoleFormatter.createSimpleFormat()
        : ConsoleFormatter.createDetailedFormat(),
      transports: [
        new winston.transports.Console()
      ],
      exitOnError: false,
    });
  }

  /**
   * Create fully configured logger
   */
  private createConfiguredLogger(config: MonitoringConfig): winston.Logger {
    const { logging } = config;
    
    const transports: winston.transport[] = [];

    // Console transport
    const useSimpleFormat = shouldUseSimpleLogging();
    transports.push(
      new winston.transports.Console({
        level: logging.level,
        format: logging.format === 'json' 
          ? winston.format.json()
          : (useSimpleFormat 
              ? ConsoleFormatter.createSimpleFormat()
              : ConsoleFormatter.createDetailedFormat()
            )
      })
    );

    // File transport (if enabled)
    if (logging.file.enabled) {
      transports.push(
        new DailyRotateFile({
          level: logging.level,
          filename: `${logging.file.path}/memecoin-analyzer-%DATE%.log`,
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: logging.file.maxSize,
          maxFiles: logging.file.maxFiles,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
          ),
        })
      );

      // Error log file
      transports.push(
        new DailyRotateFile({
          level: 'error',
          filename: `${logging.file.path}/memecoin-analyzer-error-%DATE%.log`,
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: logging.file.maxSize,
          maxFiles: logging.file.maxFiles,
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
          ),
        })
      );

      // Claude AI response log file - separate file for AI interactions
      transports.push(
        new DailyRotateFile({
          level: 'info',
          filename: `${logging.file.path}/claude-responses-%DATE%.log`,
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '50m', // Larger size for full responses
          maxFiles: 14, // Keep 2 weeks of Claude logs
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format((info) => {
              // Only log Claude-specific actions to this file
              if (info.action === 'CLAUDE_PROMPT_SENT' || 
                  info.action === 'CLAUDE_FULL_RESPONSE') {
                return info; // Return the info object to continue processing
              }
              return false; // Filter out non-Claude logs
            })(),
            winston.format.json()
          )
        })
      );
    }

    return winston.createLogger({
      level: logging.level,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true })
      ),
      transports,
      exitOnError: false,
    });
  }

  // Winston logger method proxies
  public info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  public error(message: string, meta?: any): void {
    this.logger.error(message, meta);
  }

  public warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  public debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  public verbose(message: string, meta?: any): void {
    this.logger.verbose(message, meta);
  }

  public silly(message: string, meta?: any): void {
    this.logger.silly(message, meta);
  }

  /**
   * Get the underlying winston logger instance
   */
  public getWinstonLogger(): winston.Logger {
    return this.logger;
  }
}

/**
 * Legacy function for backward compatibility
 * Create application logger with proper configuration
 */
export function createAppLogger(config: MonitoringConfig): winston.Logger {
  const logger = Logger.getInstance();
  logger.initialize(config);
  return logger.getWinstonLogger();
}