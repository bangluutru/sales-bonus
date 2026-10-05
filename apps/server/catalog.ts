import type { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import {
  id,
  audit,
  rows,
  one,
  text,
  integer,
  AppError,
  requireRoles,
  type Db,
  type User,
  type Row,
} from "./database.js";
import { validDate, percent } from "./configuration.js";
import {
  snapshotManagementPolicy,
  type ManagementPoolPolicy,
  type BonusPolicy,
  validateBonusPolicy,
} from "../../packages/domain/index.js";
function csv(input: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [],
    value = "",
    quoted = false;
  const s = input.replace(/^\uFEFF/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '"') {
      if (quoted && s[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(value);
      value = "";
    } else if (c === "\n" && !quoted) {
      row.push(value.replace(/\r$/, ""));
      result.push(row);
      row = [];
      value = "";
    } else value += c;
  }
  if (value || row.length) {
    row.push(value);
    result.push(row);
  }
  return result;
}
export async function seedCatalog(db: Db, user: User) {
  if (
    await one(db, "SELECT id FROM products WHERE tenant_id=$1 LIMIT 1", [
      user.tenantId,
    ])
  )
    return;
  const table = csv(
    readFileSync("data/reference/genki-product-prices.provisional.csv", "utf8"),
  );
  const headers = table.shift()!;
  for (const line of table) {
    const row = Object.fromEntries(headers.map((h, i) => [h, line[i] ?? ""]));
    const productId = id();
    await db.query(
      "INSERT INTO products(tenant_id,id,sku,name,jan_source) VALUES ($1,$2,$3,$4,$5)",
      [user.tenantId, productId, "REF-" + row.jan, row.product_name, row.jan],
    );
    await db.query(
      "INSERT INTO product_price_versions(tenant_id,id,product_id,version,input_amount,currency,pack,tax_basis,vat_rate,status,source_reference,source_hash,change_reason,created_by) VALUES ($1,$2,$3,1,$4,'VND',$5,'INCLUDING_VAT',$6,'PROVISIONAL',$7,$8,$9,$10)",
      [
        user.tenantId,
        id(),
        productId,
        row.list_price_including_vat_vnd,
        row.pack,
        percent(row.source_vat_percent),
        "GENKI PDF page " + row.source_page + " row " + row.source_row,
        row.source_sha256,
        "Tạm tính; " + row.review_flags,
        user.id,
      ],
    );
  }
  await audit(
    db,
    user,
    "PROVISIONAL_CATALOG_IMPORTED",
    "CATALOG",
    "GENKI_2025",
    null,
    { count: 46, status: "PROVISIONAL_REFERENCE" },
  );
}
export async function catalog(db: Db, user: User) {
  return rows(
    db,
    `SELECT p.*, (SELECT to_jsonb(v) || jsonb_build_object('input_amount',v.input_amount::text,'vat_rate',v.vat_rate::text) FROM product_price_versions v WHERE v.tenant_id=p.tenant_id AND v.product_id=p.id ORDER BY version DESC LIMIT 1) AS latest_price FROM products p WHERE p.tenant_id=$1 ORDER BY p.sku`,
    [user.tenantId],
  );
}
export async function savePrice(
  db: PGlite,
  user: User,
  input: Record<string, unknown>,
) {
  requireRoles(user, ["ADMIN", "EXECUTIVE"]);
  const productId = text(input.productId, "Sản phẩm");
  const amount = integer(input.amount, "Giá niêm yết", true);
  const effective = validDate(input.effectiveFrom);
  const vat = percent(input.vatPercent);
  const pack = text(input.pack, "Quy cách");
  const reason = text(input.reason, "Lý do");
  const basis = text(input.taxBasis, "Cơ sở VAT");
  if (!["INCLUDING_VAT", "EXCLUDING_VAT"].includes(basis))
    throw new AppError(400, "Cơ sở VAT không hợp lệ.");
  return db.transaction(async (tx) => {
    const product = await one(
      tx,
      "SELECT id FROM products WHERE tenant_id=$1 AND id=$2",
      [user.tenantId, productId],
    );
    if (!product) throw new AppError(404, "Không tìm thấy sản phẩm.");
    const prior = await one(
      tx,
      "SELECT * FROM product_price_versions WHERE tenant_id=$1 AND product_id=$2 ORDER BY version DESC LIMIT 1",
      [user.tenantId, productId],
    );
    if (
      prior?.status === "APPROVED" &&
      effective <= String(prior.effective_from)
    )
      throw new AppError(
        409,
        "Phiên bản mới phải bắt đầu sau ngày của phiên bản trước.",
      );
    const priceId = id();
    await tx.query(
      "INSERT INTO product_price_versions(tenant_id,id,product_id,version,input_amount,currency,pack,tax_basis,vat_rate,effective_from,status,source_reference,change_reason,created_by,approved_by,supersedes_price_id) VALUES ($1,$2,$3,$4,$5,'VND',$6,$7,$8,$9,'APPROVED',$10,$11,$12,$12,$13)",
      [
        user.tenantId,
        priceId,
        productId,
        Number(prior?.version ?? 0) + 1,
        amount,
        pack,
        basis,
        vat,
        effective,
        "LOCAL_PRICEBOOK",
        reason,
        user.id,
        prior?.status === "APPROVED" ? prior.id : null,
      ],
    );
    await audit(
      tx,
      user,
      "PRICE_VERSION_CREATED",
      "PRICE",
      priceId,
      prior,
      { amount, effective, vat, basis, productId },
      reason,
    );
    return { id: priceId };
  });
}
export async function policies(db: Db, user: User) {
  return {
    management: await rows(
      db,
      "SELECT * FROM management_pool_policies WHERE tenant_id=$1 ORDER BY effective_from DESC,version DESC",
      [user.tenantId],
    ),
    bonus: await rows(
      db,
      "SELECT * FROM bonus_policies WHERE tenant_id=$1 ORDER BY effective_from DESC,version DESC",
      [user.tenantId],
    ),
  };
}
export async function savePoolPolicy(
  db: PGlite,
  user: User,
  input: Record<string, unknown>,
) {
  requireRoles(user, ["ADMIN", "EXECUTIVE"]);
  const scope = text(input.scope, "Phạm vi");
  if (!["ALL", "PRODUCT_GROUP", "PRODUCT"].includes(scope))
    throw new AppError(400, "Phạm vi không hợp lệ.");
  const scopeId = scope === "ALL" ? null : text(input.scopeId, "Sản phẩm/nhóm");
  const effective = validDate(input.effectiveFrom);
  const pool = percent(input.percent);
  const reason = text(input.reason, "Lý do");
  return db.transaction(async (tx) => {
    const prior = await one(
      tx,
      "SELECT * FROM management_pool_policies WHERE tenant_id=$1 AND scope=$2 AND product_id IS NOT DISTINCT FROM $3 AND product_group_id IS NOT DISTINCT FROM $4 ORDER BY effective_from DESC LIMIT 1",
      [
        user.tenantId,
        scope,
        scope === "PRODUCT" ? scopeId : null,
        scope === "PRODUCT_GROUP" ? scopeId : null,
      ],
    );
    if (prior && effective <= String(prior.effective_from))
      throw new AppError(409, "Ngày hiệu lực mới phải sau phiên bản trước.");
    const policyId = id();
    await tx.query(
      "INSERT INTO management_pool_policies(tenant_id,id,version,scope,product_id,product_group_id,pool_rate,effective_from,status,created_by,approved_by,supersedes_policy_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'APPROVED',$9,$9,$10)",
      [
        user.tenantId,
        policyId,
        Number(prior?.version ?? 0) + 1,
        scope,
        scope === "PRODUCT" ? scopeId : null,
        scope === "PRODUCT_GROUP" ? scopeId : null,
        pool,
        effective,
        user.id,
        prior?.id ?? null,
      ],
    );
    await audit(
      tx,
      user,
      "POOL_POLICY_CREATED",
      "POLICY",
      policyId,
      prior,
      { scope, scopeId, pool, effective },
      reason,
    );
    return { id: policyId };
  });
}
export async function saveBonusPolicy(
  db: PGlite,
  user: User,
  input: Record<string, unknown>,
) {
  requireRoles(user, ["ADMIN", "EXECUTIVE"]);
  const pm = percent(input.pmPercent),
    support = percent(input.supportPercent),
    company = percent(input.companyPercent);
  const effective = validDate(input.effectiveFrom);
  const reason = text(input.reason, "Lý do");
  validateBonusPolicy({
    id: "validate",
    version: 1,
    pmShare: pm,
    supportShare: support,
    companyShare: company,
  });
  return db.transaction(async (tx) => {
    const prior = await one(
      tx,
      "SELECT * FROM bonus_policies WHERE tenant_id=$1 ORDER BY effective_from DESC LIMIT 1",
      [user.tenantId],
    );
    if (prior && effective <= String(prior.effective_from))
      throw new AppError(409, "Ngày hiệu lực mới phải sau phiên bản trước.");
    const policyId = id();
    await tx.query(
      "INSERT INTO bonus_policies(tenant_id,id,version,pm_share,support_share,company_share,effective_from,status,rounding_mode,rounding_quantum,created_by,approved_by,supersedes_policy_id) VALUES ($1,$2,$3,$4,$5,$6,$7,'APPROVED','CEILING',1000,$8,$8,$9)",
      [
        user.tenantId,
        policyId,
        Number(prior?.version ?? 0) + 1,
        pm,
        support,
        company,
        effective,
        user.id,
        prior?.id ?? null,
      ],
    );
    await audit(
      tx,
      user,
      "BONUS_POLICY_CREATED",
      "POLICY",
      policyId,
      prior,
      { pm, support, company, effective },
      reason,
    );
    return { id: policyId };
  });
}
export function effectiveChain(
  records: Row[],
  dateField = "effective_from",
): Row[] {
  return records.map((row) => {
    const next = records.find(
      (n) =>
        n.supersedes_policy_id === row.id || n.supersedes_price_id === row.id,
    );
    return { ...row, effective_to: next ? next[dateField] : row.effective_to };
  });
}
export async function managementSnapshot(
  db: Db,
  user: User,
  product: Row,
  date: string,
) {
  const data = effectiveChain(
    await rows(
      db,
      "SELECT * FROM management_pool_policies WHERE tenant_id=$1 AND status=$2",
      [user.tenantId, "APPROVED"],
    ),
  );
  const input: ManagementPoolPolicy[] = data.map((r) => ({
    id: String(r.id),
    version: Number(r.version),
    scope: r.scope as ManagementPoolPolicy["scope"],
    scopeId: (r.product_id ?? r.product_group_id ?? null) as string | null,
    rate: String(r.pool_rate),
    effectiveFrom: String(r.effective_from),
    effectiveTo: r.effective_to ? String(r.effective_to) : null,
    status: "APPROVED",
  }));
  return snapshotManagementPolicy(input, {
    productId: String(product.id),
    groupId: product.product_group_id ? String(product.product_group_id) : null,
    orderDate: date,
  });
}
export async function bonusSnapshot(
  db: Db,
  user: User,
  date: string,
): Promise<BonusPolicy> {
  const data = effectiveChain(
    await rows(
      db,
      "SELECT * FROM bonus_policies WHERE tenant_id=$1 AND status='APPROVED'",
      [user.tenantId],
    ),
  ).filter(
    (r) =>
      String(r.effective_from) <= date &&
      (!r.effective_to || date < String(r.effective_to)),
  );
  if (data.length !== 1)
    throw new AppError(
      409,
      "Cần chính sách chia thưởng hợp lệ tại ngày đơn hàng.",
    );
  const r = data[0]!;
  return {
    id: String(r.id),
    version: Number(r.version),
    pmShare: String(r.pm_share),
    supportShare: String(r.support_share),
    companyShare: String(r.company_share),
  };
}
export async function saveProductGroup(
  db: PGlite,
  user: User,
  input: Record<string, unknown>,
) {
  requireRoles(user, ["ADMIN", "EXECUTIVE"]);
  if (!Array.isArray(input.productIds))
    throw new AppError(400, "Chọn sản phẩm cho nhóm.");
  const products = input.productIds.map((value) => text(value, "Sản phẩm"));
  if (new Set(products).size !== products.length)
    throw new AppError(400, "Sản phẩm bị lặp.");
  return db.transaction(async (tx) => {
    const groupId = input.groupId ? text(input.groupId, "Nhóm") : id();
    if (input.groupId) {
      if (
        !(await one(
          tx,
          "SELECT id FROM product_groups WHERE tenant_id=$1 AND id=$2",
          [user.tenantId, groupId],
        ))
      )
        throw new AppError(404, "Nhóm không tồn tại.");
    } else
      await tx.query(
        "INSERT INTO product_groups(tenant_id,id,name) VALUES ($1,$2,$3)",
        [user.tenantId, groupId, text(input.name, "Tên nhóm")],
      );
    for (const productId of products) {
      const product = await one(
        tx,
        "SELECT * FROM products WHERE tenant_id=$1 AND id=$2",
        [user.tenantId, productId],
      );
      if (!product) throw new AppError(404, "Sản phẩm không tồn tại.");
      await tx.query(
        "UPDATE products SET product_group_id=$3 WHERE tenant_id=$1 AND id=$2",
        [user.tenantId, productId, groupId],
      );
      await audit(
        tx,
        user,
        "PRODUCT_GROUP_ASSIGNED",
        "PRODUCT",
        productId,
        product,
        { groupId },
        "Áp dụng cho đơn mới; snapshot đơn cũ giữ nguyên.",
      );
    }
    await audit(
      tx,
      user,
      "PRODUCT_GROUP_SAVED",
      "PRODUCT_GROUP",
      groupId,
      null,
      { productIds: products },
    );
    return { id: groupId };
  });
}
