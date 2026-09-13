# Thalys v0.27

Questa versione aggiunge:
- ripristino automatico della connessione Google Drive dopo l'accesso/reapertura quando il token e ancora valido;
- tentativo automatico di riconnessione e caricamento dei database quando torna la rete;
- stato connessione distinto tra online, riconnessione in corso e offline;
- uso completo dei database locali per le funzioni dell'app durante l'assenza di rete;
- sincronizzazione delle modifiche locali con Drive al ritorno online;
- cache PWA/offline aggiornata e pulizia delle vecchie cache manuali.

# Thalys — v0.15: preparazione offline visibile

Questa versione mantiene struttura HTML, login, Google Drive e funzioni nello stesso ordine della versione verificata dopo la separazione del CSS.

## Modifiche già eseguite

- Gli stili prima incorporati in `index.html` sono ora nel file `css/thalys.css`.
- `index.html` carica il nuovo foglio di stile con `<link rel="stylesheet" href="./css/thalys.css">`.
- Quattro blocchi JavaScript autonomi sono ora nella cartella `js`:
  - `tailwind-config.js`: configurazione dei colori e del tema Tailwind;
  - `theme-bootstrap.js`: applica subito il tema salvato evitando il lampeggio iniziale;
  - `ui-foundation.js`: gestisce viewport mobile e funzioni UI di base;
  - `pwa-register.js`: registra il service worker già previsto dall'app.
- La parte Google è stata estratta dal file HTML e divisa in:
  - `auth.js`: login Google, OAuth, token, sessione, ripristino automatico e logout;
  - `drive.js`: cartelle, database JSON, sincronizzazione, backup, importazione e cestino di Google Drive.
- Il nuovo `media-tools.js` contiene il blocco dedicato a:
  - caricamento e gestione delle foto progresso;
  - apertura e chiusura della fotocamera;
  - scansione dei codici a barre;
  - ricerca dei prodotti alimentari scansionati;
  - riconoscimento nutrizionale da immagine e salvataggio della proposta.
- Il nuovo `app-core.js` contiene il nucleo applicativo precedentemente incorporato nell'HTML, tra cui:
  - struttura iniziale di `appState` e valori predefiniti;
  - salvataggio locale e compatibilità dei dati;
  - funzioni condivise di rendering e navigazione;
  - logica principale di Home, allenamenti, nutrizione, corpo, benessere e meditazione;
  - gestione delle lingue e dei consulti AI collegata allo stato dell'app.
- `app-core.js` viene caricato nello stesso punto occupato dal blocco originale, senza trasformarlo in modulo ES e senza cambiare la visibilità delle funzioni usate dall'HTML.
- Il nuovo `app-enhancements.js` contiene l'ultimo grande blocco di evoluzioni dell'app, inclusi aggiornamenti successivi a stato, Drive, foto, profilo, avatar, target nutrizionali, grafici e interfaccia.
- Il nuovo `oauth-ui.js` contiene esclusivamente l'apertura e la chiusura dell'avviso relativo a eventuali blocchi OAuth.
- `index.html` non contiene più logica JavaScript incorporata: conserva i collegamenti agli script esterni nello stesso ordine della versione originale.
- I cinque dizionari sono ora raccolti nella cartella `lang`:
  - `lang/lang_it.json`;
  - `lang/lang_en.json`;
  - `lang/lang_es.json`;
  - `lang/lang_pt.json`;
  - `lang/lang_ro.json`.
- È stato aggiornato soltanto il percorso di caricamento dei dizionari distribuiti con il sito.
- I nomi dei dizionari sincronizzati nel database di Google Drive restano invariati, così i dati già presenti continuano a essere riconosciuti.
- La divisione interna sperimentale tra `app-state.js`, `i18n.js` e `app-core.js` è stata annullata dopo aver rilevato una regressione nel cambio lingua.
- Il motore delle lingue è nuovamente dentro `app-core.js`, nella stessa configurazione funzionante della versione precedente.
- I dizionari restano correttamente organizzati nella cartella `lang`.
- Al collegamento di `app-core.js` è stato aggiunto un identificatore di versione per evitare che il browser riutilizzi una copia precedente dalla cache.
- La divisione sperimentale tra `app-base.js`, `workout.js` e `app-core.js` è stata annullata dopo la regressione nel caricamento dei database.
- `app-core.js` è stato ripristinato byte per byte dalla versione `v0.9.1`, che caricava correttamente database e lingue.
- Tutti gli asset CSS e JavaScript usano il nuovo identificatore `v=0101` per impedire il riutilizzo della versione problematica dalla cache.
- I file `app-base.js` e `workout.js` non devono più essere presenti nel repository.
- Il nuovo `manifest.json` definisce nome, colori, avvio standalone e icona installabile di Thalys.
- Il nuovo `sw.js` memorizza l'involucro essenziale dell'app e i dizionari per consentire l'apertura senza connessione.
- Il service worker usa la rete come prima scelta: quando sei online scarica la versione aggiornata e aggiorna la cache; la copia locale viene usata soltanto se la rete non è disponibile.
- Le richieste verso `/api/` non vengono mai memorizzate, quindi risposte AI e operazioni server non vengono confuse con contenuti offline.
- La registrazione del service worker verifica immediatamente la presenza di aggiornamenti e non usa la cache HTTP per controllare `sw.js`.
- La nuova icona `assets/icons/thalys-app-icon-black.png` è opaca, misura 1024×1024 px e usa uno sfondo nero pieno, così il simbolo bianco resta leggibile sulla Home.
- In modalità installata su iPhone viene riservata una fascia superiore di almeno 47 px per orologio, Dynamic Island, Wi-Fi e batteria; la fascia usa il colore dell'header e i contenuti iniziano sotto di essa.
- La cache offline include ora Tailwind CSS e le altre librerie grafiche esterne necessarie: senza Tailwind l'HTML perdeva allineamenti, griglie e spaziature.
- Il colore di sfondo dichiarato per installazione e schermata di avvio è nero.
- Quando non c'è connessione, il pulsante iniziale diventa `Continua offline` e apre l'app con i dati già salvati nel dispositivo.
- Google Login, Google Drive, AI e le ricerche online richiedono comunque Internet; al ritorno della connessione puoi riconnettere Drive dalle impostazioni cloud.
- Dopo un accesso riuscito, aggiornare la pagina non riporta più alla schermata iniziale: la sessione locale resta attiva fino a `Disconnetti`.
- Dopo un aggiornamento Thalys resta aperta con i dati locali; il token Drive non viene conservato come password permanente e, quando necessario, l'app richiede soltanto di riconnettere Drive.
- `Disconnetti` revoca Google, cancella la sessione locale e riporta alla schermata iniziale.
- Al primo ingresso compare `Prepara modalità offline`: crea un database IndexedDB privato con i file operativi di allenamenti, nutrizione, corpo, acqua, benessere, meditazione, messaggi e impostazioni.
- Foto, backup, esportazioni e consulti archiviati non vengono duplicati nel database offline.
- Quando la rete ritorna compare `Rete disponibile`; il comando `Riconnetti e aggiorna` sincronizza Drive e ridisegna tutte le pagine.
- Le notifiche nell'app installata sono posizionate sotto la safe area di iPhone e della Dynamic Island.
- La preparazione offline usa ora il nome `Thalys App` per il database locale privato della PWA.
- Una barra mostra percentuale, nome del file corrente e avanzamento della copia.
- La finestra resta visibile al termine e conferma il numero di file copiati; si chiude soltanto premendo `Continua in Thalys`.
- La copia aspetta che `appState` sia realmente disponibile, evitando di inizializzare l'archivio con dati vuoti.

## Test PWA dopo il deploy

1. Apri Thalys online e attendi qualche secondo.
2. Ricarica la pagina una volta per permettere al nuovo service worker di assumere il controllo.
3. Usa `Aggiungi alla schermata Home` su iPhone oppure `Installa app` su Chrome/Android.
4. Avvia Thalys dall'icona e verifica che si apra senza barra del browser.
5. Dopo un primo avvio online, disattiva temporaneamente la connessione e verifica che l'involucro dell'app e i dizionari si aprano.
6. Offline premi `Continua offline` e verifica che si apra l'app; riattiva la connessione prima di provare login, sincronizzazione Drive, AI o ricerche alimentari online.
7. Su iPhone, dopo l'aggiornamento elimina la vecchia icona dalla Home e aggiungi nuovamente Thalys: iOS tende a conservare a lungo l'icona precedente.
- I nuovi file vengono caricati nello stesso punto e nello stesso ordine dei blocchi originali.
- Non sono stati rinominati o spostati logo, avatar, file MP3 o file lingua, perché tali asset non erano inclusi nello ZIP ricevuto.
- I blocchi più grandi relativi allo stato dell'app e alle singole sezioni non sono ancora stati spostati: verranno affrontati gradualmente dopo il test di questa versione.

## Come provarla sul computer

1. Estrai tutto lo ZIP in una cartella, senza spostare singoli file.
2. Apri un terminale dentro la cartella estratta.
3. Avvia un piccolo server locale con `python -m http.server 8000`.
4. Apri `http://localhost:8000` nel browser.
5. Controlla soprattutto modalità chiara/scura, Home, Dieta, Palestra, Corpo e Meditazione.

Il server locale è preferibile al doppio clic su `index.html`, perché login, richieste `fetch` e service worker richiedono un vero indirizzo web.

## Come pubblicarla

1. Conserva una copia o una versione GitHub dell'attuale progetto funzionante.
2. Copia nella cartella del repository il nuovo `index.html` e le cartelle `css` e `js`.
3. Lascia invariati tutti gli altri file già presenti su GitHub, compresi logo, avatar e MP3.
4. Carica entrambe le modifiche su GitHub nello stesso aggiornamento.
5. Attendi il deploy automatico di Vercel.
6. Apri il sito e ripeti i controlli indicati sotto.

## Collaudo rapido dopo il deploy

- La schermata iniziale e il logo si vedono correttamente.
- Il passaggio light/dark mantiene colori e impaginazione.
- I pulsanti e i menu rispondono.
- Il login Google funziona.
- Dopo il login, compare lo stato `Drive pronto` o `Sincronizzato`.
- I dati Drive vengono caricati e salvati.
- Il pulsante di sincronizzazione manuale completa l'operazione senza errori.
- I grafici di Dieta e Corpo sono visibili.
- Una meditazione audio parte correttamente.
- La fotocamera e lo scanner si aprono e si chiudono correttamente.
- La ricerca manuale di un codice a barre restituisce il prodotto o un messaggio comprensibile.
- Inserimento e modifica di acqua, alimento, allenamento e misurazione corpo continuano a funzionare.
- Il cambio lingua aggiorna correttamente le schermate.
- Dopo un nuovo deploy, prova almeno italiano, inglese e una terza lingua per verificare il caricamento dalla nuova cartella.
- Le sessioni di meditazione e i relativi progressi vengono registrati.
- Il calcolatore dei target nutrizionali si apre, calcola e salva correttamente.
- Avatar, foto profilo e foto progresso vengono visualizzati correttamente dopo un nuovo caricamento.
- Da smartphone non compaiono elementi fuori schermo.

Se uno di questi controlli fallisce, torna alla versione GitHub precedente e annota la schermata e l'azione che hanno prodotto il problema.


## v0.24 - CSS separato
- Basata sulla v0.23 stabile.
- Nessun cambiamento funzionale intenzionale.
- Confermato `css/thalys.css` come foglio di stile principale.
- Spostati fuori da `index.html` gli stili statici residui per viewport, modali e controlli.
- Gli `style="width:0%"` dei progress bar restano intenzionalmente inline: sono stato iniziale che il JavaScript aggiorna a runtime.
- Aggiornate le cache PWA alla v0.24.


## v0.25 - Google Drive separato

- Centralizzato in `js/drive.js` l'accesso diretto alle API Google Drive.
- Spostata in `drive.js` la preparazione/riparazione della struttura `Thalys App/database`.
- Spostata in `drive.js` la sincronizzazione dei pacchetti lingua con Drive.
- Foto e strumenti media non eseguono piu chiamate dirette alle API Drive: usano helper centralizzati.
- Nessuna modifica intenzionale a login, dati, sincronizzazione offline/online o interfaccia.
- Cache PWA aggiornata alla v0.25.


## v0.26 - Autenticazione separata

- Creato `js/auth.js` come unico modulo responsabile di login Google, OAuth, token, sessione ricordata, schermata di accesso e ripristino automatico all'avvio.
- Rimossa la vecchia dipendenza `js/google-auth.js`.
- La logica Google che era ancora dentro `ui-foundation.js` è stata estratta in `auth.js`.
- `drive.js` possiede ora lo stato di sincronizzazione Drive e gli indicatori Drive; Auth e Drive restano separati ma collaborano durante il bootstrap.
- Nessuna modifica intenzionale al comportamento utente di login, offline, riconnessione o sincronizzazione.
- Cache PWA aggiornata alla v0.26.


## v0.27 - Meditazione separata

- Estratta la logica Meditazione da `js/app-core.js` in `js/meditation.js`.
- Il nuovo modulo gestisce timer meditazione, respirazione, mindfulness, body scan, diario gratitudine e suoni ambiente.
- Nessun cambiamento intenzionale a UI, dati, login, Drive, sincronizzazione o comportamento offline.
- Aggiornata la cache PWA/manuale alla v0.27 e aggiunto `meditation.js` all'app shell offline.
