# GENKI · PM Commission & Bonus

**Bản ứng dụng cục bộ đã triển khai và kiểm thử. Kết nối AMIS và đối chiếu workbook lịch sử còn cần dữ liệu nguồn.**

Ứng dụng tiếng Việt quản lý giá sản phẩm, chính sách quỹ, đơn hàng, thu tiền, chi phí, chỉ tiêu, tính thưởng, quyết toán và điều chỉnh hoàn tiền. Dữ liệu lưu trên máy trong PostgreSQL nhúng PGlite; backend thực thi phân quyền và phép tính bằng số nguyên/phân số chính xác.

## Chạy ứng dụng

Cần Node.js 22+; Python 3 dùng để kiểm tra dữ liệu tham chiếu.

```sh
npm ci
npm run dev
```

Mở **http://127.0.0.1:4317**. Lần đầu tự tạo tài khoản Admin và mật khẩu ít nhất 12 ký tự. Không có tài khoản/mật khẩu mặc định. Sau khi đã build, dùng `npm start` để chạy lại. Server chỉ lắng nghe trên máy này.

Dữ liệu thật nằm tại `.runtime/database`, được giữ khi khởi động lại và không đưa vào Git. Có thể chọn đường dẫn khác bằng `SALES_BONUS_DB`, cổng bằng `SALES_BONUS_PORT`. Dữ liệu QA dùng cơ sở dữ liệu riêng; không đưa đơn/nhân sự giả vào dữ liệu vận hành.

## Bắt đầu sử dụng

1. **Hệ thống → Cấu hình quy tắc**: chọn rõ cơ sở quỹ trước/sau VAT, múi giờ, ghi nhận theo thu từng phần, ngày chính sách và cách trừ chi phí. Doanh số trước VAT, Support 60:20:20 và làm tròn lên 1.000 đồng được điền theo quyết định của người dùng; cần lưu cấu hình trước khi tạo kỳ.
2. **Chính sách thưởng**: duyệt giá sản phẩm với ngày hiệu lực, VAT và lý do; tạo tỷ lệ quỹ ALL/nhóm/sản phẩm và tỷ lệ chia PM/Support/Công ty. Không tự áp dụng tỷ lệ ví dụ 45% hay 35:30:35.
3. **Nhân sự**: thêm PM, tài khoản theo vai trò và chỉ tiêu thu tiền cho kỳ. **Hệ thống**: tạo kỳ; ngày kết thúc là ngày không bao gồm, ví dụ tháng 10 từ 01/10 đến 01/11.
4. **Đơn hàng / Đối soát thu tiền**: nhập đơn, chiết khấu thực tế gồm VAT theo từng dòng; ghi nhận khoản thu nháp rồi xác nhận. Phân bổ mặc định theo giá trị thu của sản phẩm, có phân bổ thủ công kèm lý do. Nháp không kiếm thưởng.
5. Nhập chi phí có chứng từ. **Giám đốc hoặc Admin** duyệt/từ chối; kế toán/PM không được duyệt. **Tính thưởng → Xem cách tính** có số chính xác, nguồn giá và snapshot chính sách.
6. Đối soát các kỳ theo thứ tự thời gian: `OPEN → REVIEW → LOCKED → PAID`. Hoàn tất chỉ tiêu và đề nghị chờ duyệt trước REVIEW. Quỹ âm cho thưởng 0, giữ nguyên phần âm và cần xác nhận cảnh báo khi khóa. Chi trả là ghi nhận chứng từ, không chuyển tiền ngân hàng.
7. **Hệ thống → Hoàn tiền**: chọn quyết toán đã chi trả, số tiền hoàn và số thưởng đề nghị thu hồi. Giám đốc/Admin có thể sửa số thu hồi và chọn kỳ mở để cấn trừ trước khi duyệt. Giữ nguyên kỳ gốc; khoản điều chỉnh chỉ áp dụng một lần. Nếu vượt thưởng kỳ áp dụng, hệ thống chặn khóa để xử lý rõ, không tự tạo nợ hay đổi kỳ.

Phần chia Support hiện dừng tại ba bộ phận, đúng phạm vi đã chốt. Báo cáo xuất JSON giữ toàn bộ số chính xác và trace. Giá 46 sản phẩm từ báo giá 10/01/2025 được nhập **tạm tính**, có nguồn và cờ bất thường; cần duyệt giá tại ngày giao dịch trước khi sử dụng.

Làm tròn một lần tại tổng phải trả từng người/bộ phận **sau chỉ tiêu và điều chỉnh**; giữ riêng số chưa làm tròn và chênh lệch. Không làm tròn từng dòng đơn/khoản thu lên 1.000 đồng. Kỳ cũ hiển thị cấu hình đã khóa.

## Hướng dẫn ngay trong ứng dụng

Ở màn hình tạo Admin lần đầu có sẵn trình tự khởi động. Sau khi đăng nhập, mở **Hướng dẫn sử dụng** ở sidebar để xem 9 bài theo thứ tự: bắt đầu, cấu hình, chính sách và giá, nhân sự, đơn hàng, thu tiền, tính thưởng, khóa kỳ, rồi AMIS. Trong các trang nghiệp vụ, nút **Hướng dẫn: …** ở góc dưới mở đúng bài tương ứng. Từ bài hướng dẫn, chọn **Mở chức năng liên quan** để quay lại trang thao tác.

## Kiểm thử và tự review

```sh
npm run check
npm run test:e2e
npm audit
```

27 kiểm thử domain, PostgreSQL và HTTP; một luồng E2E Chrome bao phủ thiết lập ban đầu đến chi trả, 9 trang nghiệp vụ, cả 9 bài hướng dẫn và liên kết ngữ cảnh, nhóm sản phẩm, sao lưu, desktop/mobile và form đơn trên mobile. E2E mặc định dùng Google Chrome tại đường dẫn macOS trong `playwright.config.mjs`. Xem [báo cáo tự review](docs/self-review.md) và [trạng thái production](PRODUCTION_READINESS.md).

## Sao lưu và khôi phục

Admin chọn **Hệ thống → Sao lưu dữ liệu** để tải `.tar.gz`. Tệp chứa dữ liệu tài chính và thông tin xác thực đã băm; lưu riêng tư. Đã kiểm thử khôi phục và đọc lại dữ liệu. Khôi phục vào thư mục mới, giữ nguyên thư mục đang dùng:

```sh
node scripts/restore-backup.mjs /absolute/path/backup.tar.gz /absolute/path/new-database
SALES_BONUS_DB=/absolute/path/new-database npm start
```

Script từ chối ghi đè thư mục có sẵn và hủy các phiên đăng nhập trong bản khôi phục. Dùng cùng phiên bản PGlite/package-lock để khôi phục; dừng server cũ trước khi chuyển sang cơ sở dữ liệu mới.

## Phần còn cần đầu vào bên ngoài

AMIS chưa có tenant truy cập/payload xác minh, nên chưa có đồng bộ thật hoặc webhook. Workbook 2603–2609 chưa được cung cấp, nên chưa có Golden Dataset lịch sử đã duyệt. Đây là các điều kiện còn thiếu để phát hành production, không được coi kiểm thử giả lập là bằng chứng đã tích hợp.

[Chỉ dẫn gốc](docs/master-build-directive.md) · [Nguồn bảng giá](docs/product-pricing.md) · [Quy tắc tính](docs/calculation-spec.md) · [AMIS discovery](docs/integrations/amis-api-discovery.md) · [Checkpoint](docs/BUILD_STATUS.md) · [Chạy tiếp theo lịch](docs/resume-build.md)
