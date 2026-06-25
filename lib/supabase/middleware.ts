import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAdminArea, type Role } from "@/lib/types";

type CookieToSet = { name: string; value: string; options: CookieOptions };

// Làm mới session trên mỗi request và bảo vệ route cần đăng nhập.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  // Hai prefix đăng nhập: /login = Nhân viên (mobile), /admin = Quản trị (desktop)
  const isLoginPage = pathname === "/login" || pathname === "/admin";
  const isPublic =
    isLoginPage ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/public");

  // Tài khoản bị khóa thì không được vào hệ thống (SRS mục 3)
  let locked = false;
  let role: Role | undefined;
  if (user) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("account_status, role")
      .eq("id", user.id)
      .single();
    const p = prof as { account_status?: string; role?: Role } | null;
    locked = p?.account_status === "Khóa";
    role = p?.role;
  }

  // Màn đăng nhập đúng với vai trò (dùng cho điều hướng khóa tài khoản)
  const loginFor = (r: Role | undefined) => (r && isAdminArea(r) ? "/admin" : "/login");

  // Chưa đăng nhập → mặc định về màn Nhân viên (/login)
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Tài khoản khóa → đẩy về đúng màn đăng nhập theo vai trò, kèm cảnh báo
  if (user && locked && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = loginFor(role);
    url.searchParams.set("locked", "1");
    return NextResponse.redirect(url);
  }

  // Đã đăng nhập (không khóa) mà vào màn đăng nhập → đẩy về trang chủ
  if (user && !locked && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
