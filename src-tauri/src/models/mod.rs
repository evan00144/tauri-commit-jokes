use std::{
    io,
    path::{Path, PathBuf},
};

use serde::Serialize;
use thiserror::Error;

pub const API_BASE_URL: &str = "https://tauri-silly.evannave.site";
pub const DEFAULT_MODEL_NAME: &str = "server default";
pub const PROMPT_VERSION: &str = "api-v1";
pub const DIFF_BYTE_LIMIT: usize = 250 * 1024;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Git is unavailable")]
    GitUnavailable,
    #[error("Launch path is not a Git repository")]
    NotARepo,
    #[error("Quota exceeded")]
    QuotaExceeded,
    #[error("Provider timeout")]
    ProviderTimeout,
    #[error("{0}")]
    Provider(String),
    #[error("{0}")]
    Git(String),
    #[error(transparent)]
    Io(#[from] io::Error),
    #[error(transparent)]
    Json(#[from] serde_json::Error),
}

impl AppError {
    pub fn error_code(&self) -> &'static str {
        match self {
            Self::GitUnavailable => "git_unavailable",
            Self::NotARepo => "not_a_repo",
            Self::QuotaExceeded => "quota_exhausted",
            Self::ProviderTimeout => "provider_timeout",
            Self::Provider(_) | Self::Git(_) | Self::Io(_) | Self::Json(_) => "provider_error",
        }
    }
}

fn repo_name_from_path(path: &Path) -> Option<String> {
    path.file_name()
        .and_then(|value| value.to_str())
        .map(ToOwned::to_owned)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoContextResult {
    pub launch_path: String,
    pub git_available: bool,
    pub is_repo: bool,
    pub repo_root: Option<String>,
    pub repo_name: Option<String>,
    pub error_code: Option<String>,
}

impl RepoContextResult {
    pub fn ready(launch_path: String, repo_root: PathBuf) -> Self {
        let repo_root_string = repo_root.display().to_string();
        Self {
            launch_path,
            git_available: true,
            is_repo: true,
            repo_name: repo_name_from_path(&repo_root),
            repo_root: Some(repo_root_string),
            error_code: None,
        }
    }

    pub fn invalid(launch_path: String, git_available: bool, error_code: Option<&str>) -> Self {
        Self {
            launch_path,
            git_available,
            is_repo: false,
            repo_root: None,
            repo_name: None,
            error_code: error_code.map(ToOwned::to_owned),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoStatusResult {
    pub repo_root: String,
    pub repo_name: String,
    pub has_staged_changes: bool,
    pub staged_file_count: usize,
    pub diff_byte_size: usize,
    pub error_code: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceStatusResult {
    pub ok: bool,
    pub service_name: String,
    pub model_name: String,
    pub base_url: String,
    pub error_code: Option<String>,
}

impl ServiceStatusResult {
    pub fn available(service_name: String, model_name: String) -> Self {
        Self {
            ok: true,
            service_name,
            model_name,
            base_url: API_BASE_URL.into(),
            error_code: None,
        }
    }

    pub fn unavailable(error_code: &str) -> Self {
        Self {
            ok: false,
            service_name: "git-joke-commit-api".into(),
            model_name: DEFAULT_MODEL_NAME.into(),
            base_url: API_BASE_URL.into(),
            error_code: Some(error_code.into()),
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateCommitMessageResult {
    pub success: bool,
    pub message: Option<String>,
    pub analysis: Option<String>,
    pub model_name: String,
    pub prompt_version: String,
    pub error_code: Option<String>,
}

impl GenerateCommitMessageResult {
    pub fn failure(error_code: &str) -> Self {
        Self {
            success: false,
            message: None,
            analysis: None,
            model_name: DEFAULT_MODEL_NAME.into(),
            prompt_version: PROMPT_VERSION.into(),
            error_code: Some(error_code.into()),
        }
    }
}
