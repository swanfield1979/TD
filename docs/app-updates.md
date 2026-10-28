# Bijwerken vanuit de webapp

Beschikbaar vanaf Trading Monitor **0.41.0**. Open **Updates** in het menu of `/#updates`.

## Eenmalig installeren op de bestaande Linux-server

De oude webapp kan deze uitbreiding nog niet zelf installeren. Voer eenmalig uit:

```bash
cd /home/gerard/TD &&
git pull --ff-only &&
cd source &&
bash deploy/update-options.sh
```

Dit bestaande updatescript test en bouwt de app, installeert ook de nieuwe updateservice en publiceert daarna de webapp. Het kan eenmalig om het sudo-wachtwoord vragen. Vernieuw de browser met **Ctrl+F5** en open **Updates**. Controleer dat webapp en server **v0.41.0** tonen.

Is versie 0.41.0 al handmatig gepubliceerd maar ontbreekt de service, voer dan vanuit de echte `source/`-map van de API uit:

```bash
sudo bash deploy/install-app-updater.sh
```

De installer gebruikt de gebruiker en programmamap van de bestaande `trading-monitor-api.service`. Hij ondersteunt de bestaande Nginx-webroot `/var/www/trading-monitor`, de Node-API op poort 8787 en de privédatamap `/var/lib/trading-monitor`. Bij afwijkende installaties moet de beheerder deze paden eerst beoordelen. Een desktop-/ontwikkelinstallatie zonder Linux-systemd krijgt een melding dat de updateservice ontbreekt.

## Volgende updates

1. Klik **Controleren op updates**. De server vergelijkt de geïnstalleerde versie met de stabiele versie op de `main`-branch van de ingestelde Trading Monitor-repository op GitHub.
2. Bij een nieuwere versie verschijnt **Versie … installeren**. Rond actieve scans en IBKR-vernieuwingen af of stop de scans voordat je installeert.
3. Volg de status: voorbereiden, testen, bouwen en herstarten. De updateservice werkt zelfstandig door als je de browser sluit of de API herstart. Er worden tijdens de update geen nieuwe scans gestart.
4. Klik na bevestiging op **Nieuwe versie openen**. De pagina toont de frontend- en API-versie afzonderlijk, zodat een oude browsertab herkenbaar is.

Er wordt alleen bijgewerkt na een expliciete klik; er is geen automatische installatie op een schema. Verandert de GitHub-revisie tussen controleren en installeren, dan moet je opnieuw controleren. Een korte verbindingsonderbreking tijdens de API-herstart wordt zichtbaar opgevangen.

## Werking en rechten

De Node-API houdt zijn bestaande alleen-lezen toegang tot de programmamap. Een origincontrole en de bestaande applicatieheader beschermen de POST-route `/api/app-update`. De browser kan uitsluitend **check** of **install** aanvragen; geen opdracht, bestandslocatie, branch of download-URL opgeven.

De vaste `trading-monitor-update.service` draait als dezelfde gewone gebruiker als de API. Hij controleert repository, branch en lokale wijzigingen en gebruikt een aparte tijdelijke Git-worktree onder `source/.app-updates/`. `npm ci`, Node-tests, frontendtests en de productiebuild draaien daar eerst. De private gegenereerde dashboardbasis wordt behouden. Pas na geslaagde controles worden de broncode via fast-forward, de dependencies en de frontend vervangen.

De installatie zet twee vaste, door root beheerde helpers in `/usr/local/libexec/`. De sudoers-regel geeft uitsluitend toestemming om de vaste updateservice te starten en de vaste publicatiehelper zonder argumenten uit te voeren. De publicatiehelper maakt een webroot-back-up, plaatst statische bestanden met leesrechten voor Nginx en herstart de bestaande services. Hij voert geen scripts uit de checkout als root uit en past geen Nginx-configuratie aan. De bestaande API-sandbox blijft behouden.

Privébestanden, Flex-imports, brokerinstellingen, scanresultaten, blokkeerlijsten en weekplanning worden niet verwijderd. De bijgewerkte API-versie wordt na herstart gecontroleerd voordat de update als geïnstalleerd geldt.

## Bij een fout

Lokale Git-wijzigingen blokkeren de update: bewaar of commit ze eerst. Er wordt geen force-pull of reset uitgevoerd. Mislukken tests of de build, dan is de actieve installatie nog niet vervangen. Een fout tijdens publiceren of herstarten kan betekenen dat de broncode al bijgewerkt is; de pagina meldt dit expliciet. Er is **geen automatische volledige terugrol** van broncode, dependencies en services.

De status staat in `/var/lib/trading-monitor/app-update.json`; de eenmalige configuratie in `/etc/trading-monitor/app-updater.json`. De backend herkent een gestopte updateservice en biedt opnieuw controleren aan. De systemd-opdracht heeft een maximale looptijd van 30 minuten. Diagnostiek op de server:

```bash
systemctl status trading-monitor-update.service
journalctl -u trading-monitor-update.service -n 100 --no-pager
systemctl status trading-monitor-api.service
```

Webroot-back-ups staan onder `/var/backups/trading-monitor/app-*`. De voorgaande dependencies blijven onder `source/.app-updates/dependencies-*` beschikbaar voor handmatig herstel. Deze herstelmappen gebruiken schijfruimte; laat de beheerder oudere exemplaren na een geslaagde update opruimen. De huidige broncode heeft zijn Git-geschiedenis behouden. De vaste serverhelpers worden alleen door de beheerder bijgewerkt via het handmatige updatescript, niet door browseraanvragen.

## Validatie

Unit-/integratietests simuleren versiecontrole, begrensde opdrachten, dubbele acties, lokale wijzigingen, een gewijzigd GitHub-doel, testfouten, het bewaren van de dashboardbasis en de API-herstart. De HTTP-test controleert de origin/headervereiste. De browsercontrole gebruikt gesimuleerde updateantwoorden voor installatie, voortgang, herladen, verbindingsherstel, fouten en mobiel gebruik. Shellscripts zijn syntactisch gecontroleerd. De daadwerkelijke systemd-/sudo-installatie en productie-update moeten op de Linux-server nog worden uitgevoerd; deze zijn niet vanuit de Windows-ontwikkelomgeving bevestigd.
