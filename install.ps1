# Clackbot Windows 설치 스크립트
# 사용법: irm https://raw.githubusercontent.com/sonan0721/clackbot/main/install.ps1 | iex
$ErrorActionPreference = "Stop"

$InstallDir = if ($env:CLACKBOT_INSTALL_DIR) { $env:CLACKBOT_INSTALL_DIR } else { "$HOME\.clackbot-cli" }
$RepoUrl = "https://github.com/sonan0721/clackbot.git"
$BinName = "clackbot"

function Write-Info($msg)  { Write-Host "▸ $msg" -ForegroundColor Cyan }
function Write-Ok($msg)    { Write-Host "✓ $msg" -ForegroundColor Green }
function Write-Warn($msg)  { Write-Host "⚠ $msg" -ForegroundColor Yellow }
function Write-Err($msg)   { Write-Host "✗ $msg" -ForegroundColor Red }

# ─── 사전 조건 확인 ──────────────────────────────────────────────────────────
function Test-Prerequisites {
    Write-Info "사전 조건 확인 중..."

    # git
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Write-Err "git이 설치되어 있지 않습니다. https://git-scm.com 에서 설치하세요."
        exit 1
    }
    Write-Ok "git $(git --version)"

    # node
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Err "Node.js가 설치되어 있지 않습니다. https://nodejs.org 에서 18+ 버전을 설치하세요."
        exit 1
    }
    $nodeVersion = (node -v).TrimStart("v")
    $nodeMajor = [int]($nodeVersion.Split(".")[0])
    if ($nodeMajor -lt 18) {
        Write-Err "Node.js 18+ 이 필요합니다. 현재: v$nodeVersion"
        exit 1
    }
    Write-Ok "Node.js v$nodeVersion"

    # npm
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Write-Err "npm이 설치되어 있지 않습니다."
        exit 1
    }
    Write-Ok "npm $(npm --version)"
}

# ─── Clone 또는 Update ──────────────────────────────────────────────────────
function Install-Source {
    if (Test-Path $InstallDir) {
        if (Test-Path "$InstallDir\.git") {
            Write-Info "기존 설치 발견 — 업데이트 중..."
            Push-Location $InstallDir
            git fetch origin main
            git reset --hard origin/main
            Pop-Location
            Write-Ok "최신 소스로 업데이트 완료"
        } else {
            Write-Warn "$InstallDir 이 존재하지만 git 저장소가 아닙니다."
            $backup = "$InstallDir.bak.$(Get-Date -Format 'yyyyMMddHHmmss')"
            Write-Info "백업: $backup"
            Rename-Item $InstallDir $backup
            Write-Info "새로 클론 중..."
            git clone $RepoUrl $InstallDir
            Write-Ok "클론 완료"
        }
    } else {
        Write-Info "소스 클론 중..."
        git clone $RepoUrl $InstallDir
        Write-Ok "클론 완료"
    }
}

# ─── 빌드 ────────────────────────────────────────────────────────────────────
function Build-Project {
    Write-Info "의존성 설치 중..."
    Push-Location $InstallDir
    npm install --no-fund --no-audit
    Write-Ok "npm install 완료"

    Write-Info "TypeScript 빌드 중..."
    npm run build
    Write-Ok "빌드 완료"
    Pop-Location
}

# ─── PATH에 추가 ─────────────────────────────────────────────────────────────
function Add-ToPath {
    $binDir = "$InstallDir\dist\bin"

    # 현재 사용자 PATH 확인
    $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($userPath -split ";" | Where-Object { $_ -eq $binDir }) {
        Write-Ok "$binDir 은 이미 PATH에 있습니다."
        return
    }

    # PATH에 추가
    $newPath = "$binDir;$userPath"
    [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
    $env:Path = "$binDir;$env:Path"
    Write-Ok "PATH에 추가: $binDir"
    Write-Warn "새 터미널에서 적용됩니다."
}

# ─── 검증 ────────────────────────────────────────────────────────────────────
function Test-Installation {
    Write-Info "설치 확인 중..."

    $clackbotPath = "$InstallDir\dist\bin\clackbot.js"
    if (Test-Path $clackbotPath) {
        try {
            $version = node $clackbotPath --version 2>$null
            Write-Ok "clackbot v$version"
        } catch {
            Write-Ok "clackbot 설치됨 — $clackbotPath"
        }
    } else {
        Write-Warn "clackbot 엔트리포인트를 찾을 수 없습니다."
    }
}

# ─── 다음 단계 안내 ──────────────────────────────────────────────────────────
function Show-NextSteps {
    Write-Host ""
    Write-Host "Clackbot 설치 완료!" -ForegroundColor Green -NoNewline
    Write-Host ""
    Write-Host ""
    Write-Host "다음 단계:"
    Write-Host ""
    Write-Host "  1. 프로젝트 디렉토리에서 초기화:"
    Write-Host "     clackbot init" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  2. Slack 토큰 설정:"
    Write-Host "     clackbot login" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  3. 봇 실행:"
    Write-Host "     clackbot start" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "문서: https://github.com/sonan0721/clackbot" -ForegroundColor Cyan
    Write-Host ""
}

# ─── 메인 ────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "Clackbot 설치 스크립트 (Windows)" -NoNewline
Write-Host ""
Write-Host ""

Test-Prerequisites
Write-Host ""
Install-Source
Write-Host ""
Build-Project
Write-Host ""
Add-ToPath
Write-Host ""
Test-Installation
Show-NextSteps
