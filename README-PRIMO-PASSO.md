# Thalys v0.37

Correzione avatar esterni.

- `male.svg` e `female.svg` nel repository sono ora la sorgente normale dell'avatar.
- Il vecchio SVG incorporato in `index.html` resta solo come fallback se il file esterno non può essere caricato.
- Le funzioni legacy non possono più sostituire l'SVG esterno dopo aggiornamento misure/Home.
- Cache PWA e riferimenti aggiornati a v0.37.
- I due file SVG NON sono inclusi nello ZIP: restano asset stabili del repository, come richiesto.

# Thalys v0.37

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


## v0.37 - Avatar cache bust
- `male.svg` e `female.svg` sono gli originali caricati dall'utente, senza modifiche.
- Tutti i percorsi avatar usano query versionata `?v=037`.
- Cache PWA/manuale aggiornata per forzare il refresh degli SVG.
- Nessuna modifica funzionale a Dieta, sync o Workout rispetto alla v0.36.4.


## v0.37.7
- Sessione persistente sulla stessa versione software: refresh/riapertura entra direttamente nell app.
- Una nuova versione software richiede una riconnessione una tantum.
- Nome usato da Thalys spostato nel pannello Foto profilo.
- male.svg e female.svg restano asset esterni nel repository e non sono inclusi nello ZIP.


## v0.37.7
- Stato visibile: offline = Locale; Drive solo con rete e token attivo.
- Riconnessione rapida coordinata Auth→Drive al ritorno della rete.
- Foto progresso: cartella Drive /foto come sorgente canonica online, IndexedDB solo cache offline.
- Avatar: male.svg/female.svg esterni come unica sorgente normale; rimosso fallback al vecchio vettoriale incorporato.
