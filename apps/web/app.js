const icons = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  orders: '<path d="M7 3h10l3 4v14H4V7zM4 7h16M9 11h6M9 15h6"/>',
  cash: '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M5 8h1M18 16h1"/>',
  bonus: '<path d="M12 3v18M8 7c0-4 9-4 9 0 0 4-10 3-10 7 0 4 10 4 10 0"/>',
  chart: '<path d="M4 3v17h17M8 15l4-5 4 2 5-7"/>',
  staff:
    '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 6"/>',
  policy: '<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6zM8 12l3 3 5-6"/>',
  link: '<path d="m9 15 6-6M7 17l-1 1a4 4 0 0 1-6-6l6-6a4 4 0 0 1 6 0M17 7l1-1a4 4 0 0 1 6 6l-6 6a4 4 0 0 1-6 0"/>',
  settings:
    '<circle cx="12" cy="12" r="3"/><path d="m9 3 6 0 1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  warning: '<path d="m12 3 10 17H2zM12 9v4M12 16h.01"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  box: '<path d="m12 3 9 5v9l-9 5-9-5V8zM3 8l9 5 9-5M12 13v9"/>',
};
const icon = (key) =>
  `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[key] || icons.grid}</svg>`;
const e = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function rational(value) {
  const raw = String(value ?? "0");
  if (raw.includes("/")) {
    const [n, d] = raw.split("/");
    return [BigInt(n), BigInt(d)];
  }
  const [whole, fraction = ""] = raw.split(".");
  return [BigInt(whole + fraction), 10n ** BigInt(fraction.length)];
}
function money(value) {
  if (value === null || value === undefined) return "—";
  const [n, d] = rational(value);
  const whole = n / d;
  return (d === 1n ? "" : "≈ ") + whole.toLocaleString("vi-VN");
}
function percent(value) {
  const [n, d] = rational(value);
  let remainder = (n * 100n) % d;
  let fraction = "";
  while (remainder !== 0n && fraction.length < 30) {
    remainder *= 10n;
    fraction += (remainder / d).toString();
    remainder %= d;
  }
  return (
    (remainder ? "≈ " : "") +
    ((n * 100n) / d).toString() +
    (fraction ? "," + fraction : "") +
    "%"
  );
}
const warningLabels = {
  CUSTOMER_DISCOUNT_EXCEEDS_MANAGEMENT_POOL: "Chiết khấu vượt quỹ quản lý",
  NEGATIVE_RESIDUAL_POOL: "Quỹ còn lại âm: thưởng PM và Support bằng 0",
  PENDING_EXPENSE_APPROVAL: "Chi phí chưa được duyệt",
  PENDING_ADJUSTMENT_APPROVAL: "Điều chỉnh chưa được duyệt",
  TARGET_REQUIRED: "Chưa có chỉ tiêu thu tiền",
};
const warningText = (values) =>
  values.map((value) => warningLabels[value] || value).join("; ");
const roleLabels = {
  ADMIN: "Quản trị viên",
  ACCOUNTING: "Kế toán",
  PM: "Quản lý sản phẩm",
  EXECUTIVE: "Giám đốc",
  SALES_MANAGER: "Quản lý kinh doanh",
  SUPPORT_MANAGER: "Quản lý hỗ trợ",
  AUDITOR: "Kiểm toán viên",
};
const stateLabels = {
  OPEN: "Đang mở",
  REVIEW: "Đang đối soát",
  LOCKED: "Đã khóa",
  PAID: "Đã chi trả",
  DRAFT: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  REVERSED: "Đã đảo",
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Đã từ chối",
  PROVISIONAL: "Giá tạm tính",
};
const badge = (value) =>
  `<span class="badge ${["DRAFT", "PENDING", "REVIEW", "PROVISIONAL"].includes(value) ? "warning" : ["OPEN", "CONFIRMED", "APPROVED", "PAID"].includes(value) ? "" : "neutral"}">${e(stateLabels[value] || value)}</span>`;
const nav = [
  ["overview", "Tổng quan", "grid"],
  ["orders", "Đơn hàng", "orders"],
  ["collections", "Đối soát thu tiền", "cash"],
  ["bonus", "Tính thưởng", "bonus"],
  ["reports", "Báo cáo", "chart"],
  ["staff", "Nhân sự", "staff"],
  ["policies", "Chính sách thưởng", "policy"],
  ["integration", "Kết nối AMIS CRM", "link"],
  ["system", "Hệ thống", "settings"],
];
let state = null,
  page = location.hash.slice(1) || "overview",
  periodId = "",
  toastTimer;
const root = document.querySelector("#app"),
  modal = document.querySelector("#modal");
const can = (...roles) => roles.includes(state?.user.role);
async function api(path, input) {
  const res = await fetch("/api/" + path, {
    method: input === undefined ? "GET" : "POST",
    headers: input === undefined ? {} : { "Content-Type": "application/json" },
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  });
  const result = await res.json();
  if (!res.ok) {
    if (res.status === 401 && state) {
      state = null;
      void start();
    }
    throw new Error(result.error || "Thao tác chưa hoàn tất.");
  }
  return result;
}
function toast(message) {
  const node = document.querySelector("#toast");
  node.textContent = message;
  node.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove("visible"), 4500);
}
const button = (label, action, cls = "", extra = "") =>
  `<button type="button" class="btn ${cls}" data-action="${action}" ${extra}>${e(label)}</button>`;
const notice = (content, info = false) =>
  `<div class="notice ${info ? "info" : ""}">${icon(info ? "check" : "warning")}<div>${content}</div></div>`;
const empty = (title, description, action = "", label = "") =>
  `<div class="empty"><div class="empty-mark">${icon("box")}</div><strong>${e(title)}</strong>${e(description)}${action ? "<div>" + button(label, action, "primary") + "</div>" : ""}</div>`;
function panel(title, subtitle, body, action = "") {
  return `<section class="panel"><div class="panel-head"><div><h2 class="panel-title">${e(title)}</h2>${subtitle ? `<div class="panel-subtitle">${e(subtitle)}</div>` : ""}</div>${action}</div>${body}</section>`;
}
function table(headers, body) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th>${e(h)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div>`;
}
const field = (
  name,
  label,
  value = "",
  type = "text",
  help = "",
  required = true,
) =>
  `<div class="form-field"><label for="f-${e(name)}">${e(label)}</label><input id="f-${e(name)}" name="${e(name)}" type="${type}" value="${e(value)}" ${required ? "required" : ""} ${type === "password" ? 'minlength="12" autocomplete="new-password"' : ""}>${help ? `<div class="help">${e(help)}</div>` : ""}</div>`;
const select = (name, label, options, value = "", help = "", required = true) =>
  `<div class="form-field"><label for="f-${e(name)}">${e(label)}</label><select id="f-${e(name)}" name="${e(name)}" ${required ? "required" : ""}>${options.map(([v, l]) => `<option value="${e(v)}" ${v === value ? "selected" : ""}>${e(l)}</option>`).join("")}</select>${help ? `<div class="help">${e(help)}</div>` : ""}</div>`;
const staffOptions = () => [
  ["", "Chọn PM"],
  ...state.staff.map((s) => [s.id, s.name]),
];
const periodOptions = (onlyOpen = false) => [
  ["", "Chọn kỳ"],
  ...state.periods
    .filter((p) => !onlyOpen || p.state === "OPEN")
    .map((p) => [p.id, p.id + " · " + stateLabels[p.state]]),
];
const productOptions = () => [
  ["", "Chọn sản phẩm"],
  ...state.catalog.map((p) => [p.id, p.name]),
];
const today = () =>
  new Date().toLocaleDateString("sv-SE", {
    timeZone: state?.configuration?.timezone || "Asia/Tokyo",
  });
function openModal(title, body) {
  modal.innerHTML = `<div class="modal-head"><h2>${e(title)}</h2><button class="close" data-action="close" aria-label="Đóng">×</button></div><div class="modal-body">${body}</div>`;
  if (!modal.open) modal.showModal();
}
function form(kind, content, label = "Lưu dữ liệu") {
  return `<form data-form="${kind}"><div class="form-grid">${content}</div><div class="form-error" role="alert"></div><div class="form-actions">${button("Hủy", "close")}<button class="btn primary" type="submit">${e(label)}</button></div></form>`;
}
function authScreen(setup) {
  root.innerHTML = `<div class="auth"><div class="auth-brand"><div class="brand"><div class="brand-mark">G</div><div><strong>GENKI</strong><small>COMMISSION & BONUS</small></div></div><h1>Rõ dòng tiền.<br>Minh bạch từng<br>khoản thưởng.</h1><p>Một nơi để đối soát thu tiền, quản lý quỹ và theo dõi thưởng của đội ngũ.</p></div><div class="auth-form"><div class="auth-inner"><div class="eyebrow">QUẢN LÝ THƯỞNG</div><h2>${setup ? "Thiết lập hệ thống" : "Chào mừng trở lại"}</h2><p>${setup ? "Tạo tài khoản quản trị cho ứng dụng cục bộ. Sau đó thiết lập chính sách trước khi bắt đầu tính thưởng." : "Đăng nhập để tiếp tục công việc đối soát và quản lý thưởng."}</p><form data-form="${setup ? "setup" : "login"}">${setup ? field("name", "Tên của bạn") : ""}${field("login", "Tên đăng nhập", "", "text")}${field("password", "Mật khẩu", "", "password", setup ? "Tối thiểu 12 ký tự. Không có mật khẩu mặc định." : "")}<div class="form-error" role="alert"></div><button class="btn primary" type="submit">${setup ? "Tạo tài khoản quản trị" : "Đăng nhập"} ${icon("arrow")}</button></form><p class="help">Dữ liệu được lưu cục bộ trên máy. Kết nối AMIS chưa được thiết lập.</p></div></div></div>`;
}
async function start() {
  try {
    const auth = await api("auth/status");
    if (auth.setupRequired) {
      authScreen(true);
      return;
    }
    try {
      await api("auth/me");
    } catch {
      authScreen(false);
      return;
    }
    await refresh();
  } catch (err) {
    root.innerHTML = empty(
      "Không mở được ứng dụng",
      err.message,
      "retry",
      "Thử lại",
    );
  }
}
async function refresh() {
  state = await api("state");
  if (!state.periods.some((p) => p.id === periodId))
    periodId = state.periods[0]?.id || "";
  await render();
}
function shell(body) {
  const active = nav.find((n) => n[0] === page) || nav[0];
  root.innerHTML = `<aside class="sidebar"><div class="brand"><div class="brand-mark">G</div><div><strong>GENKI</strong><small>COMMISSION & BONUS</small></div></div><div class="nav-label">QUẢN LÝ KINH DOANH</div>${nav
    .slice(0, 7)
    .map(
      ([key, label, ico]) =>
        `<button class="nav-item ${page === key ? "active" : ""}" data-page="${key}">${icon(ico)}${e(label)}</button>`,
    )
    .join("")}<div class="nav-label">THIẾT LẬP</div>${nav
    .slice(7)
    .map(
      ([key, label, ico]) =>
        `<button class="nav-item ${page === key ? "active" : ""}" data-page="${key}">${icon(ico)}${e(label)}</button>`,
    )
    .join(
      "",
    )}<div class="sidebar-foot"><small><span class="connection-dot"></span>AMIS chưa kết nối</small><div class="help">Dữ liệu nhập thủ công · Giá có nguồn</div></div></aside><main class="main"><header class="topbar"><button class="mobile-menu" data-action="menu" aria-label="Mở menu">☰</button><div class="breadcrumb">Không gian làm việc <strong>/ &nbsp; ${e(active[1])}</strong></div><div class="top-right"><span class="local-pill">BẢN CỤC BỘ</span><div class="avatar">${e(state.user.name.slice(0, 2).toUpperCase())}</div><div class="profile">${e(state.user.name)}<small>${e(roleLabels[state.user.role])}</small></div>${button("Đăng xuất", "logout", "quiet small")}</div></header><div class="content">${body}<div class="footer-note"><span>GENKI · Quản lý thưởng theo dòng tiền</span><span>Giá có phiên bản · Lịch sử khóa kỳ được bảo toàn</span></div></div></main>`;
}
function heading(title, description, action = "") {
  return `<div class="page-heading"><div><div class="eyebrow">COMMISSION & BONUS</div><h1>${e(title)}</h1><p>${e(description)}</p></div><div class="toolbar">${state.periods.length ? `<select class="period-picker" id="period-picker" aria-label="Kỳ tính thưởng">${state.periods.map((p) => `<option value="${e(p.id)}" ${p.id === periodId ? "selected" : ""}>Kỳ ${e(p.id)} · ${e(stateLabels[p.state])}</option>`).join("")}</select>` : ""}${action}</div></div>`;
}
function metric(label, value, unit, foot, ico, cls = "") {
  return `<div class="metric ${cls}"><div class="metric-label">${e(label)}<div class="metric-icon">${icon(ico)}</div></div><div class="metric-value">${e(value)}<small>${e(unit)}</small></div><div class="metric-foot">${e(foot)}</div></div>`;
}
function prerequisites() {
  if (!state.configuration)
    return notice(
      "<strong>Bắt đầu bằng quy tắc tài chính.</strong> Chọn cơ sở VAT, cách ghi nhận và tỷ lệ Support trong Hệ thống. " +
        button("Thiết lập ngay", "configure", "quiet small"),
    );
  if (!state.periods.length)
    return notice(
      "<strong>Chưa có kỳ tính thưởng.</strong> Tạo kỳ và chỉ tiêu trước khi đối soát. " +
        button("Tạo kỳ", "period", "quiet small"),
    );
  return "";
}
function orderTable(orders, accounting = false) {
  if (!orders.length)
    return empty(
      "Chưa có đơn hàng",
      "Tạo đơn thủ công sau khi duyệt giá và chính sách.",
      can("ADMIN", "ACCOUNTING", "SALES_MANAGER") ? "order" : "",
      "Tạo đơn hàng",
    );
  return table(
    [
      "Đơn hàng / Khách hàng",
      "PM",
      "Giá trị thu tiền",
      "Đã thu",
      "Còn phải thu",
      "Trạng thái",
      "",
    ],
    orders
      .map((o) => {
        const remain = BigInt(o.cash_net) - BigInt(o.confirmed_cash);
        return `<tr><td><strong>${e(o.order_number)}</strong><small>${e(o.customer_name)} · ${e(o.order_date)}</small></td><td>${e(o.pm_name)}</td><td class="amount">${money(o.cash_net)} ₫</td><td class="amount">${money(o.confirmed_cash)} ₫</td><td class="amount">${money(remain)} ₫</td><td>${badge(remain === 0n ? "PAID" : BigInt(o.confirmed_cash) > 0n ? "REVIEW" : "DRAFT")}</td><td><div class="actions">${button(accounting && can("ADMIN", "ACCOUNTING") ? "Ghi nhận thu" : "Chi tiết", "order-detail", "small", `data-id="${e(o.id)}"`)}</div></td></tr>`;
      })
      .join(""),
  );
}
async function overview() {
  const d = await api(
    "dashboard" + (periodId ? "?period=" + encodeURIComponent(periodId) : ""),
  );
  const r = d.report;
  if (can("SUPPORT_MANAGER"))
    return (
      heading("Tổng quan", "Theo dõi quỹ Support và phân bổ bộ phận.") +
      supportPanel(r)
    );
  const orders = can("SUPPORT_MANAGER") ? [] : await api("orders");
  return (
    heading(
      "Tổng quan",
      "Theo dõi dòng tiền và thưởng của đội ngũ.",
      can("ADMIN", "ACCOUNTING")
        ? button("Đối soát thu tiền", "collections", "accent")
        : "",
    ) +
    prerequisites() +
    (state.configuration && state.periods.length
      ? notice(
          "<strong>Nguồn dữ liệu: nhập thủ công.</strong> AMIS và workbook lịch sử chưa được xác minh; các số dưới đây được tính từ giao dịch đã ghi nhận trong ứng dụng.",
          true,
        )
      : "") +
    `<div class="metrics">${metric("Giá trị đơn hàng", money(d.salesValue), "₫", "Đơn phát sinh trong kỳ · " + ((r?.configuration || state.configuration)?.revenueBasis === "INCLUDING_VAT" ? "Gồm VAT" : "Trước VAT"), "orders")}${metric("Đã thu xác nhận", money(r?.collectedCash || "0"), "₫", "Tiền thực thu trong kỳ · Gồm VAT", "cash", "emphasis")}${metric("Tỷ lệ thu đơn trong kỳ", percent(d.collectionRate), "", "Cùng nhóm đơn hàng · Lũy kế đến cuối kỳ", "chart")}${metric("Còn phải thu", money(d.outstanding), "₫", "Cùng nhóm đơn trong kỳ · Theo cơ sở doanh số", "clock", "orange")}${metric("Thưởng PM tính toán", money(r?.calculatedPm || "0"), "₫", "Giữ hiển thị dù chưa đạt chỉ tiêu", "bonus")}${metric("Thưởng PM phải trả", money(r?.payablePm || "0"), "₫", "Sau chỉ tiêu, làm tròn và điều chỉnh", "bonus", "emphasis")}${metric("Quỹ Support", money(r?.support.earned || "0"), "₫", "Quỹ kiếm được · Chưa làm tròn bộ phận", "staff")}${metric("Phần quỹ công ty", money(r?.companyEarned || "0"), "₫", "Phần kinh tế được ghi nhận trong kỳ", "policy")}</div><div class="grid-main">${panel("Đơn hàng cần đối soát", "Tìm đơn → ghi nhận thu → xác nhận khoản thu", orders.length && orders.every((o) => BigInt(o.confirmed_cash) >= BigInt(o.cash_net)) ? empty("Đã đối soát tất cả đơn hàng", "Không còn đơn cần thu tiền.") : orderTable(orders.filter((o) => BigInt(o.cash_net) > BigInt(o.confirmed_cash)).slice(0, 5), true), button("Xem tất cả", "collections", "quiet small"))}${panel("Công việc kế toán", "Ưu tiên tiền đã xác nhận", `<div class="panel-body"><div class="flow-card"><div class="big-icon">${icon("cash")}</div><div><h3>Đối soát thu tiền</h3><p>Ghi nhận nhiều khoản thu trên một đơn.<br>Chỉ khoản thu được xác nhận mới kiếm thưởng.</p>${button("Mở đối soát", "collections", "primary small")}</div></div><div class="kv"><span>Trạng thái kỳ</span>${badge(r?.period.state || "OPEN")}</div><div class="kv"><span>Thưởng PM kiếm được</span><strong>${money(r?.earnedPm || "0")} ₫</strong></div><div class="kv"><span>Hồ sơ lịch sử</span><strong>Chưa có workbook</strong></div><div class="steps"><span class="step">1</span>Đối soát <span>→</span><span class="step">2</span>Tính thưởng <span>→</span><span class="step">3</span>Khóa kỳ</div></div>`)}</div>${supportPanel(r)}`
  );
}
function supportPanel(report) {
  if (can("PM")) return "";
  const distribution = report?.configuration || state.configuration;
  const departments = report?.support.departments || {};
  return panel(
    "Phân bổ quỹ Support",
    "Tỷ lệ trong quỹ Support · Không phải tỷ lệ của toàn bộ quỹ còn lại",
    `<div class="panel-body">${["MKT", "ACCOUNTING", "LOGISTICS"].map((key, i) => `<div class="department"><div class="department-head"><span>${["Marketing", "Kế toán", "Kho vận"][i]} · ${percent(distribution?.supportShares[key] || "0")}</span><strong>${money(departments[key]?.netPayable || "0")} ₫</strong></div><div class="progress-line"><i data-width="${e(distribution?.supportShares[key] || "0")}"></i></div></div>`).join("")}<div class="help">Chênh lệch làm tròn bộ phận: ${money(report?.support.roundingDelta || "0")} ₫. Phân bổ đến từng cá nhân chưa được cấu hình.</div></div>`,
  );
}
async function ordersView(accounting) {
  if (can("SUPPORT_MANAGER"))
    return (
      heading("Đơn hàng", "Quyền xem được giới hạn theo vai trò.") +
      empty(
        "Không có quyền xem đơn hàng",
        "Vai trò quản lý Support chỉ xem quỹ bộ phận.",
      )
    );
  const orders = await api("orders");
  return (
    heading(
      accounting ? "Đối soát thu tiền" : "Đơn hàng",
      accounting
        ? "Ghi nhận và xác nhận khoản thu, phân bổ theo từng sản phẩm."
        : "Giá, chiết khấu và chính sách được lưu trên từng dòng đơn.",
      can("ADMIN", "ACCOUNTING", "SALES_MANAGER")
        ? button("Tạo đơn hàng", "order", "primary")
        : "",
    ) +
    prerequisites() +
    panel(
      accounting ? "Danh sách đối soát" : "Danh sách đơn hàng",
      orders.length + " đơn · Tiền thu theo giá trị gồm VAT",
      orderTable(orders, accounting),
      '<input class="search" id="order-search" placeholder="Tìm số đơn, khách hàng hoặc PM" aria-label="Tìm đơn hàng">',
    )
  );
}
async function bonusView(isReport = false) {
  if (!periodId)
    return (
      heading("Tính thưởng", "Tính thưởng theo khoản thu đã xác nhận.") +
      empty(
        "Chưa có kỳ tính thưởng",
        "Tạo kỳ và chỉ tiêu để bắt đầu.",
        "period",
        "Tạo kỳ",
      )
    );
  const r = await api("report?period=" + encodeURIComponent(periodId));
  const controls = can("ADMIN", "ACCOUNTING")
    ? r.period.state === "OPEN"
      ? button("Chuyển sang đối soát", "review", "primary")
      : r.period.state === "REVIEW"
        ? button("Khóa kỳ", "lock", "accent")
        : r.period.state === "LOCKED"
          ? button("Ghi nhận chi trả", "pay", "primary")
          : ""
    : "";
  return (
    heading(
      isReport ? "Báo cáo thưởng" : "Tính thưởng",
      `Kỳ ${periodId} · ${stateLabels[r.period.state]} · Kết quả giải thích được theo từng dòng đơn.`,
      controls,
    ) +
    (!r.canLock && ["OPEN", "REVIEW"].includes(r.period.state)
      ? notice(
          "Chưa đủ điều kiện khóa. Kiểm tra chỉ tiêu PM, chi phí đang chờ duyệt và các khoản thu hồi vượt thưởng kỳ này.",
        )
      : "") +
    (r.warnings.length
      ? notice("Cảnh báo: " + e(warningText(r.warnings)))
      : "") +
    `<div class="metrics">${metric("Thu được tính chỉ tiêu", money(r.collectedRevenue), "₫", "Theo cơ sở doanh số đã lưu trên đơn", "cash", "emphasis")}${metric("PM kiếm được", money(r.earnedPm), "₫", "Không mất đi khi chưa đạt chỉ tiêu", "bonus")}${metric("PM phải trả", money(r.payablePm), "₫", "Sau làm tròn và điều chỉnh", "bonus", "emphasis")}${metric("Quỹ âm giữ nguyên", money(r.companyLossUnallocated), "₫", "Thưởng nhân sự bằng 0 · Giữ rõ phần âm", "warning", "orange")}</div>${panel("Kết quả PM", "Chỉ khoản thu xác nhận được ghi nhận vào thưởng", r.pms.length ? table(["PM", "Chỉ tiêu", "Đã thu theo chỉ tiêu", "Thưởng tính toán", "Thưởng kiếm được", "Phải trả", "Trạng thái"], r.pms.map((p) => `<tr><td><strong>${e(p.name)}</strong><small>Làm tròn: ${money(p.roundingDelta)} ₫ · Điều chỉnh: ${money(p.adjustment || "0")} ₫</small></td><td class="amount">${money(p.target)} ₫</td><td class="amount">${money(p.collectedRevenue)} ₫</td><td class="amount">${money(p.calculated)} ₫</td><td class="amount">${money(p.earned)} ₫</td><td class="amount">${money(p.netPayable ?? p.payable)} ₫</td><td>${badge(p.qualified === null ? "PENDING" : p.qualified ? "APPROVED" : "DRAFT")}</td></tr>`).join("")) : empty("Chưa có kết quả PM", "Cần đơn hàng và khoản thu trong kỳ."), button("Xuất báo cáo", "export", "small"))}<div class="section-stack">${supportPanel(r)}${panel("Chi tiết cách tính", "Từ đơn hàng và sản phẩm đến quỹ còn lại, khoản thu và thưởng", r.lines.length ? table(["Đơn hàng / sản phẩm", "Giá trị niêm yết", "Chiết khấu", "Quỹ quản lý", "Quỹ còn lại", "PM kiếm được kỳ này", ""], r.lines.map((l) => `<tr><td><strong>${e(l.orderNumber)}</strong><small>${e(l.productName)}</small></td><td class="amount">${money(l.closing.grossListValue)}</td><td class="amount">${money(l.closing.discountAmount)}</td><td class="amount">${money(l.closing.managementPool)}<small>${percent(l.sourceInput.poolSnapshot.rate)} · v${e(l.sourceInput.poolSnapshot.policyVersion)}</small></td><td class="amount">${money(l.closing.rawResidual)}</td><td class="amount">${money(l.period.earned.pm)}</td><td>${button("Xem cách tính", "explain", "small", `data-id="${e(l.itemId)}"`)}</td></tr>`).join("")) : empty("Chưa có dòng tính thưởng", "Không có dữ liệu được tạo giả."))}</div>`
  );
}
async function staffView() {
  return (
    heading(
      "Nhân sự",
      "Quản lý đội ngũ, quyền truy cập và chỉ tiêu thu tiền theo kỳ.",
      can("ADMIN", "EXECUTIVE")
        ? button("Thêm nhân sự", "employee", "primary")
        : "",
    ) +
    panel(
      "Đội ngũ",
      "Chỉ tiêu theo kỳ · Doanh số thu tiền xác nhận",
      state.staff.length
        ? table(
            ["Nhân sự", "Mã", "Quyền truy cập", "Chỉ tiêu kỳ hiện tại", ""],
            state.staff
              .map((s) => {
                const t = state.targets
                  .filter(
                    (t) => t.employee_id === s.id && t.period_id === periodId,
                  )
                  .sort((a, b) => b.version - a.version)[0];
                return `<tr><td><strong>${e(s.name)}</strong></td><td>${e(s.code)}</td><td>${e(roleLabels[s.role] || "Chưa có tài khoản")}</td><td class="amount">${money(t?.amount)} ₫</td><td>${can("ADMIN", "EXECUTIVE") ? button("Giao chỉ tiêu", "target", "small", `data-id="${e(s.id)}"`) : ""}</td></tr>`;
              })
              .join(""),
          )
        : empty(
            "Chưa có nhân sự",
            "Thêm PM để gắn đơn hàng và chỉ tiêu.",
            can("ADMIN", "EXECUTIVE") ? "employee" : "",
            "Thêm nhân sự",
          ),
    )
  );
}
async function policiesView() {
  return (
    heading(
      "Chính sách thưởng",
      "Tạo phiên bản mới; đơn hàng cũ tiếp tục dùng snapshot đã lưu.",
      can("ADMIN", "EXECUTIVE")
        ? button("Chính sách quỹ", "pool-policy", "primary") +
            button("Nhóm sản phẩm", "group", "small")
        : "",
    ) +
    `<div class="split">${panel("Quỹ quản lý PM", "PRODUCT > PRODUCT_GROUP > ALL", state.policies.management.length ? table(["Phạm vi", "Tỷ lệ", "Hiệu lực", "Phiên bản"], state.policies.management.map((p) => `<tr><td>${e(p.scope)}<small>${e(state.catalog.find((c) => c.id === p.product_id)?.name || state.groups.find((g) => g.id === p.product_group_id)?.name || "Toàn bộ sản phẩm")}</small></td><td>${percent(p.pool_rate)}</td><td>${e(p.effective_from)}</td><td>v${e(p.version)}</td></tr>`).join("")) : empty("Chưa có chính sách quỹ", "Không tự áp dụng 45% khi chưa được cấu hình."), can("ADMIN", "EXECUTIVE") ? button("Tạo phiên bản", "pool-policy", "small") : "")}${panel("Chia quỹ còn lại", "Tổng PM + Support + Công ty phải bằng 100%", state.policies.bonus.length ? table(["PM", "Support", "Công ty", "Hiệu lực"], state.policies.bonus.map((p) => `<tr><td>${percent(p.pm_share)}</td><td>${percent(p.support_share)}</td><td>${percent(p.company_share)}</td><td>${e(p.effective_from)}<small>v${e(p.version)}</small></td></tr>`).join("")) : empty("Chưa có tỷ lệ chia thưởng", "Các tỷ lệ trong chỉ dẫn là ví dụ cấu hình."), can("ADMIN", "EXECUTIVE") ? button("Tạo phiên bản", "bonus-policy", "small") : "")}</div><div class="section-stack">${panel("Danh mục và giá niêm yết", "46 dòng từ báo giá 10/01/2025 · Dữ liệu tạm tính, chưa coi là giá hiện hành", table(["Sản phẩm / JAN nguồn", "Quy cách", "Giá niêm yết", "VAT nguồn", "Phiên bản", ""], state.catalog.map((p) => `<tr><td><strong>${e(p.name)}</strong><small>${e(p.jan_source)} · ${e(p.sku)}</small></td><td>${e(p.latest_price?.pack)}</td><td class="amount">${money(p.latest_price?.input_amount)} ₫<small>${p.latest_price?.tax_basis === "INCLUDING_VAT" ? "Đã gồm VAT" : "Trước VAT"}</small></td><td>${percent(p.latest_price?.vat_rate || "0")}</td><td>${badge(p.latest_price?.status)}<small>v${e(p.latest_price?.version)} ${e(p.latest_price?.effective_from || "")}</small></td><td>${can("ADMIN", "EXECUTIVE") ? button("Thay đổi giá", "price", "small", `data-id="${e(p.id)}"`) : ""}</td></tr>`).join("")))}</div>`
  );
}
async function integrationView() {
  const d = await api("integration");
  return (
    heading(
      "Kết nối AMIS CRM",
      "CRM giữ dữ liệu vận hành; ứng dụng này quản lý thu tiền và thưởng.",
    ) +
    notice(
      "<strong>Chưa kết nối AMIS.</strong> Chưa có thông tin tenant và payload được xác minh. Nhập thủ công đang hoạt động độc lập.",
    ) +
    `<div class="split">${panel("Trạng thái kết nối", "Không hiển thị trạng thái thành công giả", `<div class="panel-body"><div class="kv"><span>AMIS CRM</span>${badge("PENDING")}</div><div class="kv"><span>Nguồn đơn hàng</span><strong>Nhập thủ công</strong></div><div class="kv"><span>Webhook</span><strong>Chưa xác minh giao thức</strong></div><div class="kv"><span>Đối chiếu định kỳ</span><strong>Chưa có adapter thật</strong></div><div class="kv"><span>Workbook lịch sử</span><strong>Chưa cung cấp</strong></div></div>`)}${panel("Cần xác minh trước khi kết nối", "API discovery đã được ghi thành tài liệu", `<div class="panel-body"><p class="subtitle-line">${e(d.reason)} Không nhập client_secret hoặc token vào giao diện khi chưa có adapter server được xác minh.</p>${["ID ổn định của đơn, dòng đơn, sản phẩm và owner", "Giá niêm yết lịch sử và chiết khấu nguồn", "Cơ sở VAT và cấu trúc giá", "Chữ ký, retry và định danh webhook"].map((t) => `<div class="kv"><span>${e(t)}</span>${icon("clock")}</div>`).join("")}</div>`)}</div>`
  );
}
async function systemView() {
  const audits = can("ADMIN", "ACCOUNTING", "EXECUTIVE", "AUDITOR")
    ? await api("audit")
    : [];
  const adjustments = can("ADMIN", "ACCOUNTING", "EXECUTIVE", "AUDITOR")
    ? await api("adjustments")
    : [];
  return (
    heading(
      "Hệ thống",
      "Quy tắc có phiên bản, nhật ký tài chính và điều chỉnh sau khóa kỳ.",
      can("ADMIN", "EXECUTIVE")
        ? button("Cấu hình quy tắc", "configure", "primary") +
            (can("ADMIN") ? button("Sao lưu dữ liệu", "backup", "small") : "")
        : "",
    ) +
    `<div class="split">${panel("Kỳ tính thưởng", "OPEN → REVIEW → LOCKED → PAID", state.periods.length ? table(["Kỳ", "Khoảng thời gian", "Trạng thái"], state.periods.map((p) => `<tr><td>${e(p.id)}</td><td>${e(p.starts_on)} → ${e(p.ends_on)}</td><td>${badge(p.state)}</td></tr>`).join("")) : empty("Chưa tạo kỳ", "Cần cấu hình cơ sở tính trước."), can("ADMIN", "ACCOUNTING") ? button("Tạo kỳ", "period", "small") : "")}${panel("Quy tắc đang dùng", "Mỗi kỳ lưu snapshot cấu hình", `<div class="panel-body"><div class="kv"><span>Doanh số</span><strong>${state.configuration ? (state.configuration.revenueBasis === "EXCLUDING_VAT" ? "Trước VAT" : "Gồm VAT") : "Chưa cấu hình"}</strong></div><div class="kv"><span>Cơ sở quỹ</span><strong>${state.configuration ? (state.configuration.poolBasis === "EXCLUDING_VAT" ? "Giá trước VAT" : "Giá gồm VAT") : "Cần chọn"}</strong></div><div class="kv"><span>Làm tròn thưởng</span><strong>Lên ${money(state.configuration?.roundingQuantumVnd || "1000")} ₫</strong></div><div class="kv"><span>Phê duyệt chi phí / điều chỉnh</span><strong>Giám đốc / Admin</strong></div><div class="kv"><span>Múi giờ kế toán</span><strong>${e(state.configuration?.timezone || "Chưa chọn")}</strong></div></div>`)}</div><div class="section-stack">${panel("Điều chỉnh hoàn tiền sau khóa", "Cấn trừ thưởng đã nhận; cần Giám đốc/Admin duyệt", adjustments.length ? table(["Lý do", "Kỳ gốc → kỳ áp dụng", "Cấn trừ", "Trạng thái", ""], adjustments.map((a) => `<tr><td>${e(a.reason)}</td><td>${e(a.source_period_id)} → ${e(a.application_period_id)}</td><td class="amount">${money(a.amount)} ₫</td><td>${badge(a.status)}</td><td>${a.status === "PENDING" && can("ADMIN", "EXECUTIVE") ? button("Duyệt / Điều chỉnh", "approve-adjustment", "small", `data-id="${e(a.id)}" data-amount="${e(String(a.amount).replace("-", ""))}"`) + button("Từ chối", "reject-adjustment", "small", `data-id="${e(a.id)}"`) : ""}</td></tr>`).join("")) : empty("Chưa có điều chỉnh", "Lịch sử quyết toán đã khóa không bị sửa lại."), can("ADMIN", "ACCOUNTING") ? button("Ghi nhận hoàn tiền", "refund", "small") : "")}${panel("Nhật ký tài chính", "Chỉ đọc · 200 sự kiện gần nhất", audits.length ? table(["Thời gian", "Hành động", "Đối tượng", "Lý do", ""], audits.map((a) => `<tr><td>${e(String(a.occurred_at).slice(0, 19).replace("T", " "))}</td><td>${e(a.action)}</td><td>${e(a.entity_type)}<small>${e(a.entity_id.slice(0, 12))}</small></td><td>${e(a.reason || "—")}</td><td>${button("Xem", "audit-detail", "small", `data-id="${e(a.id)}"`)}</td></tr>`).join("")) : empty("Nhật ký được phân quyền", "PM và Support không có quyền xem nhật ký toàn công ty."))}</div>`
  );
}
let renderRevision = 0;
async function render() {
  const revision = ++renderRevision;
  const views = {
    overview,
    orders: () => ordersView(false),
    collections: () => ordersView(true),
    bonus: () => bonusView(false),
    reports: () => bonusView(true),
    staff: staffView,
    policies: policiesView,
    integration: integrationView,
    system: systemView,
  };
  try {
    const content = await (views[page] || overview)();
    if (!state || revision !== renderRevision) return;
    shell(content);
    document.querySelectorAll("[data-width]").forEach((node) => {
      const [n, d] = rational(node.dataset.width);
      node.style.width = String((n * 100n) / d) + "%";
    });
  } catch (err) {
    if (!state || revision !== renderRevision) return;
    shell(
      heading(nav.find((n) => n[0] === page)?.[1] || "Ứng dụng", "") +
        notice(e(err.message)) +
        button("Tải lại", "retry", "primary"),
    );
  }
}
function orderLine() {
  return `<div class="line-row"><div><label>Sản phẩm</label><select name="productId" required aria-label="Sản phẩm dòng đơn">${productOptions()
    .map(([v, l]) => `<option value="${e(v)}">${e(l)}</option>`)
    .join(
      "",
    )}</select></div><div><label>Số lượng</label><input name="quantity" value="1" inputmode="numeric" required aria-label="Số lượng"></div><div><label>CK gồm VAT (₫)</label><input name="discountAmount" value="0" inputmode="numeric" required aria-label="Chiết khấu gồm VAT"></div><button type="button" class="remove" data-action="remove-line" aria-label="Xóa dòng">×</button></div>`;
}
async function action(key, node) {
  if (key === "close") {
    modal.close();
    return;
  }
  if (key === "retry") {
    await start();
    return;
  }
  if (key === "menu") {
    document.querySelector(".sidebar").classList.toggle("open");
    return;
  }
  if (key === "logout") {
    await api("auth/logout", {});
    state = null;
    authScreen(false);
    return;
  }
  if (key === "collections") {
    page = "collections";
    location.hash = page;
    await render();
    return;
  }
  if (key === "configure") {
    const c = state.configuration;
    openModal(
      "Quy tắc tài chính",
      notice(
        "Chọn rõ các quy tắc dưới đây. Thay đổi tạo phiên bản mới, áp dụng cho kỳ tạo sau; kỳ cũ giữ snapshot.",
      ) +
        form(
          "configuration",
          select(
            "poolBasis",
            "Giá làm cơ sở quỹ",
            [
              ["", "Cần chọn"],
              ["EXCLUDING_VAT", "Giá niêm yết trước VAT"],
              ["INCLUDING_VAT", "Giá niêm yết gồm VAT"],
            ],
            c?.poolBasis || "",
          ) +
            select(
              "revenueBasis",
              "Cơ sở doanh số",
              [
                ["EXCLUDING_VAT", "Trước VAT"],
                ["INCLUDING_VAT", "Gồm VAT"],
              ],
              c?.revenueBasis || "EXCLUDING_VAT",
            ) +
            select(
              "timezone",
              "Múi giờ kế toán",
              [
                ["", "Cần chọn"],
                ["Asia/Ho_Chi_Minh", "Việt Nam"],
                ["Asia/Tokyo", "Nhật Bản"],
              ],
              c?.timezone || "",
            ) +
            select(
              "recognition",
              "Thu từng phần",
              [
                ["", "Cần chọn"],
                ["PRO_RATA_NET", "Theo tỷ lệ giá trị thu / giá trị đơn"],
              ],
              c?.recognition || "",
            ) +
            select(
              "bonusPolicyTiming",
              "Ngày áp dụng chính sách chia thưởng",
              [
                ["", "Cần chọn"],
                ["ORDER_DATE", "Ngày đơn hàng (lưu snapshot)"],
              ],
              c?.bonusPolicyTiming || "",
            ) +
            select(
              "expenseRecognition",
              "Ghi nhận chi phí cho thưởng",
              [
                ["", "Cần chọn"],
                [
                  "PRO_RATA_WITH_COLLECTION",
                  "Trừ chi phí trên toàn đơn, kiếm theo tỷ lệ thu",
                ],
              ],
              c?.expenseRecognition || "",
            ) +
            field(
              "mktPercent",
              "MKT (%)",
              c
                ? percent(c.supportShares.MKT)
                    .replace("%", "")
                    .replace(",", ".")
                : "60",
            ) +
            field(
              "accountingPercent",
              "Kế toán (%)",
              c
                ? percent(c.supportShares.ACCOUNTING)
                    .replace("%", "")
                    .replace(",", ".")
                : "20",
            ) +
            field(
              "logisticsPercent",
              "Kho vận (%)",
              c
                ? percent(c.supportShares.LOGISTICS)
                    .replace("%", "")
                    .replace(",", ".")
                : "20",
            ) +
            field(
              "roundingQuantumVnd",
              "Làm tròn lên (₫)",
              c?.roundingQuantumVnd || "1000",
              "text",
              "Chênh lệch được hiển thị riêng.",
            ),
        ),
    );
    return;
  }
  if (key === "period") {
    openModal(
      "Tạo kỳ tính thưởng",
      form(
        "periods",
        field("id", "Mã kỳ (ví dụ 2026-10)") +
          field("start", "Ngày bắt đầu", "", "date") +
          field(
            "end",
            "Ngày kết thúc (không bao gồm)",
            "",
            "date",
            "Ví dụ kỳ tháng 10 kết thúc tại 01/11.",
          ),
      ),
    );
    return;
  }
  if (key === "employee") {
    openModal(
      "Thêm nhân sự",
      form(
        "staff",
        field("name", "Họ tên") +
          field("code", "Mã nhân sự") +
          field(
            "login",
            "Tên đăng nhập (tùy chọn)",
            "",
            "text",
            "Để trống nếu chỉ cần danh sách nhân sự.",
            false,
          ) +
          select(
            "role",
            "Vai trò tài khoản",
            Object.entries(roleLabels),
            "PM",
          ) +
          field(
            "password",
            "Mật khẩu tài khoản",
            "",
            "password",
            "Không cần nếu không tạo tài khoản.",
            false,
          ),
      ),
    );
    return;
  }
  if (key === "target") {
    openModal(
      "Chỉ tiêu thu tiền",
      form(
        "targets",
        select("employeeId", "Nhân sự", staffOptions(), node.dataset.id) +
          select("periodId", "Kỳ áp dụng", periodOptions(true), periodId) +
          field(
            "amount",
            "Chỉ tiêu doanh số thu tiền (₫)",
            "",
            "text",
            "Theo cơ sở doanh số của kỳ, chưa làm tròn.",
          ),
      ),
    );
    return;
  }
  if (key === "group") {
    openModal(
      "Nhóm sản phẩm",
      form(
        "groups",
        select(
          "groupId",
          "Nhóm hiện có",
          [["", "Tạo nhóm mới"], ...state.groups.map((g) => [g.id, g.name])],
          "",
          "",
          false,
        ) +
          field(
            "name",
            "Tên nhóm mới",
            "",
            "text",
            "Để trống khi gán vào nhóm hiện có.",
            false,
          ) +
          `<div class="form-field full"><label for="f-productIds">Sản phẩm muốn gán</label><select id="f-productIds" name="productIds" multiple size="8">${state.catalog.map((p) => `<option value="${e(p.id)}">${e(p.name)}</option>`).join("")}</select><div class="help">Chọn nhiều sản phẩm bằng Command/Ctrl. Chỉ áp dụng nhóm cho đơn mới.</div></div>`,
      ),
    );
    return;
  }
  if (key === "pool-policy") {
    openModal(
      "Phiên bản quỹ quản lý",
      form(
        "pool-policy",
        select("scope", "Phạm vi", [
          ["ALL", "Toàn bộ sản phẩm"],
          ["PRODUCT", "Một sản phẩm"],
          ["PRODUCT_GROUP", "Nhóm sản phẩm"],
        ]) +
          select(
            "scopeId",
            "Sản phẩm / Nhóm",
            [
              ...productOptions(),
              ...state.groups.map((g) => [g.id, "Nhóm: " + g.name]),
            ],
            "",
            "Chỉ dùng khi chọn sản phẩm hoặc nhóm.",
            false,
          ) +
          field(
            "percent",
            "Tỷ lệ quỹ (%)",
            "",
            "text",
            "Không có tỷ lệ mặc định.",
          ) +
          field("effectiveFrom", "Hiệu lực từ", "", "date") +
          field("reason", "Lý do / chứng từ"),
      ),
    );
    return;
  }
  if (key === "bonus-policy") {
    openModal(
      "Phiên bản chia thưởng",
      form(
        "bonus-policy",
        field("pmPercent", "PM (%)") +
          field("supportPercent", "Support (%)") +
          field("companyPercent", "Công ty (%)") +
          field("effectiveFrom", "Hiệu lực từ", "", "date") +
          field("reason", "Lý do"),
      ),
    );
    return;
  }
  if (key === "price") {
    const p = state.catalog.find((p) => p.id === node.dataset.id),
      v = p.latest_price;
    openModal(
      "Thay đổi giá niêm yết",
      notice(
        "Giá nhập theo " +
          e(p.name) +
          ". Bảng giá gốc năm 2025 chỉ dùng tạm tính; duyệt ngày áp dụng rõ ràng. " +
          e(v.change_reason || ""),
      ) +
        form(
          "prices",
          `<input type="hidden" name="productId" value="${e(p.id)}">` +
            field("amount", "Giá niêm yết (₫)", v.input_amount) +
            field("pack", "Quy cách", v.pack) +
            select(
              "taxBasis",
              "Giá nhập",
              [
                ["INCLUDING_VAT", "Đã gồm VAT"],
                ["EXCLUDING_VAT", "Trước VAT"],
              ],
              v.tax_basis,
            ) +
            field(
              "vatPercent",
              "VAT (%)",
              percent(v.vat_rate).replace("%", "").replace(",", "."),
            ) +
            field("effectiveFrom", "Ngày áp dụng", "", "date") +
            field("reason", "Lý do / nguồn giá"),
        ),
    );
    return;
  }
  if (key === "order") {
    openModal(
      "Tạo đơn hàng thủ công",
      form(
        "orders",
        field("number", "Số đơn hàng") +
          field("date", "Ngày đơn", today(), "date") +
          field("customerName", "Khách hàng") +
          select("pmId", "PM phụ trách", staffOptions()) +
          `<div class="form-field full"><label>Sản phẩm và chiết khấu giao dịch</label><div id="order-lines">${orderLine()}</div>${button("Thêm sản phẩm", "add-line", "small")}<div class="help">Chọn sản phẩm đã duyệt giá. Chiết khấu nhập tại giao dịch; không tự lấy CK 25%/30% từ bảng giá.</div></div>`,
      ),
    );
    return;
  }
  if (key === "add-line") {
    document
      .querySelector("#order-lines")
      .insertAdjacentHTML("beforeend", orderLine());
    return;
  }
  if (key === "remove-line") {
    if (document.querySelectorAll(".line-row").length > 1)
      node.closest(".line-row").remove();
    return;
  }
  if (key === "order-detail") {
    await orderDetails(node.dataset.id);
    return;
  }
  if (key === "payment") {
    openModal(
      "Ghi nhận khoản thu",
      form(
        "payments",
        `<input type="hidden" name="orderId" value="${e(node.dataset.id)}">` +
          field("amount", "Số tiền thực thu gồm VAT (₫)") +
          field("date", "Ngày thu", today(), "date") +
          select("method", "Phương thức", [
            ["TRANSFER", "Chuyển khoản"],
            ["CASH", "Tiền mặt"],
            ["OTHER", "Khác"],
          ]) +
          field("reference", "Mã tham chiếu duy nhất") +
          field(
            "evidence",
            "Chứng từ / tham chiếu",
            "",
            "text",
            "Không tải tệp nhạy cảm lên bản cục bộ.",
            false,
          ) +
          field("note", "Ghi chú", "", "text", "", false),
        "Lưu khoản thu nháp",
      ),
    );
    return;
  }
  if (key === "confirm-payment") {
    await api("payments/" + node.dataset.id + "/confirm", {});
    toast("Đã xác nhận khoản thu.");
    await refresh();
    await orderDetails(node.dataset.order);
    return;
  }
  if (key === "reverse-payment") {
    openModal(
      "Đảo khoản thu",
      notice(
        "Khoản thu gốc giữ nguyên. Không đảo trực tiếp khoản thu thuộc kỳ đã đóng; dùng điều chỉnh hoàn tiền.",
      ) +
        form(
          "reverse-payment",
          `<input type="hidden" name="paymentId" value="${e(node.dataset.id)}">` +
            field("date", "Ngày đảo", today(), "date") +
            field("reason", "Lý do"),
        ),
    );
    return;
  }
  if (key === "manual-allocation") {
    const d = await api("orders/" + node.dataset.order);
    const p = d.payments.find((p) => p.id === node.dataset.id);
    openModal(
      "Xác nhận với phân bổ thủ công",
      form(
        "manual-allocation",
        `<input type="hidden" name="paymentId" value="${e(p.id)}"><div class="form-field full"><div class="help">Tổng phải bằng ${money(p.amount)} ₫.</div></div>` +
          d.items
            .map((i) => field("alloc-" + i.id, i.product_name, "0"))
            .join("") +
          field("reason", "Lý do phân bổ thủ công"),
      ),
    );
    return;
  }
  if (key === "expense") {
    const d = await api("orders/" + node.dataset.id);
    openModal(
      "Chi phí đủ điều kiện",
      form(
        "expenses",
        `<input type="hidden" name="orderId" value="${e(node.dataset.id)}">` +
          select(
            "itemId",
            "Dòng sản phẩm",
            d.items.map((i) => [i.id, i.product_name]),
          ) +
          select("category", "Loại chi phí", [
            ["MARKETING_SUPPORT", "Hỗ trợ Marketing"],
            ["DEALER_INCENTIVE", "Thưởng đại lý"],
            ["SALES_INCENTIVE", "Thưởng Sales"],
            ["OTHER", "Khác"],
            ["RESERVE", "Dự phòng"],
          ]) +
          field("amount", "Số tiền theo cơ sở quỹ của đơn (₫)") +
          field("evidence", "Chứng từ / lý do"),
      ),
    );
    return;
  }
  if (key === "approve-expense") {
    await api("expenses/" + node.dataset.id + "/approve", {});
    toast("Đã duyệt chi phí.");
    await refresh();
    modal.close();
    return;
  }
  if (key === "explain") {
    const r = await api("report?period=" + encodeURIComponent(periodId)),
      line = r.lines.find((l) => l.itemId === node.dataset.id);
    openModal(
      "Xem cách tính",
      `<div class="subtitle-line">${e(line.orderNumber)} · ${e(line.productName)}</div>${[
        ["Giá trị niêm yết", line.closing.grossListValue],
        ["Chiết khấu giao dịch", line.closing.discountAmount],
        ["Giá trị thu theo cơ sở quỹ", line.closing.netSalesValue],
        [
          "Quỹ quản lý · " + percent(line.sourceInput.poolSnapshot.rate),
          line.closing.managementPool,
        ],
        ["Quỹ còn lại (giữ nguyên nếu âm)", line.closing.rawResidual],
        ["Thu được ghi nhận kỳ này", line.period.collectedEligible],
        ["PM tính toán", line.closing.calculated.pm],
        ["PM kiếm được kỳ trước (lũy kế)", line.opening.earned.pm],
        ["PM kiếm được kỳ này", line.period.earned.pm],
        ["Support kiếm được kỳ này", line.period.earned.support],
        ["Công ty kiếm được kỳ này", line.period.earned.company],
      ]
        .map(
          ([label, value]) =>
            `<div class="kv"><span>${e(label)}</span><strong>${money(value)} ₫<small class="help">${e(value)} (chính xác)</small></strong></div>`,
        )
        .join(
          "",
        )}<h3>Chứng cứ và snapshot</h3><pre class="data-block">${e(JSON.stringify(line, null, 2))}</pre>`,
    );
    return;
  }
  if (key === "review") {
    openModal(
      "Chuyển kỳ sang đối soát",
      notice(
        "Kiểm tra khoản thu, duyệt chi phí và giao chỉ tiêu trước khi chuyển. Kỳ REVIEW dừng ghi thêm giao dịch.",
      ) +
        form(
          "review",
          '<div class="form-field full"><p class="help">Kỳ ' +
            e(periodId) +
            ". Bước tiếp theo là khóa snapshot.</p></div>",
          "Chuyển sang REVIEW",
        ),
    );
    return;
  }
  if (key === "lock") {
    openModal(
      "Khóa kỳ tính thưởng",
      notice(
        "Lưu snapshot bất biến. Sau khi khóa, sửa sai dùng điều chỉnh có phê duyệt.",
      ) +
        form(
          "lock",
          '<div class="form-field full"><label class="check-row"><input type="checkbox" name="acknowledgeWarnings" required>Tôi đã đối soát số liệu và xem các cảnh báo quỹ âm / chiết khấu vượt quỹ.</label></div>',
          "Khóa kỳ",
        ),
    );
    return;
  }
  if (key === "pay") {
    openModal(
      "Ghi nhận chi trả thưởng",
      form(
        "pay",
        field(
          "evidence",
          "Tham chiếu chi trả",
          "",
          "text",
          "Ghi nhận tất cả khoản phải trả của kỳ; không sửa snapshot.",
        ),
        "Đánh dấu đã chi trả",
      ),
    );
    return;
  }
  if (key === "refund") {
    const settlements = await api("settlements"),
      orders = await api("orders");
    openModal(
      "Hoàn tiền sau khóa kỳ",
      notice(
        "Chọn quyết toán đã chi trả. Số thưởng thu hồi nhập rõ để Giám đốc/Admin xem và điều chỉnh; không tự coi tiền khách được hoàn là tiền thưởng cần thu hồi.",
      ) +
        form(
          "refunds",
          select(
            "settlementId",
            "Quyết toán nhận thưởng",
            settlements
              .filter(
                (s) =>
                  s.recipient_type !== "COMPANY" &&
                  s.period_state === "PAID" &&
                  BigInt(s.paid_amount) > 0n,
              )
              .map((s) => [
                s.id,
                s.period_id +
                  " · " +
                  s.recipient_type +
                  " " +
                  (state.staff.find((e) => e.id === s.recipient_id)?.name ||
                    s.recipient_id) +
                  " · " +
                  money(s.paid_amount) +
                  " ₫",
              ]),
          ) +
            select(
              "orderId",
              "Đơn hoàn tiền",
              orders.map((o) => [o.id, o.order_number]),
            ) +
            select("applicationPeriodId", "Kỳ cấn trừ", periodOptions(true)) +
            field("date", "Ngày hoàn", today(), "date") +
            field("refundAmount", "Tiền hoàn khách (₫)") +
            field("recoveryAmount", "Thưởng đề nghị thu hồi (₫)") +
            field("reason", "Lý do") +
            field("evidence", "Chứng từ"),
          "Gửi đề nghị duyệt",
        ),
    );
    return;
  }
  if (key === "approve-adjustment") {
    openModal(
      "Duyệt / Điều chỉnh thu hồi",
      form(
        "approve-adjustment",
        `<input type="hidden" name="adjustmentId" value="${e(node.dataset.id)}">` +
          field(
            "recoveryAmount",
            "Số thưởng thu hồi (₫)",
            node.dataset.amount,
          ) +
          select(
            "applicationPeriodId",
            "Kỳ cấn trừ được duyệt",
            periodOptions(true),
            periodId,
            "Có thể chọn kỳ mở sau nếu thưởng kỳ này chưa đủ.",
          ) +
          field("reason", "Lý do phê duyệt / điều chỉnh"),
      ),
    );
    return;
  }
  if (key === "audit-detail") {
    const audits = await api("audit"),
      record = audits.find((a) => a.id === node.dataset.id);
    openModal(
      "Nhật ký tài chính",
      `<pre class="data-block">${e(JSON.stringify(record, null, 2))}</pre>`,
    );
    return;
  }
  if (key === "reject-expense" || key === "reject-adjustment") {
    openModal(
      "Từ chối đề nghị",
      form(
        key,
        `<input type="hidden" name="entityId" value="${e(node.dataset.id)}">` +
          field("reason", "Lý do từ chối"),
        "Từ chối đề nghị",
      ),
    );
    return;
  }
  if (key === "backup") {
    const res = await fetch("/api/backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!res.ok) {
      const result = await res.json();
      throw new Error(result.error);
    }
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = "sales-bonus-backup-" + today() + ".tar.gz";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Đã xuất bản sao lưu. Lưu tệp ở nơi riêng tư.");
    return;
  }
  if (key === "export") {
    const report = await api("report?period=" + encodeURIComponent(periodId));
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "thuong-" + periodId.replace(/[^a-zA-Z0-9-]/g, "") + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
}
async function orderDetails(orderId) {
  const d = await api("orders/" + orderId);
  openModal(
    "Đơn " + d.order.order_number,
    `<div class="detail-heading"><div class="subtitle-line">${e(d.order.customer_name)} · PM ${e(d.order.pm_name)} · ${e(d.order.order_date)}</div>${can("ADMIN", "ACCOUNTING") ? button("Ghi nhận thu", "payment", "primary small", `data-id="${e(orderId)}"`) : ""}</div><div class="kv"><span>Giá trị thu tiền (gồm VAT)</span><strong>${money(d.order.cash_net)} ₫</strong></div><div class="kv"><span>Đã thu xác nhận</span><strong>${money(d.order.confirmed_cash)} ₫</strong></div><h3>Dòng sản phẩm</h3>${table(["Sản phẩm", "Số lượng", "Giá trị thu", "Quỹ"], d.items.map((i) => `<tr><td>${e(i.product_name)}</td><td>${e(i.quantity)}</td><td>${money(i.net_sales_value_source)} ₫</td><td>${percent(i.pool_rate_snapshot)}<small>v${e(i.pool_policy_version)}</small></td></tr>`).join(""))}<h3>Khoản thu</h3>${d.payments.length ? table(["Ngày / Tham chiếu", "Số tiền", "Trạng thái", ""], d.payments.map((p) => `<tr><td>${e(p.payment_date)}<small>${e(p.reference_number)}</small></td><td>${money(p.amount)} ₫</td><td>${badge(p.is_reversed ? "REVERSED" : p.status)}</td><td><div class="actions">${can("ADMIN", "ACCOUNTING") && p.status === "DRAFT" ? button("Xác nhận", "confirm-payment", "primary small", `data-id="${e(p.id)}" data-order="${e(orderId)}"`) + button("Phân bổ", "manual-allocation", "small", `data-id="${e(p.id)}" data-order="${e(orderId)}"`) : can("ADMIN", "ACCOUNTING") && p.status === "CONFIRMED" && !p.is_reversed ? button("Đảo", "reverse-payment", "danger small", `data-id="${e(p.id)}"`) : ""}</div></td></tr>`).join("")) : empty("Chưa có khoản thu", "Nháp không tham gia tính thưởng.")}<h3>Chi phí</h3>${can("ADMIN", "ACCOUNTING", "PM", "SALES_MANAGER") ? button("Thêm chi phí", "expense", "small", `data-id="${e(orderId)}"`) : ""}${d.expenses.length ? table(["Loại", "Số tiền", "Trạng thái", ""], d.expenses.map((x) => `<tr><td>${e(x.category)}</td><td>${money(x.amount)} ₫</td><td>${badge(x.status)}</td><td>${x.status === "PENDING" && can("ADMIN", "EXECUTIVE") ? button("Duyệt", "approve-expense", "small", `data-id="${e(x.id)}"`) + button("Từ chối", "reject-expense", "small", `data-id="${e(x.id)}"`) : ""}</td></tr>`).join("")) : '<p class="help">Chi phí được nhập theo cơ sở quỹ của đơn; chỉ chi phí đã duyệt mới được trừ.</p>'}`,
  );
}
document.addEventListener("click", (event) => {
  const node = event.target.closest("button");
  if (!node) return;
  if (node.dataset.page) {
    page = node.dataset.page;
    location.hash = page;
    void render();
    return;
  }
  if (node.dataset.action)
    void action(node.dataset.action, node).catch((err) => toast(err.message));
});
document.addEventListener("change", (event) => {
  if (event.target.id === "period-picker") {
    periodId = event.target.value;
    void render();
  }
});
document.addEventListener("input", (event) => {
  if (event.target.id === "order-search") {
    const needle = event.target.value.toLocaleLowerCase("vi");
    document
      .querySelectorAll("tbody tr")
      .forEach(
        (row) =>
          (row.hidden = !row.textContent
            .toLocaleLowerCase("vi")
            .includes(needle)),
      );
  }
});
document.addEventListener("submit", async (event) => {
  const formNode = event.target;
  if (!formNode.dataset.form) return;
  event.preventDefault();
  const kind = formNode.dataset.form,
    input = Object.fromEntries(new FormData(formNode)),
    error = formNode.querySelector(".form-error"),
    submit = formNode.querySelector("[type=submit]");
  submit.disabled = true;
  error.classList.remove("visible");
  try {
    let endpoint = kind;
    if (kind === "setup" || kind === "login") endpoint = "auth/" + kind;
    if (kind === "groups")
      input.productIds = [
        ...formNode.querySelector("[name=productIds]").selectedOptions,
      ].map((option) => option.value);
    if (kind === "orders")
      input.items = [...formNode.querySelectorAll(".line-row")].map((row) => ({
        productId: row.querySelector("[name=productId]").value,
        quantity: row.querySelector("[name=quantity]").value,
        discountAmount: row.querySelector("[name=discountAmount]").value,
      }));
    if (kind === "pool-policy") endpoint = "policies/pool";
    if (kind === "bonus-policy") endpoint = "policies/bonus";
    if (kind === "reject-expense" || kind === "reject-adjustment")
      endpoint =
        (kind === "reject-expense" ? "expenses/" : "adjustments/") +
        input.entityId +
        "/reject";
    if (kind === "reverse-payment")
      endpoint = "payments/" + input.paymentId + "/reverse";
    if (kind === "manual-allocation") {
      endpoint = "payments/" + input.paymentId + "/confirm";
      input.allocations = Object.entries(input)
        .filter(([key]) => key.startsWith("alloc-"))
        .map(([key, value]) => ({ itemId: key.slice(6), amount: value }));
    }
    if (kind === "review" || kind === "lock") {
      endpoint = "periods/" + encodeURIComponent(periodId) + "/state";
      input.action = kind;
      input.acknowledgeWarnings = input.acknowledgeWarnings === "on";
    }
    if (kind === "pay")
      endpoint = "periods/" + encodeURIComponent(periodId) + "/pay";
    if (kind === "approve-adjustment")
      endpoint = "adjustments/" + input.adjustmentId + "/approve";
    await api(endpoint, input);
    if (modal.open) modal.close();
    toast(
      kind === "payments"
        ? "Đã lưu nháp. Mở đơn để xác nhận khoản thu."
        : "Đã lưu thành công.",
    );
    await refresh();
  } catch (err) {
    error.textContent = err.message;
    error.classList.add("visible");
  } finally {
    submit.disabled = false;
  }
});
window.addEventListener("hashchange", () => {
  const next = location.hash.slice(1) || "overview";
  if (page !== next) {
    page = next;
    if (state) void render();
  }
});
void start();
