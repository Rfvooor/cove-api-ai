declare module 'helmet' {
  import { Request, Response, NextFunction } from 'express';

  interface HelmetOptions {
    contentSecurityPolicy?: boolean | {
      directives?: {
        defaultSrc?: string[];
        scriptSrc?: string[];
        styleSrc?: string[];
        imgSrc?: string[];
        connectSrc?: string[];
        fontSrc?: string[];
        objectSrc?: string[];
        mediaSrc?: string[];
        frameSrc?: string[];
      };
    };
    frameguard?: boolean | { action: 'deny' | 'sameorigin' };
    hsts?: boolean | { 
      maxAge?: number; 
      includeSubDomains?: boolean; 
      preload?: boolean 
    };
    referrerPolicy?: boolean | { 
      policy: 'no-referrer' | 
               'no-referrer-when-downgrade' | 
               'same-origin' | 
               'strict-origin' | 
               'strict-origin-when-cross-origin' | 
               'unsafe-url' 
    };
    xssFilter?: boolean;
    noSniff?: boolean;
    ieNoOpen?: boolean;
    hidePoweredBy?: boolean | { setTo?: string };
  }

  function helmet(options?: HelmetOptions): (req: Request, res: Response, next: NextFunction) => void;

  namespace helmet {
    export function contentSecurityPolicy(options?: HelmetOptions['contentSecurityPolicy']): (req: Request, res: Response, next: NextFunction) => void;
    export function frameguard(options?: HelmetOptions['frameguard']): (req: Request, res: Response, next: NextFunction) => void;
    export function hsts(options?: HelmetOptions['hsts']): (req: Request, res: Response, next: NextFunction) => void;
    export function referrerPolicy(options?: HelmetOptions['referrerPolicy']): (req: Request, res: Response, next: NextFunction) => void;
  }

  export = helmet;
}