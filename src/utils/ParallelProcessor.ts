/**
 * Parallel Processing utilities for enhanced performance
 * Handles concurrent analysis tasks with proper resource management
 */

import { Logger } from 'winston';

export interface ParallelTaskConfig {
  concurrency: number;
  timeout: number;
  retries: number;
  retryDelay: number;
  enableBatching: boolean;
  batchSize: number;
}

export interface TaskResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  duration: number;
  attempts: number;
}

export interface BatchResult<T> {
  results: TaskResult<T>[];
  totalDuration: number;
  successCount: number;
  failureCount: number;
  averageTaskTime: number;
}

/**
 * Parallel task processor with configurable concurrency and error handling
 */
export class ParallelProcessor {
  private activeTasks = 0;
  private taskQueue: (() => Promise<any>)[] = [];
  private semaphore: Promise<void> = Promise.resolve();

  constructor(
    private config: ParallelTaskConfig,
    private logger: Logger
  ) {}

  /**
   * Process multiple tasks in parallel with controlled concurrency
   */
  async processTasks<T, R>(
    items: T[],
    taskFn: (item: T) => Promise<R>,
    taskName = 'task'
  ): Promise<BatchResult<R>> {
    const startTime = Date.now();
    
    this.logger.info(`Starting parallel processing of ${items.length} ${taskName}s`, {
      concurrency: this.config.concurrency,
      enableBatching: this.config.enableBatching,
      batchSize: this.config.batchSize
    });

    let results: TaskResult<R>[];

    if (this.config.enableBatching && items.length > this.config.batchSize) {
      results = await this.processBatches(items, taskFn, taskName);
    } else {
      results = await this.processAllConcurrent(items, taskFn, taskName);
    }

    const totalDuration = Date.now() - startTime;
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    const averageTaskTime = results.length > 0 ? 
      results.reduce((sum, r) => sum + r.duration, 0) / results.length : 0;

    const batchResult: BatchResult<R> = {
      results,
      totalDuration,
      successCount,
      failureCount,
      averageTaskTime
    };

    this.logger.info(`Parallel processing completed for ${taskName}s`, {
      totalItems: items.length,
      successCount,
      failureCount,
      totalDuration,
      averageTaskTime: Math.round(averageTaskTime),
      throughput: Math.round((items.length / totalDuration) * 1000) // items per second
    });

    return batchResult;
  }

  /**
   * Process items in batches for better memory management
   */
  private async processBatches<T, R>(
    items: T[],
    taskFn: (item: T) => Promise<R>,
    taskName: string
  ): Promise<TaskResult<R>[]> {
    const allResults: TaskResult<R>[] = [];
    
    for (let i = 0; i < items.length; i += this.config.batchSize) {
      const batch = items.slice(i, i + this.config.batchSize);
      
      this.logger.debug(`Processing batch ${Math.floor(i / this.config.batchSize) + 1}/${Math.ceil(items.length / this.config.batchSize)}`, {
        batchSize: batch.length,
        taskName
      });

      const batchResults = await this.processAllConcurrent(batch, taskFn, taskName);
      allResults.push(...batchResults);

      // Small delay between batches to prevent overwhelming external APIs
      if (i + this.config.batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return allResults;
  }

  /**
   * Process all items concurrently with semaphore for concurrency control
   */
  private async processAllConcurrent<T, R>(
    items: T[],
    taskFn: (item: T) => Promise<R>,
    taskName: string
  ): Promise<TaskResult<R>[]> {
    const promises = items.map(item => this.processWithSemaphore(item, taskFn, taskName));
    return Promise.all(promises);
  }

  /**
   * Process a single task with semaphore for concurrency control
   */
  private async processWithSemaphore<T, R>(
    item: T,
    taskFn: (item: T) => Promise<R>,
    taskName: string
  ): Promise<TaskResult<R>> {
    return new Promise((resolve) => {
      this.taskQueue.push(async () => {
        try {
          const result = await this.executeTaskWithRetry(item, taskFn, taskName);
          resolve(result);
        } catch (error) {
          resolve({
            success: false,
            error: error as Error,
            duration: 0,
            attempts: this.config.retries + 1
          });
        }
      });

      this.processQueue();
    });
  }

  /**
   * Process the task queue with concurrency control
   */
  private async processQueue(): Promise<void> {
    if (this.activeTasks >= this.config.concurrency || this.taskQueue.length === 0) {
      return;
    }

    const task = this.taskQueue.shift();
    if (!task) return;

    this.activeTasks++;
    
    try {
      await task();
    } finally {
      this.activeTasks--;
      // Process next task if queue is not empty
      if (this.taskQueue.length > 0) {
        setImmediate(() => this.processQueue());
      }
    }
  }

  /**
   * Execute a task with retry logic and timeout
   */
  private async executeTaskWithRetry<T, R>(
    item: T,
    taskFn: (item: T) => Promise<R>,
    taskName: string
  ): Promise<TaskResult<R>> {
    let lastError: Error | undefined;
    const startTime = Date.now();

    for (let attempt = 1; attempt <= this.config.retries + 1; attempt++) {
      try {
        const taskStartTime = Date.now();
        
        // Add timeout to task execution
        const result = await Promise.race([
          taskFn(item),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error(`${taskName} timeout after ${this.config.timeout}ms`)), 
            this.config.timeout)
          )
        ]);

        const duration = Date.now() - startTime;

        this.logger.debug(`${taskName} completed successfully`, {
          attempt,
          duration: Date.now() - taskStartTime,
          totalDuration: duration
        });

        return {
          success: true,
          data: result,
          duration,
          attempts: attempt
        };

      } catch (error) {
        lastError = error as Error;
        
        this.logger.warn(`${taskName} failed on attempt ${attempt}`, {
          error: lastError.message,
          attempt,
          maxAttempts: this.config.retries + 1
        });

        // Don't retry on the last attempt
        if (attempt < this.config.retries + 1) {
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * attempt));
        }
      }
    }

    const duration = Date.now() - startTime;
    
    return {
      success: false,
      error: lastError,
      duration,
      attempts: this.config.retries + 1
    };
  }

  /**
   * Get current processor statistics
   */
  getStatistics(): {
    activeTasks: number;
    queuedTasks: number;
    concurrency: number;
    config: ParallelTaskConfig;
  } {
    return {
      activeTasks: this.activeTasks,
      queuedTasks: this.taskQueue.length,
      concurrency: this.config.concurrency,
      config: { ...this.config }
    };
  }

  /**
   * Wait for all active tasks to complete
   */
  async waitForCompletion(): Promise<void> {
    while (this.activeTasks > 0 || this.taskQueue.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  /**
   * Clear the task queue
   */
  clearQueue(): void {
    this.taskQueue.length = 0;
    this.logger.info('Task queue cleared');
  }
}

/**
 * Multi-timeframe data processor for parallel chart data fetching
 */
export class MultiTimeframeProcessor {
  private parallelProcessor: ParallelProcessor;

  constructor(
    private logger: Logger,
    concurrency = 4
  ) {
    this.parallelProcessor = new ParallelProcessor(
      {
        concurrency,
        timeout: 30000, // 30 seconds per timeframe
        retries: 2,
        retryDelay: 1000,
        enableBatching: false,
        batchSize: 10
      },
      logger
    );
  }

  /**
   * Fetch chart data for multiple timeframes in parallel
   */
  async fetchMultiTimeframeData(
    tokenAddress: string,
    timeframes: string[],
    fetchFn: (tokenAddress: string, timeframe: string) => Promise<any>
  ): Promise<{
    timeframes: Record<string, any>;
    errors: string[];
    warnings: string[];
    fetchTime: number;
  }> {
    const startTime = Date.now();
    
    this.logger.debug('Fetching multi-timeframe data in parallel', {
      tokenAddress,
      timeframes,
      concurrency: this.parallelProcessor.getStatistics().concurrency
    });

    const tasks = timeframes.map(tf => ({ tokenAddress, timeframe: tf }));
    
    const batchResult = await this.parallelProcessor.processTasks(
      tasks,
      async ({ tokenAddress, timeframe }) => {
        const data = await fetchFn(tokenAddress, timeframe);
        return { timeframe, data };
      },
      'timeframe-fetch'
    );

    // Process results
    const timeframeData: Record<string, any> = {};
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const result of batchResult.results) {
      if (result.success && result.data) {
        timeframeData[result.data.timeframe] = result.data.data;
      } else if (result.error) {
        const errorMsg = `Failed to fetch ${result.error.message}`;
        errors.push(errorMsg);
        this.logger.error('Timeframe data fetch failed', {
          error: result.error.message,
          attempts: result.attempts,
          duration: result.duration
        });
      }
    }

    // Add warnings for partial failures
    if (errors.length > 0 && Object.keys(timeframeData).length > 0) {
      warnings.push(`Partial data available: ${errors.length} timeframes failed`);
    }

    const fetchTime = Date.now() - startTime;

    this.logger.info('Multi-timeframe data fetch completed', {
      tokenAddress,
      successfulTimeframes: Object.keys(timeframeData).length,
      failedTimeframes: errors.length,
      totalFetchTime: fetchTime,
      averageTimePerTimeframe: Math.round(batchResult.averageTaskTime)
    });

    return {
      timeframes: timeframeData,
      errors,
      warnings,
      fetchTime
    };
  }

  /**
   * Get processor statistics
   */
  getStatistics() {
    return this.parallelProcessor.getStatistics();
  }
}