/**
 * Chart Data Aggregation Utilities
 * Provides functions to aggregate 1-minute OHLCV data into larger timeframes
 * with mathematically correct OHLCV calculations and edge case handling
 */

import { OHLCV } from '../types';
import { Logger } from 'winston';

export interface TimeframeConfig {
  timeframe: '5m' | '15m' | '1h' | '4h';
  minutes: number;
  maxDataPoints: number;
  hoursToFetch: number;
}

export interface AggregationResult {
  timeframe: string;
  data: OHLCV[];
  originalDataPoints: number;
  aggregatedDataPoints: number;
  dataLossPercentage: number;
  completionRate: number;
  warnings: string[];
}

export interface MultiTimeframeData {
  '5m': AggregationResult;
  '15m': AggregationResult;
  '1h': AggregationResult;
  '4h': AggregationResult;
  sourceDataPoints: number;
  aggregationTimestamp: string;
}

/**
 * Configuration for different timeframes
 */
export const TIMEFRAME_CONFIGS: Record<string, TimeframeConfig> = {
  '5m': {
    timeframe: '5m',
    minutes: 5,
    maxDataPoints: 288, // 24 hours of 5m candles (288 * 5m = 24 hours)
    hoursToFetch: 24,
  },
  '15m': {
    timeframe: '15m',
    minutes: 15,
    maxDataPoints: 96, // 24 hours of 15m candles (96 * 15m = 24 hours)
    hoursToFetch: 24,
  },
  '1h': {
    timeframe: '1h',
    minutes: 60,
    maxDataPoints: 48, // 48 hours of 1h candles for better trend analysis
    hoursToFetch: 48,
  },
  '4h': {
    timeframe: '4h',
    minutes: 240,
    maxDataPoints: 42, // 7 days of 4h candles (42 * 4h = 168 hours = 7 days)
    hoursToFetch: 168, // 7 days in hours
  },
};

export class ChartDataAggregator {
  constructor(private logger: Logger) {}

  /**
   * Aggregate 1-minute OHLCV data into a specific timeframe
   */
  public aggregateTimeframe(
    oneMinuteData: OHLCV[],
    targetTimeframe: '5m' | '15m' | '1h' | '4h',
    minDataPoints: number = 10
  ): AggregationResult {
    const config = TIMEFRAME_CONFIGS[targetTimeframe];
    if (!config) {
      throw new Error(`Unsupported timeframe: ${targetTimeframe}`);
    }

    const warnings: string[] = [];
    
    // Sort data by timestamp to ensure correct aggregation
    const sortedData = [...oneMinuteData].sort((a, b) => a.timestamp - b.timestamp);
    
    if (sortedData.length === 0) {
      return {
        timeframe: targetTimeframe,
        data: [],
        originalDataPoints: 0,
        aggregatedDataPoints: 0,
        dataLossPercentage: 0,
        completionRate: 0,
        warnings: ['No source data provided'],
      };
    }

    // Check if we have insufficient source data
    const expectedSourceDataPoints = config.hoursToFetch * 60; // 1 minute intervals
    if (sortedData.length < expectedSourceDataPoints * 0.5) { // Less than 50% expected
      warnings.push(`Insufficient source data: ${sortedData.length} points, expected ~${expectedSourceDataPoints}`);
    }

    // Group data into timeframe buckets
    const buckets = this.groupDataIntoBuckets(sortedData, config.minutes, warnings);
    
    // Aggregate each bucket into OHLCV
    const aggregatedData = buckets.map(bucket => this.aggregateBucket(bucket, warnings));
    
    // Calculate metrics
    const dataLossPercentage = this.calculateDataLoss(sortedData.length, aggregatedData.length, config.minutes);
    const completionRate = this.calculateCompletionRate(buckets);

    // Limit to maximum data points (keep most recent)
    const finalData = aggregatedData.slice(-config.maxDataPoints);
    
    if (finalData.length < aggregatedData.length) {
      warnings.push(`Truncated to ${config.maxDataPoints} most recent data points`);
    }

    // Check if we meet minimum data point requirements
    if (finalData.length < minDataPoints) {
      warnings.push(`Insufficient aggregated data: ${finalData.length} points, minimum required: ${minDataPoints}`);
    }

    this.logger.debug('Timeframe aggregation completed', {
      targetTimeframe,
      originalDataPoints: sortedData.length,
      bucketsCreated: buckets.length,
      aggregatedDataPoints: finalData.length,
      dataLossPercentage,
      completionRate: `${(completionRate * 100).toFixed(1)}%`,
      warnings: warnings.length,
    });

    return {
      timeframe: targetTimeframe,
      data: finalData,
      originalDataPoints: sortedData.length,
      aggregatedDataPoints: finalData.length,
      dataLossPercentage,
      completionRate,
      warnings,
    };
  }

  /**
   * Aggregate 1-minute data into all supported timeframes
   */
  public aggregateAllTimeframes(
    oneMinuteData: OHLCV[], 
    minDataPoints: number = 10
  ): MultiTimeframeData {
    const startTime = Date.now();
    
    const results: Partial<MultiTimeframeData> = {
      sourceDataPoints: oneMinuteData.length,
      aggregationTimestamp: new Date().toISOString(),
    };

    // Aggregate all required timeframes for comprehensive analysis
    (['5m', '15m', '1h', '4h'] as const).forEach(timeframe => {
      try {
        results[timeframe] = this.aggregateTimeframe(oneMinuteData, timeframe, minDataPoints);
      } catch (error) {
        this.logger.error(`Failed to aggregate ${timeframe} timeframe`, {
          error: error instanceof Error ? error.message : error,
          sourceDataPoints: oneMinuteData.length,
        });
        
        // Return empty result for failed timeframe
        results[timeframe] = {
          timeframe,
          data: [],
          originalDataPoints: oneMinuteData.length,
          aggregatedDataPoints: 0,
          dataLossPercentage: 100,
          completionRate: 0,
          warnings: [`Aggregation failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        };
      }
    });

    const duration = Date.now() - startTime;
    this.logger.info('Multi-timeframe aggregation completed', {
      sourceDataPoints: oneMinuteData.length,
      timeframes: Object.keys(results).filter(k => k !== 'sourceDataPoints' && k !== 'aggregationTimestamp'),
      duration: `${duration}ms`,
      totalAggregatedPoints: Object.values(results)
        .filter((r): r is AggregationResult => typeof r === 'object' && 'aggregatedDataPoints' in r)
        .reduce((sum, r) => sum + r.aggregatedDataPoints, 0),
    });

    return results as MultiTimeframeData;
  }

  /**
   * Group 1-minute data into timeframe buckets
   */
  private groupDataIntoBuckets(
    sortedData: OHLCV[],
    intervalMinutes: number,
    warnings: string[]
  ): OHLCV[][] {
    const buckets: OHLCV[][] = [];
    const intervalSeconds = intervalMinutes * 60; // Convert to seconds for Unix timestamps
    
    if (sortedData.length === 0) return buckets;

    // Find the first aligned timestamp (round down to interval boundary)
    const firstTimestamp = sortedData[0].timestamp;
    const alignedStart = Math.floor(firstTimestamp / intervalSeconds) * intervalSeconds;
    
    let currentBucketStart = alignedStart;
    let currentBucket: OHLCV[] = [];
    
    for (const dataPoint of sortedData) {
      const bucketEnd = currentBucketStart + intervalSeconds;
      
      // Check if this data point belongs to the current bucket
      if (dataPoint.timestamp >= currentBucketStart && dataPoint.timestamp < bucketEnd) {
        currentBucket.push(dataPoint);
      } else {
        // Finalize current bucket if it has data
        if (currentBucket.length > 0) {
          buckets.push([...currentBucket]);
        }
        
        // Find the correct bucket for this data point
        const correctBucketStart = Math.floor(dataPoint.timestamp / intervalSeconds) * intervalSeconds;
        
        // Check for gaps in data
        if (correctBucketStart > bucketEnd) {
          const missedBuckets = Math.floor((correctBucketStart - bucketEnd) / intervalSeconds);
          if (missedBuckets > 0) {
            warnings.push(`Data gap detected: ${missedBuckets} ${intervalMinutes}m intervals missing`);
          }
        }
        
        // Start new bucket
        currentBucketStart = correctBucketStart;
        currentBucket = [dataPoint];
      }
    }
    
    // Add the final bucket if it has data
    if (currentBucket.length > 0) {
      buckets.push(currentBucket);
    }

    return buckets;
  }

  /**
   * Aggregate a bucket of 1-minute candles into a single OHLCV candle
   * Using mathematically correct OHLCV aggregation rules
   */
  private aggregateBucket(bucket: OHLCV[], warnings: string[]): OHLCV {
    if (bucket.length === 0) {
      throw new Error('Cannot aggregate empty bucket');
    }

    // Sort by timestamp to ensure correct order
    const sortedBucket = bucket.sort((a, b) => a.timestamp - b.timestamp);
    
    // OHLCV Aggregation Rules:
    // - Open: First candle's open price
    // - High: Maximum of all high prices
    // - Low: Minimum of all low prices  
    // - Close: Last candle's close price
    // - Volume: Sum of all volumes
    // - Timestamp: Start of the timeframe period

    const first = sortedBucket[0];
    const last = sortedBucket[sortedBucket.length - 1];
    
    const aggregated: OHLCV = {
      timestamp: first.timestamp, // Use first timestamp as bucket timestamp
      open: first.open,
      high: Math.max(...sortedBucket.map(c => c.high)),
      low: Math.min(...sortedBucket.map(c => c.low)),
      close: last.close,
      volume: sortedBucket.reduce((sum, c) => sum + c.volume, 0),
    };

    // Add volumeUsd if available in source data
    const volumeUsdSum = sortedBucket.reduce((sum, c) => sum + (c.volumeUsd || 0), 0);
    if (volumeUsdSum > 0) {
      aggregated.volumeUsd = volumeUsdSum;
    }

    // Add trades count if available
    const tradesSum = sortedBucket.reduce((sum, c) => sum + (c.trades || 0), 0);
    if (tradesSum > 0) {
      aggregated.trades = tradesSum;
    }

    // Validate aggregated data
    if (aggregated.high < aggregated.low) {
      warnings.push(`Invalid OHLCV: high (${aggregated.high}) < low (${aggregated.low})`);
      // Fix by swapping
      [aggregated.high, aggregated.low] = [aggregated.low, aggregated.high];
    }

    if (aggregated.high < aggregated.open || aggregated.high < aggregated.close) {
      warnings.push(`Suspicious OHLCV: high price lower than open/close`);
    }

    if (aggregated.low > aggregated.open || aggregated.low > aggregated.close) {
      warnings.push(`Suspicious OHLCV: low price higher than open/close`);
    }

    return aggregated;
  }

  /**
   * Calculate data loss percentage from aggregation
   */
  private calculateDataLoss(originalPoints: number, aggregatedPoints: number, intervalMinutes: number): number {
    if (originalPoints === 0) return 0;
    
    // Expected aggregated points based on original data span
    const expectedAggregatedPoints = Math.ceil(originalPoints / intervalMinutes);
    const actualLoss = Math.max(0, expectedAggregatedPoints - aggregatedPoints);
    
    return (actualLoss / expectedAggregatedPoints) * 100;
  }

  /**
   * Calculate completion rate (percentage of buckets with data)
   */
  private calculateCompletionRate(buckets: OHLCV[][]): number {
    if (buckets.length === 0) return 0;
    
    const nonEmptyBuckets = buckets.filter(bucket => bucket.length > 0).length;
    return nonEmptyBuckets / buckets.length;
  }

  /**
   * Validate OHLCV data for consistency
   */
  public validateOHLCVData(data: OHLCV[]): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (data.length === 0) {
      return { isValid: true, errors, warnings };
    }

    // Check each candle
    data.forEach((candle, index) => {
      // Basic OHLCV validation
      if (candle.high < candle.low) {
        errors.push(`Candle ${index}: high (${candle.high}) < low (${candle.low})`);
      }
      
      if (candle.high < candle.open) {
        warnings.push(`Candle ${index}: high (${candle.high}) < open (${candle.open})`);
      }
      
      if (candle.high < candle.close) {
        warnings.push(`Candle ${index}: high (${candle.high}) < close (${candle.close})`);
      }
      
      if (candle.low > candle.open) {
        warnings.push(`Candle ${index}: low (${candle.low}) > open (${candle.open})`);
      }
      
      if (candle.low > candle.close) {
        warnings.push(`Candle ${index}: low (${candle.low}) > close (${candle.close})`);
      }

      // Volume validation
      if (candle.volume < 0) {
        errors.push(`Candle ${index}: negative volume (${candle.volume})`);
      }

      // Timestamp validation
      if (candle.timestamp <= 0) {
        errors.push(`Candle ${index}: invalid timestamp (${candle.timestamp})`);
      }
    });

    // Check chronological order
    for (let i = 1; i < data.length; i++) {
      if (data[i].timestamp <= data[i - 1].timestamp) {
        warnings.push(`Candles ${i - 1} and ${i}: timestamps not in ascending order`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get time range requirements for fetching different timeframes
   */
  public static getTimeRangeForTimeframe(timeframe: '5m' | '15m' | '1h' | '4h'): {
    hoursNeeded: number;
    fromTimestamp: number;
    toTimestamp: number;
  } {
    const config = TIMEFRAME_CONFIGS[timeframe];
    if (!config) {
      throw new Error(`Unsupported timeframe: ${timeframe}`);
    }

    const now = Date.now();
    const hoursNeeded = config.hoursToFetch;
    const fromTimestamp = now - (hoursNeeded * 60 * 60 * 1000);

    return {
      hoursNeeded,
      fromTimestamp: Math.floor(fromTimestamp / 1000), // Convert to Unix timestamp
      toTimestamp: Math.floor(now / 1000),
    };
  }

  /**
   * Get optimal time range for fetching 1m data to cover all target timeframes
   * This method calculates the maximum time range needed to aggregate all required timeframes
   */
  public static getOptimalOneMinuteDataRange(targetTimeframes: ('5m' | '15m' | '1h' | '4h')[]): {
    hoursNeeded: number;
    fromTimestamp: number;
    toTimestamp: number;
    sourceDataPoints: number;
    coverage: Record<string, { hoursNeeded: number; maxDataPoints: number }>;
  } {
    if (targetTimeframes.length === 0) {
      throw new Error('At least one target timeframe must be specified');
    }

    // Find the maximum hours needed across all timeframes
    let maxHoursNeeded = 0;
    const coverage: Record<string, { hoursNeeded: number; maxDataPoints: number }> = {};

    for (const timeframe of targetTimeframes) {
      const config = TIMEFRAME_CONFIGS[timeframe];
      if (!config) {
        throw new Error(`Unsupported timeframe: ${timeframe}`);
      }
      
      maxHoursNeeded = Math.max(maxHoursNeeded, config.hoursToFetch);
      coverage[timeframe] = {
        hoursNeeded: config.hoursToFetch,
        maxDataPoints: config.maxDataPoints,
      };
    }

    // Add buffer for early movement detection (especially for 5m/15m)
    const bufferHours = Math.min(12, maxHoursNeeded * 0.25); // 25% buffer, max 12 hours
    const totalHoursNeeded = maxHoursNeeded + bufferHours;

    const now = Date.now();
    const fromTimestamp = now - (totalHoursNeeded * 60 * 60 * 1000);
    
    // Calculate expected source data points (1-minute intervals)
    const sourceDataPoints = Math.ceil(totalHoursNeeded * 60);

    return {
      hoursNeeded: totalHoursNeeded,
      fromTimestamp: Math.floor(fromTimestamp / 1000), // Convert to Unix timestamp
      toTimestamp: Math.floor(now / 1000),
      sourceDataPoints,
      coverage,
    };
  }
}