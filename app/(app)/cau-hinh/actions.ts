"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Ok = { error?: string };

function s(fd: FormData, k: string): string {
  const v = fd.get(k);
  return typeof v === "string" ? v.trim() : "";
}
function nullable(fd: FormData, k: string): string | null {
  const v = s(fd, k);
  return v === "" ? null : v;
}

// ---------- Danh mục cơ bản (phòng ban / vị trí / chức vụ) ----------
type CatalogTable = "departments" | "positions" | "titles";

export async function updateCatalogItem(table: CatalogTable, id: string, fd: FormData): Promise<Ok> {
  const name = s(fd, "name");
  if (!name) return { error: "Tên không được trống." };
  const supabase = createClient();
  const { error } = await supabase.from(table).update({ name }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/cau-hinh");
  return {};
}

// ---------- Vị trí (thuộc phòng ban) ----------
export async function addPosition(fd: FormData): Promise<Ok> {
  const name = s(fd, "name");
  const department_id = nullable(fd, "department_id");
  if (!department_id) return { error: "Chọn phòng ban cho vị trí." };
  if (!name) return { error: "Tên vị trí là bắt buộc." };
  const supabase = createClient();
  const { error } = await supabase.from("positions").insert({ name, department_id });
  if (error)
    return { error: error.message.includes("duplicate") ? "Vị trí này đã có trong phòng ban." : error.message };
  revalidatePath("/cau-hinh");
  return {};
}

export async function updatePosition(id: string, fd: FormData): Promise<Ok> {
  const name = s(fd, "name");
  const department_id = nullable(fd, "department_id");
  if (!department_id) return { error: "Chọn phòng ban cho vị trí." };
  if (!name) return { error: "Tên vị trí là bắt buộc." };
  const supabase = createClient();
  const { error } = await supabase.from("positions").update({ name, department_id }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/cau-hinh");
  return {};
}

export async function deletePosition(id: string): Promise<Ok> {
  const supabase = createClient();
  const { error } = await supabase.from("positions").delete().eq("id", id);
  if (error)
    return {
      error: error.message.includes("foreign key")
        ? "Không thể xoá: vị trí đang được nhân viên sử dụng."
        : error.message,
    };
  revalidatePath("/cau-hinh");
  return {};
}

// ---------- Địa điểm ----------
function locationFields(fd: FormData) {
  return {
    name: s(fd, "name"),
    province: nullable(fd, "province"),
    address: nullable(fd, "address"),
    work_start: nullable(fd, "work_start"),
    work_end: nullable(fd, "work_end"),
    lunch_start: nullable(fd, "lunch_start"),
    lunch_end: nullable(fd, "lunch_end"),
  };
}

export async function addLocation(fd: FormData): Promise<Ok> {
  const f = locationFields(fd);
  if (!f.name) return { error: "Tên địa điểm là bắt buộc." };
  const supabase = createClient();
  const { error } = await supabase.from("locations").insert(f);
  if (error) return { error: error.message };
  revalidatePath("/cau-hinh");
  return {};
}

export async function updateLocation(id: string, fd: FormData): Promise<Ok> {
  const f = locationFields(fd);
  if (!f.name) return { error: "Tên địa điểm là bắt buộc." };
  const supabase = createClient();
  const { error } = await supabase.from("locations").update(f).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/cau-hinh");
  return {};
}

export async function deleteLocation(id: string): Promise<Ok> {
  const supabase = createClient();
  const { error } = await supabase.from("locations").delete().eq("id", id);
  if (error)
    return {
      error: error.message.includes("foreign key")
        ? "Không thể xoá: địa điểm đang được nhân viên/chấm công sử dụng."
        : error.message,
    };
  revalidatePath("/cau-hinh");
  return {};
}

// ---------- Ca làm việc ----------
export async function addShift(fd: FormData): Promise<Ok> {
  const name = s(fd, "name");
  if (!name) return { error: "Tên ca là bắt buộc." };
  const supabase = createClient();
  const { error } = await supabase.from("shifts").insert({
    name,
    start_time: nullable(fd, "start_time"),
    end_time: nullable(fd, "end_time"),
  });
  if (error) return { error: error.message };
  revalidatePath("/cau-hinh");
  return {};
}

export async function updateShift(id: string, fd: FormData): Promise<Ok> {
  const name = s(fd, "name");
  if (!name) return { error: "Tên ca là bắt buộc." };
  const supabase = createClient();
  const { error } = await supabase
    .from("shifts")
    .update({ name, start_time: nullable(fd, "start_time"), end_time: nullable(fd, "end_time") })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/cau-hinh");
  return {};
}

export async function deleteShift(id: string): Promise<Ok> {
  const supabase = createClient();
  const { error } = await supabase.from("shifts").delete().eq("id", id);
  if (error)
    return {
      error: error.message.includes("foreign key")
        ? "Không thể xoá: ca đang được gán cho nhân viên/địa điểm."
        : error.message,
    };
  revalidatePath("/cau-hinh");
  return {};
}

// ---------- Loại công (chỉ sửa tên + hệ số; code cố định) ----------
export async function updateWorkType(id: string, fd: FormData): Promise<Ok> {
  const name = s(fd, "name");
  const coef = Number(s(fd, "coefficient"));
  if (!name) return { error: "Tên loại công là bắt buộc." };
  if (!Number.isFinite(coef) || coef <= 0) return { error: "Hệ số không hợp lệ." };
  const supabase = createClient();
  const { error } = await supabase.from("work_types").update({ name, coefficient: coef }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/cau-hinh");
  return {};
}

// ---------- Tham số cấu hình (số) ----------
export async function updateConfigParameter(key: string, fd: FormData): Promise<Ok> {
  const raw = s(fd, "value");
  const num = Number(raw);
  if (!Number.isFinite(num)) return { error: "Giá trị phải là số." };
  const supabase = createClient();
  // value là jsonb số → ghi dạng số (không bọc chuỗi) để fn_config_num cast đúng
  const { error } = await supabase.from("config_parameters").update({ value: num }).eq("key", key);
  if (error) return { error: error.message };
  revalidatePath("/cau-hinh");
  return {};
}
