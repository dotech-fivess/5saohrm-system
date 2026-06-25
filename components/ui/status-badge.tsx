import { cn } from "@/lib/utils";

type Tone = "success" | "warning" | "danger" | "blue" | "neutral";

const TONE: Record<Tone, { bg: string; text: string; dot: string }> = {
  success: { bg: "bg-tint-success", text: "text-tint-tx-success", dot: "bg-success" },
  warning: { bg: "bg-tint-warn", text: "text-tint-tx-warn", dot: "bg-warning" },
  danger: { bg: "bg-tint-danger", text: "text-tint-tx-danger", dot: "bg-danger" },
  blue: { bg: "bg-tint-blue", text: "text-tint-tx-blue", dot: "bg-primary" },
  neutral: { bg: "bg-[#F0F3F1]", text: "text-neutral", dot: "bg-muted" },
};

export function StatusBadge({
  tone,
  children,
  dot = true,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-[12.5px] font-semibold",
        t.bg,
        t.text,
        className
      )}
    >
      {dot && <span className={cn("h-[7px] w-[7px] rounded-full", t.dot)} />}
      {children}
    </span>
  );
}
