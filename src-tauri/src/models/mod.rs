use std::{
    fs,
    io,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};
use thiserror::Error;

pub const PROVIDER_NAME: &str = "gemini";
pub const MODEL_NAME: &str = "gemini-2.5-flash";
pub const PROMPT_VERSION: &str = "v2";
pub const DIFF_BYTE_LIMIT: usize = 250 * 1024;
pub const ENV_KEY_NAMES: [&str; 2] = ["GEMINI_API_KEY", "GOOGLE_API_KEY"];

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Git is unavailable")]
    GitUnavailable,
    #[error("Launch path is not a Git repository")]
    NotARepo,
    #[error("Missing API key")]
    MissingApiKey,
    #[error("Invalid API key")]
    InvalidApiKey,
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
            Self::MissingApiKey => "missing_api_key",
            Self::InvalidApiKey => "invalid_api_key",
            Self::ProviderTimeout => "provider_timeout",
            Self::Provider(_) | Self::Git(_) | Self::Io(_) | Self::Json(_) => "provider_error",
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum KeyStatus {
    #[default]
    Missing,
    Saved,
    Valid,
    Invalid,
}

impl KeyStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Missing => "missing",
            Self::Saved => "saved",
            Self::Valid => "valid",
            Self::Invalid => "invalid",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub onboarding_completed: bool,
    pub provider_name: String,
    pub model_name: String,
    pub key_status: KeyStatus,
    pub key_source: Option<String>,
    pub last_validated_at: Option<String>,
    pub prompt_version: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            onboarding_completed: false,
            provider_name: PROVIDER_NAME.into(),
            model_name: MODEL_NAME.into(),
            key_status: KeyStatus::Missing,
            key_source: None,
            last_validated_at: None,
            prompt_version: PROMPT_VERSION.into(),
        }
    }
}

fn config_dir() -> Result<PathBuf, AppError> {
    let base_dir = dirs::config_dir()
        .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "Unable to resolve config dir"))?;
    Ok(base_dir.join("gitroast"))
}

fn config_path() -> Result<PathBuf, AppError> {
    Ok(config_dir()?.join("config.json"))
}

pub fn load_app_config() -> Result<AppConfig, AppError> {
    let path = config_path()?;

    if !path.exists() {
        return Ok(AppConfig::default());
    }

    let contents = fs::read_to_string(path)?;
    Ok(serde_json::from_str(&contents)?)
}

pub fn save_app_config(config: &AppConfig) -> Result<(), AppError> {
    let directory = config_dir()?;
    let path = config_path()?;
    fs::create_dir_all(directory)?;
    fs::write(path, serde_json::to_string_pretty(config)?)?;
    Ok(())
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
pub struct SaveApiKeyResult {
    pub success: bool,
    pub provider_name: String,
    pub model_name: String,
    pub key_status: String,
    pub error_code: Option<String>,
}

impl SaveApiKeyResult {
    pub fn error() -> Self {
        Self {
            success: false,
            provider_name: PROVIDER_NAME.into(),
            model_name: MODEL_NAME.into(),
            key_status: "error".into(),
            error_code: None,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiKeyStatusResult {
    pub provider_name: String,
    pub model_name: String,
    pub key_present: bool,
    pub key_status: String,
    pub key_source: Option<String>,
    pub last_validated_at: Option<String>,
    pub error_code: Option<String>,
}

impl ApiKeyStatusResult {
    pub fn from_config(config: &AppConfig, key_present: bool) -> Self {
        Self {
            provider_name: config.provider_name.clone(),
            model_name: config.model_name.clone(),
            key_present,
            key_status: if key_present {
                config.key_status.as_str().into()
            } else {
                "missing".into()
            },
            key_source: config.key_source.clone(),
            last_validated_at: config.last_validated_at.clone(),
            error_code: None,
        }
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateCommitMessageResult {
    pub success: bool,
    pub message: Option<String>,
    pub model_name: String,
    pub prompt_version: String,
    pub error_code: Option<String>,
}

impl GenerateCommitMessageResult {
    pub fn failure(error_code: &str) -> Self {
        Self {
            success: false,
            message: None,
            model_name: MODEL_NAME.into(),
            prompt_version: PROMPT_VERSION.into(),
            error_code: Some(error_code.into()),
        }
    }
}
