export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

export class Conversation {
  private _messages: ConversationMessage[] = [];
  private _systemPrompt?: string;

  constructor(systemPrompt?: string) {
    this._systemPrompt = systemPrompt;
    if (systemPrompt) {
      this.add({
        role: 'system',
        content: systemPrompt
      });
    }
  }

  add(message: ConversationMessage): void {
    message.timestamp = Date.now();
    this._messages.push(message);
  }

  getMessages(): ConversationMessage[] {
    return [...this._messages];
  }

  clear(): void {
    this._messages = this._systemPrompt 
      ? [{ role: 'system', content: this._systemPrompt }] 
      : [];
  }

  getLastMessage(): ConversationMessage | undefined {
    return this._messages[this._messages.length - 1];
  }

  getHistory(): string {
    return this._messages
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n');
  }

  return_history_as_string(): string {
    return this.getHistory();
  }

  to_dict(): ConversationMessage[] {
    return this._messages;
  }
}