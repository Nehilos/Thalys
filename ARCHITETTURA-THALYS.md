# Thalys - Architettura stabile v0.48.1

## Sorgenti dati

- Dati applicativi: Google Drive come sorgente cloud + IndexedDB come sorgente locale/offline.
- Modifiche offline: Sync Queue granulare + Conflict Resolver protocollo v7.
- Foto progresso: esclusivamente Google Drive; non vengono rese disponibili offline.
- Foto profilo: persistenza locale separata + sincronizzazione profilo.

## Autenticazione

- Google Identity lato client per accesso iniziale/fallback.
- Cloudflare Worker Free per Authorization Code e refresh token server-side.
- Refresh token cifrato lato Worker/D1; non viene salvato nel browser.
- Session ID/secret locale duplicato in IndexedDB per recovery offline.

## Reconnect e sync

1. ritorno rete;
2. ripristino sessione server;
3. refresh access token quando necessario;
4. single-flight recovery Drive;
5. pull + merge + tombstone;
6. flush Sync Queue;
7. upload stato consolidato;
8. stato sincronizzato/verde solo a recovery conclusa.

## Backend free-first

- Cloudflare Workers Free + D1.
- Push Web standard con VAPID.
- Nessun archivio foto nel backend.
- Policy applicativa: nessun passaggio automatico a servizi a pagamento.

## Versioning

La versione applicativa, il protocollo sync e il cache bust devono derivare da `js/config.js`. Il Runtime Health Check segnala eventuali divergenze.

## v0.50.2 - Dieta Reale / Pianificato
- La sezione Dieta separa il diario consumato (Reale) dalla copia quotidiana del piano attivo (Pianificato).
- `mealPlans` conserva i piani ufficiali settimanali.
- `mealPlanDailyOverrides[date]` conserva le sole variazioni giornaliere e non modifica il piano ufficiale.
- `mealPlanCompletions[date]` conserva le spunte; una spunta genera/rimuove un record `nutrition` con `source: meal-plan`.
- Gli alimenti categoria `Bevande` sono normalizzati e visualizzati in ml in tutti i flussi nutrizionali.

## v0.50.2 - Editor piani alimentari e progresso
- Il piano ufficiale continua a referenziare copie dei dati nutrizionali del database alimenti al momento dell'inserimento.
- Nessuna compilazione automatica dei piatti nel piano: la sorgente e il database alimenti gia compilato.
- L'editor usa ricerca e categoria per selezionare i preset, con quantita esplicita g/ml.
- Il completamento giornaliero deriva da mealPlanCompletions e viene rappresentato come done/total + percentuale.
- Le calorie pianificate sono calcolate dalle quantita giornaliere, per pasto e totale giorno.


## v0.50.4 - Sync live Pianificato
- Nessuna modifica alla UI mobile.
- Il desktop accetta Drive come sorgente canonica per Pianificato quando non ha modifiche locali pendenti.
- Controllo leggero ogni 5 secondi di app_state.json per aggiornare piano attivo, override giornalieri e spunte completamento tra dispositivi.


### v0.50.4 - Picker alimenti condiviso Reale/Pianificato
Il modal `add-food-modal` e il relativo motore di ricerca/selezione sono ora condivisi tra Reale e Pianificato. Il contesto di apertura determina la destinazione del salvataggio: diario reale oppure override giornaliero del piano.


## v0.51.0 - Target giornalieri Home
La Home espone un riepilogo dei target nutrizionali attivi e usa il target acqua effettivo come soglia di completamento (100%). Questa versione prepara il successivo bilancio energetico completo; il consumo energetico da passi/attività sarà collegato quando verrà introdotto il relativo tracker, evitando stime non ancora supportate dai dati dell'app.

## v0.52.0 - Wellness Score + radar Home
- Nuovo Thalys Wellness Score giornaliero 0-100.
- Cinque aree: Cura di sé, Corpo/Allenamento, Mente, Riposo, Nutrizione.
- Grafico radar giornaliero in Home basato esclusivamente sui dati già registrati.
- Nessuna modifica a Dieta Reale/Pianificato o sincronizzazione.

