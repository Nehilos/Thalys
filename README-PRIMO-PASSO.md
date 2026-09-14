# Thalys v0.36.2

Bugfix autenticazione/logout Google Drive.

Modifiche principali:
- Il normale pulsante Disconnetti ora esegue un logout locale da Thalys senza revocare il grant OAuth Google.
- Eliminata la race tra revoke OAuth e nuovo login che poteva generare permission_denied.
- Una sola richiesta OAuth può essere attiva alla volta.
- Dopo logout il token client viene ricreato senza hint dell'account precedente.
- Il login manuale usa selezione account senza forzare inutilmente un nuovo consenso ogni volta.
- Se una callback OAuth tardiva fallisce ma esiste già un token valido, Thalys usa il token valido invece di mostrare un falso errore.
- Dopo un nuovo token, un 403 Drive transitorio viene ritentato una sola volta con workspace Drive ricaricato.
- Nessuna modifica alla Sync Queue / Conflict Resolver v0.35.1.
- Cache PWA/offline e query degli script aggiornate a v0.36.2.

Test consigliato:
1. Accedi normalmente e verifica pallino verde.
2. Premi Disconnetti.
3. Dalla schermata iniziale premi Continua/Riconnetti con Google.
4. Seleziona l'account: deve entrare e collegare Drive senza permission_denied.
5. Ripeti logout/login 2-3 volte.
6. Verifica poi una sincronizzazione acqua e un test offline/online.


## v0.36.2
Aggiunte revisioni per record e tombstone persistenti sincronizzate tramite sync_meta.json (Sync Protocol 5).
