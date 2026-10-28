#!/usr/bin/env bash
set -euo pipefail
# Installed root-owned by install-app-updater.sh; never execute checkout scripts as root.
export PATH=/usr/sbin:/usr/bin:/sbin:/bin
test "$#" = 0
test "$(id -u)" = 0
. /etc/trading-monitor/updater.paths
test -d "$SOURCE_DIR/dist"
test -s "$SOURCE_DIR/dist/index.html"
test ! -L "$SOURCE_DIR/dist"
test ! -L /var/www/trading-monitor
test -z "$(find "$SOURCE_DIR/dist" -type l -print -quit)"
backup_dir="/var/backups/trading-monitor/app-$(date +%Y%m%d-%H%M%S)-$$"
install -d -m 0700 "$backup_dir"
cp -a /var/www/trading-monitor "$backup_dir/webroot"
systemctl show trading-monitor-api.service > "$backup_dir/api-service.txt"
rsync -a --chmod=D755,F644 "$SOURCE_DIR/dist/" /var/www/trading-monitor/
systemctl restart trading-monitor-api.service
if systemctl cat trading-monitor-breakout.service >/dev/null 2>&1; then
  systemctl restart trading-monitor-breakout.service
fi
systemctl is-active --quiet trading-monitor-api.service
printf 'Webroot-back-up: %s\n' "$backup_dir"
