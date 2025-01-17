import { ErrorType } from '../core/base-language-model.js';

export function classifyError(error: unknown): ErrorType {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('rate limit')) return 'rate_limit';
    if (message.includes('context length')) return 'context_length';
    if (message.includes('token limit')) return 'token_limit';
    if (message.includes('content filter')) return 'content_filter';
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('api')) return 'api_error';
  }
  return 'other';
}