export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: number;
  metadata?: {
    tokens?: number;
    model?: string;
    completionTokens?: number;
    promptTokens?: number;
    cost?: number;
    toolCalls?: string[];
    error?: string;
    type?: string;
    planSteps?: number;
    status?: string;
    [key: string]: any;
  };
}

export interface ConversationMetrics {
  messageCount: number;
  totalTokens: number;
  totalCost: number;
  averageResponseTime: number;
  errorRate: number;
  toolUsage: Record<string, number>;
}

export class Conversation {
  private _messages: ConversationMessage[] = [];
  private _systemPrompt?: string;
  private _metrics: ConversationMetrics = {
    messageCount: 0,
    totalTokens: 0,
    totalCost: 0,
    averageResponseTime: 0,
    errorRate: 0,
    toolUsage: {}
  };

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
    if (!message.content) {
      throw new Error('Message content cannot be empty');
    }

    message.timestamp = Date.now();
    this._messages.push(message);
    this.updateMetrics(message);
  }

  private updateMetrics(message: ConversationMessage): void {
    this._metrics.messageCount++;

    if (message.metadata) {
      // Update token counts
      if (message.metadata.tokens) {
        this._metrics.totalTokens += message.metadata.tokens;
      }
      if (message.metadata.completionTokens) {
        this._metrics.totalTokens += message.metadata.completionTokens;
      }
      if (message.metadata.promptTokens) {
        this._metrics.totalTokens += message.metadata.promptTokens;
      }

      // Update cost
      if (message.metadata.cost) {
        this._metrics.totalCost += message.metadata.cost;
      }

      // Update tool usage
      if (message.metadata.toolCalls) {
        message.metadata.toolCalls.forEach(tool => {
          this._metrics.toolUsage[tool] = (this._metrics.toolUsage[tool] || 0) + 1;
        });
      }

      // Update error rate
      if (message.metadata.error) {
        this._metrics.errorRate = 
          (this._metrics.errorRate * (this._metrics.messageCount - 1) + 1) / 
          this._metrics.messageCount;
      } else {
        this._metrics.errorRate = 
          (this._metrics.errorRate * (this._metrics.messageCount - 1)) / 
          this._metrics.messageCount;
      }
    }

    // Update average response time for assistant messages
    if (message.role === 'assistant' && message.timestamp) {
      const lastUserMessage = this.findLastUserMessage();
      if (lastUserMessage?.timestamp) {
        const responseTime = message.timestamp - lastUserMessage.timestamp;
        this._metrics.averageResponseTime = 
          (this._metrics.averageResponseTime * (this._metrics.messageCount - 1) + responseTime) / 
          this._metrics.messageCount;
      }
    }
  }

  private findLastUserMessage(): ConversationMessage | undefined {
    for (let i = this._messages.length - 1; i >= 0; i--) {
      if (this._messages[i].role === 'user') {
        return this._messages[i];
      }
    }
    return undefined;
  }

  getMessages(): ConversationMessage[] {
    return [...this._messages];
  }

  getMessagesByRole(role: ConversationMessage['role']): ConversationMessage[] {
    return this._messages.filter(msg => msg.role === role);
  }

  getMessagesInTimeRange(startTime: number, endTime: number): ConversationMessage[] {
    return this._messages.filter(msg => {
      const timestamp = msg.timestamp || 0;
      return timestamp >= startTime && timestamp <= endTime;
    });
  }

  clear(): void {
    this._messages = this._systemPrompt 
      ? [{ role: 'system', content: this._systemPrompt }] 
      : [];
    
    // Reset metrics
    this._metrics = {
      messageCount: this._systemPrompt ? 1 : 0,
      totalTokens: 0,
      totalCost: 0,
      averageResponseTime: 0,
      errorRate: 0,
      toolUsage: {}
    };
  }

  getLastMessage(): ConversationMessage | undefined {
    return this._messages[this._messages.length - 1];
  }

  getHistory(options?: {
    maxMessages?: number;
    includeSystem?: boolean;
    format?: 'string' | 'structured'
  }): string | ConversationMessage[] {
    let messages = this._messages;

    if (options?.includeSystem === false) {
      messages = messages.filter(msg => msg.role !== 'system');
    }

    if (options?.maxMessages) {
      messages = messages.slice(-options.maxMessages);
    }

    if (options?.format === 'structured') {
      return messages;
    }

    return messages
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n');
  }

  getMetrics(): ConversationMetrics {
    return { ...this._metrics };
  }

  getSystemPrompt(): string | undefined {
    return this._systemPrompt;
  }

  setSystemPrompt(prompt: string): void {
    this._systemPrompt = prompt;
    const systemMessages = this._messages.filter(msg => msg.role === 'system');
    if (systemMessages.length > 0) {
      systemMessages[0].content = prompt;
    } else {
      this._messages.unshift({
        role: 'system',
        content: prompt,
        timestamp: Date.now()
      });
    }
  }

  toJSON(): {
    messages: ConversationMessage[];
    metrics: ConversationMetrics;
    systemPrompt?: string;
  } {
    return {
      messages: this._messages,
      metrics: this._metrics,
      systemPrompt: this._systemPrompt
    };
  }
}