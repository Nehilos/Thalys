# Thalys free backend - v0.43

This Worker is optional and **disabled by default** in Thalys.

It is intentionally small and free-first. It handles only:
- health checks;
- Web Push subscription registry;
- optional Google Authorization Code exchange + refresh-token sessions.

It does **not** store:
- progress photos (Google Drive only);
- Thalys application databases (Google Drive + IndexedDB stay canonical);
- AI prompts/history.

## Security model
- Google refresh tokens never go back to the browser.
- Refresh tokens are AES-GCM encrypted before being stored in D1.
- `AUTH_ENCRYPTION_KEY` and `GOOGLE_CLIENT_SECRET` are Worker secrets.
- Each browser/device has a random session id + random session secret; only a hash of the session secret is stored in D1.
- Production server auth requires an exact `ALLOWED_ORIGIN`; `*` is rejected for server-auth endpoints.

## Free-first setup
1. Create a Cloudflare Worker on the Free plan.
2. Create a D1 database and bind it as `DB`.
3. Apply `schema.sql`.
4. Copy `wrangler.toml.example` to your real Wrangler config and insert your D1 database id.
5. Set `ALLOWED_ORIGIN` to the exact Vercel/custom-domain origin of Thalys.
6. Set `GOOGLE_CLIENT_ID` to the same Google Web OAuth client used by Thalys.
7. Add secrets (never commit them):
   - `GOOGLE_CLIENT_SECRET`
   - `AUTH_ENCRYPTION_KEY` (random 32 bytes, base64/base64url)
8. Deploy the Worker.
9. Only after `/health` reports `googleServerAuthReady: true`, put the Worker URL in `js/config.js`, set `backend.enabled=true`, and set `googleCodeFlowEnabled=true`.

Until step 9, Thalys keeps using the existing stable browser OAuth flow.

## Google consent note
The first successful Authorization Code exchange must return a refresh token. If the Google account already granted the scopes using the old token flow, Google may require a fresh consent/reauthorization before issuing a new refresh token.
