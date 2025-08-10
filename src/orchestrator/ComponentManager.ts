import { EventEmitter } from 'events';
import { Logger } from 'winston';
import { SystemComponent, ComponentHealth } from './SystemOrchestrator';

export interface ComponentRegistration {
  component: SystemComponent;
  dependencies: string[];
  priority: number; // Lower numbers start first
}

/**
 * Manages the lifecycle of all system components
 * Handles dependency resolution, initialization order, and health monitoring
 */
export class ComponentManager extends EventEmitter {
  private readonly logger: Logger;
  private readonly components = new Map<string, ComponentRegistration>();
  private readonly initializedComponents = new Set<string>();
  private readonly startedComponents = new Set<string>();
  
  constructor(logger: Logger) {
    super();
    this.logger = logger;
  }

  /**
   * Register a component with its dependencies
   */
  registerComponent(
    name: string,
    component: SystemComponent,
    dependencies: string[] = [],
    priority = 100
  ): void {
    if (this.components.has(name)) {
      throw new Error(`Component ${name} is already registered`);
    }

    this.components.set(name, {
      component,
      dependencies,
      priority,
    });

    this.logger.debug(`Registered component: ${name}`, {
      dependencies,
      priority,
    });
  }

  /**
   * Initialize all components in dependency order
   */
  async initializeComponents(): Promise<void> {
    const initOrder = this.resolveDependencyOrder();
    this.logger.info('Initializing components', { order: initOrder });

    for (const componentName of initOrder) {
      try {
        const registration = this.components.get(componentName)!;
        
        this.logger.debug(`Initializing component: ${componentName}`);
        const startTime = Date.now();
        
        await registration.component.initialize();
        
        const duration = Date.now() - startTime;
        this.initializedComponents.add(componentName);
        
        this.logger.info(`Component initialized: ${componentName}`, { duration });
        this.emit('componentInitialized', componentName, duration);

      } catch (error) {
        this.logger.error(`Failed to initialize component: ${componentName}`, { error });
        this.emit('componentError', componentName, error);
        throw new Error(`Component initialization failed: ${componentName}`);
      }
    }

    this.logger.info('All components initialized successfully');
  }

  /**
   * Start all components in dependency order
   */
  async startComponents(): Promise<void> {
    const startOrder = this.resolveDependencyOrder();
    this.logger.info('Starting components', { order: startOrder });

    for (const componentName of startOrder) {
      if (!this.initializedComponents.has(componentName)) {
        throw new Error(`Component ${componentName} is not initialized`);
      }

      try {
        const registration = this.components.get(componentName)!;
        
        this.logger.debug(`Starting component: ${componentName}`);
        const startTime = Date.now();
        
        await registration.component.start();
        
        const duration = Date.now() - startTime;
        this.startedComponents.add(componentName);
        
        this.logger.info(`Component started: ${componentName}`, { duration });
        this.emit('componentStarted', componentName, duration);

      } catch (error) {
        this.logger.error(`Failed to start component: ${componentName}`, { error });
        this.emit('componentError', componentName, error);
        throw new Error(`Component start failed: ${componentName}`);
      }
    }

    this.logger.info('All components started successfully');
  }

  /**
   * Stop all components in reverse dependency order
   */
  async stopComponents(): Promise<void> {
    const stopOrder = this.resolveDependencyOrder().reverse();
    this.logger.info('Stopping components', { order: stopOrder });

    const errors: Error[] = [];

    for (const componentName of stopOrder) {
      if (!this.startedComponents.has(componentName)) {
        continue; // Component wasn't started
      }

      try {
        const registration = this.components.get(componentName)!;
        
        this.logger.debug(`Stopping component: ${componentName}`);
        const startTime = Date.now();
        
        await registration.component.stop();
        
        const duration = Date.now() - startTime;
        this.startedComponents.delete(componentName);
        
        this.logger.info(`Component stopped: ${componentName}`, { duration });
        this.emit('componentStopped', componentName, duration);

      } catch (error) {
        this.logger.error(`Failed to stop component: ${componentName}`, { error });
        this.emit('componentError', componentName, error);
        errors.push(error as Error);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Failed to stop ${errors.length} components`);
    }

    this.logger.info('All components stopped successfully');
  }

  /**
   * Destroy all components (cleanup resources)
   */
  async destroyComponents(): Promise<void> {
    const destroyOrder = this.resolveDependencyOrder().reverse();
    this.logger.info('Destroying components', { order: destroyOrder });

    const errors: Error[] = [];

    for (const componentName of destroyOrder) {
      try {
        const registration = this.components.get(componentName)!;
        
        this.logger.debug(`Destroying component: ${componentName}`);
        await registration.component.destroy();
        
        this.initializedComponents.delete(componentName);
        this.startedComponents.delete(componentName);
        
        this.logger.info(`Component destroyed: ${componentName}`);
        this.emit('componentDestroyed', componentName);

      } catch (error) {
        this.logger.error(`Failed to destroy component: ${componentName}`, { error });
        errors.push(error as Error);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Failed to destroy ${errors.length} components`);
    }

    this.logger.info('All components destroyed successfully');
  }

  /**
   * Get health status of all components
   */
  async getSystemHealth(): Promise<{
    status: ComponentHealth['status'];
    components: Record<string, ComponentHealth>;
  }> {
    const components: Record<string, ComponentHealth> = {};
    let overallStatus: ComponentHealth['status'] = 'healthy';

    for (const [name, registration] of this.components) {
      try {
        const health = await registration.component.getHealth();
        components[name] = health;

        // Determine overall status
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

    return {
      status: overallStatus,
      components,
    };
  }

  /**
   * Get a specific component by name
   */
  getComponent<T extends SystemComponent>(name: string): T | undefined {
    const registration = this.components.get(name);
    return registration?.component as T;
  }

  /**
   * Check if a component is registered
   */
  hasComponent(name: string): boolean {
    return this.components.has(name);
  }

  /**
   * Get list of all registered component names
   */
  getComponentNames(): string[] {
    return Array.from(this.components.keys());
  }

  /**
   * Get component status
   */
  getComponentStatus(name: string): {
    registered: boolean;
    initialized: boolean;
    started: boolean;
  } {
    return {
      registered: this.components.has(name),
      initialized: this.initializedComponents.has(name),
      started: this.startedComponents.has(name),
    };
  }

  /**
   * Resolve component dependency order using topological sort
   */
  private resolveDependencyOrder(): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: string[] = [];

    const visit = (componentName: string): void => {
      if (visiting.has(componentName)) {
        throw new Error(`Circular dependency detected involving ${componentName}`);
      }
      
      if (visited.has(componentName)) {
        return;
      }

      const registration = this.components.get(componentName);
      if (!registration) {
        throw new Error(`Component ${componentName} is not registered`);
      }

      visiting.add(componentName);

      // Visit dependencies first
      for (const dependency of registration.dependencies) {
        if (!this.components.has(dependency)) {
          throw new Error(`Dependency ${dependency} for ${componentName} is not registered`);
        }
        visit(dependency);
      }

      visiting.delete(componentName);
      visited.add(componentName);
      result.push(componentName);
    };

    // Sort components by priority first, then resolve dependencies
    const componentsByPriority = Array.from(this.components.entries())
      .sort(([, a], [, b]) => a.priority - b.priority)
      .map(([name]) => name);

    for (const componentName of componentsByPriority) {
      if (!visited.has(componentName)) {
        visit(componentName);
      }
    }

    return result;
  }

  /**
   * Validate all component dependencies are satisfied
   */
  validateDependencies(): void {
    for (const [componentName, registration] of this.components) {
      for (const dependency of registration.dependencies) {
        if (!this.components.has(dependency)) {
          throw new Error(
            `Component ${componentName} depends on ${dependency} which is not registered`
          );
        }
      }
    }

    // Check for circular dependencies
    try {
      this.resolveDependencyOrder();
    } catch (error) {
      throw new Error(`Dependency validation failed: ${(error as Error).message}`);
    }
  }
}