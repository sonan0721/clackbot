#!/usr/bin/env sh
# Clackbot 설치 스크립트
# 사용법: curl -fsSL https://raw.githubusercontent.com/sonan0721/clackbot/main/install.sh | sh
set -e

# ─── 색상 ────────────────────────────────────────────────────────────────────
BOLD="\033[1m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
CYAN="\033[36m"
RESET="\033[0m"

info()  { printf "${CYAN}▸${RESET} %s\n" "$1"; }
ok()    { printf "${GREEN}✓${RESET} %s\n" "$1"; }
warn()  { printf "${YELLOW}⚠${RESET} %s\n" "$1"; }
err()   { printf "${RED}✗${RESET} %s\n" "$1" >&2; }
fatal() { err "$1"; exit 1; }

# ─── 설치 경로 ───────────────────────────────────────────────────────────────
INSTALL_DIR="${CLACKBOT_INSTALL_DIR:-$HOME/.clackbot-cli}"
REPO_URL="https://github.com/sonan0721/clackbot.git"
BIN_NAME="clackbot"

# ─── 사전 조건 확인 ──────────────────────────────────────────────────────────
check_prerequisites() {
  info "사전 조건 확인 중..."

  # git
  if ! command -v git >/dev/null 2>&1; then
    fatal "git이 설치되어 있지 않습니다. https://git-scm.com 에서 설치하세요."
  fi
  ok "git $(git --version | cut -d' ' -f3)"

  # node
  if ! command -v node >/dev/null 2>&1; then
    fatal "Node.js가 설치되어 있지 않습니다. https://nodejs.org 에서 18+ 버전을 설치하세요."
  fi
  NODE_VERSION=$(node -v | sed 's/^v//')
  NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
  if [ "$NODE_MAJOR" -lt 18 ]; then
    fatal "Node.js 18+ 이 필요합니다. 현재: v${NODE_VERSION}"
  fi
  ok "Node.js v${NODE_VERSION}"

  # npm
  if ! command -v npm >/dev/null 2>&1; then
    fatal "npm이 설치되어 있지 않습니다."
  fi
  ok "npm $(npm --version)"

  # C 컴파일러 (better-sqlite3 네이티브 빌드)
  if command -v cc >/dev/null 2>&1; then
    ok "C 컴파일러 발견"
  elif command -v gcc >/dev/null 2>&1; then
    ok "gcc 발견"
  elif command -v clang >/dev/null 2>&1; then
    ok "clang 발견"
  else
    warn "C 컴파일러를 찾을 수 없습니다. better-sqlite3 빌드 시 필요할 수 있습니다."
    warn "macOS: xcode-select --install / Linux: sudo apt install build-essential"
  fi
}

# ─── Clone 또는 Update ──────────────────────────────────────────────────────
clone_or_update() {
  if [ -d "$INSTALL_DIR" ]; then
    if [ -d "$INSTALL_DIR/.git" ]; then
      info "기존 설치 발견 — 업데이트 중..."
      cd "$INSTALL_DIR"
      git fetch origin main
      git reset --hard origin/main
      ok "최신 소스로 업데이트 완료"
    else
      warn "${INSTALL_DIR}이 존재하지만 git 저장소가 아닙니다."
      BACKUP="${INSTALL_DIR}.bak.$(date +%s)"
      info "백업: ${BACKUP}"
      mv "$INSTALL_DIR" "$BACKUP"
      info "새로 클론 중..."
      git clone "$REPO_URL" "$INSTALL_DIR"
      ok "클론 완료"
    fi
  else
    info "소스 클론 중..."
    git clone "$REPO_URL" "$INSTALL_DIR"
    ok "클론 완료"
  fi
}

# ─── 빌드 ────────────────────────────────────────────────────────────────────
build() {
  info "의존성 설치 중..."
  cd "$INSTALL_DIR"
  npm install --no-fund --no-audit
  ok "npm install 완료"

  info "TypeScript 빌드 중..."
  npm run build
  ok "빌드 완료"

  # 엔트리포인트에 실행 권한 부여
  chmod +x "$INSTALL_DIR/dist/bin/clackbot.js"
}

# ─── 심볼릭 링크 / CMD 래퍼 ──────────────────────────────────────────────────
create_symlink() {
  TARGET="$INSTALL_DIR/dist/bin/clackbot.js"
  OS=$(uname -s 2>/dev/null || echo "Unknown")

  # Windows (Git Bash / MSYS / Cygwin) — .cmd 래퍼 생성
  case "$OS" in
    MINGW*|MSYS*|CYGWIN*)
      create_windows_cmd
      return
      ;;
  esac

  # macOS / Linux — 심볼릭 링크
  # 1차 시도: /usr/local/bin
  if [ -d "/usr/local/bin" ] && [ -w "/usr/local/bin" ]; then
    ln -sf "$TARGET" "/usr/local/bin/$BIN_NAME"
    ok "심볼릭 링크 생성: /usr/local/bin/$BIN_NAME"
    return
  fi

  # sudo로 /usr/local/bin 시도
  if [ -d "/usr/local/bin" ] && command -v sudo >/dev/null 2>&1; then
    info "/usr/local/bin에 쓰기 권한 없음 — sudo로 시도합니다..."
    if sudo ln -sf "$TARGET" "/usr/local/bin/$BIN_NAME" 2>/dev/null; then
      ok "심볼릭 링크 생성: /usr/local/bin/$BIN_NAME (sudo)"
      return
    fi
  fi

  # fallback: ~/.local/bin
  LOCAL_BIN="$HOME/.local/bin"
  mkdir -p "$LOCAL_BIN"
  ln -sf "$TARGET" "$LOCAL_BIN/$BIN_NAME"
  ok "심볼릭 링크 생성: $LOCAL_BIN/$BIN_NAME"

  # PATH에 ~/.local/bin이 없으면 안내
  case ":$PATH:" in
    *":$LOCAL_BIN:"*) ;;
    *)
      warn "$LOCAL_BIN 이 PATH에 포함되어 있지 않습니다."
      echo ""
      echo "  다음 줄을 셸 설정 파일에 추가하세요:"
      echo ""
      echo "    export PATH=\"\$HOME/.local/bin:\$PATH\""
      echo ""
      ;;
  esac
}

# ─── Windows .cmd 래퍼 생성 ──────────────────────────────────────────────────
create_windows_cmd() {
  TARGET="$INSTALL_DIR/dist/bin/clackbot.js"

  # Windows 경로로 변환
  WIN_TARGET=$(cygpath -w "$TARGET" 2>/dev/null || echo "$TARGET")

  # npm global prefix 디렉토리에 .cmd 래퍼 생성
  NPM_PREFIX=$(npm prefix -g 2>/dev/null)

  if [ -n "$NPM_PREFIX" ]; then
    CMD_PATH="$NPM_PREFIX/$BIN_NAME.cmd"
    SH_PATH="$NPM_PREFIX/$BIN_NAME"

    # .cmd (Command Prompt / PowerShell용)
    printf '@echo off\r\nnode "%s" %%*\r\n' "$WIN_TARGET" > "$CMD_PATH"
    ok "CMD 래퍼 생성: $CMD_PATH"

    # sh (Git Bash용)
    printf '#!/bin/sh\nnode "%s" "$@"\n' "$TARGET" > "$SH_PATH"
    chmod +x "$SH_PATH" 2>/dev/null
    ok "Git Bash 래퍼 생성: $SH_PATH"
  else
    warn "npm global prefix를 찾을 수 없습니다."
    warn "수동으로 PATH에 추가하세요: node \"$WIN_TARGET\""
  fi
}

# ─── 검증 ────────────────────────────────────────────────────────────────────
verify() {
  info "설치 확인 중..."

  # PATH에서 찾기
  if command -v "$BIN_NAME" >/dev/null 2>&1; then
    INSTALLED_PATH=$(command -v "$BIN_NAME")
    VERSION=$("$BIN_NAME" --version 2>/dev/null || echo "unknown")
    ok "clackbot v${VERSION} — ${INSTALLED_PATH}"
  else
    warn "clackbot이 PATH에서 발견되지 않았습니다."
    warn "새 터미널을 열거나 셸 설정을 다시 로드하세요."
  fi
}

# ─── 다음 단계 안내 ──────────────────────────────────────────────────────────
print_next_steps() {
  printf "\n"
  printf "${BOLD}${GREEN}Clackbot 설치 완료!${RESET}\n"
  printf "\n"
  printf "다음 단계:\n"
  printf "\n"
  printf "  1. 프로젝트 디렉토리에서 초기화:\n"
  printf "     ${CYAN}clackbot init${RESET}\n"
  printf "\n"
  printf "  2. Slack 토큰 설정:\n"
  printf "     ${CYAN}clackbot login${RESET}\n"
  printf "\n"
  printf "  3. 봇 실행:\n"
  printf "     ${CYAN}clackbot start${RESET}\n"
  printf "\n"
  printf "문서: ${CYAN}https://github.com/sonan0721/clackbot${RESET}\n"
  printf "\n"
}

# ─── 메인 ────────────────────────────────────────────────────────────────────
main() {
  echo ""
  printf "${BOLD}Clackbot 설치 스크립트${RESET}\n"
  echo ""

  check_prerequisites
  echo ""
  clone_or_update
  echo ""
  build
  echo ""
  create_symlink
  echo ""
  verify
  print_next_steps
}

main
