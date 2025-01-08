declare module 'zod' {
  export class ZodError extends Error {
    errors: Array<{
      code: string;
      message: string;
      path: (string | number)[];
    }>;
  }

  export interface ZodType<T = any> {
    parse: (data: unknown) => T;
    safeParse: (data: unknown) => 
      | { success: true; data: T }
      | { success: false; error: ZodError };
    optional?: () => ZodType<T | undefined>;
    extend?: (input: any) => ZodType<T>;
  }

  export interface ZodStringType extends ZodType<string> {
    min: (min: number) => ZodStringType;
    max: (max: number) => ZodStringType;
    email: () => ZodStringType;
    optional: () => ZodType<string | undefined>;
  }

  export interface ZodNumberType extends ZodType<number> {
    min: (min: number) => ZodNumberType;
    max: (max: number) => ZodNumberType;
    optional: () => ZodType<number | undefined>;
  }

  export interface ZodBooleanType extends ZodType<boolean> {
    optional: () => ZodType<boolean | undefined>;
  }

  export interface ZodArrayType<T extends ZodType> extends ZodType<Array<T extends ZodType<infer U> ? U : any>> {
    element: T;
    optional: () => ZodType<Array<T extends ZodType<infer U> ? U : any> | undefined>;
  }

  export interface ZodObjectType<T extends Record<string, ZodType>> extends ZodType<{
    [K in keyof T]: T[K] extends ZodType<infer U> ? U : never
  }> {
    shape: T;
    extend: (input: Partial<T>) => ZodObjectType<T>;
    optional: () => ZodType<{
      [K in keyof T]: T[K] extends ZodType<infer U> ? U : never
    } | undefined>;
  }

  export interface ZodStatic {
    string: () => ZodStringType;
    number: () => ZodNumberType;
    boolean: () => ZodBooleanType;
    array: <T extends ZodType>(schema: T) => ZodArrayType<T>;
    object: <T extends Record<string, ZodType>>(shape: T) => ZodObjectType<T>;
    any: () => ZodType;
    literal: <T extends string | number | boolean>(value: T) => ZodType<T>;
    undefined: () => ZodType<undefined>;
  }

  const z: ZodStatic & {
    ZodError: typeof ZodError;
  };

  export default z;
}