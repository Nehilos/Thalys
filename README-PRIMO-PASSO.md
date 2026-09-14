# Thalys v0.43.0 — Free-First Architecture

Questa release prepara il punto 14 senza migrare i dati che oggi funzionano.

## Regole architetturali bloccate
- costi: solo servizi gratuiti; nessun fallback automatico a servizi a pagamento;
- foto progressi: Google Drive soltanto;
- dati app: Google Drive + IndexedDB + Sync Queue;
- AI: free tier only; se la quota gratuita termina, la richiesta fallisce invece di passare a un servizio a pagamento;
- backend preferito: Cloudflare Workers Free, disabilitato finché non viene configurato manualmente.

## Backend incluso ma non attivo
La cartella `backend/cloudflare-worker/` contiene uno scaffold gratuito con:
- `/health`;
- registrazione/rimozione subscription Push in D1;
- schema D1;
- configurazione Wrangler di esempio;
- endpoint refresh Google volutamente non ancora attivo (501) finché non migriamo in sicurezza al code flow.

## Importante
Il backend NON contiene endpoint per foto o database Thalys. Non va usato per spostarli da Drive.

## Test consigliati
1. accesso, refresh e riapertura;
2. offline -> modifica -> online -> sync automatico;
3. foto online da Drive, aggiunta/eliminazione/refresh;
4. Opzioni: Costi = Solo gratuito, Foto progressi = Solo Google Drive, Backend = Non configurato;
5. Notifica test, camera e microfono;
6. consulti AI esistenti: se il free tier e disponibile devono continuare a funzionare; se la quota e esaurita deve comparire errore senza fallback a pagamento.


## v0.43.0 - Server Auth bridge
- Optional Google Authorization Code flow prepared for Cloudflare Worker Free.
- Refresh tokens stay encrypted server-side in D1 and are never stored in the browser.
- Existing browser OAuth remains the default and fallback until backend is explicitly enabled.
- Progress photos remain Google Drive only.
- Manual offline cache list aligned with the current application version.
