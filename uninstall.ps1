# Clackbot Windows 삭제 스크립트
# 사용법: irm https://raw.githubusercontent.com/sonan0721/clackbot/main/uninstall.ps1 | iex
$ErrorActionPreference = "Stop"

$InstallDir = if ($env:CLACKBOT_INSTALL_DIR) { $env:CLACKBOT_INSTALL_DIR } else { "$HOME\.clackbot-cli" }

function Write-Info($msg)  { Write-Host "▸ $msg" -ForegroundColor Cyan }
function Write-Ok($msg)    { Write-Host "✓ $msg" -ForegroundColor Green }
function Write-Warn($msg)  { Write-Host "⚠ $msg" -ForegroundColor Yellow }

Write-Host ""
Write-Host "Clackbot 삭제 스크립트 (Windows)"
Write-Host ""

# PATH에서 제거
$binDir = "$InstallDir\dist\bin"
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$pathParts = $userPath -split ";" | Where-Object { $_ -ne $binDir -and $_ -ne "" }
$newPath = $pathParts -join ";"

if ($userPath -ne $newPath) {
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    Write-Ok "PATH에서 $binDir 제거 완료"
} else {
    Write-Info "PATH에 clackbot 경로 없음 (건너뜀)"
}

# 소스 디렉토리 삭제
if (Test-Path $InstallDir) {
    Remove-Item -Recurse -Force $InstallDir
    Write-Ok "$InstallDir 삭제 완료"
} else {
    Write-Info "$InstallDir — 없음 (건너뜀)"
}

Write-Host ""
Write-Host "Clackbot이 삭제되었습니다." -ForegroundColor Green
Write-Host ""
Write-Warn "사용자 데이터는 삭제되지 않았습니다:"
Write-Host "  - $HOME\.clackbot\          (전역 설정)"
Write-Host "  - 프로젝트\.clackbot\       (프로젝트별 설정/대화 이력)"
Write-Host ""
Write-Host "  완전히 삭제하려면 위 디렉토리를 수동으로 삭제하세요."
Write-Host ""
