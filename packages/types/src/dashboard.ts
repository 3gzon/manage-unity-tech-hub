export interface AdminDashboardMetrics {
  activeStudents: number;
  activeGroups: number;
  activeInstructors: number;
  revenueThisMonth: string;
  outstandingPayments: string;
  unpaidInvoices: number;
}

export interface DashboardPaymentItem {
  id: string;
  studentName: string;
  amount: string;
  method: string;
  paymentDate: string;
}

export interface DashboardClassItem {
  id: string;
  groupName: string;
  courseName: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  status: string;
}

export interface DashboardInvoiceItem {
  id: string;
  invoiceNumber: string;
  studentName: string;
  total: string;
  remainingAmount: string;
  dueDate: string;
  status: string;
}

export interface DashboardEnrollmentItem {
  id: string;
  studentName: string;
  groupName: string;
  courseName: string;
  status: string;
  startDate: string;
}

export interface AdminDashboardResponse {
  metrics: AdminDashboardMetrics;
  recentPayments: DashboardPaymentItem[];
  upcomingClasses: DashboardClassItem[];
  outstandingInvoices: DashboardInvoiceItem[];
  recentEnrollments: DashboardEnrollmentItem[];
}

export interface InstructorDashboardMetrics {
  todaysClasses: number;
  upcomingClasses: number;
  activeGroups: number;
  studentsAssigned: number;
  attendancePending: number;
}

export interface InstructorDashboardResponse {
  metrics: InstructorDashboardMetrics;
  todaysClasses: DashboardClassItem[];
  upcomingClasses: DashboardClassItem[];
  activeGroups: Array<{
    id: string;
    name: string;
    courseName: string;
    studentCount: number;
    scheduleLabel: string;
  }>;
}
