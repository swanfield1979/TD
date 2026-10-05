# Installatie

## Lokale installatie

1. Installeer Node.js 22 of nieuwer.
2. Open PowerShell in de map `source/`.
3. Voer `npm install` uit.
4. Plaats de drie IBKR Flex XML-bestanden in `source/data/private/`.
5. Voer `npm run import:flex` uit.
6. Start de website met `npm run dev`.
7. Open `http://127.0.0.1:5173`.

De ruwe rapporten en de gegenereerde financiële samenvatting worden niet aan Git toegevoegd.

## Volledige synchronisatie bijwerken (versie 0.26.0)

Nadat de gewijzigde broncode op de server staat, voer via PuTTY uit:

```bash
cd /home/gerard/TD/source
npm ci
npm run import:flex
npm test
npm run build
sudo rsync -a --delete dist/ /var/www/trading-monitor/
sudo systemctl restart trading-monitor-api.service
```

Een nieuwe Flex-export is niet nodig om de actuele kalendermaand, het saldo, posities, uitvoeringen en de daarvan afgeleide dashboardcijfers op te halen. `npm run import:flex` houdt de lokale historische basis en overlapgrens actueel. Controleer in IB Gateway onder API → Settings dat **Master API client ID** overeenkomt met `IBKR_CLIENT_ID` (standaard 77); dit is nodig om commissierapporten van andere clients te ontvangen. De uitvoeringaanvraag gebruikt een rekeningfilter zonder clientfilter, zodat ook handmatige trades worden opgehaald. Zie [IBKR-uitvoeringen en commissies](https://interactivebrokers.github.io/tws-api/executions_commissions.html).

Herlaad de website en klik op **Vernieuwen**. Controleer dat **Deze maand** de actuele kalendermaand toont en dat saldo, posities, maand-/jaarresultaten, Trades en Stats dezelfde peildatum volgen. Laat de API-service tijdens handelsdagen draaien: Gateway levert standaard alleen uitvoeringen vanaf middernacht. De service bewaart deze in `/var/lib/trading-monitor/live-snapshot.json` (of `IBKR_SNAPSHOT_PATH`); verwijder dit bestand niet bij updates. De achtergrondcontrole haalt iedere minuut op en start geen nieuwe MFA-aanmelding.

## Productie-installatie op Linux, webroot en poort 80

Met deze installatie is Trading Monitor bereikbaar via `http://<intern-ip>/`, zonder poortnummer of submap. Nginx luistert op de standaard HTTP-poort 80. De Vite-ontwikkelserver op poort 5173 blijft uitsluitend bedoeld voor lokaal ontwikkelen.

### 1. Bouw de website

Voer deze opdrachten uit vanuit `source/`:

```bash
npm ci
npm run import:flex
npm test
npm run build
```

De productie-uitvoer staat daarna in `source/dist/`. De gegenereerde `portfolio-summary.json` wordt door Vite in de build opgenomen.

### 2. Plaats de build in de documentroot

```bash
sudo install -d -o root -g www-data -m 0755 /var/www/trading-monitor
sudo rsync -a --delete dist/ /var/www/trading-monitor/
```

De optie `--delete` verwijdert uitsluitend verouderde bestanden binnen `/var/www/trading-monitor/`. Controleer daarom voor uitvoering dat dit exact de bedoelde documentroot is.

### 3. Activeer de Nginx-configuratie

```bash
sudo cp deploy/nginx/trading-monitor.conf /etc/nginx/sites-available/trading-monitor
sudo ln -s /etc/nginx/sites-available/trading-monitor /etc/nginx/sites-enabled/trading-monitor
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

De meegeleverde configuratie gebruikt `listen 80 default_server` en bedient daardoor de volledige webroot van deze server. Verwijder of wijzig eerst een andere actieve `default_server` voor poort 80 om een Nginx-configuratiefout te voorkomen.

Open vervolgens:

```text
http://<intern-ip>/
```

### Bijwerken

Bouw na een wijziging opnieuw vanuit `source/` en synchroniseer alleen de gecontroleerde buildmap:

```bash
npm run import:flex
npm test
npm run build
sudo rsync -a --delete dist/ /var/www/trading-monitor/
```

Een herstart van Nginx is bij alleen gewijzigde websitebestanden niet nodig.

## Bijwerken via PuTTY (versie 0.24.0)

Voer het hele blok uit op de bestaande Linux-server. Bij een fout stopt het blok. `git pull --ff-only` overschrijft geen conflicterende lokale wijzigingen. De private Flex-XML blijft op de server. De nieuwe maandgrafiek vereist een herimport; de API-herstart activeert tevens de eerder toegevoegde live-saldovergelijking.

```bash
(
set -e
cd /home/gerard/TD
test "$(git branch --show-current)" = "main"
git pull --ff-only origin main
cd source
npm ci
npm run import:flex
npm test
npm run build
test -s dist/index.html
test -s dist/data/portfolio-summary.json
backup_dir="/var/backups/trading-monitor/$(date +%Y%m%d-%H%M%S)"
sudo mkdir -p "$backup_dir"
sudo cp -a /var/www/trading-monitor "$backup_dir/webroot"
sudo rsync -a --delete dist/ /var/www/trading-monitor/
sudo systemctl restart trading-monitor-api.service
sudo systemctl is-active trading-monitor-api.service
curl --fail --silent --show-error http://127.0.0.1/ -o /dev/null
curl --fail --silent --show-error http://127.0.0.1/api/ibkr/status
printf '\nTrading Monitor 0.24.0 bijgewerkt. Webroot-back-up: %s/webroot\n' "$backup_dir"
)
```

De documentroot is hier expliciet `/var/www/trading-monitor/`; `--delete` geldt uitsluitend voor deze map. Nginx hoeft bij deze update niet te worden herladen. Open daarna `http://192.168.1.22/` en vernieuw de browser met **Ctrl+F5**. Controleer Dashboard, Stocks, Options, Goals, Stats en Trades. De IBKR-status kan na de API-herstart eerst niet verbonden zijn; gebruik indien nodig **Verbinden** en bevestig IB Key op de telefoon.

Voor terugzetten van alleen de frontend: gebruik het exacte back-uppad dat het blok toont en synchroniseer de inhoud van de map `webroot/` terug naar `/var/www/trading-monitor/`. De back-up bevat private dashboarddata en blijft uitsluitend op de server.

## IBKR Gateway-koppeling met mobiele MFA

De koppeling bestaat uit vier lokaal afgeschermde onderdelen:

1. IBC start IB Gateway en vult de IBKR-inloggegevens in.
2. IBKR Mobile toont de IB Key MFA-bevestiging aan de gebruiker.
3. `trading-monitor-api.service` leest rekening- en positiegegevens via de read-only Gateway-socket.
4. Nginx stuurt uitsluitend `/api/` door naar de backend op `127.0.0.1:8787`.

### Vereisten

- IB Gateway 1050 staat in `/home/gerard/Jts/ibgateway/1050`.
- IBC staat in `/opt/ibc` en bevat `/opt/ibc/gatewaystart.sh`.
- In `gatewaystart.sh` staat `TWS_MAJOR_VRSN=1050`.
- De Gateway gebruikt **Read-Only API**.
- Gebruik poort `4001` voor een live Gateway of `4002` voor paper trading, tenzij de Gateway zelf anders is ingesteld.
- IBC `config.ini` bevat de logininstellingen en is uitsluitend leesbaar voor `gerard` (`chmod 600`). Zet dit bestand nooit in Git.

IBC kan de aanmelding starten, maar de IB Key-bevestiging moet altijd handmatig in IBKR Mobile worden goedgekeurd.

### 1. Installeer het virtuele scherm

```bash
sudo apt update
sudo apt install -y xvfb
```

### 2. Controleer IBC

```bash
test -x /opt/ibc/gatewaystart.sh && echo "IBC startscript gevonden"
grep '^TWS_MAJOR_VRSN=' /opt/ibc/gatewaystart.sh
```

Wanneer IBC elders staat, pas `WorkingDirectory` en `ExecStart` in `deploy/systemd/ibc-gateway.service` aan voordat de service wordt geïnstalleerd.

### 3. Installeer de configuratie

```bash
cd /home/gerard/TD/source

sudo install -d -o root -g gerard -m 0750 /etc/trading-monitor
sudo cp deploy/trading-monitor/ibkr.env.example /etc/trading-monitor/ibkr.env
sudo chown root:gerard /etc/trading-monitor/ibkr.env
sudo chmod 0640 /etc/trading-monitor/ibkr.env
sudo nano /etc/trading-monitor/ibkr.env
```

Controleer in `ibkr.env` vooral `IBKR_PORT` en `IBKR_ALLOWED_ORIGINS`. De origin moet exact overeenkomen met het adres waarmee de browser de website opent, bijvoorbeeld `http://192.168.1.22`.

### 4. Installeer de services en beperkte sudo-regel

```bash
sudo cp deploy/systemd/xvfb.service /etc/systemd/system/xvfb.service
sudo cp deploy/systemd/ibc-gateway.service /etc/systemd/system/ibc-gateway.service
sudo cp deploy/systemd/trading-monitor-api.service /etc/systemd/system/trading-monitor-api.service
sudo cp deploy/sudoers/trading-monitor-ibkr /etc/sudoers.d/trading-monitor-ibkr
sudo chmod 0440 /etc/sudoers.d/trading-monitor-ibkr
sudo visudo -cf /etc/sudoers.d/trading-monitor-ibkr

sudo systemctl daemon-reload
sudo systemctl enable --now xvfb.service
sudo systemctl enable --now trading-monitor-api.service
```

`ibc-gateway.service` wordt bewust niet automatisch ingeschakeld: de knop **Verbinden** start deze service wanneer dat nodig is.

### 5. Werk Nginx en de website bij

```bash
cd /home/gerard/TD/source
npm ci
npm test
npm run build
sudo rsync -a --delete dist/ /var/www/trading-monitor/

sudo cp deploy/nginx/trading-monitor.conf /etc/nginx/sites-available/trading-monitor
sudo nginx -t
sudo systemctl reload nginx
```

### 6. Controleer de backend

```bash
curl http://127.0.0.1:8787/api/ibkr/status
sudo systemctl status trading-monitor-api.service --no-pager
```

Open daarna `http://192.168.1.22/` en klik linksonder op **Verbinden**. Bevestig binnen drie minuten de melding in IBKR Mobile. Na een geslaagde API-handshake veranderen de status en knop naar **IBKR verbonden** en **Vernieuwen**.

Bij een fout:

```bash
sudo journalctl -u trading-monitor-api.service -u ibc-gateway.service -n 100 --no-pager
```

Stel deze website en poort 8787 nooit rechtstreeks beschikbaar op internet. De backend luistert daarom uitsluitend op localhost; alleen Nginx mag `/api/` doorgeven.
