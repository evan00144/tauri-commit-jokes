use std::{env, fs, path::Path};

use crate::models::{AppError, ENV_KEY_NAMES};

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

fn parse_env_file(path: &Path) -> Result<Option<(String, String)>, AppError> {
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
        if ENV_KEY_NAMES.contains(&key) {
            return Ok(Some((key.to_string(), strip_wrapping_quotes(raw_value))));
        }
    }

    Ok(None)
}

pub fn read_api_key(repo_root: &Path) -> Result<(String, String), AppError> {
    for file_name in [".env.local", ".env"] {
        let path = repo_root.join(file_name);
        if let Some((key, value)) = parse_env_file(&path)? {
            if !value.trim().is_empty() {
                return Ok((value, format!("{file_name}: {key}")));
            }
        }
    }

    for key in ENV_KEY_NAMES {
        if let Ok(value) = env::var(key) {
            let trimmed = value.trim();
            if !trimmed.is_empty() {
                return Ok((trimmed.to_string(), format!("shell env: {key}")));
            }
        }
    }

    Err(AppError::MissingApiKey)
}

pub fn has_api_key(repo_root: &Path) -> Result<Option<String>, AppError> {
    match read_api_key(repo_root) {
        Ok((_, source)) => Ok(Some(source)),
        Err(AppError::MissingApiKey) => Ok(None),
        Err(error) => Err(error),
    }
}
