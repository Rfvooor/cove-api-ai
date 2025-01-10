import { Request, Response, NextFunction } from 'express';

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const { method, url, ip } = req;

  // Log request
  console.log(`[${new Date().toISOString()}] ${method} ${url} - IP: ${ip}`);

  // Capture response using res.on('finish')
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;

    // Log response
    console.log(
      `[${new Date().toISOString()}] ${method} ${url} - Status: ${statusCode} - Duration: ${duration}ms`
    );

    // Log additional info for errors
    if (statusCode >= 400) {
      console.error(`Error handling ${method} ${url}:`, {
        statusCode,
        body: req.body,
        params: req.params,
        query: req.query,
      });
    }
  });

  next();
};

// Error logging middleware
export const errorLogger = (err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(`[${new Date().toISOString()}] Error:`, {
    message: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    body: req.body,
    params: req.params,
    query: req.query,
  });

  next(err);
};

// Not found logger
export const notFoundLogger = (req: Request, res: Response, next: NextFunction) => {
  console.warn(`[${new Date().toISOString()}] Not Found: ${req.method} ${req.url}`);
  next();
};