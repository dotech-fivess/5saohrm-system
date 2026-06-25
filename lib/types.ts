// Kiểu dùng chung & hằng số cho 5Sao HRM

export type Role = "qt_sua" | "qt_xem" | "quan_ly" | "nhan_vien";

export const ROLE_LABEL: Record<Role, string> = {
  qt_sua: "Quản trị chỉnh sửa",
  qt_xem: "Quản trị xem",
  quan_ly: "Quản lý",
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

// Vai trò nào dùng khu desktop (quản trị/quản lý) vs portal mobile (nhân viên)
export function isAdminArea(role: Role): boolean {
  return role === "qt_sua" || role === "qt_xem" || role === "quan_ly";
}
