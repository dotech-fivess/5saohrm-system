"use client";

import { useTransition } from "react";
import { Lock, Unlock } from "lucide-react";
import { setAccountStatus } from "@/app/(app)/nhan-su/actions";
import { Button } from "@/components/ui/button";

export function AccountStatusButton({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const [pending, start] = useTransition();
  const locked = status === "Khóa";

  function toggle() {
    const next = locked ? "Hoạt động" : "Khóa";
    if (!confirm(locked ? "Mở khóa tài khoản này?" : "Khóa tài khoản này? Người dùng sẽ không đăng nhập được, dữ liệu lịch sử vẫn giữ.")) return;
    start(() => {
      setAccountStatus(id, next);
    });
  }

  return (
    <Button
      type="button"
      variant={locked ? "secondary" : "danger"}
      size="sm"
      disabled={pending}
      onClick={toggle}
    >
      {locked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
      {locked ? "Mở khóa" : "Khóa tài khoản"}
    </Button>
  );
}
