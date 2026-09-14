# Thalys v0.36.3

Correzioni di coerenza multi-device e avatar.

- Rimossa la duplicazione legacy di `databasePayloads` / `initializeDriveWorkspace` in `drive.js`.
- I database dedicati vengono pubblicati prima di `app_state.json`, evitando snapshot misti.
- `alim_database.json` e `workout_plans.json` sono canonici dopo il replay della Sync Queue.
- Apertura Database Alimenti e Schede usa il consolidamento completo (queue + tombstone), non letture raw.
- Sync Queue estesa a scheda attiva e assegnazioni workout.
- `male.svg` e `female.svg` inclusi fisicamente nel pacchetto, ricostruiti dai vettoriali embedded validi.
- Sync Protocol v7.
- Cache PWA/offline v0.36.3.
