# Thalys v0.49.0 - Automatic Reconnect Sync Fix

Correzione single-flight del recovery Drive e gate finale su driveDirty/Sync Queue: il ritorno online non viene considerato completato finché le modifiche locali non sono state consolidate e salvate automaticamente.

# Thalys v0.49.0 - Server Session Persistence Fix

Correzione mirata: sessione server Google duplicata in IndexedDB, ripristino dopo avvio offline, stato UI resiliente agli errori transitori e refresh dello stato dopo reconnect. Nessuna modifica richiesta al Worker Cloudflare.

# Thalys v0.49.0 - Google Server Auth + Refresh Token

- Google Authorization Code Flow server-side attivo.
- Refresh token cifrato nel Worker/D1; non viene salvato nel browser.
- Refresh automatico quando il token manca o ha meno di 10 minuti di validita.
- Refresh al ritorno online e quando l'app torna in primo piano.
- Browser OAuth precedente mantenuto come fallback di sicurezza.
- Push remota v0.46 invariata. Foto sempre Google Drive only.

## Primo test v0.47
Dopo l'aggiornamento, vai in Opzioni e premi **Attiva sessione server** una sola volta. Completa il popup Google. Lo stato deve diventare **Attiva**.

# Thalys v0.49.0 - Remote Push Test

Questa versione attiva registrazione Push remota e test Worker->dispositivo. Google server auth resta disattivato.

Prima di testare il pulsante **Test push remota**, pubblica il Worker incluso con `npx wrangler deploy`, poi pubblica l'app su Vercel.

# Thalys v0.49.0 - Backend Connected Test

Backend health-check collegato a https://thalys.thalys-app.workers.dev. Google server auth resta disattivato in questa release. Foto progressi solo Google Drive.

# Thalys v0.49.0 - Deployment Ready

Questa versione prepara il deploy gratuito del backend senza attivarlo.

- Foto progressi: sempre e solo Google Drive.
- Dati app: Drive + IndexedDB.
- Backend: Cloudflare Workers Free, ancora disattivato.
- Google server auth: ancora disattivato.
- Contratto app/backend: versione 1.
- Chiavi: generate localmente, nessun segreto incluso.

Per il backend leggere `backend/cloudflare-worker/DEPLOY-GRATIS.md`.

# Thalys v0.49.0 — Free-First Architecture

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


## v0.49.0 - Server Auth bridge
- Optional Google Authorization Code flow prepared for Cloudflare Worker Free.
- Refresh tokens stay encrypted server-side in D1 and are never stored in the browser.
- Existing browser OAuth remains the default and fallback until backend is explicitly enabled.
- Progress photos remain Google Drive only.
- Manual offline cache list aligned with the current application version.

## v0.49.0 - Final Architecture Hardening

Questa release consolida la baseline stabile senza cambiare il comportamento funzionale:
- versione/cache bust centralizzati su 0.49.0 / 0490;
- Conflict Resolver allineato a ThalysConfig;
- Sync Queue e sync_meta allineati al protocollo v7;
- Runtime Health esteso a coerenza resolver/queue/dirty state;
- cache PWA e cache manuale offline riallineate;
- aggiunto ARCHITETTURA-THALYS.md.

Le foto progresso restano esclusivamente su Google Drive. Il backend resta Cloudflare Workers/D1 free-first. male.svg e female.svg non sono inclusi nel pacchetto.


## v0.49.0 - Stability & UX Foundation
- server refresh preferred before silent browser OAuth; automatic retry on Drive 401;
- same-version session prepaint avoids welcome-screen flash;
- gratitude migrated into appState + IndexedDB/Drive (`gratitude.json`) and sync queue/conflict resolver;
- Pausa mentale completes with Mindfulness, Body scan or Gratitudine;
- nutrition inputs accept hundredths and barcode save returns to food database;
- confirmations added to destructive workout/diary/consult deletion paths;
- tab changes start at top while same-view rerenders preserve scroll.
