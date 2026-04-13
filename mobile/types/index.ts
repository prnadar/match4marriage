export interface APIResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  message: string | null;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  limit: number;
  has_next: boolean;
}

export type Gender = 'male' | 'female' | 'other';
export type MaritalStatus = 'never_married' | 'divorced' | 'widowed' | 'separated';
export type Religion = 'hindu' | 'muslim' | 'christian' | 'sikh' | 'jain' | 'buddhist' | 'parsi' | 'jewish' | 'other';
export type MatchStatus = 'pending' | 'interested' | 'mutual' | 'rejected' | 'expired';
export type InterestStatus = 'pending' | 'accepted' | 'declined' | 'withdrawn';
export type SubscriptionTier = 'free' | 'silver' | 'gold' | 'platinum';

export interface Profile {
  user_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  gender: Gender;
  marital_status: MaritalStatus;
  city: string | null;
  state: string | null;
  country: string | null;
  religion: Religion;
  caste: string;
  sub_caste: string;
  mother_tongue: string;
  languages: string[];
  height_cm: number | null;
  weight_kg: number | null;
  education_level: string;
  education_field: string;
  college: string;
  occupation: string;
  employer: string;
  annual_income_inr: number;
  bio: string;
  partner_prefs: Record<string, unknown>;
  family_details: Record<string, unknown>;
  birth_time: string;
  birth_place: string;
  is_manglik: boolean | null;
  visa_status: string;
  willing_to_relocate: boolean;
  photos: PhotoItem[];
  completeness_score: number;
}

export interface PhotoItem {
  key: string;
  url: string;
  is_primary: boolean;
  approved: boolean;
}

export interface ProfileCard {
  user_id: string;
  first_name: string;
  last_name: string;
  age: number;
  city: string;
  state: string;
  occupation: string;
  employer: string;
  education_level: string;
  religion: Religion;
  caste: string;
  height_cm: number | null;
  photos: PhotoItem[];
  trust_score: number;
  is_verified: boolean;
}

export interface CompatibilityBreakdown {
  values: number;
  lifestyle: number;
  family: number;
  ambition: number;
  communication: number;
}

export interface Match {
  id: string;
  user_a_id: string;
  user_b_id: string;
  compatibility_score: number;
  compatibility_breakdown: CompatibilityBreakdown;
  status: MatchStatus;
  match_date: string;
  a_super_liked: boolean;
  b_super_liked: boolean;
  mutual_at: string | null;
  other_profile: ProfileCard;
}

export interface DailyMatchFeed {
  matches: Match[];
  refreshes_at: string;
  remaining_today: number;
}

export interface Interest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: InterestStatus;
  is_super_interest: boolean;
  message: string;
  responded_at: string | null;
  sender_profile?: ProfileCard;
  receiver_profile?: ProfileCard;
  created_at: string;
}

export interface ChatThread {
  id: string;
  user_a_id: string;
  user_b_id: string;
  match_id: string | null;
  is_active: boolean;
  last_message_at: string | null;
  last_message_preview: string | null;
  other_profile: ProfileCard;
  unread_count: number;
}

export interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  message_type: 'text' | 'voice' | 'image' | 'icebreaker' | 'system';
  encrypted_content: string;
  created_at: string;
  delivered_at: string | null;
  read_at: string | null;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user_id: string;
  is_new_user: boolean;
}

export interface SubscriptionLimits {
  interests: number;
  contacts: number;
  video_calls: number;
}

export interface Notification {
  id: string;
  type: 'interest_received' | 'interest_accepted' | 'new_message' | 'match' | 'system';
  title: string;
  body: string;
  read: boolean;
  created_at: string;
  data?: Record<string, unknown>;
}
