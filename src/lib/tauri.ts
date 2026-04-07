import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import type {
  GenerateCommitMessageResult,
  RepoContextResult,
  RepoStatusResult,
  ServiceStatusResult,
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

export function getServiceStatus() {
  return invoke<ServiceStatusResult>("get_service_status");
}

export function generateCommitMessage(repoRoot: string) {
  return invoke<GenerateCommitMessageResult>("generate_commit_message", { repoRoot });
}

export function openExternal(url: string) {
  return openUrl(url);
}
