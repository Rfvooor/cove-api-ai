declare module 'uuid' {
  export function v4(): string;
  export function v1(): string;
  export function v3(name: string, namespace: string): string;
  export function v5(name: string, namespace: string): string;

  export interface V4Options {
    random?: number[];
    rng?: () => number[];
  }

  export interface V1Options {
    node?: number[];
    clockseq?: number;
    msecs?: number | Date;
    nsecs?: number;
  }
}