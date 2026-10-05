import { Blob } from "node:buffer";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
const [source, destination, ...extra] = process.argv.slice(2);
if (!source || !destination || extra.length)
  throw new Error(
    "Usage: node scripts/restore-backup.mjs backup.tar.gz NEW_DATABASE_DIRECTORY",
  );
const target = resolve(destination);
if (existsSync(target))
  throw new Error(
    "Destination exists. Restore only into a new directory; the current database is never overwritten.",
  );
const db = new PGlite({
  dataDir: target,
  loadDataDir: new Blob([readFileSync(resolve(source))]),
});
try {
  const result = await db.query(
    "SELECT version FROM schema_migrations ORDER BY version",
  );
  console.log("Restored database at " + target);
  console.log("Migrations: " + result.rows.map((r) => r.version).join(", "));
  await db.query("DELETE FROM auth_sessions");
} finally {
  await db.close();
}
