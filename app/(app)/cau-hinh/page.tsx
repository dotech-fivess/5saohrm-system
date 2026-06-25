import Link from "next/link";
import { getCatalogs, getConfigParameters } from "@/lib/queries";
import { Card, CardBody } from "@/components/ui/card";
import { CatalogManager } from "@/components/catalog-manager";
import { PositionManager } from "@/components/position-manager";
import { LocationManager } from "@/components/location-manager";
import { ShiftManager } from "@/components/shift-manager";
import { ConfigEditor } from "@/components/config-editor";
import { Building2, Briefcase, BadgeCheck, Clock, MapPin, SlidersHorizontal } from "lucide-react";

const TABS = [
  { key: "departments", label: "Phòng ban", desc: "Danh mục phòng ban của công ty.", icon: Building2 },
  { key: "positions", label: "Vị trí", desc: "Danh mục vị trí công việc.", icon: Briefcase },
  { key: "titles", label: "Chức vụ", desc: "Danh mục chức vụ.", icon: BadgeCheck },
  { key: "shifts", label: "Ca làm việc", desc: "Ca làm việc — khung giờ vào/ra.", icon: Clock },
  { key: "locations", label: "Địa điểm", desc: "Địa điểm làm việc, giờ làm & nghỉ trưa.", icon: MapPin },
  { key: "params", label: "Tham số & hệ số", desc: "Hệ số ngày công & ngưỡng tính công (cấu hình được).", icon: SlidersHorizontal },
];

export default async function Page({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const [catalogs, params] = await Promise.all([getCatalogs(), getConfigParameters()]);
  const tab = searchParams.tab ?? "departments";
  const current = TABS.find((t) => t.key === tab) ?? TABS[0];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
        {/* Nav dọc — phóng to, dễ thao tác */}
        <Card className="h-fit">
          <CardBody className="p-3">
            <div className="px-2 pb-2 text-[11px] font-bold uppercase tracking-wide text-muted">
              Mục cấu hình
            </div>
            <div className="space-y-1.5">
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = t.key === tab;
                return (
                  <Link
                    key={t.key}
                    href={`/cau-hinh?tab=${t.key}`}
                    className={
                      "flex items-center gap-3 rounded-[11px] px-3.5 py-3 text-[14.5px] transition-colors " +
                      (active
                        ? "bg-primary text-white shadow-btn"
                        : "text-ink hover:bg-app")
                    }
                  >
                    <Icon className={"h-[20px] w-[20px] " + (active ? "text-white" : "text-primary")} />
                    <span className="font-semibold">{t.label}</span>
                  </Link>
                );
              })}
            </div>
          </CardBody>
        </Card>

        {/* Panel nội dung — chiếm trọn phần còn lại */}
        <Card>
          <CardBody className="p-6">
            <div className="mb-5 border-b pb-4">
              <div className="text-[17px] font-extrabold text-brand">{current.label}</div>
              <div className="mt-0.5 text-[13px] text-neutral">{current.desc}</div>
            </div>

            {tab === "departments" && <CatalogManager table="departments" items={catalogs.departments} />}
            {tab === "positions" && <PositionManager positions={catalogs.positions} departments={catalogs.departments} />}
            {tab === "titles" && <CatalogManager table="titles" items={catalogs.titles} />}
            {tab === "shifts" && <ShiftManager shifts={catalogs.shifts} />}
            {tab === "locations" && <LocationManager locations={catalogs.locations} />}
            {tab === "params" && <ConfigEditor workTypes={catalogs.workTypes} params={params} />}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
