#!/usr/bin/env bash
# ==============================================================================
# Creator TV — Clean Build Script
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$ROOT_DIR/frontend"

echo "========================================================"
echo "  Creator TV — Building Production Assets"
echo "========================================================"

cd "$FRONTEND_DIR"

if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    pnpm install --frozen-lockfile
fi

echo "Running test suite..."
pnpm test

echo "Building production frontend bundle (Vite + React 19)..."
pnpm build

echo ""
echo "========================================================"
echo "  Frontend build complete! Output is in:"
echo "  frontend/dist"
echo "========================================================"
