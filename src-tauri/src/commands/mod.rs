use std::path::Path;

use rfd::FileDialog;
use tauri::State;

use crate::{
    ai, git,
    models::{
        GenerateCommitMessageResult, RepoContextResult, RepoStatusResult, ServiceStatusResult,
        DIFF_BYTE_LIMIT, PROMPT_VERSION,
    },
};

#[derive(Clone)]
pub struct LaunchContext {
    pub cwd: Option<String>,
}

pub struct AppState {
    pub launch: LaunchContext,
}

fn active_launch_path(input: &str, launch: &LaunchContext) -> String {
    if input.trim().is_empty() {
        return launch.cwd.clone().unwrap_or_default();
    }

    input.trim().to_string()
}

#[tauri::command]
pub fn choose_repo_root() -> Option<String> {
    FileDialog::new()
        .pick_folder()
        .map(|path| path.display().to_string())
}

#[tauri::command]
pub fn init_context(cwd: String, state: State<'_, AppState>) -> RepoContextResult {
    let launch_path = active_launch_path(&cwd, &state.launch);

    if launch_path.is_empty() {
        return RepoContextResult::invalid(launch_path, true, Some("not_a_repo"));
    }

    match git::resolve_repo_root(&launch_path) {
        Ok(repo_root) => RepoContextResult::ready(launch_path, repo_root),
        Err(error) => {
            let git_available = error.error_code() != "git_unavailable";
            RepoContextResult::invalid(launch_path, git_available, Some(error.error_code()))
        }
    }
}

#[tauri::command]
pub fn get_repo_status(repo_root: String) -> RepoStatusResult {
    let repo_path = Path::new(&repo_root);
    let repo_name = git::repo_name(repo_path);

    match git::read_repo_status(repo_path) {
        Ok(status) => RepoStatusResult {
            repo_root,
            repo_name,
            has_staged_changes: status.has_staged_changes,
            staged_file_count: status.staged_file_count,
            diff_byte_size: status.diff_byte_size,
            error_code: if status.has_staged_changes {
                None
            } else {
                Some("no_staged_changes".into())
            },
        },
        Err(error) => RepoStatusResult {
            repo_root,
            repo_name,
            has_staged_changes: false,
            staged_file_count: 0,
            diff_byte_size: 0,
            error_code: Some(error.error_code().into()),
        },
    }
}

#[tauri::command]
pub async fn get_service_status() -> ServiceStatusResult {
    match ai::get_service_health().await {
        Ok(health) => ServiceStatusResult::available(health.service, health.model),
        Err(error) => ServiceStatusResult::unavailable(error.error_code()),
    }
}

#[tauri::command]
pub async fn generate_commit_message(repo_root: String) -> GenerateCommitMessageResult {
    let repo_path = Path::new(&repo_root);

    let staged_status = match git::read_staged_name_status(repo_path) {
        Ok(status) => status,
        Err(error) => return GenerateCommitMessageResult::failure(error.error_code()),
    };

    let diff = match git::read_staged_diff(repo_path) {
        Ok(diff) => diff,
        Err(error) => return GenerateCommitMessageResult::failure(error.error_code()),
    };

    if staged_status.trim().is_empty() && diff.trim().is_empty() {
        return GenerateCommitMessageResult::failure("no_staged_changes");
    }

    if diff.len() > DIFF_BYTE_LIMIT {
        return GenerateCommitMessageResult::failure("diff_too_large");
    }

    let request_message = if staged_status.trim().is_empty() {
        format!("GIT DIFF\n{diff}")
    } else if diff.trim().is_empty() {
        format!("GIT STATUS\n{staged_status}")
    } else {
        format!("GIT STATUS\n{staged_status}\n\nGIT DIFF\n{diff}")
    };

    match ai::generate_commit_message(&request_message).await {
        Ok(payload) => GenerateCommitMessageResult {
            success: true,
            message: Some(payload.commit_message),
            analysis: Some(payload.analysis),
            model_name: payload.model,
            prompt_version: PROMPT_VERSION.into(),
            error_code: None,
        },
        Err(error) => GenerateCommitMessageResult::failure(error.error_code()),
    }
}
