# 5Sao HRM — Hệ thống Quản trị Nội bộ

Ứng dụng web quản lý **Nhân sự · Chấm công · Nghỉ phép · Dashboard**.
Một codebase, hai khu vực: **portal nhân viên** (responsive, mobile-first) và **khu quản trị/quản lý** (desktop).

**Stack:** Next.js (App Router) + TypeScript + Tailwind + shadcn-style components · **Supabase** (Postgres + Auth + Storage + Realtime + RLS) · Recharts.

> Đặc tả đầy đủ ở [`MASTER_PROMPT.md`](MASTER_PROMPT.md). Bộ thiết kế UI gốc ở [`design-handoff/`](design-handoff/).

---

## Trạng thái: Milestone M0 (nền tảng) ✅

- Khung dự án Next.js + TypeScript (strict) + Tailwind với **design tokens thật** (màu, font Roboto/Roboto Mono, bo góc, bóng).
- Supabase client/server + **middleware bảo vệ route** (chưa đăng nhập → `/login`).
- **Trang đăng nhập** (S1) hoạt động qua Supabase Auth.
- **Hai khung layout**: DesktopShell (sidebar quản trị/quản lý) + MobileShell (bottom-nav nhân viên), tự chọn theo vai trò.
- Component nền tảng: Button, Card, Input/Label, StatusBadge.
- **Toàn bộ schema** (18 bảng) + **RLS** theo 4 vai trò + **hàm tính công** `fn_compute_workday` + **seed** tham số/danh mục.
- Dashboard & trang chủ nhân viên ở dạng placeholder; các phân hệ M1–M4 sẽ lấp dần.

---

## Cài đặt & chạy

### 1. Yêu cầu
- **Node.js ≥ 18** (cài tại https://nodejs.org). *(Máy hiện chưa có Node — cần cài trước.)*
- Một project **Supabase** (https://supabase.com).

### 2. Cài dependencies
```bash
npm install
```

### 3. Cấu hình môi trường
```bash
cp .env.example .env.local
```
Điền `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase → Project Settings → API).

### 4. Tạo schema trên Supabase
Mở **Supabase → SQL Editor**, chạy lần lượt:
1. `supabase/migrations/0001_schema.sql`
2. `supabase/migrations/0002_rls.sql`
3. `supabase/seed.sql`

*(Hoặc dùng Supabase CLI: `supabase db push` rồi `psql` chạy seed.)*

### 5. Tạo tài khoản quản trị đầu tiên
- Supabase → **Authentication → Users → Add user** (email + mật khẩu).
- Trong SQL Editor, nâng quyền:
  ```sql
  update profiles set role = 'qt_sua', full_name = 'Phạm Hà'
  where email_company = 'EMAIL_VỪA_TẠO';
  ```

### 6. Chạy
```bash
npm run dev
```
Mở http://localhost:3000 → đăng nhập. Vai trò `qt_sua/qt_xem/quan_ly` vào khu desktop; `nhan_vien` vào portal mobile.

---

## Cấu trúc thư mục
```
app/
  login/                  # S1 đăng nhập (ngoài shell)
  (app)/                  # khu cần đăng nhập (bọc shell theo vai trò)
    layout.tsx            # chọn DesktopShell / MobileShell
    page.tsx             # trang chủ (admin→dashboard, nhân viên→mobile home)
    dashboard/            # Dashboard (placeholder → M4)
    cham-cong/ nhan-su/ nghi-phep/ cau-hinh/ ca-nhan/
components/ui/            # Button, Card, Input, StatusBadge
components/layout/        # DesktopShell, MobileShell
lib/supabase/             # client, server, middleware
lib/types.ts              # Role, Profile, hằng số
supabase/migrations/      # 0001_schema.sql, 0002_rls.sql
supabase/seed.sql
```

## Lộ trình
M0 nền tảng ✅ → **M1** Nhân sự → **M2** Chấm công + engine tính công → **M3** Nghỉ phép → **M4** Dashboard → **M5** thông báo + hoàn thiện. Chi tiết trong `MASTER_PROMPT.md`.
