#!/usr/bin/env bash
set -euo pipefail
# Run once by an administrator; later browser requests can start only this fixed unit.
test "$(id -u)" = 0 || { echo 'Gebruik sudo bash deploy/install-app-updater.sh'; exit 1; }
source_dir="$(cd "$(dirname "$0")/.." && pwd -P)"
api_dir="$(systemctl show trading-monitor-api.service -p WorkingDirectory --value)"
update_user="$(systemctl show trading-monitor-api.service -p User --value)"
test "$source_dir" = "$api_dir" || { echo 'Voer dit uit vanuit de checkout van de actieve API.'; exit 1; }
[[ "$source_dir" =~ ^/[a-zA-Z0-9_./-]+$ && "$update_user" =~ ^[a-z_][a-z0-9_-]*$ && "$update_user" != root ]] || { echo 'Niet-ondersteund installatiepad of API-gebruiker.'; exit 1; }
test -f "$source_dir/server/app-update-worker.mjs"
test -d /var/www/trading-monitor
command -v git >/dev/null
command -v rsync >/dev/null
command -v visudo >/dev/null
install -d -m 0755 /usr/local/libexec /etc/trading-monitor
printf 'SOURCE_DIR=%q\n' "$source_dir" > /etc/trading-monitor/updater.paths
chmod 0644 /etc/trading-monitor/updater.paths
cat > /usr/local/libexec/trading-monitor-update <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail
. /etc/trading-monitor/updater.paths
cd "$SOURCE_DIR"
TASK_NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$TASK_NVM_DIR/nvm.sh" ]; then . "$TASK_NVM_DIR/nvm.sh"; fi
export APP_UPDATE_STATE=/var/lib/trading-monitor/app-update.json
exec node server/app-update-worker.mjs
SCRIPT
install -m 0755 "$source_dir/deploy/publish-app-update.sh" /usr/local/libexec/trading-monitor-publish
chmod 0755 /usr/local/libexec/trading-monitor-update
cat > /etc/systemd/system/trading-monitor-update.service <<UNIT
[Unit]
Description=Trading Monitor gecontroleerde applicatie-update
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=$update_user
WorkingDirectory=$source_dir
ExecStart=/bin/bash /usr/local/libexec/trading-monitor-update
TimeoutStartSec=30min
KillMode=control-group
UMask=0077
StandardOutput=journal
StandardError=journal
UNIT
sudoers_temp="$(mktemp)"
trap 'rm -f "$sudoers_temp"' EXIT
printf '%s ALL=(root) NOPASSWD: /usr/bin/systemctl start --no-block trading-monitor-update.service, /usr/local/libexec/trading-monitor-publish ""\n' "$update_user" > "$sudoers_temp"
visudo -cf "$sudoers_temp"
install -m 0440 "$sudoers_temp" /etc/sudoers.d/trading-monitor-update
printf '{"sourceRoot":"%s","statePath":"/var/lib/trading-monitor/app-update.json"}\n' "$source_dir" > /etc/trading-monitor/app-updater.json
chmod 0644 /etc/trading-monitor/app-updater.json
systemctl daemon-reload
echo 'Updateknop geïnstalleerd. Open de pagina Updates in de webapp.'
