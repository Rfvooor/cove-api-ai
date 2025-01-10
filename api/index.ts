import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import { createServer } from 'http';
import { WebSocketServer } from './websocket/server.js';

import {
  apiLimiter,
  authLimiter,
  requestLogger,
  errorLogger,
  notFoundLogger,
  errorHandler,
} from './middleware/index.js';

import { initializeDatabase } from './database/config.js';
import agentRoutes from './routes/agents.js';
import swarmRoutes from './routes/swarms.js';
import taskRoutes from './routes/tasks.js';

const app = express();
const server = createServer(app);
let wss: WebSocketServer;

// Load Swagger documentation
const swaggerDocument = YAML.load(path.join(__dirname, 'swagger.yaml'));

// Basic middleware
app.use(helmet()); // Security headers
app.use(cors()); // CORS support
app.use(express.json()); // JSON body parser
app.use(requestLogger); // Request logging

// Rate limiting
app.use('/api/v1/', apiLimiter); // General API rate limit
app.use('/api/v1/auth', authLimiter); // Stricter limit for auth endpoints

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Health check (no rate limit)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API Routes
app.use('/api/v1/agents', agentRoutes);
app.use('/api/v1/swarms', swarmRoutes);
app.use('/api/v1/tasks', taskRoutes);

// Error handling
app.use(notFoundLogger); // Log 404 errors
app.use(errorLogger); // Log all errors
app.use(errorHandler); // Handle all errors

const PORT = process.env.PORT || 3000;

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();
    console.log('Database initialized successfully');

    // Start HTTP server
    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`API Documentation available at http://localhost:${PORT}/api-docs`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      
      // Initialize WebSocket server
      wss = new WebSocketServer(server);
      console.log('WebSocket server initialized');
      
      // Handle real-time updates
      wss.on('message', ({ clientId, data }) => {
        try {
          switch (data.type) {
            case 'agent_status':
              wss.broadcast({
                type: 'agent_status_update',
                data: data.payload
              });
              break;
            case 'task_status':
              wss.broadcast({
                type: 'task_status_update',
                data: data.payload
              });
              break;
            case 'swarm_status':
              wss.broadcast({
                type: 'swarm_status_update',
                data: data.payload
              });
              break;
            default:
              console.warn('Unknown message type:', data.type);
          }
        } catch (error) {
          console.error('Error handling WebSocket message:', error);
        }
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Check if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch(error => {
    console.error('Server startup failed:', error);
    process.exit(1);
  });
}

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown handler
async function shutdownGracefully(signal: string) {
  console.log(`${signal} received. Closing servers...`);
  try {
    if (wss) {
      // Notify all clients
      wss.broadcast({
        type: 'shutdown',
        message: 'Server is shutting down'
      });
    }

    // Close HTTP server
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });

    console.log('Servers closed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => shutdownGracefully('SIGTERM'));
process.on('SIGINT', () => shutdownGracefully('SIGINT'));

export default app;