const path = require("path");
const Database = require("better-sqlite3");

const databasePath = path.join(__dirname, "corepanel.db");
const database = new Database(databasePath);

database.pragma("journal_mode = WAL");

database.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
`);

module.exports = database;