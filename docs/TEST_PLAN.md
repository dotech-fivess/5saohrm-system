# 5Sao HRM — Test Plan & QA Report (M1–M5)

Vai trò: **PO kiêm Tester**. Tài liệu này gồm: chiến lược test, dữ liệu test, kết quả test tự động, bộ test-case thủ công phủ **mọi nút/icon/function/data**, và **nhật ký lỗi** đã phát hiện/khắc phục.

---

## 1. Chiến lược & kỹ thuật test

| Tầng | Kỹ thuật | Công cụ | Trạng thái |
|---|---|---|---|
| Engine tính công | **Unit / boundary value** (biên 60′, 300′, hệ số) | `scripts/test-db.mjs` (pg) | ✅ tự động |
| RPC chấm công / duyệt | **Integration** (mô phỏng JWT theo vai trò) | `scripts/test-db.mjs` | ✅ tự động |
| Phân quyền | **RLS / security test** (act-as-user) | `scripts/test-db.mjs` | ✅ tự động |
| Bất biến dữ liệu | **Negative test** (UPDATE/DELETE phải bị chặn) | `scripts/test-db.mjs` | ✅ tự động |
| Giao diện / luồng | **E2E smoke** (đăng nhập, duyệt, dashboard, tài khoản khóa) | Claude Preview (browser) | ✅ đã chạy |
| Build | Type-check `tsc --noEmit` + `next build` | — | ✅ sạch |

**Kỹ thuật mô phỏng vai trò:** trong transaction đặt `set local role authenticated` + `set request.jwt.claims = '{"sub":"<uid>"}'` để `auth.uid()` trả đúng user → test RLS và RPC như chính vai trò đó, rồi `rollback` để không bẩn dữ liệu.

---

## 2. Dữ liệu test (`supabase/seed_test.sql`)

7 tài khoản domain `@test.5sao.vn`, **mật khẩu chung `Test@123456`**:

| Email | Vai trò | Phòng ban | Ghi chú |
|---|---|---|---|
| hr.admin@test.5sao.vn | Quản trị chỉnh sửa | IT | duyệt cấp cuối |
| hr.view@test.5sao.vn | Quản trị xem | IT | chỉ xem |
| minh.ql@test.5sao.vn | Quản lý | Kinh doanh | duyệt cấp 1 |
| an.nv@test.5sao.vn | Nhân viên | Kinh doanh | có chấm công đủ loại + đơn nghỉ |
| lan.nv@test.5sao.vn | Nhân viên (Thử việc) | Kinh doanh | đi trễ |
| duc.nv@test.5sao.vn | Nhân viên (TTS) | Marketing | Tạm nghỉ |
| khoa.locked@test.5sao.vn | Nhân viên | Kinh doanh | **account_status = Khóa** |

Dữ liệu kèm: chấm công An (đủ ngày / đi trễ / quên check-out / TC150 / Online), đơn nghỉ (bệnh chờ duyệt, đi trễ đã duyệt, nửa ngày bị từ chối), số dư phép năm, thông báo cho Quản lý.

> Nạp/nạp lại: `PG... node scripts/run-sql.mjs supabase/seed_test.sql` (idempotent).

---

## 3. Kết quả test tự động — **30/30 PASS** ✅

Chạy: `PGHOST=... PGPASSWORD=... node scripts/test-db.mjs`

- **Engine (10):** HC 360/300/299/60/59; ON 360/299/59; TC120 60; TC150 120 — đúng mục D.
- **Chấm công RPC (5):** check-in tạo `missing_checkout`; check-out 6h → 1.0 & `complete`; chặn check-in 2 lần; chặn loại công sai.
- **Quy trình duyệt (6):** nghỉ phép đúng 1 cấp & QL duyệt = cuối; bổ sung công đúng 2 cấp, QL→cấp 2→Admin duyệt cuối; nhân viên không có quyền duyệt.
- **RLS (4):** NV chỉ thấy hồ sơ/chấm công của mình; QL thấy NV cùng phòng, không thấy khác phòng.
- **Bất biến (2):** UPDATE & DELETE `attendance_records` bị chặn.
- **Ràng buộc (3):** hệ số work_type, mã NV `NV-xxxx`, đủ 8 tham số config.

---

## 4. Bộ test-case thủ công (phủ nút/icon/function/data)

Quy ước kết quả: ✅ đã verify (tự động/E2E) · ⬜ cần tester bấm tay.

### M0/Chung — Xác thực & layout
| ID | Màn | Thao tác / nút | Kỳ vọng | KQ |
|---|---|---|---|---|
| AUTH-01 | S1 Đăng nhập | Sai mật khẩu → nút "Đăng nhập" | Báo "Email hoặc mật khẩu không đúng" | ✅ |
| AUTH-02 | S1 | Đăng nhập đúng (admin) | Vào Dashboard (khu desktop) | ✅ |
| AUTH-03 | S1 | Đăng nhập tài khoản **Khóa** | Chặn về /login + banner "Tài khoản đã bị khóa" | ✅ (đã vá) |
| AUTH-04 | Shell | Sidebar: Dashboard/Chấm công/Nhân sự/Nghỉ phép/Cấu hình | Điều hướng + mục active sáng | ✅ |
| AUTH-05 | Shell | Chuông 🔔 + badge | Mở /thong-bao, badge = số chưa đọc | ✅ |
| AUTH-06 | Mobile | Bottom nav (Trang chủ/Chấm công/Nghỉ phép/Cá nhân) | Điều hướng đúng tab | ⬜ |
| AUTH-07 | Cá nhân (mobile) | Nút "Đăng xuất" | Về /login | ⬜ |

### M1 — Nhân sự (S4–S9)
| ID | Màn | Thao tác / nút | Kỳ vọng | KQ |
|---|---|---|---|---|
| HR-01 | S4 | Lọc theo tên/mã/email + phòng ban + trạng thái → "Lọc" | Danh sách lọc đúng | ⬜ |
| HR-02 | S4 | Click 1 dòng nhân viên | Mở chi tiết S5 | ⬜ |
| HR-03 | S4 | Empty state (lọc không ra) | Hiện "Chưa có nhân viên nào" | ✅ |
| HR-04 | S5 | 4 tab (cơ bản/công việc/hệ thống/file) | Đổi tab hiển thị đúng nhóm | ⬜ |
| HR-05 | S5 | Nút "Chỉnh sửa" | Mở form S6 (prefill) | ⬜ |
| HR-06 | S5 | Nút "Khóa tài khoản" → xác nhận | account_status=Khóa, ghi audit | ⬜ |
| HR-07 | S6 | Tạo NV mới (cần secret key) | Tạo auth user + hồ sơ | ⬜ *(cần SUPABASE_SERVICE_ROLE_KEY)* |
| HR-08 | S6 | Sửa hồ sơ → "Lưu thay đổi" | Cập nhật + audit + về S5 | ⬜ |
| HR-09 | S7 | Tab File → chọn file tải lên | File lên Storage `ho-so`, hiện trong danh sách | ⬜ |
| HR-10 | S8 | Lịch sử hoạt động | Timeline các lần sửa (chỉ xem) | ⬜ |
| HR-11 | S9 | Cấu hình: thêm/xoá Phòng ban/Vị trí/Chức vụ | CRUD danh mục hoạt động | ⬜ |
| HR-12 | S9 | Tab "Ca làm việc" | Hiện ca + loại công ×hệ số | ✅ |

### M2 — Chấm công (S10–S14)
| ID | Màn | Thao tác / nút | Kỳ vọng | KQ |
|---|---|---|---|---|
| AT-01 | S10 | Nút tròn "Check-in" (chọn HC/TC/ON) | Tạo bản ghi, khoá giờ+GPS | ✅ (RPC) |
| AT-02 | S10 | Nút "Check-out" | Tính ngày công, state complete | ✅ (RPC) |
| AT-03 | S10 | Chặn check-in 2 lần / loại sai | Báo lỗi | ✅ |
| AT-04 | S10 | Không có GPS → nút "Thử lấy lại vị trí" | Hiện cảnh báo, vẫn chấm được (toạ độ trống) | ⬜ |
| AT-05 | S11 | Lịch sử cá nhân | Liệt kê Ngày/Vào/Ra/Loại/Trạng thái/Công | ✅ |
| AT-06 | S12 | Bổ sung công: chọn tình huống + lý do → "Gửi" | Tạo đơn + vào duyệt 2 cấp | ✅ (RPC) |
| AT-07 | S13 | Bảng công ty + chip tổng hợp | Hiện dữ liệu hôm nay | ✅ |
| AT-08 | S14 | Thống kê + biểu đồ | KPI + bar chart theo loại | ✅ |

### M3 — Nghỉ phép (S15–S18)
| ID | Màn | Thao tác / nút | Kỳ vọng | KQ |
|---|---|---|---|---|
| LV-01 | S15 | Chọn "Nghỉ bệnh" | Hiện ô đính kèm bắt buộc | ⬜ |
| LV-02 | S15 | "Đi trễ": stepper +/- giờ, chặn >3h | Hiện tác động "8/8 − x/8" | ⬜ |
| LV-03 | S15 | Gửi đơn thiếu minh chứng (bệnh) | Báo "bắt buộc đính kèm" | ✅ (action) |
| LV-04 | S16 | Đơn của tôi (tab Tất cả/Chờ/Duyệt/Từ chối) | Lọc trạng thái đúng | ⬜ |
| LV-05 | S17 | Hàng chờ duyệt: nút "Duyệt" | Đơn được duyệt, rời hàng chờ | ✅ (E2E) |
| LV-06 | S17 | Nút "Từ chối" (thiếu lý do) | Yêu cầu nhập lý do | ⬜ |
| LV-07 | S18 | Chi tiết: timeline số cấp đúng loại | Nghỉ phép 2 nút (NV→QL); bổ sung công 3 nút | ✅ |
| LV-08 | — | Nghỉ phép cấp cuối = Quản lý (không lên QT) | finalize đúng | ✅ |

### M4 — Dashboard (S19–S20)
| ID | Thao tác | Kỳ vọng | KQ |
|---|---|---|---|
| DB-01 | Bộ lọc tháng + phòng ban → "Lọc" | Số liệu cập nhật theo lọc | ✅ |
| DB-02 | Nhóm Nhân sự | Tổng + contract + bar phòng ban/địa điểm | ✅ |
| DB-03 | Nhóm Chấm công | Top-3 trễ/quên/tăng ca | ✅ |
| DB-04 | Nhóm Nghỉ phép | Cơ cấu loại + top xin nghỉ | ✅ |

### M5 — Thông báo + trạng thái
| ID | Thao tác | Kỳ vọng | KQ |
|---|---|---|---|
| NT-01 | Nộp đơn → QL nhận thông báo | notifications +1 cho QL | ✅ (RPC) |
| NT-02 | Duyệt/Từ chối → người gửi nhận thông báo | notifications cho người tạo | ✅ (RPC) |
| NT-03 | /thong-bao: "Đánh dấu đã đọc" | Badge về 0 | ⬜ |
| NT-04 | Trạng thái dùng chung: empty/loading/toast/modal | Hiển thị đúng | ⬜ (một phần ✅) |

---

## 5. Nhật ký lỗi (Bug log)

| # | Mức | Mô tả | Trạng thái |
|---|---|---|---|
| BUG-1 | **Cao** | Tài khoản `account_status='Khóa'` vẫn đăng nhập được (Supabase Auth không kiểm tra cờ này) — vi phạm SRS mục 3 | ✅ **Đã vá**: middleware chặn + banner ở /login (AUTH-03) |
| BUG-2 | Thấp | Sau redirect khóa, nút kẹt "Đang đăng nhập…" do điều hướng SPA không remount | ✅ **Đã vá**: dùng điều hướng cứng |
| OBS-1 | Info | Dashboard "Tổng nhân sự" đếm cả hồ sơ chưa set loại HĐ (tổng 8 nhưng breakdown 5+1+1) | Theo dõi — hiển thị, không sai logic |
| OBS-2 | Thấp | Phạm vi duyệt của Quản lý hiện theo **1 phòng ban**; chưa xét đa địa điểm/đa phòng | Backlog |
| OBS-3 | Info | Tạo nhân viên (S6) cần `SUPABASE_SERVICE_ROLE_KEY` (chưa cấu hình) | Cần điền secret key |
| OBS-4 | Info | Web Push + email chưa làm (M5 mới có in-app) | Backlog |
| OBS-5 | Thấp | Khu desktop (admin) chưa có nút Đăng xuất rõ ràng | Backlog |
| OBS-6 | Thấp | Check-in "Trễ" dựa ca gán sớm nhất; NV chưa gán ca luôn "Hợp lệ" | Backlog |

---

## 6. Cách chạy lại toàn bộ test

```bash
# 0) Biến môi trường kết nối DB (project B)
export PGHOST='db.qgylpkejerbposmjqxkp.supabase.co' PGPORT='5432' PGUSER='postgres' PGPASSWORD='<db-pass>' PGDATABASE='postgres'

# 1) Nạp lại dữ liệu test
node scripts/run-sql.mjs supabase/seed_test.sql

# 2) Chạy bộ test tự động (kỳ vọng 30/30 PASS)
node scripts/test-db.mjs

# 3) Type-check
node_modules/.bin/tsc --noEmit
```

E2E thủ công: đăng nhập từng vai trò (bảng mục 2) và chạy các case ⬜ ở mục 4.
