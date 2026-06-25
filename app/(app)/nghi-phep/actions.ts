"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createLeave(fd: FormData) {
  const leave_type_id = String(fd.get("leave_type_id") || "");
  const start_date = String(fd.get("start_date") || "");
  const end_date = String(fd.get("end_date") || start_date);
  const hoursRaw = String(fd.get("hours") || "");
  const reason = String(fd.get("reason") || "").trim();
  const attachment_url = String(fd.get("attachment_url") || "") || null;

  if (!leave_type_id) return { error: "Vui lòng chọn loại nghỉ." };
  if (!start_date) return { error: "Vui lòng chọn ngày." };
  if (!reason) return { error: "Lý do là bắt buộc." };

  const hours = hoursRaw ? Number(hoursRaw) : null;
  if (hours != null && hours > 3) return { error: "Đi trễ/về sớm tối đa 3 giờ." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Chưa đăng nhập." };

  // Kiểm tra loại nghỉ có yêu cầu đính kèm không
  const { data: lt } = await supabase
    .from("leave_types")
    .select("requires_attachment")
    .eq("id", leave_type_id)
    .single();
  if (lt?.requires_attachment && !attachment_url) {
    return { error: "Loại nghỉ này bắt buộc đính kèm minh chứng." };
  }

  const workday_impact = hours != null ? hours : null;

  const { data: req, error } = await supabase
    .from("leave_requests")
    .insert({
      employee_id: user.id,
      leave_type_id,
      start_date,
      end_date,
      hours,
      reason,
      attachment_url,
      workday_impact,
    })
    .select("id")
    .single();

  if (error || !req) return { error: error?.message ?? "Không tạo được đơn." };

  const { error: rpcErr } = await supabase.rpc("submit_request", {
    p_type: "leave",
    p_ref: req.id,
  });
  if (rpcErr) return { error: rpcErr.message };

  revalidatePath("/nghi-phep");
  redirect("/nghi-phep");
}
