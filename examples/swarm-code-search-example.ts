import { Agent, AgentConfig } from '../src/core/agent.js';
import { SwarmRouter, SwarmRouterConfig } from '../src/core/swarm-router.js';
import { CodeExecutor } from '../src/core/tools/code-executor.js';
import { WebSearchTool } from '../src/integrations/search/web-search.js';
import { config } from '../src/utils/config.js';
import { Task } from '../src/core/task.js';

async function main() {
  try {
    // Create specialized agents for different aspects of the task
    const searchAgent = await Agent.create({
      name: 'SearchAgent',
      description: 'Specializes in finding relevant code examples and documentation',
      systemPrompt: 'You are an expert at finding and analyzing code examples.',
      tools: [
        new WebSearchTool(
          config.getSearchConfig().googleApiKey,
          config.getSearchConfig().searchEngineId
        )
      ]
    } as AgentConfig);

    const codeExecutionAgent = await Agent.create({
      name: 'CodeExecutionAgent',
      description: 'Specializes in executing and testing code',
      systemPrompt: 'You are an expert at running and testing code safely.',
      tools: [
        new CodeExecutor(config.getCodeExecutionConfig().workDir)
      ]
    } as AgentConfig);

    const codeAnalysisAgent = await Agent.create({
      name: 'CodeAnalysisAgent',
      description: 'Specializes in analyzing and optimizing code',
      systemPrompt: 'You are an expert at analyzing and improving code quality.',
      tools: [
        new CodeExecutor(config.getCodeExecutionConfig().workDir),
        new WebSearchTool(
          config.getSearchConfig().googleApiKey,
          config.getSearchConfig().searchEngineId
        )
      ]
    } as AgentConfig);

    // Create a swarm with the specialized agents
    const swarm = new SwarmRouter({
      name: 'CodeSwarm',
      description: 'A swarm of agents specialized in code-related tasks',
      agents: [searchAgent, codeExecutionAgent, codeAnalysisAgent],
      swarm_type: 'CollaborativeSolving',
      max_loops: 5,
      collaboration_threshold: 0.7
    });

    // Example task: Implement and optimize a sorting algorithm
    const result = await swarm.run(`
      Find an efficient sorting algorithm implementation,
      test it with various inputs, and optimize its performance.
      Provide the final optimized implementation with benchmarks.
    `);

    console.log('Task completed with result:', result);

    // Example task: Create a data processing pipeline
    const pipelineResult = await swarm.run(`
      Create a data processing pipeline that:
      1. Reads a CSV file
      2. Performs data cleaning and transformation
      3. Calculates basic statistics
      4. Outputs results in JSON format
      Test the pipeline with sample data and optimize for large datasets.
    `);

    console.log('Pipeline task completed with result:', pipelineResult);

    // Example of using different swarm types
    const sequentialSwarm = new SwarmRouter({
      name: 'SequentialCodeSwarm',
      description: 'A swarm that processes code tasks sequentially',
      agents: [searchAgent, codeExecutionAgent, codeAnalysisAgent],
      swarm_type: 'SequentialWorkflow'
    });

    const capabilitySwarm = new SwarmRouter({
      name: 'CapabilityCodeSwarm',
      description: 'A swarm that assigns tasks based on agent capabilities',
      agents: [searchAgent, codeExecutionAgent, codeAnalysisAgent],
      swarm_type: 'CapabilityBased'
    });

    // Compare different swarm approaches
    const implementations = await Promise.all([
      swarm.run('Implement a binary search tree with basic operations'),
      sequentialSwarm.run('Implement a binary search tree with basic operations'),
      capabilitySwarm.run('Implement a binary search tree with basic operations')
    ]);

    console.log('Collaborative Implementation:', implementations[0]);
    console.log('Sequential Implementation:', implementations[1]);
    console.log('Capability-Based Implementation:', implementations[2]);

    // Example of dynamic agent addition
    const optimizationAgent = await Agent.create({
      name: 'OptimizationAgent',
      description: 'Specializes in code optimization techniques',
      systemPrompt: 'You are an expert at optimizing code performance.',
      tools: [new CodeExecutor(config.getCodeExecutionConfig().workDir)]
    } as AgentConfig);

    swarm.addAgent(optimizationAgent);

    // Run optimization task with the new agent
    const optimizationResult = await swarm.run(`
      Optimize the previously implemented binary search tree
      for better performance and memory usage.
      Provide benchmarks comparing the original and optimized versions.
    `);

    console.log('Optimization task completed with result:', optimizationResult);

    // Get execution logs and metrics
    const executionLogs = swarm.get_logs();
    console.log('Execution logs:', executionLogs);

  } catch (error) {
    console.error('Error in swarm code search example:', error);
    process.exit(1);
  }
}

// Run the example
main().catch(console.error);