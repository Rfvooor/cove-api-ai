// Social Media Integrations
export { TelegramIntegration } from './telegram';
export { TwitterIntegration } from './twitter';
export { DiscordIntegration } from './discord';

// Utility Integrations
export { WebScraper } from '../utils/web-scraper';
export { SentimentAnalyzer } from '../utils/sentiment-analyzer';
export { WebhookCronManager } from '../utils/webhook-cron';
export { ImageHandler } from '../utils/image-handler';

// Memory Integrations
export * from './memory';

// External Service Integrations
export { OpenRouterIntegration } from './openrouter';

// Webhook and Cron Task Types
export type { WebhookConfig, CronTaskConfig } from '../utils/webhook-cron';

// Image Processing Types
export type { ImageProcessingOptions } from '../utils/image-handler';

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