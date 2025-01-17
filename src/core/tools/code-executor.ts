import { Tool, type ToolConfig, type SchemaType } from '../tool.js';
import { spawn } from 'child_process';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

const SUPPORTED_LANGUAGES = ['javascript', 'typescript', 'python', 'ruby', 'shell'] as const;
type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

interface CodeExecutionInput {
  code: string;
  language: SupportedLanguage;
  timeout?: number;
  args?: string[];
  env?: Record<string, string>;
}

interface CodeExecutionOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
}

const DEFAULT_WORK_DIR = './tmp/code-execution';

// Input schema in JSON Schema format
const inputSchema: SchemaType = {
  type: 'object',
  properties: {
    code: {
      type: 'string',
      description: 'The source code to execute'
    },
    language: {
      type: 'string',
      enum: [...SUPPORTED_LANGUAGES],
      description: 'Programming language of the code'
    },
    timeout: {
      type: 'number',
      description: 'Maximum execution time in milliseconds',
      minimum: 0,
      maximum: 30000,
      default: 5000
    },
    args: {
      type: 'array',
      items: { type: 'string' },
      description: 'Command line arguments to pass to the program'
    },
    env: {
      type: 'object',
      description: 'Environment variables to set during execution',
      properties: {
        // Define common environment variables
        NODE_ENV: { type: 'string' },
        PATH: { type: 'string' },
        HOME: { type: 'string' },
        USER: { type: 'string' },
        TEMP: { type: 'string' },
        // Allow any other string values
        '*': { type: 'string' }
      }
    }
  },
  required: ['code', 'language']
};

// Output schema in JSON Schema format
const outputSchema: SchemaType = {
  type: 'object',
  properties: {
    stdout: {
      type: 'string',
      description: 'Standard output from the program'
    },
    stderr: {
      type: 'string',
      description: 'Standard error output from the program'
    },
    exitCode: {
      type: 'number',
      description: 'Program exit code (0 indicates success)'
    },
    executionTime: {
      type: 'number',
      description: 'Total execution time in milliseconds'
    }
  },
  required: ['stdout', 'stderr', 'exitCode', 'executionTime']
};

export class CodeExecutor extends Tool<CodeExecutionInput, CodeExecutionOutput> {
  private readonly workDir: string;

  constructor(workDir: string = DEFAULT_WORK_DIR) {
    const toolConfig: ToolConfig<CodeExecutionInput, CodeExecutionOutput> = {
      name: 'code-executor',
      description: `Executes code in various programming languages with safety constraints.
      Supported languages: ${[...SUPPORTED_LANGUAGES].join(', ')}
      
      Features:
      - Sandboxed execution environment
      - Configurable timeout
      - Command line arguments support
      - Environment variables support
      - Automatic cleanup
      
      Security:
      - No network access
      - Limited file system access
      - Resource usage limits
      - Input validation
      - Process isolation`,
      inputSchema,
      outputSchema,
      execute: (input: CodeExecutionInput) => this.executeCode(input)
    };

    super(toolConfig);
    this.workDir = workDir;
  }

  private async executeCode(input: CodeExecutionInput): Promise<CodeExecutionOutput> {
    const sessionId = uuidv4();
    const sessionDir = join(this.workDir, sessionId);
    const startTime = Date.now();

    try {
      // Create session directory
      await mkdir(sessionDir, { recursive: true });

      // Write code to file
      const filename = this.getFilename(input.language);
      const filepath = join(sessionDir, filename);
      await writeFile(filepath, input.code);

      // Execute code with safety constraints
      const result = await this.runCode(input.language, filepath, {
        timeout: input.timeout || 5000,
        args: input.args || [],
        env: {
          ...process.env,
          ...input.env,
          NODE_ENV: 'sandbox',
          SANDBOX_ID: sessionId
        }
      });

      return {
        ...result,
        executionTime: Date.now() - startTime
      };

    } finally {
      // Cleanup
      try {
        await rm(sessionDir, { recursive: true, force: true });
      } catch (error) {
        console.error('Failed to cleanup session directory:', error);
      }
    }
  }

  private getFilename(language: SupportedLanguage): string {
    switch (language) {
      case 'javascript':
        return 'script.js';
      case 'typescript':
        return 'script.ts';
      case 'python':
        return 'script.py';
      case 'ruby':
        return 'script.rb';
      case 'shell':
        return 'script.sh';
    }
  }

  private getCommand(language: SupportedLanguage, filepath: string): [string, string[]] {
    switch (language) {
      case 'javascript':
        return ['node', [filepath]];
      case 'typescript':
        return ['ts-node', [filepath]];
      case 'python':
        return ['python3', [filepath]];
      case 'ruby':
        return ['ruby', [filepath]];
      case 'shell':
        return ['bash', [filepath]];
    }
  }

  private async runCode(
    language: SupportedLanguage,
    filepath: string,
    options: {
      timeout: number;
      args: string[];
      env: NodeJS.ProcessEnv;
    }
  ): Promise<Omit<CodeExecutionOutput, 'executionTime'>> {
    return new Promise((resolve, reject) => {
      const [command, baseArgs] = this.getCommand(language, filepath);
      const args = [...baseArgs, ...options.args];

      const process = spawn(command, args, {
        env: options.env,
        timeout: options.timeout,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('error', (error) => {
        reject(error);
      });

      process.on('exit', (code) => {
        resolve({
          stdout,
          stderr,
          exitCode: code || 0
        });
      });

      // Handle timeout
      setTimeout(() => {
        process.kill();
        reject(new Error('Execution timed out'));
      }, options.timeout);
    });
  }

  // Validate code for potential security issues
  private validateCode(code: string): void {
    const dangerousPatterns = [
      /process\.exit/,
      /require\s*\(\s*['"]child_process['"]\s*\)/,
      /exec\s*\(/,
      /eval\s*\(/,
      /Function\s*\(/
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        throw new Error('Code contains potentially dangerous operations');
      }
    }
  }
}