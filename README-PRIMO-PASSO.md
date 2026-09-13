# Thalys v0.34

## v0.34 - Sync Queue foundation

- Aggiunta `js/sync-queue.js` con coda persistente in IndexedDB.
- Ogni salvataggio locale registra una modifica pendente con `deviceId`, timestamp, revisione e stato.
- Le modifiche pendenti vengono marcate sincronizzate solo dopo un salvataggio Drive completato con successo.
- Gli errori di sincronizzazione restano registrati nella coda senza perdere le modifiche locali.
- Il sistema `driveDirty` della v0.32 resta attivo come fallback di sicurezza.
- Cache PWA e cache offline manuale aggiornate a v0.34.

## v0.32 - Home + Analytics separated

- Baseline: v0.30 stabile.
- Dashboard Home, avatar, coach, focus e gamification spostati in `js/home.js`.
- Analytics, filtri, grafici e trend wellness spostati in `js/analytics.js`.
- Le date condivise restano inizializzate nel core per evitare errori TDZ su Safari/iOS.
- Nessuna modifica intenzionale a UI, dati, Drive, autenticazione, offline o sincronizzazione.
- Cache PWA e cache offline manuale aggiornate a v0.32.


## v0.32 - IndexedDB foundation
Aggiunto Storage Manager versionato, deviceId persistente e store IndexedDB dedicati a metadata, snapshot e futura sync queue. localStorage resta attivo come fallback durante la migrazione graduale.
