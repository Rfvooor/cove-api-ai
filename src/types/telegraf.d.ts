declare module 'telegraf' {
  import { Update, Message, Chat, User } from 'telegraf/typings/core/types/typegram';

  export interface Context {
    message: Message.TextMessage;
    chat: Chat;
    from: User;
    reply(text: string, extra?: ExtraReply): Promise<Message>;
    telegram: {
      sendMessage(
        chatId: number | string, 
        text: string, 
        extra?: ExtraReply
      ): Promise<Message>;
      getChat(chatId: number | string): Promise<Chat>;
      getUserProfilePhotos(
        userId: number, 
        offset?: number, 
        limit?: number
      ): Promise<UserProfilePhotos>;
    };
  }

  export interface ExtraReply {
    reply_to_message_id?: number;
    parse_mode?: 'HTML' | 'Markdown' | 'MarkdownV2';
  }

  export interface UserProfilePhotos {
    total_count: number;
    photos: PhotoSize[][];
  }

  export interface PhotoSize {
    file_id: string;
    file_unique_id: string;
    width: number;
    height: number;
    file_size?: number;
  }

  export class Telegraf {
    constructor(token: string);
    
    on(
      event: string, 
      handler: (ctx: Context) => Promise<void>
    ): void;

    command(
      command: string, 
      handler: (ctx: Context) => Promise<void>
    ): void;

    initialize(): Promise<void>;
    launch(): Promise<void>;
    stop(): void;

    telegram: {
      sendMessage(
        chatId: number | string, 
        text: string, 
        extra?: ExtraReply
      ): Promise<Message>;
      getChat(chatId: number | string): Promise<Chat>;
      getUserProfilePhotos(
        userId: number, 
        offset?: number, 
        limit?: number
      ): Promise<UserProfilePhotos>;
    };
  }

  export default Telegraf;
}

declare module 'telegraf/typings/core/types/typegram' {
  export interface Update {
    message?: Message;
  }

  export interface Message {
    message_id: number;
    text?: string;
  }

  export interface Chat {
    id: number;
    type: string;
    title?: string;
    username?: string;
  }

  export interface User {
    id: number;
    is_bot: boolean;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
  }
}