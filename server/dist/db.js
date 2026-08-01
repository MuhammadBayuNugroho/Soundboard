"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
exports.initDb = initDb;
exports.addLog = addLog;
const sqlite3_1 = __importDefault(require("sqlite3"));
const sqlite_1 = require("sqlite");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const dbPath = path_1.default.resolve(__dirname, '../database.sqlite');
let dbConnection = null;
async function getDb() {
    if (dbConnection) {
        return dbConnection;
    }
    // Ensure database directory exists
    const dir = path_1.default.dirname(dbPath);
    if (!fs_1.default.existsSync(dir)) {
        fs_1.default.mkdirSync(dir, { recursive: true });
    }
    dbConnection = await (0, sqlite_1.open)({
        filename: dbPath,
        driver: sqlite3_1.default.Database
    });
    // Enable foreign keys
    await dbConnection.run('PRAGMA foreign_keys = ON');
    return dbConnection;
}
async function initDb() {
    const db = await getDb();
    // Create Users table
    await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY,
      password TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
    // Create Audio table
    await db.exec(`
    CREATE TABLE IF NOT EXISTS audio (
      id TEXT PRIMARY KEY,
      drive_id TEXT UNIQUE,
      nama TEXT NOT NULL,
      kategori TEXT NOT NULL,
      local_path TEXT NOT NULL,
      volume REAL DEFAULT 1.0,
      fade INTEGER DEFAULT 1,
      favorite INTEGER DEFAULT 0,
      shortcut TEXT,
      checksum TEXT,
      modified_time TEXT,
      duration REAL DEFAULT 0.0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
    // Create Settings table
    await db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
    // Create Logs table
    await db.exec(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      action TEXT NOT NULL,
      details TEXT
    )
  `);
    // Seed default admin user if none exists
    const user = await db.get('SELECT * FROM users WHERE username = ?', ['admin']);
    if (!user) {
        const hashedPassword = await bcryptjs_1.default.hash('admin123', 10);
        await db.run('INSERT INTO users (username, password) VALUES (?, ?)', ['admin', hashedPassword]);
        console.log('Seeded default admin user (admin/admin123)');
    }
    // Seed default settings
    const defaultSettings = [
        { key: 'nama_acara', value: 'STAGE AUDIO CONTROL PANEL' },
        { key: 'logo', value: '' },
        { key: 'volume_default', value: '1.0' },
        { key: 'output_audio', value: 'Default Output' },
        { key: 'gdrive_folder_id', value: '' },
        { key: 'auto_sync', value: '0' },
        { key: 'dark_mode', value: '1' }
    ];
    for (const setting of defaultSettings) {
        const existing = await db.get('SELECT * FROM settings WHERE key = ?', [setting.key]);
        if (!existing) {
            await db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [setting.key, setting.value]);
        }
    }
    console.log('Database initialized successfully.');
}
// Log helper
async function addLog(action, details) {
    try {
        const db = await getDb();
        const timestamp = new Date().toISOString();
        await db.run('INSERT INTO logs (timestamp, action, details) VALUES (?, ?, ?)', [
            timestamp,
            action,
            details || null
        ]);
    }
    catch (err) {
        console.error('Failed to write log:', err);
    }
}
