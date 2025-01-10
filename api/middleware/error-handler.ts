import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

// Custom error class for API errors
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Error types
export const ErrorTypes = {
  VALIDATION_ERROR: 'ValidationError',
  AUTHENTICATION_ERROR: 'AuthenticationError',
  AUTHORIZATION_ERROR: 'AuthorizationError',
  NOT_FOUND_ERROR: 'NotFoundError',
  RATE_LIMIT_ERROR: 'RateLimitError',
  INTERNAL_ERROR: 'InternalError',
} as const;

// Error handler middleware
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log error for debugging
  console.error('[Error Handler]', {
    name: err.name,
    message: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString(),
  });

  // Handle different types of errors
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      details: err.details,
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: err.errors.map(e => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // Handle specific error types
  switch (err.name) {
    case ErrorTypes.VALIDATION_ERROR:
      return res.status(400).json({
        success: false,
        error: err.message,
      });

    case ErrorTypes.AUTHENTICATION_ERROR:
      return res.status(401).json({
        success: false,
        error: err.message,
      });

    case ErrorTypes.AUTHORIZATION_ERROR:
      return res.status(403).json({
        success: false,
        error: err.message,
      });

    case ErrorTypes.NOT_FOUND_ERROR:
      return res.status(404).json({
        success: false,
        error: err.message,
      });

    case ErrorTypes.RATE_LIMIT_ERROR:
      return res.status(429).json({
        success: false,
        error: err.message,
      });

    default:
      // Handle unexpected errors
      const isProduction = process.env.NODE_ENV === 'production';
      return res.status(500).json({
        success: false,
        error: isProduction ? 'Internal server error' : err.message,
        ...(isProduction ? {} : { stack: err.stack }),
      });
  }
};

// Error creator functions
export const createError = {
  validation: (message: string, details?: any) => 
    new ApiError(400, message, details),
  
  authentication: (message: string = 'Authentication required') =>
    new ApiError(401, message),
  
  authorization: (message: string = 'Insufficient permissions') =>
    new ApiError(403, message),
  
  notFound: (resource: string) =>
    new ApiError(404, `${resource} not found`),
  
  rateLimit: (message: string = 'Too many requests') =>
    new ApiError(429, message),
  
  internal: (message: string = 'Internal server error') =>
    new ApiError(500, message),
};