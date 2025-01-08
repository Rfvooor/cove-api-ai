import { Agent, AgentConfig } from '../src/core/agent.js';
import { SwarmRouter, SwarmRouterConfig } from '../src/core/swarm-router.js';
import { CodeExecutor } from '../src/core/tools/code-executor.js';
import { WebSearchTool } from '../src/integrations/search/web-search.js';
import { config } from '../src/utils/config.js';
import { Task, TaskPriority } from '../src/core/task.js';

async function main() {
  try {
    // Create specialized agents for different optimization aspects
    const algorithmAgent = await Agent.create({
      name: 'AlgorithmAgent',
      description: 'Specializes in algorithmic optimization and complexity analysis',
      systemPrompt: `You are an expert in algorithm design and optimization.
        Focus on time and space complexity improvements.`,
      tools: [
        new CodeExecutor(config.getCodeExecutionConfig().workDir),
        new WebSearchTool(
          config.getSearchConfig().googleApiKey,
          config.getSearchConfig().searchEngineId
        )
      ]
    } as AgentConfig);

    const performanceAgent = await Agent.create({
      name: 'PerformanceAgent',
      description: 'Specializes in performance optimization and benchmarking',
      systemPrompt: `You are an expert in code performance optimization.
        Focus on runtime performance and resource usage.`,
      tools: [
        new CodeExecutor(config.getCodeExecutionConfig().workDir)
      ]
    } as AgentConfig);

    const refactoringAgent = await Agent.create({
      name: 'RefactoringAgent',
      description: 'Specializes in code refactoring and clean code principles',
      systemPrompt: `You are an expert in code refactoring and clean architecture.
        Focus on code quality and maintainability.`,
      tools: [
        new CodeExecutor(config.getCodeExecutionConfig().workDir)
      ]
    } as AgentConfig);

    // Create different types of swarms for comparison
    const collaborativeSwarm = new SwarmRouter({
      name: 'CollaborativeOptimizationSwarm',
      description: 'Optimizes code through collaborative problem-solving',
      agents: [algorithmAgent, performanceAgent, refactoringAgent],
      swarm_type: 'CollaborativeSolving',
      max_loops: 5,
      collaboration_threshold: 0.8
    });

    const capabilitySwarm = new SwarmRouter({
      name: 'CapabilityOptimizationSwarm',
      description: 'Optimizes code based on agent capabilities',
      agents: [algorithmAgent, performanceAgent, refactoringAgent],
      swarm_type: 'CapabilityBased',
      max_loops: 5
    });

    // Complex optimization task
    const optimizationTask = `
      Optimize the following graph algorithm implementation:
      
      function findShortestPath(graph, start, end) {
        const distances = {};
        const previous = {};
        const nodes = new Set();
        
        for (let vertex in graph) {
          distances[vertex] = Infinity;
          previous[vertex] = null;
          nodes.add(vertex);
        }
        distances[start] = 0;
        
        while (nodes.size > 0) {
          let minNode = null;
          for (let node of nodes) {
            if (minNode === null || distances[node] < distances[minNode]) {
              minNode = node;
            }
          }
          
          if (minNode === end) break;
          
          nodes.delete(minNode);
          
          for (let neighbor in graph[minNode]) {
            let alt = distances[minNode] + graph[minNode][neighbor];
            if (alt < distances[neighbor]) {
              distances[neighbor] = alt;
              previous[neighbor] = minNode;
            }
          }
        }
        
        return { distances, previous };
      }

      Goals:
      1. Improve algorithmic efficiency
      2. Optimize performance for large graphs
      3. Enhance code readability and maintainability
      4. Add proper error handling and validation
      5. Implement comprehensive testing
    `;

    // Compare different swarm approaches
    console.log('Starting collaborative optimization...');
    const collaborativeResult = await collaborativeSwarm.run(optimizationTask);
    
    console.log('Starting capability-based optimization...');
    const capabilityResult = await capabilitySwarm.run(optimizationTask);

    // Analyze and compare results
    const analysisTask = new Task({
      name: 'Compare Optimization Approaches',
      description: 'Analyze and compare the results from different swarm approaches',
      priority: TaskPriority.HIGH,
      metadata: {
        collaborativeResult,
        capabilityResult
      }
    });

    const analysisAgent = await Agent.create({
      name: 'AnalysisAgent',
      description: 'Specializes in comparing and analyzing optimization results',
      systemPrompt: 'You are an expert at analyzing and comparing code optimizations.',
      tools: [new CodeExecutor(config.getCodeExecutionConfig().workDir)]
    } as AgentConfig);

    const analysis = await analysisAgent.execute(analysisTask);

    // Output results
    console.log('\nCollaborative Swarm Result:');
    console.log(collaborativeResult);
    
    console.log('\nCapability-Based Swarm Result:');
    console.log(capabilityResult);
    
    console.log('\nAnalysis:');
    console.log(analysis.output);

    // Get execution metrics
    console.log('\nCollaborative Swarm Metrics:');
    console.log('Execution Logs:', collaborativeSwarm.get_logs());
    
    console.log('\nCapability Swarm Metrics:');
    console.log('Execution Logs:', capabilitySwarm.get_logs());

  } catch (error) {
    console.error('Error in swarm optimization example:', error);
    process.exit(1);
  }
}

// Run the example
main().catch(console.error);