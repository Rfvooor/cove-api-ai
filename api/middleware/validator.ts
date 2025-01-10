import { Request, Response, NextFunction } from 'express';
import { ZodSchema, z } from 'zod';
import { agentConfigSchema, swarmConfigSchema } from '../models/types';

// Generic validation middleware
export const validateRequest = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          }))
        });
      } else {
        next(error);
      }
    }
  };
};

// Specific validation schemas for different endpoints
const taskExecutionSchema = z.object({
  input: z.string(),
  context: z.record(z.any()).optional(),
  options: z.object({
    timeout: z.number().positive().optional(),
    maxRetries: z.number().nonnegative().optional(),
    callbackUrl: z.string().url().optional(),
  }).optional(),
});

const addAgentToSwarmSchema = z.object({
  agentId: z.string().uuid(),
});

// Validation middleware for specific routes
export const validateCreateAgent = validateRequest(agentConfigSchema);
export const validateUpdateAgent = validateRequest(agentConfigSchema.partial());
export const validateCreateSwarm = validateRequest(swarmConfigSchema);
export const validateUpdateSwarm = validateRequest(swarmConfigSchema.partial());
export const validateTaskExecution = validateRequest(taskExecutionSchema);
export const validateAddAgentToSwarm = validateRequest(addAgentToSwarmSchema);

// Parameter validation middleware
export const validateUUID = (paramName: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const uuid = req.params[paramName];
    const uuidSchema = z.string().uuid();

    try {
      uuidSchema.parse(uuid);
      next();
    } catch (error) {
      res.status(400).json({
        success: false,
        error: `Invalid ${paramName} format`,
        details: 'Parameter must be a valid UUID'
      });
    }
  };
};

// Query parameter validation middleware
export const validateQueryParams = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Invalid query parameters',
          details: error.errors.map(err => ({
            path: err.path.join('.'),
            message: err.message
          }))
        });
      } else {
        next(error);
      }
    }
  };
};