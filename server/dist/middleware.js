"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getJwtSecret = getJwtSecret;
exports.authenticateToken = authenticateToken;
exports.errorHandler = errorHandler;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const db_js_1 = require("./db.js");
const JWT_SECRET_DEFAULT = 'sacp-super-secret-key-123';
async function getJwtSecret() {
    try {
        const db = await (0, db_js_1.getDb)();
        const secretSetting = await db.get('SELECT value FROM settings WHERE key = ?', ['jwt_secret']);
        if (secretSetting && secretSetting.value) {
            return secretSetting.value;
        }
        // Seed and return default if not present
        await db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ['jwt_secret', JWT_SECRET_DEFAULT]);
        return JWT_SECRET_DEFAULT;
    }
    catch (err) {
        return JWT_SECRET_DEFAULT;
    }
}
async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        res.status(401).json({ error: 'Akses ditolak. Token tidak ditemukan.' });
        return;
    }
    const secret = await getJwtSecret();
    jsonwebtoken_1.default.verify(token, secret, (err, user) => {
        if (err) {
            res.status(403).json({ error: 'Token tidak valid atau kedaluwarsa.' });
            return;
        }
        req.user = user;
        next();
    });
}
function errorHandler(err, req, res, next) {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: err.message || 'Terjadi kesalahan internal pada server.'
    });
}
