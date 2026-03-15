import { serve } from '@hono/node-server';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import cron from 'node-cron';
import app from '@/app/index.js';
import * as schema from '@/shared/db/schema.js';
import { handleScheduledBackup } from '@/features/backup/backupRoutes.js';
import fs from 'fs';
import path from 'path';
import { migrateDatabase } from '@/shared/db/migrator.js';

// 1. Resolve paths
// In Docker, we run from /app, and frontend is at /app/frontend/dist
// The server.js is at /app/backend/dist/server.js
const baseDir = process.cwd(); // Should be /app in Docker
const frontendDistPath = path.resolve(baseDir, 'frontend/dist');
const dataDir = path.resolve(baseDir, 'data');

console.log(`[Docker Server] Base directory: ${baseDir}`);
console.log(`[Docker Server] Frontend dist path: ${frontendDistPath}`);

// 2. Ensure data directory exists and is writable
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

try {
    fs.accessSync(dataDir, fs.constants.W_OK);
} catch (err) {
    console.error(`\n❌ ERROR: Data directory "${dataDir}" is NOT writable!`);
    console.error(`   Please run on your host: sudo chown -R 1000:1000 ./data\n`);
    process.exit(1);
}

// 3. Initialize local SQLite Database
const dbFile = process.env.SQLITE_DB_PATH || path.join(dataDir, '2fauth.db');

// Check if database file is writable if it exists
if (fs.existsSync(dbFile)) {
    try {
        fs.accessSync(dbFile, fs.constants.W_OK);
    } catch (err) {
        console.error(`\n❌ ERROR: Database file "${dbFile}" is NOT writable!`);
        console.error(`   Please run on your host: sudo chown 1000:1000 ${dbFile}\n`);
        process.exit(1);
    }
}

let sqlite: Database.Database;
try {
    sqlite = new Database(dbFile);
} catch (err: any) {
    if (err.code === 'SQLITE_CANTOPEN') {
        console.error(`\n❌ ERROR: SQLite cannot open database file "${dbFile}".`);
        console.error(`   This is likely a permission issue on the mounted volume.`);
        console.error(`   Please run on your host: sudo chown -R 1000:1000 ./data\n`);
    } else {
        console.error(`\n❌ ERROR: Failed to open database:`, err.message);
    }
    process.exit(1);
}
sqlite.pragma('journal_mode = WAL');

// 4. Initialize Drizzle ORM
const db = drizzle(sqlite, { schema });

// 5. Run baseline schema initialization (ensures all tables exist)
const schemaFile = fs.existsSync(path.join(baseDir, 'schema.sql'))
    ? path.join(baseDir, 'schema.sql')
    : path.join(baseDir, 'backend/schema.sql');

if (fs.existsSync(schemaFile)) {
    const schemaSql = fs.readFileSync(schemaFile, 'utf-8');
    try {
        // execute baseline schema (contains CREATE TABLE IF NOT EXISTS)
        sqlite.exec(schemaSql);
    } catch (e: any) {
        console.warn('[Database] Baseline sync warning:', e.message);
    }
}

// 6. Apply sequence migrations (Elegant way)
const dbExecutor = {
    exec: (sql: string) => { sqlite.exec(sql); },
    prepare: (sql: string) => {
        const stmt = sqlite.prepare(sql);
        return {
            get: () => stmt.get(),
            run: (...params: any[]) => stmt.run(...params)
        };
    }
};

try {
    // await for async migration
    (async () => {
        try {
            await migrateDatabase(dbExecutor as any);
            console.log('[Database] Migrations verified/applied.');
        } catch (e: any) {
            console.error('[Database] Critical: Migration failed:', e.message);
            process.exit(1);
        }
    })();
} catch (e) {
    console.error('[Database] Unexpected error during migration boot.');
    process.exit(1);
}

// 7. Setup environment for Hono
const envTemplate = {
    DB: db,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || '',
    JWT_SECRET: process.env.JWT_SECRET || '',
    OAUTH_ALLOWED_USERS: process.env.OAUTH_ALLOWED_USERS || '',
    ...process.env
};

// 8. Define the ASSETS.fetch logic for Node.js
// This replaces Cloudflare's ASSETS.fetch
const nodeAssetsFetch = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    // Ensure we resolve the path relative to frontendDistPath and normalize it
    let filePath = path.resolve(frontendDistPath, url.pathname.slice(1));

    // Security: check that the file is actually inside frontendDistPath
    if (!filePath.startsWith(frontendDistPath)) {
        console.warn(`[Security] Blocked potential path traversal: ${url.pathname}`);
        return new Response('Forbidden', { status: 403 });
    }

    // SPA fallback: if it's a directory or file doesn't exist, serve index.html
    if (url.pathname === '/' || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(frontendDistPath, 'index.html');
    }

    if (!fs.existsSync(filePath)) {
        return new Response('Not Found', { status: 404 });
    }

    const content = fs.readFileSync(filePath);

    // Mime types
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.webmanifest': 'application/manifest+json',
        '.wasm': 'application/wasm'
    };

    return new Response(content, {
        headers: {
            'Content-Type': mimeTypes[ext] || 'application/octet-stream',
            'Cache-Control': 'public, max-age=3600'
        }
    });
};

// 8. Cron Triggers
cron.schedule('0 2 * * *', async () => {
    try {
        console.log('[Cron] Triggering daily backup...');
        await handleScheduledBackup(envTemplate as any);
    } catch (e) {
        console.error('[Cron] Backup failed:', e);
    }
});

// 9. Start Server
const port = parseInt(process.env.PORT || '3000', 10);
serve({
    fetch: (req) => {
        const env = {
            ...envTemplate,
            ASSETS: { fetch: nodeAssetsFetch }
        };
        return app.fetch(req, env as any, {
            waitUntil: (p: Promise<any>) => p.catch(console.error)
        } as any);
    },
    port
}, (info) => {
    console.log(`[Docker Server] 2FAuth is running on http://localhost:${info.port}`);
});
