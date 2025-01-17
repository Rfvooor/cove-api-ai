import { NodeConfig, NodeMetadata, NodeTemplate } from './node.js';
import { AgentInterface } from '../agent.js';

export interface StaticWorkflowNode {
  id: string;
  type: 'task' | 'decision' | 'parallel' | 'merge';
  agentSelection?: {
    // Direct selection by ID/name
    preferredAgentId?: string;
    preferredAgentName?: string;
    // Required tools by name
    requiredTools?: string[];
    // Capability-based selection (fallback)
    capabilities?: string[];
    minPerformance?: number;
    // Selection priority (higher number = higher priority)
    priority?: number;
  };
  config: {
    timeout?: number;
    retryStrategy?: RetryConfig;
    fallbackNode?: string;
  };
  next: string[];
}

export interface StaticWorkflow {
  nodes: Record<string, StaticWorkflowNode>;
  entryNode: string;
  exitNodes: string[];
  metadata: {
    name: string;
    description: string;
    version: string;
    tags: string[];
  };
}

export interface SubflowConfig {
  id: string;
  name: string;
  description: string;
  nodes: Record<string, StaticWorkflowNode>;
  entryNode: string;
  exitNodes: string[];
  inputMapping: Record<string, string>;
  outputMapping: Record<string, string>;
  metadata: {
    version: string;
    author?: string;
    created: string;
    updated: string;
    tags: string[];
  };
}

export interface RetryConfig {
  maxAttempts: number;
  backoffMultiplier: number;
  initialDelay?: number;
  maxDelay?: number;
}

export interface NodeTemplateLibrary {
  templates: Record<string, NodeTemplate>;
  categories: string[];
  metadata: {
    version: string;
    lastUpdated: string;
  };
}

export interface TriggerConfig {
  type: 'webhook' | 'schedule' | 'event' | 'social';
  config: WebhookTriggerConfig | ScheduleTriggerConfig | EventTriggerConfig | SocialTriggerConfig;
}

export interface WebhookTriggerConfig {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
}

export interface ScheduleTriggerConfig {
  schedule: string; // Cron expression
  timezone?: string;
}

export interface EventTriggerConfig {
  eventType: string;
  eventSource: string;
}

export interface SocialTriggerConfig {
  platform: 'twitter' | 'discord' | 'telegram';
  filters?: {
    keywords?: string[];
    accounts?: string[];
    hashtags?: string[];
  };
}

export interface EnhancedSwarmConfig {
  name?: string;
  description?: string;
  agents: AgentInterface[];
  executionMode: 'agentic' | 'static';
  swarm_type?: 'SequentialWorkflow' | 'CapabilityBased' | 'LoadBalanced' | 'CollaborativeSolving';
  max_loops?: number;
  collaboration_threshold?: number;
  timeout?: number;
  planning_mode?: 'Complete' | 'JIT';
  steps_per_plan?: number;
  retryConfig?: RetryConfig;
  staticWorkflow?: StaticWorkflow;
  agentIndexingConfig?: {
    indexingStrategy: 'semantic' | 'tag-based' | 'hybrid';
    updateFrequency: number;
    minCapabilityScore: number;
  };
}