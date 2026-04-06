use std::collections::BTreeSet;

use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};

use crate::models::AppError;

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
    candidate_count: u8,
    max_output_tokens: u32,
    temperature: f32,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GenerateResponse {
    candidates: Option<Vec<Candidate>>,
}

#[derive(Deserialize)]
struct ErrorEnvelope {
    error: Option<ProviderErrorBody>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProviderErrorBody {
    code: Option<u16>,
    message: Option<String>,
    status: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Candidate {
    content: Option<ResponseContent>,
    finish_reason: Option<String>,
}

#[derive(Deserialize)]
struct ResponseContent {
    parts: Option<Vec<ResponsePart>>,
}

#[derive(Deserialize)]
struct ResponsePart {
    text: Option<String>,
}

fn build_prompt_with_nonce(diff: &str, retry_mode: bool, generation_nonce: u32) -> String {
    let style_variant = match generation_nonce % 4 {
        0 => "dry senior engineer roast",
        1 => "melodramatic bugfix diary",
        2 => "petty code review energy",
        _ => "deadpan commit message with slight self-own",
    };

    let quality_block = if retry_mode {
        "Your previous outputs were bland, incomplete, or cowardly.\n\
Do not cut off mid-sentence.\n\
Do not output generic commit sludge.\n\
Make the joke sharper and more specific to the actual change.\n\
Choose a visibly different angle from your previous attempt.\n\n"
    } else {
        ""
    };

    let multi_change_guard = if extract_changed_files(diff).len() > 1 {
        "The staged diff touches multiple files.\n\
Do not tunnel on only one tiny edit.\n\
Hint at both changes or summarize the combined chaos.\n\n"
    } else {
        ""
    };

    format!(
        "You are GitRoast, a commit message generator with intentionally bad taste.\n\
Write one commit message that a slightly mean developer would actually keep because it is accurate and funny.\n\n\
Hard requirements:\n\
- one line only\n\
- plain text only\n\
- under 90 characters\n\
- specific to the real staged diff\n\
- sound like a tired developer roasting the change in Slack\n\
- dry, sarcastic, awkward, petty, or melodramatic\n\
- mention the concrete change, not vague filler\n\n\
Style for this attempt:\n\
- {style_variant}\n\
- fresh angle number {}\n\n\
Never output things like release notes or PR summaries.\n\
Do not start with verbs like:\n\
- changed\n\
- updated\n\
- added\n\
- removed\n\
- renamed\n\
- made\n\
\n\
Never output things like:\n\
- feat:\n\
- fix:\n\
- chore:\n\
- update stuff\n\
- misc changes\n\
- finally let the\n\n\
Aim for this kind of energy:\n\
- teach GitRoast to stop begging for API keys like a needy SaaS intern\n\
- make staged diff detection notice reality for once\n\
- bully Gemini harder until the joke output stops sounding sedated\n\
- move secret handling into project env like a civilized goblin\n\n\
Good examples:\n\
- rename draft to drafting because apparently the badge wanted a rebrand\n\
- enlarge the theme badge so dark mode can keep screaming from the back row\n\
- tweak the ui copy until it sounds confident enough to fool product\n\
- give the badge more presence like it just got promoted over engineering\n\n\
{multi_change_guard}\
{quality_block}\
Staged diff:\n{diff}"
        ,
        generation_nonce
    )
}

fn clean_message(value: &str) -> String {
    value
        .replace('\n', " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim()
        .trim_matches('`')
        .trim_matches('"')
        .trim_matches('\'')
        .to_string()
}

fn is_generic_message(value: &str) -> bool {
    let trimmed = value.trim();
    let lower = trimmed.to_lowercase();

    if trimmed.len() < 18 {
        return true;
    }

    let banned_exact = [
        "feat",
        "feat:",
        "fix",
        "fix:",
        "chore",
        "chore:",
        "docs",
        "docs:",
        "refactor",
        "refactor:",
        "update files",
        "update stuff",
        "misc changes",
        "changes",
        "finally let the",
    ];

    if banned_exact.contains(&lower.as_str()) {
        return true;
    }

    let banned_starts = [
        "feat: ",
        "fix: ",
        "chore: ",
        "docs: ",
        "refactor: ",
        "style: ",
        "test: ",
        "finally let the",
        "changed ",
        "updated ",
        "added ",
        "removed ",
        "renamed ",
        "made ",
    ];

    if banned_starts.iter().any(|prefix| lower.starts_with(prefix)) {
        return true;
    }

    let trailing_weak_words = [
        "the", "a", "an", "to", "for", "of", "with", "into", "from", "on", "in", "and", "or",
    ];

    if let Some(last_word) = lower.split_whitespace().last() {
        if trailing_weak_words.contains(&last_word) {
            return true;
        }
    }

    let weak_phrases = [
        "update", "changes", "stuff", "improve", "cleanup", "refactor",
    ];

    let weak_hits = weak_phrases
        .iter()
        .filter(|phrase| lower.contains(**phrase))
        .count();

    weak_hits >= 2
}

fn looks_like_release_note(value: &str) -> bool {
    let trimmed = value.trim();
    let lower = trimmed.to_lowercase();

    let boring_starts = [
        "changed ",
        "updated ",
        "added ",
        "removed ",
        "renamed ",
        "made ",
        "adjusted ",
        "improved ",
        "fixed ",
        "set ",
    ];

    if boring_starts.iter().any(|prefix| lower.starts_with(prefix)) {
        return true;
    }

    lower.contains("\"")
        || lower.contains("'draft'")
        || lower.contains(" and made ")
        || lower.contains(" indicator ")
        || lower.contains("badge to")
}

fn normalize_signal(token: &str) -> Option<String> {
    let lower = token.to_lowercase();
    let trimmed = lower.trim_matches(|c: char| !c.is_ascii_alphanumeric());

    let is_noise = [
        "users", "evan", "projects", "src", "tauri", "ts", "tsx", "rs", "md", "json", "bool",
        "string", "true", "false", "null", "const", "type", "import", "export", "return", "line",
        "only", "this", "that", "with", "from", "into", "then", "when", "else",
    ];

    if trimmed.len() < 4 || is_noise.contains(&trimmed) {
        return None;
    }

    Some(trimmed.to_string())
}

fn extract_diff_signals(diff: &str) -> Vec<String> {
    let mut signals = BTreeSet::new();

    for line in diff.lines() {
        let interesting = line.starts_with("diff --git ")
            || line.starts_with("+++ ")
            || line.starts_with("--- ")
            || line.starts_with("+")
            || line.starts_with("-");

        if !interesting {
            continue;
        }

        for raw in line.split(|c: char| !c.is_ascii_alphanumeric() && c != '_') {
            if let Some(token) = normalize_signal(raw) {
                signals.insert(token);
            }
        }
    }

    signals.into_iter().take(18).collect()
}

fn extract_changed_files(diff: &str) -> Vec<String> {
    let mut files = Vec::new();

    for line in diff.lines() {
        if let Some(path) = line.strip_prefix("diff --git a/") {
            if let Some((file, _)) = path.split_once(" b/") {
                files.push(file.to_string());
            }
        }
    }

    files
}

fn extract_file_clusters(diff: &str) -> Vec<Vec<String>> {
    let mut clusters: Vec<BTreeSet<String>> = Vec::new();
    let mut current_cluster: Option<BTreeSet<String>> = None;

    for line in diff.lines() {
        if line.starts_with("diff --git ") {
            if let Some(cluster) = current_cluster.take() {
                if !cluster.is_empty() {
                    clusters.push(cluster);
                }
            }
            current_cluster = Some(BTreeSet::new());
        }

        let Some(cluster) = current_cluster.as_mut() else {
            continue;
        };

        let interesting = line.starts_with("diff --git ")
            || line.starts_with("+++ ")
            || line.starts_with("--- ")
            || line.starts_with('+')
            || line.starts_with('-');

        if !interesting {
            continue;
        }

        for raw in line.split(|c: char| !c.is_ascii_alphanumeric() && c != '_') {
            if let Some(token) = normalize_signal(raw) {
                cluster.insert(token);
            }
        }
    }

    if let Some(cluster) = current_cluster.take() {
        if !cluster.is_empty() {
            clusters.push(cluster);
        }
    }

    clusters
        .into_iter()
        .map(|cluster| cluster.into_iter().take(8).collect())
        .collect()
}

fn extract_change_targets(diff: &str) -> Vec<Vec<String>> {
    let lower = diff.to_lowercase();
    let mut targets = Vec::new();

    if lower.contains("servericon") && lower.contains("databaseicon") {
        targets.push(vec![
            "database".to_string(),
            "server".to_string(),
            "icon".to_string(),
            "db".to_string(),
        ]);
    }

    if lower.contains(">draft<") && lower.contains(">drafting<") {
        targets.push(vec![
            "draft".to_string(),
            "drafting".to_string(),
            "badge".to_string(),
            "rebrand".to_string(),
        ]);
    }

    if lower.contains("text-2xl") || lower.contains("gap-4") {
        targets.push(vec![
            "theme".to_string(),
            "mode".to_string(),
            "icon".to_string(),
            "bigger".to_string(),
            "supersize".to_string(),
        ]);
    }

    if lower.contains("loginfo") || lower.contains("fetching layout backgrounds") {
        targets.push(vec![
            "log".to_string(),
            "logging".to_string(),
            "background".to_string(),
            "service".to_string(),
            "quiet".to_string(),
        ]);
    }

    if lower.contains("|| false") {
        targets.push(vec![
            "false".to_string(),
            "pagination".to_string(),
            "background".to_string(),
            "logic".to_string(),
            "branch".to_string(),
        ]);
    }

    targets
}

fn candidate_score(
    value: &str,
    signals: &[String],
    file_clusters: &[Vec<String>],
    change_targets: &[Vec<String>],
) -> i32 {
    if is_generic_message(value) {
        return -100;
    }

    if looks_like_release_note(value) {
        return -40;
    }

    let lower = value.to_lowercase();
    let mut score = 0;

    if (28..=90).contains(&value.len()) {
        score += 8;
    }

    if value
        .chars()
        .next()
        .is_some_and(|character| character.is_ascii_lowercase())
    {
        score += 5;
    }

    let humor_markers = [
        "finally",
        "goblin",
        "panic",
        "begging",
        "embarrassing",
        "sad",
        "drama",
        "tantrum",
        "intern",
        "allergic",
        "civilized",
        "bully",
        "roast",
        "sulk",
        "cry",
        "woke up",
        "reality",
        "noticed",
        "apparently",
        "because",
        "again",
        "auditioning",
        "promoted",
        "screaming",
        "drunk",
        "coward",
        "pretend",
        "slack",
        "ego",
        "branding",
        "rebrand",
        "louder",
        "fancy",
    ];

    score += humor_markers
        .iter()
        .filter(|marker| lower.contains(**marker))
        .count() as i32
        * 3;

    score += signals
        .iter()
        .filter(|signal| signal.len() >= 4 && lower.contains(signal.as_str()))
        .take(4)
        .count() as i32
        * 4;

    let covered_clusters = file_clusters
        .iter()
        .filter(|cluster| cluster.iter().any(|signal| lower.contains(signal)))
        .count() as i32;

    score += covered_clusters * 6;

    if file_clusters.len() > 1 && covered_clusters <= 1 {
        score -= 18;
    }

    let covered_targets = change_targets
        .iter()
        .filter(|target| target.iter().any(|signal| lower.contains(signal)))
        .count() as i32;

    score += covered_targets * 7;

    if !change_targets.is_empty() {
        let missed_targets = change_targets.len() as i32 - covered_targets;
        score -= missed_targets.max(0) * 5;
    }

    let sarcasm_shapes = [
        " because ",
        " apparently ",
        " like it ",
        " again",
        " for once",
        " just so",
    ];

    score += sarcasm_shapes
        .iter()
        .filter(|marker| lower.contains(**marker))
        .count() as i32
        * 4;

    if value.contains('"') {
        score -= 6;
    }

    let boring_words = [
        "changed",
        "updated",
        "added",
        "removed",
        "renamed",
        "made",
        "indicator",
        "bigger",
        "smaller",
    ];

    score -= boring_words
        .iter()
        .filter(|word| lower.contains(**word))
        .count() as i32
        * 3;

    score
}

fn extract_added_phrases(diff: &str) -> Vec<String> {
    let mut phrases = Vec::new();

    for line in diff
        .lines()
        .filter(|line| line.starts_with('+') && !line.starts_with("+++"))
    {
        let quote_slices = line.matches('"').count();
        if quote_slices >= 2 {
            let mut parts = line.split('"');
            let _ = parts.next();
            if let Some(first) = parts.next() {
                let phrase = first.trim();
                if !phrase.is_empty() && phrase.len() <= 32 {
                    phrases.push(phrase.to_string());
                }
            }
        }
    }

    phrases
}

fn extract_compact_fragments(diff: &str) -> Vec<String> {
    let lower = diff.to_lowercase();
    let mut fragments = Vec::new();

    if lower.contains("servericon") && lower.contains("databaseicon") {
        fragments.push("swap the db icon".to_string());
    }

    if lower.contains(">draft<") && lower.contains(">drafting<") {
        fragments.push("promote Draft to Drafting".to_string());
    }

    if lower.contains("text-2xl") || lower.contains("gap-4") {
        fragments.push("supersize the theme glyph".to_string());
    }

    if lower.contains("loginfo") || lower.contains("fetching layout backgrounds") {
        fragments.push("muzzle the background logs".to_string());
    }

    if lower.contains("|| false") {
        fragments.push("slip || false into pagination".to_string());
    }

    fragments
}

fn build_fallback_roast(diff: &str, signals: &[String], generation_nonce: u32) -> String {
    let lower_diff = diff.to_lowercase();
    let changed_files = extract_changed_files(diff);
    let added_phrases = extract_added_phrases(diff);
    let compact_fragments = extract_compact_fragments(diff);
    let touched_app = changed_files
        .iter()
        .any(|path| path.ends_with("src/app/App.tsx"));
    let touched_credential_panel = lower_diff.contains("credential status")
        || lower_diff.contains("gemini env source")
        || lower_diff.contains("apikeyform")
        || lower_diff.contains("keystatus")
        || lower_diff.contains("project env");
    let touched_removal = diff.lines().filter(|line| line.starts_with('-')).count() > 10;

    let touched_env = lower_diff.contains(".env")
        || signals
            .iter()
            .any(|signal| ["env", "gemini", "google", "apikey", "key"].contains(&signal.as_str()));
    let touched_refresh = signals.iter().any(|signal| {
        ["refresh", "staged", "repo", "status", "focus", "visibility"].contains(&signal.as_str())
    });
    let touched_prompt = signals.iter().any(|signal| {
        [
            "prompt",
            "joke",
            "roast",
            "generate",
            "generator",
            "candidate",
        ]
        .contains(&signal.as_str())
    });
    let touched_docs = signals
        .iter()
        .any(|signal| ["readme", "example", "docs"].contains(&signal.as_str()));
    let touched_logging = signals.iter().any(|signal| {
        [
            "loginfo",
            "logging",
            "fetching",
            "backgrounds",
            "service",
            "layoutbackgroundservice",
        ]
        .contains(&signal.as_str())
    });
    let touched_badge = signals.iter().any(|signal| {
        [
            "badge",
            "draft",
            "drafting",
            "theme",
            "mode",
            "indicator",
            "label",
        ]
        .contains(&signal.as_str())
    });
    let touched_ui = signals.iter().any(|signal| {
        [
            "button",
            "badge",
            "theme",
            "indicator",
            "copy",
            "modal",
            "drawer",
            "label",
        ]
        .contains(&signal.as_str())
    });

    let mut variants: Vec<String> = Vec::new();

    if compact_fragments.len() >= 3 {
        let a = &compact_fragments[0];
        let b = &compact_fragments[1];
        let c = &compact_fragments[2];
        variants.extend([
            format!("{a}, {b}, and {c} because subtlety was already dead"),
            format!("{a}, {b}, then {c} like the sprint needed worse ideas"),
            format!("{a} while {b}; also {c} because apparently chaos scales"),
        ]);
    }

    if compact_fragments.len() >= 2 {
        let a = &compact_fragments[0];
        let b = &compact_fragments[1];
        variants.extend([
            format!("{a} and {b} because one bad idea clearly wasn't enough"),
            format!("{a} while {b} like the release train needed more drama"),
            format!("{a} and {b} for the full \"who approved this\" bundle"),
        ]);
    }

    if touched_badge {
        variants.extend(
            [
                "rename draft to drafting because apparently the badge wanted a rebrand",
                "make the draft badge sound busier so product can feel momentum",
                "inflate the theme badge until it can be seen from the last standup",
                "rename the badge and make it louder like it just discovered stakeholder feedback",
            ]
            .into_iter()
            .map(str::to_string),
        );
    }

    if touched_ui {
        variants.extend(
            [
                "tune the ui copy until it sounds confident enough to fool product",
                "massage the interface wording like the sprint review depends on the vibes",
                "make the badge bigger because subtlety was clearly blocking shipping",
                "give the theme indicator more presence like it just got promoted over engineering",
            ]
            .into_iter()
            .map(str::to_string),
        );
    }

    if touched_badge && touched_logging {
        variants.extend([
            "swap the fake server icon and quietly bury one more background log line",
            "fix the db badge and gag the layout background logs before they say too much",
            "rebrand the disconnected badge and delete one more nervous background service confession",
        ].into_iter().map(str::to_string));
    }

    if touched_logging {
        variants.extend(
            [
                "delete the layout background log like the service finally learned shame",
                "quiet the background service before one more debug line escapes to production",
                "muzzle the layout background logs because apparently silence is a feature now",
            ]
            .into_iter()
            .map(str::to_string),
        );
    }

    if let Some(phrase) = added_phrases.first() {
        variants.extend(
            [
                "ship the new label because apparently {phrase} tested well with the badge ego",
                "teach the ui to say {phrase} like it means it this time",
                "swap in {phrase} so the copy can sound important for once",
            ]
            .into_iter()
            .map(|template| template.replace("{phrase}", phrase)),
        );
    }

    if touched_app && touched_credential_panel && touched_removal {
        variants.extend(
            [
                "rip out the key status sidebar and let the main screen breathe again",
                "delete the credential guilt panel before it judges one more commit",
                "stop wasting pixels on API key drama and trim the App shell",
                "cut the credential sidebar so GitRoast can focus on the actual roast",
            ]
            .into_iter()
            .map(str::to_string),
        );
    }

    if touched_env && touched_refresh && touched_prompt {
        variants.extend(
            [
                "drag GitRoast into project env and bully Gemini into better jokes",
                "make repo refresh, env lookup, and joke quality fight in one commit",
                "teach GitRoast to read .env and stop serving sedated one-liners",
            ]
            .into_iter()
            .map(str::to_string),
        );
    }

    if touched_env && touched_refresh {
        variants.extend(
            [
                "make GitRoast notice staged reality and steal its key from .env",
                "refresh repo state and stop making users babysit secret handling",
            ]
            .into_iter()
            .map(str::to_string),
        );
    }

    if touched_env && touched_prompt {
        variants.extend(
            [
                "move Gemini secrets to .env and shame the joke engine into specifics",
                "kick API key prompts out of the app and roast with project env instead",
            ]
            .into_iter()
            .map(str::to_string),
        );
    }

    if touched_refresh && touched_prompt {
        variants.extend(
            [
                "make GitRoast notice staged files before Gemini embarrasses itself again",
                "refresh the repo before the joke engine hallucinates another commit line",
            ]
            .into_iter()
            .map(str::to_string),
        );
    }

    if touched_env {
        variants.extend(
            [
                "stop begging for API keys and read the room from .env instead",
                "let .env carry the secret so the UI can stop acting desperate",
            ]
            .into_iter()
            .map(str::to_string),
        );
    }

    if touched_refresh {
        variants.extend(
            [
                "teach GitRoast to refresh before hallucinating repo status again",
                "make the staged diff refresh like it finally respects the user",
            ]
            .into_iter()
            .map(str::to_string),
        );
    }

    if touched_prompt {
        variants.extend(
            [
                "bully the commit joke prompt until it stops sounding half-conscious",
                "force the roast generator to produce something less medically concerning",
            ]
            .into_iter()
            .map(str::to_string),
        );
    }

    if touched_docs {
        variants.extend(
            [
                "document the chaos so future-you knows why GitRoast behaves like this",
                "write down the weird parts before the next refactor pretends this was obvious",
            ]
            .into_iter()
            .map(str::to_string),
        );
    }

    if variants.is_empty() {
        variants
            .push("roast the staged diff with slightly more dignity than last time".to_string());
    }

    variants[(generation_nonce as usize) % variants.len()].clone()
}

async fn request_candidates(
    client: &Client,
    api_key: &str,
    model_name: &str,
    diff: &str,
    retry_mode: bool,
    generation_nonce: u32,
) -> Result<Vec<String>, AppError> {
    let prompt = build_prompt_with_nonce(diff, retry_mode, generation_nonce);
    let endpoint = format!(
        "https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
    );

    let response = client
        .post(endpoint)
        .header("x-goog-api-key", api_key)
        .header("content-type", "application/json")
        .json(&GenerateRequest {
            contents: vec![RequestContent {
                role: "user",
                parts: vec![RequestPart { text: prompt }],
            }],
            generation_config: GenerationConfig {
                candidate_count: 3,
                max_output_tokens: 96,
                temperature: if retry_mode { 1.35 } else { 1.15 },
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
        let status = response.status();
        let error_text = response.text().await.unwrap_or_default();
        let provider_error = serde_json::from_str::<ErrorEnvelope>(&error_text)
            .ok()
            .and_then(|payload| payload.error);
        let provider_message = provider_error
            .as_ref()
            .and_then(|error| error.message.clone())
            .unwrap_or_else(|| error_text.trim().to_string());
        let provider_status = provider_error
            .as_ref()
            .and_then(|error| error.status.as_deref());

        return Err(match status {
            StatusCode::BAD_REQUEST | StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => {
                AppError::InvalidApiKey
            }
            StatusCode::TOO_MANY_REQUESTS => AppError::QuotaExceeded,
            StatusCode::REQUEST_TIMEOUT | StatusCode::GATEWAY_TIMEOUT => AppError::ProviderTimeout,
            _ if matches!(provider_status, Some("RESOURCE_EXHAUSTED")) => AppError::QuotaExceeded,
            _ => {
                let provider_code = provider_error.as_ref().and_then(|error| error.code);
                let detail = if provider_message.is_empty() {
                    format!("Gemini returned status {status}")
                } else if let Some(code) = provider_code {
                    format!("Gemini returned status {status} (provider code {code}): {provider_message}")
                } else {
                    format!("Gemini returned status {status}: {provider_message}")
                };
                AppError::Provider(detail)
            }
        });
    }

    let payload = response
        .json::<GenerateResponse>()
        .await
        .map_err(|error| AppError::Provider(error.to_string()))?;

    let mut candidates = Vec::new();

    for candidate in payload.candidates.unwrap_or_default() {
        if matches!(candidate.finish_reason.as_deref(), Some("SAFETY")) {
            continue;
        }

        if let Some(text) = candidate
            .content
            .and_then(|content| content.parts)
            .and_then(|mut parts| parts.drain(..).find_map(|part| part.text))
        {
            let cleaned = clean_message(&text);
            if !cleaned.is_empty() {
                candidates.push(cleaned);
            }
        }
    }

    if candidates.is_empty() {
        return Err(AppError::Provider(format!(
            "Empty Gemini response from {model_name}"
        )));
    }

    Ok(candidates)
}

pub async fn generate_commit_message(
    api_key: &str,
    model_name: &str,
    diff: &str,
    generation_nonce: u32,
) -> Result<String, AppError> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|error| AppError::Provider(error.to_string()))?;

    let signals = extract_diff_signals(diff);
    let file_clusters = extract_file_clusters(diff);
    let change_targets = extract_change_targets(diff);
    let fallback = build_fallback_roast(diff, &signals, generation_nonce);
    let mut best_message = fallback.clone();
    let mut best_score = candidate_score(&fallback, &signals, &file_clusters, &change_targets);

    for retry_mode in [false, true] {
        let candidates = request_candidates(
            &client,
            api_key,
            model_name,
            diff,
            retry_mode,
            generation_nonce,
        )
        .await?;

        for candidate in candidates {
            let score = candidate_score(&candidate, &signals, &file_clusters, &change_targets);
            if score > best_score {
                best_score = score;
                best_message = candidate;
            }
        }

        if best_score >= 12 {
            break;
        }
    }

    Ok(best_message)
}
