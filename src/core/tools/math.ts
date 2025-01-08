import { Tool, ToolConfig } from '../tool.js';

interface MathInput {
  operation: string;
  args: number[];
  options?: {
    precision?: number;
    roundingMode?: 'ceil' | 'floor' | 'round';
  };
}

interface MathOutput {
  result: number;
  precision?: number;
  steps?: string[];
}

function isMathInput(input: unknown): input is MathInput {
  if (typeof input !== 'object' || input === null) return false;
  
  const candidate = input as Partial<MathInput>;
  return (
    typeof candidate.operation === 'string' &&
    Array.isArray(candidate.args) &&
    candidate.args.every(arg => typeof arg === 'number')
  );
}

/**
 * MathTool provides advanced mathematical operations beyond basic arithmetic.
 * Includes statistical functions, trigonometry, and other mathematical utilities.
 */
export class MathTool {
  private static instance: Tool;

  private constructor() {}

  static getInstance(): Tool {
    if (!MathTool.instance) {
      const config: ToolConfig = {
        name: 'math',
        description: 'Perform advanced mathematical calculations and analysis',
        requiredTools: [],
        execute: async <TInput, TOutput>(input: TInput): Promise<TOutput> => {
          if (!isMathInput(input)) {
            throw new Error('Invalid input format for math tool');
          }

          const { operation, args, options = {} } = input;
          const { precision = 6, roundingMode = 'round' } = options;

          const formatNumber = (num: number): number => {
            const factor = Math.pow(10, precision);
            switch (roundingMode) {
              case 'ceil': return Math.ceil(num * factor) / factor;
              case 'floor': return Math.floor(num * factor) / factor;
              default: return Math.round(num * factor) / factor;
            }
          };

          const steps: string[] = [];
          let result: number;

          switch (operation.toLowerCase()) {
            // Basic Statistics
            case 'mean':
            case 'average': {
              const sum = args.reduce((acc: number, val: number): number => acc + val, 0);
              result = sum / args.length;
              steps.push(`Sum: ${sum}`, `Count: ${args.length}`, `Mean: ${sum}/${args.length}`);
              break;
            }

            case 'median': {
              const sorted = [...args].sort((a: number, b: number): number => a - b);
              const mid = Math.floor(sorted.length / 2);
              result = sorted.length % 2 === 0
                ? (sorted[mid - 1] + sorted[mid]) / 2
                : sorted[mid];
              steps.push(`Sorted: [${sorted.join(', ')}]`, `Median index: ${mid}`);
              break;
            }

            case 'mode': {
              const counts = new Map<number, number>();
              args.forEach((n: number) => {
                counts.set(n, (counts.get(n) || 0) + 1);
              });
              let maxCount = 0;
              let modes: number[] = [];
              counts.forEach((count: number, num: number) => {
                if (count > maxCount) {
                  maxCount = count;
                  modes = [num];
                } else if (count === maxCount) {
                  modes.push(num);
                }
              });
              result = modes[0];
              steps.push(`Frequency map: ${[...counts.entries()].map(([n, c]) => `${n}:${c}`).join(', ')}`);
              break;
            }

            case 'std':
            case 'stddev': {
              const mean = args.reduce((acc: number, val: number): number => acc + val, 0) / args.length;
              const squaredDiffs = args.map((x: number): number => Math.pow(x - mean, 2));
              const variance = squaredDiffs.reduce((acc: number, val: number): number => acc + val, 0) / args.length;
              result = Math.sqrt(variance);
              steps.push(
                `Mean: ${mean}`,
                `Squared differences: [${squaredDiffs.join(', ')}]`,
                `Variance: ${variance}`
              );
              break;
            }

            // Trigonometry
            case 'sin':
              result = Math.sin(args[0]);
              break;
            case 'cos':
              result = Math.cos(args[0]);
              break;
            case 'tan':
              result = Math.tan(args[0]);
              break;
            case 'asin':
              result = Math.asin(args[0]);
              break;
            case 'acos':
              result = Math.acos(args[0]);
              break;
            case 'atan':
              result = Math.atan(args[0]);
              break;

            // Advanced Operations
            case 'pow':
              result = Math.pow(args[0], args[1]);
              steps.push(`${args[0]}^${args[1]}`);
              break;

            case 'sqrt':
              result = Math.sqrt(args[0]);
              steps.push(`√${args[0]}`);
              break;

            case 'log': {
              const base = args.length > 1 ? args[1] : Math.E;
              result = Math.log(args[0]) / Math.log(base);
              steps.push(`log_${base}(${args[0]})`);
              break;
            }

            case 'factorial': {
              const n = args[0];
              if (n < 0 || !Number.isInteger(n)) {
                throw new Error('Factorial requires a non-negative integer');
              }
              result = 1;
              for (let i = 2; i <= n; i++) {
                result *= i;
                steps.push(`${i}! = ${result}`);
              }
              break;
            }

            // Vector Operations
            case 'dot_product': {
              if (args.length % 2 !== 0) {
                throw new Error('Dot product requires two vectors of equal length');
              }
              const mid = args.length / 2;
              const v1 = args.slice(0, mid);
              const v2 = args.slice(mid);
              result = v1.reduce((sum: number, x: number, i: number): number => sum + x * v2[i], 0);
              steps.push(
                `Vector 1: [${v1.join(', ')}]`,
                `Vector 2: [${v2.join(', ')}]`,
                `Products: [${v1.map((x: number, i: number): number => x * v2[i]).join(', ')}]`
              );
              break;
            }

            // Combinatorics
            case 'permutation': {
              const n = args[0];
              const r = args[1];
              if (n < 0 || r < 0 || !Number.isInteger(n) || !Number.isInteger(r)) {
                throw new Error('Permutation requires non-negative integers');
              }
              let perm = 1;
              for (let i = 0; i < r; i++) {
                perm *= (n - i);
                steps.push(`P(${n},${r}) step ${i + 1}: ${perm}`);
              }
              result = perm;
              break;
            }

            case 'combination': {
              const n = args[0];
              const r = args[1];
              if (n < 0 || r < 0 || !Number.isInteger(n) || !Number.isInteger(r)) {
                throw new Error('Combination requires non-negative integers');
              }
              let num = 1;
              let den = 1;
              for (let i = 0; i < r; i++) {
                num *= (n - i);
                den *= (i + 1);
                steps.push(`C(${n},${r}) step ${i + 1}: ${num}/${den}`);
              }
              result = num / den;
              break;
            }

            default:
              throw new Error(`Unsupported operation: ${operation}`);
          }

          const output: MathOutput = {
            result: formatNumber(result),
            precision,
            steps: steps.length > 0 ? steps : undefined
          };

          return output as unknown as TOutput;
        }
      };

      MathTool.instance = new Tool(config);
    }
    return MathTool.instance;
  }
}