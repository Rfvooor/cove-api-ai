/**
 * Example demonstrating the new workflow standards including:
 * - Node templates for different operations
 * - Swarm-based task execution
 * - Agent specialization and collaboration
 * - Memory management
 * - Error handling and retries
 */

import { Agent, AgentConfig } from '../src/core/agent.js';
import { SwarmRouter } from '../src/core/swarm-router.js';
import { Task } from '../src/core/task.js';
import { createLanguageModel } from '../src/integrations/language-models/index.js';
import { FileProcessor } from '../src/core/tools/file-processor.js';
import { WebSearchTool } from '../src/integrations/search/web-search.js';
import { CodeExecutor } from '../src/core/tools/code-executor.js';
import { config } from '../src/utils/config.js';

// Memory configuration
const memoryConfig = {
  maxShortTermItems: 1000,
  maxTokenSize: 4096,
  autoArchive: true,
  archiveThreshold: 0.8,
  indexStrategy: 'semantic' as const,
  compressionEnabled: false,
  deduplicationEnabled: true
};

// Language model configuration
const languageModelConfig = {
  provider: 'openai' as const,
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 1000,
  apiKey: process.env.OPENAI_API_KEY || ''
};

async function main() {
  try {
    // Create specialized agents using node templates
    const dataAgent = await Agent.create({
      name: 'DataProcessor',
      description: 'Specializes in data processing and analysis',
      systemPrompt: `You are an expert in data processing and analysis.
        Focus on extracting insights from complex datasets.`,
      tools: [new FileProcessor()],
      languageModel: createLanguageModel('openai', languageModelConfig),
      memoryConfig
    });

    const researchAgent = await Agent.create({
      name: 'Researcher',
      description: 'Specializes in information gathering and research',
      systemPrompt: `You are an expert researcher.
        Focus on finding and validating information from multiple sources.`,
      tools: [new WebSearchTool(
        config.getSearchConfig().googleApiKey,
        config.getSearchConfig().searchEngineId
      )],
      languageModel: createLanguageModel('openai', languageModelConfig),
      memoryConfig
    });

    const codeAgent = await Agent.create({
      name: 'CodeExecutor',
      description: 'Specializes in code execution and testing',
      systemPrompt: `You are an expert in code execution and testing.
        Focus on running code safely and analyzing results.`,
      tools: [new CodeExecutor(config.getCodeExecutionConfig().workDir)],
      languageModel: createLanguageModel('openai', languageModelConfig),
      memoryConfig
    });

    // Create swarm with specialized agents
    const swarm = new SwarmRouter({
      name: 'WorkflowSwarm',
      description: 'A swarm demonstrating the new workflow standards',
      agents: [dataAgent, researchAgent, codeAgent],
      swarm_type: 'CollaborativeSolving',
      max_loops: 3,
      collaboration_threshold: 0.7
    });

    // Example task: Process data, research findings, and generate code
    console.log('Starting workflow demonstration...');

    const sampleData = `
      Project Analysis:
      - Revenue: $1.2M
      - Growth Rate: 15%
      - Customer Count: 5,000
      - Satisfaction: 4.5/5
      
      Competitor Analysis:
      - Market Share: 25%
      - Growth Rate: 12%
      
      Technical Requirements:
      1. Process and validate data
      2. Research industry benchmarks
      3. Generate analysis code
      4. Visualize results
    `;

    // Execute workflow using swarm
    console.log('\nExecuting data processing workflow...');
    const result = await swarm.run(
      `Process and analyze the following data:
      ${sampleData}
      
      Requirements:
      1. Extract and validate numerical data
      2. Research industry averages
      3. Generate analysis code
      4. Create visualizations`,
      ['data-processing', 'market-research', 'code-generation']
    );

    console.log('\nWorkflow Result:', result);

    // Example of individual agent tasks
    console.log('\nExecuting specialized agent tasks...');

    // Data processing task
    const dataTask = new Task({
      type: 'agent',
      executorId: dataAgent.id,
      input: {
        name: 'Process Project Data',
        description: 'Extract and validate numerical data from project analysis',
        prompt: 'Extract and validate all numerical metrics from the project data',
        data: { content: sampleData }
      }
    });

    // Research task
    const researchTask = new Task({
      type: 'agent',
      executorId: researchAgent.id,
      input: {
        name: 'Research Industry Benchmarks',
        description: 'Find industry average metrics for comparison',
        prompt: 'Research industry average metrics for revenue growth and customer satisfaction',
        data: { sector: 'technology', metrics: ['growth_rate', 'satisfaction'] }
      }
    });

    // Code generation task
    const codeTask = new Task({
      type: 'agent',
      executorId: codeAgent.id,
      input: {
        name: 'Generate Analysis Code',
        description: 'Create code to analyze and visualize the data',
        prompt: 'Generate Python code to analyze and visualize the project metrics',
        data: { 
          metrics: ['revenue', 'growth_rate', 'customer_count', 'satisfaction'],
          visualization: 'comparison_chart'
        }
      }
    });

    // Execute individual tasks
    const [dataResult, researchResult, codeResult] = await Promise.all([
      dataAgent.execute(dataTask),
      researchAgent.execute(researchTask),
      codeAgent.execute(codeTask)
    ]);

    console.log('\nSpecialized Task Results:');
    console.log('Data Processing:', dataResult);
    console.log('Market Research:', researchResult);
    console.log('Code Generation:', codeResult);

    // Example of error handling
    try {
      const invalidTask = new Task({
        type: 'agent',
        executorId: dataAgent.id,
        input: {
          name: 'Invalid Task',
          description: 'This task should fail',
          prompt: 'Process invalid data',
          data: null
        }
      });

      await dataAgent.execute(invalidTask);
    } catch (error) {
      console.log('\nError Handling Example:');
      if (error instanceof Error) {
        console.log('Task failed as expected:', error.message);
      } else {
        console.log('Task failed with unknown error:', error);
      }
    }

    // Cleanup
    console.log('\nCleaning up resources...');
    await Promise.all([
      dataAgent.cleanup(),
      researchAgent.cleanup(),
      codeAgent.cleanup()
    ]);

    console.log('\nWorkflow demonstration completed successfully!');

  } catch (error) {
    console.error('Error in workflow demonstration:', error);
    process.exit(1);
  }
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}