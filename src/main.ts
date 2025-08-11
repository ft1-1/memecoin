#!/usr/bin/env node

/**
 * Memecoin Momentum Analyzer - Main Entry Point
 * 
 * This is the main application entry point that initializes and starts
 * the entire memecoin momentum analyzer system.
 */

// Load environment variables from .env file
import * as dotenv from 'dotenv';
dotenv.config();

import { createLogger, format, transports } from 'winston';
import { ConfigManager } from '@/config/ConfigManager';
import { SystemOrchestrator } from '@/orchestrator/SystemOrchestrator';
import { ComponentManager } from '@/orchestrator/ComponentManager';
import { StateManager } from '@/orchestrator/StateManager';
import { ErrorRecovery } from '@/orchestrator/ErrorRecovery';
import { TaskScheduler } from '@/scheduler/TaskScheduler';
import { HealthChecker } from '@/monitoring/HealthChecker';
import { MetricsCollector } from '@/monitoring/MetricsCollector';
import { createAppLogger } from '@/utils/Logger';

// Import specialized components
import { createMemecoinAnalyzerClient } from '@/data/api';
import { createMemecoinTechnicalAnalysisSystemComponent } from '@/analysis/technical';
import { createMemecoinRatingEngineSystemComponent } from '@/analysis/rating';
import { createMemecoinNotificationSystemComponent } from '@/notifications/discord';
import { HistoricalDataManager } from '@/database/HistoricalDataManager';
import { createMomentumAccelerationSystemComponent } from '@/analysis/momentum/MomentumAccelerationSystemComponent';
import { createEntrySignalSystemComponent } from '@/signals/EntrySignalSystemComponent';

/**
 * Main application class that bootstraps the entire system
 */
class MemecoinAnalyzerApp {
  private configManager: ConfigManager | null = null;
  private orchestrator: SystemOrchestrator | null = null;
  private logger: any = null;

  /**
   * Initialize and start the application
   */
  async start(): Promise<void> {
    try {
      // Create initial logger (will be replaced with configured logger)
      this.logger = createLogger({
        level: 'info',
        format: format.simple(),
        transports: [new transports.Console()],
      });

      this.logger.info('🚀 Starting Memecoin Momentum Analyzer');
      this.logger.info('📊 Production-ready cryptocurrency analysis system');
      console.log('\n=== MEMECOIN MOMENTUM ANALYZER ===');
      console.log('🎯 Target: High-potential memecoins ($5M-$50M market cap)');
      console.log('⚡ Analysis: Technical indicators + momentum detection');
      console.log('🎪 Notifications: Discord alerts for rated opportunities (≥7)');
      console.log('=====================================\n');

      // Initialize configuration management
      await this.initializeConfiguration();

      // Create configured logger
      this.logger = createAppLogger(this.configManager!.getSection('monitoring'));

      // Initialize all system components
      await this.initializeComponents();

      // Start the system orchestrator
      await this.orchestrator!.start();

      this.logger.info('✅ Memecoin Momentum Analyzer started successfully');
      console.log('🟢 System Status: RUNNING');
      console.log(`📡 Health Check: http://localhost:${this.configManager!.getSection('monitoring').healthCheck.port}/health`);
      console.log('📈 Ready to analyze trending memecoins...\n');

    } catch (error) {
      console.error('❌ Failed to start Memecoin Momentum Analyzer:', error);
      if (this.logger) {
        this.logger.error('Application startup failed', { error });
      }
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.logger) {
      this.logger.info('🛑 Shutting down Memecoin Momentum Analyzer');
    }
    console.log('\n🛑 Initiating graceful shutdown...');

    try {
      if (this.orchestrator) {
        await this.orchestrator.shutdown();
      }

      if (this.configManager) {
        this.configManager.destroy();
      }

      if (this.logger) {
        this.logger.info('✅ Memecoin Momentum Analyzer shutdown completed');
      }
      console.log('✅ Shutdown completed successfully');

    } catch (error) {
      console.error('❌ Error during shutdown:', error);
      if (this.logger) {
        this.logger.error('Shutdown error', { error });
      }
      process.exit(1);
    }
  }

  private async initializeConfiguration(): Promise<void> {
    this.logger.info('⚙️  Initializing configuration management');

    this.configManager = new ConfigManager(this.logger, {
      environment: process.env.NODE_ENV || 'development',
      enableHotReload: process.env.NODE_ENV !== 'production',
      validateConfig: true,
    });

    const config = await this.configManager.initialize();
    
    this.logger.info('Configuration loaded', {
      environment: process.env.NODE_ENV || 'development',
      marketCapRange: config.analysis.marketCapRange,
      ratingThreshold: config.analysis.ratingThreshold,
      analysisInterval: config.scheduler.analysisInterval,
    });
  }

  private async initializeComponents(): Promise<void> {
    if (!this.configManager) {
      throw new Error('Configuration not initialized');
    }

    const config = this.configManager.getConfig();
    this.logger.info('🔧 Initializing system components');

    // Create core orchestration components
    const componentManager = new ComponentManager(this.logger);
    const stateManager = new StateManager();
    const errorRecovery = new ErrorRecovery(config, this.logger);
    const scheduler = new TaskScheduler(this.logger);
    const healthChecker = new HealthChecker(config.monitoring, this.logger);
    const metricsCollector = new MetricsCollector(config.monitoring, this.logger);

    // Register components with dependencies
    await this.registerPlaceholderComponents(componentManager, config);

    // Create system orchestrator
    this.orchestrator = new SystemOrchestrator(
      config,
      this.logger,
      componentManager,
      stateManager,
      errorRecovery,
      scheduler,
      healthChecker,
      metricsCollector
    );

    // Initialize the orchestrator
    await this.orchestrator.initialize();

    this.logger.info('✅ All components initialized successfully');
  }

  private async registerPlaceholderComponents(componentManager: ComponentManager, config: any): Promise<void> {
    this.logger.info('📝 Registering production components');
    
    // Initialize Historical Data Manager (first, as other components may depend on it)
    this.logger.info('   💾 Initializing Historical Data Manager...');
    const historicalDataManager = new HistoricalDataManager(
      {
        dbPath: config.database?.path || './data/memecoin_analyzer.db',
        cleanupIntervalHours: config.database?.cleanupIntervalHours || 24,
        maxStreakHistory: config.database?.maxStreakHistory || 10,
        exhaustionThreshold: config.analysis?.exhaustionThreshold || 5
      },
      this.logger.child({ component: 'HistoricalDataManager' })
    );
    componentManager.registerComponent('historical-data', historicalDataManager, [], 0);

    // Initialize Solana Tracker API client
    this.logger.info('   🔄 Initializing Solana Tracker API client...');
    const apiClient = createMemecoinAnalyzerClient(
      config.api.solanaTracker,
      this.logger.child({ component: 'SolanaTrackerClient' })
    );
    componentManager.registerComponent('api-client', apiClient, [], 1);

    // Initialize Technical Analysis Engine
    this.logger.info('   📊 Initializing Technical Analysis Engine...');
    const technicalAnalysisEngine = createMemecoinTechnicalAnalysisSystemComponent(
      this.logger.child({ component: 'TechnicalAnalysis' })
    );
    componentManager.registerComponent('technical-analysis', technicalAnalysisEngine, ['historical-data'], 2);

    // Initialize Rating Engine
    this.logger.info('   🎯 Initializing Rating Engine...');
    const ratingEngine = createMemecoinRatingEngineSystemComponent(
      {
        weights: {
          technical: 0.25,
          momentum: 0.25,
          volume: 0.35,
          risk: 0.15,
        },
        adaptiveWeighting: true,
        confidenceThreshold: 70,
        // Enhanced rating features
        consecutiveMomentumEnabled: config.analysis?.consecutiveMomentumEnabled ?? true,
        multiTimeframeAnalysis: config.analysis?.multiTimeframeAnalysis ?? true,
        exhaustionDetection: config.analysis?.exhaustionDetection ?? true,
      },
      this.logger.child({ component: 'RatingEngine' }),
      historicalDataManager.getDatabaseManager() // Pass DatabaseManager for consecutive momentum persistence
    );
    componentManager.registerComponent('rating-engine', ratingEngine, ['historical-data'], 3);

    // Initialize Momentum Acceleration Component
    this.logger.info('   ⚡ Initializing Momentum Acceleration Tracker...');
    const momentumAccelerationComponent = createMomentumAccelerationSystemComponent(
      {
        enabled: config.analysis?.momentumAccelerationEnabled ?? true,
        cacheDurationMs: config.analysis?.momentumCacheDuration ?? 5 * 60 * 1000, // 5 minutes
        momentumConfig: {
          minDataPoints: config.analysis?.minDataPoints ?? 48,
          velocityWindows: {
            short: 60, // 1 hour
            medium: 240, // 4 hours
          }
        }
      },
      this.logger.child({ component: 'MomentumAcceleration' })
    );
    componentManager.registerComponent('momentum-acceleration', momentumAccelerationComponent, [], 4);

    // Initialize Entry Signal Component
    this.logger.info('   🎯 Initializing Entry Signal Generator...');
    const entrySignalComponent = createEntrySignalSystemComponent(
      {
        enabled: config.analysis?.entrySignalEnabled ?? true,
        cacheDurationMs: config.analysis?.signalCacheDuration ?? 2 * 60 * 1000, // 2 minutes
        signalConfig: {
          volumeSurgeThreshold: config.analysis?.volumeSurgeThreshold ?? 3.0,
          minRatingThreshold: config.analysis?.ratingThreshold ?? 7.0,
          minConfidenceThreshold: config.analysis?.minConfidenceThreshold ?? 70,
          timeframeAlignmentThreshold: config.analysis?.timeframeAlignmentThreshold ?? 60,
          weights: {
            volumeSurge: 0.35,
            momentumAcceleration: 0.30,
            rating: 0.25,
            multiTimeframe: 0.10
          }
        }
      },
      this.logger.child({ component: 'EntrySignal' }),
      ratingEngine // Pass the rating engine component itself
    );
    componentManager.registerComponent('entry-signal', entrySignalComponent, ['rating-engine'], 5);

    // Initialize Discord Notification Service
    this.logger.info('   🔔 Initializing Discord Notification Service...');
    const discordService = createMemecoinNotificationSystemComponent(
      config.notifications.discord.webhookUrl,
      this.logger.child({ component: 'DiscordNotification' }),
      {
        testMode: false,
        enableHealthChecks: true,
        minRating: config.analysis?.ratingThreshold || 7,
      }
    );
    componentManager.registerComponent('discord', discordService, [], 6);

    this.logger.info('✅ All production components registered successfully');
  }
}

/**
 * Application entry point
 */
async function main(): Promise<void> {
  const app = new MemecoinAnalyzerApp();

  // Handle process signals for graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n📡 Received ${signal}, initiating graceful shutdown...`);
    await app.shutdown();
    process.exit(0);
  };

  // Register signal handlers
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGUSR2', () => shutdown('SIGUSR2')); // nodemon restart

  // Handle uncaught exceptions
  process.on('uncaughtException', async (error) => {
    console.error('💥 Uncaught Exception:', error);
    await app.shutdown();
    process.exit(1);
  });

  process.on('unhandledRejection', async (reason, promise) => {
    console.error('💥 Unhandled Promise Rejection at:', promise, 'reason:', reason);
    await app.shutdown();
    process.exit(1);
  });

  // Start the application
  await app.start();
}

// Execute main function if this file is run directly
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Fatal error during startup:', error);
    process.exit(1);
  });
}

export { MemecoinAnalyzerApp };