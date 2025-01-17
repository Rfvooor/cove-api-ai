import { PlanningAgent, PlanningAgentConfig } from '../src/core/planning-agent.js';
import { BaseLanguageModel } from '../src/core/base-language-model.js';
import { Task } from '../src/core/task.js';
import { Agent, AgentConfig } from '../src/core/agent.js';
import { OpenAIIntegration } from '../src/integrations/language-models/openai.js';

async function createAgentWithCapabilities(config: AgentConfig): Promise<Agent> {
  return await Agent.create({
    ...config,
    languageModel: new OpenAIIntegration({
      apiKey: process.env.OPENAI_API_KEY || '',
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 1000
    })
  });
}

async function demonstratePlanningAgent() {
  // Create base agents
  const dataProcessor = await createAgentWithCapabilities({
    name: 'DataProcessor',
    description: 'Specialized in data processing and analysis',
    systemPrompt: 'You are an expert in data processing and analysis.'
  });

  const modelTrainer = await createAgentWithCapabilities({
    name: 'ModelTrainer',
    description: 'Specialized in machine learning and optimization',
    systemPrompt: 'You are an expert in machine learning model training and optimization.'
  });

  const orchestrator = await createAgentWithCapabilities({
    name: 'Orchestrator',
    description: 'Specialized in task coordination and scheduling',
    systemPrompt: 'You are an expert in coordinating complex tasks and scheduling.'
  });

  // Create planning agent configuration
  const config: PlanningAgentConfig = {
    name: 'SwarmPlanner',
    description: 'Specialized agent for swarm orchestration and planning',
    planningStrategies: {
      defaultStrategy: 'sequential',
      adaptiveReplanning: true,
      maxPlanningDepth: 5,
      optimizationThreshold: 0.8
    },
    orchestrationRules: {
      agentSelectionCriteria: ['capability', 'performance', 'availability'],
      loadBalancingThreshold: 0.7,
      collaborationTriggers: ['complexity', 'interdependency', 'specialization'],
      failoverStrategies: ['retry', 'reassign', 'decompose']
    },
    swarmConfig: {
      name: 'DataProcessingSwarm',
      description: 'A swarm specialized in data processing and model training',
      agents: [dataProcessor, modelTrainer, orchestrator],
      swarm_type: 'CapabilityBased',
      planning_mode: 'JIT',
      max_loops: 10,
      collaboration_threshold: 0.7,
      timeout: 30000,
      steps_per_plan: 3,
      retryConfig: {
        maxAttempts: 3,
        backoffMultiplier: 1.5,
        initialDelay: 1000,
        maxDelay: 30000
      }
    }
  };

  try {
    // Create planning agent
    console.log('Creating planning agent...');
    const planningAgent = await PlanningAgent.create(config);

    // Create a sample task
    const task = new Task({
      type: 'agent',
      executorId: planningAgent.getAgent().id,
      input: {
        name: 'Process and analyze dataset',
        description: 'Load dataset, preprocess it, train model, and evaluate results',
        prompt: 'Orchestrate data processing and model training pipeline'
      }
    });

    // Generate execution plan
    console.log('\nGenerating execution plan...');
    const plan = await planningAgent.plan(task);
    console.log('Generated Plan:', plan);

    // Execute the task
    console.log('\nExecuting task...');
    const result = await planningAgent.execute(task);
    console.log('Execution Result:', result);

    // Get planning metrics
    console.log('\nPlanning Metrics:');
    const metrics = planningAgent.getPlanningMetrics();
    console.log(metrics);

    // Get plan history
    console.log('\nPlan History:');
    const history = planningAgent.getPlanHistory(task.id);
    console.log(history);

  } catch (error) {
    console.error('Error in planning agent demonstration:', error);
  }
}

// Run the demonstration
if (require.main === module) {
  demonstratePlanningAgent().catch(console.error);
}