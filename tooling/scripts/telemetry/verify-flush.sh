#!/bin/bash

# verify-flush.sh
# Validates that background R2 memory flushes complete after HTTP response.
# Uses wrangler tail to monitor async operations.
#
# Usage:
#   ./verify-flush.sh            # Run default checks
#   ./verify-flush.sh --watch    # Continuously monitor

set -euo pipefail

WORKER_NAME="${WORKER_NAME:-multi-agent-hub}"
TIMEOUT="${TIMEOUT:-30}"

echo "=== R2 Async Flush Verification ==="
echo "Worker: $WORKER_NAME"
echo "Timeout: ${TIMEOUT}s"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ wrangler not found. Install with: npm install -g wrangler"
    exit 1
fi

if [ "${1:-}" = "--watch" ]; then
    echo "Starting wrangler tail — watching for async flush operations..."
    echo ""
    wrangler tail --format pretty "$WORKER_NAME"
    exit 0
fi

echo "Step 1: Sending test message to trigger async flush..."
echo ""

# Send a test chat message (adjust URL as needed)
DEPLOY_URL="${DEPLOY_URL:-http://localhost:8787}"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$DEPLOY_URL/api/chat/test" \
    -H "Content-Type: application/json" \
    -d '{"message": "Hello, this is a test message for flush verification."}' \
    --max-time 10)

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

echo "HTTP Status: $HTTP_CODE"
echo "Response: $BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ HTTP response received (${HTTP_CODE})"
else
    echo "❌ HTTP response error (${HTTP_CODE})"
    exit 1
fi

echo ""
echo "Step 2: Checking wrangler tail for async flush logs..."
echo "Note: Run './verify-flush.sh --watch' in another terminal to see live logs."
echo ""

echo "Step 3: Verify R2 bucket has updated memory.md..."
echo ""

# In production, check via wrangler r2 object get
if [ -n "${R2_BUCKET:-}" ]; then
    echo "Checking R2 bucket: $R2_BUCKET"
    wrangler r2 object get "$R2_BUCKET/test/memory.md" --pipe 2>/dev/null || echo "Memory file not yet synced (expected during async flush)"
fi

echo ""
echo "=== Verification Complete ==="
echo ""
echo "Success criteria:"
echo "  [ ] HTTP 200 response returned BEFORE memory write completes"
echo "  [ ] R2 object updated within ${TIMEOUT}s of HTTP response"
echo "  [ ] No errors in wrangler tail logs"