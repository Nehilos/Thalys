CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  device_id TEXT,
  app_version TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_device ON push_subscriptions(device_id);

-- Google refresh tokens are NEVER sent back to the browser.
-- refresh_cipher/refresh_iv contain AES-GCM encrypted data; the encryption key lives only as a Worker secret.
CREATE TABLE IF NOT EXISTS google_sessions (
  session_id TEXT PRIMARY KEY,
  session_hash TEXT NOT NULL,
  refresh_cipher TEXT NOT NULL,
  refresh_iv TEXT NOT NULL,
  device_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_google_sessions_device ON google_sessions(device_id);
