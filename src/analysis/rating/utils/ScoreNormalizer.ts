/**
 * Score Normalizer Utility
 * 
 * Provides advanced normalization techniques for rating system scores:
 * - Z-score normalization
 * - Min-max scaling
 * - Percentile-based normalization
 * - Outlier detection and handling
 * - Non-linear transformations
 */

import { Logger } from '../../../utils/Logger';

export interface NormalizationConfig {
  method: 'z-score' | 'min-max' | 'percentile' | 'sigmoid' | 'tanh';
  outlierHandling: 'clip' | 'remove' | 'winsorize' | 'none';
  outlierThreshold: number; // Standard deviations or percentile
  targetRange: [number, number]; // Target output range
  robustScaling: boolean; // Use median/MAD instead of mean/std
}

export interface NormalizationResult {
  normalizedValue: number;
  originalValue: number;
  isOutlier: boolean;
  confidence: number; // Confidence in normalization (0-1)
  method: string;
}

export class ScoreNormalizer {
  private logger = Logger.getInstance();
  private historicalData: Map<string, number[]> = new Map();

  constructor() {
    this.logger.debug('ScoreNormalizer initialized');
  }

  /**
   * Normalize a single score using specified method
   */
  public normalize(
    value: number,
    context: string,
    config: Partial<NormalizationConfig> = {}
  ): NormalizationResult {
    const fullConfig: NormalizationConfig = {
      method: 'z-score',
      outlierHandling: 'winsorize',
      outlierThreshold: 2.5,
      targetRange: [0, 100],
      robustScaling: false,
      ...config
    };

    try {
      const historicalValues = this.getHistoricalData(context);
      const isOutlier = this.detectOutlier(value, historicalValues, fullConfig);
      const adjustedValue = this.handleOutlier(value, historicalValues, fullConfig, isOutlier);
      const normalizedValue = this.applyNormalization(adjustedValue, historicalValues, fullConfig);
      const confidence = this.calculateNormalizationConfidence(value, historicalValues, isOutlier);

      // Store value for future normalization
      this.storeValue(context, value);

      return {
        normalizedValue,
        originalValue: value,
        isOutlier,
        confidence,
        method: fullConfig.method
      };

    } catch (error) {
      this.logger.error('Score normalization failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        value,
        context
      });

      // Return a safe default normalization
      return {
        normalizedValue: Math.max(0, Math.min(100, value)),
        originalValue: value,
        isOutlier: false,
        confidence: 0.5,
        method: 'fallback'
      };
    }
  }

  /**
   * Normalize multiple scores with batch optimization
   */
  public normalizeBatch(
    values: Array<{ value: number; context: string }>,
    config: Partial<NormalizationConfig> = {}
  ): NormalizationResult[] {
    return values.map(({ value, context }) => this.normalize(value, context, config));
  }

  /**
   * Apply normalization method to a value
   */
  private applyNormalization(
    value: number,
    historicalValues: number[],
    config: NormalizationConfig
  ): number {
    const [minTarget, maxTarget] = config.targetRange;

    switch (config.method) {
      case 'z-score':
        return this.zScoreNormalization(value, historicalValues, config, minTarget, maxTarget);
      
      case 'min-max':
        return this.minMaxNormalization(value, historicalValues, minTarget, maxTarget);
      
      case 'percentile':
        return this.percentileNormalization(value, historicalValues, minTarget, maxTarget);
      
      case 'sigmoid':
        return this.sigmoidNormalization(value, historicalValues, minTarget, maxTarget);
      
      case 'tanh':
        return this.tanhNormalization(value, historicalValues, minTarget, maxTarget);
      
      default:
        return this.minMaxNormalization(value, historicalValues, minTarget, maxTarget);
    }
  }

  /**
   * Z-score normalization with optional robust scaling
   */
  private zScoreNormalization(
    value: number,
    historicalValues: number[],
    config: NormalizationConfig,
    minTarget: number,
    maxTarget: number
  ): number {
    if (historicalValues.length < 2) {
      return Math.max(minTarget, Math.min(maxTarget, value));
    }

    let center: number, scale: number;

    if (config.robustScaling) {
      // Use median and MAD (Median Absolute Deviation) for robust scaling
      center = this.calculateMedian(historicalValues);
      const deviations = historicalValues.map(v => Math.abs(v - center));
      scale = this.calculateMedian(deviations) * 1.4826; // Scale factor for normal distribution
    } else {
      // Standard mean and standard deviation
      center = this.calculateMean(historicalValues);
      scale = this.calculateStandardDeviation(historicalValues, center);
    }

    if (scale === 0) {
      return (minTarget + maxTarget) / 2; // Return middle value if no variance
    }

    const zScore = (value - center) / scale;
    
    // Convert z-score to target range (assume ±3 sigma covers most data)
    const normalizedZScore = (zScore + 3) / 6; // Map [-3, 3] to [0, 1]
    const clampedScore = Math.max(0, Math.min(1, normalizedZScore));
    
    return minTarget + clampedScore * (maxTarget - minTarget);
  }

  /**
   * Min-max normalization
   */
  private minMaxNormalization(
    value: number,
    historicalValues: number[],
    minTarget: number,
    maxTarget: number
  ): number {
    if (historicalValues.length === 0) {
      return Math.max(minTarget, Math.min(maxTarget, value));
    }

    const minValue = Math.min(...historicalValues);
    const maxValue = Math.max(...historicalValues);

    if (minValue === maxValue) {
      return (minTarget + maxTarget) / 2;
    }

    const normalizedValue = (value - minValue) / (maxValue - minValue);
    const clampedValue = Math.max(0, Math.min(1, normalizedValue));
    
    return minTarget + clampedValue * (maxTarget - minTarget);
  }

  /**
   * Percentile-based normalization
   */
  private percentileNormalization(
    value: number,
    historicalValues: number[],
    minTarget: number,
    maxTarget: number
  ): number {
    if (historicalValues.length === 0) {
      return Math.max(minTarget, Math.min(maxTarget, value));
    }

    const sortedValues = [...historicalValues].sort((a, b) => a - b);
    const percentile = this.calculatePercentile(value, sortedValues);
    
    return minTarget + (percentile / 100) * (maxTarget - minTarget);
  }

  /**
   * Sigmoid normalization for S-curve distribution
   */
  private sigmoidNormalization(
    value: number,
    historicalValues: number[],
    minTarget: number,
    maxTarget: number
  ): number {
    const center = historicalValues.length > 0 ? this.calculateMean(historicalValues) : 50;
    const scale = historicalValues.length > 0 ? this.calculateStandardDeviation(historicalValues, center) : 20;
    
    if (scale === 0) {
      return (minTarget + maxTarget) / 2;
    }

    const normalizedValue = (value - center) / scale;
    const sigmoidValue = 1 / (1 + Math.exp(-normalizedValue));
    
    return minTarget + sigmoidValue * (maxTarget - minTarget);
  }

  /**
   * Tanh normalization for symmetric S-curve
   */
  private tanhNormalization(
    value: number,
    historicalValues: number[],
    minTarget: number,
    maxTarget: number
  ): number {
    const center = historicalValues.length > 0 ? this.calculateMean(historicalValues) : 50;
    const scale = historicalValues.length > 0 ? this.calculateStandardDeviation(historicalValues, center) : 20;
    
    if (scale === 0) {
      return (minTarget + maxTarget) / 2;
    }

    const normalizedValue = (value - center) / scale;
    const tanhValue = (Math.tanh(normalizedValue) + 1) / 2; // Map [-1, 1] to [0, 1]
    
    return minTarget + tanhValue * (maxTarget - minTarget);
  }

  /**
   * Detect if a value is an outlier
   */
  private detectOutlier(
    value: number,
    historicalValues: number[],
    config: NormalizationConfig
  ): boolean {
    if (historicalValues.length < 3) {
      return false; // Need sufficient data to detect outliers
    }

    if (config.robustScaling) {
      // Use IQR method for outlier detection
      const q1 = this.calculatePercentile(25, historicalValues);
      const q3 = this.calculatePercentile(75, historicalValues);
      const iqr = q3 - q1;
      const lowerBound = q1 - config.outlierThreshold * iqr;
      const upperBound = q3 + config.outlierThreshold * iqr;
      
      return value < lowerBound || value > upperBound;
    } else {
      // Use z-score method for outlier detection
      const mean = this.calculateMean(historicalValues);
      const std = this.calculateStandardDeviation(historicalValues, mean);
      
      if (std === 0) return false;
      
      const zScore = Math.abs((value - mean) / std);
      return zScore > config.outlierThreshold;
    }
  }

  /**
   * Handle outlier values based on configuration
   */
  private handleOutlier(
    value: number,
    historicalValues: number[],
    config: NormalizationConfig,
    isOutlier: boolean
  ): number {
    if (!isOutlier || config.outlierHandling === 'none') {
      return value;
    }

    switch (config.outlierHandling) {
      case 'clip':
        return this.clipOutlier(value, historicalValues, config);
      
      case 'winsorize':
        return this.winsorizeOutlier(value, historicalValues, config);
      
      case 'remove':
        // For single value normalization, we'll winsorize instead of removing
        return this.winsorizeOutlier(value, historicalValues, config);
      
      default:
        return value;
    }
  }

  /**
   * Clip outlier to acceptable range
   */
  private clipOutlier(
    value: number,
    historicalValues: number[],
    config: NormalizationConfig
  ): number {
    const mean = this.calculateMean(historicalValues);
    const std = this.calculateStandardDeviation(historicalValues, mean);
    
    const lowerBound = mean - config.outlierThreshold * std;
    const upperBound = mean + config.outlierThreshold * std;
    
    return Math.max(lowerBound, Math.min(upperBound, value));
  }

  /**
   * Winsorize outlier (replace with percentile values)
   */
  private winsorizeOutlier(
    value: number,
    historicalValues: number[],
    config: NormalizationConfig
  ): number {
    const lowerPercentile = (100 - config.outlierThreshold * 10) / 2; // e.g., 2.5% for threshold 2.5
    const upperPercentile = 100 - lowerPercentile; // e.g., 97.5%
    
    const lowerBound = this.calculatePercentile(lowerPercentile, historicalValues);
    const upperBound = this.calculatePercentile(upperPercentile, historicalValues);
    
    if (value < lowerBound) return lowerBound;
    if (value > upperBound) return upperBound;
    return value;
  }

  /**
   * Calculate confidence in normalization result
   */
  private calculateNormalizationConfidence(
    value: number,
    historicalValues: number[],
    isOutlier: boolean
  ): number {
    let confidence = 1.0;

    // Reduce confidence for insufficient data
    if (historicalValues.length < 10) {
      confidence *= 0.7;
    } else if (historicalValues.length < 30) {
      confidence *= 0.85;
    }

    // Reduce confidence for outliers
    if (isOutlier) {
      confidence *= 0.6;
    }

    // Reduce confidence for extreme values
    if (historicalValues.length > 0) {
      const mean = this.calculateMean(historicalValues);
      const std = this.calculateStandardDeviation(historicalValues, mean);
      
      if (std > 0) {
        const zScore = Math.abs((value - mean) / std);
        if (zScore > 3) {
          confidence *= 0.4;
        } else if (zScore > 2) {
          confidence *= 0.7;
        }
      }
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Utility functions for statistical calculations
   */
  private calculateMean(values: number[]): number {
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculateMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  private calculateStandardDeviation(values: number[], mean?: number): number {
    const m = mean ?? this.calculateMean(values);
    const squaredDiffs = values.map(val => Math.pow(val - m, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(variance);
  }

  private calculatePercentile(percentile: number, values?: number[]): number {
    if (values) {
      const sorted = [...values].sort((a, b) => a - b);
      const index = (percentile / 100) * (sorted.length - 1);
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      
      if (lower === upper) {
        return sorted[lower];
      }
      
      return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
    } else {
      // When values is not provided, percentile is the target percentile for a single value
      // This is used in percentileNormalization
      const targetValue = arguments[0] as number;
      const historicalValues = arguments[1] as number[];
      
      const sorted = [...historicalValues].sort((a, b) => a - b);
      let rank = 0;
      
      for (let i = 0; i < sorted.length; i++) {
        if (sorted[i] <= targetValue) {
          rank = i + 1;
        } else {
          break;
        }
      }
      
      return (rank / sorted.length) * 100;
    }
  }

  /**
   * Data management functions
   */
  private getHistoricalData(context: string): number[] {
    return this.historicalData.get(context) || [];
  }

  private storeValue(context: string, value: number): void {
    if (!this.historicalData.has(context)) {
      this.historicalData.set(context, []);
    }

    const values = this.historicalData.get(context)!;
    values.push(value);

    // Keep only last 1000 values per context to prevent memory issues
    if (values.length > 1000) {
      values.splice(0, values.length - 1000);
    }
  }

  /**
   * Clear historical data for a context or all contexts
   */
  public clearHistoricalData(context?: string): void {
    if (context) {
      this.historicalData.delete(context);
    } else {
      this.historicalData.clear();
    }
  }

  /**
   * Get normalization statistics for monitoring
   */
  public getStatistics(): {
    contexts: number;
    totalValues: number;
    averageValuesPerContext: number;
    contextList: string[];
  } {
    const contexts = Array.from(this.historicalData.keys());
    const totalValues = contexts.reduce(
      (total, context) => total + this.historicalData.get(context)!.length,
      0
    );

    return {
      contexts: contexts.length,
      totalValues,
      averageValuesPerContext: contexts.length > 0 ? totalValues / contexts.length : 0,
      contextList: contexts
    };
  }
}