import { notFound } from "next/navigation";
import { getCatalogs, getEmployee } from "@/lib/queries";
import { updateEmployee } from "../../actions";
import { EmployeeForm } from "@/components/employee-form";
import { PageHeader } from "@/components/page-header";

export default async function Page({ params }: { params: { id: string } }) {
  const [{ profile, locations }, catalogs] = await Promise.all([
    getEmployee(params.id),
    getCatalogs(),
  ]);
  if (!profile) notFound();

  const action = updateEmployee.bind(null, params.id);
  const defaultLocations = locations.map((l: any) => ({
    location_id: l.location_id,
    shift_id: l.shift_id ?? "",
  }));

  return (
    <div className="mx-auto max-w-[680px] space-y-4">
      <PageHeader
        crumbs={[
          { label: "Nhân sự", href: "/nhan-su" },
          { label: profile.full_name, href: `/nhan-su/${params.id}` },
          { label: "Chỉnh sửa" },
        ]}
        title="Chỉnh sửa hồ sơ"
      />
      <EmployeeForm
        mode="edit"
        action={action}
        catalogs={catalogs}
        defaults={profile}
        defaultLocations={defaultLocations}
      />
    </div>
  );
}
