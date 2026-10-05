import { test, expect } from "@playwright/test";
test("Vietnamese desktop/mobile workflows from first setup through settlement", async ({
  page,
}) => {
  const errors = [];
  let expectedSessionExpiry = false;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !message.text().includes("favicon") &&
      !(expectedSessionExpiry && message.text().includes("401"))
    )
      errors.push(message.text());
  });
  async function post(path, input) {
    const response = await page.request.post("/api/" + path, { data: input });
    expect(response.ok(), path + " " + (await response.text())).toBeTruthy();
    return response.json();
  }
  await page.goto("/");
  await expect(page.getByText("Trình tự lần đầu")).toBeVisible();
  await expect(page.getByText(/Duyệt giá, tỷ lệ quỹ/)).toBeVisible();
  await page.getByLabel("Tên của bạn").fill("QA Admin");
  await page.getByLabel("Tên đăng nhập").fill("qa-admin");
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill("valid-password-2026");
  await page.getByRole("button", { name: "Tạo tài khoản quản trị" }).click();
  await expect(
    page.getByRole("heading", { name: "Tổng quan", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Thiết lập ngay" }).click();
  await page.getByLabel("Giá làm cơ sở quỹ").selectOption("EXCLUDING_VAT");
  await page.getByLabel("Múi giờ kế toán").selectOption("Asia/Ho_Chi_Minh");
  await page.getByLabel("Thu từng phần").selectOption("PRO_RATA_NET");
  await page
    .getByLabel("Ngày áp dụng chính sách chia thưởng")
    .selectOption("ORDER_DATE");
  await page
    .getByLabel("Ghi nhận chi phí cho thưởng")
    .selectOption("PRO_RATA_WITH_COLLECTION");
  await page.getByRole("button", { name: "Lưu dữ liệu", exact: true }).click();
  await expect(page.locator("#modal")).not.toBeVisible();
  const pm = await post("staff", { name: "QA PM", code: "QA-PM" });
  await post("periods", {
    id: "QA-2026-10",
    start: "2026-10-01",
    end: "2026-11-01",
  });
  await post("targets", {
    employeeId: pm.id,
    periodId: "QA-2026-10",
    amount: "1",
  });
  await post("policies/pool", {
    scope: "ALL",
    percent: "45",
    effectiveFrom: "2026-01-01",
    reason: "QA fixture",
  });
  await post("policies/bonus", {
    pmPercent: "35",
    supportPercent: "30",
    companyPercent: "35",
    effectiveFrom: "2026-01-01",
    reason: "QA fixture",
  });
  const state = await (await page.request.get("/api/state")).json();
  const product = state.catalog[0];
  await post("prices", {
    productId: product.id,
    amount: "10800000",
    vatPercent: "8",
    taxBasis: "INCLUDING_VAT",
    pack: "QA pack",
    effectiveFrom: "2026-01-01",
    reason: "QA fixture",
  });
  await page.reload();
  await page.getByRole("button", { name: "Đơn hàng", exact: true }).click();
  await page
    .locator(".toolbar")
    .getByRole("button", { name: "Tạo đơn hàng" })
    .click();
  await page.getByLabel("Số đơn hàng").fill("UI-001");
  await page.getByLabel("Ngày đơn", { exact: true }).fill("2026-10-05");
  await page
    .getByLabel("Khách hàng", { exact: true })
    .fill("QA buyer <script>");
  await page.getByLabel("PM phụ trách").selectOption(pm.id);
  await page.getByLabel("Sản phẩm dòng đơn").selectOption(product.id);
  await page.getByLabel("Chiết khấu gồm VAT").fill("1080000");
  // The Add/Cancel controls must never submit the order form.
  await page
    .getByRole("button", { name: "Thêm sản phẩm", exact: true })
    .click();
  await expect(page.locator(".line-row")).toHaveCount(2);
  await page.getByLabel("Xóa dòng").last().click();
  await page.getByRole("button", { name: "Lưu dữ liệu", exact: true }).click();
  await expect(page.getByText("UI-001", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Chi tiết", exact: true }).click();
  await page.getByRole("button", { name: "Ghi nhận thu", exact: true }).click();
  await page.getByLabel("Số tiền thực thu gồm VAT (₫)").fill("9720000");
  await page.getByLabel("Ngày thu", { exact: true }).fill("2026-10-05");
  await page.getByLabel("Mã tham chiếu duy nhất").fill("UI-BANK-001");
  await page.getByRole("button", { name: "Lưu khoản thu nháp" }).click();
  await page.getByRole("button", { name: "Chi tiết", exact: true }).click();
  await page.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(
    page.locator("#modal").getByText("Đã xác nhận", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Đóng", { exact: true }).click();
  await page.getByRole("button", { name: "Tính thưởng", exact: true }).click();
  await expect(
    page.locator(".metric-value").filter({ hasText: "1.225.000" }),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "Xem cách tính", exact: true })
    .click();
  await expect(
    page.getByText("3.500.000", { exact: false }).first(),
  ).toBeVisible();
  await page.getByLabel("Đóng", { exact: true }).click();
  await page
    .getByRole("button", { name: "Chuyển sang đối soát", exact: true })
    .click();
  await page.getByRole("button", { name: "Chuyển sang REVIEW" }).click();
  await page.getByRole("button", { name: "Khóa kỳ", exact: true }).click();
  await page.locator("input[name=acknowledgeWarnings]").check();
  await page
    .locator("#modal")
    .getByRole("button", { name: "Khóa kỳ", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Ghi nhận chi trả", exact: true })
    .click();
  await page.getByLabel("Tham chiếu chi trả").fill("QA-PAYROLL");
  await page.getByRole("button", { name: "Đánh dấu đã chi trả" }).click();
  await expect(page.locator("#period-picker")).toContainText("Đã chi trả");
  for (const name of [
    "Tổng quan",
    "Đơn hàng",
    "Đối soát thu tiền",
    "Tính thưởng",
    "Báo cáo",
    "Nhân sự",
    "Chính sách thưởng",
    "Kết nối AMIS CRM",
    "Hệ thống",
  ]) {
    await page
      .locator(".sidebar")
      .getByRole("button", { name, exact: true })
      .click();
    await expect(page.locator(".content h1")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Tải lại", exact: true }),
    ).toHaveCount(0);
  }
  const contextualGuides = [
    ["overview", "Tổng quan", "Bắt đầu và quy trình làm việc"],
    ["orders", "Đơn hàng", "Đơn hàng"],
    ["collections", "Đối soát thu tiền", "Đối soát thu tiền"],
    ["bonus", "Tính thưởng", "Tính thưởng và xem cách tính"],
    ["reports", "Báo cáo", "Đối soát, khóa kỳ và chi trả"],
    ["staff", "Nhân sự", "Nhân sự và chỉ tiêu"],
    ["policies", "Chính sách thưởng", "Giá sản phẩm và chính sách thưởng"],
    ["integration", "Kết nối AMIS CRM", "Kết nối AMIS CRM"],
    ["system", "Hệ thống", "Cấu hình, hoàn tiền, nhật ký và sao lưu"],
  ];
  for (const [key, pageLabel, guideTitle] of contextualGuides) {
    await page.locator(`.sidebar button[data-page="${key}"]`).click();
    await page.locator(".context-help").click();
    await expect(page.locator(".content h1")).toHaveText(guideTitle);
    await page
      .locator(".guide-article")
      .getByRole("button", { name: "Mở chức năng liên quan" })
      .click();
    await expect(
      page.locator(`.sidebar button[data-page="${key}"]`),
    ).toHaveClass(/active/);
    await expect(
      page.locator(`.sidebar button[data-page="${key}"]`),
    ).toContainText(pageLabel);
  }
  await page.locator(".sidebar button[data-page=guide]").click();
  await expect(page.locator(".guide-subnav .subnav-item")).toHaveCount(9);
  await expect(page.locator(".context-help")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({ path: "tmp/qa-guide-desktop.png", fullPage: true });
  for (const [key, guideTitle] of [
    ["overview", "Bắt đầu và quy trình làm việc"],
    ["system", "Cấu hình, hoàn tiền, nhật ký và sao lưu"],
    ["policies", "Giá sản phẩm và chính sách thưởng"],
    ["staff", "Nhân sự và chỉ tiêu"],
    ["orders", "Đơn hàng"],
    ["collections", "Đối soát thu tiền"],
    ["bonus", "Tính thưởng và xem cách tính"],
    ["reports", "Đối soát, khóa kỳ và chi trả"],
    ["integration", "Kết nối AMIS CRM"],
  ]) {
    await page.locator(`.guide-subnav button[data-guide="${key}"]`).click();
    await expect(page.locator(".content h1")).toHaveText(guideTitle);
  }
  await page.reload();
  await expect(page.locator(".content h1")).toHaveText("Kết nối AMIS CRM");
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Chính sách thưởng", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Nhóm sản phẩm", exact: true })
    .click();
  await page.getByLabel("Tên nhóm mới").fill("QA Group");
  await page.getByLabel("Sản phẩm muốn gán").selectOption([product.id]);
  await page.getByRole("button", { name: "Lưu dữ liệu", exact: true }).click();
  await expect(page.locator("#modal")).not.toBeVisible();
  await page
    .getByRole("button", { name: "Chính sách quỹ", exact: true })
    .click();
  await page
    .getByLabel("Phạm vi", { exact: true })
    .selectOption("PRODUCT_GROUP");
  const group = (await (await page.request.get("/api/state")).json()).groups[0];
  await page.getByLabel("Sản phẩm / Nhóm").selectOption(group.id);
  await page.getByLabel("Tỷ lệ quỹ (%)").fill("45");
  await page.getByLabel("Hiệu lực từ", { exact: true }).fill("2026-01-01");
  await page.getByLabel("Lý do / chứng từ").fill("QA group policy");
  await page.getByRole("button", { name: "Lưu dữ liệu", exact: true }).click();
  await expect(page.getByText("QA Group", { exact: true })).toBeVisible();
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Hệ thống", exact: true })
    .click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Sao lưu dữ liệu", exact: true })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/sales-bonus-backup.*tar.gz/);
  await page.getByRole("button", { name: "Tổng quan", exact: true }).click();
  await page.screenshot({
    path: "tmp/qa-dashboard-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({
    path: "tmp/qa-dashboard-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  expect(
    await page.locator(".sidebar").evaluate((node) =>
      node.classList.contains("open"),
    ),
  ).toBe(false);
  await page.locator(".context-help").click();
  await expect(page.locator(".content h1")).toHaveText(
    "Bắt đầu và quy trình làm việc",
  );
  await expect(page.locator(".context-help")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({ path: "tmp/qa-guide-mobile.png", fullPage: true });
  await page.getByLabel("Mở menu").click();
  await expect(
    page.locator('.guide-subnav button[data-guide="overview"]'),
  ).toBeVisible();
  await page.locator('.guide-subnav button[data-guide="integration"]').click();
  await expect(page.locator(".content h1")).toHaveText("Kết nối AMIS CRM");
  await page.getByLabel("Mở menu").click();
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Đơn hàng", exact: true })
    .click();
  await page.locator(".context-help").click();
  await expect(page.locator(".content h1")).toHaveText("Đơn hàng");
  await page
    .locator(".guide-article")
    .getByRole("button", { name: "Mở chức năng liên quan" })
    .click();
  await page
    .locator(".toolbar")
    .getByRole("button", { name: "Tạo đơn hàng" })
    .click();
  expect(
    await page
      .locator("#modal")
      .evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBeTruthy();
  await page.getByLabel("Đóng", { exact: true }).click();
  expectedSessionExpiry = true;
  await page.request.post("/api/auth/logout", { data: {} });
  await page.getByLabel("Mở menu").click();
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Tính thưởng", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Chào mừng trở lại", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
