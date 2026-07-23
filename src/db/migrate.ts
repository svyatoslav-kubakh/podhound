import schemaSql from "../../migrations/001_initial_schema.sql" with { type: "text" };
import { db } from "./client";

export function runMigrations() {
  db.transaction(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const migrationName = "001_initial_schema.sql";
    const existing = db
      .prepare("SELECT id FROM _migrations WHERE name = ?")
      .get(migrationName);

    if (!existing) {
      console.log(`[DB] Applying migration: ${migrationName}`);
      db.exec(schemaSql);
      db.prepare("INSERT INTO _migrations (name) VALUES (?)").run(migrationName);
      console.log(`[DB] Successfully applied migration: ${migrationName}`);
    }
  })();
}
