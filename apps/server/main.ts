import { mkdirSync } from "node:fs";
import { openDatabase } from "./database.js";
import { applicationServer } from "./http.js";
const path = process.env.SALES_BONUS_DB ?? ".runtime/database";
const port = Number(process.env.SALES_BONUS_PORT ?? "4317");
if (!Number.isSafeInteger(port) || port < 1 || port > 65535)
  throw new Error("Invalid local port");
mkdirSync(".runtime", { recursive: true });
const db = await openDatabase(path);
const server = applicationServer(db);
server.listen(port, "127.0.0.1", () =>
  console.log(`Sales Bonus local app: http://127.0.0.1:${port}`),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () =>
    server.close(() => {
      void db.close().then(() => process.exit(0));
    }),
  );
