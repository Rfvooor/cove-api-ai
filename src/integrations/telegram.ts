import Telegraf, { Context as TelegrafContext } from 'telegraf';
import { randomUUID } from 'crypto';
import { Agent } from '../core/agent.js';
import { SentimentAnalyzer } from '../utils/sentiment-analyzer.js';
import { Task, TaskResult, TaskStatus } from '../core/task.js';

export interface TelegramIntegrationConfig {
  token: string;
  botUsername?: string;
}

export interface MessageOptions {
  chatId: number | string;
  text: string;
  replyToMessageId?: number;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
}

export interface CommandHandler {
  command: string;
  description: string;
  handler: (ctx: TelegrafContext, agent: Agent) => Promise<void>;
}

export class TelegramIntegration {
  private bot: Telegraf;
  private agent: Agent;
  private sentimentAnalyzer: SentimentAnalyzer;
  private commandHandlers: CommandHandler[] = [];

  constructor(config: TelegramIntegrationConfig, agent: Agent) {
    this.bot = new Telegraf(config.token);
    this.agent = agent;
    this.sentimentAnalyzer = new SentimentAnalyzer();

    this.setupBaseHandlers();
  }

  private setupBaseHandlers(): void {
    // Basic message handling
    this.bot.on('text', async (ctx: TelegrafContext) => {
      try {
        if (!ctx.message || !ctx.message.text) return;

        const message = ctx.message.text;
        const sentiment = this.sentimentAnalyzer.analyze(message);

        const agentContext = {
          message,
          chat: {
            id: ctx.chat.id,
            type: ctx.chat.type
          },
          from: {
            id: ctx.from.id,
            username: ctx.from.username,
            firstName: ctx.from.first_name,
            lastName: ctx.from.last_name
          },
          sentiment: {
            score: sentiment,
            classification: this.sentimentAnalyzer.classifySentiment(sentiment)
          },
          metadata: {
            type: 'telegram_message',
            importance: sentiment * 0.6 + 0.4,
            isConsolidated: false,
            consolidationScore: 0,
            isArchived: false
          }
        };

        const task = new Task({
          type: 'agent',
          executorId: this.agent.id,
          input: {
            name: 'Process Telegram message',
            description: JSON.stringify(agentContext),
            prompt: message,
            metadata: agentContext.metadata
          },
          timeout: 30000,
          retryConfig: {
            maxAttempts: 3,
            backoffMultiplier: 1.5,
            initialDelay: 1000,
            maxDelay: 30000
          }
        });

        task.setExecutor(this.agent);
        const result = await task.execute();

        // Store interaction in agent's memory
        await this.agent.memory.add({
          content: `Message: ${message}\nResponse: ${result.output}`,
          type: 'conversation',
          metadata: {
            chatId: ctx.chat.id,
            messageId: ctx.message.message_id,
            userId: ctx.from.id,
            sentiment,
            taskResult: result
          }
        });

        if (result.status === TaskStatus.COMPLETED && typeof result.output === 'string') {
          await this.sendMessage({
            chatId: ctx.chat.id,
            text: result.output,
            replyToMessageId: ctx.message.message_id
          });
        }
      } catch (error) {
        console.error('Telegram message processing error:', error);
      }
    });
  }

  async initialize(): Promise<TaskResult> {
    const startTime = new Date();
    try {
      // Set up custom command handlers
      this.commandHandlers.forEach(handler => {
        this.bot.command(handler.command, async (ctx: TelegrafContext) => {
          await handler.handler(ctx, this.agent);
        });
      });

      // Start the bot
      await this.bot.launch();

      const endTime = new Date();
      return {
        id: randomUUID(),
        status: TaskStatus.COMPLETED,
        output: { message: 'Telegram bot initialized successfully' },
        startedAt: startTime,
        completedAt: endTime,
        duration: endTime.getTime() - startTime.getTime()
      };
    } catch (error) {
      const endTime = new Date();
      return {
        id: randomUUID(),
        status: TaskStatus.FAILED,
        error: error instanceof Error ? error.message : 'Failed to initialize Telegram bot',
        startedAt: startTime,
        completedAt: endTime,
        duration: endTime.getTime() - startTime.getTime()
      };
    }
  }

  async sendMessage(options: MessageOptions): Promise<TaskResult> {
    const startTime = new Date();
    try {
      const result = await this.bot.telegram.sendMessage(
        options.chatId, 
        options.text, 
        {
          reply_to_message_id: options.replyToMessageId,
          parse_mode: options.parseMode
        }
      );

      const endTime = new Date();
      return {
        id: randomUUID(),
        status: TaskStatus.COMPLETED,
        output: result,
        startedAt: startTime,
        completedAt: endTime,
        duration: endTime.getTime() - startTime.getTime(),
        metrics: {
          tokenCount: options.text.length,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: options.text.length
        }
      };
    } catch (error) {
      const endTime = new Date();
      return {
        id: randomUUID(),
        status: TaskStatus.FAILED,
        error: error instanceof Error ? error.message : 'Failed to send Telegram message',
        startedAt: startTime,
        completedAt: endTime,
        duration: endTime.getTime() - startTime.getTime()
      };
    }
  }

  addCommandHandler(handler: CommandHandler): void {
    this.commandHandlers.push(handler);
  }

  async getChatInfo(chatId: number | string): Promise<TaskResult> {
    const startTime = new Date();
    try {
      const chat = await this.bot.telegram.getChat(chatId);
      const endTime = new Date();

      return {
        id: randomUUID(),
        status: TaskStatus.COMPLETED,
        output: chat,
        startedAt: startTime,
        completedAt: endTime,
        duration: endTime.getTime() - startTime.getTime()
      };
    } catch (error) {
      const endTime = new Date();
      return {
        id: randomUUID(),
        status: TaskStatus.FAILED,
        error: error instanceof Error ? error.message : 'Failed to retrieve chat information',
        startedAt: startTime,
        completedAt: endTime,
        duration: endTime.getTime() - startTime.getTime()
      };
    }
  }

  async getUserProfilePhotos(userId: number, options?: {
    offset?: number;
    limit?: number;
  }): Promise<TaskResult> {
    const startTime = new Date();
    try {
      const photos = await this.bot.telegram.getUserProfilePhotos(
        userId, 
        options?.offset, 
        options?.limit
      );

      const endTime = new Date();
      return {
        id: randomUUID(),
        status: TaskStatus.COMPLETED,
        output: photos,
        startedAt: startTime,
        completedAt: endTime,
        duration: endTime.getTime() - startTime.getTime()
      };
    } catch (error) {
      const endTime = new Date();
      return {
        id: randomUUID(),
        status: TaskStatus.FAILED,
        error: error instanceof Error ? error.message : 'Failed to retrieve user profile photos',
        startedAt: startTime,
        completedAt: endTime,
        duration: endTime.getTime() - startTime.getTime()
      };
    }
  }

  async automate(task: Task): Promise<TaskResult> {
    const startTime = new Date();
    try {
      // Create enhanced task for automation
      const automationTask = new Task({
        type: 'agent',
        executorId: this.agent.id,
        input: {
          name: task.toJSON().name,
          description: task.toJSON().input.description,
          prompt: task.toJSON().input.prompt,
          metadata: {
            ...task.toJSON().input.metadata,
            type: 'telegram_automation',
            importance: 0.8
          }
        },
        timeout: 30000,
        retryConfig: {
          maxAttempts: 3,
          backoffMultiplier: 1.5,
          initialDelay: 1000,
          maxDelay: 30000
        }
      });

      automationTask.setExecutor(this.agent);
      const result = await automationTask.execute();

      // Store automation result in memory
      await this.agent.memory.add({
        content: `Automation task: ${task.toJSON().name}\nResult: ${result.output}`,
        type: 'task',
        metadata: {
          taskId: task.id,
          automationType: 'telegram',
          result
        }
      });

      // Send automated message based on execution result
      const messageText = typeof result.output === 'string'
        ? result.output
        : JSON.stringify(result.output);

      const messageResult = await this.sendMessage({
        chatId: process.env.DEFAULT_TELEGRAM_CHAT_ID || '',
        text: messageText
      });

      const endTime = new Date();
      return {
        id: randomUUID(),
        status: TaskStatus.COMPLETED,
        output: {
          taskResult: result,
          messageSent: messageResult.status === TaskStatus.COMPLETED,
          messageLength: messageText.length
        },
        startedAt: startTime,
        completedAt: endTime,
        duration: endTime.getTime() - startTime.getTime(),
        metrics: {
          ...result.metrics
        }
      };
    } catch (error) {
      const endTime = new Date();
      return {
        id: randomUUID(),
        status: TaskStatus.FAILED,
        error: error instanceof Error ? error.message : 'Telegram automation failed',
        startedAt: startTime,
        completedAt: endTime,
        duration: endTime.getTime() - startTime.getTime()
      };
    }
  }

  async stop(): Promise<TaskResult> {
    const startTime = new Date();
    try {
      await this.bot.stop();
      const endTime = new Date();
      
      return {
        id: randomUUID(),
        status: TaskStatus.COMPLETED,
        output: { message: 'Telegram bot stopped successfully' },
        startedAt: startTime,
        completedAt: endTime,
        duration: endTime.getTime() - startTime.getTime()
      };
    } catch (error) {
      const endTime = new Date();
      return {
        id: randomUUID(),
        status: TaskStatus.FAILED,
        error: error instanceof Error ? error.message : 'Failed to stop Telegram bot',
        startedAt: startTime,
        completedAt: endTime,
        duration: endTime.getTime() - startTime.getTime()
      };
    }
  }
}
