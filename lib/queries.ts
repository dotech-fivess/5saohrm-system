import { createClient } from "@/lib/supabase/server";

export type Catalog = { id: string; name: string };

export async function getCatalogs() {
  const supabase = createClient();
  const [departments, positions, titles, locations, shifts, workTypes, locationShifts] =
    await Promise.all([
      supabase.from("departments").select("id,name").order("name"),
      supabase.from("positions").select("id,name,department_id").order("name"),
      supabase.from("titles").select("id,name").order("name"),
      supabase
        .from("locations")
        .select("id,name,province,address,work_start,work_end,lunch_start,lunch_end")
        .order("name"),
      supabase.from("shifts").select("id,name,start_time,end_time").order("name"),
      supabase.from("work_types").select("id,code,name,coefficient").order("code"),
      supabase.from("location_shifts").select("id,location_id,shift_id"),
    ]);
  return {
    departments: (departments.data ?? []) as Catalog[],
    positions: (positions.data ?? []) as any[],
    titles: (titles.data ?? []) as Catalog[],
    locations: (locations.data ?? []) as any[],
    shifts: (shifts.data ?? []) as any[],
    workTypes: (workTypes.data ?? []) as any[],
    locationShifts: (locationShifts.data ?? []) as any[],
  };
}

export async function getConfigParameters() {
  const supabase = createClient();
  const { data } = await supabase
    .from("config_parameters")
    .select("key,value,description")
    .order("key");
  return (data ?? []) as { key: string; value: any; description: string | null }[];
}

export async function getEmployees(filters: {
  q?: string;
  department?: string;
  status?: string;
}) {
  const supabase = createClient();
  let query = supabase
    .from("profiles")
    .select(
      "id, employee_code, full_name, work_status, department:departments(name), position:positions(name)"
    )
    .order("employee_code");

  if (filters.q) {
    query = query.or(
      `full_name.ilike.%${filters.q}%,employee_code.ilike.%${filters.q}%,email_company.ilike.%${filters.q}%`
    );
  }
  if (filters.department) query = query.eq("department_id", filters.department);
  if (filters.status) query = query.eq("work_status", filters.status);

  const { data, error } = await query;
  if (error) return { rows: [] as any[], error: error.message };
  return { rows: (data ?? []) as any[], error: null };
}

export async function getEmployee(id: string) {
  const supabase = createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "*, department:departments(name), position:positions(name), title:titles(name)"
    )
    .eq("id", id)
    .single();

  const { data: locs } = await supabase
    .from("employee_locations")
    .select(
      "id, location_id, shift_id, location:locations(name, province, address, work_start, work_end, lunch_start, lunch_end), shift:shifts(name, start_time, end_time)"
    )
    .eq("employee_id", id);

  const { data: files } = await supabase
    .from("employee_files")
    .select("id, doc_type, storage_path, file_name, size, version, created_at")
    .eq("employee_id", id);

  const { data: activity } = await supabase
    .from("audit_logs")
    .select("*, actor:profiles(full_name)")
    .eq("entity", "profiles")
    .eq("entity_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  return {
    profile: profile as any,
    locations: (locs ?? []) as any[],
    files: (files ?? []) as any[],
    activity: (activity ?? []) as any[],
  };
}
