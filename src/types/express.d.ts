declare module 'express' {
  import { Server } from 'http';
  import { Socket } from 'net';

  export interface Request {
    requestId?: string;
    body?: any;
    params: { [key: string]: string };
    query: { [key: string]: string | string[] | undefined };
    headers: { [key: string]: string | string[] | undefined };
    method: string;
    url: string;
  }

  export interface Response {
    status(code: number): this;
    json(body?: any): this;
    send(body?: any): this;
    end(chunk?: any, encodingOrCb?: string | (() => void), cb?: () => void): this;
    statusCode: number;
  }

  export interface NextFunction {
    (err?: Error): void;
  }

  export interface RouterOptions {
    caseSensitive?: boolean;
    mergeParams?: boolean;
    strict?: boolean;
  }

  export interface Router {
    get(path: string, ...handlers: Array<(req: Request, res: Response, next: NextFunction) => void>): this;
    post(path: string, ...handlers: Array<(req: Request, res: Response, next: NextFunction) => void>): this;
    put(path: string, ...handlers: Array<(req: Request, res: Response, next: NextFunction) => void>): this;
    delete(path: string, ...handlers: Array<(req: Request, res: Response, next: NextFunction) => void>): this;
    patch(path: string, ...handlers: Array<(req: Request, res: Response, next: NextFunction) => void>): this;
  }

  export interface Application extends Router {
    listen(
      port: number, 
      hostname?: string, 
      backlog?: number, 
      callback?: () => void
    ): Server;
    use(middleware: (req: Request, res: Response, next: NextFunction) => void): this;
    use(path: string, middleware: (req: Request, res: Response, next: NextFunction) => void): this;
  }

  export function createServer(): Application;
  export function json(): (req: Request, res: Response, next: NextFunction) => void;
  export function urlencoded(options?: { extended?: boolean }): (req: Request, res: Response, next: NextFunction) => void;
}