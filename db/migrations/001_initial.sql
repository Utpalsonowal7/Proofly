CREATE TABLE users (
  id uuid PRIMARY KEY, name varchar(80) NOT NULL, email varchar(254) UNIQUE NOT NULL,
  password_hash text NOT NULL, current_workspace_id uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE workspaces (id uuid PRIMARY KEY, name varchar(80) NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE users ADD CONSTRAINT users_workspace_fk FOREIGN KEY (current_workspace_id) REFERENCES workspaces(id);
CREATE TABLE memberships (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner','editor','viewer')),
  PRIMARY KEY (workspace_id, user_id)
);
CREATE INDEX memberships_user_idx ON memberships(user_id);
CREATE TABLE sessions (
  token_hash char(64) PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);
CREATE TABLE projects (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL, client varchar(100) NOT NULL DEFAULT '', description varchar(1000) NOT NULL DEFAULT '',
  color char(7) NOT NULL DEFAULT '#b8c6aa', due_date date, archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX projects_workspace_idx ON projects(workspace_id, created_at DESC);
CREATE TABLE assets (
  id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name varchar(200) NOT NULL, current_version_id uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX assets_project_idx ON assets(project_id);
CREATE TABLE asset_versions (
  id uuid PRIMARY KEY, asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  version_number int NOT NULL CHECK (version_number > 0), storage_key text UNIQUE NOT NULL,
  upload_key text UNIQUE NOT NULL, content_type text NOT NULL CHECK (content_type IN ('image/png','image/jpeg','image/webp')),
  byte_size int NOT NULL CHECK (byte_size BETWEEN 1 AND 20971520),
  width int NOT NULL CHECK (width BETWEEN 1 AND 20000), height int NOT NULL CHECK (height BETWEEN 1 AND 20000),
  state text NOT NULL DEFAULT 'uploading' CHECK (state IN ('uploading','ready')),
  decision text NOT NULL DEFAULT 'in_review' CHECK (decision IN ('in_review','approved','changes_requested')),
  created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(asset_id, version_number), UNIQUE(id, asset_id)
);
ALTER TABLE assets ADD CONSTRAINT current_version_fk FOREIGN KEY (current_version_id, id) REFERENCES asset_versions(id, asset_id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX versions_asset_idx ON asset_versions(asset_id, version_number DESC);
CREATE TABLE comments (
  id uuid PRIMARY KEY, version_id uuid NOT NULL REFERENCES asset_versions(id) ON DELETE CASCADE,
  author_id uuid REFERENCES users(id) ON DELETE SET NULL, author_name varchar(80) NOT NULL,
  body varchar(4000) NOT NULL CHECK (length(trim(body)) > 0),
  x double precision CHECK (x BETWEEN 0 AND 1), y double precision CHECK (y BETWEEN 0 AND 1),
  parent_id uuid, resolved boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((x IS NULL) = (y IS NULL)), CHECK (parent_id IS NULL OR x IS NULL), UNIQUE (id, version_id),
  FOREIGN KEY (parent_id, version_id) REFERENCES comments(id, version_id) ON DELETE CASCADE
);
CREATE INDEX comments_version_idx ON comments(version_id, created_at);
CREATE TABLE review_links (
  id uuid PRIMARY KEY, project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  token_hash char(64) UNIQUE NOT NULL, allow_comments boolean NOT NULL DEFAULT true,
  revoked boolean NOT NULL DEFAULT false, expires_at timestamptz NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX links_project_idx ON review_links(project_id);
CREATE TABLE invitations (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  token_hash char(64) UNIQUE NOT NULL, role text NOT NULL CHECK (role IN ('editor','viewer')),
  expires_at timestamptz NOT NULL, used_at timestamptz, created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE events (
  id uuid PRIMARY KEY, workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title text NOT NULL, detail text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX events_workspace_idx ON events(workspace_id, created_at DESC);
CREATE TABLE rate_limits (key char(64) PRIMARY KEY, hits int NOT NULL, resets_at timestamptz NOT NULL);
CREATE INDEX rate_limits_expiry_idx ON rate_limits(resets_at);
