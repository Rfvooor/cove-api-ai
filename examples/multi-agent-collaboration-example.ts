/**
 * Example demonstrating collaboration between multiple specialized agents
 * Shows how different agents can work together on a complex task
 */

import { Agent } from '../src/core/agent.js';
import { Task } from '../src/core/task.js';
import { createLanguageModel } from '../src/integrations/language-models/index.js';
import { FileProcessor } from '../src/core/tools/file-processor.js';
import { WebScraper } from '../src/utils/web-scraper.js';
import { SentimentAnalyzer } from '../src/utils/sentiment-analyzer.js';

// Shared memory configuration
const baseMemoryConfig = {
  maxShortTermItems: 100,
  maxTokenSize: 2048,
  autoArchive: true,
  archiveThreshold: 0.8,
  indexStrategy: 'semantic' as const,
  compressionEnabled: false,
  deduplicationEnabled: true
};

// Shared language model configuration
const baseLLMConfig = {
  provider: 'openai' as const,
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 1000,
  apiKey: process.env.OPENAI_API_KEY || ''
};

async function main() {
  try {
    // Create specialized agents
    const researchAgent = await Agent.create({
      name: 'ResearchAgent',
      description: 'Specializes in gathering and organizing information',
      systemPrompt: `You are a research specialist focused on gathering accurate information.
        Analyze sources thoroughly and extract relevant details.`,
      tools: [new WebScraper()],
      languageModel: createLanguageModel('openai', {
        ...baseLLMConfig,
        temperature: 0.3 // Lower temperature for more focused research
      }),
      memoryConfig: {
        ...baseMemoryConfig,
        maxShortTermItems: 150 // Increased for research context
      }
    });

    const analysisAgent = await Agent.create({
      name: 'AnalysisAgent',
      description: 'Specializes in data analysis and insights',
      systemPrompt: `You are an analysis expert focused on finding patterns and insights.
        Process data carefully and draw meaningful conclusions.`,
      tools: [new SentimentAnalyzer()],
      languageModel: createLanguageModel('openai', {
        ...baseLLMConfig,
        temperature: 0.5 // Balanced for analysis
      }),
      memoryConfig: baseMemoryConfig
    });

    const reportingAgent = await Agent.create({
      name: 'ReportingAgent',
      description: 'Specializes in creating clear reports and summaries',
      systemPrompt: `You are a reporting specialist focused on clear communication.
        Create well-structured reports that effectively convey information.`,
      tools: [new FileProcessor()],
      languageModel: createLanguageModel('openai', {
        ...baseLLMConfig,
        temperature: 0.7 // Higher for creative reporting
      }),
      memoryConfig: baseMemoryConfig
    });

    // Sample research topic
    const topic = {
      subject: 'Electric Vehicles Market Trends',
      aspects: ['consumer adoption', 'technology advances', 'market growth'],
      timeframe: 'last 2 years'
    };

    // Step 1: Research Phase
    console.log('Step 1: Gathering research data...');
    const researchTask = new Task({
      type: 'agent',
      executorId: researchAgent.id,
      input: {
        name: 'Gather Market Research',
        description: 'Collect relevant market data and trends',
        prompt: 'Research current trends and developments in the electric vehicles market',
        data: topic
      }
    });
    const researchData = await researchAgent.execute(researchTask);
    console.log('Research gathered:', researchData);

    // Step 2: Analysis Phase
    console.log('\nStep 2: Analyzing research data...');
    const analysisTask = new Task({
      type: 'agent',
      executorId: analysisAgent.id,
      input: {
        name: 'Analyze Market Data',
        description: 'Process and analyze research findings',
        prompt: 'Analyze the research data to identify key trends and insights',
        data: researchData
      }
    });
    const analysisResults = await analysisAgent.execute(analysisTask);
    console.log('Analysis complete:', analysisResults);

    // Step 3: Collaborative Insight Generation
    console.log('\nStep 3: Generating collaborative insights...');
    const collaborativeTask = new Task({
      type: 'agent',
      executorId: analysisAgent.id,
      input: {
        name: 'Generate Insights',
        description: 'Combine research and analysis',
        prompt: 'Generate comprehensive insights by combining research data with analysis',
        data: {
          research: researchData,
          analysis: analysisResults
        }
      }
    });
    const insights = await analysisAgent.execute(collaborativeTask);

    // Step 4: Report Generation
    console.log('\nStep 4: Creating final report...');
    const reportTask = new Task({
      type: 'agent',
      executorId: reportingAgent.id,
      input: {
        name: 'Generate Report',
        description: 'Create comprehensive report',
        prompt: 'Create a detailed report incorporating all findings and insights',
        data: {
          topic,
          research: researchData,
          analysis: analysisResults,
          insights
        }
      }
    });
    const finalReport = await reportingAgent.execute(reportTask);
    console.log('Final report generated:', finalReport);

    // Cleanup
    console.log('\nCleaning up...');
    await Promise.all([
      researchAgent.cleanup(),
      analysisAgent.cleanup(),
      reportingAgent.cleanup()
    ]);

    console.log('\nMulti-agent collaboration completed successfully!');
    return finalReport;

  } catch (error) {
    console.error('Error in multi-agent workflow:', error);
    process.exit(1);
  }
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}