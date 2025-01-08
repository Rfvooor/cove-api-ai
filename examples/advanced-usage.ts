/**
 * Advanced usage example for the Cove API AI framework
 * Demonstrates advanced features including:
 * - Custom tool creation with proper type safety
 * - Memory management and persistence
 * - Error handling and retry strategies
 */

import {
  createAgent,
  Tool,
  Memory,
  Task,
  type ToolConfig,
  type MemoryConfig,
  type MemoryEntry
} from '../src/index.js';
import { TaskPriority } from '../src/core/task.js';
import * as z from 'zod';

// Define the input schema using Zod
const analysisInputSchema = z.object({
  data: z.array(z.number()),
  method: z.enum(['mean', 'median', 'mode', 'std'])
});

// Define the output schema using Zod
const analysisOutputSchema = z.object({
  result: z.number(),
  method: z.string(),
  timestamp: z.string()
});

// Infer types from schemas
type AnalysisInput = z.infer<typeof analysisInputSchema>;
type AnalysisOutput = z.infer<typeof analysisOutputSchema>;

// Custom tool implementation with proper type safety
class DataAnalysisTool extends Tool {
  private static readonly methods = ['mean', 'median', 'mode', 'std'] as const;

  constructor() {
    super({
      name: 'data-analysis',
      description: 'Analyzes data using statistical methods',
      inputSchema: analysisInputSchema,
      outputSchema: analysisOutputSchema,
      execute: async <TInput, TOutput>(input: TInput): Promise<TOutput> => {
        // Validate and type-cast input
        const validInput = analysisInputSchema.parse(input);
        
        try {
          const result = await this.analyze(validInput);
          const output = {
            result,
            method: validInput.method,
            timestamp: new Date().toISOString()
          };
          
          // Validate output
          return analysisOutputSchema.parse(output);
        } catch (error) {
          throw new Error(`Data analysis failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    });
  }

  private async analyze(input: AnalysisInput): Promise<number> {
    switch (input.method) {
      case 'mean': {
        const sum = input.data.reduce((acc: number, curr: number): number => acc + curr, 0);
        return sum / input.data.length;
      }
      case 'median': {
        const sorted = [...input.data].sort((a: number, b: number): number => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
      }
      case 'mode': {
        const counts = new Map<number, number>();
        input.data.forEach((value: number): void => {
          counts.set(value, (counts.get(value) || 0) + 1);
        });
        let mode = input.data[0];
        let maxCount = 0;
        counts.forEach((count: number, value: number): void => {
          if (count > maxCount) {
            mode = value;
            maxCount = count;
          }
        });
        return mode;
      }
      case 'std': {
        const sum = input.data.reduce((acc: number, curr: number): number => acc + curr, 0);
        const mean = sum / input.data.length;
        const squareDiffs = input.data.map((value: number): number => Math.pow(value - mean, 2));
        const variance = squareDiffs.reduce((acc: number, curr: number): number => acc + curr, 0) / input.data.length;
        return Math.sqrt(variance);
      }
      default: {
        throw new Error(`Unsupported method: ${input.method}`);
      }
    }
  }
}

async function main() {
  try {
    // Configure memory system
    const memoryConfig: MemoryConfig = {
      maxShortTermItems: 100,
      maxTokenSize: 4096,
      autoArchive: true,
      archiveThreshold: 0.8,
      indexStrategy: 'semantic',
      metadata: {
        environment: 'production',
        projectId: 'advanced-example'
      }
    };

    // Create memory instance
    const memory = await Memory.create(memoryConfig);

    // Create analysis agent with custom tool
    const analysisAgent = await createAgent({
      name: 'analysis-agent',
      systemPrompt: 'You are an AI assistant specialized in data analysis and interpretation.',
      maxLoops: 5,
      memoryConfig,
      tools: [new DataAnalysisTool()]
    });

    // Create task with proper priority type
    const taskDescription = 'Analyze the given dataset using statistical methods';
    const task = new Task({
      name: 'data-analysis-task',
      description: taskDescription,
      priority: 1 as TaskPriority,
      metadata: {
        type: 'analysis',
        dataset: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        requiredMethods: ['mean', 'median', 'std']
      }
    });

    // Execute task with error handling
    try {
      const result = await analysisAgent.run(taskDescription);
      console.log('Analysis result:', result);

      const now = Date.now();
      const resultStr = JSON.stringify(result);

      // Store result in memory with proper typing
      const resultEntry: MemoryEntry = {
        id: `result_${now}`,
        content: resultStr,
        type: 'result',
        timestamp: now,
        tokenCount: Math.ceil(resultStr.length / 4),
        metadata: {
          taskId: task.name,
          timestamp: new Date(now).toISOString()
        }
      };
      await memory.add(resultEntry);

      // Log success to memory
      const successMessage = 'Task completed successfully';
      const successEntry: MemoryEntry = {
        id: `success_${now}`,
        content: successMessage,
        type: 'system',
        timestamp: now,
        tokenCount: Math.ceil(successMessage.length / 4),
        metadata: {
          taskId: task.name,
          status: 'success',
          timestamp: new Date(now).toISOString()
        }
      };
      await memory.add(successEntry);

    } catch (error) {
      console.error('Task execution failed:', error instanceof Error ? error.message : String(error));
      
      const now = Date.now();
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Log error to memory with proper typing
      const errorEntry: MemoryEntry = {
        id: `error_${now}`,
        content: errorMessage,
        type: 'error',
        timestamp: now,
        tokenCount: Math.ceil(errorMessage.length / 4),
        metadata: {
          taskId: task.name,
          timestamp: new Date(now).toISOString()
        }
      };
      await memory.add(errorEntry);
    }

  } catch (error) {
    console.error('Example failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}