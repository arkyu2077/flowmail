PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  normalized_email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT,
  google_sub TEXT UNIQUE,
  avatar_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_user_id TEXT NOT NULL,
  selected_case_pack_id TEXT NOT NULL DEFAULT 'external_trade_order',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (owner_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS workspace_memberships (
  workspace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (workspace_id, user_id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  last_used_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS workspace_access_tokens (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  token_preview TEXT NOT NULL,
  scopes_json TEXT NOT NULL DEFAULT '["engine"]',
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS oauth_states (
  id TEXT PRIMARY KEY,
  purpose TEXT NOT NULL,
  provider TEXT NOT NULL,
  workspace_id TEXT,
  user_id TEXT,
  connection_id TEXT,
  return_url TEXT,
  pkce_verifier TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mailbox_connections (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  email_address TEXT,
  scopes_json TEXT NOT NULL,
  access_token_ciphertext TEXT,
  refresh_token_ciphertext TEXT,
  token_type TEXT,
  token_scope TEXT,
  token_expires_at TEXT,
  auth_session_id TEXT,
  connected_at TEXT,
  last_synced_at TEXT,
  synced_case_count INTEGER NOT NULL DEFAULT 0,
  synced_thread_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mail_threads (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  connection_id TEXT NOT NULL,
  provider_thread_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  normalized_subject TEXT,
  participants_json TEXT NOT NULL,
  first_message_at TEXT,
  last_message_at TEXT NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  attachment_count INTEGER NOT NULL DEFAULT 0,
  snippet TEXT,
  qualification_rule TEXT,
  qualification_score INTEGER NOT NULL DEFAULT 0,
  matched_keywords_json TEXT NOT NULL DEFAULT '[]',
  matched_doc_types_json TEXT NOT NULL DEFAULT '[]',
  raw_thread_r2_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (connection_id, provider_thread_id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (connection_id) REFERENCES mailbox_connections(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mail_messages (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  provider_message_id TEXT NOT NULL,
  sender_email TEXT,
  sender_name TEXT,
  to_json TEXT NOT NULL DEFAULT '[]',
  cc_json TEXT NOT NULL DEFAULT '[]',
  bcc_json TEXT NOT NULL DEFAULT '[]',
  sent_at TEXT NOT NULL,
  subject TEXT,
  snippet TEXT,
  body_text_excerpt TEXT,
  body_r2_key TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (thread_id, provider_message_id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (thread_id) REFERENCES mail_threads(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mail_attachments (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  provider_attachment_id TEXT,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  r2_object_key TEXT NOT NULL,
  extracted_text_r2_key TEXT,
  text_excerpt TEXT,
  doc_type TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (message_id) REFERENCES mail_messages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  case_pack_id TEXT NOT NULL,
  source_thread_id TEXT,
  status TEXT NOT NULL,
  label TEXT NOT NULL,
  account TEXT,
  region TEXT,
  owner_user_id TEXT,
  latest_subject TEXT,
  latest_message_at TEXT NOT NULL,
  next_action_json TEXT NOT NULL DEFAULT '[]',
  missing_data_json TEXT NOT NULL DEFAULT '[]',
  matched_keywords_json TEXT NOT NULL DEFAULT '[]',
  matched_doc_types_json TEXT NOT NULL DEFAULT '[]',
  qualification_rule TEXT,
  qualification_score INTEGER NOT NULL DEFAULT 0,
  summary_text TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (source_thread_id) REFERENCES mail_threads(id) ON DELETE SET NULL,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS case_events (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  case_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (case_id) REFERENCES cases(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS export_targets (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  auth_mode TEXT NOT NULL,
  display_name TEXT,
  destination_ref_json TEXT NOT NULL DEFAULT '{}',
  credential_ciphertext TEXT,
  configured_at TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE (workspace_id, provider),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sync_jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  connection_id TEXT,
  queue_name TEXT NOT NULL,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL,
  cursor_json TEXT NOT NULL DEFAULT '{}',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (connection_id) REFERENCES mailbox_connections(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workspace_memberships_user
  ON workspace_memberships(user_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user
  ON user_sessions(user_id, revoked_at, expires_at);

CREATE INDEX IF NOT EXISTS idx_workspace_access_tokens_workspace
  ON workspace_access_tokens(workspace_id, revoked_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_oauth_states_lookup
  ON oauth_states(provider, purpose, expires_at);

CREATE INDEX IF NOT EXISTS idx_mailbox_connections_workspace
  ON mailbox_connections(workspace_id, provider, status);

CREATE INDEX IF NOT EXISTS idx_mail_threads_workspace_recent
  ON mail_threads(workspace_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_mail_messages_thread_sent
  ON mail_messages(thread_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_mail_attachments_message
  ON mail_attachments(message_id);

CREATE INDEX IF NOT EXISTS idx_cases_workspace_pack_status
  ON cases(workspace_id, case_pack_id, status, latest_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_case_events_case
  ON case_events(case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sync_jobs_workspace_status
  ON sync_jobs(workspace_id, status, created_at DESC);
