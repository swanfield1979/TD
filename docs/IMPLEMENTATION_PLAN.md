# Implementatie en controle

1. Bestaand portfolio-project en standalone prototype inspecteren; donkere Nederlandse tradinginterface en lime-accent behouden.
2. Analyse isoleren in zuivere functies met centrale gevalideerde configuratie; deterministische setupfixtures en tests toevoegen.
3. Brokerinterface implementeren met gepinde read-only IBKR-adapter en fake adapter voor tests/expliciete demo.
4. SQLite-cache, CSV-universum, contractresolutie, sequentiële incrementele sync, annulering en foutbehoud implementeren.
5. FastAPI-routes en React-tabel/details koppelen; dezelfde productie-origin en één LAN-startcommando leveren.
6. Backend-, frontend- en regressietests uitvoeren, productie bouwen, demo-E2E en echte productie-health/LAN-pagina controleren.
7. Nederlandse documentatie en GitHub-update leveren; werkelijke serverdeployment en IBKR-toegang afzonderlijk verifiëren zodra die omgeving beschikbaar is.

Stappen 1–5 zijn geïmplementeerd. De afsluitende validatieresultaten staan in [validatie.md](validatie.md). Stap 7 geeft geen installatieclaim voor 192.168.1.22 zonder controle op die server.
