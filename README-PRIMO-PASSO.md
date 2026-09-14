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
