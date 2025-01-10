import { authenticate, authorize, AuthRequest } from './auth';
import { apiLimiter, authLimiter, taskLimiter, createCustomLimiter } from './rate-limit';
import { requestLogger, errorLogger, notFoundLogger } from './logger';
import {
  validateRequest,
  validateCreateAgent,
  validateUpdateAgent,
  validateCreateSwarm,
  validateUpdateSwarm,
  validateTaskExecution,
  validateAddAgentToSwarm,
  validateUUID,
  validateQueryParams,
} from './validator';
import { errorHandler, ApiError, ErrorTypes, createError } from './error-handler';

export {
  // Authentication middleware
  authenticate,
  authorize,
  type AuthRequest,

  // Rate limiting middleware
  apiLimiter,
  authLimiter,
  taskLimiter,
  createCustomLimiter,

  // Logging middleware
  requestLogger,
  errorLogger,
  notFoundLogger,

  // Validation middleware
  validateRequest,
  validateCreateAgent,
  validateUpdateAgent,
  validateCreateSwarm,
  validateUpdateSwarm,
  validateTaskExecution,
  validateAddAgentToSwarm,
  validateUUID,
  validateQueryParams,

  // Error handling middleware
  errorHandler,
  ApiError,
  ErrorTypes,
  createError,
};