# Thalys v0.39.0 — Device Media & Permissions

Questa release prosegue il punto 13 della roadmap in modo controllato.

## Novita principali
- nuovo `js/device-media.js`: gestione centralizzata di fotocamera, microfono e dettatura;
- scanner barcode collegato al gestore camera centralizzato;
- dettatura vocale nei campi Gratitudine, Note benessere e Richiesta specifica del Consulto AI;
- nuova sezione Opzioni > Permessi dispositivo con stato Camera/Microfono/Dettatura/Push;
- nessun permesso viene richiesto automaticamente all'avvio;
- i permessi Camera/Microfono vengono chiesti solo in seguito ad una azione esplicita dell'utente;
- Push resta solo rilevato, non viene ancora attivato in questa versione.

## Test consigliati
1. accesso e sync come v0.38;
2. Opzioni > Permessi dispositivo > Verifica camera/microfono;
3. dettatura su Gratitudine e Note benessere;
4. scanner barcode camera;
5. foto progresso e profilo;
6. offline -> online con sync automatico;
7. PC e iPhone/PWA.

## v0.41.0 - Notification foundation
- Permissione notifiche richiesta solo dopo azione utente.
- Notifica locale di test tramite Service Worker.
- Service Worker pronto a ricevere eventi Push e gestire il click sulla notifica.
- Push remoto non viene simulato: richiede endpoint backend + VAPID/subscription e verra collegato nella fase backend della roadmap.
- Sync Queue usa ora la versione centralizzata ThalysConfig invece del vecchio valore legacy 0.36.4.


## v0.41.0
Client Push completato con backend bridge neutro. Il backend resta disabilitato finche non vengono configurati baseUrl e VAPID public key in js/config.js. Nessuna chiamata esterna viene effettuata nello stato predefinito.
