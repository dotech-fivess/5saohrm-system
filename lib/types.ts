// Kiểu dùng chung & hằng số cho 5Sao HRM

export type Role = "admin" | "quan_ly" | "nhan_vien";

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  quan_ly: "Quản lý / Trưởng phòng",
  nhan_vien: "Nhân viên",
};

export type AccountStatus = "Hoạt động" | "Khóa";
export type WorkStatus = "Đang làm" | "Nghỉ việc" | "Tạm nghỉ";
export type ContractType = "TTS" | "Thử việc" | "Chính thức";
export type WorkTypeCode = "HC" | "TC120" | "TC150" | "ON";
export type RequestStatus = "Chờ" | "Duyệt" | "Từ chối";

export type Profile = {
  id: string;
  employee_code: string;
  full_name: string;
  avatar_url: string | null;
  email_company: string | null;
  phone: string | null;
  gender: "Nam" | "Nữ" | "Khác" | null;
  dob: string | null;
  address: string | null;
  department_id: string | null;
  position_id: string | null;
  title_id: string | null;
  join_date: string | null;
  probation_date: string | null;
  official_date: string | null;
  contract_type: ContractType | null;
  work_status: WorkStatus;
  role: Role;
  account_status: AccountStatus;
};

// Chỉ Admin dùng khu desktop quản trị; Quản lý & Nhân viên dùng portal mobile.
export function isAdminArea(role: Role): boolean {
  return role === "admin";
}

// Vai trò có quyền duyệt đơn: Admin (toàn quyền) + Quản lý/Trưởng phòng.
export function canApprove(role: Role): boolean {
  return role === "admin" || role === "quan_ly";
}
