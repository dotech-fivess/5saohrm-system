"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Lock, Check, AlertTriangle, RotateCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const WORK_TYPES = [
  { code: "HC", label: "HC" },
  { code: "TC120", label: "TC120" },
  { code: "TC150", label: "TC150" },
  { code: "ON", label: "ON" },
];

type Rec = {
  id: string;
  check_in_at: string;
  check_out_at: string | null;
  checkin_status: string | null;
  computed_workday: number;
  state: string;
  work_type_id: string;
} | null;

export function CheckinPanel({ shiftLabel }: { shiftLabel: string }) {
  const router = useRouter();
  const [now, setNow] = useState<string>("--:--:--");
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState(false);
  const [locating, setLocating] = useState(true);
  const watchRef = useRef<number | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [addrLoading, setAddrLoading] = useState(false);
  const lastGeoKey = useRef<string | null>(null);
  const [workType, setWorkType] = useState("HC");
  const [rec, setRec] = useState<Rec>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Đồng hồ
  useEffect(() => {
    const t = setInterval(() => {
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, "0");
      setNow(`${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // GPS — tự xin quyền + theo dõi vị trí (bắt ngay khi được cấp quyền, kể cả cấp muộn)
  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setGpsError(true);
      setLocating(false);
      return;
    }
    setGpsError(false);
    setLocating(true);
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsError(false);
        setLocating(false);
      },
      () => {
        setGpsError(true);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }, []);

  // Bản ghi hôm nay
  const loadToday = useCallback(async () => {
    const supabase = createClient();
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("attendance_records")
      .select("id,check_in_at,check_out_at,checkin_status,computed_workday,state,work_type_id")
      .eq("work_date", today)
      .order("check_in_at", { ascending: false })
      .limit(1);
    setRec((data && data[0]) ?? null);
    setLoading(false);
  }, []);

  // Vào màn hình: tự xin quyền + lấy vị trí; phản ứng khi quyền thay đổi; dọn watch khi rời
  useEffect(() => {
    locate();
    loadToday();

    let perm: PermissionStatus | null = null;
    const onPermChange = () => {
      if (!perm) return;
      if (perm.state === "granted") locate();
      else if (perm.state === "denied") {
        setGpsError(true);
        setLocating(false);
      }
    };
    const permApi = navigator.permissions;
    if (permApi?.query) {
      permApi
        .query({ name: "geolocation" as PermissionName })
        .then((p) => {
          perm = p;
          p.addEventListener("change", onPermChange);
        })
        .catch(() => {});
    }

    return () => {
      if (watchRef.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchRef.current);
      perm?.removeEventListener("change", onPermChange);
    };
  }, [locate, loadToday]);

  // Toạ độ → địa chỉ khu vực (reverse geocoding). Chỉ gọi khi toạ độ đổi đáng kể (~11m).
  useEffect(() => {
    if (!gps) return;
    const key = `${gps.lat.toFixed(4)},${gps.lng.toFixed(4)}`;
    if (key === lastGeoKey.current) return;
    lastGeoKey.current = key;
    let aborted = false;
    setAddrLoading(true);
    fetch(`/api/geocode?lat=${gps.lat}&lng=${gps.lng}`)
      .then((r) => r.json())
      .then((d) => {
        if (!aborted) setAddress(d?.address ?? null);
      })
      .catch(() => {
        if (!aborted) setAddress(null);
      })
      .finally(() => {
        if (!aborted) setAddrLoading(false);
      });
    return () => {
      aborted = true;
    };
  }, [gps]);

  async function checkin() {
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("attendance_checkin", {
      p_work_type: workType,
      p_lat: gps?.lat ?? null,
      p_lng: gps?.lng ?? null,
    });
    setBusy(false);
    if (error) return setMsg(error.message);
    await loadToday();
    router.refresh();
  }

  async function checkout() {
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("attendance_checkout", {
      p_lat: gps?.lat ?? null,
      p_lng: gps?.lng ?? null,
    });
    setBusy(false);
    if (error) return setMsg(error.message);
    await loadToday();
    router.refresh();
  }

  if (loading) {
    return (
      <div className="rounded-card bg-surface p-6 text-center text-sm text-neutral shadow-card">
        Đang tải…
      </div>
    );
  }

  const open = rec && rec.state === "missing_checkout";
  const done = rec && rec.state === "complete";

  return (
    <div className="space-y-3.5">
      {/* Map + GPS */}
      <div className="relative h-[120px] overflow-hidden rounded-card" style={{ background: "linear-gradient(135deg,#dce8e2,#cfe0d7)" }}>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="absolute left-1/2 top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-primary shadow" />
        <div className="absolute bottom-2 left-2 right-2 rounded-md bg-white/90 px-2.5 py-1.5 text-[11px] text-brand">
          <div className="flex items-start gap-1 font-semibold">
            <MapPin className="mt-[1px] h-3 w-3 flex-none" />
            <span className="leading-snug">
              {gps
                ? address || (addrLoading ? "Đang xác định khu vực…" : `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}`)
                : gpsError
                ? "Chưa lấy được vị trí"
                : "Đang xin quyền vị trí…"}
            </span>
          </div>
          {gps && address && (
            <div className="mt-0.5 pl-4 text-[10px] font-normal text-neutral">
              {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-[13px] bg-surface px-3.5 py-3">
        <div>
          <div className="text-[11.5px] text-neutral">Ca hôm nay</div>
          <div className="text-[13.5px] font-bold text-brand">{shiftLabel}</div>
        </div>
        <span
          className={
            "rounded-pill px-2.5 py-1 text-[11px] font-semibold " +
            (gps ? "bg-tint-blue text-tint-tx-blue" : "bg-tint-warn text-tint-tx-warn")
          }
        >
          {gps ? "GPS hợp lệ" : locating ? "Đang lấy GPS…" : "Chưa có GPS"}
        </span>
      </div>

      <div className="text-center">
        <div className="font-mono text-[30px] font-medium text-brand">{now}</div>
        <div className="text-[11.5px] text-neutral">
          {new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}
        </div>
      </div>

      {msg && <div className="rounded-md bg-tint-danger px-3 py-2 text-[12.5px] text-tint-tx-danger">⚠ {msg}</div>}

      {/* Trạng thái */}
      {done ? (
        <>
          <div className="rounded-card border border-tint-bd-success bg-tint-success p-4 text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-success">
              <Check className="h-6 w-6 text-white" />
            </div>
            <div className="text-[15px] font-extrabold text-success">Hoàn tất công hôm nay</div>
            <div className="mt-1 text-[12.5px] text-tint-tx-success">
              Giờ ra: <b>{rec!.check_out_at ? new Date(rec!.check_out_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—"}</b>
            </div>
            <div className="mt-2 inline-block rounded-[10px] bg-primary px-4 py-2 text-white">
              <span className="text-[11px] opacity-85">Ngày công</span>
              <div className="font-mono text-[22px] font-black">{rec!.computed_workday}</div>
            </div>
          </div>
          <button
            onClick={checkout}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-[14px] border border-input bg-surface py-3 text-[14px] font-semibold text-brand disabled:opacity-60"
          >
            <RotateCw className="h-4 w-4" /> {busy ? "Đang cập nhật…" : "Check-out lại (cập nhật giờ ra)"}
          </button>
          <div className="text-center text-[11px] text-muted">Có thể check-out nhiều lần; hệ thống ghi nhận lần cuối cùng.</div>
        </>
      ) : open ? (
        <>
          <div className="rounded-card border border-tint-bd-success bg-tint-success p-4 text-center">
            <div className="text-[15px] font-extrabold text-success">
              Đã check-in lúc {new Date(rec!.check_in_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
            </div>
            <div className="mt-1 text-[12.5px] text-tint-tx-success">
              Trạng thái: <b>{rec!.checkin_status}</b>
            </div>
            <div className="mt-2 flex items-center justify-center gap-1 text-[11.5px] text-neutral">
              <Lock className="h-3 w-3" /> Thời gian &amp; định vị đã khoá
            </div>
          </div>
          <button
            onClick={checkout}
            disabled={busy}
            className="w-full rounded-[14px] bg-brand py-4 text-[16px] font-bold text-white disabled:opacity-60"
          >
            ● Check-out
          </button>
        </>
      ) : gpsError ? (
        <div className="space-y-3">
          <div className="rounded-card border border-tint-bd-danger bg-tint-danger p-4">
            <div className="mb-1.5 flex items-center gap-2 font-bold text-tint-tx-danger">
              <AlertTriangle className="h-5 w-5" /> Chưa lấy được vị trí
            </div>
            <div className="text-[12.5px] text-tint-tx-danger">
              Bật Định vị (GPS) cho trình duyệt rồi thử lại. (Vẫn có thể chấm công, toạ độ sẽ để trống.)
            </div>
          </div>
          <button onClick={locate} className="flex w-full items-center justify-center gap-2 rounded-[12px] border border-input bg-surface py-3 text-[14px] font-semibold text-brand">
            <RotateCw className="h-4 w-4" /> Thử lấy lại vị trí
          </button>
          <CheckinButton workType={workType} setWorkType={setWorkType} onClick={checkin} busy={busy} />
        </div>
      ) : (
        <CheckinButton workType={workType} setWorkType={setWorkType} onClick={checkin} busy={busy} />
      )}
    </div>
  );
}

function CheckinButton({
  workType,
  setWorkType,
  onClick,
  busy,
}: {
  workType: string;
  setWorkType: (c: string) => void;
  onClick: () => void;
  busy: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        {WORK_TYPES.map((w) => (
          <button
            key={w.code}
            onClick={() => setWorkType(w.code)}
            className={
              "flex-1 rounded-[8px] py-2 text-[11.5px] font-semibold " +
              (workType === w.code ? "bg-primary text-white" : "border border-input bg-surface text-neutral")
            }
          >
            {w.label}
          </button>
        ))}
      </div>
      <div className="text-center">
        <button
          onClick={onClick}
          disabled={busy}
          className="mx-auto flex h-[150px] w-[150px] flex-col items-center justify-center rounded-full bg-primary text-white shadow-btn disabled:opacity-60"
        >
          <span className="text-[30px] leading-none">●</span>
          <span className="mt-1 text-[17px] font-extrabold">{busy ? "…" : "Check-in"}</span>
        </button>
      </div>
    </div>
  );
}
