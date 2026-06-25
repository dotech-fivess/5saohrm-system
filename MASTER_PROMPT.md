# MASTER PROMPT — Xây dựng hệ thống "5Sao HRM"

Bạn là kỹ sư full-stack. Hãy xây dựng một ứng dụng WEB quản trị nhân sự nội bộ tên "5Sao HRM" theo đặc tả dưới đây. Toàn bộ giao diện bằng TIẾNG VIỆT. Code sạch, có migration SQL, seed data, README chạy local. Làm theo thứ tự Milestone M0→M5. **Bám sát thiết kế ở Mục I (đã có design system + 20 màn hình thật).**

## A. BỐI CẢNH & STACK (đọc trước, áp dụng xuyên suốt)

**Mục tiêu:** Quản lý Nhân sự – Chấm công – Nghỉ phép – Dashboard cho nội bộ công ty.

**Hình thái:** MỘT ứng dụng web duy nhất, 2 khu vực:
- Portal NHÂN VIÊN: **responsive, mobile-first** (chấm công & nghỉ phép trên điện thoại qua trình duyệt).
- Khu QUẢN TRỊ/QUẢN LÝ: tối ưu desktop (bảng, form, dashboard).
- KHÔNG làm app native.

**Stack bắt buộc:**
- Frontend: Next.js (App Router) + TypeScript (strict) + Tailwind CSS + shadcn/ui. Biểu đồ: Recharts.
- Backend/DB: **Supabase** — Postgres + Auth (email/mật khẩu) + Storage (lưu file) + Realtime (thông báo) + Edge Functions (logic nhạy cảm) + **Row Level Security (RLS)** cho phân quyền.
- Lấy GPS từ trình duyệt: `navigator.geolocation`.
- Cung cấp: SQL migrations, RLS policies, seed roles + dữ liệu mẫu, `.env.example`, README.

**4 vai trò (RBAC):**
1. `qt_sua` (Quản trị chỉnh sửa): toàn quyền cấu hình + sửa dữ liệu + là cấp duyệt cuối của chấm công.
2. `qt_xem` (Quản trị xem): xem toàn bộ, không sửa.
3. `quan_ly` (Quản lý): quản lý nhân viên trong phạm vi (phòng ban/địa điểm); duyệt cấp 1; là cấp duyệt CUỐI của nghỉ phép.
4. `nhan_vien` (Nhân viên): tự chấm công, gửi yêu cầu bổ sung công, đăng ký nghỉ phép, xem dữ liệu cá nhân.

**Trạng thái tài khoản:** Hoạt động / Khóa. Tài khoản khóa không đăng nhập được nhưng dữ liệu lịch sử vẫn giữ.

**Nguyên tắc không được vi phạm:**
- Bản ghi chấm công & audit log là **BẤT BIẾN** (insert-only, không UPDATE/DELETE). Sửa = tạo bản ghi mới qua quy trình bổ sung có duyệt.
- Thời gian & toạ độ GPS khi chấm công KHÔNG cho chỉnh sửa thủ công.
- Mọi thao tác sửa/duyệt/từ chối đều ghi **audit log** (chỉ xem).
- Hệ số & ngưỡng tính công để dạng **tham số cấu hình** (bảng config), KHÔNG hard-code.

## B. MÔ HÌNH DỮ LIỆU (Postgres/Supabase — tạo migration)

- `profiles` (1-1 với auth.users): employee_code (tự sinh, duy nhất, read-only), full_name, avatar_url, email_company, phone, gender(Nam/Nữ/Khác), dob, address, department_id, position_id, title_id, join_date, probation_date, official_date, contract_type(TTS/Thử việc/Chính thức), work_status(Đang làm/Nghỉ việc/Tạm nghỉ), role, account_status(Hoạt động/Khóa).
- `departments`, `positions`, `titles` (danh mục cấu hình).
- `locations`: name, province, address, work_start, work_end, lunch_start, lunch_end.
- `shifts`: name, start_time, end_time (ca làm việc — khung giờ vào/ra).
- `location_shifts`: gán ca theo địa điểm.
- `employee_locations`: (employee_id, location_id, shift_id) — N-N, CHO PHÉP nhiều địa điểm/nhân viên.
- `work_types`: code(HC/TC120/TC150/ON), name, coefficient (cấu hình hệ số). LƯU Ý: work_type (hệ số loại công) ≠ shift (khung giờ ca); màn cấu hình gộp hiển thị nhưng dữ liệu tách 2 bảng.
- `attendance_records` (INSERT-ONLY): employee_id, location_id, work_type_id, check_in_at, check_in_lat, check_in_lng, check_out_at, check_out_lat, check_out_lng, checkin_status(Hợp lệ/Trễ), checkout_status(Hợp lệ/Sớm/Quên), computed_workday (numeric), state(complete/missing_checkout).
- `attendance_adjustments`: employee_id, kind(forgot_checkin/forgot_checkout/wrong_record), target_record_id, payload(jsonb), reason, status(Chờ/Duyệt/Từ chối), approval_flow_id.
- `leave_types`: code, name, requires_attachment(bool), max_hours(nullable, vd đi trễ/về sớm ≤3h), is_half_day(bool).
- `leave_requests`: employee_id, leave_type_id, start_date, end_date, hours, reason(bắt buộc), attachment_url, status(Chờ/Duyệt/Không duyệt), approval_flow_id, workday_impact(numeric).
- `leave_balances`: employee_id, year, accrued, used, remaining (PHÉP NĂM tích lũy theo năm).
- `approval_flows`: request_type(attendance_adjustment/leave), employee_id, ref_id, current_level, status.
- `approval_steps`: flow_id, level, approver_role, decision(Chờ/Duyệt/Từ chối), decided_by, decided_at, reason.
- `config_parameters`: key, value (jsonb) — chứa ngưỡng & hệ số (xem mục C).
- `notifications`: user_id, type, title, body, payload, read_at.
- `audit_logs` (INSERT-ONLY): actor_id, entity, entity_id, action, before(jsonb), after(jsonb), created_at.

**RLS (ý định):**
- nhan_vien: chỉ đọc/ghi dữ liệu của CHÍNH mình.
- quan_ly: đọc dữ liệu nhân viên trong phạm vi (cùng phòng ban/địa điểm); thực hiện duyệt cấp 1.
- qt_xem: đọc tất cả, không ghi. qt_sua: toàn quyền.
- attendance_records & audit_logs: cho INSERT, REVOKE UPDATE/DELETE với mọi vai trò.

## C. THAM SỐ CẤU HÌNH MẶC ĐỊNH (seed vào config_parameters)
- hc_full_threshold_min = 300 (≥5h ⇒ đủ ngày)
- hc_half_threshold_min = 60 (≥1h ⇒ nửa ngày)
- late_early_max_min = 180 (đi trễ/về sớm tối đa 3h)
- coef_tc120 = 1.2, coef_tc150 = 1.5, coef_online = 0.5
- standard_workday = 8 (8/8)
- rounding = "minute"  (làm tròn theo PHÚT)

## D. ENGINE TÍNH CÔNG (đơn vị PHÚT; ngày công chuẩn 8/8). Đặt t = (check_out − check_in) tính bằng phút, làm tròn theo phút.
- **Hành chính (HC):** t ≥ 300 ⇒ 8/8; 60 ≤ t < 300 ⇒ 4/8; t < 60 ⇒ 0.
- **Tăng ca (TC):** ngày công = (t/60) × hệ số (TC120=1.2, TC150=1.5).
- **Online (ON):** = quy tắc HC × 0.5 ⇒ t ≥ 300 ⇒ 4/8; 60 ≤ t < 300 ⇒ 2/8; t < 60 ⇒ 0.
- **Đi trễ / Về sớm (đơn nghỉ tương ứng, ≤3h):** trừ thẳng số giờ vào ngày công của ngày đó: nếu nền là 8/8 ⇒ 8/8 − [giờ]/8; nếu nền 4/8 ⇒ 4/8 − [giờ]/8.
- **Nhiều ca/địa điểm trong cùng ngày:** ngày công của ngày = TỔNG (cộng dồn) ngày công các bản ghi trong ngày.
- **Quên check-out (chưa có O):** computed_workday = 0, state = missing_checkout; KHÔNG tính cho đến khi nhân viên gửi BỔ SUNG CÔNG và được duyệt — khi đó tạo bản ghi điều chỉnh và tính lại.
- Tất cả ngưỡng/hệ số đọc từ config_parameters (không hard-code). Nên đặt logic trong Postgres function/Edge Function. **Viết unit test** cho mốc 60'/300', online ×½, đi trễ trừ giờ, quên check-out = 0.

## E. QUY TRÌNH DUYỆT (state machine, cấu hình số cấp theo loại yêu cầu)
- **Bổ sung chấm công:** NV → Quản lý (cấp 1) → Quản trị (cấp cuối). 2 cấp.
- **Nghỉ phép:** NV → Quản lý (cấp cuối). 1 cấp — KHÔNG bắt buộc lên Quản trị.
- Component timeline duyệt (S18) render ĐÚNG số cấp theo loại: bổ sung công = 3 nút (NV→QL→QT), nghỉ phép = 2 nút (NV→QL).
- Mỗi cấp: Duyệt hoặc Từ chối kèm lý do. Yêu cầu chỉ hiệu lực khi duyệt ở cấp cuối. Ghi audit + bắn thông báo ở mỗi lần đổi trạng thái.

## F. CHI TIẾT 4 PHÂN HỆ & MÀN HÌNH (ID màn ánh xạ tới design Mục I)

**1) Nhân sự (S4–S9):** Danh sách + lọc (S4) · Chi tiết hồ sơ 4 tab (S5) · Tạo/sửa wizard 3 bước (S6) · File hồ sơ upload (S7) · Lịch sử hoạt động timeline chỉ xem (S8) · Cấu hình danh mục: phòng ban/vị trí/ca/địa điểm + hệ số work_type (S9). Hỗ trợ đa địa điểm, mỗi nơi gắn ca + giờ nghỉ trưa. Khóa/mở tài khoản (modal xác nhận).

**2) Chấm công (S10–S14):**
- S10 màn check-in/out (mobile-first) với đủ trạng thái: ① sẵn sàng (bản đồ + ca + đồng hồ chạy + chọn HC/TC120/TC150/ON + nút tròn lớn) ② đã check-in (xác nhận xanh, time+GPS khoá 🔒, nút check-out) ③ lỗi GPS (đỏ, nút tạm khoá) ④ cảnh báo quên check-out (vàng, nút gửi bổ sung công). Sau check-out hiển thị ngày công tính được + mã quy tắc.
- S11 lịch sử cá nhân (desktop bảng + mobile card; cột Ngày/Vào/Ra/Loại/Trạng thái/Công; ghi chú bất biến).
- S12 bổ sung công (mobile; 3 tình huống quên in/out/chấm sai; luồng NV→QL→QT).
- S13 bảng chấm công toàn công ty (desktop, lọc ngày/phòng ban/địa điểm + chip tổng hợp).
- S14 thống kê (desktop; 4 KPI HC/TC/ON/Trễ-Sớm + bar chart + donut tỉ trọng).

**3) Nghỉ phép (S15–S18):**
- S15 đăng ký (mobile, trường động): chips loại nghỉ; Nghỉ bệnh ⇒ bắt buộc đính kèm giấy bệnh viện; Đi trễ/Về sớm ⇒ stepper số giờ, chặn >3h, hiển thị tác động "8/8 − 1.5/8 = 6.5/8"; lý do bắt buộc.
- S16 đơn của tôi (mobile card + desktop bảng; tab Tất cả/Chờ/Đã duyệt/Từ chối; cột ảnh hưởng công; từ chối hiện lý do).
- S17 hàng chờ duyệt (desktop + mobile; tab Tất cả/Nghỉ phép/Bổ sung; badge "Cấp 1 ✓ · chờ cuối" / "Chờ cấp 1"; duyệt nhanh inline).
- S18 chi tiết + Duyệt/Từ chối (desktop + mobile; lưới chi tiết + đính kèm + **timeline duyệt theo số cấp của loại** + ô lý do; nút Từ chối / Duyệt cấp cuối).

**4) Dashboard (S19+S20):** filter tháng/năm + phòng ban + địa điểm; Nhóm 1 Nhân sự (tổng + Chính thức/Thử việc/TTS + bar theo phòng ban + bar theo địa điểm); Nhóm 2 Chấm công (top-3 đi trễ / quên chấm / tăng ca…); Nhóm 3 Nghỉ phép (bar cơ cấu loại nghỉ + top-3 xin nghỉ). Tải < 3s ⇒ materialized view + index.

## G. THÔNG BÁO (trong MVP)
- Web Push + email khi: có yêu cầu CHỜ DUYỆT (gửi tới người duyệt phù hợp), khi yêu cầu được Duyệt/Từ chối (gửi tới người tạo). Dùng Supabase Realtime cho in-app + provider email. UI: chuông 🔔 có chấm đỏ (desktop topbar) + toast (Mục I).

## H. YÊU CẦU PHI CHỨC NĂNG
- GPS: ghi lại toạ độ khi check-in/out (CHỈ LƯU, không kiểm tra bán kính hợp lệ). Time & GPS bất biến.
- Bảo mật: phân quyền đúng vai trò qua RLS; mật khẩu do Supabase Auth quản lý; khóa tài khoản (≤5 lần sai hiển thị cảnh báo như S1 lỗi).
- Audit log mọi thao tác sửa/duyệt; dữ liệu chấm công bất biến.
- Responsive: portal nhân viên dùng tốt trên điện thoại; admin tốt trên desktop.

## I. GIAO DIỆN — DESIGN SYSTEM THẬT (bám sát 1:1)

> Nguồn thiết kế kèm theo: `design-handoff/web-ui-design-request/project/5Sao HRM.dc.html` (foundations + 20 màn hình S1–S20, Desktop + Mobile, kèm trạng thái error/empty/loading/toast/modal) và prototype `5Sao Chấm công.dc.html`. Đây là HTML mockup — hãy **tái hiện đúng hình ảnh** bằng Next.js + Tailwind + shadcn/ui, KHÔNG copy cấu trúc HTML thô. File `support.js` là runtime của design tool, BỎ QUA.

### I.1 Tokens (đưa vào tailwind theme / CSS variables)
- **Font:** `Roboto` (300/400/500/700/900) cho chữ; `Roboto Mono` (400/500) cho **số liệu, giờ, mã NV, ngày công, badge số** (vd `08:02 · 8/8 · NV-0428`).
- **Màu thương hiệu & semantic:**
  - Primary `#2C68C9` · Primary-press/tint-text `#2457A8` · Accent `#F57F20` · Brand Dark `#16345E`
  - Success `#2E7D32` · Warning `#F9A825` · Danger `#D32F2F` · Neutral `#5B6B63` · Ink `#16241D`
- **Surface & viền:** app-bg `#F4F7F5` · canvas ngoài `#E7EBE9` · surface `#FFFFFF` · panel inset `#F8FAF9` · border `#E2E8E5` · input border `#cdd6d1` · divider `#f0f3f1`/`#eef2f0` · muted `#9aa8a1`
  - Sidebar bar `#9DB9EC` (số liệu phụ trên nền brand dark)
- **Tints (badge/alert):** blue `#E7EEFB` (vb `#c2d6f3`, text `#2457A8`) · warn `#FEF4DC` (vb `#f6e6bd`, text `#a9791a`) · danger `#FBE7E7` (vb `#f3cccc`, text `#b3261e`) · success `#E6F2E7` (vb `#cfe6d1`, text `#2E7D32`)
- **Type scale:** H1 30/900 (-.02em, #16345E) · H2 22/700–900 · tiêu đề khu 17/800 · tiêu đề card 14–15/700 · body 15/400 (#16241D) · label 13/500 (#5B6B63) · small 12–12.5 · micro 11–11.5 (#9aa8a1).
- **Bo góc:** pill 999 · button 9–11 · input 9–10 · card 12–14 · tab = gạch dưới 2px primary · khung điện thoại 30 · nút tròn check-in 150 · avatar squircle 16–22 hoặc tròn.
- **Đổ bóng:** card `0 8px 30px rgba(22,52,94,.1)` · khung mobile `0 8px 30px rgba(22,52,94,.18)` · nút primary `0 4px 12px rgba(44,104,201,.3)` · modal `0 8px 24px rgba(22,52,94,.12)`.
- **Logo:** `https://5sao.com.vn/images/common/5sao-logo-new.svg`.
- **Icon:** trong mockup là ký tự placeholder (▦ ◷ ☷ ⊟ ⚙ ☺ 🔔). Khi build dùng **lucide-react**: LayoutDashboard, Clock, Users, CalendarOff, Settings, User, Bell, Plus, Search, MapPin, Lock…

### I.2 Component nền tảng (Foundations)
- **Buttons:** primary (nền #2C68C9, chữ trắng, shadow) · phụ (trắng, viền #cdd6d1, chữ #16345E) · nguy hiểm (nền #FBE7E7, chữ #D32F2F) · disabled (nền #F0F3F1, chữ #9aa8a1).
- **Status badge** (pill có chấm tròn + chữ): Hợp lệ/Duyệt = success · Trễ/Sớm/Chờ = warning · Quên/Từ chối = danger · Online(ON) = blue.
- **Input:** nền trắng, viền #cdd6d1, radius 9–10, padding ~11–13; focus = viền #2C68C9 + ring `0 0 0 3px rgba(44,104,201,.12)`.
- **Multi-select địa điểm:** chip xanh có ✕ + chip "＋ Thêm" gạch đứt.
- **Trạng thái dùng chung:** error (đăng nhập sai/tài khoản khoá) · empty (danh sách rỗng có CTA) · loading skeleton (shimmer) · toast success/error · modal xác nhận (vd "Khoá tài khoản nhân viên?").

### I.3 Khung layout
- **Desktop shell:** sidebar trái cố định **212px** nền `#16345E` chữ trắng (logo sao + menu: Dashboard, Chấm công, Nhân sự, Nghỉ phép, Cấu hình; mục active = nền `rgba(255,255,255,.12)`; footer = avatar + tên + vai trò). Topbar **60px** trắng: tiêu đề + ô tìm kiếm + chuông 🔔 (chấm đỏ). Nội dung nền `#F4F7F5`, padding 22–26.
  - **Biến thể Quản lý:** menu = Tổng quan đội · Chờ tôi duyệt (badge số) · Chấm công đội · Nhân viên (phạm vi); nhấn vai trò Quản lý bằng màu Accent `#F9A825` (avatar/role + KPI "Chờ tôi duyệt").
- **Mobile shell:** header gradient (primary→brand-dark hoặc `#2C68C9→#2457A8`), nội dung trên `#F4F7F5`, **bottom nav 4 tab** (Trang chủ · Chấm công · Nghỉ phép · Cá nhân), tab active = primary. Bottom sheet bo góc trên 26px cho form.

### I.4 Bản đồ 20 màn hình (S1–S20) + breakpoint
- **A. Chung & Xác thực:** S1 Đăng nhập (Desktop split brand panel + form / Mobile gradient + bottom sheet; có state lỗi & tài khoản khoá). S2 Trang chủ theo vai trò (Desktop Quản trị: 4 KPI [Tổng NS, Đã chấm hôm nay, Đi trễ, Chờ bạn duyệt cấp cuối] + "Hàng chờ duyệt cấp cuối" + Lối tắt / Desktop Quản lý: KPI phạm vi + duyệt cấp 1 inline / Mobile Nhân viên: lời chào + card check-in đồng hồ chạy + GPS + 3 lối tắt + công tháng). S3 Hồ sơ cá nhân (Desktop cover+avatar+2 card / Mobile header + list + cài đặt: đổi mật khẩu, ngôn ngữ, đăng xuất).
- **B. Nhân sự:** S4 Danh sách (Desktop, + empty state) · S5 Chi tiết 4 tab (Desktop) · S6 Tạo/sửa wizard 3 bước (Desktop) · S7 File hồ sơ (Desktop) · S8 Lịch sử hoạt động (Desktop, badge "P2 · chỉ xem") · S9 Cấu hình danh mục (Desktop).
- **C. Chấm công:** S10 check-in/out 4 trạng thái (Mobile) · S11 lịch sử (Desktop bảng + Mobile card) · S12 bổ sung công (Mobile) · S13 bảng toàn công ty (Desktop) · S14 thống kê (Desktop).
- **D. Nghỉ phép:** S15 đăng ký trường động (Mobile; biến thể Nghỉ bệnh & Đi trễ) · S16 đơn của tôi (Mobile card + Desktop bảng + empty mobile) · S17 hàng chờ duyệt (Desktop + Mobile) · S18 chi tiết + duyệt (Desktop + Mobile).
- **E. Dashboard:** S19+S20 dashboard điều hành (Desktop) — filter bar + 3 nhóm tổng quan.

### I.5 Quy tắc responsive
- Layout desktop/mobile trong design là HAI biến thể của cùng màn. Build responsive: < 768px dùng dạng mobile (bottom nav, bottom sheet, card thay bảng); ≥ 1024px dùng dạng desktop (sidebar + bảng). Nhân viên thao tác chính trên mobile; quản trị/quản lý trên desktop.

## J. THỨ TỰ BUILD (Milestones)
- **M0 Setup:** khởi tạo Next.js + Supabase, kết nối, Auth, RLS skeleton, tạo toàn bộ bảng + config_parameters (seed mục C), seed 4 vai trò + vài user mẫu, **đưa design tokens (I.1) vào tailwind**, dựng 2 khung layout (desktop shell + mobile shell ở I.3), bộ component nền tảng (I.2).
- **M1 Nhân sự:** S4–S9; profiles CRUD (4 nhóm), danh mục, đa địa điểm/ca, upload file (Storage), lịch sử hoạt động, khóa/mở tài khoản.
- **M2 Chấm công:** S10–S14; check-in/out GPS (mobile-first) + engine tính công (mục D, đọc config) + bổ sung công + duyệt 2 cấp + lịch sử & thống kê.
- **M3 Nghỉ phép:** S15–S18; loại phép, đăng ký + đính kèm, leave_balances tích lũy năm, duyệt 1 cấp, tác động ngày công, thống kê.
- **M4 Dashboard:** S19+S20; 3 nhóm tổng quan + bộ lọc + tối ưu < 3s.
- **M5 Hoàn thiện:** Web Push + email, audit log đầy đủ, trạng thái dùng chung (error/empty/loading/toast/modal), kiểm thử responsive, rà soát RLS & bất biến dữ liệu.

Mỗi Milestone: chạy được, có seed/test cơ bản, không phá vỡ các nguyên tắc ở mục A.

---
### ⚠ Mâu thuẫn cần lưu ý khi build
Màn **S18** trong design vẽ luồng duyệt **3 cấp (NV→QL→QT)** kèm ví dụ "Nghỉ bệnh". Nhưng quyết định nghiệp vụ đã chốt: **nghỉ phép chỉ 1 cấp, Quản lý là cấp cuối** (mục E). ⇒ Build theo MỤC E (nghiệp vụ ưu tiên): component timeline render số cấp theo loại yêu cầu — nghỉ phép 2 nút (NV→QL), bổ sung công 3 nút (NV→QL→QT).
