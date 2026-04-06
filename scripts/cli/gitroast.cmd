@echo off
setlocal

set "LAUNCH_CWD=%CD%"
set "ROOT_DIR=%~dp0\..\.."

pushd "%ROOT_DIR%"
pnpm exec tauri dev -- -- --cwd "%LAUNCH_CWD%"
popd
