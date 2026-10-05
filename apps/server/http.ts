import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
import {
  AppError,
  object,
  rows,
  text,
  requireRoles,
  audit,
  type User,
} from "./database.js";
import * as auth from "./auth.js";
import * as catalog from "./catalog.js";
import * as ops from "./operations.js";
import * as reports from "./reports.js";
import { configuration, saveConfiguration } from "./configuration.js";
async function body(req: IncomingMessage) {
  if (!req.headers["content-type"]?.startsWith("application/json"))
    throw new AppError(415, "Cần gửi JSON.");
  let result = "";
  for await (const chunk of req) {
    result += chunk;
    if (Buffer.byteLength(result) > 1000000)
      throw new AppError(413, "Dữ liệu quá lớn.");
  }
  try {
    return object(JSON.parse(result || "{}"));
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, "JSON không hợp lệ.");
  }
}
function json(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(value));
}
function restricted(user: User) {
  requireRoles(user, [
    "ADMIN",
    "ACCOUNTING",
    "PM",
    "SALES_MANAGER",
    "EXECUTIVE",
    "AUDITOR",
  ]);
}
export function applicationServer(
  db: PGlite,
  onUnexpectedError?: (error: unknown) => void,
) {
  const attempts = new Map<string, { count: number; until: number }>();
  return createServer(async (req, res) => {
    res.setHeader("x-content-type-options", "nosniff");
    res.setHeader("x-frame-options", "DENY");
    res.setHeader("referrer-policy", "same-origin");
    res.setHeader(
      "content-security-policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    try {
      const host = req.headers.host ?? "";
      if (!/^(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(host))
        throw new AppError(400, "Host không hợp lệ cho bản cục bộ.");
      const url = new URL(req.url ?? "/", `http://${host}`);
      const path = url.pathname;
      const method = req.method ?? "GET";
      if (!["GET", "POST"].includes(method))
        throw new AppError(405, "Phương thức không hỗ trợ.");
      if (
        method === "POST" &&
        req.headers.origin &&
        req.headers.origin !== `http://${host}`
      )
        throw new AppError(403, "Nguồn yêu cầu không hợp lệ.");
      if (method === "GET" && path === "/favicon.ico") {
        res.writeHead(204);
        res.end();
        return;
      }
      if (method === "GET" && !path.startsWith("/api/")) {
        const assets: Record<string, { path: string; type: string }> = {
          "/": { path: "apps/web/index.html", type: "text/html" },
          "/app.js": { path: "apps/web/app.js", type: "text/javascript" },
          "/styles.css": { path: "apps/web/styles.css", type: "text/css" },
        };
        const asset = assets[path];
        if (!asset) throw new AppError(404, "Không tìm thấy trang.");
        res.writeHead(200, {
          "content-type": asset.type + "; charset=utf-8",
          "cache-control": "no-cache",
        });
        res.end(readFileSync(asset.path));
        return;
      }
      if (path === "/api/auth/status" && method === "GET") {
        json(res, 200, { setupRequired: await auth.setupRequired(db) });
        return;
      }
      if (
        ["/api/auth/setup", "/api/auth/login"].includes(path) &&
        method === "POST"
      ) {
        const key = (req.socket.remoteAddress ?? "local") + path;
        const now = Date.now();
        let limit = attempts.get(key);
        if (!limit || limit.until < now) {
          limit = { count: 0, until: now + 60000 };
          attempts.set(key, limit);
        }
        if (limit.count++ >= 10)
          throw new AppError(429, "Thử lại sau một phút.");
        const input = await body(req);
        const user = path.endsWith("setup")
          ? await auth.setup(db, input)
          : await auth.login(db, input);
        const token = await auth.session(db, user);
        res.setHeader(
          "set-cookie",
          `session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`,
        );
        json(res, 200, { user });
        return;
      }
      const user = await auth.authenticate(db, req.headers.cookie);
      if (path === "/api/auth/me" && method === "GET") {
        json(res, 200, { user });
        return;
      }
      if (path === "/api/auth/logout" && method === "POST") {
        await body(req);
        await auth.logout(db, req.headers.cookie);
        res.setHeader(
          "set-cookie",
          "session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
        );
        json(res, 200, { ok: true });
        return;
      }
      if (method === "GET") {
        if (path === "/api/state") {
          const periodRows = await rows(
            db,
            "SELECT id,starts_on,ends_on,state,business_timezone FROM calculation_periods WHERE tenant_id=$1 ORDER BY starts_on DESC",
            [user.tenantId],
          );
          json(res, 200, {
            user,
            periods: periodRows,
            configuration: await configuration(db, user),
            catalog: await catalog.catalog(db, user),
            groups: await rows(
              db,
              "SELECT id,name FROM product_groups WHERE tenant_id=$1 ORDER BY name",
              [user.tenantId],
            ),
            staff: await ops.staff(db, user),
            policies: await catalog.policies(db, user),
            targets: await rows(
              db,
              "SELECT * FROM employee_targets WHERE tenant_id=$1 AND ($2<>'PM' OR employee_id=$3) ORDER BY version DESC",
              [user.tenantId, user.role, user.employeeId],
            ),
          });
          return;
        }
        if (path === "/api/dashboard") {
          json(
            res,
            200,
            await reports.dashboard(db, user, url.searchParams.get("period")),
          );
          return;
        }
        if (path === "/api/orders") {
          restricted(user);
          json(res, 200, await ops.orderList(db, user));
          return;
        }
        if (/^\/api\/orders\/[^/]+$/.test(path)) {
          restricted(user);
          json(
            res,
            200,
            await ops.orderDetail(
              db,
              user,
              decodeURIComponent(path.split("/")[3]!),
            ),
          );
          return;
        }
        if (path === "/api/report") {
          json(
            res,
            200,
            await reports.periodReport(
              db,
              user,
              text(url.searchParams.get("period"), "Kỳ"),
            ),
          );
          return;
        }
        if (path === "/api/audit") {
          requireRoles(user, ["ADMIN", "ACCOUNTING", "EXECUTIVE", "AUDITOR"]);
          json(
            res,
            200,
            await rows(
              db,
              "SELECT id,actor_id,occurred_at,action,entity_type,entity_id,before_state,after_state,reason FROM audit_logs WHERE tenant_id=$1 ORDER BY occurred_at DESC LIMIT 200",
              [user.tenantId],
            ),
          );
          return;
        }
        if (path === "/api/settlements") {
          requireRoles(user, [
            "ADMIN",
            "ACCOUNTING",
            "EXECUTIVE",
            "AUDITOR",
            "PM",
            "SUPPORT_MANAGER",
          ]);
          json(
            res,
            200,
            await rows(
              db,
              "SELECT s.*,p.state AS period_state,COALESCE((SELECT sum(x.amount) FROM settlement_payouts x WHERE x.tenant_id=s.tenant_id AND x.settlement_id=s.id),0)::text AS paid_amount FROM settlements s JOIN calculation_periods p ON (p.tenant_id=s.tenant_id AND p.id=s.period_id) WHERE s.tenant_id=$1 AND ($2<>'PM' OR (s.recipient_type='EMPLOYEE' AND s.recipient_id=$3)) AND ($2<>'SUPPORT_MANAGER' OR s.recipient_type='DEPARTMENT') ORDER BY s.locked_at DESC",
              [user.tenantId, user.role, user.employeeId],
            ),
          );
          return;
        }
        if (path === "/api/adjustments") {
          requireRoles(user, ["ADMIN", "ACCOUNTING", "EXECUTIVE", "AUDITOR"]);
          json(
            res,
            200,
            await rows(
              db,
              "SELECT * FROM adjustments WHERE tenant_id=$1 ORDER BY created_at DESC",
              [user.tenantId],
            ),
          );
          return;
        }
        if (path === "/api/integration") {
          json(res, 200, {
            status: "NOT_CONNECTED",
            reason:
              "Chưa có tenant payload và thông tin kết nối AMIS được xác minh.",
            ordersSource: "MANUAL",
            workbookStatus: "MISSING",
            fieldGaps: [
              "stable order/item/customer/owner identifiers",
              "historical reference price",
              "authoritative discount and VAT representation",
              "webhook authentication contract",
            ],
            secretsStored: false,
          });
          return;
        }
      }
      if (method === "POST") {
        const input = await body(req);
        let result: unknown;
        if (path === "/api/backup") {
          requireRoles(user, ["ADMIN"]);
          await audit(db, user, "BACKUP_EXPORTED", "SYSTEM", "DATABASE", null, {
            format: "PGLITE_TAR_GZIP",
          });
          const blob = await db.dumpDataDir("gzip");
          res.writeHead(200, {
            "content-type": "application/gzip",
            "content-disposition":
              'attachment; filename="sales-bonus-backup-' +
              new Date().toISOString().slice(0, 10) +
              '.tar.gz"',
            "cache-control": "no-store",
          });
          res.end(Buffer.from(await blob.arrayBuffer()));
          return;
        }
        if (path === "/api/configuration")
          result = await saveConfiguration(db, user, input);
        else if (path === "/api/staff")
          result = await ops.createEmployee(db, user, input);
        else if (path === "/api/periods")
          result = await ops.createPeriod(db, user, input);
        else if (path === "/api/targets")
          result = await ops.saveTarget(db, user, input);
        else if (path === "/api/groups")
          result = await catalog.saveProductGroup(db, user, input);
        else if (path === "/api/prices")
          result = await catalog.savePrice(db, user, input);
        else if (path === "/api/policies/pool")
          result = await catalog.savePoolPolicy(db, user, input);
        else if (path === "/api/policies/bonus")
          result = await catalog.saveBonusPolicy(db, user, input);
        else if (path === "/api/orders")
          result = await ops.createOrder(db, user, input);
        else if (path === "/api/payments")
          result = await ops.createPayment(db, user, input);
        else if (/^\/api\/payments\/[^/]+\/confirm$/.test(path))
          result = await ops.confirmPayment(
            db,
            user,
            path.split("/")[3]!,
            input,
          );
        else if (/^\/api\/payments\/[^/]+\/reverse$/.test(path))
          result = await ops.reversePayment(
            db,
            user,
            path.split("/")[3]!,
            input,
          );
        else if (path === "/api/expenses")
          result = await ops.createExpense(db, user, input);
        else if (/^\/api\/expenses\/[^/]+\/reject$/.test(path))
          result = await ops.rejectExpense(
            db,
            user,
            path.split("/")[3]!,
            input,
          );
        else if (/^\/api\/expenses\/[^/]+\/approve$/.test(path))
          result = await ops.approveExpense(db, user, path.split("/")[3]!);
        else if (/^\/api\/periods\/[^/]+\/state$/.test(path))
          result = await reports.setPeriodState(
            db,
            user,
            path.split("/")[3]!,
            input,
          );
        else if (/^\/api\/periods\/[^/]+\/pay$/.test(path))
          result = await reports.payPeriod(
            db,
            user,
            path.split("/")[3]!,
            input,
          );
        else if (path === "/api/refunds")
          result = await reports.refundAdjustment(db, user, input);
        else if (/^\/api\/adjustments\/[^/]+\/reject$/.test(path))
          result = await reports.rejectRecovery(
            db,
            user,
            path.split("/")[3]!,
            input,
          );
        else if (/^\/api\/adjustments\/[^/]+\/approve$/.test(path))
          result = await reports.approveRecovery(
            db,
            user,
            path.split("/")[3]!,
            input,
          );
        else throw new AppError(404, "Endpoint không tồn tại.");
        json(res, 200, result);
        return;
      }
      throw new AppError(404, "Endpoint không tồn tại.");
    } catch (error) {
      if (error instanceof AppError) {
        json(res, error.status, { error: error.message });
        return;
      }
      const message = error instanceof Error ? error.message : "UNKNOWN";
      if (/^[A-Z][A-Z0-9_]+$/.test(message)) {
        json(res, 400, { error: "Dữ liệu chưa hợp lệ: " + message });
        return;
      }
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String(error.code)
          : "";
      if (
        ["23503", "23505", "23514", "22P02", "22007", "22003"].includes(code)
      ) {
        json(res, 409, {
          error:
            "Dữ liệu xung đột hoặc chưa đủ thông tin. Kiểm tra bản ghi và thử lại.",
        });
        return;
      }
      onUnexpectedError?.(error);
      json(res, 500, {
        error:
          "Thao tác chưa hoàn tất. Dữ liệu không được lưu; hãy thử lại hoặc kiểm tra cấu hình.",
      });
    }
  });
}
