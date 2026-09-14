Thalys v0.37.1 - Profile & reconnect stabilization

- Custom Thalys profile photo has priority over Google photo.
- Repairs full custom photo from IndexedDB local profile_photo.json after v0.37 migration.
- If a custom photo is temporarily unavailable, Google photo is not substituted.
- Added "Nome usato da Thalys" in Profilo & BMR; used by avatar phrases/personalization.
- Offline -> online reconnect first restores cached Drive token, then renews authorization if needed.
- male.svg and female.svg are intentionally not included; keep the correct repository assets.
