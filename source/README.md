# Ontwikkeling

De webapp staat volledig in deze map. Voer alle ontwikkel- en bouwcommando's vanuit `source/` uit.

## Vereisten

- Node.js 22 of nieuwer
- npm 10 of nieuwer

## Lokale data klaarzetten

Plaats de drie IBKR Flex-bestanden in `data/private/` met deze namen:

- `flex_net_liq_into_db.xml`
- `flex_trades_into_db.xml`
- `flex_optionEAE_into_db.xml`

Deze map en de gegenereerde dashboarddata zijn bewust uitgesloten van Git.

## Commando's

```powershell
npm install
npm run import:flex
npm run dev
```

Open daarna `http://127.0.0.1:5173`.

Validatie en productiebuild:

```powershell
npm test
npm run build
npm run preview
```

## Productie op poort 80

De meegeleverde Nginx-configuratie staat in [`deploy/nginx/trading-monitor.conf`](deploy/nginx/trading-monitor.conf). Volg de Linux-instructies in [`../docs/installatie.md`](../docs/installatie.md) om de build op `http://<intern-ip>/` beschikbaar te maken.
