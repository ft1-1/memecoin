import { EventEmitter } from 'events';
import express from 'express';
import { Server } from 'http';
import { Logger } from 'winston';
import { MonitoringConfig } from '@/types/config';
import { SystemComponent, ComponentHealth } from '@/orchestrator/SystemOrchestrator';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  components: Record<string, ComponentHealth>;
  system: {
    memory: {
      used: number;
      free: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
    };
    disk: {
      used: number;
      free: number;
      total: number;
      percentage: number;
    };
  };
}

/**
 * Health checker that provides HTTP endpoints for system health monitoring
 */
export class HealthChecker extends EventEmitter implements SystemComponent {
  public readonly name = 'health-checker';
  
  private readonly logger: Logger;
  private readonly config: MonitoringConfig;
  private app: express.Application | null = null;
  private server: Server | null = null;
  private components = new Map<string, SystemComponent>();
  private startTime: Date | null = null;

  constructor(config: MonitoringConfig, logger: Logger) {
    super();
    this.config = config;
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing health checker');
    
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    
    this.startTime = new Date();
  }

  async start(): Promise<void> {
    if (!this.app) {
      throw new Error('Health checker not initialized');
    }

    return new Promise((resolve, reject) => {
      this.server = this.app!.listen(this.config.healthCheck.port, (error?: Error) => {
        if (error) {
          reject(error);
          return;
        }

        this.logger.info(`Health check server started on port ${this.config.healthCheck.port}`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          this.logger.info('Health check server stopped');
          resolve();
        });
      });
    }
  }

  async getHealth(): Promise<ComponentHealth> {
    return {
      status: 'healthy',
      message: 'Health checker is operational',
      responseTime: 0,
    };
  }

  async destroy(): Promise<void> {
    await this.stop();
    this.components.clear();
    this.app = null;
    this.server = null;
  }

  /**
   * Register a component for health monitoring
   */
  registerComponent(component: SystemComponent): void {
    this.components.set(component.name, component);
    this.logger.debug(`Registered component for health monitoring: ${component.name}`);
  }

  /**
   * Unregister a component
   */
  unregisterComponent(name: string): void {
    this.components.delete(name);
    this.logger.debug(`Unregistered component from health monitoring: ${name}`);
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    // Check component health
    const components: Record<string, ComponentHealth> = {};
    let overallStatus: HealthCheckResult['status'] = 'healthy';

    for (const [name, component] of this.components) {
      try {
        const health = await component.getHealth();
        components[name] = health;

        if (health.status === 'unhealthy') {
          overallStatus = 'unhealthy';
        } else if (health.status === 'degraded' && overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }
      } catch (error) {
        components[name] = {
          status: 'unhealthy',
          message: `Health check failed: ${(error as Error).message}`,
        };
        overallStatus = 'unhealthy';
      }
    }

    // Get system metrics
    const systemMetrics = await this.getSystemMetrics();

    // Check system thresholds
    if (systemMetrics.memory.percentage > 90 || systemMetrics.disk.percentage > 90) {
      overallStatus = 'degraded';
    }

    const result: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: this.getUptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      components,
      system: systemMetrics,
    };

    const duration = Date.now() - startTime;
    this.logger.debug('Health check completed', { status: overallStatus, duration });

    return result;
  }

  private setupMiddleware(): void {
    if (!this.app) return;

    // Basic middleware
    this.app.use(express.json());
    
    // CORS for health endpoints
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      next();
    });

    // Request logging
    this.app.use((req, res, next) => {
      this.logger.debug(`Health check request: ${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    if (!this.app) return;

    // Basic health check
    this.app.get('/health', async (req, res) => {
      try {
        const health = await this.performHealthCheck();
        const statusCode = health.status === 'healthy' ? 200 : 
                          health.status === 'degraded' ? 200 : 503;
        
        res.status(statusCode).json(health);
      } catch (error) {
        this.logger.error('Health check endpoint error', { error });
        res.status(500).json({
          status: 'unhealthy',
          message: 'Health check failed',
          error: (error as Error).message,
        });
      }
    });

    // Readiness probe (for Kubernetes)
    this.app.get('/ready', async (req, res) => {
      try {
        const health = await this.performHealthCheck();
        if (health.status === 'unhealthy') {
          res.status(503).json({ ready: false, reason: 'System unhealthy' });
        } else {
          res.status(200).json({ ready: true });
        }
      } catch (error) {
        res.status(503).json({ ready: false, reason: 'Health check failed' });
      }
    });

    // Liveness probe (for Kubernetes)
    this.app.get('/live', (req, res) => {
      res.status(200).json({ alive: true, uptime: this.getUptime() });
    });

    // Component-specific health
    this.app.get('/health/components', async (req, res) => {
      try {
        const components: Record<string, ComponentHealth> = {};
        
        for (const [name, component] of this.components) {
          try {
            components[name] = await component.getHealth();
          } catch (error) {
            components[name] = {
              status: 'unhealthy',
              message: (error as Error).message,
            };
          }
        }
        
        res.json({ components });
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    // System metrics
    this.app.get('/health/system', async (req, res) => {
      try {
        const metrics = await this.getSystemMetrics();
        res.json(metrics);
      } catch (error) {
        res.status(500).json({ error: (error as Error).message });
      }
    });

    // Discord-specific health check
    this.app.get('/health/discord', async (req, res) => {
      try {
        const discordComponent = this.components.get('MemecoinNotificationService') || 
                               this.components.get('DiscordNotificationService');
        
        if (!discordComponent) {
          res.status(404).json({
            status: 'not_found',
            message: 'Discord notification service not registered',
            available_components: Array.from(this.components.keys())
          });
          return;
        }

        const health = await discordComponent.getHealth();
        const statusCode = health.status === 'healthy' ? 200 : 
                          health.status === 'degraded' ? 200 : 503;

        res.status(statusCode).json({
          component: discordComponent.name,
          health,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.logger.error('Discord health check failed', { error });
        res.status(500).json({
          status: 'error',
          message: 'Discord health check failed',
          error: (error as Error).message
        });
      }
    });
  }

  private getUptime(): number {
    if (!this.startTime) return 0;
    return Date.now() - this.startTime.getTime();
  }

  private async getSystemMetrics(): Promise<HealthCheckResult['system']> {
    const memUsage = process.memoryUsage();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const totalMem = require('os').totalmem();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const freeMem = require('os').freemem();
    const usedMem = totalMem - freeMem;

    // CPU usage (simplified - in production you might want a more accurate measurement)
    const cpuUsage = process.cpuUsage();
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000 / process.uptime() * 100;

    // Disk usage (simplified - you might want to check actual disk space)
    const diskTotal = 100 * 1024 * 1024 * 1024; // 100GB placeholder
    const diskUsed = memUsage.heapUsed; // Placeholder
    const diskFree = diskTotal - diskUsed;

    return {
      memory: {
        used: usedMem,
        free: freeMem,
        total: totalMem,
        percentage: (usedMem / totalMem) * 100,
      },
      cpu: {
        usage: Math.min(cpuPercent, 100),
      },
      disk: {
        used: diskUsed,
        free: diskFree,
        total: diskTotal,
        percentage: (diskUsed / diskTotal) * 100,
      },
    };
  }
}