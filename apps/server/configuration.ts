import type { PGlite } from "@electric-sql/pglite";
import {
  q,
  div,
  compare,
  sum,
  rate,
  dateOnly,
} from "../../packages/domain/index.js";
import {
  AppError,
  text,
  one,
  id,
  audit,
  requireRoles,
  type Db,
  type User,
} from "./database.js";
export interface Configuration {
  poolBasis: "EXCLUDING_VAT" | "INCLUDING_VAT";
  revenueBasis: "EXCLUDING_VAT" | "INCLUDING_VAT";
  timezone: string;
  recognition: "PRO_RATA_NET";
  bonusPolicyTiming: "ORDER_DATE";
  expenseRecognition: "PRO_RATA_WITH_COLLECTION";
  supportShares: { MKT: string; ACCOUNTING: string; LOGISTICS: string };
  roundingQuantumVnd: string;
}
export function finiteDecimal(value: string): string {
  const v = q(value);
  let scale = 1n,
    places = 0;
  while (scale % v.d !== 0n) {
    scale *= 10n;
    places++;
    if (places > 30)
      throw new AppError(
        400,
        "Số thập phân không hữu hạn; cần nguồn giá chính xác.",
      );
  }
  const n = v.n * (scale / v.d);
  const sign = n < 0n ? "-" : "";
  const digits = (n < 0n ? -n : n).toString().padStart(places + 1, "0");
  return places
    ? `${sign}${digits.slice(0, -places)}.${digits.slice(-places)}`
    : `${sign}${digits}`;
}
export function percent(value: unknown): string {
  const input = text(value, "Tỷ lệ");
  if (!/^\d+(\.\d{1,6})?$/.test(input))
    throw new AppError(400, "Tỷ lệ phải là số thập phân.");
  const result = div(q(input), q("100"));
  rate(finiteDecimal(result.n + "/" + result.d));
  return finiteDecimal(result.n + "/" + result.d);
}
export function validDate(value: unknown): string {
  const result = text(value, "Ngày");
  try {
    dateOnly(result);
  } catch {
    throw new AppError(400, "Ngày không hợp lệ.");
  }
  return result;
}
export async function configuration(
  db: Db,
  user: User,
): Promise<(Configuration & { id: string; version: number }) | null> {
  const row = await one(
    db,
    "SELECT * FROM configuration_versions WHERE tenant_id=$1 ORDER BY version DESC LIMIT 1",
    [user.tenantId],
  );
  return row
    ? {
        ...(row.configuration as Configuration),
        id: String(row.id),
        version: Number(row.version),
      }
    : null;
}
export async function saveConfiguration(
  db: PGlite,
  user: User,
  input: Record<string, unknown>,
) {
  requireRoles(user, ["ADMIN", "EXECUTIVE"]);
  const basis = ["EXCLUDING_VAT", "INCLUDING_VAT"];
  if (
    !basis.includes(String(input.poolBasis)) ||
    !basis.includes(String(input.revenueBasis))
  )
    throw new AppError(400, "Chọn rõ cơ sở VAT cho quỹ và doanh số.");
  const timezone = text(input.timezone, "Múi giờ");
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
  } catch {
    throw new AppError(400, "Múi giờ không hợp lệ.");
  }
  if (
    input.recognition !== "PRO_RATA_NET" ||
    input.bonusPolicyTiming !== "ORDER_DATE" ||
    input.expenseRecognition !== "PRO_RATA_WITH_COLLECTION"
  )
    throw new AppError(
      400,
      "Cần lựa chọn rõ quy tắc ghi nhận và ngày chính sách.",
    );
  const shares = {
    MKT: percent(input.mktPercent),
    ACCOUNTING: percent(input.accountingPercent),
    LOGISTICS: percent(input.logisticsPercent),
  };
  if (compare(sum(Object.values(shares).map(q)), q("1")) !== 0)
    throw new AppError(400, "Tỷ lệ Support phải bằng 100%.");
  const quantum = text(input.roundingQuantumVnd, "Đơn vị làm tròn");
  if (!/^[1-9]\d{0,8}$/.test(quantum))
    throw new AppError(400, "Đơn vị làm tròn không hợp lệ.");
  const config: Configuration = {
    poolBasis: input.poolBasis as Configuration["poolBasis"],
    revenueBasis: input.revenueBasis as Configuration["revenueBasis"],
    timezone,
    recognition: "PRO_RATA_NET",
    bonusPolicyTiming: "ORDER_DATE",
    expenseRecognition: "PRO_RATA_WITH_COLLECTION",
    supportShares: shares,
    roundingQuantumVnd: quantum,
  };
  return db.transaction(async (tx) => {
    const prior = await configuration(tx, user);
    const result = { id: id(), version: (prior?.version ?? 0) + 1, ...config };
    await tx.query(
      "INSERT INTO configuration_versions(tenant_id,id,version,configuration,created_by) VALUES ($1,$2,$3,$4,$5)",
      [
        user.tenantId,
        result.id,
        result.version,
        JSON.stringify(config),
        user.id,
      ],
    );
    await audit(
      tx,
      user,
      "CONFIGURATION_VERSION_CREATED",
      "CONFIGURATION",
      result.id,
      prior,
      result,
    );
    return result;
  });
}
