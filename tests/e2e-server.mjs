import { openDatabase } from "../dist/apps/server/database.js";
import { applicationServer } from "../dist/apps/server/http.js";
const db = await openDatabase();
const server = applicationServer(db);
server.listen(4318, "127.0.0.1");
process.on("SIGTERM", () =>
  server.close(async () => {
    await db.close();
    process.exit(0);
  }),
);
