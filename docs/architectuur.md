# Architectuur

Trading Monitor is voorlopig een statische React/TypeScript-app met Vite.

1. De privé Flex XML-rapporten staan uitsluitend lokaal in `source/data/private/`.
2. `source/scripts/import-flex.mjs` leest de rapporten en berekent saldo-, maand-, trade-, looptijd-, premie- en allocatiestatistieken.
3. De samenvatting wordt lokaal geschreven naar `source/public/data/portfolio-summary.json`.
4. De React-app haalt dit JSON-bestand op en toont de statistieken.

Ruwe trades, rekeningidentificatie en andere XML-inhoud worden niet naar de browser gekopieerd. Voor een toekomstige IBKR-koppeling hoort de importlogica achter een server-API met authenticatie en veilige opslag te komen.
