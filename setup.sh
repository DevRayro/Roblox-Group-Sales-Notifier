#!/usr/bin/env bash
# setup.sh — One-shot installer for macOS and Linux.
# Detects/installs Node.js >=18, then launches the interactive setup wizard.
#
# Usage:
#   chmod +x setup.sh
#   ./setup.sh

set -e
set -o pipefail

REQUIRED_NODE_MAJOR=18

# ─── pretty output ───────────────────────────────────────────────────────
if [ -t 1 ]; then
  BOLD=$(printf '\033[1m'); DIM=$(printf '\033[2m'); RESET=$(printf '\033[0m')
  RED=$(printf '\033[31m'); GREEN=$(printf '\033[32m'); YELLOW=$(printf '\033[33m')
  CYAN=$(printf '\033[36m'); MAGENTA=$(printf '\033[35m')
else
  BOLD=""; DIM=""; RESET=""; RED=""; GREEN=""; YELLOW=""; CYAN=""; MAGENTA=""
fi
ok()   { printf "%s✔%s %s\n" "$GREEN" "$RESET" "$1"; }
info() { printf "%s›%s %s\n" "$CYAN" "$RESET" "$1"; }
warn() { printf "%s!%s %s\n" "$YELLOW" "$RESET" "$1"; }
fail() { printf "%s✘%s %s\n" "$RED" "$RESET" "$1"; }
head() { printf "\n%s%s%s\n" "$BOLD$MAGENTA" "$1" "$RESET"; }

banner() {
  printf "\n"
  printf "%s  ╔════════════════════════════════════════════════════╗%s\n" "$CYAN" "$RESET"
  printf "%s  ║  Roblox Group Sales Notifier  •  Bootstrap         ║%s\n" "$CYAN" "$RESET"
  printf "%s  ╚════════════════════════════════════════════════════╝%s\n" "$CYAN" "$RESET"
  printf "\n"
}

confirm() {
  local prompt="$1"
  local default="${2:-Y}"
  local hint="Y/n"
  [ "$default" = "N" ] && hint="y/N"
  printf "%s (%s) " "$prompt" "$hint"
  read -r ans
  ans="${ans:-$default}"
  case "$ans" in y|Y|yes|Yes|YES) return 0 ;; *) return 1 ;; esac
}

# ─── env detection ───────────────────────────────────────────────────────
detect_os() {
  case "$(uname -s)" in
    Darwin) echo macos ;;
    Linux)  echo linux ;;
    *)      echo unknown ;;
  esac
}

current_node_major() {
  if command -v node >/dev/null 2>&1; then
    node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/'
  else
    echo 0
  fi
}

# ─── installers ──────────────────────────────────────────────────────────
install_node_via_brew() {
  if ! command -v brew >/dev/null 2>&1; then
    warn "Homebrew not found. Installing it now (you may be prompted for your password)…"
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    # Re-source brew env (Apple Silicon vs Intel paths).
    if   [ -x /opt/homebrew/bin/brew ]; then eval "$(/opt/homebrew/bin/brew shellenv)"
    elif [ -x /usr/local/bin/brew ];     then eval "$(/usr/local/bin/brew shellenv)"
    fi
  fi
  info "Installing Node.js via Homebrew…"
  brew install node@20 || brew install node
  brew link --overwrite --force node@20 2>/dev/null || true
}

install_node_via_apt() {
  info "Installing Node.js via apt (NodeSource repository for v20)…"
  if ! command -v curl >/dev/null 2>&1; then
    sudo apt-get update && sudo apt-get install -y curl ca-certificates
  fi
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
}

install_node_via_dnf() {
  info "Installing Node.js via dnf (NodeSource repository for v20)…"
  curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo -E bash -
  sudo dnf install -y nodejs
}

install_node_via_pacman() {
  info "Installing Node.js via pacman…"
  sudo pacman -Sy --noconfirm nodejs npm
}

install_node_via_nvm() {
  info "Falling back to nvm (per-user Node version manager)…"
  if ! command -v nvm >/dev/null 2>&1 && [ ! -s "$HOME/.nvm/nvm.sh" ]; then
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  fi
  # shellcheck source=/dev/null
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  nvm install --lts
  nvm use --lts
  ok "Node $(node -v) installed via nvm. Future shells: run \`nvm use --lts\` to activate."
}

ensure_node() {
  local current
  current="$(current_node_major)"
  if [ "$current" -ge "$REQUIRED_NODE_MAJOR" ] 2>/dev/null; then
    ok "Node.js $(node -v) — meets requirement (>=$REQUIRED_NODE_MAJOR)."
    return 0
  fi

  if [ "$current" -gt 0 ]; then
    warn "Node.js v$current is installed, but we need >=$REQUIRED_NODE_MAJOR. Will upgrade."
  else
    warn "Node.js is not installed. Will install it now."
  fi

  local os
  os="$(detect_os)"

  if [ "$os" = "macos" ]; then
    install_node_via_brew && return 0
  elif [ "$os" = "linux" ]; then
    if   command -v apt-get >/dev/null 2>&1; then install_node_via_apt    && return 0
    elif command -v dnf     >/dev/null 2>&1; then install_node_via_dnf    && return 0
    elif command -v pacman  >/dev/null 2>&1; then install_node_via_pacman && return 0
    fi
  fi

  warn "Could not use a system package manager. Falling back to nvm."
  install_node_via_nvm
}

# ─── main ────────────────────────────────────────────────────────────────
banner
head "1) Checking Node.js"

if ! ensure_node; then
  fail "Failed to install Node.js automatically."
  fail "Please install Node 18+ manually from https://nodejs.org/ and re-run this script."
  exit 1
fi

# Re-verify after potential install/upgrade.
NEW_MAJOR="$(current_node_major)"
if [ "$NEW_MAJOR" -lt "$REQUIRED_NODE_MAJOR" ] 2>/dev/null; then
  fail "Node.js is still v$NEW_MAJOR after install attempts. Please install Node 18+ manually."
  exit 1
fi

head "2) Launching the interactive setup wizard"
node scripts/setup.js
