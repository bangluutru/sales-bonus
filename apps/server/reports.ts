import type { PGlite } from "@electric-sql/pglite";
import { createHash } from "node:crypto";
import {
  AppError,
  rows,
  one,
  id,
  integer,
  text,
  audit,
  requireRoles,
  type Db,
  type User,
  type Row,
} from "./database.js";
import {
  configuration,
  validDate,
  type Configuration,
} from "./configuration.js";
import {
  calculateItem,
  finalizeBonus,
  q,
  sub,
  add,
  mul,
  div,
  sum,
  exact,
  ceilQuantum,
  type ItemResult,
  type PoolExpense,
} from "../../packages/domain/index.js";
import type { StoredInput } from "./operations.js";
export interface ReportLine {
  orderId: string;
  orderNumber: string;
  customerName: string;
  productName: string;
  pmId: string;
  itemId: string;
  opening: ItemResult;
  closing: ItemResult;
  period: ItemResult;
  collectedRevenue: string;
  collectedCash: string;
  sourceInput: StoredInput;
}
async function itemAt(db: Db, user: User, row: Row, before: string) {
  const input = structuredClone(row.canonical_input as StoredInput);
  const expenseRows = await rows(
    db,
    "SELECT id,category,amount,status FROM pool_expenses WHERE tenant_id=$1 AND order_item_id=$2 ORDER BY id",
    [user.tenantId, row.id],
  );
  input.expenses = expenseRows.map((e) => ({
    id: String(e.id),
    category: e.category as PoolExpense["category"],
    amount: String(e.amount),
    status: e.status as PoolExpense["status"],
  }));
  const receipts = await rows(
    db,
    `SELECT p.id,p.status,a.amount::text AS allocated FROM payment_allocations a JOIN payments p ON (p.tenant_id=a.tenant_id AND p.id=a.payment_id) WHERE a.tenant_id=$1 AND a.order_item_id=$2 AND p.payment_date<$3 AND p.status='CONFIRMED' AND NOT EXISTS(SELECT 1 FROM financial_events f WHERE f.tenant_id=p.tenant_id AND f.entity_id=p.id AND f.event_type='PAYMENT_REVERSED' AND (f.immutable_payload->>'date')::date<$3) ORDER BY p.id`,
    [user.tenantId, row.id, before],
  );
  input.payments = receipts.map((p) => ({
    id: String(p.id),
    status: "CONFIRMED",
    eligibleAmount: exact(
      input.economicBasis === "EXCLUDING_VAT"
        ? div(q(String(p.allocated)), add(q("1"), q(input.vatRate)))
        : q(String(p.allocated)),
    ),
  }));
  return calculateItem(input);
}
export async function periodReport(db: Db, user: User, periodId: string) {
  const period = await one(
    db,
    "SELECT * FROM calculation_periods WHERE tenant_id=$1 AND id=$2",
    [user.tenantId, periodId],
  );
  if (!period) throw new AppError(404, "Không tìm thấy kỳ.");
  if (period.state === "LOCKED" || period.state === "PAID") {
    const settlements = await rows(
      db,
      "SELECT * FROM settlements WHERE tenant_id=$1 AND period_id=$2 ORDER BY recipient_type,recipient_id",
      [user.tenantId, periodId],
    );
    const full = settlements.find((s) => s.recipient_type === "COMPANY");
    const stored = full?.immutable_snapshot as
      ReturnType<typeof structuredClone> | undefined;
    if (!stored) throw new AppError(409, "Kỳ đã khóa thiếu snapshot đối soát.");
    return scopedReport(
      {
        ...(stored as Report),
        period: { ...(stored as Report).period, state: String(period.state) },
      },
      user,
    );
  }
  const config = period.configuration_snapshot as Configuration;
  if (!config?.poolBasis)
    throw new AppError(409, "Kỳ thiếu cấu hình snapshot.");
  const adjustments = await rows(
    db,
    `SELECT a.*,s.recipient_type,s.recipient_id FROM adjustments a JOIN settlements s ON (s.tenant_id=a.tenant_id AND s.id=a.source_settlement_id) WHERE a.tenant_id=$1 AND a.application_period_id=$2 AND a.status='APPROVED' AND NOT EXISTS(SELECT 1 FROM adjustment_applications x WHERE x.tenant_id=a.tenant_id AND x.adjustment_id=a.id) ORDER BY a.id`,
    [user.tenantId, periodId],
  );
  const itemRows = await rows(
    db,
    `SELECT i.*,o.order_date,o.order_number,o.pm_id,c.name AS customer_name,p.name AS product_name FROM order_items i JOIN orders o ON (o.tenant_id=i.tenant_id AND o.id=i.order_id) JOIN customers c ON (c.tenant_id=o.tenant_id AND c.id=o.customer_id) JOIN products p ON (p.tenant_id=i.tenant_id AND p.id=i.product_id) WHERE i.tenant_id=$1 AND o.order_date<$2 AND ($3<>'PM' OR o.pm_id=$4) ORDER BY i.id`,
    [user.tenantId, period.ends_on, user.role, user.employeeId],
  );
  const lines: ReportLine[] = [];
  for (const item of itemRows) {
    const previous = await one(
      db,
      `SELECT l.trace FROM bonus_calculation_lines l JOIN calculation_periods p ON (p.tenant_id=l.tenant_id AND p.id=l.period_id) WHERE l.tenant_id=$1 AND l.order_item_id=$2 AND p.state IN ('LOCKED','PAID') AND p.ends_on<=$3 ORDER BY p.ends_on DESC LIMIT 1`,
      [user.tenantId, item.id, period.starts_on],
    );
    const opening = previous
      ? (previous.trace as ReportLine).closing
      : await itemAt(db, user, item, String(period.starts_on));
    const closing = await itemAt(db, user, item, String(period.ends_on));
    const earned = {
      pm: exact(sub(q(closing.earned.pm), q(opening.earned.pm))),
      support: exact(sub(q(closing.earned.support), q(opening.earned.support))),
      company: exact(sub(q(closing.earned.company), q(opening.earned.company))),
    };
    if (Object.values(earned).some((v) => q(v).n < 0n))
      throw new AppError(
        409,
        "Phát sinh thu hồi âm; cần khoản điều chỉnh có duyệt thay vì tự sửa lịch sử.",
      );
    const input = item.canonical_input as StoredInput;
    const eligible = sub(
      q(closing.collectedEligible),
      q(opening.collectedEligible),
    );
    if (String(item.order_date) < String(period.starts_on) && eligible.n === 0n)
      continue;
    const cash =
      input.economicBasis === "EXCLUDING_VAT"
        ? mul(eligible, add(q("1"), q(input.vatRate)))
        : eligible;
    const revenue =
      config.revenueBasis === "EXCLUDING_VAT"
        ? div(cash, add(q("1"), q(input.vatRate)))
        : cash;
    lines.push({
      orderId: String(item.order_id),
      orderNumber: String(item.order_number),
      customerName: String(item.customer_name),
      productName: String(item.product_name),
      pmId: String(item.pm_id),
      itemId: String(item.id),
      opening,
      closing,
      period: { ...closing, earned, collectedEligible: exact(eligible) },
      collectedRevenue: exact(revenue),
      collectedCash: exact(cash),
      sourceInput: input,
    });
  }
  const pms: PmResult[] = [];
  for (const pmId of [
    ...new Set([
      ...lines.map((l) => l.pmId),
      ...adjustments
        .filter((a) => a.recipient_type === "EMPLOYEE")
        .map((a) => String(a.recipient_id)),
    ]),
  ]) {
    const pm = await one(
      db,
      "SELECT name FROM employees WHERE tenant_id=$1 AND id=$2",
      [user.tenantId, pmId],
    );
    const pmLines = lines.filter((l) => l.pmId === pmId);
    const target = await one(
      db,
      "SELECT amount::text AS amount FROM employee_targets WHERE tenant_id=$1 AND employee_id=$2 AND period_id=$3 ORDER BY version DESC LIMIT 1",
      [user.tenantId, pmId, periodId],
    );
    const collection = exact(sum(pmLines.map((l) => q(l.collectedRevenue))));
    const final = finalizeBonus({
      lines: pmLines.map((l) => l.period),
      target: target ? String(target.amount) : null,
      confirmedPeriodCollection: collection,
      supportShares: config.supportShares,
      roundingQuantumVnd: config.roundingQuantumVnd,
    });
    pms.push({
      id: pmId,
      name: String(pm?.name ?? "PM"),
      target: target ? String(target.amount) : null,
      collectedRevenue: collection,
      ...final.pm,
      warnings: final.warnings,
      settlementEligible: final.settlementEligible,
    });
  }
  const aggregate = finalizeBonus({
    lines: lines.map((l) => l.period),
    target: "1",
    confirmedPeriodCollection: "1",
    supportShares: config.supportShares,
    roundingQuantumVnd: config.roundingQuantumVnd,
  });
  for (const pm of pms) {
    const change = sum(
      adjustments
        .filter(
          (a) => a.recipient_type === "EMPLOYEE" && a.recipient_id === pm.id,
        )
        .map((a) => q(String(a.amount))),
    );
    pm.adjustment = exact(change);
    const net =
      pm.exactPayable === null ? null : add(q(pm.exactPayable), change);
    pm.netExactPayable = net ? exact(net) : null;
    pm.netPayable = net
      ? exact(
          net.n >= 0n
            ? q(ceilQuantum(net, BigInt(config.roundingQuantumVnd)))
            : net,
        )
      : null;
    pm.roundingDelta =
      net && net.n >= 0n ? exact(sub(q(pm.netPayable!), net)) : null;
    if (net && net.n < 0n) pm.settlementEligible = false;
  }
  const departments = Object.fromEntries(
    Object.entries(aggregate.support.departments).map(([key, value]) => {
      const delta = sum(
        adjustments
          .filter(
            (a) => a.recipient_type === "DEPARTMENT" && a.recipient_id === key,
          )
          .map((a) => q(String(a.amount))),
      );
      const net = add(q(value.exact), delta);
      const rounded =
        net.n >= 0n
          ? q(ceilQuantum(net, BigInt(config.roundingQuantumVnd)))
          : net;
      return [
        key,
        {
          ...value,
          adjustment: exact(delta),
          netExactPayable: exact(net),
          netPayable: exact(rounded),
          roundingDelta: exact(sub(rounded, net)),
        },
      ];
    }),
  );
  const pending = await rows(
    db,
    "SELECT id FROM adjustments WHERE tenant_id=$1 AND application_period_id=$2 AND status IN ('DRAFT','PENDING')",
    [user.tenantId, periodId],
  );
  const report = {
    period: {
      id: periodId,
      state: String(period.state),
      start: String(period.starts_on),
      end: String(period.ends_on),
    },
    configuration: config,
    lines,
    pms,
    support: {
      ...aggregate.support,
      departments,
      roundedTotal: exact(
        sum(Object.values(departments).map((d) => q(d.netPayable))),
      ),
      roundingDelta: exact(
        sum(Object.values(departments).map((d) => q(d.roundingDelta))),
      ),
    },
    companyEarned: aggregate.companyEarned,
    companyLossUnallocated: aggregate.companyLossUnallocated,
    adjustments,
    collectedCash: exact(sum(lines.map((l) => q(l.collectedCash)))),
    collectedRevenue: exact(sum(lines.map((l) => q(l.collectedRevenue)))),
    calculatedPm: exact(sum(pms.map((p) => q(p.calculated)))),
    earnedPm: exact(sum(pms.map((p) => q(p.earned)))),
    payablePm: exact(sum(pms.map((p) => q(p.netPayable ?? "0")))),
    canLock:
      pending.length === 0 &&
      pms.every((p) => p.settlementEligible) &&
      Object.values(departments).every((d) => q(d.netPayable).n >= 0n),
    warnings: [
      ...new Set([
        ...lines.flatMap((l) => l.closing.warnings),
        ...(pending.length ? ["PENDING_ADJUSTMENT_APPROVAL"] : []),
      ]),
    ],
  };
  return scopedReport(report, user);
}
type PmResult = ReturnType<typeof finalizeBonus>["pm"] & {
  id: string;
  name: string;
  target: string | null;
  collectedRevenue: string;
  warnings: string[];
  settlementEligible: boolean;
  adjustment?: string;
  netPayable?: string | null;
  netExactPayable?: string | null;
};
export interface Report {
  period: { id: string; state: string; start: string; end: string };
  configuration: Configuration;
  lines: ReportLine[];
  pms: PmResult[];
  support: {
    earned: string;
    roundedTotal: string;
    roundingDelta: string;
    departments: Record<
      string,
      {
        exact: string;
        rounded: string;
        roundingDelta: string;
        adjustment: string;
        netPayable: string;
        netExactPayable: string;
      }
    >;
  };
  companyEarned: string;
  companyLossUnallocated: string;
  adjustments: Row[];
  collectedCash: string;
  collectedRevenue: string;
  calculatedPm: string;
  earnedPm: string;
  payablePm: string;
  canLock: boolean;
  warnings: string[];
}
function scopedReport(report: Report, user: User): Report {
  const copy = structuredClone(report);
  if (user.role === "PM") {
    copy.lines = copy.lines.filter((l) => l.pmId === user.employeeId);
    copy.pms = copy.pms.filter((p) => p.id === user.employeeId);
    copy.adjustments = copy.adjustments.filter(
      (a) =>
        a.recipient_type === "EMPLOYEE" && a.recipient_id === user.employeeId,
    );
    copy.support = {
      earned: "0",
      roundedTotal: "0",
      roundingDelta: "0",
      departments: {},
    };
    copy.companyEarned = "0";
    copy.companyLossUnallocated = "0";
    copy.collectedCash = exact(sum(copy.lines.map((l) => q(l.collectedCash))));
    copy.collectedRevenue = exact(
      sum(copy.lines.map((l) => q(l.collectedRevenue))),
    );
    copy.calculatedPm = exact(sum(copy.pms.map((p) => q(p.calculated))));
    copy.earnedPm = exact(sum(copy.pms.map((p) => q(p.earned))));
    copy.payablePm = exact(
      sum(copy.pms.map((p) => q(p.netPayable ?? p.payable ?? "0"))),
    );
  }
  if (user.role === "SUPPORT_MANAGER") {
    copy.lines = [];
    copy.pms = [];
    copy.adjustments = copy.adjustments.filter(
      (a) => a.recipient_type === "DEPARTMENT",
    );
    copy.calculatedPm = "0";
    copy.earnedPm = "0";
    copy.payablePm = "0";
    copy.companyEarned = "0";
    copy.companyLossUnallocated = "0";
  }
  return copy;
}
export async function setPeriodState(
  db: PGlite,
  user: User,
  periodId: string,
  input: Record<string, unknown>,
) {
  requireRoles(user, ["ADMIN", "ACCOUNTING"]);
  const action = text(input.action, "Thao tác");
  return db.transaction(async (tx) => {
    const period = await one(
      tx,
      "SELECT * FROM calculation_periods WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
      [user.tenantId, periodId],
    );
    if (!period) throw new AppError(404, "Không tìm thấy kỳ.");
    if (action === "review") {
      if (period.state !== "OPEN") throw new AppError(409, "Chỉ review kỳ mở.");
      if (
        await one(
          tx,
          "SELECT id FROM calculation_periods WHERE tenant_id=$1 AND starts_on<$2 AND state IN ('OPEN','REVIEW') LIMIT 1",
          [user.tenantId, period.starts_on],
        )
      )
        throw new AppError(
          409,
          "Đối soát và khóa các kỳ trước trước khi đóng kỳ này.",
        );
      if (!(await periodReport(tx, user, periodId)).canLock)
        throw new AppError(
          409,
          "Hoàn tất chỉ tiêu, duyệt chi phí và xử lý khoản thu hồi trước khi đối soát.",
        );
      await tx.query(
        "UPDATE calculation_periods SET state='REVIEW',revision=revision+1 WHERE tenant_id=$1 AND id=$2",
        [user.tenantId, periodId],
      );
      await audit(
        tx,
        user,
        "PERIOD_REVIEW",
        "PERIOD",
        periodId,
        { state: "OPEN" },
        { state: "REVIEW" },
      );
      return { state: "REVIEW" };
    }
    if (action !== "lock" || period.state !== "REVIEW")
      throw new AppError(409, "Kỳ phải ở REVIEW trước khi khóa.");
    const report = await periodReport(tx, user, periodId);
    if (!report.canLock)
      throw new AppError(
        409,
        "Chưa đủ điều kiện khóa: kiểm tra chỉ tiêu, chi phí duyệt hoặc khoản thu hồi.",
      );
    if (report.warnings.length && input.acknowledgeWarnings !== true)
      throw new AppError(
        409,
        "Cần xác nhận đã xem các cảnh báo trước khi khóa.",
      );
    const lockedAt = new Date().toISOString();
    const full = { ...report, period: { ...report.period, state: "LOCKED" } };
    for (const pm of report.pms) {
      const calcId = id();
      await tx.query(
        "INSERT INTO bonus_calculations(tenant_id,id,period_id,employee_id,engine_version,input_hash,calculated_exact,earned_exact,payable_exact,rounding_delta_exact,trace) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
        [
          user.tenantId,
          calcId,
          periodId,
          pm.id,
          "local-app-0.2",
          createHash("sha256").update(JSON.stringify(full)).digest("hex"),
          pm.calculated,
          pm.earned,
          pm.netPayable,
          pm.roundingDelta,
          JSON.stringify(pm),
        ],
      );
      for (const line of report.lines.filter((l) => l.pmId === pm.id))
        await tx.query(
          "INSERT INTO bonus_calculation_lines(tenant_id,id,period_id,calculation_id,order_item_id,trace) VALUES ($1,$2,$3,$4,$5,$6)",
          [
            user.tenantId,
            id(),
            periodId,
            calcId,
            line.itemId,
            JSON.stringify(line),
          ],
        );
    }
    const recipients = [
      ...report.pms.map((p) => ({ type: "EMPLOYEE", id: p.id, snapshot: p })),
      ...Object.entries(report.support.departments).map(([key, value]) => ({
        type: "DEPARTMENT",
        id: key,
        snapshot: value,
      })),
      { type: "COMPANY", id: "COMPANY", snapshot: full },
    ];
    const settlementIds = new Map<string, string>();
    for (const r of recipients) {
      const settlementId = id();
      settlementIds.set(r.type + ":" + r.id, settlementId);
      const serialized = JSON.stringify(r.snapshot);
      await tx.query(
        "INSERT INTO settlements(tenant_id,id,period_id,recipient_type,recipient_id,immutable_snapshot,snapshot_hash,locked_by,locked_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [
          user.tenantId,
          settlementId,
          periodId,
          r.type,
          r.id,
          serialized,
          createHash("sha256").update(serialized).digest("hex"),
          user.id,
          lockedAt,
        ],
      );
    }
    for (const adjustment of report.adjustments) {
      const settlement = settlementIds.get(
        String(adjustment.recipient_type) +
          ":" +
          String(adjustment.recipient_id),
      );
      if (!settlement)
        throw new AppError(409, "Thiếu người nhận để áp dụng điều chỉnh.");
      await tx.query(
        "INSERT INTO adjustment_applications(tenant_id,adjustment_id,settlement_id,applied_at) VALUES ($1,$2,$3,$4)",
        [user.tenantId, adjustment.id, settlement, lockedAt],
      );
    }
    await tx.query(
      "UPDATE calculation_periods SET state='LOCKED',locked_by=$3,locked_at=$4,revision=revision+1 WHERE tenant_id=$1 AND id=$2",
      [user.tenantId, periodId, user.id, lockedAt],
    );
    await audit(
      tx,
      user,
      "SETTLEMENT_LOCKED",
      "PERIOD",
      periodId,
      { state: "REVIEW" },
      full,
    );
    return { state: "LOCKED" };
  });
}
export async function payPeriod(
  db: PGlite,
  user: User,
  periodId: string,
  input: Record<string, unknown>,
) {
  requireRoles(user, ["ADMIN", "ACCOUNTING"]);
  const evidence = text(input.evidence, "Tham chiếu chi trả");
  return db.transaction(async (tx) => {
    const period = await one(
      tx,
      "SELECT state FROM calculation_periods WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
      [user.tenantId, periodId],
    );
    if (period?.state === "PAID") return { alreadyPaid: true };
    if (period?.state !== "LOCKED")
      throw new AppError(409, "Chỉ chi trả kỳ đã khóa.");
    for (const s of await rows(
      tx,
      "SELECT * FROM settlements WHERE tenant_id=$1 AND period_id=$2 AND recipient_type<>'COMPANY'",
      [user.tenantId, periodId],
    )) {
      const data = s.immutable_snapshot as Record<string, unknown>;
      const amount = String(data.netPayable ?? data.payable ?? "0");
      if (q(amount).n > 0n) {
        await tx.query(
          "INSERT INTO settlement_payouts(tenant_id,id,settlement_id,amount,paid_by,paid_at,evidence_reference) VALUES ($1,$2,$3,$4,$5,now(),$6)",
          [
            user.tenantId,
            id(),
            s.id,
            integer(amount, "Số tiền chi trả"),
            user.id,
            evidence,
          ],
        );
      }
    }
    await tx.query(
      "UPDATE calculation_periods SET state='PAID',revision=revision+1 WHERE tenant_id=$1 AND id=$2",
      [user.tenantId, periodId],
    );
    await audit(
      tx,
      user,
      "SETTLEMENT_PAID",
      "PERIOD",
      periodId,
      { state: "LOCKED" },
      { state: "PAID", evidence },
    );
    return { state: "PAID" };
  });
}
export async function refundAdjustment(
  db: PGlite,
  user: User,
  input: Record<string, unknown>,
) {
  requireRoles(user, ["ADMIN", "ACCOUNTING"]);
  const sourceId = text(input.settlementId, "Quyết toán gốc"),
    periodId = text(input.applicationPeriodId, "Kỳ áp dụng"),
    orderId = text(input.orderId, "Đơn hàng"),
    refund = integer(input.refundAmount, "Tiền hoàn", true),
    recovery = integer(input.recoveryAmount, "Thưởng thu hồi", true),
    reason = text(input.reason, "Lý do"),
    evidence = text(input.evidence, "Chứng từ"),
    date = validDate(input.date);
  return db.transaction(async (tx) => {
    const source = await one(
      tx,
      "SELECT s.*,p.state,p.ends_on AS source_end FROM settlements s JOIN calculation_periods p ON (p.tenant_id=s.tenant_id AND p.id=s.period_id) WHERE s.tenant_id=$1 AND s.id=$2",
      [user.tenantId, sourceId],
    );
    if (
      !source ||
      source.state !== "PAID" ||
      source.recipient_type === "COMPANY"
    )
      throw new AppError(
        409,
        "Cần quyết toán đã chi trả của người/bộ phận nhận thưởng.",
      );
    const app = await one(
      tx,
      "SELECT state,starts_on,ends_on FROM calculation_periods WHERE tenant_id=$1 AND id=$2",
      [user.tenantId, periodId],
    );
    if (app?.state !== "OPEN" || source.period_id === periodId)
      throw new AppError(409, "Chọn kỳ mở khác kỳ đã chi trả.");
    if (
      date < String(app.starts_on) ||
      date >= String(app.ends_on) ||
      date < String(source.source_end)
    )
      throw new AppError(
        400,
        "Ngày hoàn phải thuộc kỳ áp dụng và sau kỳ nguồn.",
      );
    const original = await one(
      tx,
      "SELECT immutable_snapshot FROM settlements WHERE tenant_id=$1 AND period_id=$2 AND recipient_type='COMPANY'",
      [user.tenantId, source.period_id],
    );
    const report = original!.immutable_snapshot as Report;
    if (
      !report.lines.some(
        (l) =>
          l.orderId === orderId &&
          (source.recipient_type === "DEPARTMENT" ||
            l.pmId === source.recipient_id),
      )
    )
      throw new AppError(400, "Đơn hàng không thuộc quyết toán nguồn.");
    const paid = await one(
      tx,
      "SELECT COALESCE(sum(amount),0)::text AS total FROM settlement_payouts WHERE tenant_id=$1 AND settlement_id=$2",
      [user.tenantId, sourceId],
    );
    const allocated = await one(
      tx,
      "SELECT COALESCE(-sum(amount),0)::text AS total FROM adjustments WHERE tenant_id=$1 AND source_settlement_id=$2 AND status IN ('DRAFT','PENDING','APPROVED')",
      [user.tenantId, sourceId],
    );
    if (
      BigInt(recovery) + BigInt(String(allocated?.total ?? "0")) >
      BigInt(String(paid?.total ?? "0"))
    )
      throw new AppError(400, "Thu hồi vượt số thưởng đã nhận còn lại.");
    const refundId = id(),
      adjustmentId = id();
    await tx.query(
      "INSERT INTO refund_records(tenant_id,id,order_id,source_settlement_id,amount,refund_date,reason,evidence_reference,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [
        user.tenantId,
        refundId,
        orderId,
        sourceId,
        refund,
        date,
        reason,
        evidence,
        user.id,
      ],
    );
    await tx.query(
      "INSERT INTO adjustments(tenant_id,id,source_period_id,application_period_id,source_settlement_id,amount,currency,reason,related_entity,status,created_by) VALUES ($1,$2,$3,$4,$5,$6,'VND',$7,$8,'PENDING',$9)",
      [
        user.tenantId,
        adjustmentId,
        source.period_id,
        periodId,
        sourceId,
        "-" + recovery,
        reason,
        "REFUND:" + refundId,
        user.id,
      ],
    );
    await audit(
      tx,
      user,
      "REFUND_AFTER_LOCK_RECORDED",
      "ADJUSTMENT",
      adjustmentId,
      null,
      {
        refundId,
        refund,
        recovery,
        sourceId,
        periodId,
        warning: "REFUND_AFTER_LOCK_REQUIRES_ADJUSTMENT",
      },
      reason,
    );
    return { id: adjustmentId, warning: "Cần Giám đốc/Admin duyệt cấn trừ." };
  });
}
export async function approveRecovery(
  db: PGlite,
  user: User,
  adjustmentId: string,
  input: Record<string, unknown>,
) {
  requireRoles(user, ["ADMIN", "EXECUTIVE"]);
  return db.transaction(async (tx) => {
    const adjustment = await one(
      tx,
      "SELECT * FROM adjustments WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
      [user.tenantId, adjustmentId],
    );
    if (!adjustment) throw new AppError(404, "Không tìm thấy điều chỉnh.");
    if (adjustment.status === "APPROVED") return { alreadyApproved: true };
    if (adjustment.status !== "PENDING" && adjustment.status !== "DRAFT")
      throw new AppError(409, "Đề nghị đã được xử lý.");
    const applicationPeriodId = input.applicationPeriodId
      ? text(input.applicationPeriodId, "Kỳ áp dụng")
      : String(adjustment.application_period_id);
    const period = await one(
      tx,
      "SELECT state,starts_on FROM calculation_periods WHERE tenant_id=$1 AND id=$2",
      [user.tenantId, applicationPeriodId],
    );
    const originalPeriod = await one(
      tx,
      "SELECT ends_on FROM calculation_periods WHERE tenant_id=$1 AND id=$2",
      [user.tenantId, adjustment.source_period_id],
    );
    if (!period || String(period.starts_on) < String(originalPeriod?.ends_on))
      throw new AppError(409, "Kỳ cấn trừ phải sau kỳ nguồn.");
    if (period.state !== "OPEN") throw new AppError(409, "Kỳ áp dụng phải mở.");
    const amount = input.recoveryAmount
      ? "-" + integer(input.recoveryAmount, "Số thưởng thu hồi", true)
      : String(adjustment.amount);
    const reason = input.reason
      ? text(input.reason, "Lý do")
      : String(adjustment.reason);
    const paid = await one(
      tx,
      "SELECT COALESCE(sum(amount),0)::text AS total FROM settlement_payouts WHERE tenant_id=$1 AND settlement_id=$2",
      [user.tenantId, adjustment.source_settlement_id],
    );
    const others = await one(
      tx,
      "SELECT COALESCE(-sum(amount),0)::text AS total FROM adjustments WHERE tenant_id=$1 AND source_settlement_id=$2 AND id<>$3 AND status IN ('DRAFT','PENDING','APPROVED')",
      [user.tenantId, adjustment.source_settlement_id, adjustmentId],
    );
    if (
      -BigInt(amount) + BigInt(String(others?.total ?? "0")) >
      BigInt(String(paid?.total ?? "0"))
    )
      throw new AppError(409, "Tổng thu hồi vượt số thưởng đã nhận.");
    await tx.query(
      "UPDATE adjustments SET amount=$3,reason=$4,status='APPROVED',approved_by=$5,approved_at=now(),application_period_id=$6 WHERE tenant_id=$1 AND id=$2",
      [
        user.tenantId,
        adjustmentId,
        amount,
        reason,
        user.id,
        applicationPeriodId,
      ],
    );
    await audit(
      tx,
      user,
      "ADJUSTMENT_APPROVED",
      "ADJUSTMENT",
      adjustmentId,
      adjustment,
      { amount, reason, status: "APPROVED", applicationPeriodId },
      reason,
    );
    return { id: adjustmentId };
  });
}
export async function dashboard(db: Db, user: User, periodId: string | null) {
  const config = await configuration(db, user);
  const orders = await rows(
    db,
    "SELECT o.id,i.canonical_input,o.order_date FROM orders o JOIN order_items i ON (o.tenant_id=i.tenant_id AND o.id=i.order_id) WHERE o.tenant_id=$1 AND ($2<>'PM' OR o.pm_id=$3)",
    [user.tenantId, user.role, user.employeeId],
  );
  let report: Report | null = null;
  if (periodId) report = await periodReport(db, user, periodId);
  const cohort = orders.filter(
    (o) =>
      !report ||
      (String(o.order_date) >= report.period.start &&
        String(o.order_date) < report.period.end),
  );
  const sales = exact(
    sum(
      cohort.map((o) => {
        const item = o.canonical_input as StoredInput;
        return (report?.configuration ?? config)?.revenueBasis ===
          "EXCLUDING_VAT"
          ? div(q(item.cashNet), add(q("1"), q(item.vatRate)))
          : q(item.cashNet);
      }),
    ),
  );
  const cohortCollected = report
    ? exact(
        sum(
          report.lines
            .filter((l) => cohort.some((o) => o.id === l.orderId))
            .map((l) => {
              const input = l.sourceInput;
              const eligible = q(l.closing.collectedEligible);
              const cash =
                input.economicBasis === "EXCLUDING_VAT"
                  ? mul(eligible, add(q("1"), q(input.vatRate)))
                  : eligible;
              return report.configuration.revenueBasis === "EXCLUDING_VAT"
                ? div(cash, add(q("1"), q(input.vatRate)))
                : cash;
            }),
        ),
      )
    : "0";
  return {
    configuration: config,
    report,
    salesValue: sales,
    cohortCollected,
    collectionRate:
      q(sales).n === 0n ? "0" : exact(div(q(cohortCollected), q(sales))),
    outstanding: exact(sub(q(sales), q(cohortCollected))),
    orderCount: new Set(orders.map((o) => o.id)).size,
    allNetSales: exact(
      sum(orders.map((o) => q((o.canonical_input as StoredInput).revenueNet))),
    ),
    integration: {
      status: "NOT_CONNECTED",
      label: "Chưa xác minh kết nối AMIS",
      historicalStatus: "WORKBOOK_MISSING",
    },
    localMode: true,
  };
}
export async function rejectRecovery(
  db: PGlite,
  user: User,
  adjustmentId: string,
  input: Record<string, unknown>,
) {
  requireRoles(user, ["ADMIN", "EXECUTIVE"]);
  const reason = text(input.reason, "Lý do từ chối");
  return db.transaction(async (tx) => {
    const adjustment = await one(
      tx,
      "SELECT * FROM adjustments WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
      [user.tenantId, adjustmentId],
    );
    if (!adjustment) throw new AppError(404, "Không tìm thấy điều chỉnh.");
    if (adjustment.status !== "PENDING" && adjustment.status !== "DRAFT")
      throw new AppError(409, "Chỉ từ chối điều chỉnh chưa duyệt.");
    const period = await one(
      tx,
      "SELECT state FROM calculation_periods WHERE tenant_id=$1 AND id=$2",
      [user.tenantId, adjustment.application_period_id],
    );
    if (period?.state !== "OPEN")
      throw new AppError(409, "Kỳ áp dụng phải mở.");
    await tx.query(
      "UPDATE adjustments SET status='REJECTED' WHERE tenant_id=$1 AND id=$2",
      [user.tenantId, adjustmentId],
    );
    await audit(
      tx,
      user,
      "ADJUSTMENT_REJECTED",
      "ADJUSTMENT",
      adjustmentId,
      adjustment,
      { status: "REJECTED" },
      reason,
    );
    return { id: adjustmentId };
  });
}
