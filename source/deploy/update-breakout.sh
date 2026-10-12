#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
test -f package.json
test "$(node -p "JSON.parse(require('fs').readFileSync('package.json')).version")" = "0.28.0"
api_unit="$(systemctl show trading-monitor-api.service -p WorkingDirectory --value)"
test "$(realpath "$api_unit")" = "$(pwd -P)" || { echo 'API WorkingDirectory wijkt af van deze source-map; publiceer de backend eerst naar de werkelijke API-map.' >&2; exit 1; }
npm ci
npm test
npm run build
test -s dist/index.html
backup_dir="/var/backups/trading-monitor/breakout-$(date +%Y%m%d-%H%M%S)"
sudo mkdir -p "$backup_dir"
sudo cp -a /var/www/trading-monitor "$backup_dir/webroot"
git rev-parse HEAD
echo 'Vorige repositorycommit voor eventuele code-rollback:'
git reflog -2 --format='%h %gs'
sudo rsync -a dist/ /var/www/trading-monitor/
sudo systemctl restart trading-monitor-api.service
sudo systemctl is-active --quiet trading-monitor-api.service
curl --fail --silent --show-error http://127.0.0.1/ -o /dev/null
curl --fail --silent --show-error --retry 10 --retry-all-errors --retry-delay 1 http://127.0.0.1/api/breakout
printf '\nTrading Monitor 0.28.0 geplaatst. Back-up: %s/webroot\nOpen http://192.168.1.22/#breakout en vernieuw met Ctrl+F5.\n' "$backup_dir"
