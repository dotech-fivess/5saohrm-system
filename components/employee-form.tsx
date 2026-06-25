"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2, ImagePlus, Check, Copy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardBody } from "@/components/ui/card";
import type { Catalog } from "@/lib/queries";

type Action = (
  fd: FormData
) => Promise<{ error?: string; ok?: boolean; id?: string; email?: string; password?: string } | void>;
type LocRow = { location_id: string; shift_id: string };

const STEPS = ["Thông tin cơ bản", "Công việc & Địa điểm", "Hệ thống"];

export function EmployeeForm({
  mode,
  action,
  catalogs,
  defaults,
  defaultLocations,
}: {
  mode: "create" | "edit";
  action: Action;
  catalogs: {
    departments: Catalog[];
    positions: any[];
    titles: Catalog[];
    locations: any[];
    shifts: any[];
  };
  defaults?: Record<string, any>;
  defaultLocations?: LocRow[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; password: string; id: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyErr, setCopyErr] = useState(false);
  const [step, setStep] = useState(1);
  const d = defaults ?? {};
  // Khi TẠO nhân viên: bắt buộc đủ nhân thân + công việc (chỉ áp dụng cho mode create)
  const req = mode === "create";

  const [avatarPath, setAvatarPath] = useState<string>(d.avatar_url ?? "");
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [locs, setLocs] = useState<LocRow[]>(
    defaultLocations && defaultLocations.length ? defaultLocations : []
  );
  // Phòng ban → lọc Vị trí theo phòng ban (cascading)
  const [dept, setDept] = useState<string>(d.department_id ?? "");
  const [pos, setPos] = useState<string>(d.position_id ?? "");
  const positionOptions = catalogs.positions.filter((p) => p.department_id === dept);

  async function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) return setError("Ảnh tối đa 2MB.");
    setAvatarBusy(true);
    setError(null);
    setAvatarPreview(URL.createObjectURL(file));
    const supabase = createClient();
    const path = `avatars/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("ho-so").upload(path, file);
    setAvatarBusy(false);
    if (error) return setError("Lỗi tải ảnh: " + error.message);
    setAvatarPath(path);
  }

  // Kiểm tra trường bắt buộc của từng bước. Email công ty TÙY CHỌN (để trống = tự tạo).
  function validateStep(s: number, fd: FormData): string | null {
    const t = (k: string) => String(fd.get(k) || "").trim();
    if (s === 1) {
      if (!t("full_name")) return "Họ và tên là bắt buộc.";
      if (req) {
        if (!t("gender")) return "Vui lòng chọn giới tính.";
        if (!t("phone")) return "Số điện thoại là bắt buộc.";
        if (!t("address")) return "Địa chỉ là bắt buộc.";
      }
    }
    if (s === 2 && req) {
      if (!t("department_id")) return "Vui lòng chọn phòng ban.";
      if (!t("position_id")) return "Vui lòng chọn vị trí.";
      if (!t("title_id")) return "Vui lòng chọn chức vụ.";
      if (!t("join_date")) return "Ngày vào làm là bắt buộc.";
    }
    return null;
  }

  function next() {
    setError(null);
    const err = validateStep(step, new FormData(formRef.current!));
    if (err) return setError(err);
    setStep((s) => Math.min(3, s + 1));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(formRef.current!);
    // Chặn gửi nếu còn thiếu trường bắt buộc — đưa về đúng bước có lỗi
    for (const s of [1, 2]) {
      const err = validateStep(s, fd);
      if (err) {
        setStep(s);
        return setError(err);
      }
    }
    start(async () => {
      const res = await action(fd);
      if (res?.error) setError(res.error);
      else if (res && res.email && res.password && res.id)
        setCreated({ email: res.email, password: res.password, id: res.id });
    });
  }

  const initials =
    (d.full_name || "")
      .trim()
      .split(/\s+/)
      .slice(-2)
      .map((p: string) => p[0])
      .join("")
      .toUpperCase() || "NV";

  if (created) {
    const text = `Email: ${created.email}\nMật khẩu ban đầu: ${created.password}`;
    const flashOk = () => {
      setCopyErr(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    const copyAll = async () => {
      // 1) Clipboard API (chỉ chạy ở secure context + có quyền)
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          return flashOk();
        }
      } catch {
        /* rơi xuống fallback */
      }
      // 2) Fallback execCommand
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (ok) return flashOk();
      } catch {
        /* ignore */
      }
      // 3) Không sao chép được → hướng dẫn thủ công
      setCopyErr(true);
    };
    return (
      <Card>
        <CardBody className="space-y-4">
          <div className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-success">
              <Check className="h-6 w-6 text-white" />
            </div>
            <div className="text-[16px] font-extrabold text-brand">Đã tạo nhân viên</div>
            <div className="mt-1 text-[13px] text-neutral">
              Bàn giao thông tin đăng nhập sau cho nhân viên (mật khẩu chỉ hiển thị một lần):
            </div>
          </div>
          <div className="space-y-2">
            <div className="rounded-[10px] bg-app px-3.5 py-2.5">
              <div className="text-[11.5px] text-neutral">Email đăng nhập</div>
              <div className="font-mono text-[14px] text-ink">{created.email}</div>
            </div>
            <div className="rounded-[10px] bg-app px-3.5 py-2.5">
              <div className="text-[11.5px] text-neutral">Mật khẩu ban đầu</div>
              <div className="font-mono text-[14px] text-ink">{created.password}</div>
            </div>
          </div>
          <div className="flex justify-center gap-2.5">
            <Button type="button" variant="secondary" onClick={copyAll}>
              <Copy className="h-4 w-4" /> {copied ? "Đã sao chép" : "Sao chép"}
            </Button>
            <Link href={`/nhan-su/${created.id}`}>
              <Button type="button">Xem hồ sơ →</Button>
            </Link>
          </div>
          {copyErr && (
            <div className="text-center text-[12px] text-tint-tx-warn">
              Trình duyệt không cho sao chép tự động — hãy bôi đen Email/Mật khẩu ở trên để sao chép thủ công.
            </div>
          )}
        </CardBody>
      </Card>
    );
  }

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-4">
      {/* Progress */}
      <div>
        <div className="mb-2 flex gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={"h-1 flex-1 rounded-full " + (i < step ? "bg-primary" : "bg-divider")}
            />
          ))}
        </div>
        <div className="text-[12.5px] text-neutral">
          Bước {step}/3 · {STEPS[step - 1]}
        </div>
      </div>

      {/* hidden fields giữ state */}
      <input type="hidden" name="avatar_url" value={avatarPath} />
      <input type="hidden" name="locations_json" value={JSON.stringify(locs)} />

      {/* STEP 1 */}
      <div style={{ display: step === 1 ? "block" : "none" }}>
        <Card>
          <CardBody className="space-y-3.5">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[16px] bg-tint-blue text-[20px] font-extrabold text-tint-tx-blue">
                {avatarPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarPreview} alt="avatar" className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <div>
                <label className="inline-flex cursor-pointer items-center gap-2 text-[13.5px] font-semibold text-primary">
                  <ImagePlus className="h-4 w-4" />
                  {avatarBusy ? "Đang tải…" : avatarPath ? "Đổi ảnh đại diện" : "Tải ảnh đại diện"}
                  <input type="file" accept="image/*" className="hidden" onChange={onAvatar} />
                </label>
                <div className="text-[12px] text-muted">PNG/JPG · tối đa 2MB</div>
              </div>
            </div>
            <div>
              <Label>Họ và tên *</Label>
              <Input name="full_name" defaultValue={d.full_name} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>{mode === "create" ? "Email công ty (để trống để tự tạo)" : "Email công ty"}</Label>
                <Input
                  name="email_company"
                  type="email"
                  defaultValue={d.email_company}
                  disabled={mode === "edit"}
                  placeholder={mode === "create" ? "vd: an.nv@5sao.vn — hoặc để trống" : ""}
                />
              </div>
              <div>
                <Label>Số điện thoại{req && " *"}</Label>
                <Input name="phone" defaultValue={d.phone} />
              </div>
            </div>
            {mode === "create" && (
              <div className="rounded-[9px] border border-tint-bd-blue bg-tint-blue px-3 py-2.5 text-[12.5px] text-tint-tx-blue">
                ℹ Hệ thống sẽ <b>tự tạo email công ty</b> (nếu để trống) và <b>mật khẩu ban đầu ngẫu nhiên</b>. Thông tin đăng nhập hiện ra sau khi tạo để bàn giao cho nhân viên.
              </div>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Giới tính{req && " *"}</Label>
                <Select name="gender" defaultValue={d.gender ?? ""}>
                  <option value="">—</option>
                  <option>Nam</option>
                  <option>Nữ</option>
                  <option>Khác</option>
                </Select>
              </div>
              <div>
                <Label>Ngày sinh</Label>
                <Input name="dob" type="date" defaultValue={d.dob} />
              </div>
            </div>
            <div>
              <Label>Địa chỉ{req && " *"}</Label>
              <Input name="address" defaultValue={d.address} />
            </div>
          </CardBody>
        </Card>
      </div>

      {/* STEP 2 */}
      <div style={{ display: step === 2 ? "block" : "none" }}>
        <Card>
          <CardBody className="space-y-3.5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label>Phòng ban{req && " *"}</Label>
                <Select
                  name="department_id"
                  value={dept}
                  onChange={(e) => {
                    setDept(e.target.value);
                    // đổi phòng ban → bỏ chọn vị trí nếu không thuộc phòng ban mới
                    const ok = catalogs.positions.some(
                      (p) => p.id === pos && p.department_id === e.target.value
                    );
                    if (!ok) setPos("");
                  }}
                >
                  <option value="">—</option>
                  {catalogs.departments.map((x) => (
                    <option key={x.id} value={x.id}>{x.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Vị trí{req && " *"}</Label>
                <Select
                  name="position_id"
                  value={pos}
                  onChange={(e) => setPos(e.target.value)}
                  disabled={!dept}
                >
                  <option value="">{dept ? "—" : "Chọn phòng ban trước"}</option>
                  {positionOptions.map((x) => (
                    <option key={x.id} value={x.id}>{x.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Chức vụ{req && " *"}</Label>
                <Select name="title_id" defaultValue={d.title_id ?? ""}>
                  <option value="">—</option>
                  {catalogs.titles.map((x) => (
                    <option key={x.id} value={x.id}>{x.name}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label>Loại hợp đồng</Label>
                <Select name="contract_type" defaultValue={d.contract_type ?? ""}>
                  <option value="">—</option>
                  <option>TTS</option>
                  <option>Thử việc</option>
                  <option>Chính thức</option>
                </Select>
              </div>
              <div>
                <Label>Trạng thái</Label>
                <Select name="work_status" defaultValue={d.work_status ?? "Đang làm"}>
                  <option>Đang làm</option>
                  <option>Tạm nghỉ</option>
                  <option>Nghỉ việc</option>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label>Ngày vào làm{req && " *"}</Label>
                <Input name="join_date" type="date" defaultValue={d.join_date} />
              </div>
              <div>
                <Label>Ngày thử việc</Label>
                <Input name="probation_date" type="date" defaultValue={d.probation_date} />
              </div>
              <div>
                <Label>Ngày chính thức</Label>
                <Input name="official_date" type="date" defaultValue={d.official_date} />
              </div>
            </div>

            {/* Đa địa điểm */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <Label className="mb-0">Địa điểm làm việc (chọn nhiều, mỗi nơi gắn ca)</Label>
                <button
                  type="button"
                  onClick={() => setLocs((l) => [...l, { location_id: "", shift_id: "" }])}
                  className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-primary"
                >
                  <Plus className="h-4 w-4" /> Thêm địa điểm
                </button>
              </div>
              {locs.length === 0 && <div className="text-[12.5px] text-muted">Chưa gán địa điểm nào.</div>}
              <div className="space-y-2">
                {locs.map((row, i) => {
                  const loc = catalogs.locations.find((x) => x.id === row.location_id);
                  return (
                    <div key={i} className="flex flex-wrap items-center gap-2 rounded-[10px] bg-app p-2.5">
                      <select
                        value={row.location_id}
                        onChange={(e) =>
                          setLocs((l) => l.map((r, j) => (j === i ? { ...r, location_id: e.target.value } : r)))
                        }
                        className="flex-1 rounded-md border border-input bg-surface px-2.5 py-2 text-[13px]"
                      >
                        <option value="">— Chọn địa điểm —</option>
                        {catalogs.locations.map((x) => (
                          <option key={x.id} value={x.id}>{x.name}</option>
                        ))}
                      </select>
                      <select
                        value={row.shift_id}
                        onChange={(e) =>
                          setLocs((l) => l.map((r, j) => (j === i ? { ...r, shift_id: e.target.value } : r)))
                        }
                        className="flex-1 rounded-md border border-input bg-surface px-2.5 py-2 text-[13px]"
                      >
                        <option value="">— Ca (tuỳ chọn) —</option>
                        {catalogs.shifts.map((x) => (
                          <option key={x.id} value={x.id}>{x.name}</option>
                        ))}
                      </select>
                      {loc?.lunch_start && (
                        <span className="text-[11.5px] text-muted">
                          Nghỉ trưa {String(loc.lunch_start).slice(0, 5)}–{String(loc.lunch_end).slice(0, 5)}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setLocs((l) => l.filter((_, j) => j !== i))}
                        className="text-muted hover:text-danger"
                        aria-label="Xoá"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* STEP 3 */}
      <div style={{ display: step === 3 ? "block" : "none" }}>
        <Card>
          <CardBody className="space-y-3.5">
            <div>
              <Label>Vai trò (Role)</Label>
              <Select name="role" defaultValue={d.role ?? "nhan_vien"}>
                <option value="nhan_vien">Nhân viên</option>
                <option value="quan_ly">Quản lý / Trưởng phòng</option>
                <option value="admin">Admin</option>
              </Select>
            </div>
            <div className="text-[12.5px] text-neutral">
              Trạng thái tài khoản mặc định <b>Hoạt động</b>. Khoá/mở thực hiện ở màn chi tiết hồ sơ.
            </div>
          </CardBody>
        </Card>
      </div>

      {error && <div className="text-[13px] text-tint-tx-danger">⚠ {error}</div>}

      <div className="flex justify-between">
        <Button type="button" variant="secondary" onClick={() => (step === 1 ? router.back() : setStep((s) => s - 1))}>
          {step === 1 ? "Hủy" : "← Quay lại"}
        </Button>
        {step < 3 ? (
          <Button type="button" onClick={next}>Tiếp tục →</Button>
        ) : (
          <Button type="submit" disabled={pending || avatarBusy}>
            {pending ? "Đang lưu…" : mode === "create" ? "Tạo nhân viên" : "Lưu thay đổi"}
          </Button>
        )}
      </div>
    </form>
  );
}
