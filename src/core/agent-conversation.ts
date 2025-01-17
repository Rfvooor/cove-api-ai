import { Conversation } from './conversation.js';
import { TaskInput } from './task.js';
import { Tool } from './tool.js';

export interface ConversationMetrics {
  totalConversations: number;
  activeConversations: number;
  averageMessagesPerConversation: number;
  totalMessages: number;
  messagesByRole: {
    user: number;
    assistant: number;
    system: number;
  };
}

export class ConversationManager {
  private conversations: Map<string, Conversation>;
  private systemPrompt: string;

  constructor(systemPrompt: string) {
    this.conversations = new Map();
    this.systemPrompt = systemPrompt;
  }

  getOrCreate(chatId?: string): Conversation {
    const conversationId = chatId || 'default';
    let conversation = this.conversations.get(conversationId);
    
    if (!conversation) {
      conversation = new Conversation(this.systemPrompt);
      this.conversations.set(conversationId, conversation);
    }
    
    return conversation;
  }

  addUserMessage(input: TaskInput, conversation: Conversation): void {
    conversation.add({
      role: 'user',
      content: input.prompt,
      timestamp: Date.now(),
      metadata: {
        tokens: input.prompt.length, // Rough estimate
        ...Object.entries(input.metadata || {})
          .filter(([key]) => ['model', 'cost', 'tokens'].includes(key))
          .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {})
      }
    });
  }

  addAssistantMessage(
    conversation: Conversation,
    response: string,
    metadata: {
      completionTokens: number;
      promptTokens: number;
      toolCalls?: string[];
      model?: string;
    }
  ): void {
    conversation.add({
      role: 'assistant',
      content: response,
      metadata: {
        completionTokens: metadata.completionTokens,
        promptTokens: metadata.promptTokens,
        toolCalls: metadata.toolCalls,
        model: metadata.model
      }
    });
  }

  getHistory(conversation: Conversation, maxMessages: number = 5): string {
    const history = conversation.getHistory({ 
      maxMessages,
      format: 'structured'
    });

    if (Array.isArray(history)) {
      return history
        .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
        .join('\n');
    }

    return typeof history === 'string' ? history : '';
  }

  getToolContext(tools: Tool[]): string {
    return tools
      .map(tool => `${tool.name}: ${tool.description}`)
      .join('\n');
  }

  buildPrompt(
    input: TaskInput,
    conversation: Conversation,
    tools: Tool[]
  ): string {
    const history = this.getHistory(conversation);
    const toolContext = this.getToolContext(tools);

    return `
Available Tools:
${toolContext}

Conversation History:
${history}
Assistant: Let me think about this carefully.`;
  }

  updateSystemPrompt(newPrompt: string): void {
    this.systemPrompt = newPrompt;
    for (const conversation of this.conversations.values()) {
      conversation.setSystemPrompt(newPrompt);
    }
  }

  clear(chatId?: string): void {
    if (chatId) {
      this.conversations.delete(chatId);
    } else {
      this.conversations.clear();
    }
  }

  getMetrics(chatId?: string): ConversationMetrics {
    const allConversations = Array.from(this.conversations.values());
    const targetConversations = chatId 
      ? allConversations.filter(conv => {
          const history = conv.getHistory({ format: 'structured' });
          return Array.isArray(history) && history.some(msg => msg.metadata?.chatId === chatId);
        })
      : allConversations;

    const stats = targetConversations.reduce(
      (acc, conv) => {
        const messages = conv.getHistory({ format: 'structured' });
        if (!Array.isArray(messages)) return acc;

        const messageCount = messages.length;
        const hasMessages = messageCount > 0;

        // Count messages by role
        messages.forEach(msg => {
          if (msg.role === 'user') acc.messagesByRole.user++;
          else if (msg.role === 'assistant') acc.messagesByRole.assistant++;
          else if (msg.role === 'system') acc.messagesByRole.system++;
        });

        return {
          totalMessages: acc.totalMessages + messageCount,
          activeConversations: acc.activeConversations + (hasMessages ? 1 : 0),
          messagesByRole: acc.messagesByRole
        };
      },
      {
        totalMessages: 0,
        activeConversations: 0,
        messagesByRole: { user: 0, assistant: 0, system: 0 }
      }
    );

    return {
      totalConversations: this.conversations.size,
      activeConversations: stats.activeConversations,
      averageMessagesPerConversation: stats.totalMessages / Math.max(stats.activeConversations, 1),
      totalMessages: stats.totalMessages,
      messagesByRole: stats.messagesByRole
    };
  }
}