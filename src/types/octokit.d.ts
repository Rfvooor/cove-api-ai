declare module '@octokit/rest' {
  export interface OctokitOptions {
    auth?: string;
  }

  export interface IssueCreateParams {
    owner: string;
    repo: string;
    title: string;
    body?: string;
    assignees?: string[];
    labels?: string[];
  }

  export interface PullRequestCreateParams {
    owner: string;
    repo: string;
    base: string;
    head: string;
    title: string;
    body?: string;
  }

  export interface WorkflowDispatchParams {
    owner: string;
    repo: string;
    workflow_id: string;
    ref: string;
    inputs?: Record<string, string>;
  }

  export interface IssueListParams {
    owner: string;
    repo: string;
    state?: 'open' | 'closed' | 'all';
  }

  export interface RepoGetParams {
    owner: string;
    repo: string;
  }

  export interface IssueCommentCreateParams {
    owner: string;
    repo: string;
    issue_number: number;
    body: string;
  }

  export interface IssueUpdateParams {
    owner: string;
    repo: string;
    issue_number: number;
    state: 'open' | 'closed';
  }

  export interface PullRequestMergeParams {
    owner: string;
    repo: string;
    pull_number: number;
  }

  export interface RepoGetCommitParams {
    owner: string;
    repo: string;
    ref: string;
  }

  export class Octokit {
    constructor(options?: OctokitOptions);

    issues: {
      create(params: IssueCreateParams): Promise<{ data: any }>;
      listForRepo(params: IssueListParams): Promise<{ data: any[] }>;
      createComment(params: IssueCommentCreateParams): Promise<{ data: any }>;
      update(params: IssueUpdateParams): Promise<{ data: any }>;
    };

    pulls: {
      create(params: PullRequestCreateParams): Promise<{ data: any }>;
      merge(params: PullRequestMergeParams): Promise<{ data: any }>;
    };

    actions: {
      createWorkflowDispatch(params: WorkflowDispatchParams): Promise<{ data: any }>;
    };

    repos: {
      get(params: RepoGetParams): Promise<{ data: any }>;
      getCommit(params: RepoGetCommitParams): Promise<{ data: any }>;
    };
  }

  export default Octokit;
}