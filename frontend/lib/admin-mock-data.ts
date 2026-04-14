// Admin pages render mock data only — replace with real API calls post-launch.

export type AdminUser = {
  id: string; name: string; email: string; phone: string;
  status: "active" | "suspended" | "pending"; joinedAt: string;
  isVerified: boolean; subscription: "free" | "silver" | "gold" | "platinum";
};
export type AdminMessage = { id: string; from: string; to: string; preview: string; sentAt: string; flagged: boolean };
export type AdminNotification = { id: string; userId: string; type: string; message: string; sentAt: string; read: boolean };
export type AdminPhoto = { id: string; userId: string; url: string; status: "pending" | "approved" | "rejected"; uploadedAt: string };
export type AdminReport = { id: string; reporterId: string; reportedUserId: string; reason: string; status: "open" | "resolved"; createdAt: string };

export const mockUsers: AdminUser[] = [];
export const mockMessages: AdminMessage[] = [];
export const mockNotifications: AdminNotification[] = [];
export const mockPhotos: AdminPhoto[] = [];
export const mockReports: AdminReport[] = [];

export const mockAnalytics: {
  totalUsers: number; activeToday: number; newThisWeek: number;
  totalMatches: number; totalMessages: number; totalRevenue: number;
  registrationTrend: { date: string; count: number }[];
  matchesTrend: { date: string; count: number }[];
  revenueTrend: { date: string; amount: number }[];
} = {
  totalUsers: 0, activeToday: 0, newThisWeek: 0,
  totalMatches: 0, totalMessages: 0, totalRevenue: 0,
  registrationTrend: [], matchesTrend: [], revenueTrend: [],
};

export const mockReligionDistribution: { religion: string; count: number }[] = [];

export const mockSettings = {
  appName: "Match4Marriage",
  supportEmail: "support@match4marriage.com",
  maintenanceMode: false,
};

export const mockDashboardStats = mockAnalytics;
export const mockRecentActivity: { id: string; type: string; description: string; at: string }[] = [];
export const mockMatches: { id: string; userA: string; userB: string; status: string; createdAt: string }[] = [];
export const mockPayments: { id: string; userId: string; amount: number; currency: string; status: string; createdAt: string }[] = [];
export const mockSubscriptions: { id: string; userId: string; plan: string; status: string; renewsAt: string }[] = [];
export const mockRegistrationChart: { date: string; count: number }[] = [];
export const mockMatchesChart: { date: string; count: number }[] = [];
