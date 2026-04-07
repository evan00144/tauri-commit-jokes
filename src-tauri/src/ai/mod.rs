use reqwest::{Client, Response, StatusCode};
use serde::{Deserialize, Serialize};

use crate::models::{AppError, API_BASE_URL};

#[derive(Debug, Deserialize)]
pub struct ServiceHealth {
    pub ok: bool,
    pub service: String,
    pub model: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CommitJokeRequest {
    message: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitJokeResponse {
    pub model: String,
    pub analysis: String,
    pub commit_message: String,
}

#[derive(Debug, Deserialize)]
struct ApiErrorResponse {
    error: Option<String>,
    details: Option<serde_json::Value>,
}

fn client() -> Result<Client, AppError> {
    Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|error| AppError::Provider(error.to_string()))
}

fn map_request_error(error: reqwest::Error) -> AppError {
    if error.is_timeout() {
        AppError::ProviderTimeout
    } else {
        AppError::Provider(error.to_string())
    }
}

fn format_details(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::String(text) => text.clone(),
        _ => value.to_string(),
    }
}

async fn map_error_response(response: Response) -> AppError {
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    let payload = serde_json::from_str::<ApiErrorResponse>(&body).ok();

    match status {
        StatusCode::TOO_MANY_REQUESTS => AppError::QuotaExceeded,
        StatusCode::REQUEST_TIMEOUT | StatusCode::GATEWAY_TIMEOUT => AppError::ProviderTimeout,
        _ => {
            let mut message = payload
                .as_ref()
                .and_then(|value| value.error.clone())
                .unwrap_or_else(|| body.trim().to_string());

            if let Some(details) = payload
                .as_ref()
                .and_then(|value| value.details.as_ref())
                .map(format_details)
            {
                if !details.is_empty() {
                    if message.is_empty() {
                        message = details;
                    } else {
                        message = format!("{message}: {details}");
                    }
                }
            }

            if message.is_empty() {
                message = format!("Commit joke API returned status {status}");
            }

            AppError::Provider(message)
        }
    }
}

pub async fn get_service_health() -> Result<ServiceHealth, AppError> {
    let response = client()?
        .get(format!("{API_BASE_URL}/health"))
        .send()
        .await
        .map_err(map_request_error)?;

    if !response.status().is_success() {
        return Err(map_error_response(response).await);
    }

    let payload = response
        .json::<ServiceHealth>()
        .await
        .map_err(|error| AppError::Provider(error.to_string()))?;

    if !payload.ok {
        return Err(AppError::Provider("Commit joke API health check failed".into()));
    }

    Ok(payload)
}

pub async fn generate_commit_message(message: &str) -> Result<CommitJokeResponse, AppError> {
    let response = client()?
        .post(format!("{API_BASE_URL}/api/commit-joke"))
        .header("content-type", "application/json")
        .json(&CommitJokeRequest {
            message: message.into(),
        })
        .send()
        .await
        .map_err(map_request_error)?;

    if !response.status().is_success() {
        return Err(map_error_response(response).await);
    }

    let payload = response
        .json::<CommitJokeResponse>()
        .await
        .map_err(|error| AppError::Provider(error.to_string()))?;

    if payload.commit_message.trim().is_empty() {
        return Err(AppError::Provider(
            "Commit joke API returned an empty commit message".into(),
        ));
    }

    Ok(payload)
}
