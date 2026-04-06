use std::{
    io,
    path::{Path, PathBuf},
    process::{Command, Output},
};

use crate::models::AppError;

pub struct RepoStatusSnapshot {
    pub has_staged_changes: bool,
    pub staged_file_count: usize,
    pub diff_byte_size: usize,
}

enum GitExecutionContext {
    Native { current_dir: PathBuf },
    Wsl { distro: String, linux_dir: String },
}

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[cfg(windows)]
fn hide_child_window(command: &mut Command) {
    use std::os::windows::process::CommandExt;

    command.creation_flags(CREATE_NO_WINDOW);
}

#[cfg(not(windows))]
fn hide_child_window(_command: &mut Command) {}

fn normalized_path(input: &str) -> String {
    input.replace('/', "\\")
}

fn parse_wsl_unc_path(input: &str) -> Option<(String, String)> {
    let normalized = normalized_path(input);
    let without_prefix = normalized.strip_prefix("\\\\")?;
    let lower = without_prefix.to_ascii_lowercase();

    let after_share = if lower.starts_with("wsl$\\") {
        &without_prefix["wsl$\\".len()..]
    } else if lower.starts_with("wsl.localhost\\") {
        &without_prefix["wsl.localhost\\".len()..]
    } else {
        return None;
    };
    let mut parts = after_share.splitn(2, '\\');
    let distro = parts.next()?.trim();

    if distro.is_empty() {
        return None;
    }

    let subpath = parts.next().unwrap_or_default();
    let linux_dir = if subpath.is_empty() {
        "/".to_string()
    } else {
        format!("/{}", subpath.replace('\\', "/"))
    };

    Some((distro.to_string(), linux_dir))
}

fn linux_path_to_wsl_unc(distro: &str, linux_path: &str) -> PathBuf {
    let trimmed = linux_path.trim();
    let without_root = trimmed.trim_start_matches('/');

    if without_root.is_empty() {
        return PathBuf::from(format!("\\\\wsl$\\{distro}"));
    }

    PathBuf::from(format!(
        "\\\\wsl$\\{distro}\\{}",
        without_root.replace('/', "\\")
    ))
}

fn execution_context_from_path(path: &Path) -> GitExecutionContext {
    let display = path.display().to_string();

    if let Some((distro, linux_dir)) = parse_wsl_unc_path(&display) {
        return GitExecutionContext::Wsl { distro, linux_dir };
    }

    GitExecutionContext::Native {
        current_dir: path.to_path_buf(),
    }
}

fn run_git(context: &GitExecutionContext, args: &[&str]) -> Result<Output, AppError> {
    let output = match context {
        GitExecutionContext::Native { current_dir } => {
            let mut command = Command::new("git");
            command.args(args).current_dir(current_dir);
            hide_child_window(&mut command);
            command.output()
        }
        GitExecutionContext::Wsl { distro, linux_dir } => {
            let mut command = Command::new("wsl.exe");
            command.args(["-d", distro, "--cd", linux_dir, "git"]);
            command.args(args);
            hide_child_window(&mut command);
            command.output()
        }
    };

    output.map_err(|error| match error.kind() {
        io::ErrorKind::NotFound => AppError::GitUnavailable,
        _ => AppError::Git(error.to_string()),
    })
}

pub fn resolve_repo_root(cwd: &str) -> Result<PathBuf, AppError> {
    let current_dir = Path::new(cwd);
    let context = execution_context_from_path(current_dir);
    let output = run_git(&context, &["rev-parse", "--show-toplevel"])?;

    if !output.status.success() {
        return Err(AppError::NotARepo);
    }

    let repo_root = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if repo_root.is_empty() {
        return Err(AppError::NotARepo);
    }

    Ok(match context {
        GitExecutionContext::Native { .. } => PathBuf::from(repo_root),
        GitExecutionContext::Wsl { distro, .. } => linux_path_to_wsl_unc(&distro, &repo_root),
    })
}

pub fn repo_name(repo_root: &Path) -> String {
    repo_root
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("Unknown")
        .to_string()
}

pub fn read_staged_diff(repo_root: &Path) -> Result<String, AppError> {
    let context = execution_context_from_path(repo_root);
    let output = run_git(&context, &["diff", "--staged"])?;

    if !output.status.success() {
        return Err(AppError::NotARepo);
    }

    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

pub fn read_repo_status(repo_root: &Path) -> Result<RepoStatusSnapshot, AppError> {
    let context = execution_context_from_path(repo_root);
    let diff = read_staged_diff(repo_root)?;
    let output = run_git(&context, &["diff", "--staged", "--name-only"])?;

    if !output.status.success() {
        return Err(AppError::NotARepo);
    }

    let staged_file_count = String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter(|line| !line.trim().is_empty())
        .count();

    Ok(RepoStatusSnapshot {
        has_staged_changes: !diff.trim().is_empty(),
        staged_file_count,
        diff_byte_size: diff.len(),
    })
}
