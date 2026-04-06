use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};

use crate::models::{AppError, MODEL_NAME};

const GEMINI_ENDPOINT: &str =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GenerateRequest {
    contents: Vec<RequestContent>,
    generation_config: GenerationConfig,
}

#[derive(Serialize)]
struct RequestContent {
    role: &'static str,
    parts: Vec<RequestPart>,
}

#[derive(Serialize)]
struct RequestPart {
    text: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct GenerationConfig {
    max_output_tokens: u32,
    temperature: f32,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GenerateResponse {
    candidates: Option<Vec<Candidate>>,
}

#[derive(Deserialize)]
struct Candidate {
    content: Option<ResponseContent>,
}

#[derive(Deserialize)]
struct ResponseContent {
    parts: Option<Vec<ResponsePart>>,
}

#[derive(Deserialize)]
struct ResponsePart {
    text: Option<String>,
}

fn build_prompt(diff: &str) -> String {
    format!(
        "You are GitRoast. Read the staged diff and respond with exactly one commit message.\n\
Rules:\n\
- Return a single line only\n\
- No quotes, no bullets, no markdown\n\
- Keep it under 72 characters when possible\n\
- Make it funny, dry, and specific to the actual change\n\
- It still needs to sound like a real commit message someone would use\n\n\
Staged diff:\n{diff}"
    )
}

fn clean_message(value: &str) -> String {
    value
        .replace('\n', " ")
        .trim()
        .trim_matches('`')
        .trim_matches('"')
        .trim_matches('\'')
        .to_string()
}

pub async fn generate_commit_message(api_key: &str, diff: &str) -> Result<String, AppError> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|error| AppError::Provider(error.to_string()))?;

    let response = client
        .post(GEMINI_ENDPOINT)
        .header("x-goog-api-key", api_key)
        .header("content-type", "application/json")
        .json(&GenerateRequest {
            contents: vec![RequestContent {
                role: "user",
                parts: vec![RequestPart {
                    text: build_prompt(diff),
                }],
            }],
            generation_config: GenerationConfig {
                max_output_tokens: 96,
                temperature: 1.0,
            },
        })
        .send()
        .await
        .map_err(|error| {
            if error.is_timeout() {
                AppError::ProviderTimeout
            } else {
                AppError::Provider(error.to_string())
            }
        })?;

    if !response.status().is_success() {
        return Err(match response.status() {
            StatusCode::BAD_REQUEST | StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => {
                AppError::InvalidApiKey
            }
            StatusCode::REQUEST_TIMEOUT | StatusCode::GATEWAY_TIMEOUT => AppError::ProviderTimeout,
            _ => AppError::Provider(format!("Gemini returned status {}", response.status())),
        });
    }

    let payload = response
        .json::<GenerateResponse>()
        .await
        .map_err(|error| AppError::Provider(error.to_string()))?;

    let candidate = payload
        .candidates
        .and_then(|mut items| items.drain(..).next())
        .and_then(|item| item.content)
        .and_then(|content| content.parts)
        .and_then(|mut parts| parts.drain(..).find_map(|part| part.text))
        .ok_or_else(|| AppError::Provider(format!("Empty Gemini response from {MODEL_NAME}")))?;

    let cleaned = clean_message(&candidate);

    if cleaned.is_empty() {
        return Err(AppError::Provider("Gemini returned an empty message".into()));
    }

    Ok(cleaned)
}
