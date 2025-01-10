import { Swarm as SwarmModel, SwarmModel as SwarmInstance, SwarmAttributes } from '../models/sequelize/swarm.model.js';
import { Agent as AgentModel, AgentModel as AgentInstance } from '../models/sequelize/agent.model.js';
import { SwarmConfig } from '../models/types.js';
import { Task, TaskStatus, TaskInput } from '../../src/core/task.js';
import { AgentBusiness } from './agent.business.js';

// Type for tasks that must have input
type TaskWithInput = Omit<Task, 'input'> & { input: TaskInput };

export class SwarmBusiness {
  private model: typeof SwarmModel;
  private agentBusiness: AgentBusiness;

  constructor() {
    this.model = SwarmModel;
    this.agentBusiness = new AgentBusiness();
  }

  async create(config: SwarmConfig): Promise<SwarmInstance> {
    // Verify all agents exist
    for (const agentId of config.agents) {
      await this.agentBusiness.findById(agentId);
    }

    // Create database record
    const swarm = await this.model.create({
      name: config.name,
      description: config.description,
      config: config,
    });

    return swarm;
  }

  async findById(id: string): Promise<SwarmInstance> {
    const swarm = await this.model.findByPk(id, {
      include: [{ model: AgentModel, as: 'agents' }]
    });
    if (!swarm) {
      throw new Error('Swarm not found');
    }
    return swarm;
  }

  async update(id: string, updates: Partial<SwarmConfig>): Promise<SwarmInstance> {
    const swarm = await this.findById(id);
    
    // If updating agents list, verify all agents exist
    if (updates.agents) {
      for (const agentId of updates.agents) {
        await this.agentBusiness.findById(agentId);
      }
    }

    // Update config
    const updatedConfig = { ...swarm.config, ...updates };
    await swarm.update({ config: updatedConfig });

    return swarm;
  }

  async delete(id: string): Promise<void> {
    const swarm = await this.findById(id);
    await swarm.destroy();
  }

  async executeTask(id: string, input: string, context?: Record<string, any>): Promise<any> {
    const swarm = await this.findById(id);
    const agents = await this.getAgents(id);

    const task: TaskWithInput = {
      id: swarm.id,
      name: input,
      status: TaskStatus.PENDING,
      input: {
        prompt: input,
        metadata: context
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const startTime = Date.now();
    try {
      // Execute task based on swarm topology
      const result = await this.executeWithTopology(swarm, agents, task);
      await this.updateMetrics(swarm, true, Date.now() - startTime);
      return result;
    } catch (error) {
      await this.updateMetrics(swarm, false, Date.now() - startTime);
      throw error;
    }
  }

  async addAgent(swarmId: string, agentId: string): Promise<void> {
    const swarm = await this.findById(swarmId);
    const agent = await this.agentBusiness.findById(agentId);

    // Add agent to swarm's config
    const agents = [...swarm.config.agents, agentId];
    await this.update(swarmId, { ...swarm.config, agents });
  }

  async removeAgent(swarmId: string, agentId: string): Promise<void> {
    const swarm = await this.findById(swarmId);

    // Remove agent from swarm's config
    const agents = swarm.config.agents.filter(id => id !== agentId);
    await this.update(swarmId, { ...swarm.config, agents });
  }

  private async getAgents(swarmId: string): Promise<AgentInstance[]> {
    const swarm = await this.findById(swarmId);
    return Promise.all(
      swarm.config.agents.map(agentId => this.agentBusiness.findById(agentId))
    );
  }

  private async executeWithTopology(
    swarm: SwarmInstance,
    agents: AgentInstance[],
    task: TaskWithInput
  ): Promise<any> {
    switch (swarm.config.topology) {
      case 'sequential':
        return this.executeSequential(agents, task);
      case 'parallel':
        return this.executeParallel(agents, task);
      case 'hierarchical':
        return this.executeHierarchical(agents, task);
      case 'mesh':
        return this.executeMesh(agents, task);
      default:
        throw new Error(`Unsupported topology: ${swarm.config.topology}`);
    }
  }

  private async executeSequential(
    agents: AgentInstance[],
    task: TaskWithInput
  ): Promise<any> {
    let currentOutput = task.input.prompt;
    for (const agent of agents) {
      currentOutput = await this.agentBusiness.executeTask(agent.id, currentOutput, task.input.metadata);
    }
    return currentOutput;
  }

  private async executeParallel(
    agents: AgentInstance[],
    task: TaskWithInput
  ): Promise<any[]> {
    const tasks = agents.map(agent => 
      this.agentBusiness.executeTask(agent.id, task.input.prompt, task.input.metadata)
    );

    const results = await Promise.all(tasks.map(t => t.catch(error => ({ error }))));
    return results.filter(result => !('error' in result));
  }

  private async executeHierarchical(
    agents: AgentInstance[],
    task: TaskWithInput
  ): Promise<any> {
    const [coordinator, ...workers] = agents;
    if (!coordinator) {
      throw new Error('No coordinator agent available');
    }

    // Coordinator creates subtasks
    const plan = await this.agentBusiness.executeTask(coordinator.id, task.input.prompt, {
      ...task.input.metadata,
      role: 'coordinator',
      workers: workers.length,
    });

    // Workers execute subtasks in parallel
    const results = await this.executeParallel(workers, {
      ...task,
      input: { ...task.input, prompt: JSON.stringify(plan) }
    });

    // Coordinator aggregates results
    return this.agentBusiness.executeTask(coordinator.id, JSON.stringify(results), {
      ...task.input.metadata,
      role: 'aggregator',
    });
  }

  private async executeMesh(
    agents: AgentInstance[],
    task: TaskWithInput
  ): Promise<any> {
    const maxIterations = this.getMaxConcurrency(task);
    let currentState = task.input.prompt;

    for (let i = 0; i < maxIterations; i++) {
      const results = await this.executeParallel(agents, {
        ...task,
        input: {
          ...task.input,
          prompt: currentState,
          metadata: {
            ...task.input.metadata,
            iteration: i,
            states: currentState,
          }
        }
      });

      // Aggregate results
      currentState = JSON.stringify(results);

      // Check if we've reached convergence
      if (results.every(r => r.converged)) {
        break;
      }
    }

    return currentState;
  }

  private getMaxConcurrency(task: TaskWithInput): number {
    const defaultConcurrency = 5;
    return task.input.metadata?.maxConcurrency || defaultConcurrency;
  }

  private async updateMetrics(swarm: SwarmInstance, success: boolean, duration: number): Promise<void> {
    const oldMetrics = swarm.metrics;
    const totalTasks = oldMetrics.totalTasks + 1;
    const successfulTasks = success ? oldMetrics.successfulTasks + 1 : oldMetrics.successfulTasks;
    const failedTasks = success ? oldMetrics.failedTasks : oldMetrics.failedTasks + 1;
    
    // Calculate new average response time
    const oldTotal = oldMetrics.averageResponseTime * (totalTasks - 1);
    const averageResponseTime = (oldTotal + duration) / totalTasks;

    const newMetrics = {
      ...oldMetrics,
      totalTasks,
      successfulTasks,
      failedTasks,
      averageResponseTime,
      lastExecutionTime: new Date().toISOString()
    };

    await swarm.update({ metrics: newMetrics } as Partial<SwarmAttributes>);
  }
}