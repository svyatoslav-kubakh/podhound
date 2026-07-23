import { Database } from "bun:sqlite";

const dbPath = process.env.DATABASE_PATH || "podhound.db";
export const db = new Database(dbPath);

// Enable Foreign Key support and WAL mode for better concurrency
db.exec("PRAGMA foreign_keys = ON;");
db.exec("PRAGMA journal_mode = WAL;");
