# Thalys v0.36.4

Correzioni di coerenza multi-device e avatar.

- Rimossa la duplicazione legacy di `databasePayloads` / `initializeDriveWorkspace` in `drive.js`.
- I database dedicati vengono pubblicati prima di `app_state.json`, evitando snapshot misti.
- `alim_database.json` e `workout_plans.json` sono canonici dopo il replay della Sync Queue.
- Apertura Database Alimenti e Schede usa il consolidamento completo (queue + tombstone), non letture raw.
- Sync Queue estesa a scheda attiva e assegnazioni workout.
- `male.svg` e `female.svg` inclusi fisicamente nel pacchetto, ricostruiti dai vettoriali embedded validi.
- Sync Protocol v7.
- Cache PWA/offline v0.36.4.


## v0.36.4 - Meal preset picker + original SVG
- Ripristinati `male.svg` e `female.svg` esattamente dai file forniti dall'utente.
- Aggiungi pasto: rimossa la sezione di inserimento manuale dei nutrienti.
- Rimosso il menu a discesa dei preset.
- La schermata mostra direttamente gli alimenti del database, con i piu recenti in alto.
- Aggiunta ricerca rapida e quantita in grammi per ogni alimento.
- Il pulsante Aggiungi inserisce direttamente l'alimento nel pasto selezionato.
