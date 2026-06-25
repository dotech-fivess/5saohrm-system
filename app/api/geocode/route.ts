// Reverse geocoding: toạ độ GPS → địa chỉ khu vực (Nominatim/OpenStreetMap, miễn phí, không cần key).
// Gọi server-side để tránh CORS + đặt User-Agent đúng chính sách Nominatim, có cache 24h.
export const runtime = "nodejs";

function conciseAddress(a: any, fallback: string): string {
  const parts = [
    a?.road || a?.pedestrian || a?.neighbourhood,
    a?.quarter || a?.suburb || a?.ward || a?.village,
    a?.city_district || a?.district || a?.county,
    a?.city || a?.town || a?.state,
  ].filter(Boolean);
  const uniq = [...new Set(parts)] as string[];
  return uniq.length ? uniq.join(", ") : fallback;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  if (!lat || !lng || Number.isNaN(+lat) || Number.isNaN(+lng)) {
    return Response.json({ error: "Thiếu toạ độ hợp lệ", address: null }, { status: 400 });
  }

  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
    lat
  )}&lon=${encodeURIComponent(lng)}&addressdetails=1&accept-language=vi`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "5SaoHRM/1.0 (https://5sao.com.vn; HR cham cong)",
        "Accept-Language": "vi",
      },
      // Cache 24h: cùng toạ độ → cùng địa chỉ, hạn chế gọi Nominatim
      next: { revalidate: 86400 },
    });
    if (!res.ok) throw new Error("geocode upstream " + res.status);
    const data = await res.json();
    const address = conciseAddress(data.address, data.display_name || "");
    return new Response(JSON.stringify({ address, display_name: data.display_name ?? null }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=86400" },
    });
  } catch (e: any) {
    // Lỗi geocode không chặn chấm công — trả address null để client tự dùng toạ độ
    return Response.json({ error: e?.message ?? "geocode failed", address: null }, { status: 200 });
  }
}
