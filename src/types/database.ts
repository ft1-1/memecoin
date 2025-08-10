/**
 * Type definitions for database operations and models
 */

export interface DatabaseConnection {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  get<T = any>(sql: string, params?: any[]): Promise<T | undefined>;
  run(sql: string, params?: any[]): Promise<{ lastID?: number; changes: number }>;
  close(): Promise<void>;
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface TokenRecord {
  id?: number;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  supply: number;
  created_at: string;
  first_seen: string;
  last_updated: string;
  is_active: boolean;
}

export interface TokenPriceRecord {
  id?: number;
  token_address: string;
  timestamp: string;
  price: number;
  market_cap: number;
  volume_24h: number;
  price_change_24h: number;
  holders: number;
  liquidity?: number;
}

export interface AnalysisRecord {
  id?: number;
  token_address: string;
  timestamp: string;
  timeframe: string;
  price: number;
  market_cap: number;
  volume_24h: number;
  
  // Technical indicators (JSON stored as string)
  technical_indicators: string;
  momentum_data: string;
  volume_analysis: string;
  pattern_analysis: string;
  risk_assessment: string;
  
  // Rating
  rating: number;
  confidence: number;
  score_components: string;
  recommendation: string;
  reasoning: string;
  alerts: string;
  
  created_at: string;
}

export interface NotificationRecord {
  id?: number;
  token_address: string;
  token_symbol: string;
  rating: number;
  price: number;
  market_cap: number;
  notification_type: 'discord' | 'email' | 'webhook';
  status: 'pending' | 'sent' | 'failed';
  sent_at?: string;
  error_message?: string;
  retry_count: number;
  created_at: string;
}

export interface MetricsRecord {
  id?: number;
  timestamp: string;
  metric_name: string;
  metric_value: number;
  metric_unit?: string;
  tags?: string; // JSON string of key-value pairs
  created_at: string;
}

export interface SystemHealthRecord {
  id?: number;
  timestamp: string;
  component: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  response_time_ms?: number;
  error_message?: string;
  metadata?: string; // JSON string
  created_at: string;
}

export interface JobExecutionRecord {
  id?: number;
  job_id: string;
  job_type: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  tokens_processed?: number;
  notifications_sent?: number;
  error_message?: string;
  metadata?: string; // JSON string
}

export interface Repository<T> {
  create(data: Omit<T, 'id' | 'created_at'>): Promise<T>;
  findById(id: number): Promise<T | undefined>;
  findMany(criteria: Partial<T>, options?: QueryOptions): Promise<T[]>;
  update(id: number, data: Partial<T>): Promise<T | undefined>;
  delete(id: number): Promise<boolean>;
  count(criteria?: Partial<T>): Promise<number>;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
  select?: string[];
}

export interface DatabaseMigration {
  version: number;
  name: string;
  up: string;
  down: string;
  applied_at?: string;
}

export interface DatabaseStats {
  totalTables: number;
  totalRecords: Record<string, number>;
  databaseSize: number;
  lastBackup?: string;
  connectionCount: number;
  averageQueryTime: number;
}

export interface BackupInfo {
  filename: string;
  size: number;
  created_at: string;
  checksum: string;
  compression: boolean;
}