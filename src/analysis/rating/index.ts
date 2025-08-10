/**
 * Rating Engine Module - Export Index
 * 
 * Comprehensive multi-factor rating system for memecoin analysis
 * providing sophisticated scoring algorithms with transparent explanations.
 */

// Main Rating Engine
export { RatingEngine, type RatingEngineConfig } from './RatingEngine';

// Rating Engine System Component
export { 
  RatingEngineSystemComponent,
  createRatingEngineSystemComponent,
  createMemecoinRatingEngineSystemComponent,
  type RatingEngineComponentConfig 
} from './RatingEngineSystemComponent';

// Score Calculators
export { TechnicalScoreCalculator } from './calculators/TechnicalScoreCalculator';
export { MomentumScoreCalculator } from './calculators/MomentumScoreCalculator';
export { VolumeScoreCalculator } from './calculators/VolumeScoreCalculator';
export { RiskScoreCalculator } from './calculators/RiskScoreCalculator';

// Utility Classes
export { 
  ScoreNormalizer,
  type NormalizationConfig,
  type NormalizationResult 
} from './utils/ScoreNormalizer';

export { 
  ConfidenceCalculator,
  type ConfidenceFactors,
  type ConfidenceResult 
} from './utils/ConfidenceCalculator';

// Configuration and Thresholds
export { 
  RatingThresholds,
  type RatingThreshold,
  type NotificationThreshold,
  type RiskAdjustment 
} from './config/RatingThresholds';

// Re-export related types from the main types module
export type {
  RatingResult,
  ScoreComponents,
  AnalysisResult,
  AnalysisContext,
  TechnicalIndicators,
  MomentumAnalysis,
  VolumeAnalysis,
  RiskAssessment
} from '../../types/analysis';