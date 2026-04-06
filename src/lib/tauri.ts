import { invoke } from "@tauri-apps/api/core";
import type {
  ApiKeyStatusResult,
  GenerateCommitMessageResult,
  RepoContextResult,
  RepoStatusResult,
  SaveApiKeyResult,
} from "../types/contracts";

export function initContext(cwd: string) {
  return invoke<RepoContextResult>("init_context", { cwd });
}

export function getRepoStatus(repoRoot: string) {
  return invoke<RepoStatusResult>("get_repo_status", { repoRoot });
}

export function saveApiKey(apiKey: string) {
  return invoke<SaveApiKeyResult>("save_api_key", { apiKey });
}

export function getApiKeyStatus() {
  return invoke<ApiKeyStatusResult>("get_api_key_status");
}

export function generateCommitMessage(repoRoot: string) {
  return invoke<GenerateCommitMessageResult>("generate_commit_message", {
    repoRoot,
  });
}
