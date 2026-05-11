#!/bin/bash
# deploy.sh — הפעלה בטוחה של PMS
# שימוש: bash scripts/deploy.sh

set -e
cd /var/www/pms

echo "🔧 [1/3] מבצע build..."
npm run build

echo "🔁 [2/3] מפעיל מחדש את PM2 (graceful reload)..."
pm2 reload ecosystem.config.js --update-env

echo "✅ [3/3] מאמת שהאפליקציה עלתה..."
sleep 5
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3004/)

if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ PMS עלה בהצלחה! (HTTP $HTTP_STATUS)"
  pm2 save
else
  echo "❌ שגיאה! HTTP status: $HTTP_STATUS"
  pm2 logs pms --lines 30 --nostream
  exit 1
fi
