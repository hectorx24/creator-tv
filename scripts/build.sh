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
    npm ci
fi

echo "Running test suite..."
npm run test

echo "Building production frontend bundle (Vite + React 19)..."
npm run build

echo ""
echo "========================================================"
echo "  Frontend build complete! Output is in:"
echo "  frontend/dist"
echo "========================================================"
