import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DesktopShell } from "@/components/layout/desktop-shell";
import { MobileShell } from "@/components/layout/mobile-shell";
import { isAdminArea, type Profile } from "@/lib/types";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data } = await supabase
    .from("profiles")
    .select("*, title:titles(name)")
    .eq("id", user.id)
    .single();
  const profile = data as (Profile & { title?: { name: string } | null }) | null;

  // Hồ sơ chưa được khởi tạo (trường hợp hiếm) — hiển thị tối thiểu.
  const role = profile?.role ?? "nhan_vien";
  const fullName = profile?.full_name ?? user.email ?? "Người dùng";
  // Trưởng phòng = nhân viên có chức vụ 'Trưởng phòng' → duyệt đơn phòng mình.
  // Quản lý (role) → duyệt qua hàng chờ tổng hợp toàn công ty.
  const isHead = profile?.title?.name === "Trưởng phòng";
  const approveHref =
    role === "quan_ly" ? "/nghi-phep/cho-duyet" : isHead ? "/nghi-phep/duyet-phong" : undefined;

  const { count: unread } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .is("read_at", null);

  if (isAdminArea(role)) {
    return (
      <DesktopShell role={role} fullName={fullName} unread={unread ?? 0}>
        {children}
      </DesktopShell>
    );
  }

  const hour = new Date().getHours();
  const greeting =
    hour < 11 ? "Chào buổi sáng," : hour < 18 ? "Chào buổi chiều," : "Chào buổi tối,";

  return (
    <MobileShell greeting={greeting} fullName={fullName} unread={unread ?? 0} approveHref={approveHref}>
      {children}
    </MobileShell>
  );
}
