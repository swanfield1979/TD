#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
test -f package.json
test "$(node -p "JSON.parse(require('fs').readFileSync('package.json')).version")" = "0.42.1"
systemctl cat trading-monitor-api.service >/dev/null 2>&1 || { echo 'De bestaande trading-monitor-api.service ontbreekt; zie docs/iv-leaps.md.' >&2; exit 1; }
api_dir="$(systemctl show trading-monitor-api.service -p WorkingDirectory --value)"
test "$(realpath "$api_dir")" = "$(pwd -P)" || { echo 'API WorkingDirectory wijkt af van deze source-map; werk de echte API-checkout bij.' >&2; exit 1; }
npm ci
npm test
npm run test:frontend
npm run build

# One-time service setup (also refreshes the fixed helpers on a manual update).
sudo bash deploy/install-app-updater.sh
test -s dist/index.html
backup_dir="/var/backups/trading-monitor/options-$(date +%Y%m%d-%H%M%S)"
sudo mkdir -p "$backup_dir"
sudo cp -a /var/www/trading-monitor "$backup_dir/webroot"
sudo cp -a /etc/nginx/sites-available/trading-monitor "$backup_dir/nginx.conf"
sudo rsync -a dist/ /var/www/trading-monitor/
sudo cp deploy/nginx/trading-monitor.conf /etc/nginx/sites-available/trading-monitor
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl restart trading-monitor-api.service
if systemctl cat trading-monitor-breakout.service >/dev/null 2>&1; then
  sudo systemctl restart trading-monitor-breakout.service
fi
sudo systemctl is-active --quiet trading-monitor-api.service
curl --fail --silent --show-error --retry 10 --retry-all-errors --retry-delay 1 http://127.0.0.1/api/iv-scan
curl --fail --silent --show-error http://127.0.0.1/api/leaps/shortlist
curl --fail --silent --show-error http://127.0.0.1/api/martin-scan
curl --fail --silent --show-error http://127.0.0.1/api/put-spreads
curl --fail --silent --show-error http://127.0.0.1/api/stock-filter
curl --fail --silent --show-error http://127.0.0.1/api/put-spreads/iv
curl --fail --silent --show-error http://127.0.0.1/api/put-spreads/blocked
curl --fail --silent --show-error http://127.0.0.1/api/put-spreads/schedule
printf '\nTrading Monitor 0.42.1 geplaatst. Back-up: %s\nOpen http://192.168.1.22/#put-spreads, #martin of #leaps en vernieuw met Ctrl+F5.\n' "$backup_dir"
