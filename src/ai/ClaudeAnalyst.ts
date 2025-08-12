/**
 * Claude API Technical Analyst for Memecoin Analysis
 * 
 * Provides AI-powered technical analysis using Claude API to enhance
 * rating calculations for tokens that pass initial technical screening (≥6 rating).
 * 
 * Integrates with the existing analysis workflow to provide:
 * - AI momentum quality assessment (1-10)
 * - Entry risk evaluation (1-10) 
 * - Multi-timeframe pattern analysis (1-10) - focuses on 1h and 4h trends
 * - Volume characteristic analysis (1-10)
 * - Final AI recommendation with reasoning
 */

import Anthropic from '@anthropic-ai/sdk';
import { Logger } from '../utils/Logger';
import { 
  AIAnalysisInput, 
  AIAnalysisResult, 
  VolumeAnalysis 
} from '../types/analysis';
import { ChartDataPoint } from '../types/api';

export interface ClaudeAnalystConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
  maxRetries: number;
  retryDelayMs: number;
  enabled: boolean;
}

export class ClaudeAnalyst {
  private client?: Anthropic;
  private logger: Logger;
  private config: ClaudeAnalystConfig;
  private requestCount = 0;
  private errorCount = 0;
  private lastRequestTime = 0;

  constructor(config: ClaudeAnalystConfig, logger?: Logger) {
    this.config = config;
    this.logger = logger || Logger.getInstance();
    
    if (!config.enabled) {
      this.logger.info('Claude AI Analysis disabled in configuration');
      return;
    }

    try {
      this.client = new Anthropic({
        apiKey: config.apiKey,
        timeout: config.timeout,
      });
      
      this.logger.info('Claude Analyst initialized', {
        model: config.model,
        maxTokens: config.maxTokens,
        temperature: config.temperature,
        timeout: config.timeout
      });
    } catch (error) {
      this.logger.error('Failed to initialize Claude API client', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Analyze token using Claude AI for enhanced technical analysis
   */
  async analyzeToken(input: AIAnalysisInput): Promise<AIAnalysisResult | null> {
    if (!this.config.enabled || !this.client) {
      this.logger.debug('Claude analysis skipped - disabled or client not initialized');
      return null;
    }

    const startTime = Date.now();
    this.requestCount++;
    
    try {
      this.logger.info('Starting Claude AI analysis', {
        tokenSymbol: input.tokenData.symbol,
        tokenAddress: input.tokenData.address,
        initialRating: input.initialTechnicalRating,
        requestCount: this.requestCount
      });

      // Rate limiting: ensure minimum 1 second between requests
      const timeSinceLastRequest = Date.now() - this.lastRequestTime;
      if (timeSinceLastRequest < 1000) {
        await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastRequest));
      }

      // Prepare analysis prompt with comprehensive data
      const prompt = this.buildAnalysisPrompt(input);
      
      // Log the full prompt being sent to Claude
      this.logger.info('Sending prompt to Claude API', {
        action: 'CLAUDE_PROMPT_SENT',
        timestamp: new Date().toISOString(),
        tokenSymbol: input.tokenData.symbol,
        tokenAddress: input.tokenData.address,
        promptLength: prompt.length,
        fullPrompt: prompt
      });
      
      // Call Claude API with retries
      const response = await this.callClaudeWithRetries(prompt);
      
      // Parse and validate response
      const analysisResult = this.parseAnalysisResponse(response, input);
      
      this.lastRequestTime = Date.now();
      const duration = this.lastRequestTime - startTime;

      this.logger.info('Claude AI analysis completed', {
        tokenSymbol: input.tokenData.symbol,
        duration: `${duration}ms`,
        aiRating: analysisResult?.finalRecommendation.rating,
        aiAction: analysisResult?.finalRecommendation.action,
        confidence: analysisResult?.confidence
      });

      return analysisResult;

    } catch (error) {
      this.errorCount++;
      this.logger.error('Claude AI analysis failed', {
        error: error instanceof Error ? error.message : String(error),
        tokenSymbol: input.tokenData.symbol,
        tokenAddress: input.tokenData.address,
        requestCount: this.requestCount,
        errorCount: this.errorCount,
        duration: `${Date.now() - startTime}ms`
      });

      // Return null to allow system to continue without AI analysis
      return null;
    }
  }

  /**
   * Build comprehensive analysis prompt for Claude
   */
  private buildAnalysisPrompt(input: AIAnalysisInput): string {
    const { tokenData, multiTimeframeData, technicalIndicators, momentumAnalysis, volumeAnalysis, riskFactors } = input;

    // Format multi-timeframe data for AI analysis
    const timeframeDataSummary = this.formatTimeframeData(multiTimeframeData, technicalIndicators);
    
    // Format recent price action
    const priceActionSummary = this.formatPriceAction(multiTimeframeData['1h']);
    
    // Format volume characteristics
    const volumeSummary = this.formatVolumeAnalysis(volumeAnalysis, multiTimeframeData);

    return `You are an elite cryptocurrency technical analyst specializing in memecoin momentum analysis. Your expertise lies in identifying sustainable medium to long-term momentum plays while avoiding short-term noise and false signals. You analyze using 1-hour and 4-hour timeframes to focus on more reliable trends and sustainable price movements.

## TOKEN ANALYSIS REQUEST

**Token**: ${tokenData.symbol} (${tokenData.address})
**Current Price**: $${tokenData.price}
**Market Cap**: $${tokenData.marketCap.toLocaleString()}
**24h Volume**: $${tokenData.volume24h.toLocaleString()}
**24h Change**: ${tokenData.priceChange24h.toFixed(2)}%
**Initial Technical Rating**: ${input.initialTechnicalRating}/10 (passed screening threshold)

## MULTI-TIMEFRAME TECHNICAL DATA

${timeframeDataSummary}

## PRICE ACTION ANALYSIS (1-hour data)

${priceActionSummary}

## VOLUME CHARACTERISTICS

${volumeSummary}

## MOMENTUM ANALYSIS

**Trend**: ${momentumAnalysis.trend}
**Strength**: ${momentumAnalysis.strength}/100
**Momentum**: ${momentumAnalysis.momentum.toFixed(2)}
**Volatility**: ${momentumAnalysis.volatility.toFixed(2)}
**Support Levels**: [${momentumAnalysis.support.map(s => `$${s.toFixed(6)}`).join(', ')}]
**Resistance Levels**: [${momentumAnalysis.resistance.map(r => `$${r.toFixed(6)}`).join(', ')}]
**Breakout Potential**: ${momentumAnalysis.priceAction.breakoutPotential}/100
**Consolidation**: ${momentumAnalysis.priceAction.consolidation ? 'Yes' : 'No'}
**Reversal Signal**: ${momentumAnalysis.priceAction.reversalSignal ? 'Yes' : 'No'}

## RISK FACTORS

${riskFactors.length > 0 ? riskFactors.map(factor => `- ${factor}`).join('\n') : 'No significant risk factors identified'}

## ANALYSIS REQUIREMENTS

Based on this comprehensive technical data, provide your expert analysis in the following EXACT format:

**MOMENTUM QUALITY**: X/10
Brief explanation of momentum strength and sustainability

**ENTRY RISK**: X/10  
Assessment of risk level for entering position now (higher number = higher risk)

**TIMEFRAME ANALYSIS**: X/10
Alignment between 1h and 4h timeframes - focus on trend sustainability and momentum confirmation

**VOLUME ANALYSIS**: X/10
Volume profile, buying/selling pressure, and volume confirmation of moves

**FINAL RECOMMENDATION**: [STRONG_BUY/BUY/NEUTRAL/AVOID] (X/10)

**REASONING**:
- Point 1: Key technical factor supporting or opposing the position
- Point 2: Volume and momentum characteristics assessment  
- Point 3: Risk/reward evaluation and timing considerations
- Point 4: Any warning signs or confirmation signals

**CONFIDENCE**: X% (0-100% confidence in your analysis)

**WARNINGS** (if any):
- List any significant risk factors or caution areas

Focus on sustainable technical momentum using 1h and 4h timeframes. Prioritize trend reliability over short-term volatility. Be precise with scores and reasoning.`;
  }

  /**
   * Format multi-timeframe data for AI analysis
   */
  private formatTimeframeData(
    multiTimeframeData: AIAnalysisInput['multiTimeframeData'],
    technicalIndicators: AIAnalysisInput['technicalIndicators']
  ): string {
    const timeframes = ['1h', '4h'] as const;
    
    return timeframes.map(tf => {
      const data = multiTimeframeData[tf];
      const indicators = technicalIndicators[tf];
      
      if (!data || data.length === 0 || !indicators) {
        return `**${tf.toUpperCase()}**: Insufficient data`;
      }

      const latest = data[data.length - 1];
      const dataPoints = data.length;
      
      const timeframeDescription = tf === '1h' ? 'Medium-term momentum and trend development' : 'Major trend confirmation and sustainability';
      
      return `**${tf.toUpperCase()}** (${dataPoints} data points) - ${timeframeDescription}:
- Price: $${latest.close.toFixed(6)} (O: $${latest.open.toFixed(6)}, H: $${latest.high.toFixed(6)}, L: $${latest.low.toFixed(6)})
- RSI: ${indicators.rsi.toFixed(1)}
- MACD: ${indicators.macd.macd.toFixed(4)} / Signal: ${indicators.macd.signal.toFixed(4)} / Histogram: ${indicators.macd.histogram.toFixed(4)}
- Bollinger Position: ${(indicators.bollinger.position * 100).toFixed(1)}% (Upper: $${indicators.bollinger.upper.toFixed(6)}, Lower: $${indicators.bollinger.lower.toFixed(6)})
- Volume: ${latest.volume.toLocaleString()}`;
    }).join('\n\n');
  }

  /**
   * Format recent price action for analysis
   */
  private formatPriceAction(data: ChartDataPoint[]): string {
    if (!data || data.length < 5) {
      return 'Insufficient price action data available';
    }

    const recent = data.slice(-6); // Last 6 candles for 1h timeframe
    const priceChanges = recent.map((candle, i) => {
      if (i === 0) return 0;
      return ((candle.close - recent[i-1].close) / recent[i-1].close) * 100;
    }).slice(1);

    const avgChange = priceChanges.reduce((sum, change) => sum + change, 0) / priceChanges.length;
    const volatility = Math.sqrt(priceChanges.reduce((sum, change) => sum + Math.pow(change - avgChange, 2), 0) / priceChanges.length);

    return `Recent 6 hours analysis:
- Average price change: ${avgChange.toFixed(2)}% per hour
- Price volatility: ${volatility.toFixed(2)}%
- Latest candle: ${recent[recent.length - 1].close > recent[recent.length - 1].open ? 'Bullish' : 'Bearish'} (${(((recent[recent.length - 1].close - recent[recent.length - 1].open) / recent[recent.length - 1].open) * 100).toFixed(2)}%)
- Trend direction: ${avgChange > 0.5 ? 'Upward' : avgChange < -0.5 ? 'Downward' : 'Sideways'}`;
  }

  /**
   * Format volume analysis for AI review
   */
  private formatVolumeAnalysis(volumeAnalysis: VolumeAnalysis, multiTimeframeData: AIAnalysisInput['multiTimeframeData']): string {
    const volumeSpikeFactor = volumeAnalysis.volumeSpikeFactor;
    const liquidityScore = volumeAnalysis.liquidityScore;
    
    // Calculate volume trend from 1h data
    const oneHourData = multiTimeframeData['1h'];
    let volumeTrend = 'Unknown';
    if (oneHourData && oneHourData.length >= 3) {
      const recentVolumes = oneHourData.slice(-3).map(d => d.volume);
      const firstVol = recentVolumes[0];
      const lastVol = recentVolumes[recentVolumes.length - 1];
      const volumeChange = ((lastVol - firstVol) / firstVol) * 100;
      volumeTrend = volumeChange > 20 ? 'Increasing' : volumeChange < -20 ? 'Decreasing' : 'Stable';
    }

    return `**Volume Profile**:
- Current Volume: ${volumeAnalysis.currentVolume.toLocaleString()}
- Average Volume: ${volumeAnalysis.averageVolume.toLocaleString()}
- Volume Spike: ${volumeAnalysis.volumeSpike ? 'YES' : 'NO'} (${volumeSpikeFactor.toFixed(1)}x average)
- Volume Trend: ${volumeTrend}
- Liquidity Score: ${liquidityScore}/100
- Buy Pressure: ${volumeAnalysis.volumeProfile.buyPressure.toFixed(1)}%
- Sell Pressure: ${volumeAnalysis.volumeProfile.sellPressure.toFixed(1)}%
- Net Flow: ${volumeAnalysis.volumeProfile.netFlow > 0 ? '+' : ''}${volumeAnalysis.volumeProfile.netFlow.toFixed(1)}%`;
  }

  /**
   * Call Claude API with retry logic
   */
  private async callClaudeWithRetries(prompt: string): Promise<string> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        this.logger.debug(`Claude API call attempt ${attempt}/${this.config.maxRetries}`);
        
        const response = await this.client!.messages.create({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          messages: [{
            role: 'user',
            content: prompt
          }]
        });

        if (response.content[0].type === 'text') {
          const responseText = response.content[0].text;
          
          // Log full Claude response
          this.logger.info('Claude API full response received', {
            action: 'CLAUDE_FULL_RESPONSE',
            timestamp: new Date().toISOString(),
            model: this.config.model,
            attempt,
            responseLength: responseText.length,
            fullResponse: responseText,
            usage: response.usage,
            requestId: response.id
          });
          
          return responseText;
        } else {
          throw new Error('Unexpected response format from Claude API');
        }

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(`Claude API call attempt ${attempt} failed`, {
          error: lastError.message,
          attempt,
          maxRetries: this.config.maxRetries
        });

        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt - 1); // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }

  /**
   * Parse and validate Claude's analysis response
   */
  private parseAnalysisResponse(response: string, input: AIAnalysisInput): AIAnalysisResult {
    try {
      this.logger.debug('Parsing Claude analysis response', {
        responseLength: response.length,
        tokenSymbol: input.tokenData.symbol
      });

      // Extract scores using regex patterns
      const momentumQuality = this.extractScore(response, /MOMENTUM QUALITY[:\s]*(\d+(?:\.\d+)?)/i);
      const entryRisk = this.extractScore(response, /ENTRY RISK[:\s]*(\d+(?:\.\d+)?)/i);
      const timeframeAnalysis = this.extractScore(response, /TIMEFRAME ANALYSIS[:\s]*(\d+(?:\.\d+)?)/i);
      const volumeAnalysis = this.extractScore(response, /VOLUME ANALYSIS[:\s]*(\d+(?:\.\d+)?)/i);
      
      // Extract final recommendation
      const finalRecMatch = response.match(/FINAL RECOMMENDATION[:\s]*\[?([A-Z_]+)\]?\s*\((\d+(?:\.\d+)?)/i);
      const finalRating = finalRecMatch ? parseFloat(finalRecMatch[2]) : 5;
      const finalAction = this.mapActionString(finalRecMatch?.[1] || 'NEUTRAL');

      // Extract confidence
      const confidence = this.extractScore(response, /CONFIDENCE[:\s]*(\d+(?:\.\d+)?)/i) || 50;

      // Extract reasoning points
      const reasoning = this.extractReasoning(response);
      
      // Extract warnings
      const warnings = this.extractWarnings(response);

      // Validate scores are in expected ranges
      const validatedResult: AIAnalysisResult = {
        momentumQuality: this.clampScore(momentumQuality, 1, 10),
        entryRisk: this.clampScore(entryRisk, 1, 10),
        timeframeAnalysis: this.clampScore(timeframeAnalysis, 1, 10),
        volumeAnalysis: this.clampScore(volumeAnalysis, 1, 10),
        finalRecommendation: {
          rating: this.clampScore(finalRating, 1, 10),
          action: finalAction
        },
        reasoning,
        confidence: this.clampScore(confidence, 0, 100),
        warnings,
        timestamp: Date.now(),
        tokenAddress: input.tokenData.address
      };

      this.logger.debug('Successfully parsed Claude analysis', {
        tokenSymbol: input.tokenData.symbol,
        scores: {
          momentum: validatedResult.momentumQuality,
          risk: validatedResult.entryRisk,
          timeframe: validatedResult.timeframeAnalysis,
          volume: validatedResult.volumeAnalysis,
          final: validatedResult.finalRecommendation.rating
        },
        confidence: validatedResult.confidence,
        reasoningPoints: validatedResult.reasoning.length,
        warnings: validatedResult.warnings.length
      });

      return validatedResult;

    } catch (error) {
      this.logger.error('Failed to parse Claude analysis response', {
        error: error instanceof Error ? error.message : String(error),
        tokenSymbol: input.tokenData.symbol,
        responsePreview: response.substring(0, 200) + '...'
      });
      
      // Return default analysis result to prevent system failure
      return this.getDefaultAnalysisResult(input);
    }
  }

  /**
   * Extract numeric score from response text
   */
  private extractScore(text: string, pattern: RegExp): number | null {
    const match = text.match(pattern);
    return match ? parseFloat(match[1]) : null;
  }

  /**
   * Extract reasoning points from response
   */
  private extractReasoning(response: string): string[] {
    const reasoningMatch = response.match(/REASONING[:\s]*\n?((?:[-•]\s*.+(?:\n|$))+)/is);
    if (!reasoningMatch) return ['AI analysis completed with limited reasoning data'];

    return reasoningMatch[1]
      .split('\n')
      .map(line => line.replace(/^[-•]\s*/, '').trim())
      .filter(line => line.length > 0)
      .slice(0, 6); // Limit to 6 reasoning points
  }

  /**
   * Extract warnings from response
   */
  private extractWarnings(response: string): string[] {
    const warningsMatch = response.match(/WARNINGS[:\s]*(?:\(if any\))?\s*\n?((?:[-•]\s*.+(?:\n|$))*)/is);
    if (!warningsMatch || !warningsMatch[1].trim()) return [];

    return warningsMatch[1]
      .split('\n')
      .map(line => line.replace(/^[-•]\s*/, '').trim())
      .filter(line => line.length > 0)
      .slice(0, 4); // Limit to 4 warnings
  }

  /**
   * Map action string to valid enum value
   */
  private mapActionString(action: string): AIAnalysisResult['finalRecommendation']['action'] {
    const upperAction = action.toUpperCase();
    if (upperAction.includes('STRONG_BUY') || upperAction.includes('STRONGBUY')) return 'STRONG_BUY';
    if (upperAction.includes('BUY')) return 'BUY';
    if (upperAction.includes('AVOID')) return 'AVOID';
    return 'NEUTRAL';
  }

  /**
   * Clamp score to valid range
   */
  private clampScore(score: number | null, min: number, max: number): number {
    if (score === null || isNaN(score)) return (min + max) / 2; // Default to middle
    return Math.max(min, Math.min(max, score));
  }

  /**
   * Get default analysis result for error cases
   */
  private getDefaultAnalysisResult(input: AIAnalysisInput): AIAnalysisResult {
    return {
      momentumQuality: 5,
      entryRisk: 5,
      timeframeAnalysis: 5,
      volumeAnalysis: 5,
      finalRecommendation: {
        rating: Math.max(1, Math.min(10, input.initialTechnicalRating)), // Use initial rating as fallback
        action: 'NEUTRAL'
      },
      reasoning: ['AI analysis unavailable - using technical analysis only'],
      confidence: 30, // Low confidence when AI analysis fails
      warnings: ['AI analysis system unavailable'],
      timestamp: Date.now(),
      tokenAddress: input.tokenData.address
    };
  }

  /**
   * Get analysis statistics for monitoring
   */
  getStatistics(): { 
    requestCount: number; 
    errorCount: number; 
    successRate: number; 
    enabled: boolean;
  } {
    return {
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      successRate: this.requestCount > 0 ? ((this.requestCount - this.errorCount) / this.requestCount) * 100 : 0,
      enabled: this.config.enabled
    };
  }

  /**
   * Test Claude API connection
   */
  async testConnection(): Promise<{ success: boolean; error?: string; latency?: number }> {
    if (!this.config.enabled || !this.client) {
      return { success: false, error: 'Claude API disabled or not initialized' };
    }

    const startTime = Date.now();
    
    try {
      const response = await this.client.messages.create({
        model: this.config.model,
        max_tokens: 10,
        temperature: 0,
        messages: [{
          role: 'user',
          content: 'Test connection - respond with "OK"'
        }]
      });

      const latency = Date.now() - startTime;
      
      if (response.content[0].type === 'text') {
        return { success: true, latency };
      } else {
        return { success: false, error: 'Unexpected response format' };
      }

    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : String(error),
        latency: Date.now() - startTime
      };
    }
  }
}