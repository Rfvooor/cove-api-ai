import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// Basic rate limiter for general API endpoints
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again after 15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Stricter rate limiter for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    error: 'Too many login attempts from this IP, please try again after an hour'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for task execution endpoints
export const taskLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 task executions per minute
  message: {
    success: false,
    error: 'Too many task executions from this IP, please try again after a minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Custom rate limiter factory for specific endpoints
export const createCustomLimiter = (
  windowMs: number,
  max: number,
  message: string
) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: message
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};