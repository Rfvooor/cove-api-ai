import { Client, GatewayIntentBits, Message, TextChannel, isTextChannel, BaseChannel } from 'discord.js';
import { Agent } from '../core/agent.js';
import { WebScraper } from '../utils/web-scraper.js';
import { SentimentAnalyzer } from '../utils/sentiment-analyzer.js';
import { Task, TaskResult } from '../core/task.js';

export interface DiscordIntegrationConfig {
  token: string;
  clientId?: string;
  guildId?: string;
}

export interface MessageHandlerOptions {
  allowBots?: boolean;
  mentionOnly?: boolean;
  channels?: string[];
}

export interface MessageSendOptions {
  channelId: string;
  content: string;
  options?: {
    reply?: {
      messageId: string;
    };
    embed?: any; // You can create a more specific type for embeds
  };
}

export class DiscordIntegration {
  private client: Client;
  private agent: Agent;
  private webScraper: WebScraper;
  private sentimentAnalyzer: SentimentAnalyzer;
  private config: Required<DiscordIntegrationConfig>;

  constructor(config: DiscordIntegrationConfig, agent: Agent) {
    this.config = {
      token: config.token,
      clientId: config.clientId || '',
      guildId: config.guildId || ''
    };

    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });

    this.agent = agent;
    this.webScraper = new WebScraper();
    this.sentimentAnalyzer = new SentimentAnalyzer();

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.client.on('ready', () => {
      console.log(`Logged in as ${this.client.user?.tag}`);
    });

    this.client.on('messageCreate', async (message) => {
      try {
        await this.handleMessage(message);
      } catch (error) {
        console.error('Error processing Discord message:', error);
      }
    });
  }

  private async handleMessage(message: Message, options: MessageHandlerOptions = {}): Promise<void> {
    // Ignore messages from bots unless explicitly allowed
    if (message.author.bot && !options.allowBots) return;

    // Filter by channels if specified
    if (options.channels && options.channels.length > 0 && 
        !options.channels.includes(message.channelId)) return;

    // Check if bot is mentioned or message is in mention-only mode
    const isMentioned = message.mentions.has(this.client.user!);
    if (options.mentionOnly && !isMentioned) return;

    // Extract message content without bot mention
    const content = isMentioned 
      ? message.content.replace(/<@!?\d+>/g, '').trim() 
      : message.content;

    // Check for web links in the message
    const links = this.extractLinks(content);
    let additionalContext = '';

    // Scrape web content if links are present
    if (links.length > 0) {
      const scrapedContents = await Promise.all(
        links.map(link => this.webScraper.scrape(link))
      );
      additionalContext = scrapedContents.join('\n\n');
    }

    // Analyze sentiment
    const sentiment = this.sentimentAnalyzer.analyze(content);
    const sentimentClass = this.sentimentAnalyzer.classifySentiment(sentiment);

    // Prepare agent context with memory features
    const agentContext = {
      originalMessage: content,
      webContext: additionalContext,
      sentiment: {
        score: sentiment,
        classification: sentimentClass
      },
      metadata: {
        channelId: message.channelId,
        authorId: message.author.id,
        guildId: message.guildId,
        isConsolidated: false,
        consolidationScore: 0,
        importance: sentiment * 0.5 + (isMentioned ? 0.5 : 0), // Higher importance for mentions
        isArchived: false
      }
    };

    // Create and execute task with context
    const task = new Task({
      name: 'Process Discord message',
      description: JSON.stringify(agentContext),
      metadata: {
        type: 'discord_message',
        channelId: message.channelId,
        messageId: message.id,
        importance: agentContext.metadata.importance
      }
    });

    const result = await this.agent.execute(task);
    const agentResponse = result.success ? result.output : null;

    // Reply to the message
    if (typeof agentResponse === 'string') {
      await this.sendMessage({
        channelId: message.channelId,
        content: agentResponse,
        options: {
          reply: {
            messageId: message.id
          }
        }
      });
    }
  }

  private extractLinks(text: string): string[] {
    const linkRegex = /(https?:\/\/[^\s]+)/g;
    return (text.match(linkRegex) || []);
  }

  async connect(): Promise<TaskResult> {
    try {
      await this.client.login(this.config.token);
      return {
        success: true,
        data: { message: 'Discord bot connected successfully' }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to connect Discord bot'
      };
    }
  }

  async sendMessage(options: MessageSendOptions): Promise<TaskResult> {
    try {
      const channel: BaseChannel | null = await this.client.channels.fetch(options.channelId);
      
      if (!isTextChannel(channel)) {
        throw new Error('Invalid channel: not a text channel');
      }

      const messageOptions: any = { 
        content: options.content 
      };

      if (options.options?.reply) {
        messageOptions.reply = { 
          messageReference: options.options.reply.messageId 
        };
      }

      if (options.options?.embed) {
        messageOptions.embeds = [options.options.embed];
      }

      await channel.send(messageOptions);

      return {
        success: true,
        data: { message: 'Message sent successfully' }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send Discord message'
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
          type: 'discord_automation',
          importance: 0.8, // High importance for automated tasks
          isConsolidated: false,
          consolidationScore: 0,
          isArchived: false
        }
      });
  
      const result = await this.agent.execute(automationTask);
  
      // Send automated message based on execution result
      const messageResult = await this.sendMessage({
        channelId: process.env.DEFAULT_DISCORD_CHANNEL_ID || '',
        content: typeof result.output === 'string'
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
        error: error instanceof Error ? error.message : 'Discord automation failed'
      };
    }
  }

  async disconnect(): Promise<TaskResult> {
    try {
      this.client.destroy();
      return {
        success: true,
        data: { message: 'Discord bot disconnected successfully' }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to disconnect Discord bot'
      };
    }
  }
}