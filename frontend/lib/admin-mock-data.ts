// Admin pages render mock data only — replace with real API calls post-launch.
//
// NOTE: All user-visible fields are declared optional so an empty `[]` still
// satisfies the types. These shapes exist purely to keep the admin placeholder
// UI typechecking while we stub out the real API layer.

// ── User ─────────────────────────────────────────────────────────────────────

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: "active" | "suspended" | "pending" | "banned";
  joinedAt: string;
  isVerified: boolean;
  subscription: "Free" | "Silver" | "Gold" | "Diamond";
  // Extended optional fields consumed by admin pages.
  age?: number;
  gender?: string;
  city?: string;
  state?: string;
  religion?: string;
  caste?: string;
  sub_caste?: string;
  gotra?: string;
  education?: string;
  occupation?: string;
  income?: string;
  height?: string;
  motherTongue?: string;
  maritalStatus?: string;
  manglik?: string;
  familyType?: string;
  fatherOccupation?: string;
  motherOccupation?: string;
  siblings?: string;
  bio?: string;
  photo?: string;
  lastActive?: string;
  joined?: string;
};

// ── Message / Conversation ───────────────────────────────────────────────────

type MessageParty = { id: string; name: string };

export type AdminMessage = {
  id: string;
  from: string;
  to: string;
  preview: string;
  sentAt: string;
  flagged: boolean;
  fromUser?: MessageParty;
  toUser?: MessageParty;
  lastAt?: string;
  lastMessage?: string;
  messageCount?: number;
};

// ── Notification ─────────────────────────────────────────────────────────────

export type AdminNotification = {
  id: string;
  userId?: string;
  type: string;
  message: string;
  sentAt: string;
  read?: boolean;
  title?: string;
  target?: string;
  sentBy?: string;
  deliveredCount?: number;
};

// ── Photo ────────────────────────────────────────────────────────────────────

export type AdminPhoto = {
  id: string;
  userId: string;
  url: string;
  status: "pending" | "approved" | "rejected" | "flagged";
  uploadedAt: string;
  userName?: string;
  flagCount?: number;
};

// ── Report ───────────────────────────────────────────────────────────────────

type ReportParty = { id: string; name: string };

export type AdminReport = {
  id: string;
  reporterId: string;
  reportedUserId: string;
  reason: string;
  status: "open" | "resolved" | "pending" | "dismissed";
  createdAt: string;
  reporter?: ReportParty;
  reportedUser?: ReportParty;
  date?: string;
  description?: string;
  notes?: string;
};

// ── Match ────────────────────────────────────────────────────────────────────

type MatchParty = { id: string; name: string; photo?: string; city?: string };

export type AdminMatch = {
  id: string;
  userA: MatchParty;
  userB: MatchParty;
  matchedAt: string;
  status: "active" | "unmatched" | string;
  compatibility: number;
};

// ── Payment ──────────────────────────────────────────────────────────────────

export type AdminPayment = {
  id: string;
  userId: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  gateway?: string;
  date?: string;
  userName?: string;
  transactionId?: string;
  plan?: string;
};

// ── Subscription ─────────────────────────────────────────────────────────────

export type AdminSubscription = {
  id: string;
  userId: string;
  plan: string;
  status: string;
  renewsAt: string;
  userName?: string;
  startDate?: string;
  expiryDate?: string;
  amountPaid?: number;
  gateway?: string;
};

// ── Mock Data Arrays ─────────────────────────────────────────────────────────

export const mockUsers: AdminUser[] = [];
export const mockMessages: AdminMessage[] = [];
export const mockNotifications: AdminNotification[] = [];
export const mockPhotos: AdminPhoto[] = [];
export const mockReports: AdminReport[] = [];
export const mockMatches: AdminMatch[] = [];
export const mockPayments: AdminPayment[] = [];
export const mockSubscriptions: AdminSubscription[] = [];

// ── Analytics ────────────────────────────────────────────────────────────────

export type AdminAnalytics = {
  totalUsers: number;
  activeToday: number;
  newThisWeek: number;
  totalMatches: number;
  totalMessages: number;
  totalRevenue: number;
  registrationTrend: { date: string; count: number }[];
  matchesTrend: { date: string; count: number }[];
  revenueTrend: { date: string; amount: number }[];
  // Extended optional fields consumed by analytics / dashboard pages.
  matchSuccessRate?: { month: string; rate: number }[];
  conversionFunnel?: { stage: string; count: number }[];
  topCities?: { city: string; users: number }[];
  ageDistribution?: { range: string; count: number }[];
  revenueOverTime?: { month: string; revenue: number }[];
  retention?: { d7: number; d30: number; d90: number };
  activeUsers30d?: number;
  newToday?: number;
  pendingApproval?: number;
  messagesSent?: number;
  activeSubscriptions?: number;
  revenueMTD?: number;
};

export const mockAnalytics: AdminAnalytics = {
  totalUsers: 0,
  activeToday: 0,
  newThisWeek: 0,
  totalMatches: 0,
  totalMessages: 0,
  totalRevenue: 0,
  registrationTrend: [],
  matchesTrend: [],
  revenueTrend: [],
};

// ── Religion distribution (recharts-style entries) ───────────────────────────

export type AdminReligionDatum = {
  religion: string;
  count: number;
  // Recharts / inline chart helpers inject these at render time.
  value?: number;
  name?: string;
  color?: string;
  dashLen?: number;
  offset?: number;
  path?: string;
};

export const mockReligionDistribution: AdminReligionDatum[] = [];

// ── Settings ─────────────────────────────────────────────────────────────────

type EmailTemplate = { id: string; name: string; subject: string; body: string };
type SubscriptionPlan = {
  id: string;
  name: string;
  price: number;
  duration: number;
  features: string[];
};
type AdminUserEntry = { id: string; email: string; role: string; lastLogin: string };

export type AdminSettings = {
  appName: string;
  supportEmail: string;
  maintenanceMode: boolean;
  site: {
    name: string;
    tagline: string;
    maintenanceMode: boolean;
    registrationOpen: boolean;
  };
  emailTemplates: EmailTemplate[];
  subscriptionPlans: SubscriptionPlan[];
  moderation: {
    autoApproveProfiles: boolean;
    photoModeration: boolean;
    maxPhotos: number;
    minAge: number;
  };
  adminUsers: AdminUserEntry[];
};

export const mockSettings: AdminSettings = {
  appName: "Match4Marriage",
  supportEmail: "support@match4marriage.com",
  maintenanceMode: false,
  site: {
    name: "Match4Marriage",
    tagline: "Find your life partner",
    maintenanceMode: false,
    registrationOpen: true,
  },
  emailTemplates: [],
  subscriptionPlans: [],
  moderation: {
    autoApproveProfiles: false,
    photoModeration: true,
    maxPhotos: 6,
    minAge: 18,
  },
  adminUsers: [],
};

// ── Dashboard / activity / charts ────────────────────────────────────────────

export const mockDashboardStats = mockAnalytics;

export type AdminActivityItem = {
  id: string;
  type: string;
  description: string;
  at: string;
  user?: string;
  detail?: string;
  time?: string;
};

export const mockRecentActivity: AdminActivityItem[] = [];

export type AdminChartPoint = { date: string; count: number; week?: string };

export const mockRegistrationChart: AdminChartPoint[] = [];
export const mockMatchesChart: AdminChartPoint[] = [];
