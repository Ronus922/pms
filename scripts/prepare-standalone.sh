#!/bin/bash
# Deploy PMS — use pnpm start (not standalone server.js)
set -e

echo "Deploying PMS..."

# Kill existing
lsof -ti:3004 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1

# Start with pnpm start
cd /var/www/pms
PORT=3004 nohup pnpm start > /tmp/pms.log 2>&1 &

echo "PMS running on port 3004"
echo "  URL: https://pms.bios.co.il"
