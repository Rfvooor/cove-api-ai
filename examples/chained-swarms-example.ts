import { Agent, AgentConfig } from '../src/core/agent.js';
import { SwarmRouter, SwarmRouterConfig } from '../src/core/swarm-router.js';
import { CodeExecutor } from '../src/core/tools/code-executor.js';
import { FileProcessor } from '../src/core/tools/file-processor.js';
import { config } from '../src/utils/config.js';
import { Task } from '../src/core/task.js';

async function main() {
  try {
    // Create agents for the data extraction swarm
    const textAnalysisAgent = await Agent.create({
      name: 'TextAnalysisAgent',
      description: 'Specializes in natural language processing and text analysis',
      systemPrompt: `You are an expert in text analysis and information extraction.
        Focus on identifying key data points and patterns in text.`,
      tools: [new FileProcessor()]
    } as AgentConfig);

    const structuringAgent = await Agent.create({
      name: 'StructuringAgent',
      description: 'Specializes in organizing extracted information into structured formats',
      systemPrompt: `You are an expert in data structuring and organization.
        Focus on creating well-organized JSON structures from extracted information.`,
      tools: [new FileProcessor()]
    } as AgentConfig);

    const validationAgent = await Agent.create({
      name: 'ValidationAgent',
      description: 'Specializes in validating extracted data',
      systemPrompt: `You are an expert in data validation and quality assurance.
        Focus on ensuring data completeness and accuracy.`,
      tools: [new FileProcessor()]
    } as AgentConfig);

    // Create agents for the analysis swarm
    const dataAnalysisAgent = await Agent.create({
      name: 'DataAnalysisAgent',
      description: 'Specializes in data analysis and pattern recognition',
      systemPrompt: `You are an expert in data analysis and statistical interpretation.
        Focus on identifying trends and patterns in structured data.`,
      tools: [new CodeExecutor(config.getCodeExecutionConfig().workDir)]
    } as AgentConfig);

    const visualizationAgent = await Agent.create({
      name: 'VisualizationAgent',
      description: 'Specializes in data visualization',
      systemPrompt: `You are an expert in data visualization and chart creation.
        Focus on creating clear and informative visualizations.`,
      tools: [new CodeExecutor(config.getCodeExecutionConfig().workDir)]
    } as AgentConfig);

    const insightAgent = await Agent.create({
      name: 'InsightAgent',
      description: 'Specializes in generating insights from analysis',
      systemPrompt: `You are an expert in interpreting data analysis results.
        Focus on extracting meaningful insights and recommendations.`,
      tools: [new CodeExecutor(config.getCodeExecutionConfig().workDir)]
    } as AgentConfig);

    // Create the data extraction swarm
    const extractionSwarm = new SwarmRouter({
      name: 'DataExtractionSwarm',
      description: 'Extracts and structures data from raw text',
      agents: [textAnalysisAgent, structuringAgent, validationAgent],
      swarm_type: 'CollaborativeSolving',
      max_loops: 3,
      collaboration_threshold: 0.8
    });

    // Create the analysis swarm
    const analysisSwarm = new SwarmRouter({
      name: 'DataAnalysisSwarm',
      description: 'Analyzes structured data and generates insights',
      agents: [dataAnalysisAgent, visualizationAgent, insightAgent],
      swarm_type: 'CollaborativeSolving',
      max_loops: 3,
      collaboration_threshold: 0.8
    });

    // Sample raw text data for processing
    const rawData = `
      Monthly Sales Report - Q4 2024
      
      October:
      - Product A: 1,250 units, Revenue: $125,000
      - Product B: 800 units, Revenue: $160,000
      - Product C: 600 units, Revenue: $90,000
      
      November:
      - Product A: 1,400 units, Revenue: $140,000
      - Product B: 850 units, Revenue: $170,000
      - Product C: 700 units, Revenue: $105,000
      
      December:
      - Product A: 1,600 units, Revenue: $160,000
      - Product B: 900 units, Revenue: $180,000
      - Product C: 750 units, Revenue: $112,500
      
      Customer feedback average:
      - Product A: 4.5/5
      - Product B: 4.3/5
      - Product C: 4.7/5
    `;

    // First swarm: Extract and structure the data
    console.log('Starting data extraction...');
    const structuredData = await extractionSwarm.run(`
      Extract and structure the following sales report data into a JSON format:
      ${rawData}
      
      Requirements:
      1. Organize by month
      2. Include both unit sales and revenue
      3. Include customer feedback scores
      4. Ensure numerical values are properly formatted
    `);

    console.log('\nExtracted and structured data:');
    console.log(JSON.stringify(structuredData, null, 2));

    // Second swarm: Analyze the structured data
    console.log('\nStarting data analysis...');
    const analysisResult = await analysisSwarm.run(`
      Analyze the following structured sales data and generate insights:
      ${JSON.stringify(structuredData)}
      
      Requirements:
      1. Calculate month-over-month growth rates
      2. Identify best and worst performing products
      3. Generate visualizations for:
         - Monthly revenue trends
         - Product performance comparison
         - Customer satisfaction correlation with sales
      4. Provide strategic recommendations
    `);

    console.log('\nAnalysis Results:');
    console.log(analysisResult);

    // Output execution metrics
    console.log('\nExtraction Swarm Metrics:');
    console.log('Execution Logs:', extractionSwarm.get_logs());
    
    console.log('\nAnalysis Swarm Metrics:');
    console.log('Execution Logs:', analysisSwarm.get_logs());

  } catch (error) {
    console.error('Error in chained swarms example:', error);
    process.exit(1);
  }
}

// Run the example
main().catch(console.error);