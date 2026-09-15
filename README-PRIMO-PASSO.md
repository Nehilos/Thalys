# Thalys v0.48.1 - Automatic Reconnect Sync Fix

Correzione single-flight del recovery Drive e gate finale su driveDirty/Sync Queue: il ritorno online non viene considerato completato finché le modifiche locali non sono state consolidate e salvate automaticamente.

# Thalys v0.48.1 - Server Session Persistence Fix

Correzione mirata: sessione server Google duplicata in IndexedDB, ripristino dopo avvio offline, stato UI resiliente agli errori transitori e refresh dello stato dopo reconnect. Nessuna modifica richiesta al Worker Cloudflare.

# Thalys v0.48.1 - Google Server Auth + Refresh Token

- Google Authorization Code Flow server-side attivo.
- Refresh token cifrato nel Worker/D1; non viene salvato nel browser.
- Refresh automatico quando il token manca o ha meno di 10 minuti di validita.
- Refresh al ritorno online e quando l'app torna in primo piano.
- Browser OAuth precedente mantenuto come fallback di sicurezza.
- Push remota v0.46 invariata. Foto sempre Google Drive only.

## Primo test v0.47
Dopo l'aggiornamento, vai in Opzioni e premi **Attiva sessione server** una sola volta. Completa il popup Google. Lo stato deve diventare **Attiva**.

# Thalys v0.48.1 - Remote Push Test

Questa versione attiva registrazione Push remota e test Worker->dispositivo. Google server auth resta disattivato.

Prima di testare il pulsante **Test push remota**, pubblica il Worker incluso con `npx wrangler deploy`, poi pubblica l'app su Vercel.

# Thalys v0.48.1 - Backend Connected Test

Backend health-check collegato a https://thalys.thalys-app.workers.dev. Google server auth resta disattivato in questa release. Foto progressi solo Google Drive.

# Thalys v0.48.1 - Deployment Ready

Questa versione prepara il deploy gratuito del backend senza attivarlo.

- Foto progressi: sempre e solo Google Drive.
- Dati app: Drive + IndexedDB.
- Backend: Cloudflare Workers Free, ancora disattivato.
- Google server auth: ancora disattivato.
- Contratto app/backend: versione 1.
- Chiavi: generate localmente, nessun segreto incluso.

Per il backend leggere `backend/cloudflare-worker/DEPLOY-GRATIS.md`.

# Thalys v0.48.1 — Free-First Architecture

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


## v0.48.1 - Server Auth bridge
- Optional Google Authorization Code flow prepared for Cloudflare Worker Free.
- Refresh tokens stay encrypted server-side in D1 and are never stored in the browser.
- Existing browser OAuth remains the default and fallback until backend is explicitly enabled.
- Progress photos remain Google Drive only.
- Manual offline cache list aligned with the current application version.

## v0.48.1 - Final Architecture Hardening

Questa release consolida la baseline stabile senza cambiare il comportamento funzionale:
- versione/cache bust centralizzati su 0.48.1 / 0481;
- Conflict Resolver allineato a ThalysConfig;
- Sync Queue e sync_meta allineati al protocollo v7;
- Runtime Health esteso a coerenza resolver/queue/dirty state;
- cache PWA e cache manuale offline riallineate;
- aggiunto ARCHITETTURA-THALYS.md.

Le foto progresso restano esclusivamente su Google Drive. Il backend resta Cloudflare Workers/D1 free-first. male.svg e female.svg non sono inclusi nel pacchetto.

## v0.48.1 - Ripristino automatico sessione server Google
- al ritorno della rete viene recuperata la sessione server persistente da localStorage/IndexedDB;
- la sessione server viene verificata e viene forzato un refresh anche se il token Drive locale non e ancora scaduto;
- la riconnessione Drive non puo piu saltare il ripristino della sessione server solo perche esiste un access token in cache;
- nessun popup Google automatico se la sessione persistente e ancora valida;
- se la sessione server e realmente revocata/scaduta resta attivo il normale fallback OAuth;
- cache/versione applicazione aggiornate a 0.48.1 / 0481.

## v0.48.2 - Login Google unificato e sessione server persistente
- `Continua con Google` e' ora l'unico flusso di accesso: un solo consenso Google crea sia accesso Drive sia sessione server persistente.
- Dopo un cambio versione il consenso viene richiesto una volta per dispositivo; completato con successo, la versione viene autorizzata.
- Dopo offline -> online la sessione server viene recuperata/aggiornata automaticamente senza popup e senza passare da Opzioni.
- `Disconnetti` elimina intenzionalmente la sessione server; il successivo `Continua con Google` la ricrea obbligatoriamente.
- Lo stato `Attiva` viene persistito e ripristinato da IndexedDB/localStorage per evitare il falso stato desktop `Verifica connessione...` dopo riaperture o riconnessioni transitorie.


## v0.48.4 - Stabilizzazione dati e UX
- Valori nutrizionali: input fino a 2 decimali anche per kcal/macronutrienti/minerali.
- Pausa mentale Home: completata con almeno una tra Mindfulness, Body Scan o Gratitudine.
- Gratitudine: migrata nello stato app sincronizzato con Drive, mantenendo compatibilita con il vecchio localStorage.
- Eliminazioni principali: conferma preventiva per schede, misure, foto locali, pasti, consulti e messaggi selezionati.
- Sincronizzazione/rerender: mantiene la posizione corrente; il cambio scheda continua a partire dall'alto.
- Barcode/proposta nutrizionale: dopo il salvataggio mostra "Alimento aggiunto" e torna al database alimenti.

## v0.48.5 - Stabilizzazione 2
- Gratitudine: messaggio "Pensiero salvato", pulizia automatica del box dopo salvataggio riuscito e cancellazione singola con conferma.
- Allenamento: stima non invasiva dei minuti della sessione e del totale settimanale, calcolata dai dati gia presenti nella scheda (serie, recuperi e tempi medi di esecuzione/transizione).
- Sessione Google: controllo finale del flusso persistente; al ritorno in primo piano viene anche riallineato lo stato UI della sessione server senza modificare la politica di login/disconnessione.


## v0.48.6 - Gratitudine sync fix e stima allenamento
- Corretto falso errore dopo il salvataggio Gratitudine.
- Gratitudine sincronizzata come raccolta dedicata (`gratitude.json`) e inclusa nel conflict resolver/sync queue.
- Eliminazioni Gratitudine propagate tra dispositivi e aggiornate subito nella UI.
- Stima allenamento aumentata di 15 minuti per ogni sessione non vuota per preparazione attrezzi e transizioni.


## v0.49.0 - Database alimenti evoluto
- Nuovi campi alimento: Categoria, Unità e misura per unità.
- Categorie: Spuntino, Primo, Secondo, Contorno, Bevande, Altro.
- Unità: Piatto, Fetta/Pz, Bicchiere con conversione automatica g/ml.
- Aggiunta al pasto tramite quantità diretta oppure numero di unità.
- Pallino rosso per record legacy/incompleti; nessuna migrazione distruttiva.
- Filtri per categoria nel database e nella selezione alimento.
- Valori nutrizionali vuoti normalizzati a 0.
- Gratitudine: tombstone dedicati in gratitude_deleted.json per propagare le cancellazioni tra dispositivi.


## v0.50.2 - Dieta Reale / Pianificato
- La scheda Acqua e' stata portata sopra al selettore Reale/Pianificato.
- Reale mantiene il diario nutrizionale attuale.
- Pianificato introduce piani alimentari settimanali attivabili e modificabili dal gestore piani.
- Le modifiche quotidiane generano una copia per data e non alterano il piano ufficiale.
- Spuntando un alimento pianificato viene creato il corrispondente consumo in Reale; togliendo la spunta viene rimosso.
- Gli alimenti provenienti dal piano sono visualizzati con stile piu leggero e indicazione `dal piano`.
- Le Bevande usano ml in database, selezione, diario Reale, Pianificato e storico pasti.
- Piani, override giornalieri e completamenti entrano nello stato sincronizzato Drive.


## v0.50.2 - Piani alimentari 2
- Pulsante esplicito Rendi attivo / Piano attivo nella libreria piani.
- Hardening responsive del gestore piani e Pianificato per evitare overflow sul bordo destro.
- Eliminare dal Reale un alimento proveniente dal piano rimuove anche la spunta nel Pianificato.
- Gli alimenti completati vengono riallineati anche nelle copie giornaliere gia create e nei log Reale derivati dal piano.

## v0.50.2 - Piani alimentari 3
- Rimossi Compila piatti / Compila tutto: i piani usano esclusivamente alimenti gia presenti nel database.
- Editor piano spostato sopra ai piani salvati e reso a tutta larghezza.
- Selezione alimenti con ricerca testuale, filtro categoria, dettagli nutrizionali e quantita in g/ml prima dell'aggiunta.
- Piani salvati compattati su una sola riga: titolo, Rendi attivo/Attivo, Modifica, Elimina.
- Pianificato: grafico di completamento giornaliero, kcal per pasto e kcal totali del giorno.
- Le schede degli alimenti pianificati mostrano quantita, kcal e macro.
- Conservata la possibilita di aggiungere alimenti solo alla copia quotidiana senza modificare il piano ufficiale.


## v0.50.4 - Sync live Pianificato
- Nessuna modifica alla UI mobile.
- Il desktop accetta Drive come sorgente canonica per Pianificato quando non ha modifiche locali pendenti.
- Controllo leggero ogni 5 secondi di app_state.json per aggiornare piano attivo, override giornalieri e spunte completamento tra dispositivi.


## v0.50.4 - Aggiunta rapida Pianificato
- Rimossa la vecchia voce `Aggiungi solo a oggi` con menu a discesa.
- Ogni pasto del Pianificato usa ora lo stesso pulsante circolare `+` del Reale.
- Il pulsante apre esattamente lo stesso selettore alimenti del Reale: ricerca, filtri categoria, dettagli nutrizionali, grammi/ml e unita.
- Quando il selettore viene aperto dal Pianificato, l'alimento viene salvato esclusivamente nella copia giornaliera del piano e non modifica il piano ufficiale.
- La sincronizzazione live Pianificato introdotta in v0.50.3 resta invariata.


## v0.51.0 - Target Home + fix Idratazione
- La progressione giornaliera considera Idratazione completata solo al raggiungimento del 100% del target acqua impostato.
- Anche il riepilogo settimanale conta un giorno come idratato solo al 100% del target.
- Home mostra una nuova scheda compatta dei target nutrizionali del giorno: calorie, proteine, carboidrati e grassi.
- La scheda mostra avanzamento calorie, residuo rispetto al target o eventuale superamento.
- Nessuna modifica al flusso Dieta Reale/Pianificato o alla sincronizzazione v0.50.4.

## v0.52.0 - Wellness Score e progressi giornalieri
- Home mostra il nuovo Wellness Score con cinque aree e grafico radar.
- Cura di sé usa check-in + idratazione; Corpo usa il completamento allenamento; Mente usa la pausa mentale; Riposo usa sonno + recupero; Nutrizione usa calorie e macro rispetto ai target.
- Il punteggio non inventa dati mancanti.


## v0.54.0 - Home cleanup + tracker essenziali
- Rimossa la card "Target nutrizionali oggi" dalla Home.
- Rimosse le card secondarie "Meditazione" e "Trend" dalla Home.
- Spostata la card "Compagno di giornata" subito sotto "La tua giornata" e sopra il Wellness Score.
- Wellness Score e radar lasciati invariati nelle logiche di calcolo.
- La precedente area "Priorità di oggi" diventa "Tracker di oggi" con quattro tracker essenziali derivati dai dati esistenti: Alimentazione, Idratazione, Allenamento e Sonno.
- Nessun nuovo database o permesso richiesto; nessuna modifica a Reale/Pianificato, sync, login o offline.


## v0.54.0 - Progressione giornata, nuovo Check-in e Passi
- Home: Progressione giornata X/5 con Alimentazione, Idratazione, Sonno, Allenamento e Meditazione.
- Coppa visibile al completamento di tutte e 5 le aree.
- Check-in Home ridisegnato con grafico circolare a quattro settori per Sonno, Recupero, Umore e Stress.
- Allenamento: primo tracker giornaliero Passi sincronizzato via app_state, con valore manuale, +/-500 e target configurabile.
- La lettura automatica dai sensori non viene attivata in questa versione per preservare compatibilità e stabilità PWA/iOS/desktop.


## v0.55.0 - Desktop isolation fix
- Ripartenza dalla v0.54.0 stabile: il codice Passi mobile resta invariato.
- Desktop: recupero dedicato della sessione server Google su avvio, ritorno online e ritorno in primo piano.
- Desktop: se la verifica backend e temporaneamente indisponibile ma la sessione persistente locale e valida, Opzioni mostra lo stato di verifica attiva invece di bloccare il flusso.
- Desktop: i Passi vengono letti da app_state Drive nel refresh leggero, senza cambiare le funzioni di modifica/salvataggio del telefono.


## v0.55.0 - Consulto AI Allenamento unificato
- Nuovo flusso unico Allenamento AI: livello, luogo, giorni/settimana, minuti/sessione, obiettivo e prompt.
- Snapshot completo degli ultimi 30 giorni creato automaticamente e salvato in `workoutFrames`.
- Il quadro allenamento conserva preferenze + fotografia dati ed e sincronizzato nello stato principale.
- Il consulto AI non richiede piu una scheda allenamento preesistente.
- Dalla risposta si puo generare una scheda, scaricarla e importarla nelle Schede esistenti.
- Il vecchio flusso Consulto resta disponibile per Alimentazione/Completo mentre la parte workout passa al nuovo percorso.
- Nessuna modifica a sessione Google desktop, passi, telefono o sincronizzazione gia stabilizzata in v0.54.6.
