import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import type {
  ApiKeyStatusResult,
  GenerateCommitMessageResult,
  RepoContextResult,
  RepoStatusResult,
} from "../types/contracts";

export function initContext(cwd: string) {
  return invoke<RepoContextResult>("init_context", { cwd });
}

export function getRepoStatus(repoRoot: string) {
  return invoke<RepoStatusResult>("get_repo_status", { repoRoot });
}

export function chooseRepoRoot() {
  return invoke<string | null>("choose_repo_root");
}

export function getApiKeyStatus(cwd: string) {
  return invoke<ApiKeyStatusResult>("get_api_key_status", { cwd });
}

export function setModelPreference(cwd: string, modelName: string) {
  return invoke<ApiKeyStatusResult>("set_model_preference", { cwd, modelName });
}

export function generateCommitMessage(repoRoot: string, generationNonce: number) {
  return invoke<GenerateCommitMessageResult>("generate_commit_message", {
    repoRoot,
    generationNonce,
  });
}

export function openExternal(url: string) {
  return openUrl(url);
}
