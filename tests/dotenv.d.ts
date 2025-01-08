declare module 'dotenv' {
  export interface DotenvConfigOptions {
    /** Path to your Dotenv config file. */
    path?: string;
    /** Encoding of your file containing environment variables. */
    encoding?: string;
    /** Turn on/off logging to console. */
    debug?: boolean;
  }

  export interface DotenvParseOptions {
    /** Encoding of your file containing environment variables. */
    encoding?: string;
  }

  export interface DotenvParseOutput {
    [name: string]: string;
  }

  /**
   * Loads `.env` file contents into {@link https://nodejs.org/api/process.html#process_process_env | `process.env`}.
   * Example: 
   * ```javascript
   * import dotenv from 'dotenv'
   * dotenv.config()
   * ```
   * @param options - Optional configuration options
   * @returns An object with a `parsed` key containing the loaded environment variables (if successfully parsed)
   */
  export function config(options?: DotenvConfigOptions): {
    error?: Error;
    parsed?: DotenvParseOutput;
  };

  /**
   * Parses a string or buffer in the `.env` file format into an object.
   * ```javascript
   * import dotenv from 'dotenv'
   * const config = dotenv.parse('.env')
   * ```
   * @param src - String or buffer in `.env` file format
   * @param options - Optional parsing options
   * @returns An object with environment variables
   */
  export function parse(
    src: string | Buffer, 
    options?: DotenvParseOptions
  ): DotenvParseOutput;
}