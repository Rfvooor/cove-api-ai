import { Tool } from '../tool.js';
import { spawn } from 'child_process';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

interface CodeExecutionInput {
  code: string;
  language: string;
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
const SUPPORTED_LANGUAGES = new Set([
  'javascript',
  'typescript',
  'python',
  'ruby',
  'shell'
]);

export class CodeExecutor extends Tool<CodeExecutionInput, CodeExecutionOutput> {
  private readonly workDir: string;

  constructor(workDir: string = DEFAULT_WORK_DIR) {
    const config = {
      name: 'code-executor',
      description: 'Executes code in various programming languages with safety constraints',
      inputSchema: {
        type: 'object',
        properties: {
          code: { type: 'string' },
          language: { type: 'string' },
          timeout: { type: 'number', optional: true },
          args: { type: 'array', items: { type: 'string' }, optional: true },
          env: { type: 'object', optional: true }
        },
        required: ['code', 'language']
      } as any,
      outputSchema: {
        type: 'object',
        properties: {
          stdout: { type: 'string' },
          stderr: { type: 'string' },
          exitCode: { type: 'number' },
          executionTime: { type: 'number' }
        }
      } as any,
      execute: (input: CodeExecutionInput) => this.executeCode(input)
    };

    super(config);
    this.workDir = workDir;
  }

  private async executeCode(input: CodeExecutionInput): Promise<CodeExecutionOutput> {
    if (!SUPPORTED_LANGUAGES.has(input.language.toLowerCase())) {
      throw new Error(`Unsupported language: ${input.language}`);
    }

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

  private getFilename(language: string): string {
    switch (language.toLowerCase()) {
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
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }

  private getCommand(language: string, filepath: string): [string, string[]] {
    switch (language.toLowerCase()) {
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
      default:
        throw new Error(`Unsupported language: ${language}`);
    }
  }

  private async runCode(
    language: string,
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