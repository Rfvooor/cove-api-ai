import Octokit from '@octokit/rest';
import { Agent } from '../core/agent.js';
import { Task, TaskStatus, TaskResult } from '../core/task.js';

export interface GitHubIntegrationConfig {
  token: string;
  owner?: string;
  repo?: string;
}

export interface IssueConfig {
  title: string;
  body?: string;
  assignees?: string[];
  labels?: string[];
}

export interface PullRequestConfig {
  base: string;
  head: string;
  title: string;
  body?: string;
}

export interface WorkflowDispatchConfig {
  workflow_id: string;
  ref: string;
  inputs?: Record<string, string>;
}

export class GitHubIntegration {
  private client: Octokit;
  private agent: Agent;
  private config: Required<GitHubIntegrationConfig>;

  constructor(config: GitHubIntegrationConfig, agent: Agent) {
    this.config = {
      token: config.token,
      owner: config.owner || '',
      repo: config.repo || ''
    };

    this.client = new Octokit({ 
      auth: this.config.token 
    });

    this.agent = agent;
  }

  async createIssue(config: IssueConfig): Promise<TaskResult> {
    try {
      const response = await this.client.issues.create({
        owner: this.config.owner,
        repo: this.config.repo,
        title: config.title,
        body: config.body || '',
        assignees: config.assignees,
        labels: config.labels
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create issue'
      };
    }
  }

  async createPullRequest(config: PullRequestConfig): Promise<TaskResult> {
    try {
      const response = await this.client.pulls.create({
        owner: this.config.owner,
        repo: this.config.repo,
        base: config.base,
        head: config.head,
        title: config.title,
        body: config.body || ''
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create pull request'
      };
    }
  }

  async dispatchWorkflow(config: WorkflowDispatchConfig): Promise<TaskResult> {
    try {
      const response = await this.client.actions.createWorkflowDispatch({
        owner: this.config.owner,
        repo: this.config.repo,
        workflow_id: config.workflow_id,
        ref: config.ref,
        inputs: config.inputs
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to dispatch workflow'
      };
    }
  }

  async listRepositoryIssues(state: 'open' | 'closed' | 'all' = 'open'): Promise<TaskResult> {
    try {
      const response = await this.client.issues.listForRepo({
        owner: this.config.owner,
        repo: this.config.repo,
        state
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list repository issues'
      };
    }
  }

  async getRepositoryInfo(): Promise<TaskResult> {
    try {
      const response = await this.client.repos.get({
        owner: this.config.owner,
        repo: this.config.repo
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get repository information'
      };
    }
  }

  async commentOnIssue(issueNumber: number, body: string): Promise<TaskResult> {
    try {
      const response = await this.client.issues.createComment({
        owner: this.config.owner,
        repo: this.config.repo,
        issue_number: issueNumber,
        body
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to comment on issue'
      };
    }
  }

  async closeIssue(issueNumber: number): Promise<TaskResult> {
    try {
      const response = await this.client.issues.update({
        owner: this.config.owner,
        repo: this.config.repo,
        issue_number: issueNumber,
        state: 'closed'
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to close issue'
      };
    }
  }

  async mergePullRequest(pullNumber: number): Promise<TaskResult> {
    try {
      const response = await this.client.pulls.merge({
        owner: this.config.owner,
        repo: this.config.repo,
        pull_number: pullNumber
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to merge pull request'
      };
    }
  }

  async getLatestCommit(branch: string = 'main'): Promise<TaskResult> {
    try {
      const response = await this.client.repos.getCommit({
        owner: this.config.owner,
        repo: this.config.repo,
        ref: branch
      });

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get latest commit'
      };
    }
  }

  async automate(task: Task): Promise<TaskResult> {
    // Example of an automated GitHub workflow using the agent
    try {
      const repositoryInfo = await this.getRepositoryInfo();
      if (!repositoryInfo.success) {
        return repositoryInfo;
      }

      // Prepare context for agent analysis
      const context = JSON.stringify({
        repository: repositoryInfo.data,
        task: task.toJSON()
      });

      // Create enhanced task for repository analysis
      const analysisTask = new Task({
        name: 'Analyze GitHub repository',
        description: context,
        metadata: {
          type: 'github_analysis',
          importance: 0.9, // High importance for repository analysis
          isConsolidated: false,
          consolidationScore: 0,
          isArchived: false,
          repositoryName: this.config.repo,
          ownerName: this.config.owner
        }
      });

      const result = await this.agent.execute(analysisTask);

      // Create an issue based on analysis result
      const issueResult = await this.createIssue({
        title: 'Repository Improvement Suggestions',
        body: typeof result.output === 'string'
          ? result.output
          : JSON.stringify(result.output),
        labels: ['enhancement', 'agent-generated']
      });

      return {
        success: true,
        data: {
          repositoryInfo: repositoryInfo.data,
          analysisResult: result,
          issueCreated: issueResult.success
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'GitHub automation failed'
      };
    }
  }
}