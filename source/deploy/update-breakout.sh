#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
test -f package.json
test "$(node -p "JSON.parse(require('fs').readFileSync('package.json')).version")" = "0.30.0"
systemctl cat trading-monitor-breakout.service >/dev/null 2>&1 || { echo 'Installeer de optionele scanner-service handmatig volgens docs/breakout-python.md, of gebruik npm run serve:lan. Er wordt geen service automatisch geïnstalleerd.' >&2; exit 1; }
api_unit="$(systemctl show trading-monitor-api.service -p WorkingDirectory --value)"
test "$(realpath "$api_unit")" = "$(pwd -P)" || { echo 'API WorkingDirectory wijkt af van deze source-map; publiceer de backend eerst naar de werkelijke API-map.' >&2; exit 1; }
npm ci
npm test
npm run test:frontend
python_bin="${BREAKOUT_PYTHON_BIN:-python3.12}"
"$python_bin" -c 'import sys; assert sys.version_info >= (3,12), "Python 3.12+ vereist"'
if ! test -x backend/.venv/bin/python; then "$python_bin" -m venv backend/.venv; fi
backend/.venv/bin/python -m pip install -r backend/requirements-lock.txt
(
  cd backend
  .venv/bin/python -m pytest -q
)
npm run build
test -s dist/index.html
backup_dir="/var/backups/trading-monitor/breakout-$(date +%Y%m%d-%H%M%S)"
sudo mkdir -p "$backup_dir"
sudo cp -a /var/www/trading-monitor "$backup_dir/webroot"
sudo cp -a /etc/nginx/sites-available/trading-monitor "$backup_dir/nginx.conf"
git rev-parse HEAD
echo 'Vorige repositorycommit voor eventuele code-rollback:'
git reflog -2 --format='%h %gs'
sudo rsync -a dist/ /var/www/trading-monitor/
sudo systemctl restart trading-monitor-breakout.service
sudo cp deploy/nginx/trading-monitor.conf /etc/nginx/sites-available/trading-monitor
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl restart trading-monitor-api.service
sudo systemctl is-active --quiet trading-monitor-api.service
curl --fail --silent --show-error http://127.0.0.1/ -o /dev/null
curl --fail --silent --show-error --retry 10 --retry-all-errors --retry-delay 1 http://127.0.0.1/api/breakout
curl --fail --silent --show-error http://127.0.0.1/api/health
printf '\nTrading Monitor 0.30.0 geplaatst. Back-up: %s/webroot\nOpen http://192.168.1.22/#breakout en vernieuw met Ctrl+F5.\nScanner standaard paper (4002), los van de bestaande portefeuilleverbinding.\n' "$backup_dir"
