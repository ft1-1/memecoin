import { EventEmitter } from 'events';
import * as cron from 'node-cron';
import { Logger } from 'winston';

export interface ScheduledTask {
  id: string;
  name: string;
  schedule: string;
  handler: () => Promise<void> | void;
  enabled: boolean;
  runImmediately?: boolean;
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  errorCount: number;
}

/**
 * Task scheduler with cron-based scheduling
 * Manages scheduled jobs with proper error handling and monitoring
 */
export class TaskScheduler extends EventEmitter {
  private readonly logger: Logger;
  private readonly tasks = new Map<string, ScheduledTask>();
  private readonly cronJobs = new Map<string, cron.ScheduledTask>();
  private isStarted = false;

  constructor(logger: Logger) {
    super();
    this.logger = logger;
  }

  /**
   * Schedule a new task
   */
  schedule(
    id: string,
    schedule: string,
    handler: () => Promise<void> | void,
    name?: string,
    runImmediately?: boolean
  ): void {
    if (this.tasks.has(id)) {
      throw new Error(`Task with id '${id}' is already scheduled`);
    }

    if (!cron.validate(schedule)) {
      throw new Error(`Invalid cron expression: ${schedule}`);
    }

    const task: ScheduledTask = {
      id,
      name: name || id,
      schedule,
      handler,
      enabled: true,
      runImmediately: runImmediately || false,
      runCount: 0,
      errorCount: 0,
    };

    this.tasks.set(id, task);
    
    if (this.isStarted) {
      this.startTask(task);
    }

    this.logger.info(`Task scheduled: ${task.name}`, {
      id,
      schedule,
      name: task.name,
    });
  }

  /**
   * Start the scheduler and all tasks
   */
  start(): void {
    if (this.isStarted) {
      return;
    }

    this.logger.info('Starting task scheduler');
    this.isStarted = true;

    for (const task of this.tasks.values()) {
      if (task.enabled) {
        this.startTask(task);
      }
    }

    this.emit('started');
  }

  /**
   * Stop the scheduler and all tasks
   */
  stop(): void {
    if (!this.isStarted) {
      return;
    }

    this.logger.info('Stopping task scheduler');
    this.isStarted = false;

    for (const cronJob of this.cronJobs.values()) {
      cronJob.stop();
      cronJob.destroy();
    }

    this.cronJobs.clear();
    this.emit('stopped');
  }

  /**
   * Enable a task
   */
  enableTask(id: string): void {
    const task = this.tasks.get(id);
    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }

    if (task.enabled) {
      return;
    }

    task.enabled = true;
    
    if (this.isStarted) {
      this.startTask(task);
    }

    this.logger.info(`Task enabled: ${task.name}`, { id });
  }

  /**
   * Disable a task
   */
  disableTask(id: string): void {
    const task = this.tasks.get(id);
    if (!task) {
      throw new Error(`Task not found: ${id}`);
    }

    if (!task.enabled) {
      return;
    }

    task.enabled = false;
    
    const cronJob = this.cronJobs.get(id);
    if (cronJob) {
      cronJob.stop();
      cronJob.destroy();
      this.cronJobs.delete(id);
    }

    this.logger.info(`Task disabled: ${task.name}`, { id });
  }

  /**
   * Remove a task completely
   */
  removeTask(id: string): void {
    const task = this.tasks.get(id);
    if (!task) {
      return;
    }

    this.disableTask(id);
    this.tasks.delete(id);

    this.logger.info(`Task removed: ${task.name}`, { id });
  }

  /**
   * Get task information
   */
  getTask(id: string): ScheduledTask | undefined {
    return this.tasks.get(id);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): ScheduledTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get task statistics
   */
  getStats(): {
    totalTasks: number;
    enabledTasks: number;
    runningTasks: number;
    totalRuns: number;
    totalErrors: number;
  } {
    const tasks = Array.from(this.tasks.values());
    
    return {
      totalTasks: tasks.length,
      enabledTasks: tasks.filter(t => t.enabled).length,
      runningTasks: this.cronJobs.size,
      totalRuns: tasks.reduce((sum, t) => sum + t.runCount, 0),
      totalErrors: tasks.reduce((sum, t) => sum + t.errorCount, 0),
    };
  }

  private startTask(task: ScheduledTask): void {
    const cronJob = cron.schedule(
      task.schedule,
      async () => {
        await this.executeTask(task);
      },
      {
        scheduled: false, // Don't start immediately
        timezone: 'UTC',
      }
    );

    this.cronJobs.set(task.id, cronJob);
    cronJob.start();

    // Calculate next run time
    task.nextRun = this.getNextRunTime(task.schedule);

    // Run immediately if requested
    if (task.runImmediately) {
      this.logger.info(`Running task immediately on startup: ${task.name}`, { id: task.id });
      // Execute in next tick to avoid blocking startup
      setImmediate(() => this.executeTask(task));
    }

    this.logger.debug(`Task started: ${task.name}`, {
      id: task.id,
      schedule: task.schedule,
      nextRun: task.nextRun,
      runImmediately: task.runImmediately,
    });
  }

  private async executeTask(task: ScheduledTask): Promise<void> {
    const startTime = Date.now();
    
    this.logger.debug(`Executing task: ${task.name}`, { id: task.id });
    this.emit('taskStarted', task);

    try {
      await task.handler();
      
      const duration = Date.now() - startTime;
      task.runCount++;
      task.lastRun = new Date();
      task.nextRun = this.getNextRunTime(task.schedule);

      this.logger.debug(`Task completed: ${task.name}`, {
        id: task.id,
        duration,
        runCount: task.runCount,
        nextRun: task.nextRun,
      });

      this.emit('taskCompleted', task, duration);

    } catch (error) {
      const duration = Date.now() - startTime;
      task.errorCount++;
      task.lastRun = new Date();
      task.nextRun = this.getNextRunTime(task.schedule);

      this.logger.error(`Task failed: ${task.name}`, {
        id: task.id,
        error: (error as Error).message,
        stack: (error as Error).stack,
        duration,
        errorCount: task.errorCount,
        nextRun: task.nextRun,
      });

      this.emit('taskFailed', task, error, duration);
    }
  }

  private getNextRunTime(_schedule: string): Date {
    // This is a simplified implementation
    // In a real implementation, you might use a cron parser library
    // to calculate the exact next run time
    const now = new Date();
    return new Date(now.getTime() + 60000); // Add 1 minute as placeholder
  }
}