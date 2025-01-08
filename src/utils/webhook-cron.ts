import { Request, Response } from 'express';
import { Agent } from '../core/agent.js';
import { Task } from '../core/task.js';

// Use require for express since it has better CJS/ESM compatibility
const express = require('express');
type Application = ReturnType<typeof express>;

// Simple cron-like interface for scheduled tasks
interface ScheduledTask {
  start(): void;
  stop(): void;
}

class SimpleScheduler implements ScheduledTask {
  private intervalId: NodeJS.Timeout | null = null;
  private interval: number;
  private task: () => void;

  constructor(cronExpression: string, task: () => void) {
    this.interval = this.parseCronToMs(cronExpression);
    this.task = task;
  }

  start(): void {
    if (!this.intervalId) {
      this.intervalId = setInterval(this.task, this.interval);
    }
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private parseCronToMs(cron: string): number {
    const parts = cron.split(' ');
    if (parts.length !== 5) {
      return 60000; // Default to 1 minute
    }
    
    // If first field (minutes) is *, return 1 minute interval
    // Otherwise, try to parse the minute value
    const minutes = parts[0] === '*' ? 1 : parseInt(parts[0], 10);
    return minutes * 60000;
  }
}

// Webhook configuration
export interface WebhookConfig {
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  handler: (data: any) => Promise<void>;
}

// Cron task configuration
export interface CronTaskConfig {
  name: string;
  schedule: string;
  task: () => Promise<void>;
}

export class WebhookCronManager {
  private app: Application;
  private agent: Agent;
  private webhooks: Map<string, WebhookConfig>;
  private cronJobs: Map<string, SimpleScheduler>;

  constructor(agent: Agent, port: number = 3000) {
    this.app = express();
    this.agent = agent;
    this.webhooks = new Map();
    this.cronJobs = new Map();

    // Middleware
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      res.status(200).json({ 
        status: 'healthy', 
        webhooks: Array.from(this.webhooks.keys()),
        cronTasks: Array.from(this.cronJobs.keys())
      });
    });

    // Start server
    const server = this.app.listen(port);
    server.on('listening', () => {
      console.log(`Webhook server running on port ${port}`);
    });
  }

  // Register a new webhook
  registerWebhook(config: WebhookConfig) {
    const method = config.method || 'POST';
    const handler = async (req: Request, res: Response) => {
      try {
        await config.handler(req.body);
        
        // Create task for webhook processing
        const task = new Task({
          name: 'Process Webhook',
          description: JSON.stringify(req.body),
          metadata: {
            type: 'webhook_event',
            webhookPath: config.path,
            method: method,
            timestamp: new Date().toISOString(),
            importance: 0.7, // Medium-high importance for webhook events
            isConsolidated: false,
            consolidationScore: 0,
            isArchived: false
          }
        });

        const result = await this.agent.execute(task);
        const agentResponse = result.success ? result.output : null;

        res.status(200).json({ 
          message: 'Webhook processed successfully', 
          agentResponse 
        });
      } catch (error) {
        console.error('Webhook processing error:', error);
        res.status(500).json({ 
          error: 'Failed to process webhook', 
          details: error instanceof Error ? error.message : error 
        });
      }
    };

    // Register route based on method
    switch(method) {
      case 'GET':
        this.app.get(config.path, handler);
        break;
      case 'POST':
        this.app.post(config.path, handler);
        break;
      case 'PUT':
        this.app.put(config.path, handler);
        break;
      case 'DELETE':
        this.app.delete(config.path, handler);
        break;
      default:
        throw new Error(`Unsupported HTTP method: ${method}`);
    }

    this.webhooks.set(config.path, config);
    console.log(`Webhook registered: ${method} ${config.path}`);
  }

  // Register a cron task
  registerCronTask(config: CronTaskConfig) {
    const scheduler = new SimpleScheduler(config.schedule, async () => {
      try {
        // Run task
        await config.task();

        // Create task for cron execution
        const task = new Task({
          name: `Cron Task: ${config.name}`,
          description: `Scheduled execution of ${config.name}`,
          metadata: {
            type: 'cron_task',
            cronTaskName: config.name,
            schedule: config.schedule,
            timestamp: new Date().toISOString(),
            importance: 0.6, // Medium importance for scheduled tasks
            isConsolidated: false,
            consolidationScore: 0,
            isArchived: false
          }
        });

        await this.agent.execute(task);
      } catch (error) {
        console.error(`Cron task ${config.name} error:`, error);
      }
    });

    scheduler.start();
    this.cronJobs.set(config.name, scheduler);
    console.log(`Cron task registered: ${config.name} (${config.schedule})`);
  }

  // Remove a webhook
  removeWebhook(path: string) {
    this.webhooks.delete(path);
    // Note: Express routes cannot be dynamically removed without restarting the server
    console.log(`Webhook removed: ${path}`);
  }

  // Remove a cron task
  removeCronTask(name: string) {
    const scheduler = this.cronJobs.get(name);
    if (scheduler) {
      scheduler.stop();
      this.cronJobs.delete(name);
      console.log(`Cron task stopped: ${name}`);
    }
  }

  // List all registered webhooks
  listWebhooks(): string[] {
    return Array.from(this.webhooks.keys());
  }

  // List all registered cron tasks
  listCronTasks(): string[] {
    return Array.from(this.cronJobs.keys());
  }
}