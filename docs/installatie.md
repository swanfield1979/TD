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
