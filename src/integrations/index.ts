// Social Media Integrations
export { TelegramIntegration } from './telegram.js';
export { TwitterIntegration } from './twitter.js';
export { DiscordIntegration } from './discord.js';

// Utility Integrations
export { WebScraper } from '../utils/web-scraper.js';
export { SentimentAnalyzer } from '../utils/sentiment-analyzer.js';
export { WebhookCronManager } from '../utils/webhook-cron.js';
export { ImageHandler } from '../utils/image-handler.js';

// Memory Integrations
export * from './memory/index.js';

// External Service Integrations
export { OpenRouterIntegration } from './language-models/openrouter.js';

// Webhook and Cron Task Types
export type { WebhookConfig, CronTaskConfig } from '../utils/webhook-cron.js';

// Image Processing Types
export type { ImageProcessingOptions } from '../utils/image-handler.js';

// Comprehensive Integration Configuration
export interface IntegrationConfig {
  telegram?: {
    token: string;
  };
  twitter?: {
    appKey: string;
    appSecret: string;
    accessToken: string;
    accessSecret: string;
  };
  discord?: {
    token: string;
  };
  openRouter?: {
    apiKey: string;
  };
  webhooks?: {
    port?: number;
  };
  imageProcessing?: {
    storageDir?: string;
  };
}