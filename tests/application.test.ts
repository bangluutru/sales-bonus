import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { openDatabase, rows } from "../apps/server/database.js";
import { applicationServer } from "../apps/server/http.js";
import type { Report } from "../apps/server/reports.js";
test("HTTP workflow: exact VAT, partial receipts, RBAC, immutable settlement and approved refund offset", async () => {
  const db = await openDatabase();
  const server = applicationServer(db, (error) => console.error(error));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  let cookie = "";
  async function request(
    path: string,
    input?: unknown,
    expected = 200,
    session = cookie,
  ) {
    const response = await fetch(base + "/api/" + path, {
      method: input === undefined ? "GET" : "POST",
      headers: {
        ...(session ? { cookie: session } : {}),
        ...(input === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(input === undefined ? {} : { body: JSON.stringify(input) }),
    });
    const data = await response.json();
    assert.equal(response.status, expected, path + " " + JSON.stringify(data));
    if (response.headers.has("set-cookie"))
      cookie = response.headers.get("set-cookie")!.split(";")[0]!;
    return data;
  }
  try {
    await request("state", undefined, 401);
    await request("auth/setup", {
      name: "Director",
      login: "admin",
      password: "valid-password-2026",
    });
    const admin = cookie;
    await request("configuration", {
      poolBasis: "EXCLUDING_VAT",
      revenueBasis: "EXCLUDING_VAT",
      timezone: "Asia/Ho_Chi_Minh",
      recognition: "PRO_RATA_NET",
      bonusPolicyTiming: "ORDER_DATE",
      expenseRecognition: "PRO_RATA_WITH_COLLECTION",
      mktPercent: "60",
      accountingPercent: "20",
      logisticsPercent: "20",
      roundingQuantumVnd: "1000",
    });
    const pm = await request("staff", {
      name: "PM A",
      code: "PMA",
      login: "pma",
      password: "valid-password-2026",
      role: "PM",
    });
    const other = await request("staff", {
      name: "PM B",
      code: "PMB",
      login: "pmb",
      password: "valid-password-2026",
      role: "PM",
    });
    await request("staff", {
      name: "Accounting",
      code: "ACC",
      login: "accounting",
      password: "valid-password-2026",
      role: "ACCOUNTING",
    });
    for (const [id, start, end] of [
      ["2026-09", "2026-09-01", "2026-10-01"],
      ["2026-10", "2026-10-01", "2026-11-01"],
    ])
      await request("periods", { id, start, end });
    const state = await request("state");
    assert.equal(state.catalog.length, 46);
    const [a, b] = state.catalog;
    for (const product of [a, b])
      await request("prices", {
        productId: product.id,
        amount: "10800000",
        vatPercent: "8",
        taxBasis: "INCLUDING_VAT",
        pack: "Test pack",
        effectiveFrom: "2026-01-01",
        reason: "Independent fixture",
      });
    await request("policies/pool", {
      scope: "ALL",
      percent: "45",
      effectiveFrom: "2026-01-01",
      reason: "Fixture",
    });
    await request("policies/pool", {
      scope: "PRODUCT",
      scopeId: b.id,
      percent: "50",
      effectiveFrom: "2026-01-01",
      reason: "Fixture",
    });
    await request("policies/bonus", {
      pmPercent: "35",
      supportPercent: "30",
      companyPercent: "35",
      effectiveFrom: "2026-01-01",
      reason: "Fixture",
    });
    for (const periodId of ["2026-09", "2026-10"])
      await request("targets", {
        employeeId: pm.id,
        periodId,
        amount: "8500000",
      });
    const order = await request("orders", {
      number: "ORACLE-001",
      date: "2026-09-10",
      customerName: "Golden buyer",
      pmId: pm.id,
      items: [
        { productId: a.id, quantity: "1", discountAmount: "1080000" },
        { productId: b.id, quantity: "1", discountAmount: "2160000" },
      ],
    });
    const detail = await request("orders/" + order.id);
    assert.equal(detail.order.cash_net, "18360000");
    const paymentInput = {
      orderId: order.id,
      amount: "9180000",
      date: "2026-09-15",
      method: "TRANSFER",
      reference: "BANK-001",
    };
    const payment = await request("payments", paymentInput);
    assert.equal((await request("payments", paymentInput)).id, payment.id);
    await request("payments", { ...paymentInput, amount: "1" }, 409);
    let report: Report = await request("report?period=2026-09");
    assert.equal(report.earnedPm, "0");
    await request("payments/" + payment.id + "/confirm", {});
    assert.equal(
      (await request("payments/" + payment.id + "/confirm", {}))
        .alreadyConfirmed,
      true,
    );
    report = await request("report?period=2026-09");
    assert.equal(report.collectedRevenue, "8500000");
    assert.equal(report.earnedPm, "1137500");
    assert.equal(report.payablePm, "1138000");
    assert.equal(report.pms[0]!.roundingDelta, "500");
    assert.equal(report.support.departments.MKT!.netPayable, "585000");
    assert.equal(report.support.departments.ACCOUNTING!.netPayable, "195000");
    assert.equal(report.support.departments.LOGISTICS!.netPayable, "195000");
    assert.equal(report.canLock, true);
    const allocations = await rows(
      db,
      "SELECT amount::text AS amount FROM payment_allocations ORDER BY amount DESC",
    );
    assert.deepEqual(
      allocations.map((a) => a.amount),
      ["4860000", "4320000"],
    );
    await request("auth/login", {
      login: "pmb",
      password: "valid-password-2026",
    });
    await request("orders/" + order.id, undefined, 403);
    assert.equal((await request("orders")).length, 0);
    await request("payments/" + payment.id + "/confirm", {}, 403);
    await request("auth/login", {
      login: "pma",
      password: "valid-password-2026",
    });
    const own = await request("report?period=2026-09");
    assert.equal(own.pms.length, 1);
    assert.deepEqual(own.support.departments, {});
    await request("audit", undefined, 403);
    await request(
      "targets",
      { employeeId: other.id, periodId: "2026-09", amount: "1" },
      403,
    );
    cookie = admin;
    await request("periods/2026-09/state", { action: "review" });
    await request("periods/2026-09/state", {
      action: "lock",
      acknowledgeWarnings: true,
    });
    await request("periods/2026-09/pay", { evidence: "PAYROLL-SEP" });
    assert.equal(
      (await request("periods/2026-09/pay", { evidence: "PAYROLL-SEP" }))
        .alreadyPaid,
      true,
    );
    const locked = await request("report?period=2026-09");
    assert.equal(locked.period.state, "PAID");
    await request(
      "targets",
      { employeeId: pm.id, periodId: "2026-09", amount: "1" },
      409,
    );
    await request(
      "payments/" + payment.id + "/reverse",
      { date: "2026-10-02", reason: "Closed refund" },
      409,
    );
    // Policy change does not rewrite either the original order or its locked history.
    await request("policies/pool", {
      scope: "ALL",
      percent: "40",
      effectiveFrom: "2026-10-01",
      reason: "New policy",
    });
    const second = await request("payments", {
      ...paymentInput,
      date: "2026-10-10",
      reference: "BANK-002",
    });
    await request("payments/" + second.id + "/confirm", {});
    report = await request("report?period=2026-10");
    assert.equal(report.earnedPm, "1137500");
    assert.equal(report.payablePm, "1138000");
    const settlements = await request("settlements");
    const source = settlements.find(
      (s: { recipient_type: string }) => s.recipient_type === "EMPLOYEE",
    );
    const refund = await request("refunds", {
      settlementId: source.id,
      applicationPeriodId: "2026-10",
      orderId: order.id,
      refundAmount: "108000",
      recoveryAmount: "2000",
      date: "2026-10-12",
      reason: "Return",
      evidence: "REFUND-001",
    });
    await request("auth/login", {
      login: "accounting",
      password: "valid-password-2026",
    });
    await request(
      "adjustments/" + refund.id + "/approve",
      { recoveryAmount: "1500", reason: "Reviewed correction" },
      403,
    );
    cookie = admin;
    await request("periods/2026-10/state", { action: "review" }, 409);
    await request("adjustments/" + refund.id + "/approve", {
      recoveryAmount: "1500",
      reason: "Reviewed correction",
    });
    report = await request("report?period=2026-10");
    assert.equal(report.payablePm, "1136000");
    assert.equal(report.pms[0]!.adjustment, "-1500");
    assert.equal(report.pms[0]!.roundingDelta, "0");
    assert.equal(report.pms[0]!.netExactPayable, "1136000");
    assert.deepEqual(await request("report?period=2026-09"), locked);
    await request("periods/2026-10/state", { action: "review" });
    await request("periods/2026-10/state", {
      action: "lock",
      acknowledgeWarnings: true,
    });
    assert.equal(
      (await rows(db, "SELECT * FROM adjustment_applications")).length,
      1,
    );
    await request("auth/login", {
      login: "pmb",
      password: "valid-password-2026",
    });
    const privateLocked = await request("report?period=2026-09");
    assert.equal(privateLocked.lines.length, 0);
    assert.equal(privateLocked.pms.length, 0);
    assert.equal((await request("settlements")).length, 0);
    cookie = admin;
    await request("configuration", {
      poolBasis: "EXCLUDING_VAT",
      revenueBasis: "INCLUDING_VAT",
      timezone: "Asia/Ho_Chi_Minh",
      recognition: "PRO_RATA_NET",
      bonusPolicyTiming: "ORDER_DATE",
      expenseRecognition: "PRO_RATA_WITH_COLLECTION",
      mktPercent: "50",
      accountingPercent: "25",
      logisticsPercent: "25",
      roundingQuantumVnd: "1000",
    });
    await request("periods", {
      id: "2026-11",
      start: "2026-11-01",
      end: "2026-12-01",
    });
    const empty = await request("report?period=2026-11");
    assert.equal(empty.lines.length, 0);
    assert.equal(empty.pms.length, 0);
    assert.equal(empty.canLock, true);
    assert.deepEqual(await request("report?period=2026-09"), locked);
    const later = await request("payments", {
      orderId: order.id,
      amount: "1",
      date: "2026-11-01",
      method: "CASH",
      reference: "NOV-OVER",
    });
    await request("payments/" + later.id + "/confirm", {}, 409);
    await request("periods/2026-11/state", { action: "review" });
    await request("periods/2026-11/state", { action: "lock" });
    const audit = await request("audit");
    assert.ok(
      audit.some((a: { action: string }) => a.action === "ADJUSTMENT_APPROVED"),
    );
    assert.ok(!JSON.stringify(audit).includes("valid-password"));
  } finally {
    server.close();
    await once(server, "close");
    await db.close();
  }
});
test("invalid input, expense approvals, zero incentive deficit, reversals and cross-origin protections", async () => {
  const db = await openDatabase();
  const server = applicationServer(db, (error) => console.error(error));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  let cookie = "";
  async function request(path: string, input?: unknown, expected = 200) {
    const response = await fetch(base + "/api/" + path, {
      method: input === undefined ? "GET" : "POST",
      headers: {
        cookie,
        ...(input === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(input === undefined ? {} : { body: JSON.stringify(input) }),
    });
    const data = await response.json();
    assert.equal(response.status, expected, path + " " + JSON.stringify(data));
    if (response.headers.has("set-cookie"))
      cookie = response.headers.get("set-cookie")!.split(";")[0]!;
    return data;
  }
  try {
    await request("auth/setup", {
      name: "Admin",
      login: "admin",
      password: "valid-password-2026",
    });
    const admin = cookie;
    await request(
      "auth/setup",
      { name: "Other", login: "other", password: "valid-password-2026" },
      409,
    );
    const cfg = {
      poolBasis: "EXCLUDING_VAT",
      revenueBasis: "EXCLUDING_VAT",
      timezone: "Asia/Ho_Chi_Minh",
      recognition: "PRO_RATA_NET",
      bonusPolicyTiming: "ORDER_DATE",
      expenseRecognition: "PRO_RATA_WITH_COLLECTION",
      mktPercent: "60",
      accountingPercent: "20",
      logisticsPercent: "20",
      roundingQuantumVnd: "1000",
    };
    await request("configuration", { ...cfg, mktPercent: "61" }, 400);
    await request("configuration", cfg);
    const pm = await request("staff", {
      name: "PM",
      code: "PM",
      login: "pm",
      password: "valid-password-2026",
      role: "PM",
    });
    await request("staff", {
      name: "Accounting",
      code: "ACC",
      login: "acc",
      password: "valid-password-2026",
      role: "ACCOUNTING",
    });
    await request("periods", {
      id: "P",
      start: "2026-10-01",
      end: "2026-11-01",
    });
    await request(
      "periods",
      { id: "P2", start: "2026-10-15", end: "2026-11-15" },
      409,
    );
    const product = (await request("state")).catalog[0];
    await request("prices", {
      productId: product.id,
      amount: "1080000",
      vatPercent: "8",
      taxBasis: "INCLUDING_VAT",
      pack: "Test",
      effectiveFrom: "2026-01-01",
      reason: "Fixture",
    });
    await request("policies/pool", {
      scope: "ALL",
      percent: "45",
      effectiveFrom: "2026-01-01",
      reason: "Fixture",
    });
    await request("policies/bonus", {
      pmPercent: "35",
      supportPercent: "30",
      companyPercent: "35",
      effectiveFrom: "2026-01-01",
      reason: "Fixture",
    });
    const input = {
      number: "NEGATIVE",
      date: "2026-10-05",
      customerName: "Buyer",
      pmId: pm.id,
      items: [
        { productId: product.id, quantity: "1", discountAmount: "540000" },
      ],
    };
    await request(
      "orders",
      { ...input, items: [{ ...input.items[0], quantity: "0" }] },
      400,
    );
    const order = await request("orders", input);
    const item = (await request("orders/" + order.id)).items[0];
    await request("periods/P/state", { action: "review" }, 409);
    await request("targets", { employeeId: pm.id, periodId: "P", amount: "1" });
    const payment = await request("payments", {
      orderId: order.id,
      amount: "540000",
      date: "2026-10-06",
      method: "TRANSFER",
      reference: "BANK",
    });
    await request(
      "payments/" + payment.id + "/confirm",
      {
        allocations: [{ itemId: item.id, amount: "539999" }],
        reason: "Wrong allocation",
      },
      400,
    );
    await request("payments/" + payment.id + "/confirm", {
      allocations: [{ itemId: item.id, amount: "540000" }],
      reason: "Manual exact",
    });
    let report: Report = await request("report?period=P");
    assert.equal(report.lines[0]!.closing.rawResidual, "-50000");
    assert.equal(report.payablePm, "0");
    assert.ok(
      report.warnings.includes("CUSTOMER_DISCOUNT_EXCEEDS_MANAGEMENT_POOL"),
    );
    assert.equal(report.canLock, true);
    const excessive = await request("payments", {
      orderId: order.id,
      amount: "1",
      date: "2026-10-07",
      method: "CASH",
      reference: "OVER",
    });
    await request("payments/" + excessive.id + "/confirm", {}, 409);
    await request("auth/login", {
      login: "pm",
      password: "valid-password-2026",
    });
    const expense = await request("expenses", {
      orderId: order.id,
      itemId: item.id,
      category: "OTHER",
      amount: "1000",
      evidence: "Invoice",
    });
    await request("expenses/" + expense.id + "/approve", {}, 403);
    await request(
      "expenses",
      {
        orderId: order.id,
        itemId: item.id,
        category: "CUSTOMER_DISCOUNT",
        amount: "1000",
        evidence: "Discount duplicated",
      },
      400,
    );
    await request("auth/login", {
      login: "acc",
      password: "valid-password-2026",
    });
    await request("expenses/" + expense.id + "/approve", {}, 403);
    cookie = admin;
    const rejected = await request("expenses", {
      orderId: order.id,
      itemId: item.id,
      category: "OTHER",
      amount: "999",
      evidence: "Wrong invoice",
    });
    await request("expenses/" + rejected.id + "/reject", {
      reason: "Not eligible",
    });
    report = await request("report?period=P");
    assert.equal(report.canLock, false);
    await request("periods/P/state", { action: "review" }, 409);
    await request("expenses/" + expense.id + "/approve", {});
    await assert.rejects(
      db.query("UPDATE pool_expenses SET amount=0 WHERE id=$1", [expense.id]),
      /APPROVED_VERSION_IS_IMMUTABLE/,
    );
    await assert.rejects(
      db.query("UPDATE order_items SET canonical_input='{}' WHERE id=$1", [
        item.id,
      ]),
      /IMMUTABLE/,
    );
    await request("payments/" + payment.id + "/reverse", {
      date: "2026-10-07",
      reason: "Wrong bank transfer",
    });
    assert.equal(
      (
        await request("payments/" + payment.id + "/reverse", {
          date: "2026-10-07",
          reason: "Retry",
        })
      ).alreadyReversed,
      true,
    );
    report = await request("report?period=P");
    assert.equal(report.collectedCash, "0");
    assert.equal(report.earnedPm, "0");
    const replacement = await request("payments", {
      orderId: order.id,
      amount: "540000",
      date: "2026-10-08",
      method: "TRANSFER",
      reference: "REPLACEMENT",
    });
    await request("payments/" + replacement.id + "/confirm", {});
    await request("periods/P/state", { action: "review" });
    await request("periods/P/state", { action: "lock" }, 409);
    await request("periods/P/state", {
      action: "lock",
      acknowledgeWarnings: true,
    });
    await request("periods/P/pay", { evidence: "ZERO-BONUS-SETTLEMENT" });
    assert.equal(
      (await rows(db, "SELECT * FROM settlement_payouts")).length,
      0,
    );
    const cross = await fetch(base + "/api/configuration", {
      method: "POST",
      headers: {
        cookie,
        "content-type": "application/json",
        origin: "https://attacker.example",
      },
      body: JSON.stringify(cfg),
    });
    assert.equal(cross.status, 403);
    const malformed = await fetch(base + "/api/orders", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: "broken json",
    });
    assert.equal(malformed.status, 400);
    await request("auth/logout", {});
    await request("state", undefined, 401);
  } finally {
    server.close();
    await once(server, "close");
    await db.close();
  }
});
test("persistent database, authenticated backup, CLI restore and immutable configuration versions", async () => {
  const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { execFileSync } = await import("node:child_process");
  const dir = await mkdtemp(join(tmpdir(), "sales-bonus-qa-"));
  let db = await openDatabase(join(dir, "source"));
  const server = applicationServer(db);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const setup = await fetch(base + "/api/auth/setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Backup Admin",
        login: "backupadmin",
        password: "valid-password-2026",
      }),
    });
    assert.equal(setup.status, 200);
    const cookie = setup.headers.get("set-cookie")!.split(";")[0]!;
    const financialConfig = {
      poolBasis: "EXCLUDING_VAT",
      revenueBasis: "EXCLUDING_VAT",
      timezone: "Asia/Tokyo",
      recognition: "PRO_RATA_NET",
      bonusPolicyTiming: "ORDER_DATE",
      expenseRecognition: "PRO_RATA_WITH_COLLECTION",
      mktPercent: "60",
      accountingPercent: "20",
      logisticsPercent: "20",
      roundingQuantumVnd: "1000",
    };
    for (const configuration of [
      financialConfig,
      { ...financialConfig, revenueBasis: "INCLUDING_VAT" },
    ]) {
      const response = await fetch(base + "/api/configuration", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify(configuration),
      });
      assert.equal(response.status, 200);
    }
    const versions = await rows(
      db,
      "SELECT * FROM configuration_versions ORDER BY version",
    );
    assert.equal(versions.length, 2);
    await assert.rejects(
      db.query(
        "UPDATE configuration_versions SET configuration='{}' WHERE version=1",
      ),
      /IMMUTABLE/,
    );
    const denied = await fetch(base + "/api/backup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(denied.status, 401);
    const backup = await fetch(base + "/api/backup", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(backup.status, 200);
    assert.equal(backup.headers.get("content-type"), "application/gzip");
    const file = join(dir, "backup.tar.gz");
    await writeFile(file, Buffer.from(await backup.arrayBuffer()));
    execFileSync(process.execPath, [
      "scripts/restore-backup.mjs",
      file,
      join(dir, "restored"),
    ]);
    const restored = await openDatabase(join(dir, "restored"));
    assert.equal((await rows(restored, "SELECT * FROM products")).length, 46);
    assert.deepEqual(
      await rows(
        restored,
        "SELECT * FROM configuration_versions ORDER BY version",
      ),
      versions,
    );
    assert.equal(
      (await rows(restored, "SELECT * FROM auth_sessions")).length,
      0,
    );
    assert.equal(
      (
        await rows(
          restored,
          "SELECT * FROM audit_logs WHERE action='BACKUP_EXPORTED'",
        )
      ).length,
      1,
    );
    await restored.close();
    assert.throws(() =>
      execFileSync(
        process.execPath,
        ["scripts/restore-backup.mjs", file, join(dir, "restored")],
        { stdio: "pipe" },
      ),
    );
    server.close();
    await once(server, "close");
    await db.close();
    db = await openDatabase(join(dir, "source"));
    assert.equal((await rows(db, "SELECT * FROM products")).length, 46);
    assert.equal((await rows(db, "SELECT * FROM schema_migrations")).length, 2);
  } finally {
    if (server.listening) {
      server.close();
      await once(server, "close");
    }
    await db.close();
    await rm(dir, { recursive: true, force: true });
  }
});
