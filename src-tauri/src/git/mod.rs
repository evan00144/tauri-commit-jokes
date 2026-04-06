use std::{
    io,
    path::{Path, PathBuf},
    process::Command,
};

use crate::models::AppError;

pub struct RepoStatusSnapshot {
    pub has_staged_changes: bool,
    pub staged_file_count: usize,
    pub diff_byte_size: usize,
}

fn run_git(current_dir: &Path, args: &[&str]) -> Result<std::process::Output, AppError> {
    Command::new("git")
        .args(args)
        .current_dir(current_dir)
        .output()
        .map_err(|error| match error.kind() {
            io::ErrorKind::NotFound => AppError::GitUnavailable,
            _ => AppError::Git(error.to_string()),
        })
}

pub fn resolve_repo_root(cwd: &str) -> Result<PathBuf, AppError> {
    let current_dir = Path::new(cwd);
    let output = run_git(current_dir, &["rev-parse", "--show-toplevel"])?;

    if !output.status.success() {
        return Err(AppError::NotARepo);
    }

    let repo_root = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if repo_root.is_empty() {
        return Err(AppError::NotARepo);
    }

    Ok(PathBuf::from(repo_root))
}

pub fn repo_name(repo_root: &Path) -> String {
    repo_root
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("Unknown")
        .to_string()
}

pub fn read_staged_diff(repo_root: &Path) -> Result<String, AppError> {
    let output = run_git(repo_root, &["diff", "--staged"])?;

    if !output.status.success() {
        return Err(AppError::NotARepo);
    }

    Ok(String::from_utf8_lossy(&output.stdout).into_owned())
}

pub fn read_repo_status(repo_root: &Path) -> Result<RepoStatusSnapshot, AppError> {
    let diff = read_staged_diff(repo_root)?;
    let output = run_git(repo_root, &["diff", "--staged", "--name-only"])?;

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
