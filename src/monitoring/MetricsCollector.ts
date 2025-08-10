import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { MonitoringConfig } from '@/types/config';
import { SystemComponent, ComponentHealth } from '@/orchestrator/SystemOrchestrator';

export interface Metric {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp: number;
  unit?: string;
}

export interface MetricsSnapshot {
  timestamp: number;
  metrics: Metric[];
  system: {
    uptime: number;
    memory: number;
    cpu: number;
  };
}

/**
 * Metrics collector for performance monitoring and observability
 */
export class MetricsCollector extends EventEmitter implements SystemComponent {
  public readonly name = 'metrics-collector';
  
  private readonly logger: Logger;
  private readonly config: MonitoringConfig;
  private readonly metrics = new Map<string, Metric>();
  private collectInterval: NodeJS.Timeout | null = null;
  private startTime: Date | null = null;

  constructor(config: MonitoringConfig, logger: Logger) {
    super();
    this.config = config;
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing metrics collector');
    this.startTime = new Date();
    
    // Initialize default metrics
    this.initializeDefaultMetrics();
  }

  async start(): Promise<void> {
    this.logger.info('Starting metrics collection');
    
    // Start periodic collection
    this.collectInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, 30000); // Collect every 30 seconds

    // Initial collection
    this.collectSystemMetrics();
  }

  async stop(): Promise<void> {
    if (this.collectInterval) {
      clearInterval(this.collectInterval);
      this.collectInterval = null;
    }
    
    this.logger.info('Metrics collection stopped');
  }

  async getHealth(): Promise<ComponentHealth> {
    return {
      status: 'healthy',
      message: 'Metrics collector is operational',
      metadata: {
        metricsCount: this.metrics.size,
        uptime: this.getUptime(),
      },
    };
  }

  async destroy(): Promise<void> {
    await this.stop();
    this.metrics.clear();
  }

  /**
   * Record a counter metric
   */
  incrementCounter(name: string, labels?: Record<string, string>, value = 1): void {
    const key = this.getMetricKey(name, labels);
    const existing = this.metrics.get(key);
    
    const metric: Metric = {
      name,
      value: existing ? existing.value + value : value,
      labels,
      timestamp: Date.now(),
      unit: 'count',
    };

    this.metrics.set(key, metric);
    this.emit('metricRecorded', metric);
  }

  /**
   * Record a gauge metric (absolute value)
   */
  setGauge(name: string, value: number, labels?: Record<string, string>, unit?: string): void {
    const key = this.getMetricKey(name, labels);
    
    const metric: Metric = {
      name,
      value,
      labels,
      timestamp: Date.now(),
      unit,
    };

    this.metrics.set(key, metric);
    this.emit('metricRecorded', metric);
  }

  /**
   * Record a histogram/timing metric
   */
  recordTiming(name: string, duration: number, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    
    const metric: Metric = {
      name,
      value: duration,
      labels,
      timestamp: Date.now(),
      unit: 'milliseconds',
    };

    this.metrics.set(key, metric);
    this.emit('metricRecorded', metric);

    // Also record count
    this.incrementCounter(`${name}_count`, labels);
  }

  /**
   * Get all current metrics
   */
  getMetrics(): Metric[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get a specific metric
   */
  getMetric(name: string, labels?: Record<string, string>): Metric | undefined {
    const key = this.getMetricKey(name, labels);
    return this.metrics.get(key);
  }

  /**
   * Get metrics snapshot
   */
  getSnapshot(): MetricsSnapshot {
    return {
      timestamp: Date.now(),
      metrics: this.getMetrics(),
      system: {
        uptime: this.getUptime(),
        memory: this.getMemoryUsage(),
        cpu: this.getCpuUsage(),
      },
    };
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics.clear();
    this.logger.debug('All metrics cleared');
    this.emit('metricsCleared');
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheusFormat(): string {
    const lines: string[] = [];
    const metricGroups = new Map<string, Metric[]>();

    // Group metrics by name
    for (const metric of this.metrics.values()) {
      if (!metricGroups.has(metric.name)) {
        metricGroups.set(metric.name, []);
      }
      metricGroups.get(metric.name)!.push(metric);
    }

    // Format each metric group
    for (const [name, metrics] of metricGroups) {
      // Add help comment
      lines.push(`# HELP ${name} Metric: ${name}`);
      
      // Determine type
      const unit = metrics[0]?.unit;
      const type = unit === 'count' ? 'counter' : 'gauge';
      lines.push(`# TYPE ${name} ${type}`);

      // Add metric values
      for (const metric of metrics) {
        const labelsStr = metric.labels ? 
          '{' + Object.entries(metric.labels).map(([k, v]) => `${k}="${v}"`).join(',') + '}' : '';
        lines.push(`${name}${labelsStr} ${metric.value} ${metric.timestamp}`);
      }

      lines.push(''); // Empty line between metrics
    }

    return lines.join('\n');
  }

  private initializeDefaultMetrics(): void {
    // System metrics
    this.setGauge('system_uptime_seconds', 0, undefined, 'seconds');
    this.setGauge('system_memory_usage_bytes', 0, undefined, 'bytes');
    this.setGauge('system_cpu_usage_percent', 0, undefined, 'percent');

    // Application metrics
    this.incrementCounter('app_starts_total');
    this.setGauge('app_components_registered', 0, undefined, 'count');
    
    // Analysis metrics
    this.incrementCounter('analysis_cycles_total');
    this.incrementCounter('analysis_cycles_successful');
    this.incrementCounter('analysis_cycles_failed');
    this.setGauge('analysis_tokens_processed', 0, undefined, 'count');
    this.setGauge('analysis_tokens_analyzed', 0, undefined, 'count');
    this.setGauge('analysis_notifications_sent', 0, undefined, 'count');

    // API metrics
    this.incrementCounter('api_requests_total');
    this.incrementCounter('api_requests_successful');
    this.incrementCounter('api_requests_failed');
    this.setGauge('api_response_time_ms', 0, undefined, 'milliseconds');

    // Error metrics
    this.incrementCounter('errors_total');
    this.incrementCounter('circuit_breaker_opened');
    this.incrementCounter('recovery_attempts');
  }

  private collectSystemMetrics(): void {
    try {
      // Update system metrics
      this.setGauge('system_uptime_seconds', this.getUptime() / 1000, undefined, 'seconds');
      this.setGauge('system_memory_usage_bytes', this.getMemoryUsage(), undefined, 'bytes');
      this.setGauge('system_cpu_usage_percent', this.getCpuUsage(), undefined, 'percent');

      // Update timestamp for all metrics
      const now = Date.now();
      for (const metric of this.metrics.values()) {
        metric.timestamp = now;
      }

    } catch (error) {
      this.logger.error('Failed to collect system metrics', { error });
    }
  }

  private getMetricKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }
    
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    
    return `${name}{${labelStr}}`;
  }

  private getUptime(): number {
    if (!this.startTime) return 0;
    return Date.now() - this.startTime.getTime();
  }

  private getMemoryUsage(): number {
    const memUsage = process.memoryUsage();
    return memUsage.heapUsed + memUsage.external;
  }

  private getCpuUsage(): number {
    // Simplified CPU usage calculation
    const usage = process.cpuUsage();
    const totalUsage = usage.user + usage.system;
    const uptime = process.uptime() * 1000000; // Convert to microseconds
    
    return Math.min((totalUsage / uptime) * 100, 100);
  }
}