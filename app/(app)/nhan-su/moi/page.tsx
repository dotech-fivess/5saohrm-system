import { getCatalogs } from "@/lib/queries";
import { createEmployee } from "../actions";
import { EmployeeForm } from "@/components/employee-form";
import { PageHeader } from "@/components/page-header";

export default async function Page() {
  const catalogs = await getCatalogs();
  return (
    <div className="mx-auto max-w-[680px] space-y-4">
      <PageHeader
        crumbs={[{ label: "Nhân sự", href: "/nhan-su" }, { label: "Thêm nhân viên" }]}
        title="Thêm nhân viên mới"
      />
      <EmployeeForm mode="create" action={createEmployee} catalogs={catalogs} />
    </div>
  );
}
