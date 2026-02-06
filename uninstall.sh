#!/usr/bin/env sh
# Clackbot 삭제 스크립트
# 사용법: curl -fsSL https://raw.githubusercontent.com/sonan0721/clackbot/main/uninstall.sh | sh
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

INSTALL_DIR="${CLACKBOT_INSTALL_DIR:-$HOME/.clackbot-cli}"
BIN_NAME="clackbot"

main() {
  echo ""
  printf "${BOLD}Clackbot 삭제 스크립트${RESET}\n"
  echo ""

  # 심볼릭 링크 삭제: /usr/local/bin
  if [ -L "/usr/local/bin/$BIN_NAME" ]; then
    if [ -w "/usr/local/bin" ]; then
      rm -f "/usr/local/bin/$BIN_NAME"
      ok "/usr/local/bin/$BIN_NAME 삭제 완료"
    elif command -v sudo >/dev/null 2>&1; then
      sudo rm -f "/usr/local/bin/$BIN_NAME"
      ok "/usr/local/bin/$BIN_NAME 삭제 완료 (sudo)"
    else
      warn "/usr/local/bin/$BIN_NAME 삭제 실패 — 수동으로 삭제하세요."
    fi
  else
    info "/usr/local/bin/$BIN_NAME — 없음 (건너뜀)"
  fi

  # 심볼릭 링크 삭제: ~/.local/bin
  LOCAL_BIN="$HOME/.local/bin"
  if [ -L "$LOCAL_BIN/$BIN_NAME" ]; then
    rm -f "$LOCAL_BIN/$BIN_NAME"
    ok "$LOCAL_BIN/$BIN_NAME 삭제 완료"
  else
    info "$LOCAL_BIN/$BIN_NAME — 없음 (건너뜀)"
  fi

  # 소스 디렉토리 삭제
  if [ -d "$INSTALL_DIR" ]; then
    rm -rf "$INSTALL_DIR"
    ok "$INSTALL_DIR 삭제 완료"
  else
    info "$INSTALL_DIR — 없음 (건너뜀)"
  fi

  echo ""
  printf "${GREEN}Clackbot이 삭제되었습니다.${RESET}\n"
  echo ""
  warn "사용자 데이터는 삭제되지 않았습니다:"
  echo "  - ~/.clackbot/         (전역 설정)"
  echo "  - 프로젝트/.clackbot/  (프로젝트별 설정/대화 이력)"
  echo ""
  echo "  완전히 삭제하려면 위 디렉토리를 수동으로 삭제하세요."
  echo ""
}

main
