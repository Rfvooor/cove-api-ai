import { Agent, AgentConfig } from '../src/core/agent.js';
import { CodeExecutor } from '../src/core/tools/code-executor.js';
import { WebSearchTool } from '../src/integrations/search/web-search.js';
import { config } from '../src/utils/config.js';
import { Task } from '../src/core/task.js';

async function main() {
  try {
    // Initialize agent with code execution and search capabilities
    const agent = await Agent.create({
      name: 'CodeSearchAgent',
      description: 'An agent capable of searching and executing code',
      systemPrompt: `You are an AI assistant that can search for information and execute code.
        You can use the web search tool to find relevant information and the code executor
        to run and test code snippets. Always validate and sanitize code before execution.`,
      tools: [
        // Initialize code executor if enabled
        ...(config.isFeatureEnabled('codeExecution') ? [
          new CodeExecutor(config.getCodeExecutionConfig().workDir)
        ] : []),
        // Initialize web search if enabled
        ...(config.isFeatureEnabled('search') ? [
          new WebSearchTool(
            config.getSearchConfig().googleApiKey,
            config.getSearchConfig().searchEngineId
          )
        ] : [])
      ]
    } as AgentConfig);

    // Example task: Search for a coding solution and execute it
    const task = new Task({
      name: 'Find and test sorting algorithm',
      description: `Search for an efficient sorting algorithm implementation in JavaScript,
        then execute it with a test array to verify it works correctly.`,
      metadata: {
        type: 'code_search_execute',
        language: 'javascript',
        priority: 'medium'
      }
    });

    // Execute the task
    const result = await agent.execute(task);

    if (result.success) {
      console.log('Task completed successfully!');
      console.log('Output:', result.output);
      if (result.toolsUsed.length > 0) {
        console.log('Tools used:', result.toolsUsed);
      }
    } else {
      console.error('Task failed:', result.error);
    }

    // Example of searching and executing Python code
    const pythonTask = new Task({
      name: 'Find and test data processing',
      description: `Search for a Python script that processes CSV data,
        then execute it with sample data to verify functionality.`,
      metadata: {
        type: 'code_search_execute',
        language: 'python',
        priority: 'high'
      }
    });

    const pythonResult = await agent.execute(pythonTask);

    if (pythonResult.success) {
      console.log('Python task completed successfully!');
      console.log('Output:', pythonResult.output);
      if (pythonResult.toolsUsed.length > 0) {
        console.log('Tools used:', pythonResult.toolsUsed);
      }
    } else {
      console.error('Python task failed:', pythonResult.error);
    }

  } catch (error) {
    console.error('Error in code-search example:', error);
    process.exit(1);
  }
}

// Run the example
main().catch(console.error);