import Joi from 'joi';
import { EnvironmentVariables } from '@/types/config';

/**
 * Validates environment variables and provides type-safe access
 */
export class EnvironmentValidator {
  private readonly schema: Joi.ObjectSchema;
  private validatedEnv: EnvironmentVariables | null = null;

  constructor() {
    this.schema = this.createValidationSchema();
  }

  /**
   * Validate environment variables
   */
  async validate(): Promise<EnvironmentVariables> {
    const env = process.env;
    
    const { error, value } = this.schema.validate(env, {
      allowUnknown: true,
      stripUnknown: false,
    });

    if (error) {
      const missingVars = error.details
        .filter(detail => detail.type === 'any.required')
        .map(detail => detail.path.join('.'));
      
      const invalidVars = error.details
        .filter(detail => detail.type !== 'any.required')
        .map(detail => `${detail.path.join('.')}: ${detail.message}`);

      let errorMessage = 'Environment validation failed:\n';
      
      if (missingVars.length > 0) {
        errorMessage += `Missing required variables: ${missingVars.join(', ')}\n`;
      }
      
      if (invalidVars.length > 0) {
        errorMessage += `Invalid variables: ${invalidVars.join(', ')}\n`;
      }

      throw new Error(errorMessage);
    }

    this.validatedEnv = value as EnvironmentVariables;
    return this.validatedEnv;
  }

  /**
   * Get validated environment variables
   */
  getValidatedEnv(): EnvironmentVariables {
    if (!this.validatedEnv) {
      throw new Error('Environment not validated. Call validate() first.');
    }
    return this.validatedEnv;
  }

  /**
   * Check if required environment variables are set
   */
  checkRequiredVariables(): { missing: string[]; present: string[] } {
    const required = [
      'SOLANA_TRACKER_API_KEY',
      'CLAUDE_API_KEY',
      'DISCORD_WEBHOOK_URL',
    ];

    const missing: string[] = [];
    const present: string[] = [];

    for (const variable of required) {
      if (!process.env[variable]) {
        missing.push(variable);
      } else {
        present.push(variable);
      }
    }

    return { missing, present };
  }

  /**
   * Generate example .env file content
   */
  generateExampleEnv(): string {
    return `# Memecoin Momentum Analyzer Environment Configuration

# API Configuration
SOLANA_TRACKER_API_KEY=your_solana_tracker_api_key_here
CLAUDE_API_KEY=your_claude_api_key_here
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/your_webhook_url

# Analysis Parameters
MARKET_CAP_MIN=5000000
MARKET_CAP_MAX=50000000
MIN_RATING_THRESHOLD=7
ANALYSIS_INTERVAL="*/5 * * * *"

# System Configuration
NODE_ENV=production
DATABASE_PATH=./database/data/memecoin.db
HEALTH_CHECK_PORT=3001
LOG_LEVEL=info

# Optional: Override default timeouts and limits
# API_TIMEOUT=30000
# MAX_RETRIES=3
# RATE_LIMIT_RPS=1
# API_REQUEST_DELAY_MS=1000

# Optional: Claude AI Configuration
# CLAUDE_MODEL=claude-3-5-sonnet-20241022
# CLAUDE_TIMEOUT=30000
# CLAUDE_MAX_TOKENS=4000
`;
  }

  private createValidationSchema(): Joi.ObjectSchema {
    return Joi.object({
      // Environment
      NODE_ENV: Joi.string()
        .valid('development', 'production', 'test')
        .default('development'),

      // Required API keys
      SOLANA_TRACKER_API_KEY: Joi.string()
        .required()
        .messages({
          'any.required': 'SOLANA_TRACKER_API_KEY is required',
          'string.empty': 'SOLANA_TRACKER_API_KEY cannot be empty',
        }),

      CLAUDE_API_KEY: Joi.string()
        .required()
        .pattern(/^sk-ant-api03-/)
        .messages({
          'any.required': 'CLAUDE_API_KEY is required',
          'string.empty': 'CLAUDE_API_KEY cannot be empty',
          'string.pattern.base': 'CLAUDE_API_KEY must be a valid Anthropic API key (starts with sk-ant-api03-)',
        }),

      DISCORD_WEBHOOK_URL: Joi.string()
        .uri({ scheme: ['https'] })
        .pattern(/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/.+$/)
        .required()
        .messages({
          'any.required': 'DISCORD_WEBHOOK_URL is required',
          'string.uri': 'DISCORD_WEBHOOK_URL must be a valid HTTPS URL',
          'string.pattern.base': 'DISCORD_WEBHOOK_URL must be a valid Discord webhook URL (https://discord.com/api/webhooks/...)',
        }),

      // Optional configuration overrides
      DATABASE_PATH: Joi.string()
        .optional(),

      HEALTH_CHECK_PORT: Joi.number()
        .port()
        .optional()
        .messages({
          'number.port': 'HEALTH_CHECK_PORT must be a valid port number (1-65535)',
        }),

      LOG_LEVEL: Joi.string()
        .valid('error', 'warn', 'info', 'debug')
        .optional(),

      ANALYSIS_INTERVAL: Joi.string()
        .pattern(/^[\d\*\/\-\,\s]+$/)
        .optional()
        .messages({
          'string.pattern.base': 'ANALYSIS_INTERVAL must be a valid cron expression',
        }),

      MARKET_CAP_MIN: Joi.number()
        .positive()
        .optional()
        .messages({
          'number.positive': 'MARKET_CAP_MIN must be a positive number',
        }),

      MARKET_CAP_MAX: Joi.number()
        .positive()
        .optional()
        .when('MARKET_CAP_MIN', {
          is: Joi.exist(),
          then: Joi.number().greater(Joi.ref('MARKET_CAP_MIN')),
        })
        .messages({
          'number.positive': 'MARKET_CAP_MAX must be a positive number',
          'number.greater': 'MARKET_CAP_MAX must be greater than MARKET_CAP_MIN',
        }),

      MIN_RATING_THRESHOLD: Joi.number()
        .min(1)
        .max(10)
        .optional()
        .messages({
          'number.min': 'MIN_RATING_THRESHOLD must be at least 1',
          'number.max': 'MIN_RATING_THRESHOLD must be at most 10',
        }),

      // Optional API configuration
      API_TIMEOUT: Joi.number()
        .min(1000)
        .optional()
        .messages({
          'number.min': 'API_TIMEOUT must be at least 1000ms',
        }),

      MAX_RETRIES: Joi.number()
        .min(0)
        .max(10)
        .optional()
        .messages({
          'number.min': 'MAX_RETRIES must be at least 0',
          'number.max': 'MAX_RETRIES must be at most 10',
        }),

      RATE_LIMIT_RPS: Joi.number()
        .positive()
        .optional()
        .messages({
          'number.positive': 'RATE_LIMIT_RPS must be a positive number',
        }),

      API_REQUEST_DELAY_MS: Joi.number()
        .min(0)
        .optional()
        .messages({
          'number.min': 'API_REQUEST_DELAY_MS must be at least 0',
        }),

      // Claude API Configuration
      CLAUDE_MODEL: Joi.string()
        .optional()
        .default('claude-3-5-sonnet-20241022')
        .messages({
          'string.base': 'CLAUDE_MODEL must be a valid Claude model name',
        }),

      CLAUDE_TIMEOUT: Joi.number()
        .min(5000)
        .max(120000)
        .optional()
        .default(30000)
        .messages({
          'number.min': 'CLAUDE_TIMEOUT must be at least 5000ms',
          'number.max': 'CLAUDE_TIMEOUT must be at most 120000ms (2 minutes)',
        }),

      CLAUDE_MAX_TOKENS: Joi.number()
        .min(100)
        .max(8000)
        .optional()
        .default(4000)
        .messages({
          'number.min': 'CLAUDE_MAX_TOKENS must be at least 100',
          'number.max': 'CLAUDE_MAX_TOKENS must be at most 8000',
        }),
    });
  }

  /**
   * Validate and sanitize a single environment variable
   */
  validateVariable(name: string, value: string | undefined): any {
    const schema = this.schema.extract(name);
    if (!schema) {
      throw new Error(`Unknown environment variable: ${name}`);
    }

    const { error, value: sanitizedValue } = schema.validate(value);
    if (error) {
      throw new Error(`Invalid value for ${name}: ${error.message}`);
    }

    return sanitizedValue;
  }

  /**
   * Get environment variable with validation
   */
  getEnvVar<T = string>(name: string, defaultValue?: T): T {
    const value = process.env[name];
    
    if (value === undefined) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`Environment variable ${name} is not set`);
    }

    try {
      return this.validateVariable(name, value) as T;
    } catch (error) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw error;
    }
  }

  /**
   * Check if running in production
   */
  isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  /**
   * Check if running in development
   */
  isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  }

  /**
   * Check if running in test environment
   */
  isTest(): boolean {
    return process.env.NODE_ENV === 'test';
  }
}