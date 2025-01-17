import { AgentInterface } from './interfaces.js';

export type AgentType = 'summarizer' | 'analyzer' | 'researcher' | 'custom';
export type CapabilityType = 'tool' | 'skill' | 'knowledge';

export interface AgentCapability {
  name: string;
  description: string;
  type: CapabilityType;
  tags: string[];
  requirements?: {
    memory?: number;
    cpu?: number;
    gpu?: boolean;
  };
}

export interface AgentTemplate {
  name: string;
  description: string;
  type: AgentType;
  systemPrompt: string;
  defaultTools: string[];
  contextConfig: {
    maxTokens: number;
    relevanceThreshold: number;
  };
}

export interface AgentTool {
  name: string;
  description: string;
  category: string;
  implementation: string;
}

export interface AgentIndex {
  id: string;
  name: string;
  capabilities: AgentCapability[];
  performance: {
    successRate: number;
    averageExecutionTime: number;
    specializations: string[];
  };
}

export interface PlanningAgentConfig {
  embeddingModel: string;
  contextWindow: number;
  maxTokens: number;
  temperature: number;
  ragConfig: {
    vectorStore: string;
    similarityThreshold: number;
    maxContextDocs: number;
  };
}

export interface AgentPerformanceHistory {
  tasksHandled: number;
  successCount: number;
  totalExecutionTime: number;
}

export interface AgentActionPlan {
  steps: string[];
  estimatedSteps: number;
  fallbacks: string[];
}

export interface AgentTaskAnalysis {
  capabilities: string[];
  complexity: number;
  specialization: string[];
  requiredActions: string[];
  contextDependencies: string[];
}

export interface AgentSelectionResult {
  agent: AgentInterface;
  actionPlan?: AgentActionPlan;
  score?: number;
}

export { AgentInterface };