# Thalys free backend scaffold

This folder is intentionally NOT enabled by default.

Purpose:
- health endpoint;
- store/remove Web Push subscriptions in Cloudflare D1 Free;
- later host Google refresh-token flow and secure API endpoints.

Non-goals:
- no progress photos here (photos remain Google Drive only);
- no Thalys app databases here (Drive + IndexedDB remain canonical);
- no automatic paid upgrade or paid fallback.

Free-first behavior:
- if a free-tier quota is reached, the feature should fail/stop until quota resets;
- Thalys must not automatically switch to a paid service.

The `/auth/google/refresh` endpoint deliberately returns 501 until Google login is migrated safely to authorization-code flow.
