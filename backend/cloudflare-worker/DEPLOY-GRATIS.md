# Thalys backend gratuito - deploy controllato

Questa cartella prepara il backend **senza spostare foto o database Thalys da Google Drive**.
Le foto restano esclusivamente su Drive. Il Worker serve solo per sessione Google persistente, registry Push e future API sicure.

## Stato nella v0.44

L'app ha `backend.enabled=false` e `googleCodeFlowEnabled=false`. Quindi il deploy del Worker, da solo, **non cambia il login corrente**. L'attivazione si fa solo dopo i test `/health`.

## 1. Prerequisiti gratuiti

- account Cloudflare sul piano Free;
- Node.js installato sul PC;
- OAuth Web Client Google gia usato da Thalys;
- dominio HTTPS pubblico di Thalys (Vercel va bene).

## 2. Accedi a Cloudflare

```bash
npx wrangler@latest login
```

## 3. Crea D1

Dalla cartella `backend/cloudflare-worker`:

```bash
npx wrangler@latest d1 create thalys-free
```

Copia il `database_id` restituito dentro una copia di `wrangler.toml.example` chiamata `wrangler.toml`. Mantieni `binding = "DB"`.

## 4. Genera le chiavi LOCALMENTE

```bash
node tools/generate-keys.mjs
```

Non inviare a ChatGPT e non committare mai:
- `AUTH_ENCRYPTION_KEY`;
- `VAPID_PRIVATE_KEY`;
- Google Client Secret.

La `VAPID_PUBLIC_KEY` invece e pubblica.

## 5. Imposta le variabili pubbliche

In `wrangler.toml` inserisci:
- `ALLOWED_ORIGIN` = dominio reale Thalys, per esempio `https://...vercel.app`;
- `GOOGLE_CLIENT_ID`;
- `VAPID_PUBLIC_KEY`;
- ID del database D1.

## 6. Imposta i secret Cloudflare

```bash
npx wrangler@latest secret put GOOGLE_CLIENT_SECRET
npx wrangler@latest secret put AUTH_ENCRYPTION_KEY
npx wrangler@latest secret put VAPID_PRIVATE_KEY
```

Incolla i valori solo nel terminale Cloudflare.

## 7. Crea lo schema remoto

```bash
npx wrangler@latest d1 execute thalys-free --remote --file=./schema.sql
```

## 8. Controllo locale pacchetto

```bash
node tools/verify-package.mjs
```

## 9. Deploy

```bash
npx wrangler@latest deploy
```

Wrangler restituisce un URL `https://...workers.dev`.

## 10. Test PRIMA di collegare Thalys

Apri:

```text
https://TUO-WORKER.workers.dev/health
```

Deve contenere almeno:

```json
{
  "ok": true,
  "contractVersion": "1",
  "billingRequired": false,
  "photos": "google-drive-only"
}
```

Solo dopo questo test inseriremo l'URL e la `VAPID_PUBLIC_KEY` in `js/config.js` e abiliteremo prima il backend, poi il Code Flow Google.

## Regola di rollback

Se qualcosa non funziona, rimettere `backend.enabled=false` e `googleCodeFlowEnabled=false`: Thalys torna immediatamente al login/browser Drive attuale.
