import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { migrations } from "./migrations";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "receipts.db");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

declare global {
  var __receiptDb: Database.Database | undefined;
}

function runMigrations(db: Database.Database) {
  db.exec("CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)");
  const row = db.prepare("SELECT version FROM schema_version LIMIT 1").get() as
    | { version: number }
    | undefined;
  const currentVersion = row?.version ?? 0;

  for (let i = currentVersion; i < migrations.length; i++) {
    db.exec(migrations[i]);
  }

  if (row) {
    db.prepare("UPDATE schema_version SET version = ?").run(migrations.length);
  } else {
    db.prepare("INSERT INTO schema_version (version) VALUES (?)").run(migrations.length);
  }
}

function createConnection(): Database.Database {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  return db;
}

export function getDb(): Database.Database {
  if (!global.__receiptDb) {
    global.__receiptDb = createConnection();
  }
  return global.__receiptDb;
}
