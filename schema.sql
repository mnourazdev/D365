-- Schema for the feedback database (Cloudflare D1)
-- Apply with:
--   npx wrangler d1 execute items-feedback --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS feedback (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at  TEXT    NOT NULL,
  name        TEXT,
  email       TEXT,
  type        TEXT    NOT NULL DEFAULT 'أخرى',
  message     TEXT    NOT NULL,
  ip          TEXT,
  country     TEXT,
  user_agent  TEXT,
  status      TEXT    NOT NULL DEFAULT 'new'
);

CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_status     ON feedback (status);
CREATE INDEX IF NOT EXISTS idx_feedback_ip_time    ON feedback (ip, created_at);
