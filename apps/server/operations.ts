import type { PGlite } from "@electric-sql/pglite";
import { hashPassword, passwordInput } from "./auth.js";
import {
  AppError,
  one,
  rows,
  id,
  integer,
  text,
  object,
  audit,
  requireRoles,
  type Db,
  type User,
} from "./database.js";
import {
  configuration,
  validDate,
  type Configuration,
} from "./configuration.js";
import {
  effectiveChain,
  managementSnapshot,
  bonusSnapshot,
} from "./catalog.js";
import {
  q,
  add,
  sub,
  mul,
  div,
  exact,
  compare,
  allocatePayment,
  type ItemInput,
} from "../../packages/domain/index.js";
export type StoredInput = ItemInput & {
  vatRate: string;
  cashNet: string;
  configuration: Configuration & { id: string; version: number };
  revenueNet: string;
  priceVersionId: string;
};
export async function writableDate(db: Db, user: User, date: string) {
  const period = await one(
    db,
    "SELECT * FROM calculation_periods WHERE tenant_id=$1 AND starts_on<=$2 AND ends_on>$2",
    [user.tenantId, date],
  );
  if (!period)
    throw new AppError(409, "Tạo kỳ tính thưởng bao phủ ngày giao dịch trước.");
  if (period.state !== "OPEN")
    throw new AppError(
      409,
      "Ngày giao dịch thuộc kỳ đã đóng hoặc đang review. Dùng điều chỉnh tại kỳ mở.",
    );
}
export async function assertOrderAccess(db: Db, user: User, orderId: string) {
  const order = await one(
    db,
    "SELECT * FROM orders WHERE tenant_id=$1 AND id=$2",
    [user.tenantId, orderId],
  );
  if (!order) throw new AppError(404, "Không tìm thấy đơn hàng.");
  if (user.role === "PM" && order.pm_id !== user.employeeId)
    throw new AppError(403, "Chỉ được xem đơn hàng của bạn.");
  return order;
}
export async function staff(db: Db, user: User) {
  return rows(
    db,
    "SELECT e.*,u.role FROM employees e LEFT JOIN app_users u ON (e.tenant_id=u.tenant_id AND e.user_id=u.id) WHERE e.tenant_id=$1 AND ($2<>'PM' OR e.id=$3) ORDER BY e.name",
    [user.tenantId, user.role, user.employeeId],
  );
}
export async function createEmployee(
  db: PGlite,
  user: User,
  input: Record<string, unknown>,
) {
  requireRoles(user, ["ADMIN", "EXECUTIVE"]);
  const name = text(input.name, "Tên nhân sự"),
    code = text(input.code, "Mã nhân sự");
  return db.transaction(async (tx) => {
    let userId: string | null = null;
    if (input.login) {
      const login = text(input.login, "Tên đăng nhập").toLowerCase();
      const role = text(input.role, "Vai trò");
      if (
        ![
          "ADMIN",
          "ACCOUNTING",
          "PM",
          "SALES_MANAGER",
          "SUPPORT_MANAGER",
          "EXECUTIVE",
          "AUDITOR",
        ].includes(role)
      )
        throw new AppError(400, "Vai trò không hợp lệ.");
      const password = passwordInput(input.password);
      userId = id();
      await tx.query(
        "INSERT INTO app_users(tenant_id,id,name,role) VALUES ($1,$2,$3,$4)",
        [user.tenantId, userId, name, role],
      );
      await tx.query(
        "INSERT INTO auth_credentials(tenant_id,user_id,login,password_hash) VALUES ($1,$2,$3,$4)",
        [user.tenantId, userId, login, hashPassword(password)],
      );
    }
    const employeeId = id();
    await tx.query(
      "INSERT INTO employees(tenant_id,id,code,name,user_id) VALUES ($1,$2,$3,$4,$5)",
      [user.tenantId, employeeId, code, name, userId],
    );
    await audit(tx, user, "EMPLOYEE_CREATED", "EMPLOYEE", employeeId, null, {
      name,
      code,
      hasAccount: !!userId,
    });
    return { id: employeeId };
  });
}
export async function createPeriod(
  db: PGlite,
  user: User,
  input: Record<string, unknown>,
) {
  requireRoles(user, ["ADMIN", "ACCOUNTING"]);
  const start = validDate(input.start),
    end = validDate(input.end),
    name = text(input.id, "Mã kỳ");
  if (end <= start)
    throw new AppError(400, "Ngày kết thúc phải sau ngày bắt đầu.");
  const config = await configuration(db, user);
  if (!config) throw new AppError(409, "Thiết lập quy tắc trước khi tạo kỳ.");
  return db.transaction(async (tx) => {
    if (
      await one(
        tx,
        "SELECT id FROM calculation_periods WHERE tenant_id=$1 AND starts_on<$3 AND ends_on>$2",
        [user.tenantId, start, end],
      )
    )
      throw new AppError(409, "Kỳ bị trùng khoảng thời gian.");
    await tx.query(
      "INSERT INTO calculation_periods(tenant_id,id,starts_on,ends_on,business_timezone,state,configuration_snapshot) VALUES ($1,$2,$3,$4,$5,'OPEN',$6)",
      [
        user.tenantId,
        name,
        start,
        end,
        config.timezone,
        JSON.stringify(config),
      ],
    );
    await audit(tx, user, "PERIOD_CREATED", "PERIOD", name, null, {
      start,
      end,
      timezone: config.timezone,
    });
    return { id: name };
  });
}
export async function saveTarget(
  db: PGlite,
  user: User,
  input: Record<string, unknown>,
) {
  requireRoles(user, ["ADMIN", "EXECUTIVE"]);
  const employeeId = text(input.employeeId, "Nhân sự"),
    periodId = text(input.periodId, "Kỳ"),
    amount = integer(input.amount, "Chỉ tiêu", true);
  return db.transaction(async (tx) => {
    const period = await one(
      tx,
      "SELECT state FROM calculation_periods WHERE tenant_id=$1 AND id=$2",
      [user.tenantId, periodId],
    );
    if (period?.state !== "OPEN")
      throw new AppError(409, "Chỉ thay đổi chỉ tiêu ở kỳ mở.");
    const prior = await one(
      tx,
      "SELECT * FROM employee_targets WHERE tenant_id=$1 AND employee_id=$2 AND period_id=$3 ORDER BY version DESC LIMIT 1",
      [user.tenantId, employeeId, periodId],
    );
    const targetId = id();
    await tx.query(
      "INSERT INTO employee_targets(tenant_id,id,employee_id,period_id,type,amount,currency,version,created_by) VALUES ($1,$2,$3,$4,'COLLECTED_REVENUE',$5,'VND',$6,$7)",
      [
        user.tenantId,
        targetId,
        employeeId,
        periodId,
        amount,
        Number(prior?.version ?? 0) + 1,
        user.id,
      ],
    );
    await audit(tx, user, "TARGET_VERSION_CREATED", "TARGET", targetId, prior, {
      employeeId,
      periodId,
      amount,
    });
    return { id: targetId };
  });
}
export async function orderList(db: Db, user: User) {
  return rows(
    db,
    `SELECT o.*,c.name AS customer_name,e.name AS pm_name,COALESCE((SELECT sum(i.net_sales_value_source) FROM order_items i WHERE i.tenant_id=o.tenant_id AND i.order_id=o.id),0)::text AS cash_net,COALESCE((SELECT sum(p.amount) FROM payments p WHERE p.tenant_id=o.tenant_id AND p.order_id=o.id AND p.status='CONFIRMED' AND NOT EXISTS (SELECT 1 FROM financial_events f WHERE f.tenant_id=p.tenant_id AND f.entity_id=p.id AND f.event_type='PAYMENT_REVERSED')),0)::text AS confirmed_cash,(SELECT count(*) FROM payments p WHERE p.tenant_id=o.tenant_id AND p.order_id=o.id AND p.status='DRAFT')::text AS draft_count FROM orders o JOIN customers c ON (c.tenant_id=o.tenant_id AND c.id=o.customer_id) LEFT JOIN employees e ON (e.tenant_id=o.tenant_id AND e.id=o.pm_id) WHERE o.tenant_id=$1 AND ($2<>'PM' OR o.pm_id=$3) ORDER BY o.order_date DESC,o.order_number`,
    [user.tenantId, user.role, user.employeeId],
  );
}
export async function orderDetail(db: Db, user: User, orderId: string) {
  await assertOrderAccess(db, user, orderId);
  return {
    order: (await orderList(db, user)).find((o) => o.id === orderId),
    items: await rows(
      db,
      "SELECT i.*,p.name AS product_name FROM order_items i JOIN products p ON (p.tenant_id=i.tenant_id AND p.id=i.product_id) WHERE i.tenant_id=$1 AND order_id=$2",
      [user.tenantId, orderId],
    ),
    payments: await rows(
      db,
      `SELECT p.*,EXISTS(SELECT 1 FROM financial_events f WHERE f.tenant_id=p.tenant_id AND f.entity_id=p.id AND f.event_type='PAYMENT_REVERSED') AS is_reversed FROM payments p WHERE p.tenant_id=$1 AND order_id=$2 ORDER BY payment_date,created_at`,
      [user.tenantId, orderId],
    ),
    expenses: await rows(
      db,
      "SELECT * FROM pool_expenses WHERE tenant_id=$1 AND order_id=$2",
      [user.tenantId, orderId],
    ),
  };
}
export async function createOrder(
  db: PGlite,
  user: User,
  input: Record<string, unknown>,
) {
  requireRoles(user, ["ADMIN", "ACCOUNTING", "SALES_MANAGER"]);
  const config = await configuration(db, user);
  if (!config) throw new AppError(409, "Cần cấu hình quy tắc tài chính trước.");
  const date = validDate(input.date),
    number = text(input.number, "Số đơn"),
    customerName = text(input.customerName, "Khách hàng"),
    pmId = text(input.pmId, "PM");
  if (
    !Array.isArray(input.items) ||
    input.items.length === 0 ||
    input.items.length > 100
  )
    throw new AppError(400, "Đơn hàng cần 1–100 sản phẩm.");
  const itemInputs = input.items as unknown[];
  return db.transaction(async (tx) => {
    await writableDate(tx, user, date);
    const activePeriod = await one(
      tx,
      "SELECT configuration_snapshot FROM calculation_periods WHERE tenant_id=$1 AND starts_on<=$2 AND ends_on>$2",
      [user.tenantId, date],
    );
    const orderConfig = activePeriod!
      .configuration_snapshot as Configuration & {
      id: string;
      version: number;
    };
    if (
      await one(
        tx,
        "SELECT id FROM orders WHERE tenant_id=$1 AND order_number=$2",
        [user.tenantId, number],
      )
    )
      throw new AppError(409, "Số đơn đã tồn tại.");
    if (
      !(await one(
        tx,
        "SELECT id FROM employees WHERE tenant_id=$1 AND id=$2 AND active=true",
        [user.tenantId, pmId],
      ))
    )
      throw new AppError(400, "PM không hợp lệ.");
    let customer = await one(
      tx,
      "SELECT id FROM customers WHERE tenant_id=$1 AND name=$2",
      [user.tenantId, customerName],
    );
    if (!customer) {
      customer = { id: id() };
      await tx.query(
        "INSERT INTO customers(tenant_id,id,name) VALUES ($1,$2,$3)",
        [user.tenantId, customer.id, customerName],
      );
    }
    const orderId = id();
    await tx.query(
      "INSERT INTO orders(tenant_id,id,order_number,customer_id,pm_id,order_date,currency,source_status,source_revision,entry_source) VALUES ($1,$2,$3,$4,$5,$6,'VND','MANUAL_FINALIZED','1','MANUAL')",
      [user.tenantId, orderId, number, customer.id, pmId, date],
    );
    const bonus = await bonusSnapshot(tx, user, date);
    for (const raw of itemInputs) {
      const line = object(raw),
        productId = text(line.productId, "Sản phẩm"),
        quantity = integer(line.quantity, "Số lượng", true),
        discount = integer(line.discountAmount, "Chiết khấu");
      const product = await one(
        tx,
        "SELECT * FROM products WHERE tenant_id=$1 AND id=$2 AND active=true",
        [user.tenantId, productId],
      );
      if (!product) throw new AppError(400, "Sản phẩm không hợp lệ.");
      const prices = effectiveChain(
        await rows(
          tx,
          "SELECT * FROM product_price_versions WHERE tenant_id=$1 AND product_id=$2 AND status='APPROVED'",
          [user.tenantId, productId],
        ),
      );
      const selected = prices.filter(
        (p) =>
          String(p.effective_from) <= date &&
          (!p.effective_to || date < String(p.effective_to)),
      );
      if (selected.length !== 1)
        throw new AppError(409, "Cần giá niêm yết đã duyệt tại ngày đơn hàng.");
      const price = selected[0]!,
        factor = add(q("1"), q(String(price.vat_rate)));
      const cashUnit =
        price.tax_basis === "INCLUDING_VAT"
          ? q(String(price.input_amount))
          : mul(q(String(price.input_amount)), factor);
      const cashGross = mul(cashUnit, q(quantity)),
        cashNet = sub(cashGross, q(discount));
      if (cashGross.d !== 1n || cashNet.d !== 1n || cashNet.n <= 0n)
        throw new AppError(
          400,
          "Giá/chiết khấu phải cho giá trị thu tiền nguyên đồng và dương.",
        );
      const poolUnit =
          orderConfig.poolBasis === "INCLUDING_VAT"
            ? cashUnit
            : div(cashUnit, factor),
        poolDiscount =
          orderConfig.poolBasis === "INCLUDING_VAT"
            ? q(discount)
            : div(q(discount), factor),
        poolNet =
          orderConfig.poolBasis === "INCLUDING_VAT"
            ? cashNet
            : div(cashNet, factor);
      const snapshot = await managementSnapshot(tx, user, product, date);
      const itemId = id();
      const canonical: StoredInput = {
        id: itemId,
        currency: "VND",
        quantity,
        listUnitValue: exact(poolUnit),
        discountAmount: exact(poolDiscount),
        netSalesValue: exact(poolNet),
        poolSnapshot: snapshot,
        economicBasis: orderConfig.poolBasis,
        expenses: [],
        bonusPolicy: bonus,
        recognitionStrategy: orderConfig.recognition,
        payments: [],
        vatRate: String(price.vat_rate),
        cashNet: exact(cashNet),
        revenueNet: exact(
          orderConfig.revenueBasis === "EXCLUDING_VAT"
            ? div(cashNet, factor)
            : cashNet,
        ),
        configuration: orderConfig,
        priceVersionId: String(price.id),
      };
      await tx.query(
        "INSERT INTO order_items(tenant_id,id,order_id,product_id,quantity,gross_list_value_source,discount_amount_source,net_sales_value_source,price_version_id,pool_policy_id,pool_policy_version,pool_rate_snapshot,price_snapshot,effective_context,canonical_input) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)",
        [
          user.tenantId,
          itemId,
          orderId,
          productId,
          quantity,
          exact(cashGross),
          discount,
          exact(cashNet),
          price.id,
          snapshot.policyId,
          snapshot.policyVersion,
          String(
            (
              await one(
                tx,
                "SELECT pool_rate FROM management_pool_policies WHERE tenant_id=$1 AND id=$2",
                [user.tenantId, snapshot.policyId],
              )
            )?.pool_rate,
          ),
          JSON.stringify(price),
          JSON.stringify({
            orderDate: date,
            configuration: orderConfig,
            source: "MANUAL",
          }),
          JSON.stringify(canonical),
        ],
      );
    }
    await audit(tx, user, "ORDER_FINALIZED", "ORDER", orderId, null, {
      number,
      date,
      customerName,
      pmId,
      itemCount: itemInputs.length,
      source: "MANUAL",
    });
    return { id: orderId };
  });
}
export async function createPayment(
  db: PGlite,
  user: User,
  input: Record<string, unknown>,
) {
  requireRoles(user, ["ADMIN", "ACCOUNTING"]);
  const orderId = text(input.orderId, "Đơn hàng"),
    amount = integer(input.amount, "Số tiền", true),
    date = validDate(input.date),
    method = text(input.method, "Phương thức"),
    reference = text(input.reference, "Tham chiếu");
  return db.transaction(async (tx) => {
    await assertOrderAccess(tx, user, orderId);
    await writableDate(tx, user, date);
    const existing = await one(
      tx,
      "SELECT * FROM payments WHERE tenant_id=$1 AND order_id=$2 AND reference_number=$3",
      [user.tenantId, orderId, reference],
    );
    if (existing) {
      if (
        String(existing.amount) !== amount ||
        String(existing.payment_date) !== date
      )
        throw new AppError(409, "Tham chiếu đã dùng cho khoản thu khác.");
      return { id: String(existing.id), alreadyCreated: true };
    }
    const paymentId = id();
    await tx.query(
      "INSERT INTO payments(tenant_id,id,order_id,amount,currency,payment_date,method,reference_number,note,evidence_reference,status,created_by) VALUES ($1,$2,$3,$4,'VND',$5,$6,$7,$8,$9,'DRAFT',$10)",
      [
        user.tenantId,
        paymentId,
        orderId,
        amount,
        date,
        method,
        reference,
        typeof input.note === "string" ? input.note : "",
        typeof input.evidence === "string" ? input.evidence : null,
        user.id,
      ],
    );
    await audit(tx, user, "PAYMENT_CREATED", "PAYMENT", paymentId, null, {
      orderId,
      amount,
      date,
      method,
      reference,
    });
    return { id: paymentId };
  });
}
export async function confirmPayment(
  db: PGlite,
  user: User,
  paymentId: string,
  input: Record<string, unknown>,
) {
  requireRoles(user, ["ADMIN", "ACCOUNTING"]);
  return db.transaction(async (tx) => {
    const payment = await one(
      tx,
      "SELECT * FROM payments WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
      [user.tenantId, paymentId],
    );
    if (!payment) throw new AppError(404, "Không tìm thấy khoản thu.");
    if (payment.status === "CONFIRMED")
      return { id: paymentId, alreadyConfirmed: true };
    if (payment.status !== "DRAFT")
      throw new AppError(409, "Khoản thu không ở trạng thái nháp.");
    await writableDate(tx, user, String(payment.payment_date));
    const order = (await orderList(tx, user)).find(
      (o) => o.id === payment.order_id,
    )!;
    if (
      compare(
        add(q(String(order.confirmed_cash)), q(String(payment.amount))),
        q(String(order.cash_net)),
      ) > 0
    )
      throw new AppError(409, "Số tiền vượt giá trị còn phải thu.");
    const items = await rows(
      tx,
      "SELECT id,net_sales_value_source::text AS net FROM order_items WHERE tenant_id=$1 AND order_id=$2",
      [user.tenantId, payment.order_id],
    );
    let allocations = allocatePayment(
      BigInt(String(payment.amount)),
      items.map((i) => ({ id: String(i.id), net: BigInt(String(i.net)) })),
    );
    let reason: null | string = null;
    if (input.allocations !== undefined) {
      reason = text(input.reason, "Lý do phân bổ thủ công");
      if (
        !Array.isArray(input.allocations) ||
        input.allocations.length !== items.length
      )
        throw new AppError(400, "Phân bổ phải đủ các dòng đơn hàng.");
      allocations = input.allocations.map((raw) => {
        const row = object(raw);
        return {
          id: text(row.itemId, "Dòng đơn"),
          amount: BigInt(integer(row.amount, "Phân bổ")),
        };
      });
      if (
        new Set(allocations.map((a) => a.id)).size !== items.length ||
        allocations.some((a) => !items.some((i) => i.id === a.id)) ||
        allocations.reduce((s, a) => s + a.amount, 0n) !==
          BigInt(String(payment.amount))
      )
        throw new AppError(400, "Phân bổ không khớp số tiền và dòng đơn.");
    }
    for (const a of allocations) {
      const paid = await one(
        tx,
        `SELECT COALESCE(sum(a.amount),0)::text AS paid FROM payment_allocations a JOIN payments p ON (p.tenant_id=a.tenant_id AND p.id=a.payment_id) WHERE a.tenant_id=$1 AND a.order_item_id=$2 AND p.status='CONFIRMED' AND NOT EXISTS(SELECT 1 FROM financial_events f WHERE f.tenant_id=p.tenant_id AND f.entity_id=p.id AND f.event_type='PAYMENT_REVERSED')`,
        [user.tenantId, a.id],
      );
      if (
        a.amount + BigInt(String(paid?.paid ?? "0")) >
        BigInt(String(items.find((i) => i.id === a.id)!.net))
      )
        throw new AppError(
          409,
          "Phân bổ vượt số tiền còn lại của một sản phẩm.",
        );
      await tx.query(
        "INSERT INTO payment_allocations(tenant_id,order_id,payment_id,order_item_id,amount,allocation_method,override_reason) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [
          user.tenantId,
          payment.order_id,
          paymentId,
          a.id,
          a.amount.toString(),
          reason ? "MANUAL" : "PRO_RATA_BY_NET_VALUE",
          reason,
        ],
      );
    }
    await tx.query(
      "UPDATE payments SET status='CONFIRMED',confirmed_by=$3,confirmed_at=now() WHERE tenant_id=$1 AND id=$2",
      [user.tenantId, paymentId, user.id],
    );
    await audit(
      tx,
      user,
      "PAYMENT_CONFIRMED",
      "PAYMENT",
      paymentId,
      { status: "DRAFT" },
      {
        status: "CONFIRMED",
        amount: payment.amount,
        allocations: allocations.map((a) => ({
          id: a.id,
          amount: a.amount.toString(),
        })),
      },
      reason,
    );
    return { id: paymentId };
  });
}
export async function reversePayment(
  db: PGlite,
  user: User,
  paymentId: string,
  input: Record<string, unknown>,
) {
  requireRoles(user, ["ADMIN", "ACCOUNTING"]);
  const date = validDate(input.date),
    reason = text(input.reason, "Lý do đảo khoản thu");
  return db.transaction(async (tx) => {
    const p = await one(
      tx,
      "SELECT * FROM payments WHERE tenant_id=$1 AND id=$2 FOR UPDATE",
      [user.tenantId, paymentId],
    );
    if (!p || p.status !== "CONFIRMED")
      throw new AppError(409, "Chỉ đảo khoản thu đã xác nhận.");
    if (
      await one(
        tx,
        "SELECT id FROM financial_events WHERE tenant_id=$1 AND entity_id=$2 AND event_type='PAYMENT_REVERSED'",
        [user.tenantId, paymentId],
      )
    )
      return { alreadyReversed: true };
    await writableDate(tx, user, date);
    await writableDate(tx, user, String(p.payment_date));
    if (date < String(p.payment_date))
      throw new AppError(400, "Ngày đảo không thể trước ngày thu.");
    const eventId = id();
    await tx.query(
      "INSERT INTO financial_events(tenant_id,id,event_type,entity_id,immutable_payload,actor_id,occurred_at,idempotency_key) VALUES ($1,$2,'PAYMENT_REVERSED',$3,$4,$5,now(),$6)",
      [
        user.tenantId,
        eventId,
        paymentId,
        JSON.stringify({ date, reason, originalPayment: p }),
        user.id,
        "REVERSE:" + paymentId,
      ],
    );
    await audit(
      tx,
      user,
      "PAYMENT_REVERSED",
      "PAYMENT",
      paymentId,
      p,
      { eventId, date },
      reason,
    );
    return { id: eventId };
  });
}
export async function createExpense(
  db: PGlite,
  user: User,
  input: Record<string, unknown>,
) {
  requireRoles(user, ["ADMIN", "ACCOUNTING", "PM", "SALES_MANAGER"]);
  const orderId = text(input.orderId, "Đơn"),
    itemId = text(input.itemId, "Dòng đơn"),
    amount = integer(input.amount, "Chi phí", true),
    category = text(input.category, "Loại chi phí"),
    evidence = text(input.evidence, "Chứng từ");
  if (
    ![
      "MARKETING_SUPPORT",
      "DEALER_INCENTIVE",
      "SALES_INCENTIVE",
      "OTHER",
      "RESERVE",
    ].includes(category)
  )
    throw new AppError(400, "Loại chi phí không hợp lệ.");
  return db.transaction(async (tx) => {
    const order = await assertOrderAccess(tx, user, orderId);
    await writableDate(tx, user, String(order.order_date));
    if (
      !(await one(
        tx,
        "SELECT id FROM order_items WHERE tenant_id=$1 AND order_id=$2 AND id=$3",
        [user.tenantId, orderId, itemId],
      ))
    )
      throw new AppError(400, "Dòng đơn không hợp lệ.");
    const expenseId = id();
    await tx.query(
      "INSERT INTO pool_expenses(tenant_id,id,order_id,order_item_id,category,amount,source,evidence_reference,status,deductible,created_by) VALUES ($1,$2,$3,$4,$5,$6,'MANUAL',$7,'PENDING',true,$8)",
      [
        user.tenantId,
        expenseId,
        orderId,
        itemId,
        category,
        amount,
        evidence,
        user.id,
      ],
    );
    await audit(tx, user, "EXPENSE_CREATED", "EXPENSE", expenseId, null, {
      orderId,
      itemId,
      amount,
      category,
      evidence,
      basis: "ORDER_POOL_SNAPSHOT",
    });
    return { id: expenseId };
  });
}
export async function approveExpense(
  db: PGlite,
  user: User,
  expenseId: string,
) {
  requireRoles(user, ["ADMIN", "EXECUTIVE"]);
  return db.transaction(async (tx) => {
    const expense = await one(
      tx,
      "SELECT e.*,o.order_date FROM pool_expenses e JOIN orders o ON (e.tenant_id=o.tenant_id AND e.order_id=o.id) WHERE e.tenant_id=$1 AND e.id=$2 FOR UPDATE",
      [user.tenantId, expenseId],
    );
    if (!expense) throw new AppError(404, "Không tìm thấy chi phí.");
    if (expense.status === "APPROVED") return { alreadyApproved: true };
    if (expense.status !== "PENDING" && expense.status !== "DRAFT")
      throw new AppError(409, "Chi phí đã được xử lý.");
    await writableDate(tx, user, String(expense.order_date));
    await tx.query(
      "UPDATE pool_expenses SET status='APPROVED',approved_by=$3,approved_at=now() WHERE tenant_id=$1 AND id=$2",
      [user.tenantId, expenseId, user.id],
    );
    await audit(tx, user, "EXPENSE_APPROVED", "EXPENSE", expenseId, expense, {
      status: "APPROVED",
      amount: expense.amount,
    });
    return { id: expenseId };
  });
}
export async function rejectExpense(
  db: PGlite,
  user: User,
  expenseId: string,
  input: Record<string, unknown>,
) {
  requireRoles(user, ["ADMIN", "EXECUTIVE"]);
  const reason = text(input.reason, "Lý do từ chối");
  return db.transaction(async (tx) => {
    const expense = await one(
      tx,
      "SELECT e.*,o.order_date FROM pool_expenses e JOIN orders o ON (e.tenant_id=o.tenant_id AND e.order_id=o.id) WHERE e.tenant_id=$1 AND e.id=$2 FOR UPDATE",
      [user.tenantId, expenseId],
    );
    if (!expense) throw new AppError(404, "Không tìm thấy chi phí.");
    if (expense.status !== "PENDING" && expense.status !== "DRAFT")
      throw new AppError(409, "Chỉ từ chối chi phí chưa duyệt.");
    await writableDate(tx, user, String(expense.order_date));
    await tx.query(
      "UPDATE pool_expenses SET status='REJECTED' WHERE tenant_id=$1 AND id=$2",
      [user.tenantId, expenseId],
    );
    await audit(
      tx,
      user,
      "EXPENSE_REJECTED",
      "EXPENSE",
      expenseId,
      expense,
      { status: "REJECTED" },
      reason,
    );
    return { id: expenseId };
  });
}
