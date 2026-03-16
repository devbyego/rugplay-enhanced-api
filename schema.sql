CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    reported_username TEXT NOT NULL,
    coin_symbol TEXT NOT NULL,
    description TEXT NOT NULL,
    evidence TEXT DEFAULT '',
    submitter_ip_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    upvotes INTEGER NOT NULL DEFAULT 0,
    downvotes INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_username ON reports(reported_username);
CREATE INDEX IF NOT EXISTS idx_reports_symbol ON reports(coin_symbol);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at DESC);

CREATE TABLE IF NOT EXISTS user_tags (
    username TEXT PRIMARY KEY,
    tag TEXT NOT NULL,
    label TEXT NOT NULL,
    color_bg TEXT NOT NULL DEFAULT '#6366f1',
    color_text TEXT NOT NULL DEFAULT '#ffffff',
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tags_tag ON user_tags(tag);

CREATE TABLE IF NOT EXISTS changelogs (
    version TEXT PRIMARY KEY,
    changes_json TEXT NOT NULL,
    released_at TEXT NOT NULL
);
