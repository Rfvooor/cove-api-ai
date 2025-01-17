/**
 * Example demonstrating a dynamic workflow pattern
 * Shows how workflows can adapt and branch based on conditions and data
 */

import { Agent } from '../src/core/agent.js';
import { Task } from '../src/core/task.js';
import { createLanguageModel } from '../src/integrations/language-models/index.js';
import { FileProcessor } from '../src/core/tools/file-processor.js';
import { WebScraper } from '../src/utils/web-scraper.js';
import { MathTool } from '../src/core/tools/math.js';

// Memory configuration
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

// Dynamic workflow decision function
async function determineNextStep(data: any): Promise<string> {
  if (!data || typeof data !== 'object') {
    return 'error_handling';
  }

  if (data.requiresResearch) {
    return 'research';
  }

  if (data.type === 'numerical' && data.values?.length > 0) {
    return 'calculation';
  }

  if (data.type === 'text' && data.content) {
    return 'analysis';
  }

  return 'default_processing';
}

async function main() {
  try {
    // Create an adaptive agent
    const adaptiveAgent = await Agent.create({
      name: 'DynamicWorkflowAgent',
      description: 'Handles workflows that adapt based on data and conditions',
      systemPrompt: `You are an agent that processes data through dynamic workflows.
        Adapt your approach based on the data type and requirements.`,
      tools: [new FileProcessor(), new WebScraper(), MathTool.getInstance()],
      languageModel: createLanguageModel('openai', languageModelConfig),
      memoryConfig
    });

    // Sample input data cases
    const inputDataSet = [
      {
        type: 'numerical',
        values: [10, 20, 30, 40, 50],
        requiresAnalysis: true
      },
      {
        type: 'text',
        content: 'Market analysis report for Q4 2024',
        requiresResearch: true
      },
      {
        type: 'mixed',
        data: {
          metrics: [1, 2, 3],
          notes: 'Quarterly performance'
        }
      }
    ];

    // Process each data case through dynamic workflow
    for (const inputData of inputDataSet) {
      console.log('\nProcessing new data case:', inputData.type);
      
      // Initial data assessment
      console.log('Performing initial assessment...');
      const assessmentTask = new Task({
        type: 'agent',
        executorId: adaptiveAgent.id,
        input: {
          name: 'Assess Data',
          description: 'Evaluate input data characteristics',
          prompt: 'Analyze the input data and determine processing requirements',
          data: inputData
        }
      });
      const assessment = await adaptiveAgent.execute(assessmentTask);
      
      // Determine workflow path
      const nextStep = await determineNextStep(assessment);
      console.log('Determined next step:', nextStep);

      // Dynamic workflow branching
      let result;
      switch (nextStep) {
        case 'research':
          console.log('Executing research workflow...');
          const researchTask = new Task({
            type: 'agent',
            executorId: adaptiveAgent.id,
            input: {
              name: 'Research',
              description: 'Gather additional information',
              prompt: 'Research and collect relevant information based on the input',
              data: assessment
            }
          });
          result = await adaptiveAgent.execute(researchTask);
          break;

        case 'calculation':
          console.log('Executing calculation workflow...');
          const calculationTask = new Task({
            type: 'agent',
            executorId: adaptiveAgent.id,
            input: {
              name: 'Calculate',
              description: 'Perform numerical analysis',
              prompt: 'Calculate relevant metrics and statistics',
              data: assessment
            }
          });
          result = await adaptiveAgent.execute(calculationTask);
          break;

        case 'analysis':
          console.log('Executing analysis workflow...');
          const analysisTask = new Task({
            type: 'agent',
            executorId: adaptiveAgent.id,
            input: {
              name: 'Analyze',
              description: 'Perform text analysis',
              prompt: 'Analyze text content and extract insights',
              data: assessment
            }
          });
          result = await adaptiveAgent.execute(analysisTask);
          break;

        case 'error_handling':
          console.log('Executing error handling workflow...');
          const errorTask = new Task({
            type: 'agent',
            executorId: adaptiveAgent.id,
            input: {
              name: 'Handle Error',
              description: 'Process error case',
              prompt: 'Handle invalid or problematic input data',
              data: assessment
            }
          });
          result = await adaptiveAgent.execute(errorTask);
          break;

        default:
          console.log('Executing default workflow...');
          const defaultTask = new Task({
            type: 'agent',
            executorId: adaptiveAgent.id,
            input: {
              name: 'Process',
              description: 'Default processing',
              prompt: 'Process input data using standard approach',
              data: assessment
            }
          });
          result = await adaptiveAgent.execute(defaultTask);
      }

      // Final processing
      console.log('Performing final processing...');
      const finalTask = new Task({
        type: 'agent',
        executorId: adaptiveAgent.id,
        input: {
          name: 'Finalize',
          description: 'Complete processing workflow',
          prompt: 'Finalize results and prepare output',
          data: {
            original: inputData,
            assessment,
            result
          }
        }
      });
      const finalResult = await adaptiveAgent.execute(finalTask);
      console.log('Processing complete:', finalResult);
    }

    // Cleanup
    console.log('\nCleaning up...');
    await adaptiveAgent.cleanup();
    
    console.log('\nDynamic workflow completed successfully!');

  } catch (error) {
    console.error('Error in dynamic workflow:', error);
    process.exit(1);
  }
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}