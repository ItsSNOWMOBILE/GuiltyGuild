import sqlite3 from 'sqlite3';
import path from 'path';

// DB_PATH env var overrides; otherwise use the backend root (one level above dist/).
const dbPath = process.env.DB_PATH
    ?? path.resolve(__dirname, __dirname.endsWith('dist') ? '..' : '.', 'kv_store.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Failed to open database:', err.message);
        process.exit(1);
    }
});

// Initialise schema inside serialize() so all statements queue in order.
// The promise resolves once the schema is fully up-to-date.
const _ready = new Promise<void>((resolve, reject) => {
    db.serialize(() => {
        db.run("PRAGMA journal_mode = WAL");
        db.run("PRAGMA synchronous = NORMAL");
        // Create table (old installations won't have updated_at)
        db.run(`
            CREATE TABLE IF NOT EXISTS kv_store (
                key        TEXT    PRIMARY KEY,
                value      TEXT    NOT NULL,
                updated_at INTEGER DEFAULT 0
            )
        `);
        // Migration: add updated_at if this is an old DB that lacks it.
        // Use a constant default (0) for maximum SQLite version compatibility.
        db.run(`ALTER TABLE kv_store ADD COLUMN updated_at INTEGER DEFAULT 0`,
            () => { /* ignore error if column already exists */ });
        // Dummy read to confirm DB is responsive after all queued writes
        db.get("SELECT 1", (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
});

// Hard-fail on init error so we don't serve requests against a broken DB.
_ready.catch((err) => {
    console.error('Database initialisation failed:', err);
    process.exit(1);
});

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

function dbGet(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) =>
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row ?? null)))
    );
}

function dbRun(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) =>
        db.run(sql, params, function (err) {
            err ? reject(err) : resolve();
        })
    );
}

function dbAll(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) =>
        db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows ?? [])))
    );
}

// Escape LIKE wildcards inside a prefix so it is safe to pass to SQLite LIKE.
function escapeLike(s: string): string {
    return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function set(key: string, value: any): Promise<void> {
    await _ready;
    const ts = Math.floor(Date.now() / 1000);
    await dbRun(
        `INSERT INTO kv_store (key, value, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value,
                                        updated_at = excluded.updated_at`,
        [key, JSON.stringify(value), ts]
    );
}

export async function get(key: string): Promise<any> {
    await _ready;
    const row = await dbGet(`SELECT value FROM kv_store WHERE key = ?`, [key]);
    return row ? JSON.parse(row.value) : null;
}

export async function del(key: string): Promise<void> {
    await _ready;
    await dbRun(`DELETE FROM kv_store WHERE key = ?`, [key]);
}

/**
 * Return all values whose key starts with `prefix`.
 * Results are ordered newest-first (by updated_at).
 */
export async function getByPrefix(prefix: string): Promise<any[]> {
    await _ready;
    const rows = await dbAll(
        `SELECT value FROM kv_store
          WHERE key LIKE ? ESCAPE '\\'
          ORDER BY updated_at DESC`,
        [escapeLike(prefix) + '%']
    );
    return rows.map((row) => JSON.parse(row.value));
}

/**
 * Delete all keys that start with `prefix`.
 */
export async function deleteByPrefix(prefix: string): Promise<void> {
    await _ready;
    await dbRun(
        `DELETE FROM kv_store WHERE key LIKE ? ESCAPE '\\'`,
        [escapeLike(prefix) + '%']
    );
}

/**
 * Efficiently find a session whose stored `userId` field matches.
 * Avoids loading all sessions per-player (was O(n²) before).
 */
export async function getSessionByUserId(userId: string): Promise<any> {
    await _ready;
    const rows = await dbAll(
        `SELECT value FROM kv_store WHERE key LIKE 'session:%' ESCAPE '\\'`,
        []
    );
    for (const row of rows) {
        const session = JSON.parse(row.value);
        if (session.userId === userId) return session;
    }
    return null;
}
