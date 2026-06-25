"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createAdjustment(fd: FormData) {
  const kind = String(fd.get("kind") || "");
  const date = String(fd.get("date") || "");
  const time = String(fd.get("time") || "");
  const reason = String(fd.get("reason") || "").trim();

  if (!kind || !date) return { error: "Vui lòng chọn tình huống và ngày." };
  if (!reason) return { error: "Lý do là bắt buộc." };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Chưa đăng nhập." };

  // toạ độ thời điểm đề xuất (giờ VN)
  const iso = time ? `${date}T${time}:00+07:00` : null;
  const payload: Record<string, string> = {};
  if (kind === "forgot_checkout" && iso) payload.check_out_at = iso;
  if (kind === "forgot_checkin" && iso) payload.check_in_at = iso;
  if (kind === "wrong_record" && time) payload.note = time;

  // Tìm bản ghi liên quan trong ngày (nếu có) để gắn target
  const { data: recs } = await supabase
    .from("attendance_records")
    .select("id, check_out_at")
    .eq("work_date", date)
    .limit(1);
  const targetId = recs && recs[0] ? recs[0].id : null;

  const { data: adj, error } = await supabase
    .from("attendance_adjustments")
    .insert({
      employee_id: user.id,
      kind,
      target_record_id: targetId,
      payload,
      reason,
    })
    .select("id")
    .single();

  if (error || !adj) return { error: error?.message ?? "Không tạo được đơn." };

  const { error: rpcErr } = await supabase.rpc("submit_request", {
    p_type: "attendance_adjustment",
    p_ref: adj.id,
  });
  if (rpcErr) return { error: rpcErr.message };

  revalidatePath("/cham-cong/lich-su");
  redirect("/cham-cong/lich-su");
}
