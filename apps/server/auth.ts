import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { seedCatalog } from "./catalog.js";
import type { PGlite } from "@electric-sql/pglite";
import { AppError, id, one, text, audit, type User } from "./database.js";
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
function verify(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
function passwordInput(value: unknown) {
  const password = text(value, "Mật khẩu");
  if (password.length < 12 || password.length > 128)
    throw new AppError(400, "Mật khẩu cần 12–128 ký tự.");
  return password;
}
export async function setupRequired(db: PGlite) {
  return !(await one(db, "SELECT id FROM app_users LIMIT 1"));
}
export async function setup(db: PGlite, input: Record<string, unknown>) {
  const login = text(input.login, "Tên đăng nhập").toLowerCase();
  const name = text(input.name, "Tên quản trị");
  const password = passwordInput(input.password);
  return db.transaction(async (tx) => {
    if (await one(tx, "SELECT id FROM app_users LIMIT 1"))
      throw new AppError(409, "Hệ thống đã được thiết lập.");
    const tenant = "local-company",
      userId = id();
    await tx.query("INSERT INTO tenants(id,name) VALUES ($1,$2)", [
      tenant,
      "Công ty của bạn",
    ]);
    await tx.query(
      "INSERT INTO app_users(tenant_id,id,name,role) VALUES ($1,$2,$3,'ADMIN')",
      [tenant, userId, name],
    );
    await tx.query(
      "INSERT INTO auth_credentials(tenant_id,user_id,login,password_hash) VALUES ($1,$2,$3,$4)",
      [tenant, userId, login, hashPassword(password)],
    );
    const user: User = {
      id: userId,
      tenantId: tenant,
      name,
      role: "ADMIN",
      employeeId: null,
    };
    await audit(tx, user, "INITIAL_SETUP", "USER", userId, null, {
      name,
      role: "ADMIN",
    });
    await seedCatalog(tx, user);
    return user;
  });
}
export async function login(
  db: PGlite,
  input: Record<string, unknown>,
): Promise<User> {
  const username = text(input.login, "Tên đăng nhập").toLowerCase();
  const password = text(input.password, "Mật khẩu");
  const row = await one(
    db,
    "SELECT c.password_hash,u.*,e.id AS employee_id FROM auth_credentials c JOIN app_users u ON (u.tenant_id=c.tenant_id AND u.id=c.user_id) LEFT JOIN employees e ON (e.tenant_id=u.tenant_id AND e.user_id=u.id) WHERE c.login=$1 AND u.active=true",
    [username],
  );
  const valid = verify(
    password,
    String(
      row?.password_hash ??
        "00000000000000000000000000000000:" + "0".repeat(128),
    ),
  );
  if (!row || !valid)
    throw new AppError(401, "Tên đăng nhập hoặc mật khẩu không đúng.");
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    name: String(row.name),
    role: String(row.role),
    employeeId: row.employee_id ? String(row.employee_id) : null,
  };
}
const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function session(db: PGlite, user: User) {
  const token = randomBytes(32).toString("base64url");
  await db.query(
    "INSERT INTO auth_sessions(token_hash,tenant_id,user_id,expires_at) VALUES ($1,$2,$3,now()+interval '8 hours')",
    [tokenHash(token), user.tenantId, user.id],
  );
  return token;
}
export async function authenticate(
  db: PGlite,
  cookie: string | undefined,
): Promise<User> {
  const token = cookie
    ?.split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith("session="))
    ?.slice(8);
  if (!token) throw new AppError(401, "Vui lòng đăng nhập.");
  const row = await one(
    db,
    "SELECT u.*,e.id AS employee_id FROM auth_sessions s JOIN app_users u ON (s.tenant_id=u.tenant_id AND s.user_id=u.id) LEFT JOIN employees e ON (e.tenant_id=u.tenant_id AND e.user_id=u.id) WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active=true",
    [tokenHash(token)],
  );
  if (!row) throw new AppError(401, "Phiên đăng nhập đã hết hạn.");
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    name: String(row.name),
    role: String(row.role),
    employeeId: row.employee_id ? String(row.employee_id) : null,
  };
}
export async function logout(db: PGlite, cookie: string | undefined) {
  const token = cookie
    ?.split(";")
    .map((p) => p.trim())
    .find((p) => p.startsWith("session="))
    ?.slice(8);
  if (token)
    await db.query("DELETE FROM auth_sessions WHERE token_hash=$1", [
      tokenHash(token),
    ]);
}
export { passwordInput };
