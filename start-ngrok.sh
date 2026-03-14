#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# AI Forex Dashboard – ngrok startup script
#
# Usage:
#   chmod +x start-ngrok.sh
#   ./start-ngrok.sh
#
# Required environment variables (set in .env or export before running):
#   NGROK_AUTHTOKEN   – Your ngrok auth token (from dashboard.ngrok.com)
#   NGROK_DOMAIN      – Your static ngrok domain (optional, e.g. my-app.ngrok-free.app)
#
# The script starts backend (port 5000), frontend (port 3000), and
# creates an ngrok tunnel pointing to the frontend.
# ─────────────────────────────────────────────────────────────────────────────

set -e

# Load .env if present
if [ -f ".env" ]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' .env | xargs)
fi

# Validate ngrok token
if [ -z "$NGROK_AUTHTOKEN" ]; then
  echo "[ERROR] NGROK_AUTHTOKEN is not set."
  echo "  Add it to your .env file:  NGROK_AUTHTOKEN=your_token_here"
  echo "  Get your token at: https://dashboard.ngrok.com/get-started/your-authtoken"
  exit 1
fi

# Check for required tools
command -v node >/dev/null 2>&1 || { echo "[ERROR] node not found. Install Node.js >= 20."; exit 1; }
command -v npm  >/dev/null 2>&1 || { echo "[ERROR] npm not found."; exit 1; }

# Check / install ngrok
if ! command -v ngrok >/dev/null 2>&1; then
  echo "[INFO] ngrok not found. Installing via npm..."
  npm install -g ngrok --quiet
fi

# Configure ngrok auth token
ngrok config add-authtoken "$NGROK_AUTHTOKEN"

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║          AI Forex Dashboard – Starting up                ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── Install dependencies if node_modules missing ──────────────────────────────
if [ ! -d "backend/node_modules" ]; then
  echo "[INFO] Installing backend dependencies..."
  (cd backend && npm install --quiet)
fi

if [ ! -d "frontend/node_modules" ]; then
  echo "[INFO] Installing frontend dependencies..."
  (cd frontend && npm install --quiet)
fi

# ── Start backend ──────────────────────────────────────────────────────────────
echo "[INFO] Starting backend on port 5000..."
(cd backend && npm run dev > /tmp/forex-backend.log 2>&1) &
BACKEND_PID=$!
echo "       Backend PID: $BACKEND_PID"

# ── Wait for backend to be ready ───────────────────────────────────────────────
echo "[INFO] Waiting for backend..."
for i in $(seq 1 20); do
  if curl -sf http://localhost:5000/health >/dev/null 2>&1; then
    echo "       Backend ready!"
    break
  fi
  sleep 2
done

# ── Start frontend ─────────────────────────────────────────────────────────────
NEXT_PUBLIC_API_URL="http://localhost:5000" \
  (cd frontend && npm run dev > /tmp/forex-frontend.log 2>&1) &
FRONTEND_PID=$!
echo "[INFO] Starting frontend on port 3000 (PID: $FRONTEND_PID)"

# ── Wait for frontend to be ready ──────────────────────────────────────────────
echo "[INFO] Waiting for frontend..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:3000 >/dev/null 2>&1; then
    echo "       Frontend ready!"
    break
  fi
  sleep 2
done

# ── Start ngrok tunnel ─────────────────────────────────────────────────────────
echo ""
echo "[INFO] Starting ngrok tunnel..."
if [ -n "$NGROK_DOMAIN" ]; then
  echo "       Using static domain: $NGROK_DOMAIN"
  ngrok http --domain="$NGROK_DOMAIN" 3000 &
else
  ngrok http 3000 &
fi
NGROK_PID=$!

sleep 3

# ── Get public URL from ngrok API ──────────────────────────────────────────────
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null \
  | grep -o '"public_url":"[^"]*"' \
  | head -1 \
  | sed 's/"public_url":"//;s/"//')

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                  🚀 Dashboard is LIVE!                   ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  Local:    http://localhost:3000                         ║"
if [ -n "$NGROK_URL" ]; then
  printf "║  Public:   %-44s ║\n" "$NGROK_URL"
fi
echo "║  Backend:  http://localhost:5000                         ║"
echo "║  ngrok UI: http://localhost:4040                         ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  Logs:  /tmp/forex-backend.log  /tmp/forex-frontend.log  ║"
echo "║  Press Ctrl+C to stop all services                       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── Wait and cleanup on exit ───────────────────────────────────────────────────
trap 'echo ""; echo "[INFO] Shutting down..."; kill $BACKEND_PID $FRONTEND_PID $NGROK_PID 2>/dev/null; exit 0' INT TERM

wait
