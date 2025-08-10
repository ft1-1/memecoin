import { EventEmitter } from 'events';
import { SystemState, ComponentHealth } from './SystemOrchestrator';

/**
 * Manages the overall system state and metrics
 * Provides centralized state tracking and history
 */
export class StateManager extends EventEmitter {
  private state: SystemState = {
    status: 'stopped',
    components: {},
    metrics: {
      totalCycles: 0,
      successfulCycles: 0,
      failedCycles: 0,
      averageCycleTime: 0,
    },
  };

  private customMetrics: Record<string, number> = {};

  private cycleTimes: number[] = [];
  private readonly maxCycleTimeHistory = 100; // Keep last 100 cycle times for averaging

  /**
   * Set the system status
   */
  setState(status: SystemState['status']): void {
    const previousStatus = this.state.status;
    this.state.status = status;
    
    this.emit('stateChanged', {
      from: previousStatus,
      to: status,
      timestamp: new Date(),
    });
  }

  /**
   * Set the system start time
   */
  setStartTime(startTime: Date): void {
    this.state.startedAt = startTime;
    this.emit('systemStarted', startTime);
  }

  /**
   * Get the current system state
   */
  getState(): SystemState {
    return { ...this.state };
  }

  /**
   * Get system uptime in milliseconds
   */
  getUptime(): number | null {
    if (!this.state.startedAt || this.state.status !== 'running') {
      return null;
    }
    return Date.now() - this.state.startedAt.getTime();
  }

  /**
   * Update component health status
   */
  updateComponentsHealth(components: Record<string, ComponentHealth>): void {
    const previousComponents = { ...this.state.components };
    this.state.components = { ...components };

    // Emit events for components that changed status
    for (const [name, health] of Object.entries(components)) {
      const previous = previousComponents[name];
      if (!previous || previous.status !== health.status) {
        this.emit('componentHealthChanged', {
          component: name,
          from: previous?.status,
          to: health.status,
          health,
          timestamp: new Date(),
        });
      }
    }
  }

  /**
   * Increment total cycles counter
   */
  incrementTotalCycles(): void {
    this.state.metrics.totalCycles++;
    this.emit('cycleStarted', {
      cycleNumber: this.state.metrics.totalCycles,
      timestamp: new Date(),
    });
  }

  /**
   * Increment successful cycles counter
   */
  incrementSuccessfulCycles(): void {
    this.state.metrics.successfulCycles++;
    this.emit('cycleCompleted', {
      cycleNumber: this.state.metrics.totalCycles,
      success: true,
      timestamp: new Date(),
    });
  }

  /**
   * Increment failed cycles counter
   */
  incrementFailedCycles(): void {
    this.state.metrics.failedCycles++;
    this.emit('cycleCompleted', {
      cycleNumber: this.state.metrics.totalCycles,
      success: false,
      timestamp: new Date(),
    });
  }

  /**
   * Set the last cycle execution time
   */
  setLastCycleTime(time: Date): void {
    this.state.metrics.lastCycleAt = time;
  }

  /**
   * Update average cycle time with new execution time
   */
  updateAverageCycleTime(cycleTime: number): void {
    this.cycleTimes.push(cycleTime);
    
    // Keep only the most recent cycle times
    if (this.cycleTimes.length > this.maxCycleTimeHistory) {
      this.cycleTimes = this.cycleTimes.slice(-this.maxCycleTimeHistory);
    }

    // Calculate new average
    this.state.metrics.averageCycleTime = 
      this.cycleTimes.reduce((sum, time) => sum + time, 0) / this.cycleTimes.length;

    this.emit('cycleTimeUpdated', {
      currentCycleTime: cycleTime,
      averageCycleTime: this.state.metrics.averageCycleTime,
      timestamp: new Date(),
    });
  }

  /**
   * Get cycle success rate as percentage
   */
  getSuccessRate(): number {
    if (this.state.metrics.totalCycles === 0) {
      return 0;
    }
    return (this.state.metrics.successfulCycles / this.state.metrics.totalCycles) * 100;
  }

  /**
   * Get cycle failure rate as percentage
   */
  getFailureRate(): number {
    if (this.state.metrics.totalCycles === 0) {
      return 0;
    }
    return (this.state.metrics.failedCycles / this.state.metrics.totalCycles) * 100;
  }

  /**
   * Get detailed system metrics
   */
  getDetailedMetrics(): {
    uptime: number | null;
    successRate: number;
    failureRate: number;
    totalCycles: number;
    averageCycleTime: number;
    lastCycleAt: Date | undefined;
    componentHealth: {
      healthy: number;
      degraded: number;
      unhealthy: number;
      total: number;
    };
    recentCycleTimes: number[];
  } {
    const componentHealth = {
      healthy: 0,
      degraded: 0,
      unhealthy: 0,
      total: 0,
    };

    for (const health of Object.values(this.state.components)) {
      componentHealth.total++;
      componentHealth[health.status]++;
    }

    return {
      uptime: this.getUptime(),
      successRate: this.getSuccessRate(),
      failureRate: this.getFailureRate(),
      totalCycles: this.state.metrics.totalCycles,
      averageCycleTime: this.state.metrics.averageCycleTime,
      lastCycleAt: this.state.metrics.lastCycleAt,
      componentHealth,
      recentCycleTimes: [...this.cycleTimes],
    };
  }

  /**
   * Reset all metrics (useful for testing or manual resets)
   */
  resetMetrics(): void {
    this.state.metrics = {
      totalCycles: 0,
      successfulCycles: 0,
      failedCycles: 0,
      averageCycleTime: 0,
    };
    this.cycleTimes = [];
    
    this.emit('metricsReset', {
      timestamp: new Date(),
    });
  }

  /**
   * Get system health summary
   */
  getHealthSummary(): {
    status: ComponentHealth['status'];
    message: string;
    details: {
      systemStatus: SystemState['status'];
      uptime: number | null;
      successRate: number;
      componentHealth: Record<string, ComponentHealth['status']>;
    };
  } {
    const componentStatuses = Object.values(this.state.components).map(c => c.status);
    
    let overallStatus: ComponentHealth['status'] = 'healthy';
    let message = 'System is operating normally';

    if (componentStatuses.includes('unhealthy')) {
      overallStatus = 'unhealthy';
      message = 'System has unhealthy components';
    } else if (componentStatuses.includes('degraded')) {
      overallStatus = 'degraded';
      message = 'System has degraded components';
    }

    // Factor in system status
    if (this.state.status === 'error') {
      overallStatus = 'unhealthy';
      message = 'System is in error state';
    } else if (this.state.status === 'initializing' || this.state.status === 'stopping') {
      overallStatus = 'degraded';
      message = `System is ${this.state.status}`;
    }

    const componentHealth: Record<string, ComponentHealth['status']> = {};
    for (const [name, health] of Object.entries(this.state.components)) {
      componentHealth[name] = health.status;
    }

    return {
      status: overallStatus,
      message,
      details: {
        systemStatus: this.state.status,
        uptime: this.getUptime(),
        successRate: this.getSuccessRate(),
        componentHealth,
      },
    };
  }

  /**
   * Check if system is ready to process requests
   */
  isReady(): boolean {
    return (
      this.state.status === 'running' &&
      Object.values(this.state.components).every(c => c.status !== 'unhealthy')
    );
  }

  /**
   * Export state for persistence or debugging
   */
  exportState(): {
    state: SystemState;
    cycleTimes: number[];
    timestamp: string;
  } {
    return {
      state: { ...this.state },
      cycleTimes: [...this.cycleTimes],
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Update system state (alias for setState for compatibility)
   */
  updateSystemState(status: SystemState['status']): void {
    this.setState(status);
  }

  /**
   * Update last execution time (alias for setLastCycleTime for compatibility)
   */
  updateLastExecutionTime(): void {
    this.setLastCycleTime(new Date());
  }

  /**
   * Increment a custom metric by a specified amount
   */
  incrementMetric(name: string, amount: number = 1): void {
    if (!this.customMetrics[name]) {
      this.customMetrics[name] = 0;
    }
    this.customMetrics[name] += amount;
    
    this.emit('metricIncremented', {
      metric: name,
      amount,
      newValue: this.customMetrics[name],
      timestamp: new Date(),
    });
  }

  /**
   * Get a custom metric value
   */
  getMetric(name: string): number {
    return this.customMetrics[name] || 0;
  }

  /**
   * Get all custom metrics
   */
  getAllCustomMetrics(): Record<string, number> {
    return { ...this.customMetrics };
  }

  /**
   * Reset a specific custom metric
   */
  resetMetric(name: string): void {
    delete this.customMetrics[name];
    this.emit('metricReset', {
      metric: name,
      timestamp: new Date(),
    });
  }

  /**
   * Reset all custom metrics
   */
  resetAllCustomMetrics(): void {
    this.customMetrics = {};
    this.emit('allCustomMetricsReset', {
      timestamp: new Date(),
    });
  }
}