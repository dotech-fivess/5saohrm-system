import { Card, CardBody, CardTitle } from "@/components/ui/card";

export function Placeholder({
  title,
  milestone,
  screens,
}: {
  title: string;
  milestone: string;
  screens?: string;
}) {
  return (
    <Card>
      <CardBody>
        <CardTitle className="mb-2">{title}</CardTitle>
        <p className="text-sm leading-relaxed text-neutral">
          Phân hệ này sẽ được dựng ở <b>{milestone}</b>
          {screens ? ` theo màn ${screens}` : ""}. Hiện M0 mới hoàn tất nền tảng
          (auth, RLS, schema, design system, khung layout).
        </p>
      </CardBody>
    </Card>
  );
}
