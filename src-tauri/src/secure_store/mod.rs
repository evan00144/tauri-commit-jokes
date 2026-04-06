use std::{env, fs, path::Path};

use crate::models::{
    load_app_config, AppError, ResolvedModel, DEFAULT_MODEL_NAME, ENV_KEY_NAMES, MODEL_PRESET_NAMES,
};

fn strip_wrapping_quotes(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.len() >= 2 {
        let bytes = trimmed.as_bytes();
        let first = bytes[0];
        let last = bytes[trimmed.len() - 1];
        if (first == b'"' && last == b'"') || (first == b'\'' && last == b'\'') {
            return trimmed[1..trimmed.len() - 1].to_string();
        }
    }
    trimmed.to_string()
}

fn parse_env_file(path: &Path, names: &[&str]) -> Result<Option<(String, String)>, AppError> {
    if !path.exists() {
        return Ok(None);
    }

    let contents = fs::read_to_string(path)?;

    for line in contents.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        let without_export = trimmed.strip_prefix("export ").unwrap_or(trimmed);
        let Some((raw_key, raw_value)) = without_export.split_once('=') else {
            continue;
        };

        let key = raw_key.trim();
        if names.contains(&key) {
            return Ok(Some((key.to_string(), strip_wrapping_quotes(raw_value))));
        }
    }

    Ok(None)
}

fn read_env_value(repo_root: &Path, names: &[&str]) -> Result<Option<(String, String)>, AppError> {
    for file_name in [".env.local", ".env"] {
        let path = repo_root.join(file_name);
        if let Some((key, value)) = parse_env_file(&path, names)? {
            if !value.trim().is_empty() {
                return Ok(Some((value, format!("{file_name}: {key}"))));
            }
        }
    }

    for key in names {
        if let Ok(value) = env::var(key) {
            let trimmed = value.trim();
            if !trimmed.is_empty() {
                return Ok(Some((trimmed.to_string(), format!("shell env: {key}"))));
            }
        }
    }

    Ok(None)
}

pub fn read_api_key_from_env(repo_root: &Path) -> Result<(String, String), AppError> {
    if let Some(api_key) = read_env_value(repo_root, &ENV_KEY_NAMES)? {
        return Ok(api_key);
    }

    Err(AppError::MissingApiKey)
}

pub fn read_model() -> Result<ResolvedModel, AppError> {
    let config = load_app_config().unwrap_or_default();
    let requested_model = config.model_name.trim();

    if requested_model.is_empty() {
        return Ok(ResolvedModel {
            model_name: DEFAULT_MODEL_NAME.into(),
            model_source: "default".into(),
            model_warning: None,
        });
    }

    if requested_model.starts_with("gemini") {
        return Ok(ResolvedModel {
            model_name: requested_model.into(),
            model_source: "app config".into(),
            model_warning: if MODEL_PRESET_NAMES.contains(&requested_model) {
                None
            } else {
                Some(format!(
                    "Using custom Gemini model `{requested_model}` from app config."
                ))
            },
        });
    }

    Ok(ResolvedModel {
        model_name: DEFAULT_MODEL_NAME.into(),
        model_source: "default".into(),
        model_warning: Some(format!(
            "Configured model `{requested_model}` is not a Gemini model. Falling back to {DEFAULT_MODEL_NAME}."
        )),
    })
}

pub fn default_model_name() -> &'static str {
    DEFAULT_MODEL_NAME
}

pub fn has_env_api_key(repo_root: &Path) -> Result<Option<String>, AppError> {
    match read_api_key_from_env(repo_root) {
        Ok((_, source)) => Ok(Some(source)),
        Err(AppError::MissingApiKey) => Ok(None),
        Err(error) => Err(error),
    }
}
