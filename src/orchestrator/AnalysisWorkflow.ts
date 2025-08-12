/**
 * Main analysis workflow for the memecoin momentum analyzer
 * Orchestrates the entire analysis pipeline from data fetching to notifications
 */

import { Logger } from 'winston';
import { ComponentManager } from './ComponentManager';
import { StateManager } from './StateManager';
import { ErrorRecovery } from './ErrorRecovery';
import { AnalysisContext } from '../types/analysis';
import { TokenData } from '../types/api';
import { SolanaTrackerSystemComponent } from '../data/api/solana-tracker/SolanaTrackerSystemComponent';
import { TechnicalAnalysisSystemComponent } from '../analysis/technical/TechnicalAnalysisSystemComponent';
import { RatingEngineSystemComponent } from '../analysis/rating/RatingEngineSystemComponent';
import { DiscordNotificationSystemComponent } from '../notifications/discord/DiscordNotificationSystemComponent';
import { ApiDataMapper } from '../data/api/solana-tracker/ApiDataMapper';
import { SolanaTrackerTokenResponse } from '../data/api/solana-tracker/types';
import { ClaudeAnalyst, ClaudeAnalystConfig } from '../ai/ClaudeAnalyst';
import { AIAnalysisInput, AIAnalysisResult, TechnicalIndicators } from '../types/analysis';
import { HistoricalDataManager } from '../database/HistoricalDataManager';
import { CircuitBreaker, CircuitBreakerManager } from '../utils/CircuitBreaker';
import { ParallelProcessor, MultiTimeframeProcessor } from '../utils/ParallelProcessor';
import { PerformanceMonitor, PerformanceCache } from '../utils/PerformanceMonitor';
import { MomentumAccelerationSystemComponent } from '../analysis/momentum/MomentumAccelerationSystemComponent';
import { EntrySignalSystemComponent } from '../signals/EntrySignalSystemComponent';
import { MomentumAcceleration } from '../analysis/momentum/MomentumAccelerationTracker';
import { EntrySignal } from '../signals/EntrySignalGenerator';

export interface AnalysisWorkflowConfig {
  marketCapMin: number;
  marketCapMax: number;
  minRatingThreshold: number;
  minVolume: number;
  maxRiskLevel: string;
  aiAnalysis?: {
    enabled: boolean;
    minTechnicalRating: number;
    claudeConfig: ClaudeAnalystConfig;
  };
}

export interface TokenAnalysisResult {
  rawTokenResponse: SolanaTrackerTokenResponse;
  mappedData: {
    tokenData: TokenData;
    volumeAnalysis: any;
    riskAssessment: any;
    chartData?: any;
  };
  analysis: any;
  rating: any;
  chartData: any;
  multiTimeframeData?: {
    '5m': any[];
    '15m': any[];
    '1h': any[];
    '4h': any[];
  };
  aiAnalysis?: AIAnalysisResult;
  consecutiveMomentumData?: {
    tracker: any;
    boost: number;
    exhaustionRisk: boolean;
  };
  momentumAcceleration?: MomentumAcceleration;
  entrySignal?: EntrySignal;
  performanceMetrics?: {
    analysisTime: number;
    apiCalls: number;
    cacheHits: number;
    dbOperations: number;
    apiCallOptimization?: {
      traditionalCalls: number;
      optimizedCalls: number;
      reduction: string;
    };
  };
}

export class AnalysisWorkflow {
  private dataMapper = new ApiDataMapper();
  private claudeAnalyst?: ClaudeAnalyst;
  private circuitBreakerManager: CircuitBreakerManager;
  private aiAnalysisCircuitBreaker?: CircuitBreaker;
  private apiCircuitBreaker?: CircuitBreaker;
  private parallelProcessor: ParallelProcessor;
  private multiTimeframeProcessor: MultiTimeframeProcessor;
  private performanceMonitor: PerformanceMonitor;
  private analysisCache: PerformanceCache<any>;
  
  constructor(
    private config: AnalysisWorkflowConfig,
    private logger: Logger,
    private componentManager: ComponentManager,
    private stateManager: StateManager,
    private _errorRecovery: ErrorRecovery // Prefixed with underscore to indicate intentionally unused
  ) {
    // Initialize circuit breaker manager
    this.circuitBreakerManager = new CircuitBreakerManager(this.logger);
    
    // Initialize API circuit breaker
    this.apiCircuitBreaker = this.circuitBreakerManager.getCircuitBreaker('solana-tracker-api', {
      failureThreshold: 5,
      resetTimeout: 30000, // 30 seconds
      monitoringWindow: 60000, // 1 minute
      halfOpenMaxCalls: 3
    });

    // Initialize Claude Analyst if AI analysis is enabled
    if (config.aiAnalysis?.enabled && config.aiAnalysis.claudeConfig) {
      try {
        this.claudeAnalyst = new ClaudeAnalyst(config.aiAnalysis.claudeConfig, this.logger);
        
        // Initialize AI circuit breaker
        this.aiAnalysisCircuitBreaker = this.circuitBreakerManager.getCircuitBreaker('claude-ai-analysis', {
          failureThreshold: 3,
          resetTimeout: 60000, // 1 minute
          monitoringWindow: 300000, // 5 minutes
          halfOpenMaxCalls: 2
        });
        
        this.logger.info('Claude AI Analyst initialized with circuit breaker protection', {
          minTechnicalRating: config.aiAnalysis.minTechnicalRating,
          model: config.aiAnalysis.claudeConfig.model
        });
      } catch (error) {
        this.logger.error('Failed to initialize Claude AI Analyst', {
          error: error instanceof Error ? error.message : String(error)
        });
        // Continue without AI analysis rather than failing completely
        this.claudeAnalyst = undefined;
        this.aiAnalysisCircuitBreaker = undefined;
      }
    } else {
      this.logger.info('Claude AI Analyst disabled in configuration');
    }
    
    // Initialize parallel processors
    this.parallelProcessor = new ParallelProcessor(
      {
        concurrency: 3, // Conservative for API rate limits
        timeout: 45000, // 45 seconds per token
        retries: 2,
        retryDelay: 1000,
        enableBatching: true,
        batchSize: 5 // Process 5 tokens at a time
      },
      this.logger
    );
    
    this.multiTimeframeProcessor = new MultiTimeframeProcessor(
      this.logger,
      4 // 4 concurrent timeframe requests
    );
    
    // Initialize performance monitoring
    this.performanceMonitor = new PerformanceMonitor(this.logger);
    this.analysisCache = this.performanceMonitor.getCache();
  }

  /**
   * Execute the main analysis workflow
   */
  async execute(): Promise<void> {
    const workflowId = `analysis-${Date.now()}`;
    
    // Log cycle start
    this.logger.info('Starting analysis cycle', {
      activity: 'CYCLE_START',
      cycleNumber: Date.now() // Using timestamp as cycle number
    });
    
    this.logger.info('Starting analysis workflow', { workflowId });
    
    try {
      // Update state
      this.stateManager.setState('running');
      
      // Get components with proper typing
      const apiClientComponent = this.componentManager.getComponent<SolanaTrackerSystemComponent>('api-client');
      const technicalAnalysisComponent = this.componentManager.getComponent<TechnicalAnalysisSystemComponent>('technical-analysis');
      const ratingEngineComponent = this.componentManager.getComponent<RatingEngineSystemComponent>('rating-engine');
      const discordComponent = this.componentManager.getComponent<DiscordNotificationSystemComponent>('discord');
      const historicalDataManager = this.componentManager.getComponent<HistoricalDataManager>('historical-data');
      const momentumAccelerationComponent = this.componentManager.getComponent<MomentumAccelerationSystemComponent>('momentum-acceleration');
      const entrySignalComponent = this.componentManager.getComponent<EntrySignalSystemComponent>('entry-signal');
      
      if (!apiClientComponent) {
        throw new Error('API client component not found');
      }
      
      if (!technicalAnalysisComponent) {
        throw new Error('Technical analysis component not found');
      }
      
      if (!ratingEngineComponent) {
        throw new Error('Rating engine component not found');
      }
      
      if (!historicalDataManager) {
        this.logger.warn('Historical data manager not found - consecutive momentum tracking disabled');
      }
      
      // Check component readiness
      if (!apiClientComponent.isReady()) {
        throw new Error('API client component is not ready');
      }
      
      if (!technicalAnalysisComponent.isReady()) {
        throw new Error('Technical analysis component is not ready');
      }
      
      if (!ratingEngineComponent.isReady()) {
        throw new Error('Rating engine component is not ready');
      }
      
      // SystemComponent wrapper for API client
      // Note: apiClient reference removed as it was unused
      
      // 1. Fetch trending tokens with performance tracking
      this.logger.info('⬇️  Fetching trending tokens from Solana...');
      const trendingResponse = await this.performanceMonitor.trackOperation(
        'fetch-trending-tokens',
        () => apiClientComponent.getTrendingTokensFiltered(
          '1h',
          {
            min: this.config.marketCapMin,
            max: this.config.marketCapMax,
          },
          {
            minVolume: this.config.minVolume,
            ...(this.config.maxRiskLevel && { maxRiskLevel: this.config.maxRiskLevel as 'low' | 'medium' | 'high' }),
          }
        ),
        {
          marketCapRange: `${this.config.marketCapMin}-${this.config.marketCapMax}`,
          minVolume: this.config.minVolume
        }
      );
      
      this.logger.info(`Found ${trendingResponse.tokens.length} tokens in target range`);
      this.stateManager.incrementMetric('tokens_analyzed', trendingResponse.tokens.length);
      
      // 2. Process tokens with parallel processing for better performance
      const highRatedTokens: TokenAnalysisResult[] = [];
      const processStartTime = Date.now();
      let totalApiCalls = 0;
      let totalCacheHits = 0;
      let totalDbOperations = 0;
      
      // Process tokens in parallel batches with performance tracking
      const batchResult = await this.performanceMonitor.trackOperation(
        'parallel-token-processing',
        () => this.parallelProcessor.processTasks(
          trendingResponse.tokens,
          async (token) => {
            return await this.processTokenWithMetrics(
              token,
              apiClientComponent,
              technicalAnalysisComponent,
              ratingEngineComponent,
              historicalDataManager,
              momentumAccelerationComponent,
              entrySignalComponent
            );
          },
          'token-analysis'
        ),
        {
          tokenCount: trendingResponse.tokens.length,
          concurrency: this.parallelProcessor.getStatistics().concurrency
        }
      );
      
      // Collect results and metrics
      const results = batchResult.results.map(r => r.success ? r.data : null);
      
      for (const result of batchResult.results) {
        if (result.success && result.data?.performanceMetrics) {
          totalApiCalls += result.data.performanceMetrics.apiCalls;
          totalCacheHits += result.data.performanceMetrics.cacheHits;
          totalDbOperations += result.data.performanceMetrics.dbOperations;
        }
      }
      
      // Filter high-rated tokens
      for (const result of results) {
        if (result && result.rating.rating >= this.config.minRatingThreshold) {
          highRatedTokens.push(result);
        }
      }
      
      // Log parallel processing statistics
      this.logger.info('Parallel token processing completed', {
        totalTokens: trendingResponse.tokens.length,
        successfulAnalyses: batchResult.successCount,
        failedAnalyses: batchResult.failureCount,
        averageAnalysisTime: Math.round(batchResult.averageTaskTime),
        parallelProcessingTime: batchResult.totalDuration,
        throughput: Math.round((batchResult.successCount / batchResult.totalDuration) * 1000) // analyses per second
      });
      // This section has been replaced by parallel processing above
      
      // Show rating summary
      this.logger.info(`\n📈 Rating Summary (showing final ratings after AI):`, {
        activity: 'RATING_SUMMARY'
      });
      
      // Sort results by rating for display
      const sortedResults = results
        .filter(r => r && r.rating)
        .sort((a, b) => b.rating.rating - a.rating.rating);
      
      // Track rating distribution for this cycle
      const cycleRatingDistribution: Record<number, number> = {};
      for (let i = 0; i <= 10; i++) {
        cycleRatingDistribution[i] = 0;
      }
      
      // Display all tokens with their ratings and collect distribution data
      sortedResults.forEach((result) => {
        const aiUsed = result.aiAnalysis ? ' 🤖' : '';
        const symbol = result.mappedData.tokenData.symbol;
        const rating = result.rating.rating.toFixed(1);
        const threshold = result.rating.rating >= this.config.minRatingThreshold;
        
        this.logger.info(`   ${symbol}: ${rating}/10${aiUsed}${threshold ? ' 🔔' : ''}`, {
          activity: 'TOKEN_RATING_SUMMARY'
        });
        
        // Update rating distribution for this cycle
        const roundedRating = Math.round(result.rating.rating);
        cycleRatingDistribution[roundedRating] = (cycleRatingDistribution[roundedRating] || 0) + 1;
      });
      
      // Update cumulative rating distribution in StateManager
      const cumulativeRatingDistribution: Record<number, number> = {};
      for (let i = 0; i <= 10; i++) {
        const currentCount = this.stateManager.getMetric(`rating_${i}`);
        const newCount = currentCount + cycleRatingDistribution[i];
        this.stateManager.incrementMetric(`rating_${i}`, cycleRatingDistribution[i]);
        cumulativeRatingDistribution[i] = newCount;
      }
      
      // Log rating distribution for this cycle
      this.logger.info('\n📊 Cycle Rating Distribution:', {
        activity: 'RATING_DISTRIBUTION',
        ratingDistribution: cycleRatingDistribution,
        isCumulative: false
      });
      
      // Log cumulative rating distribution
      const totalTokensRated = Object.values(cumulativeRatingDistribution).reduce((sum, count) => sum + count, 0);
      this.logger.info('📊 Cumulative Rating Distribution (Total: ' + totalTokensRated + ' tokens):', {
        activity: 'RATING_DISTRIBUTION',
        ratingDistribution: cumulativeRatingDistribution,
        isCumulative: true,
        totalTokensRated
      });
      
      // 3. Send notifications for high-rated tokens
      if (highRatedTokens.length > 0) {
        this.logger.info(`\n🔔 Sending notifications for ${highRatedTokens.length} tokens that scored ≥${this.config.minRatingThreshold}`, {
          activity: 'SENDING_NOTIFICATIONS'
        });
      } else {
        this.logger.info(`\n❌ No tokens reached notification threshold (≥${this.config.minRatingThreshold})`, {
          activity: 'NO_NOTIFICATIONS'
        });
      }
      
      if (discordComponent && discordComponent.isReady()) {
        for (const item of highRatedTokens) {
          try {
            // Extract proper data from mapped token data
            const mappedData = item.mappedData;
            const primaryPool = item.rawTokenResponse.pools?.[0];
            
            const alertData: any = {
              token: {
                name: mappedData.tokenData.name,
                symbol: mappedData.tokenData.symbol,
                address: mappedData.tokenData.address,
                price: primaryPool?.price?.usd || 0,
                priceChange24h: item.rawTokenResponse.events?.['24h']?.priceChangePercentage || 0,
                marketCap: primaryPool?.marketCap?.usd || 0,
                volume24h: primaryPool?.txns?.volume24h || 0,
              },
              rating: {
                score: item.rating.rating,
                confidence: item.rating.confidence,
                recommendation: item.rating.recommendation,
                reasoning: item.rating.reasoning,
                alerts: item.rating.alerts || [],
              },
              technicalAnalysis: {
                trend: item.analysis.momentum?.trend || 'neutral',
                momentum: item.analysis.momentum?.strength || 0,
                rsi: item.analysis.technicalIndicators?.rsi || 50,
                volumeSpike: item.analysis.volume?.volumeSpike || false,
                patterns: item.analysis.patterns?.patterns?.map((p: any) => p.type) || [],
              },
              risk: {
                level: mappedData.riskAssessment.riskLevel,
                score: mappedData.riskAssessment.overall || 0,
                warnings: mappedData.riskAssessment.warnings,
              },
            };

            // Add entry signal data if available
            if (item.entrySignal) {
              alertData.entrySignal = {
                type: item.entrySignal.type,
                score: item.entrySignal.score,
                confidence: item.entrySignal.confidence,
                reasons: item.entrySignal.reasons,
                risks: item.entrySignal.risks,
                entry: item.entrySignal.entry
              };
            }

            // Add momentum acceleration data if available
            if (item.momentumAcceleration) {
              alertData.momentumAcceleration = {
                sustainabilityScore: item.momentumAcceleration.sustainabilityScore,
                fatigueLevel: item.momentumAcceleration.fatigueLevel,
                entrySignalStrength: item.momentumAcceleration.entrySignalStrength,
                consecutiveCandles: item.momentumAcceleration.consecutiveCandles
              };
            }

            this.logger.info(`Attempting to send Discord notification for ${mappedData.tokenData.symbol}`, {
              tokenSymbol: mappedData.tokenData.symbol,
              tokenAddress: mappedData.tokenData.address,
              rating: item.rating.rating,
              marketCap: alertData.token.marketCap
            });
            
            await discordComponent.sendTokenAlert(alertData);
            
            this.logger.info(`Successfully sent Discord notification for ${mappedData.tokenData.symbol}`, {
              tokenSymbol: mappedData.tokenData.symbol,
              rating: item.rating.rating
            });
            
            this.stateManager.incrementMetric('notifications_sent', 1);
          } catch (error) {
          this.logger.error(`Failed to send notification for ${item.mappedData.tokenData.symbol}`, {
            error: {
              message: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
              name: error instanceof Error ? error.name : 'Unknown',
              ...(error && typeof error === 'object' ? error : {})
            },
            tokenAddress: item.mappedData.tokenData.address,
            tokenSymbol: item.mappedData.tokenData.symbol
          });
          this.stateManager.incrementMetric('notification_errors', 1);
        }
      }
      } else {
        this.logger.warn('Discord component not available, skipping notifications');
      }
      
      // Update state and metrics
      this.stateManager.setState('running');
      this.stateManager.updateLastExecutionTime();
      
      const totalProcessingTime = Date.now() - processStartTime;
      
      // Calculate API call optimization statistics
      let totalOptimizedCalls = 0;
      let totalTraditionalCalls = 0;
      for (const result of results) {
        if (result?.performanceMetrics?.apiCallOptimization) {
          totalOptimizedCalls += result.performanceMetrics.apiCallOptimization.optimizedCalls;
          totalTraditionalCalls += result.performanceMetrics.apiCallOptimization.traditionalCalls;
        }
      }
      
      const apiCallsSaved = totalTraditionalCalls - totalOptimizedCalls;
      const optimizationPercentage = totalTraditionalCalls > 0 ? ((apiCallsSaved / totalTraditionalCalls) * 100).toFixed(1) + '%' : '0%';

      this.logger.info('Enhanced analysis workflow completed with API optimization', {
        workflowId,
        tokensAnalyzed: trendingResponse.tokens.length,
        highRatedTokens: highRatedTokens.length,
        performanceMetrics: {
          totalProcessingTime,
          averageTimePerToken: totalProcessingTime / trendingResponse.tokens.length,
          totalApiCalls,
          totalCacheHits,
          totalDbOperations,
          cacheHitRate: totalApiCalls > 0 ? (totalCacheHits / totalApiCalls * 100).toFixed(1) + '%' : '0%'
        },
        apiCallOptimization: {
          traditionalApproachCalls: totalTraditionalCalls,
          optimizedCalls: totalOptimizedCalls,
          callsSaved: apiCallsSaved,
          optimizationPercentage,
          timeframesCovered: ['5m', '15m', '1h', '4h']
        },
        consecutiveMomentumTracking: historicalDataManager ? 'enabled' : 'disabled',
        aiAnalysisEnabled: this.claudeAnalyst ? 'enabled' : 'disabled',
        circuitBreakerHealth: this.circuitBreakerManager.getHealthStatus()
      });
      
      // Log circuit breaker statistics
      const circuitBreakerStats = this.circuitBreakerManager.getAllStats();
      if (Object.keys(circuitBreakerStats).length > 0) {
        this.logger.info('Circuit breaker statistics', circuitBreakerStats);
      }
      
      // Log performance statistics
      const performanceStats = {
        systemHealth: this.performanceMonitor.getSystemHealth(),
        slowOperations: this.performanceMonitor.getSlowOperations(5),
        metricsCache: this.performanceMonitor.getCache().getStats(),
        recentMetrics: this.performanceMonitor.getAllMetricsSummary(300000) // 5 minutes
      };
      
      this.logger.info('Performance statistics', performanceStats);
      
      // Log cycle completion with cumulative rating distribution
      const duration = `${Math.round(totalProcessingTime / 1000)}s`;
      const totalCycles = this.stateManager.getMetric('total_analysis_cycles') || 0;
      this.stateManager.incrementMetric('total_analysis_cycles', 1);
      
      this.logger.info('Analysis cycle complete', {
        activity: 'CYCLE_COMPLETE',
        tokensAnalyzed: trendingResponse.tokens.length,
        highRatedTokens: highRatedTokens.length,
        notificationsSent: highRatedTokens.length,
        duration: duration,
        ratingDistribution: cumulativeRatingDistribution,
        cycleNumber: totalCycles + 1,
        totalTokensRated: totalTokensRated
      });
      
    } catch (error) {
      this.logger.error('Analysis workflow failed', {
        error: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          name: error instanceof Error ? error.name : 'Unknown',
          ...(error && typeof error === 'object' ? error : {})
        },
        workflowId
      });
      this.stateManager.setState('error');
      this.stateManager.incrementMetric('workflow_errors', 1);
      throw error;
    }
  }

  /**
   * Analyze a single token with enhanced multi-timeframe and consecutive momentum tracking
   */
  private async analyzeTokenEnhanced(
    tokenResponse: SolanaTrackerTokenResponse,
    apiClient: SolanaTrackerSystemComponent,
    technicalAnalysisComponent: TechnicalAnalysisSystemComponent,
    ratingEngineComponent: RatingEngineSystemComponent,
    historicalDataManager?: HistoricalDataManager,
    momentumAccelerationComponent?: MomentumAccelerationSystemComponent,
    entrySignalComponent?: EntrySignalSystemComponent
  ): Promise<TokenAnalysisResult | null> {
    try {
      // Map the token response data using ApiDataMapper
      const mappedData = this.dataMapper.mapCompleteTokenData(tokenResponse);
      
      // Get multi-timeframe chart data using the optimized API method
      this.logger.debug(`Fetching optimized multi-timeframe chart data for ${mappedData.tokenData.symbol}`, {
        tokenAddress: mappedData.tokenData.address,
      });
      
      const multiTimeframeData = await this.performanceMonitor.trackOperation(
        'fetch-optimized-multi-timeframe-data',
        () => this.apiCircuitBreaker!.execute(
          () => apiClient.getOptimizedMultiTimeframeData(
            mappedData.tokenData.address,
            ['5m', '15m', '1h', '4h'],
            {
              enableCaching: true,
              maxRetries: 2,
              fallbackToSeparateRequests: true
            }
          ),
          // Fallback: return minimal data structure
          async () => {
            this.logger.warn(`Multi-timeframe data fallback for ${mappedData.tokenData.symbol}`, { 
              tokenAddr: mappedData.tokenData.address 
            });
            return {
              timeframes: {
                '5m': [],
                '15m': [],
                '1h': [],
                '4h': []
              },
              fetchTime: 0,
              totalApiCalls: 0,
              dataPoints: 0,
              errors: [],
              warnings: [],
              cacheHits: 0,
              apiCallOptimization: {
                traditionalCalls: 4,
                optimizedCalls: 0,
                reduction: '0%'
              }
            };
          }
        ),
        {
          tokenAddress: mappedData.tokenData.address,
          targetTimeframes: ['5m', '15m', '1h', '4h']
        }
      );
      
      // Log multi-timeframe fetch results
      this.logger.info(`Optimized multi-timeframe chart data fetched for ${mappedData.tokenData.symbol}`, {
        tokenAddress: mappedData.tokenData.address,
        availableTimeframes: Object.keys(multiTimeframeData.timeframes),
        fetchTime: multiTimeframeData.fetchTime,
        totalApiCalls: multiTimeframeData.totalApiCalls,
        dataPoints: multiTimeframeData.dataPoints,
        errors: multiTimeframeData.errors.length,
        warnings: multiTimeframeData.warnings.length,
        apiCallOptimization: multiTimeframeData.apiCallOptimization
      });
      
      // Extract 1-hour data for primary analysis (most balanced for memecoin analysis)
      const primaryTimeframe = multiTimeframeData.timeframes['1h'];
      const chartDataPoints = primaryTimeframe && primaryTimeframe.length > 0 ? primaryTimeframe.map((point: any) => ({
        timestamp: point.timestamp,
        open: point.open,
        high: point.high,
        low: point.low,
        close: point.close,
        volume: point.volume
      })) : [];
      
      // If 1h data is not available, try fallbacks in order of preference
      if (chartDataPoints.length === 0) {
        const fallbackOrder = ['15m', '5m', '4h'];
        for (const timeframe of fallbackOrder) {
          const fallbackData = multiTimeframeData.timeframes[timeframe];
          if (fallbackData && fallbackData.length > 0) {
            chartDataPoints.push(...fallbackData.map((point: any) => ({
              timestamp: point.timestamp,
              open: point.open,
              high: point.high,
              low: point.low,
              close: point.close,
              volume: point.volume
            })));
            
            this.logger.info(`Using fallback timeframe data for ${mappedData.tokenData.symbol}`, {
              tokenAddress: mappedData.tokenData.address,
              fallbackTimeframe: timeframe,
              dataPoints: chartDataPoints.length,
            });
            break;
          }
        }
      }
      
      // Create analysis context using mapped data and all 4 timeframes
      const analysisContext: AnalysisContext = {
        tokenData: mappedData.tokenData,
        chartData: chartDataPoints,
        multiTimeframeData: {
          '5m': multiTimeframeData.timeframes['5m'] || [],
          '15m': multiTimeframeData.timeframes['15m'] || [],
          '1h': multiTimeframeData.timeframes['1h'] || [],
          '4h': multiTimeframeData.timeframes['4h'] || [],
        },
        historicalAnalysis: [], // No historical data for now
        marketContext: this.calculateDynamicMarketContext(mappedData, chartDataPoints),
      };
      
      this.logger.info(`Starting technical analysis for ${mappedData.tokenData.symbol}`, {
        tokenAddress: mappedData.tokenData.address,
        chartDataPoints: chartDataPoints.length
      });
      
      const analysis = await technicalAnalysisComponent.analyzeTechnicals(analysisContext);
      
      this.logger.info(`Technical analysis completed for ${mappedData.tokenData.symbol}`, {
        tokenAddress: mappedData.tokenData.address,
        hasIndicators: !!analysis.technicalIndicators,
        hasMomentum: !!analysis.momentum,
        rsiValue: analysis.technicalIndicators?.rsi,
        momentumStrength: analysis.momentum?.strength,
        indicatorsDetail: {
          rsi: analysis.technicalIndicators?.rsi,
          macd: analysis.technicalIndicators?.macd ? 'present' : 'missing',
          bollinger: analysis.technicalIndicators?.bollinger ? 'present' : 'missing',
          ema: analysis.technicalIndicators?.ema ? 'present' : 'missing',
          sma: analysis.technicalIndicators?.sma ? 'present' : 'missing'
        },
        momentumDetail: {
          trend: analysis.momentum?.trend,
          strength: analysis.momentum?.strength
        },
        volumeAnalysisDetail: {
          volumeSpike: mappedData.volumeAnalysis?.volumeSpike,
          averageVolume: mappedData.volumeAnalysis?.averageVolume,
          currentVolume: mappedData.volumeAnalysis?.currentVolume
        },
        riskAssessmentDetail: {
          riskLevel: mappedData.riskAssessment?.riskLevel,
          overall: mappedData.riskAssessment?.overall,
          warnings: mappedData.riskAssessment?.warnings?.length
        }
      });
      
      // Use the same analysis context for rating calculation (keep dynamic market context)
      const ratingContext: AnalysisContext = {
        ...analysisContext
      };
      
      this.logger.info(`Starting rating calculation for ${mappedData.tokenData.symbol}`, {
        tokenAddress: mappedData.tokenData.address,
        hasVolumeAnalysis: !!mappedData.volumeAnalysis,
        hasRiskAssessment: !!mappedData.riskAssessment,
        hasAnalysisIndicators: !!analysis.technicalIndicators,
        hasAnalysisMomentum: !!analysis.momentum
      });
      
      // Enhanced consecutive momentum tracking
      let consecutiveMomentumData: TokenAnalysisResult['consecutiveMomentumData'];
      
      if (historicalDataManager && analysis.technicalIndicators) {
        try {
          // Track consecutive momentum for primary timeframe (1h)
          const momentumTracker = await historicalDataManager.trackConsecutiveMomentum(
            mappedData.tokenData.address,
            '1h',
            analysis.technicalIndicators,
            new Date().toISOString(),
            mappedData.volumeAnalysis?.volumeSpike || false
          );
          
          // Store multi-timeframe indicators
          const multiTimeframeTechnicals: Record<string, TechnicalIndicators> = {
            '1h': analysis.technicalIndicators
            // Additional timeframes would be calculated here in full implementation
          };
          
          await historicalDataManager.storeMultiTimeframeIndicators(
            mappedData.tokenData.address,
            analysisContext.multiTimeframeData,
            multiTimeframeTechnicals,
            new Date().toISOString()
          );
          
          // Calculate consecutive momentum boost
          const consecutiveMomentumBoost = this.calculateConsecutiveMomentumBoost(momentumTracker);
          
          consecutiveMomentumData = {
            tracker: momentumTracker,
            boost: consecutiveMomentumBoost,
            exhaustionRisk: momentumTracker.exhaustionRisk
          };
          
          this.logger.debug('Consecutive momentum tracked', {
            tokenSymbol: mappedData.tokenData.symbol,
            currentStreak: momentumTracker.currentStreak,
            direction: momentumTracker.lastDirection,
            boost: consecutiveMomentumBoost,
            exhaustionRisk: momentumTracker.exhaustionRisk
          });
          
        } catch (error) {
          this.logger.error('Failed to track consecutive momentum', {
            error: error instanceof Error ? error.message : String(error),
            tokenSymbol: mappedData.tokenData.symbol
          });
          // Continue without consecutive momentum data
        }
      }
      
      // Calculate initial technical rating
      let initialRating;
      let aiAnalysis: AIAnalysisResult | undefined;
      let rating;
      
      try {
        initialRating = await ratingEngineComponent.calculateRating(
          analysis.technicalIndicators,
          analysis.momentum,
          mappedData.volumeAnalysis,
          mappedData.riskAssessment,
          ratingContext,
          // Enhanced rating context with consecutive momentum data
          {
            consecutiveMomentumData,
            multiTimeframeData: analysisContext.multiTimeframeData,
            historicalContext: historicalDataManager ? 
              await historicalDataManager.getHistoricalContext(
                mappedData.tokenData.address,
                ['1h', '4h'],
                5
              ) : undefined
          }
        );
        
        this.logger.debug(`Initial technical rating calculated for ${mappedData.tokenData.symbol}: ${initialRating.rating.toFixed(1)}/10`, {
          tokenAddress: mappedData.tokenData.address,
          initialRating: initialRating.rating.toFixed(1),
          confidence: initialRating.confidence.toFixed(1),
          recommendation: initialRating.recommendation,
          technical: true
        });

        // Perform AI analysis if enabled and rating meets threshold
        if (this.shouldPerformAIAnalysis(initialRating.rating)) {
          aiAnalysis = await this.performAIAnalysisWithCircuitBreaker(
            mappedData,
            analysisContext.multiTimeframeData,
            analysis,
            initialRating.rating
          );
        }

        // Calculate final rating incorporating AI analysis if available
        rating = aiAnalysis 
          ? await this.calculateAIEnhancedRating(
              initialRating,
              aiAnalysis,
              ratingEngineComponent,
              analysis.technicalIndicators,
              analysis.momentum,
              mappedData.volumeAnalysis,
              mappedData.riskAssessment,
              ratingContext
            )
          : initialRating;
        
        // Store analysis record in database if historical data manager is available
        if (historicalDataManager) {
          try {
            await historicalDataManager.storeAnalysisRecord(
              mappedData.tokenData.address,
              {
                timestamp: new Date().toISOString(),
                timeframe: '1h',
                price: mappedData.tokenData.price || 0,
                marketCap: mappedData.tokenData.marketCap || 0,
                volume24h: mappedData.tokenData.volume24h || 0,
                technicalIndicators: analysis.technicalIndicators,
                momentumData: analysis.momentum,
                volumeAnalysis: mappedData.volumeAnalysis,
                patternAnalysis: analysis.patterns || {},
                riskAssessment: mappedData.riskAssessment,
                rating: rating.rating,
                confidence: rating.confidence,
                scoreComponents: rating.components || {},
                recommendation: rating.recommendation,
                reasoning: rating.reasoning || [],
                alerts: rating.alerts || [],
                consecutiveMomentumBoost: consecutiveMomentumData?.boost || 0,
                timeframeAlignmentScore: 0, // Would be calculated from multi-timeframe analysis
                exhaustionPenalty: consecutiveMomentumData?.exhaustionRisk ? -0.5 : 0
              }
            );
          } catch (error) {
            this.logger.error('Failed to store analysis record', {
              error: error instanceof Error ? error.message : String(error),
              tokenSymbol: mappedData.tokenData.symbol
            });
          }
        }
        
        // Log the final rating with the number visible in the message
        const aiInfo = aiAnalysis ? ` (AI: ${aiAnalysis.finalRecommendation.rating.toFixed(1)})` : '';
        const notification = rating.rating >= this.config.minRatingThreshold ? ' 🔔' : '';
        
        this.logger.info(`📊 ${mappedData.tokenData.symbol}: ${rating.rating.toFixed(1)}/10${aiInfo}${notification} - ${rating.recommendation}`, {
          tokenAddress: mappedData.tokenData.address,
          initialRating: initialRating.rating.toFixed(1),
          finalRating: rating.rating.toFixed(1),
          confidence: rating.confidence.toFixed(1),
          recommendation: rating.recommendation,
          aiAnalysisUsed: !!aiAnalysis,
          aiRating: aiAnalysis?.finalRecommendation.rating,
          alertsCount: rating.alerts?.length || 0,
          consecutiveMomentumStreak: consecutiveMomentumData?.tracker.currentStreak || 0,
          consecutiveMomentumBoost: consecutiveMomentumData?.boost || 0,
          exhaustionRisk: consecutiveMomentumData?.exhaustionRisk || false
        });
      } catch (ratingError) {
        this.logger.error(`Rating calculation failed for ${mappedData.tokenData.symbol}`, {
          error: {
            message: ratingError instanceof Error ? ratingError.message : String(ratingError),
            stack: ratingError instanceof Error ? ratingError.stack : undefined,
            name: ratingError instanceof Error ? ratingError.name : 'Unknown'
          },
          tokenAddress: mappedData.tokenData.address,
          tokenSymbol: mappedData.tokenData.symbol,
          hasIndicators: !!analysis.technicalIndicators,
          hasMomentum: !!analysis.momentum,
          hasVolumeAnalysis: !!mappedData.volumeAnalysis,
          hasRiskAssessment: !!mappedData.riskAssessment
        });
        // Create a default rating instead of throwing
        rating = {
          rating: 0,
          confidence: 0,
          recommendation: 'SKIP',
          reasoning: ['Rating calculation failed'],
          alerts: ['⚠️ Rating calculation error'],
          components: {}
        };
      }
      
      // Momentum acceleration analysis
      let momentumAcceleration: MomentumAcceleration | undefined;
      if (momentumAccelerationComponent && momentumAccelerationComponent.isReady()) {
        try {
          // Convert chart data to OHLCV format for momentum analysis
          const ohlcvData = chartDataPoints.map(point => ({
            timestamp: point.timestamp,
            open: point.open,
            high: point.high,
            low: point.low,
            close: point.close,
            volume: point.volume
          }));

          if (ohlcvData.length >= 48) { // Minimum data points for momentum analysis
            momentumAcceleration = await momentumAccelerationComponent.analyzeMomentumAcceleration(
              mappedData.tokenData.address,
              ohlcvData
            );

            this.logger.debug('Momentum acceleration analysis completed', {
              tokenSymbol: mappedData.tokenData.symbol,
              sustainabilityScore: momentumAcceleration?.sustainabilityScore,
              fatigueLevel: momentumAcceleration?.fatigueLevel,
              entrySignalStrength: momentumAcceleration?.entrySignalStrength
            });
          } else {
            this.logger.debug('Insufficient data for momentum acceleration analysis', {
              tokenSymbol: mappedData.tokenData.symbol,
              dataPoints: ohlcvData.length,
              required: 48
            });
          }
        } catch (error) {
          this.logger.error('Momentum acceleration analysis failed', {
            error: error instanceof Error ? error.message : String(error),
            tokenSymbol: mappedData.tokenData.symbol
          });
        }
      }

      // Entry signal generation
      let entrySignal: EntrySignal | undefined;
      if (entrySignalComponent && entrySignalComponent.isReady() && chartDataPoints.length > 0) {
        try {
          // Convert chart data to OHLCV format for entry signal analysis
          const ohlcvData = chartDataPoints.map(point => ({
            timestamp: point.timestamp,
            open: point.open,
            high: point.high,
            low: point.low,
            close: point.close,
            volume: point.volume
          }));

          entrySignal = await entrySignalComponent.generateEntrySignal(
            mappedData.tokenData,
            ohlcvData,
            analysisContext.multiTimeframeData,
            chartDataPoints
          );

          this.logger.info('Entry signal generated', {
            tokenSymbol: mappedData.tokenData.symbol,
            signalType: entrySignal?.type,
            score: entrySignal?.score,
            confidence: entrySignal?.confidence
          });
        } catch (error) {
          this.logger.error('Entry signal generation failed', {
            error: error instanceof Error ? error.message : String(error),
            tokenSymbol: mappedData.tokenData.symbol
          });
        }
      }
      
      return {
        rawTokenResponse: tokenResponse,
        mappedData,
        analysis,
        rating,
        chartData: chartDataPoints,
        multiTimeframeData: analysisContext.multiTimeframeData,
        aiAnalysis,
        consecutiveMomentumData,
        momentumAcceleration,
        entrySignal,
        performanceMetrics: {
          analysisTime: 0, // Will be set by caller
          apiCalls: 1 + multiTimeframeData.timeframes ? Object.keys(multiTimeframeData.timeframes).length : 0, // Token details + timeframe requests
          cacheHits: 0,
          dbOperations: historicalDataManager ? 3 : 0 // Store momentum, indicators, analysis record
        }
      };
      
    } catch (error) {
      this.logger.error(`Failed to analyze token ${tokenResponse.token?.symbol || 'unknown'}`, {
        error: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          name: error instanceof Error ? error.name : 'Unknown',
          ...(error && typeof error === 'object' ? error : {})
        },
        tokenAddress: tokenResponse.token?.mint,
        tokenSymbol: tokenResponse.token?.symbol
      });
      throw error;
    }
  }

  /**
   * Check if AI analysis should be performed based on technical rating
   */
  private shouldPerformAIAnalysis(technicalRating: number): boolean {
    if (!this.claudeAnalyst || !this.config.aiAnalysis?.enabled) {
      return false;
    }

    const minRating = this.config.aiAnalysis.minTechnicalRating || 6;
    return technicalRating >= minRating;
  }

  /**
   * Perform AI analysis using Claude API with circuit breaker protection
   */
  private async performAIAnalysisWithCircuitBreaker(
    mappedData: any,
    multiTimeframeData: any,
    analysis: any,
    initialTechnicalRating: number
  ): Promise<AIAnalysisResult | undefined> {
    if (!this.claudeAnalyst || !this.aiAnalysisCircuitBreaker) {
      return undefined;
    }

    try {
      this.logger.info(`Starting AI analysis with circuit breaker for ${mappedData.tokenData.symbol}`, {
        tokenAddress: mappedData.tokenData.address,
        initialRating: initialTechnicalRating,
        circuitBreakerState: this.aiAnalysisCircuitBreaker.getState()
      });

      const aiResult = await this.aiAnalysisCircuitBreaker.execute(
        async () => {
          // Calculate multi-timeframe technical indicators for AI input
          const multiTimeframeTechnicals = this.calculateMultiTimeframeTechnicals(multiTimeframeData, analysis);

          // Prepare AI analysis input
          const aiInput: AIAnalysisInput = {
            tokenData: {
              symbol: mappedData.tokenData.symbol,
              address: mappedData.tokenData.address,
              price: mappedData.tokenData.price || 0,
              marketCap: mappedData.tokenData.marketCap || 0,
              volume24h: mappedData.tokenData.volume24h || 0,
              priceChange24h: mappedData.tokenData.priceChange24h || 0,
            },
            multiTimeframeData: {
              '5m': multiTimeframeData['5m'] || [],
              '15m': multiTimeframeData['15m'] || [],
              '1h': multiTimeframeData['1h'] || [],
              '4h': multiTimeframeData['4h'] || [],
            },
            technicalIndicators: multiTimeframeTechnicals,
            momentumAnalysis: analysis.momentum,
            volumeAnalysis: mappedData.volumeAnalysis,
            riskFactors: mappedData.riskAssessment?.warnings || [],
            initialTechnicalRating
          };

          return await this.claudeAnalyst!.analyzeToken(aiInput);
        },
        // Fallback: return undefined to skip AI enhancement
        async () => {
          this.logger.warn(`AI analysis circuit breaker is open, skipping AI enhancement for ${mappedData.tokenData.symbol}`);
          return undefined;
        }
      );
      
      if (aiResult) {
        this.logger.info(`AI analysis completed for ${mappedData.tokenData.symbol}`, {
          tokenAddress: mappedData.tokenData.address,
          aiRating: aiResult.finalRecommendation.rating,
          aiAction: aiResult.finalRecommendation.action,
          confidence: aiResult.confidence,
          warnings: aiResult.warnings.length
        });
      } else {
        this.logger.warn(`AI analysis returned null for ${mappedData.tokenData.symbol}`, {
          tokenAddress: mappedData.tokenData.address
        });
      }

      return aiResult || undefined;

    } catch (error) {
      this.logger.error(`AI analysis failed for ${mappedData.tokenData.symbol}`, {
        error: error instanceof Error ? error.message : String(error),
        tokenAddress: mappedData.tokenData.address
      });
      return undefined;
    }
  }

  /**
   * Calculate multi-timeframe technical indicators for AI analysis
   */
  private calculateMultiTimeframeTechnicals(multiTimeframeData: any, analysis: any): AIAnalysisInput['technicalIndicators'] {
    // For now, use the primary analysis indicators for all timeframes
    // In a full implementation, you would calculate indicators for each timeframe
    const primaryIndicators = analysis.technicalIndicators;
    
    return {
      '5m': primaryIndicators,  // Simplified - would calculate separately in full implementation
      '15m': primaryIndicators, // Simplified - would calculate separately in full implementation
      '1h': primaryIndicators,  // Simplified - would calculate separately in full implementation
      '4h': primaryIndicators   // Simplified - would calculate separately in full implementation
    };
  }

  /**
   * Calculate AI-enhanced rating by combining technical and AI analysis
   */
  private async calculateAIEnhancedRating(
    initialRating: any,
    aiAnalysis: AIAnalysisResult,
    _ratingEngineComponent: RatingEngineSystemComponent,
    _technicalIndicators: any,
    _momentum: any,
    _volumeAnalysis: any,
    _riskAssessment: any,
    _context: any
  ): Promise<any> {
    try {
      this.logger.debug('Calculating AI-enhanced rating', {
        initialRating: initialRating.rating,
        aiRating: aiAnalysis.finalRecommendation.rating,
        aiConfidence: aiAnalysis.confidence
      });

      // Use the rating engine's AI enhancement capability if available
      // For now, implement a simple weighted combination
      const aiWeight = 0.30; // 30% weight for AI analysis
      const technicalWeight = 0.70; // 70% weight for technical analysis

      const combinedRating = (initialRating.rating * technicalWeight) + (aiAnalysis.finalRecommendation.rating * aiWeight);
      
      // Combine confidence scores
      const combinedConfidence = (initialRating.confidence * technicalWeight) + (aiAnalysis.confidence * aiWeight);

      // Combine reasoning
      const combinedReasoning = [
        ...initialRating.reasoning,
        `AI Analysis (${aiAnalysis.confidence}% confidence): ${aiAnalysis.finalRecommendation.action}`,
        ...aiAnalysis.reasoning.slice(0, 3) // Add top 3 AI reasoning points
      ];

      // Combine alerts
      const combinedAlerts = [
        ...initialRating.alerts,
        ...aiAnalysis.warnings.map(warning => `🤖 AI: ${warning}`)
      ];

      // Determine final recommendation based on combined analysis
      const finalRecommendation = this.determineCombinedRecommendation(
        initialRating.recommendation,
        aiAnalysis.finalRecommendation.action,
        combinedRating,
        combinedConfidence
      );

      return {
        ...initialRating,
        rating: Math.max(1, Math.min(10, combinedRating)), // Clamp to 1-10 range
        confidence: Math.max(0, Math.min(100, combinedConfidence)), // Clamp to 0-100 range
        reasoning: combinedReasoning,
        alerts: combinedAlerts,
        recommendation: finalRecommendation,
        aiEnhanced: true,
        components: {
          ...initialRating.components,
          aiContribution: aiAnalysis.finalRecommendation.rating * aiWeight
        }
      };

    } catch (error) {
      this.logger.error('Failed to calculate AI-enhanced rating', {
        error: error instanceof Error ? error.message : String(error)
      });
      
      // Fallback to initial rating if AI enhancement fails
      return {
        ...initialRating,
        reasoning: [...initialRating.reasoning, 'AI enhancement failed - using technical analysis only'],
        alerts: [...initialRating.alerts, '⚠️ AI analysis integration failed']
      };
    }
  }

  /**
   * Determine combined recommendation from technical and AI analysis
   */
  private determineCombinedRecommendation(
    technicalRec: string,
    aiAction: AIAnalysisResult['finalRecommendation']['action'],
    combinedRating: number,
    combinedConfidence: number
  ): string {
    // If confidence is low, default to hold
    if (combinedConfidence < 50) {
      return 'hold';
    }

    // Map AI action to standard recommendation format
    const aiRecommendation = aiAction === 'STRONG_BUY' ? 'strong_buy' :
                           aiAction === 'BUY' ? 'buy' :
                           aiAction === 'AVOID' ? 'sell' : 'hold';

    // Use combined rating as primary factor, but consider both recommendations
    if (combinedRating >= 8) {
      return (technicalRec === 'strong_buy' || aiRecommendation === 'strong_buy') ? 'strong_buy' : 'buy';
    } else if (combinedRating >= 7) {
      return 'buy';
    } else if (combinedRating >= 5) {
      return 'hold';
    } else if (combinedRating >= 3) {
      return 'sell';
    } else {
      return 'strong_sell';
    }
  }

  /**
   * Process a single token with metrics tracking (used by parallel processor)
   */
  private async processTokenWithMetrics(
    token: any,
    apiClient: SolanaTrackerSystemComponent,
    technicalAnalysisComponent: TechnicalAnalysisSystemComponent,
    ratingEngineComponent: RatingEngineSystemComponent,
    historicalDataManager?: HistoricalDataManager,
    momentumAccelerationComponent?: MomentumAccelerationSystemComponent,
    entrySignalComponent?: EntrySignalSystemComponent
  ): Promise<TokenAnalysisResult | null> {
    const tokenStartTime = Date.now();
    let tokenApiCalls = 0;
    let tokenCacheHits = 0;
    const tokenDbOperations = 0;
    
    try {
      // Check cache first
      const cacheKey = `token-details-${token.address}`;
      let fullTokenResponse = this.analysisCache.get(cacheKey);
      
      if (fullTokenResponse) {
        tokenCacheHits++;
        this.logger.debug(`Cache hit for token details: ${token.symbol}`);
      } else {
        // Fetch full token details for analysis with circuit breaker protection
        fullTokenResponse = await this.performanceMonitor.trackOperation(
          'fetch-token-details',
          () => this.apiCircuitBreaker!.execute(
            () => apiClient.getClient().getTokenDetails(token.address),
            // Fallback: use basic token data from trending response
            async () => {
              this.logger.warn(`Using fallback token data for ${token.symbol}`);
              return {
                token: {
                  name: token.name || token.symbol,
                  symbol: token.symbol,
                  address: token.address,
                  decimals: 6,
                  image: '',
                  description: '',
                  buys: 0,
                  sells: 0,
                  holders: 0
                },
                pools: [],
                events: {},
                risk: { overall: 50, warnings: [] }
              };
            }
          ),
          { tokenSymbol: token.symbol, tokenAddress: token.address }
        );
        
        // Cache the result for 5 minutes
        this.analysisCache.set(cacheKey, fullTokenResponse);
        tokenApiCalls++;
      }
      
      // Convert TokenDetails to SolanaTrackerTokenResponse format
      const tokenResponse: SolanaTrackerTokenResponse = {
        token: {
          name: fullTokenResponse.token.name,
          symbol: fullTokenResponse.token.symbol,
          mint: fullTokenResponse.token.address,
          decimals: fullTokenResponse.token.decimals || 6,
          image: fullTokenResponse.token.image,
          description: fullTokenResponse.token.description || '',
        },
        pools: fullTokenResponse.pools,
        events: fullTokenResponse.events,
        risk: fullTokenResponse.risk,
        buys: fullTokenResponse.token.buys,
        sells: fullTokenResponse.token.sells,
        holders: fullTokenResponse.token.holders,
      };
      
      const result = await this.performanceMonitor.trackOperation(
        'analyze-token-enhanced',
        () => this.analyzeTokenEnhanced(
          tokenResponse, 
          apiClient, 
          technicalAnalysisComponent, 
          ratingEngineComponent,
          historicalDataManager,
          momentumAccelerationComponent,
          entrySignalComponent
        ),
        { 
          tokenSymbol: tokenResponse.token.symbol,
          tokenAddress: tokenResponse.token.mint,
          hasHistoricalManager: !!historicalDataManager
        }
      );
      
      // Add performance metrics including API call optimization
      if (result) {
        const baseApiCalls = result.performanceMetrics?.apiCalls || 0;
        const optimizedApiCalls = result.multiTimeframeData ? 1 : baseApiCalls; // Single 1m data fetch
        result.performanceMetrics = {
          analysisTime: Date.now() - tokenStartTime,
          apiCalls: tokenApiCalls + optimizedApiCalls,
          cacheHits: tokenCacheHits + (result.performanceMetrics?.cacheHits || 0),
          dbOperations: tokenDbOperations + (result.performanceMetrics?.dbOperations || 0),
          apiCallOptimization: {
            traditionalCalls: Object.keys(result.multiTimeframeData || {}).length || 4, // Would be 4 separate calls
            optimizedCalls: 1, // Only 1 call with aggregation
            reduction: ((Object.keys(result.multiTimeframeData || {}).length - 1) / Object.keys(result.multiTimeframeData || {}).length * 100).toFixed(1) + '%'
          }
        };
      }
      
      return result;
      
    } catch (error) {
      this.logger.error(`Failed to analyze token ${token.symbol || 'unknown'}`, {
        error: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          name: error instanceof Error ? error.name : 'Unknown',
          ...(error && typeof error === 'object' ? error : {})
        },
        tokenAddress: token.address,
        tokenSymbol: token.symbol,
        analysisTime: Date.now() - tokenStartTime
      });
      return null;
    }
  }

  /**
   * Calculate dynamic market context based on token data and chart patterns
   */
  private calculateDynamicMarketContext(mappedData: any, chartDataPoints: any[]): AnalysisContext['marketContext'] {
    try {
      let overallTrend: 'bull' | 'bear' | 'sideways' = 'sideways';
      let volatilityIndex = 50;
      let marketSentiment = 50;

      // Calculate trend based on price change
      const priceChange24h = mappedData.tokenData.priceChange24h || 0;
      
      if (priceChange24h > 10) {
        overallTrend = 'bull';
        marketSentiment = Math.min(90, 60 + Math.abs(priceChange24h) * 0.5);
      } else if (priceChange24h < -10) {
        overallTrend = 'bear';  
        marketSentiment = Math.max(10, 40 - Math.abs(priceChange24h) * 0.5);
      } else if (Math.abs(priceChange24h) > 5) {
        overallTrend = priceChange24h > 0 ? 'bull' : 'bear';
        marketSentiment = 50 + (priceChange24h * 2);
      }

      // Calculate volatility based on chart data if available
      if (chartDataPoints.length >= 10) {
        const prices = chartDataPoints.slice(-10).map((point: any) => point.close);
        const priceChanges = prices.slice(1).map((price: number, index: number) => 
          Math.abs((price - prices[index]) / prices[index]) * 100
        );
        
        if (priceChanges.length > 0) {
          const avgVolatility = priceChanges.reduce((sum: number, change: number) => sum + change, 0) / priceChanges.length;
          volatilityIndex = Math.min(100, Math.max(0, avgVolatility * 5)); // Scale to 0-100
        }
      } else {
        // Fallback: estimate volatility from 24h price change
        volatilityIndex = Math.min(100, Math.abs(priceChange24h));
      }

      // Adjust sentiment based on volume spike
      if (mappedData.volumeAnalysis?.volumeSpike) {
        const volumeMultiplier = mappedData.volumeAnalysis.volumeSpikeFactor || 1;
        if (volumeMultiplier > 3 && priceChange24h > 0) {
          marketSentiment = Math.min(95, marketSentiment + 15); // Volume spike with positive price = bullish
        } else if (volumeMultiplier > 3 && priceChange24h < -5) {
          marketSentiment = Math.max(5, marketSentiment - 10); // Volume spike with negative price = bearish
        }
      }

      // Clamp values to valid ranges
      marketSentiment = Math.max(0, Math.min(100, marketSentiment));
      volatilityIndex = Math.max(0, Math.min(100, volatilityIndex));

      this.logger.debug('Dynamic market context calculated', {
        tokenSymbol: mappedData.tokenData.symbol,
        priceChange24h,
        overallTrend,
        volatilityIndex: volatilityIndex.toFixed(1),
        marketSentiment: marketSentiment.toFixed(1),
        hasVolumeSpike: mappedData.volumeAnalysis?.volumeSpike,
        volumeSpikeFactor: mappedData.volumeAnalysis?.volumeSpikeFactor
      });

      return {
        overallTrend,
        volatilityIndex,
        marketSentiment
      };

    } catch (error) {
      this.logger.error('Failed to calculate dynamic market context, using defaults', {
        error: error instanceof Error ? error.message : String(error),
        tokenSymbol: mappedData.tokenData?.symbol || 'unknown'
      });
      
      // Return safe defaults on error
      return {
        overallTrend: 'sideways',
        volatilityIndex: 50,
        marketSentiment: 50
      };
    }
  }

  /**
   * Calculate consecutive momentum boost for rating enhancement
   */
  private calculateConsecutiveMomentumBoost(tracker: any): number {
    if (!tracker || tracker.currentStreak === 0) {
      return 0;
    }
    
    // Base boost increases with streak length, but with diminishing returns
    const baseBoost = Math.min(tracker.currentStreak * 0.1, 1.0);
    
    // Apply direction multiplier (bullish gets full boost, bearish gets reduced)
    const directionMultiplier = tracker.lastDirection === 'bullish' ? 1.0 : 0.7;
    
    // Apply exhaustion penalty
    const exhaustionPenalty = tracker.exhaustionRisk ? 0.5 : 1.0;
    
    // Calculate strength consistency bonus
    let consistencyBonus = 1.0;
    if (tracker.strengthHistory && tracker.strengthHistory.length >= 3) {
      const recent = tracker.strengthHistory.slice(-3);
      const isIncreasing = recent[0] < recent[1] && recent[1] < recent[2];
      consistencyBonus = isIncreasing ? 1.2 : 1.0;
    }
    
    const finalBoost = baseBoost * directionMultiplier * exhaustionPenalty * consistencyBonus;
    
    return Math.max(0, Math.min(2.0, finalBoost)); // Cap between 0 and 2.0
  }

  /**
   * Get circuit breaker statistics
   */
  getCircuitBreakerStats(): Record<string, any> {
    return this.circuitBreakerManager.getAllStats();
  }

  /**
   * Get Claude AI analysis statistics
   */
  getAIAnalysisStatistics(): { enabled: boolean; stats?: any } {
    if (!this.claudeAnalyst) {
      return { enabled: false };
    }

    return {
      enabled: true,
      stats: this.claudeAnalyst.getStatistics(),
      circuitBreakerStats: this.aiAnalysisCircuitBreaker?.getStats(),
      performanceMetrics: this.performanceMonitor.getAggregatedMetrics('claude-ai-analysis')
    };
  }

  /**
   * Get enhanced system health including circuit breakers and performance metrics
   */
  getSystemHealth(): {
    circuitBreakers: Record<string, any>;
    healthStatus: { healthy: string[]; degraded: string[]; unhealthy: string[] };
    performance: any;
    cache: any;
  } {
    return {
      circuitBreakers: this.circuitBreakerManager.getAllStats(),
      healthStatus: this.circuitBreakerManager.getHealthStatus(),
      performance: this.performanceMonitor.getSystemHealth(),
      cache: this.analysisCache.getStats()
    };
  }
  
  /**
   * Get performance monitor instance
   */
  getPerformanceMonitor(): PerformanceMonitor {
    return this.performanceMonitor;
  }
}