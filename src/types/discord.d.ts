declare module 'discord.js' {
  import { EventEmitter } from 'events';

  export enum GatewayIntentBits {
    Guilds = 1 << 0,
    GuildMessages = 1 << 9,
    MessageContent = 1 << 15
  }

  export interface ClientOptions {
    intents: GatewayIntentBits[];
  }

  export interface Message {
    id: string;
    content: string;
    author: User;
    channelId: string;
    guildId?: string;
    mentions: {
      has(user: User): boolean;
    };
    reply(options: string | MessageReplyOptions): Promise<Message>;
  }

  export interface MessageReplyOptions {
    content: string;
    allowedMentions?: {
      repliedUser?: boolean;
    };
  }

  export interface User {
    id: string;
    tag: string;
    bot: boolean;
  }

  export interface Guild {
    id: string;
    name: string;
  }

  export type ChannelType = 
    | 'GUILD_TEXT'
    | 'DM'
    | 'GUILD_VOICE'
    | 'GROUP_DM'
    | 'GUILD_CATEGORY'
    | 'GUILD_NEWS'
    | 'GUILD_STORE';

  export interface BaseChannel {
    id: string;
    type: ChannelType;
  }

  export interface TextChannel extends BaseChannel {
    type: 'GUILD_TEXT';
    send(options: string | MessageSendOptions): Promise<Message>;
  }

  export interface MessageSendOptions {
    content: string;
    reply?: {
      messageReference: string;
    };
    embeds?: any[];
  }

  export interface ChannelManager {
    fetch(channelId: string): Promise<BaseChannel | null>;
  }

  export function isTextChannel(channel: BaseChannel | null): channel is TextChannel {
    return channel !== null && channel.type === 'GUILD_TEXT';
  }

  export class Client extends EventEmitter {
    user?: User;
    channels: ChannelManager;

    constructor(options?: ClientOptions);
    
    on(event: 'ready', listener: () => void): this;
    on(event: 'messageCreate', listener: (message: Message) => void): this;
    
    login(token: string): Promise<string>;
    destroy(): void;
  }

  export default Client;
}