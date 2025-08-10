import { readFileSync, existsSync, watchFile, unwatchFile } from 'fs';
import { join } from 'path';
import { Logger } from 'winston';
import { AppConfig, EnvironmentVariables } from '@/types/config';
import { EnvironmentValidator } from './EnvironmentValidator';
import { EventEmitter } from 'events';
import { validate as validateCron } from 'node-cron';

export interface ConfigOptions {
  configDir?: string;
  environment?: string;
  enableHotReload?: boolean;
  validateConfig?: boolean;
}

/**
 * Centralized configuration management with environment-specific overrides
 * Supports hot reloading and validation
 */
export class ConfigManager extends EventEmitter {
  private readonly logger: Logger;
  private readonly options: Required<ConfigOptions>;
  private readonly validator: EnvironmentValidator;
  
  private config: AppConfig | null = null;
  private configFiles: string[] = [];
  private watchedFiles = new Set<string>();

  constructor(logger: Logger, options: ConfigOptions = {}) {
    super();
    this.logger = logger;
    this.validator = new EnvironmentValidator();
    
    this.options = {
      configDir: options.configDir || join(process.cwd(), 'config'),
      environment: options.environment || process.env.NODE_ENV || 'development',
      enableHotReload: options.enableHotReload !== false,
      validateConfig: options.validateConfig !== false,
    };
  }

  /**
   * Load and initialize configuration
   */
  async initialize(): Promise<AppConfig> {
    this.logger.info('Initializing configuration manager', {
      environment: this.options.environment,
      configDir: this.options.configDir,
    });

    try {
      // Validate environment variables first
      if (this.options.validateConfig) {
        await this.validator.validate();
      }

      // Load configuration files
      this.config = await this.loadConfiguration();

      // Set up hot reloading if enabled
      if (this.options.enableHotReload) {
        this.setupHotReload();
      }

      this.logger.info('Configuration loaded successfully');
      this.emit('configLoaded', this.config);

      return this.config;

    } catch (error) {
      this.logger.error('Failed to initialize configuration', { error });
      throw new Error(`Configuration initialization failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): AppConfig {
    if (!this.config) {
      throw new Error('Configuration not initialized. Call initialize() first.');
    }
    return this.config;
  }

  /**
   * Get a specific configuration section
   */
  getSection<T extends keyof AppConfig>(section: T): AppConfig[T] {
    return this.getConfig()[section];
  }

  /**
   * Reload configuration from files
   */
  async reload(): Promise<AppConfig> {
    this.logger.info('Reloading configuration');
    
    try {
      const newConfig = await this.loadConfiguration();
      const oldConfig = this.config;
      
      this.config = newConfig;
      
      this.logger.info('Configuration reloaded successfully');
      this.emit('configReloaded', { oldConfig, newConfig });
      
      return newConfig;
      
    } catch (error) {
      this.logger.error('Failed to reload configuration', { error });
      throw error;
    }
  }

  /**
   * Validate current configuration
   */
  async validateConfiguration(): Promise<boolean> {
    if (!this.config) {
      throw new Error('No configuration to validate');
    }

    try {
      // Validate environment variables
      await this.validator.validate();
      
      // Validate configuration structure
      this.validateConfigStructure(this.config);
      
      // Validate configuration values
      this.validateConfigValues(this.config);
      
      this.logger.debug('Configuration validation passed');
      return true;
      
    } catch (error) {
      this.logger.error('Configuration validation failed', { error });
      throw error;
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopHotReload();
    this.removeAllListeners();
    this.config = null;
  }

  private async loadConfiguration(): Promise<AppConfig> {
    const baseConfig = this.loadConfigFile('default.json');
    const envConfig = this.loadConfigFile(`${this.options.environment}.json`);
    const localConfig = this.loadConfigFile('local.json', false); // Optional

    // Merge configurations (environment overrides base, local overrides environment)
    let mergedConfig = this.mergeConfigs(baseConfig, envConfig);
    if (localConfig) {
      mergedConfig = this.mergeConfigs(mergedConfig, localConfig);
    }

    // Apply environment variable overrides
    const finalConfig = this.applyEnvironmentOverrides(mergedConfig);

    // Normalize analysis interval before validation
    finalConfig.scheduler.analysisInterval = this.normalizeAnalysisInterval(
      finalConfig.scheduler.analysisInterval
    );

    // Validate the final configuration
    if (this.options.validateConfig) {
      this.validateConfigStructure(finalConfig);
      this.validateConfigValues(finalConfig);
    }

    return finalConfig;
  }

  private loadConfigFile(filename: string, required = true): any {
    const filePath = join(this.options.configDir, filename);
    
    if (!existsSync(filePath)) {
      if (required) {
        throw new Error(`Required configuration file not found: ${filePath}`);
      }
      return null;
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      const config = JSON.parse(content);
      
      this.configFiles.push(filePath);
      this.logger.debug(`Loaded configuration file: ${filename}`);
      
      return config;
      
    } catch (error) {
      throw new Error(`Failed to parse configuration file ${filename}: ${(error as Error).message}`);
    }
  }

  private mergeConfigs(base: any, override: any): any {
    if (!override) return base;
    
    const result = { ...base };
    
    for (const [key, value] of Object.entries(override)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        result[key] = this.mergeConfigs(result[key] || {}, value);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }

  private applyEnvironmentOverrides(config: any): AppConfig {
    const env = process.env as unknown as EnvironmentVariables;
    
    // Apply environment variable overrides
    if (env.SOLANA_TRACKER_API_KEY) {
      config.api.solanaTracker.apiKey = env.SOLANA_TRACKER_API_KEY;
    }
    
    if (env.CLAUDE_API_KEY) {
      config.api.claude.apiKey = env.CLAUDE_API_KEY;
    }
    
    if (env.DISCORD_WEBHOOK_URL) {
      config.notifications.discord.webhookUrl = env.DISCORD_WEBHOOK_URL;
    }
    
    if (env.DATABASE_PATH) {
      config.database.path = env.DATABASE_PATH;
    }
    
    if (env.HEALTH_CHECK_PORT) {
      config.monitoring.healthCheck.port = parseInt(env.HEALTH_CHECK_PORT, 10);
    }
    
    if (env.LOG_LEVEL) {
      config.monitoring.logging.level = env.LOG_LEVEL;
    }
    
    if (env.ANALYSIS_INTERVAL) {
      config.scheduler.analysisInterval = this.normalizeAnalysisInterval(env.ANALYSIS_INTERVAL);
    }
    
    if (env.MARKET_CAP_MIN) {
      config.analysis.marketCapRange.min = parseInt(env.MARKET_CAP_MIN, 10);
    }
    
    if (env.MARKET_CAP_MAX) {
      config.analysis.marketCapRange.max = parseInt(env.MARKET_CAP_MAX, 10);
    }
    
    if (env.MIN_RATING_THRESHOLD) {
      config.analysis.ratingThreshold = parseInt(env.MIN_RATING_THRESHOLD, 10);
    }
    
    if (env.API_REQUEST_DELAY_MS) {
      config.api.solanaTracker.requestDelayMs = parseInt(env.API_REQUEST_DELAY_MS, 10);
    }

    // Claude API configuration overrides
    if (env.CLAUDE_MODEL) {
      config.api.claude.model = env.CLAUDE_MODEL;
    }
    
    if (env.CLAUDE_TIMEOUT) {
      config.api.claude.timeout = parseInt(env.CLAUDE_TIMEOUT, 10);
    }
    
    if (env.CLAUDE_MAX_TOKENS) {
      config.api.claude.maxTokens = parseInt(env.CLAUDE_MAX_TOKENS, 10);
    }

    // AI Analysis configuration overrides
    if (env.AI_ANALYSIS_THRESHOLD) {
      if (config.analysis.aiAnalysis) {
        config.analysis.aiAnalysis.minTechnicalRating = parseInt(env.AI_ANALYSIS_THRESHOLD, 10);
      }
    }

    return config;
  }

  private validateConfigStructure(config: AppConfig): void {
    const requiredSections = ['api', 'analysis', 'notifications', 'scheduler', 'database', 'monitoring'];
    
    for (const section of requiredSections) {
      if (!config[section as keyof AppConfig]) {
        throw new Error(`Missing required configuration section: ${section}`);
      }
    }

    // Validate API configuration
    if (!config.api.solanaTracker.baseUrl || !config.api.solanaTracker.apiKey) {
      throw new Error('Missing required Solana Tracker API configuration');
    }

    // Validate Claude API configuration if AI analysis is enabled
    if (config.api.claude && !config.api.claude.apiKey) {
      throw new Error('Missing required Claude API key for AI analysis');
    }

    // Validate Discord configuration
    if (config.notifications.discord.enabled && !config.notifications.discord.webhookUrl) {
      throw new Error('Discord notifications enabled but webhook URL not provided');
    }

    // Validate database configuration
    if (!config.database.path) {
      throw new Error('Database path not configured');
    }
  }

  private validateConfigValues(config: AppConfig): void {
    // Validate market cap range
    if (config.analysis.marketCapRange.min >= config.analysis.marketCapRange.max) {
      throw new Error('Invalid market cap range: min must be less than max');
    }

    // Validate rating threshold
    if (config.analysis.ratingThreshold < 1 || config.analysis.ratingThreshold > 10) {
      throw new Error('Rating threshold must be between 1 and 10');
    }

    // Validate timeouts
    if (config.api.solanaTracker.timeout < 1000) {
      throw new Error('API timeout must be at least 1000ms');
    }

    // Validate ports
    const healthPort = config.monitoring.healthCheck.port;
    if (healthPort < 1024 || healthPort > 65535) {
      throw new Error('Health check port must be between 1024 and 65535');
    }

    // Validate cron expressions
    if (!this.isValidCronExpression(config.scheduler.analysisInterval)) {
      throw new Error('Invalid analysis interval cron expression');
    }
    
    if (!this.isValidCronExpression(config.scheduler.healthCheckInterval)) {
      throw new Error('Invalid health check interval cron expression');
    }
    
    if (!this.isValidCronExpression(config.scheduler.cleanupInterval)) {
      throw new Error('Invalid cleanup interval cron expression');
    }
  }

  /**
   * Normalize analysis interval to a valid cron expression
   * Accepts either a number (minutes) or a cron expression
   */
  private normalizeAnalysisInterval(interval: string): string {
    // Check if it's a number (representing minutes)
    const numericInterval = parseInt(interval, 10);
    if (!isNaN(numericInterval) && numericInterval > 0) {
      // Convert minutes to cron expression
      if (numericInterval >= 60) {
        // For intervals >= 60 minutes, use hour-based cron
        const hours = Math.floor(numericInterval / 60);
        return `0 */${hours} * * *`;
      } else {
        // For intervals < 60 minutes, use minute-based cron
        return `*/${numericInterval} * * * *`;
      }
    }
    
    // Return as-is if it's already a cron expression
    return interval;
  }

  private isValidCronExpression(expression: string): boolean {
    try {
      // Use node-cron's built-in validation
      return validateCron(expression);
    } catch (error) {
      this.logger.debug('Cron validation failed', { expression, error: (error as Error).message });
      return false;
    }
  }

  private setupHotReload(): void {
    this.logger.debug('Setting up configuration hot reload');
    
    for (const filePath of this.configFiles) {
      if (!this.watchedFiles.has(filePath)) {
        watchFile(filePath, { interval: 1000 }, (curr, prev) => {
          if (curr.mtime !== prev.mtime) {
            this.logger.info(`Configuration file changed: ${filePath}`);
            this.handleConfigFileChange(filePath);
          }
        });
        
        this.watchedFiles.add(filePath);
      }
    }
  }

  private stopHotReload(): void {
    for (const filePath of this.watchedFiles) {
      unwatchFile(filePath);
    }
    this.watchedFiles.clear();
  }

  private async handleConfigFileChange(filePath: string): Promise<void> {
    try {
      await this.reload();
    } catch (error) {
      this.logger.error(`Failed to reload configuration after file change: ${filePath}`, { error });
      this.emit('configReloadError', { filePath, error });
    }
  }
}