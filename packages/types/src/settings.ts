export interface SystemSettings {
  schoolName: string;
  currency: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  multiCourseDiscountPercent: string;
  familyPackDiscountPercent: string;
  invoiceDueDay: number;
  updatedAt: string;
}

export interface UpdateSystemSettingsRequest {
  schoolName: string;
  currency: string;
  email?: string;
  phone?: string;
  address?: string;
  multiCourseDiscountPercent: number;
  familyPackDiscountPercent: number;
  invoiceDueDay: number;
}
