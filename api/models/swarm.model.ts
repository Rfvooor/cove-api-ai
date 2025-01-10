import { v4 as uuidv4 } from 'uuid';
import { SwarmConfig } from './types';
import { AgentModel } from './agent.model';

export class SwarmModel {
  private id: string;
  private config: SwarmConfig;
  private agents: Map<string, AgentModel>;
  private lastUpdated: Date;

  constructor(config: SwarmConfig) {
    this.id = uuidv4();
    this.config = config;
    this.agents = new Map();
    this.lastUpdated = new Date();
  }

  async initialize(): Promise<void> {
    // Initialize each agent in the swarm
    for (const agentId of this.config.agents) {
      try {
        const agent = await this.getOrCreateAgent(agentId);
        this.agents.set(agentId, agent);
      } catch (error) {
        console.error(`Failed to initialize agent ${agentId}:`, error);
      }
    }
  }

  private async getOrCreateAgent(agentId: string): Promise<AgentModel> {
    // In a real implementation, you would fetch the agent from a database
    // For now, we'll throw an error
    throw new Error('Agent not found');
  }

  async executeTask(input: string, context?: Record<string, any>): Promise<any> {
    switch (this.config.topology) {
      case 'sequential':
        return this.executeSequential(input, context);
      case 'parallel':
        return this.executeParallel(input, context);
      case 'hierarchical':
        return this.executeHierarchical(input, context);
      case 'mesh':
        return this.executeMesh(input, context);
      default:
        throw new Error(`Unsupported topology: ${this.config.topology}`);
    }
  }

  private async executeSequential(input: string, context?: Record<string, any>): Promise<any> {
    let currentOutput = input;
    for (const agent of this.agents.values()) {
      currentOutput = await agent.executeTask(currentOutput, context);
    }
    return currentOutput;
  }

  private async executeParallel(input: string, context?: Record<string, any>): Promise<any[]> {
    const tasks = Array.from(this.agents.values()).map(agent => 
      agent.executeTask(input, context)
    );

    const results = await Promise.all(tasks.map(task => 
      task.catch(error => ({ error }))
    ));

    return results.filter(result => !('error' in result));
  }

  private async executeHierarchical(input: string, context?: Record<string, any>): Promise<any> {
    // In a hierarchical topology, the first agent coordinates the others
    const [coordinator, ...workers] = Array.from(this.agents.values());
    if (!coordinator) {
      throw new Error('No coordinator agent available');
    }

    // The coordinator processes the input and creates subtasks
    const plan = await coordinator.executeTask(input, {
      ...context,
      role: 'coordinator',
      workers: workers.length,
    });

    // Execute subtasks in parallel
    const results = await this.executeParallel(JSON.stringify(plan), context);

    // Coordinator aggregates results
    return coordinator.executeTask(JSON.stringify(results), {
      ...context,
      role: 'aggregator',
    });
  }

  private async executeMesh(input: string, context?: Record<string, any>): Promise<any> {
    // In a mesh topology, each agent can communicate with any other agent
    const agents = Array.from(this.agents.values());
    const maxIterations = this.config.maxConcurrency || 5;
    let currentState = input;

    for (let i = 0; i < maxIterations; i++) {
      const results = await this.executeParallel(currentState, {
        ...context,
        iteration: i,
        states: currentState,
      });

      // Aggregate results from all agents
      currentState = JSON.stringify(results);

      // Check if we've reached convergence
      if (results.every(r => r.converged)) {
        break;
      }
    }

    return currentState;
  }

  getId(): string {
    return this.id;
  }

  getConfig(): SwarmConfig {
    return this.config;
  }

  getAgents(): string[] {
    return Array.from(this.agents.keys());
  }

  getLastUpdated(): Date {
    return this.lastUpdated;
  }

  async updateConfig(updates: Partial<SwarmConfig>): Promise<void> {
    this.config = { ...this.config, ...updates };
    this.lastUpdated = new Date();

    // Reinitialize if agent list has changed
    if (updates.agents) {
      await this.initialize();
    }
  }
}