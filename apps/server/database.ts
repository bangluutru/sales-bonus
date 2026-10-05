import { PGlite, type Transaction } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
export type Db = PGlite | Transaction;
export type Row = Record<string, unknown>;
export async function rows<T = Row>(
  db: Db,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await db.query<Row>(sql, params);
  for (const row of result.rows)
    for (const field of result.fields) {
      const value = row[field.name];
      if (value instanceof Date)
        row[field.name] =
          field.dataTypeID === 1082
            ? value.toISOString().slice(0, 10)
            : value.toISOString();
    }
  return result.rows as T[];
}
export async function one<T = Row>(
  db: Db,
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  return (await rows<T>(db, sql, params))[0] ?? null;
}
export async function openDatabase(path?: string): Promise<PGlite> {
  const db = path ? new PGlite(path) : new PGlite();
  const present = await one(
    db,
    "SELECT to_regclass('public.schema_migrations') AS found",
  );
  if (!present?.found)
    await db.exec(readFileSync("migrations/001_domain_foundation.sql", "utf8"));
  for (const file of ["002_local_application"])
    if (
      !(await one(
        db,
        "SELECT version FROM schema_migrations WHERE version=$1",
        [file],
      ))
    )
      await db.exec(readFileSync(`migrations/${file}.sql`, "utf8"));
  return db;
}
export function id(): string {
  return randomUUID();
}
export interface User {
  id: string;
  tenantId: string;
  name: string;
  role: string;
  employeeId: string | null;
}
export function requireRoles(user: User, roles: string[]): void {
  if (!roles.includes(user.role))
    throw new AppError(403, "Bạn không có quyền thực hiện thao tác này.");
}
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim() || value.length > 500)
    throw new AppError(400, `${label} không hợp lệ.`);
  return value.trim();
}
export function integer(
  value: unknown,
  label: string,
  positive = false,
): string {
  const s = text(value, label);
  if (!/^\d+$/.test(s) || s.length > 25 || (positive && BigInt(s) === 0n))
    throw new AppError(
      400,
      `${label} phải là số nguyên ${positive ? "dương" : "không âm"}.`,
    );
  return BigInt(s).toString();
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new AppError(400, "Dữ liệu phải là object.");
  return value as Record<string, unknown>;
}
export async function audit(
  db: Db,
  user: User,
  action: string,
  entityType: string,
  entityId: string,
  before: unknown,
  after: unknown,
  reason: string | null = null,
) {
  await db.query(
    "INSERT INTO audit_logs(tenant_id,id,actor_id,occurred_at,action,entity_type,entity_id,before_state,after_state,reason,request_id) VALUES ($1,$2,$3,now(),$4,$5,$6,$7,$8,$9,$10)",
    [
      user.tenantId,
      id(),
      user.id,
      action,
      entityType,
      entityId,
      before === null ? null : JSON.stringify(before),
      after === null ? null : JSON.stringify(after),
      reason,
      id(),
    ],
  );
}
