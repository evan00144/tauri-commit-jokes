use std::path::Path;

use chrono::Utc;
use tauri::State;

use crate::{
    ai,
    git,
    models::{
        load_app_config, save_app_config, ApiKeyStatusResult, GenerateCommitMessageResult,
        KeyStatus, RepoContextResult, RepoStatusResult, PROMPT_VERSION,
    },
    secure_store,
};

#[derive(Clone)]
pub struct LaunchContext {
    pub cwd: Option<String>,
}

fn active_launch_path(input: &str, launch: &LaunchContext) -> String {
    if input.trim().is_empty() {
        return launch.cwd.clone().unwrap_or_default();
    }

    input.trim().to_string()
}

fn repo_root_from_launch(launch: &LaunchContext) -> Option<std::path::PathBuf> {
    let launch_path = launch.cwd.as_deref()?;
    git::resolve_repo_root(launch_path).ok()
}

#[tauri::command]
pub fn init_context(cwd: String, launch: State<'_, LaunchContext>) -> RepoContextResult {
    let launch_path = active_launch_path(&cwd, &launch);

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
pub fn get_api_key_status(launch: State<'_, LaunchContext>) -> ApiKeyStatusResult {
    let mut config = load_app_config().unwrap_or_default();
    let Some(repo_root) = repo_root_from_launch(&launch) else {
        config.key_status = KeyStatus::Missing;
        let model = secure_store::read_model(Path::new(".")).unwrap_or_else(|_| {
            crate::models::ResolvedModel {
                model_name: secure_store::default_model_name().into(),
                model_source: "default".into(),
                model_warning: None,
            }
        });
        config.key_source = None;
        return ApiKeyStatusResult::from_config(&config, false, &model);
    };

    let resolved_model = secure_store::read_model(&repo_root).unwrap_or_else(|_| {
        crate::models::ResolvedModel {
            model_name: secure_store::default_model_name().into(),
            model_source: "default".into(),
            model_warning: None,
        }
    });
    config.model_name = resolved_model.model_name.clone();

    match secure_store::has_api_key(&repo_root) {
        Ok(Some(source)) => {
            if matches!(config.key_status, KeyStatus::Missing) {
                config.key_status = KeyStatus::Saved;
            }
            config.key_source = Some(source);
            ApiKeyStatusResult::from_config(&config, true, &resolved_model)
        }
        Ok(None) => {
            config.key_status = KeyStatus::Missing;
            config.key_source = None;
            ApiKeyStatusResult::from_config(&config, false, &resolved_model)
        }
        Err(_) => {
            config.key_source = None;
            ApiKeyStatusResult::from_config(&config, false, &resolved_model)
        }
    }
}

#[tauri::command]
pub async fn generate_commit_message(
    repo_root: String,
    generation_nonce: u32,
) -> GenerateCommitMessageResult {
    let repo_path = Path::new(&repo_root);
    let (api_key, key_source) = match secure_store::read_api_key(repo_path) {
        Ok(api_key) => api_key,
        Err(error) => {
            return GenerateCommitMessageResult::failure(
                error.error_code(),
                secure_store::default_model_name(),
            )
        }
    };
    let config = load_app_config().unwrap_or_default();
    let resolved_model = match secure_store::read_model(repo_path) {
        Ok(model) => model,
        Err(error) => {
            return GenerateCommitMessageResult::failure(
                error.error_code(),
                secure_store::default_model_name(),
            )
        }
    };

    let diff = match git::read_staged_diff(repo_path) {
        Ok(diff) => diff,
        Err(error) => {
            return GenerateCommitMessageResult::failure(error.error_code(), &resolved_model.model_name)
        }
    };

    if diff.trim().is_empty() {
        return GenerateCommitMessageResult::failure("no_staged_changes", &resolved_model.model_name);
    }

    if diff.len() > crate::models::DIFF_BYTE_LIMIT {
        return GenerateCommitMessageResult::failure("diff_too_large", &resolved_model.model_name);
    }

    match ai::generate_commit_message(
        &api_key,
        &resolved_model.model_name,
        &diff,
        generation_nonce,
    )
    .await
    {
        Ok(message) => {
            let mut config = load_app_config().unwrap_or_default();
            config.key_status = KeyStatus::Valid;
            config.key_source = Some(key_source);
            config.model_name = resolved_model.model_name.clone();
            config.last_validated_at = Some(Utc::now().to_rfc3339());
            let _ = save_app_config(&config);
            GenerateCommitMessageResult {
                success: true,
                message: Some(message),
                model_name: resolved_model.model_name,
                prompt_version: PROMPT_VERSION.into(),
                error_code: None,
            }
        }
        Err(error) => {
            if error.error_code() == "invalid_api_key" {
                let mut config = load_app_config().unwrap_or_default();
                config.key_status = KeyStatus::Invalid;
                config.key_source = Some(key_source);
                config.model_name = resolved_model.model_name.clone();
                config.last_validated_at = None;
                let _ = save_app_config(&config);
            }

            GenerateCommitMessageResult::failure(error.error_code(), &resolved_model.model_name)
        }
    }
}
