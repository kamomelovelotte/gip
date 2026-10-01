// Idempotent schema initialization runs once per server process on first use.
export const schema=[
 'CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY NOT NULL,code TEXT NOT NULL UNIQUE,salt TEXT NOT NULL,password_hash TEXT NOT NULL,profile TEXT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY NOT NULL,user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,expires INTEGER NOT NULL)',
 'CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires)',
 'CREATE TABLE IF NOT EXISTS reviews(user_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,id TEXT NOT NULL,body TEXT NOT NULL,photo_key TEXT,PRIMARY KEY(user_id,id))',
 'CREATE TABLE IF NOT EXISTS photos(key TEXT PRIMARY KEY NOT NULL,data BLOB NOT NULL,content_type TEXT NOT NULL)',
 'CREATE TABLE IF NOT EXISTS auth_limits(key TEXT PRIMARY KEY NOT NULL,hits INTEGER NOT NULL,expires INTEGER NOT NULL)',
 'CREATE INDEX IF NOT EXISTS auth_limits_expiry ON auth_limits(expires)',
];
