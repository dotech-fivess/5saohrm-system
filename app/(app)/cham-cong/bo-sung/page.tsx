import { AdjustmentForm } from "@/components/adjustment-form";
import { PageHeader } from "@/components/page-header";

export default function Page() {
  return (
    <div className="mx-auto max-w-[520px] space-y-4">
      <PageHeader
        crumbs={[{ label: "Chấm công", href: "/cham-cong" }, { label: "Bổ sung công" }]}
        title="Yêu cầu bổ sung công"
      />
      <AdjustmentForm />
    </div>
  );
}
