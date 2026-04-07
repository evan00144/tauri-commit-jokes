export type ErrorCode =
  | "quota_exhausted"
  | "git_unavailable"
  | "not_a_repo"
  | "no_staged_changes"
  | "diff_too_large"
  | "provider_timeout"
  | "provider_error";

export type ViewState =
  | "invalid_launch_context"
  | "no_staged_changes"
  | "ready_to_generate"
  | "generating"
  | "generation_success"
  | "generation_error";

export type RepoContextResult = {
  launchPath: string;
  gitAvailable: boolean;
  isRepo: boolean;
  repoRoot: string | null;
  repoName: string | null;
  errorCode: ErrorCode | null;
};

export type RepoStatusResult = {
  repoRoot: string;
  repoName: string;
  hasStagedChanges: boolean;
  stagedFileCount: number;
  diffByteSize: number;
  errorCode: ErrorCode | null;
};

export type ServiceStatusResult = {
  ok: boolean;
  serviceName: string;
  modelName: string;
  baseUrl: string;
  errorCode: ErrorCode | null;
};

export type GenerateCommitMessageResult = {
  success: boolean;
  message: string | null;
  analysis: string | null;
  modelName: string;
  promptVersion: string;
  errorCode: ErrorCode | null;
};
