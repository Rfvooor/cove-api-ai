/**
 * Example demonstrating a simple static workflow pattern
 * This shows a basic linear workflow with predefined steps
 */

import { Agent } from '../src/core/agent.js';
import { Task } from '../src/core/task.js';
import { createLanguageModel } from '../src/integrations/language-models/index.js';
import { FileProcessor } from '../src/core/tools/file-processor.js';

// Basic memory configuration
const memoryConfig = {
  maxShortTermItems: 100,
  maxTokenSize: 2048,
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
    // Create a single agent for the workflow
    const workflowAgent = await Agent.create({
      name: 'StaticWorkflowAgent',
      description: 'Handles a predefined sequence of data processing steps',
      systemPrompt: `You are an agent that processes data through predefined steps.
        Follow each step carefully and maintain data consistency.`,
      tools: [new FileProcessor()],
      languageModel: createLanguageModel('openai', languageModelConfig),
      memoryConfig
    });

    // Sample data to process
    const inputData = {
      customer: {
        name: 'Acme Corp',
        industry: 'Technology',
        data: [
          { month: 'Jan', revenue: 100000 },
          { month: 'Feb', revenue: 120000 },
          { month: 'Mar', revenue: 150000 }
        ]
      }
    };

    // Step 1: Data Validation
    console.log('Step 1: Validating input data...');
    const validationTask = new Task({
      type: 'agent',
      executorId: workflowAgent.id,
      input: {
        name: 'Validate Input Data',
        description: 'Check data structure and values',
        prompt: 'Validate the input data structure and ensure all required fields are present',
        data: inputData
      }
    });
    const validationResult = await workflowAgent.execute(validationTask);
    console.log('Validation complete:', validationResult);

    // Step 2: Data Processing
    console.log('\nStep 2: Processing data...');
    const processingTask = new Task({
      type: 'agent',
      executorId: workflowAgent.id,
      input: {
        name: 'Process Data',
        description: 'Calculate key metrics',
        prompt: 'Calculate total revenue and growth rate',
        data: validationResult
      }
    });
    const processingResult = await workflowAgent.execute(processingTask);
    console.log('Processing complete:', processingResult);

    // Step 3: Report Generation
    console.log('\nStep 3: Generating report...');
    const reportTask = new Task({
      type: 'agent',
      executorId: workflowAgent.id,
      input: {
        name: 'Generate Report',
        description: 'Create summary report',
        prompt: 'Generate a summary report with key findings',
        data: processingResult
      }
    });
    const reportResult = await workflowAgent.execute(reportTask);
    console.log('Report generated:', reportResult);

    // Cleanup
    console.log('\nCleaning up...');
    await workflowAgent.cleanup();
    
    console.log('\nStatic workflow completed successfully!');
    return reportResult;

  } catch (error) {
    console.error('Error in static workflow:', error);
    process.exit(1);
  }
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}