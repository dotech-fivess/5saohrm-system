"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Ok = { error?: string };

const EMAIL_DOMAIN = "5sao.vn";

// Bỏ dấu tiếng Việt → ASCII
function stripVN(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

// Sinh phần local của email từ họ tên: "Nguyễn Văn An" → "an.nv"
function emailSlug(full: string) {
  const parts = stripVN((full || "").toLowerCase())
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "nv";
  const ten = parts[parts.length - 1];
  const initials = parts.slice(0, -1).map((p) => p[0]).join("");
  return initials ? `${ten}.${initials}` : ten;
}

// Mật khẩu ban đầu ngẫu nhiên (đủ mạnh, dễ đọc): 5Sao@xxxx
function genPassword() {
  return "5Sao@" + String(randomInt(1000, 10000));
}

function readProfileFields(fd: FormData) {
  const get = (k: string) => {
    const v = fd.get(k);
    const s = typeof v === "string" ? v.trim() : "";
    return s === "" ? null : s;
  };
  return {
    full_name: get("full_name") ?? "",
    avatar_url: get("avatar_url"),
    phone: get("phone"),
    gender: get("gender"),
    dob: get("dob"),
    address: get("address"),
    department_id: get("department_id"),
    position_id: get("position_id"),
    title_id: get("title_id"),
    contract_type: get("contract_type"),
    join_date: get("join_date"),
    probation_date: get("probation_date"),
    official_date: get("official_date"),
    work_status: get("work_status") ?? "Đang làm",
    role: get("role") ?? "nhan_vien",
  };
}

// Đồng bộ địa điểm làm việc (replace-all; employee_locations không bị tham chiếu bởi chấm công)
async function syncLocations(client: any, employeeId: string, json: string | null) {
  if (json == null) return;
  let list: any[] = [];
  try {
    list = JSON.parse(json || "[]");
  } catch {
    list = [];
  }
  const seen = new Set<string>();
  const rows: any[] = [];
  for (const it of list) {
    const location_id = it?.location_id;
    if (!location_id) continue;
    const shift_id = it?.shift_id || null;
    const key = location_id + "|" + (shift_id || "");
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ employee_id: employeeId, location_id, shift_id });
  }
  await client.from("employee_locations").delete().eq("employee_id", employeeId);
  if (rows.length) await client.from("employee_locations").insert(rows);
}

async function logAudit(
  entity: string,
  entityId: string,
  action: string,
  after: unknown,
  before?: unknown
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("audit_logs").insert({
    actor_id: user.id,
    entity,
    entity_id: entityId,
    action,
    before: (before ?? null) as any,
    after: after as any,
  });
}

export async function updateEmployee(id: string, fd: FormData) {
  const supabase = createClient();
  const fields = readProfileFields(fd);
  const { data: before } = await supabase.from("profiles").select("*").eq("id", id).single();
  const { error } = await supabase.from("profiles").update(fields).eq("id", id);
  if (error) return { error: error.message };
  await syncLocations(supabase, id, (fd.get("locations_json") as string) ?? null);
  await logAudit("profiles", id, "Cập nhật hồ sơ", fields, before);
  revalidatePath(`/nhan-su/${id}`);
  revalidatePath("/nhan-su");
  redirect(`/nhan-su/${id}`);
}

export async function setAccountStatus(id: string, status: "Hoạt động" | "Khóa") {
  const supabase = createClient();
  const { error } = await supabase.from("profiles").update({ account_status: status }).eq("id", id);
  if (error) return { error: error.message };
  await logAudit("profiles", id, `Đổi trạng thái tài khoản: ${status}`, { account_status: status });
  revalidatePath(`/nhan-su/${id}`);
}

type CreateResult = { ok?: true; id?: string; email?: string; password?: string; error?: string };

export async function createEmployee(fd: FormData): Promise<CreateResult> {
  let admin;
  try {
    admin = createAdminClient();
  } catch (e: any) {
    return { error: e.message };
  }

  const fullName = (fd.get("full_name") as string)?.trim() || "";
  if (!fullName) return { error: "Họ và tên là bắt buộc." };

  // Email: dùng giá trị admin nhập nếu có, ngược lại tự sinh từ họ tên
  const manual = (fd.get("email_company") as string)?.trim().toLowerCase();
  const base = manual && manual.includes("@") ? manual : `${emailSlug(fullName)}@${EMAIL_DOMAIN}`;
  const [local, domain] = base.split("@");

  // Đảm bảo email duy nhất
  let email = base;
  for (let n = 1; n <= 50; n++) {
    const { data: ex } = await admin
      .from("profiles")
      .select("id")
      .eq("email_company", email)
      .maybeSingle();
    if (!ex) break;
    email = `${local}${n}@${domain}`;
  }

  const password = genPassword();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) return { error: error?.message ?? "Không tạo được tài khoản." };

  const fields = { ...readProfileFields(fd), email_company: email };
  const { error: upErr } = await admin.from("profiles").update(fields).eq("id", data.user.id);
  if (upErr) return { error: upErr.message };
  await syncLocations(admin, data.user.id, (fd.get("locations_json") as string) ?? null);

  await logAudit("profiles", data.user.id, "Tạo hồ sơ", { ...fields, password: "(đã cấp)" });
  revalidatePath("/nhan-su");
  // KHÔNG redirect — trả thông tin tài khoản để admin bàn giao cho nhân viên
  return { ok: true, id: data.user.id, email, password };
}

// Cập nhật địa điểm làm việc trực tiếp tại hồ sơ (S5 tab Công việc)
export async function setEmployeeLocations(employeeId: string, fd: FormData): Promise<Ok> {
  const supabase = createClient();
  await syncLocations(supabase, employeeId, (fd.get("locations_json") as string) ?? null);
  await logAudit("profiles", employeeId, "Cập nhật địa điểm làm việc", {
    locations: fd.get("locations_json"),
  });
  revalidatePath(`/nhan-su/${employeeId}`);
  return {};
}

// ---------- File hồ sơ (S7) ----------
export async function recordEmployeeFile(employeeId: string, fd: FormData): Promise<Ok> {
  const doc_type = (fd.get("doc_type") as string) || "";
  const storage_path = (fd.get("storage_path") as string) || "";
  const file_name = (fd.get("file_name") as string) || null;
  const size = fd.get("size") ? Number(fd.get("size")) : null;
  if (!doc_type || !storage_path) return { error: "Thiếu thông tin file." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Thay thế nếu đã có loại tài liệu này: xoá object cũ + tăng version
  const { data: existing } = await supabase
    .from("employee_files")
    .select("id, storage_path, version")
    .eq("employee_id", employeeId)
    .eq("doc_type", doc_type)
    .maybeSingle();

  if (existing) {
    if (existing.storage_path && existing.storage_path !== storage_path) {
      await supabase.storage.from("ho-so").remove([existing.storage_path]);
    }
    const { error } = await supabase
      .from("employee_files")
      .update({ storage_path, file_name, size, version: (existing.version ?? 1) + 1, uploaded_by: user?.id })
      .eq("id", existing.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("employee_files").insert({
      employee_id: employeeId,
      doc_type,
      storage_path,
      file_name,
      size,
      uploaded_by: user?.id,
    });
    if (error) return { error: error.message };
  }
  await logAudit("profiles", employeeId, `Tải lên file: ${doc_type}`, { doc_type, file_name });
  revalidatePath(`/nhan-su/${employeeId}`);
  return {};
}

export async function deleteEmployeeFile(employeeId: string, id: string): Promise<Ok> {
  const supabase = createClient();
  const { data: row } = await supabase.from("employee_files").select("storage_path, doc_type").eq("id", id).single();
  if (row?.storage_path) await supabase.storage.from("ho-so").remove([row.storage_path]);
  const { error } = await supabase.from("employee_files").delete().eq("id", id);
  if (error) return { error: error.message };
  await logAudit("profiles", employeeId, `Xoá file: ${row?.doc_type ?? ""}`, { id });
  revalidatePath(`/nhan-su/${employeeId}`);
  return {};
}

export async function getFileUrl(path: string): Promise<{ url?: string; error?: string }> {
  const supabase = createClient();
  const { data, error } = await supabase.storage.from("ho-so").createSignedUrl(path, 300);
  if (error || !data) return { error: error?.message ?? "Không tạo được liên kết." };
  return { url: data.signedUrl };
}

// ---------- Danh mục cơ bản (dùng bởi CatalogManager) ----------
const TABLES = ["departments", "positions", "titles"] as const;
type CatalogTable = (typeof TABLES)[number];

export async function addCatalogItem(table: CatalogTable, fd: FormData): Promise<Ok> {
  const name = (fd.get("name") as string)?.trim();
  if (!name) return { error: "Tên không được trống." };
  const supabase = createClient();
  const { error } = await supabase.from(table).insert({ name });
  if (error) return { error: error.message };
  revalidatePath("/cau-hinh");
  return {};
}

export async function deleteCatalogItem(table: CatalogTable, id: string): Promise<Ok> {
  const supabase = createClient();
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error)
    return {
      error: error.message.includes("foreign key")
        ? "Không thể xoá: mục đang được sử dụng."
        : error.message,
    };
  revalidatePath("/cau-hinh");
  return {};
}
