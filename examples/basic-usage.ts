/**
 * Basic usage example for the Cove API AI framework
 * Demonstrates core functionality including:
 * - Creating and configuring agents
 * - Using different language model integrations
 * - Task orchestration
 * - Swarm routing
 */

import { 
  createAgent, 
  createOpenrouterIntegration, 
  createOrchestrator, 
  createSwarmRouter, 
  Task,
  type SwarmConfig
} from '../src/index.js';

async function main() {
  try {
    // Check for required API key
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY environment variable is required');
    }

    // Create OpenRouter integration
    const openrouter = createOpenrouterIntegration({
      apiKey,
      model: 'gpt-3.5-turbo',
      temperature: 0.7
    });

    // Create language model configurations
    const analyzerConfig = {
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      provider: 'openrouter' as const
    };

    const researchConfig = {
      model: 'gpt-3.5-turbo',
      temperature: 0.5,
      provider: 'openrouter' as const
    };

    const writerConfig = {
      model: 'gpt-3.5-turbo',
      temperature: 0.8,
      provider: 'openrouter' as const
    };

    // Create agents with appropriate configurations
    const primaryAgent = await createAgent({
      name: 'primary-agent',
      systemPrompt: 'You are a helpful AI assistant specialized in task analysis and planning.',
      maxLoops: 3,
      languageModelConfig: analyzerConfig
    });

    // Create supporting agents
    const researchAgent = await createAgent({
      name: 'research-agent',
      systemPrompt: 'You are an AI assistant specialized in research and information gathering.',
      maxLoops: 5,
      languageModelConfig: researchConfig
    });

    const writingAgent = await createAgent({
      name: 'writing-agent',
      systemPrompt: 'You are an AI assistant specialized in writing and content creation.',
      maxLoops: 4,
      languageModelConfig: writerConfig
    });

    // Configure swarm settings
    const swarmConfig: SwarmConfig = {
      enabled: true,
      minAgents: 2,
      maxAgents: 5,
      scaleUpThreshold: 0.8,
      scaleDownThreshold: 0.2,
      loadBalancingStrategy: 'capability-based'
    };

    // Create an orchestrator
    const orchestrator = createOrchestrator({
      agents: [primaryAgent, researchAgent, writingAgent],
      maxConcurrentTasks: 3,
      swarmConfig
    });

    // Create a swarm router
    const swarmRouter = createSwarmRouter({
      agents: [primaryAgent, researchAgent, writingAgent],
      swarm_type: 'CollaborativeSolving',
      collaboration_threshold: 0.7
    });

    // Example task: Content creation with research
    const task = new Task({
      name: 'healthcare-ai-article',
      description: 'Research and write a comprehensive article about artificial intelligence in healthcare',
      priority: 1,
      metadata: {
        type: 'content_creation',
        requiredCapabilities: ['research', 'writing'],
        expectedLength: 'medium',
        audience: 'technical'
      }
    });

    // Execute task using orchestrator
    console.log('Executing task using orchestrator...');
    const orchestratorResult = await orchestrator.addTask(task);
    console.log('Orchestrator result:', orchestratorResult);

    // Execute same task using swarm router
    console.log('\nExecuting task using swarm router...');
    const swarmResult = await swarmRouter.run(task.description || ''); // Provide empty string fallback
    console.log('Swarm router result:', swarmResult);

  } catch (error) {
    console.error('Error in example:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}