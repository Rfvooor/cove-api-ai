// Jest type declarations
declare namespace NodeJS {
  interface Global {
    jest: {
      mock: (moduleName: string, mockImplementation?: any) => void;
      spyOn: <T, K extends keyof T>(object: T, methodName: K) => jest.MockFunction<T[K]>;
      fn: <T extends (...args: any[]) => any>(implementation?: T) => jest.MockFunction<T>;
      requireActual: (moduleName: string) => any;
    };
  }
}

declare namespace jest {
  interface MockFunction<T extends (...args: any[]) => any> {
    (...args: Parameters<T>): ReturnType<T>;
    mockImplementation(fn: T): this;
    mockReturnValue(value: ReturnType<T>): this;
    mockResolvedValue(value: ReturnType<T>): this;
    mockRejectedValue(error: Error): this;
    mockClear(): void;
    mockReset(): void;
  }

  interface Expect {
    (value: any): {
      toBe(expected: any): void;
      toEqual(expected: any): void;
      toBeTruthy(): void;
      toBeFalsy(): void;
      toBeNull(): void;
      toBeUndefined(): void;
      toHaveBeenCalled(): void;
      toHaveBeenCalledTimes(times: number): void;
    };
  }
}

// Global test functions
declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => void | Promise<void>): void;
declare function test(name: string, fn: () => void | Promise<void>): void;
declare const expect: jest.Expect;