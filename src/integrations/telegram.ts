import Telegraf, { Context as TelegrafContext } from 'telegraf';
import { Agent } from '../core/agent.js';
import { SentimentAnalyzer } from '../utils/sentiment-analyzer.js';
import { Task, TaskResult } from '../core/task.js';

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
            importance: sentiment * 0.6 + 0.4, // Base importance on sentiment with minimum threshold
            isConsolidated: false,
            consolidationScore: 0,
            isArchived: false
          }
        };

        const task = new Task({
          name: 'Process Telegram message',
          description: JSON.stringify(agentContext),
          metadata: agentContext.metadata
        });

        const result = await this.agent.execute(task);
        const agentResponse = result.success ? result.output : null;

        if (typeof agentResponse === 'string') {
          await this.sendMessage({
            chatId: ctx.chat.id,
            text: agentResponse,
            replyToMessageId: ctx.message.message_id
          });
        }
      } catch (error) {
        console.error('Telegram message processing error:', error);
      }
    });
  }

  async initialize(): Promise<TaskResult> {
    try {
      // Set up custom command handlers
      this.commandHandlers.forEach(handler => {
        this.bot.command(handler.command, async (ctx: TelegrafContext) => {
          await handler.handler(ctx, this.agent);
        });
      });

      // Start the bot
      await this.bot.initialize();
      await this.bot.launch();

      return {
        success: true,
        data: { message: 'Telegram bot initialized successfully' }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initialize Telegram bot'
      };
    }
  }

  async sendMessage(options: MessageOptions): Promise<TaskResult> {
    try {
      const result = await this.bot.telegram.sendMessage(
        options.chatId, 
        options.text, 
        {
          reply_to_message_id: options.replyToMessageId,
          parse_mode: options.parseMode
        }
      );

      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send Telegram message'
      };
    }
  }

  addCommandHandler(handler: CommandHandler): void {
    this.commandHandlers.push(handler);
  }

  async getChatInfo(chatId: number | string): Promise<TaskResult> {
    try {
      const chat = await this.bot.telegram.getChat(chatId);

      return {
        success: true,
        data: chat
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve chat information'
      };
    }
  }

  async getUserProfilePhotos(userId: number, options?: {
    offset?: number;
    limit?: number;
  }): Promise<TaskResult> {
    try {
      const photos = await this.bot.telegram.getUserProfilePhotos(
        userId, 
        options?.offset, 
        options?.limit
      );

      return {
        success: true,
        data: photos
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve user profile photos'
      };
    }
  }

  async automate(task: Task): Promise<TaskResult> {
    try {
      // Create enhanced task for automation
      const automationTask = new Task({
        name: task.name,
        description: task.description,
        metadata: {
          ...task.metadata,
          type: 'telegram_automation',
          importance: 0.8, // High importance for automated tasks
          isConsolidated: false,
          consolidationScore: 0,
          isArchived: false
        }
      });

      const result = await this.agent.execute(automationTask);

      // Send automated message based on execution result
      const messageResult = await this.sendMessage({
        chatId: process.env.DEFAULT_TELEGRAM_CHAT_ID || '',
        text: typeof result.output === 'string'
          ? result.output
          : JSON.stringify(result.output)
      });

      return {
        success: true,
        data: {
          taskResult: result,
          messageSent: messageResult.success
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Telegram automation failed'
      };
    }
  }

  async stop(): Promise<TaskResult> {
    try {
      this.bot.stop();
      return {
        success: true,
        data: { message: 'Telegram bot stopped successfully' }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to stop Telegram bot'
      };
    }
  }
}
