# Thalys v0.35.1

## Conflict Resolver Fix + Full Conflict Audit

Questa versione corregge il bug che impediva al Conflict Resolver di essere applicato durante il ritorno online.

Correzioni principali:
- `cloud` nel caricamento Drive e ora riassegnabile: il resolver non cade piu nel fallback con `Assignment to constant variable`.
- I database dedicati (`water.json`, `nutrition.json`, `body_metrics.json`, ecc.) hanno precedenza sulla copia duplicata in `app_state.json`.
- Le operazioni granulari update salvano `before` + `after`, permettendo merge per campo senza cancellare modifiche remote indipendenti.
- L acqua continua a usare il delta locale sul valore remoto piu recente.
- Le cancellazioni pendenti vengono riapplicate dopo il download remoto.
- Gli errori di rete/offline durante il sync automatico non aprono piu il popup di errore sincronizzazione; le modifiche restano pending.
- Sync Protocol aggiornato alla versione 4.
- Cache PWA/offline aggiornata a v0.35.1.

La v0.34/v0.35 queue resta compatibile: le vecchie operazioni pending vengono gestite con fallback legacy.

Audit conflitti automatico eseguito su: acqua, alimenti, misure corpo, schede, storico workout, completamenti workout, meditazione, impostazioni, target, profilo, preset alimenti e cancellazioni.
