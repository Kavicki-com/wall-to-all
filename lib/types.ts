/**
 * Tipos centralizados baseados no Supabase
 * Fonte única de verdade para todos os tipos da aplicação
 */

import { Database } from '../supabase/types';

// Tipo Json do Supabase
type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// ===== TIPOS BASE DO SUPABASE =====

export type DbAppointment = Database['public']['Tables']['appointments']['Row'];
export type DbAppointmentInsert = Database['public']['Tables']['appointments']['Insert'];
export type DbAppointmentUpdate = Database['public']['Tables']['appointments']['Update'];

export type DbService = Database['public']['Tables']['services']['Row'];
export type DbServiceInsert = Database['public']['Tables']['services']['Insert'];
export type DbServiceUpdate = Database['public']['Tables']['services']['Update'];

export type DbBusinessProfile = Database['public']['Tables']['business_profiles']['Row'];
export type DbBusinessProfileInsert = Database['public']['Tables']['business_profiles']['Insert'];
export type DbBusinessProfileUpdate = Database['public']['Tables']['business_profiles']['Update'];

export type DbCategory = Database['public']['Tables']['categories']['Row'];
export type DbCategoryInsert = Database['public']['Tables']['categories']['Insert'];
export type DbCategoryUpdate = Database['public']['Tables']['categories']['Update'];

export type DbReview = Database['public']['Tables']['reviews']['Row'];
export type DbReviewInsert = Database['public']['Tables']['reviews']['Insert'];
export type DbReviewUpdate = Database['public']['Tables']['reviews']['Update'];

export type DbProfile = Database['public']['Tables']['profiles']['Row'];
export type DbProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type DbProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export type DbClientProfile = Database['public']['Tables']['client_profiles']['Row'];
export type DbClientProfileInsert = Database['public']['Tables']['client_profiles']['Insert'];
export type DbClientProfileUpdate = Database['public']['Tables']['client_profiles']['Update'];

export type DbNotification = Database['public']['Tables']['notifications']['Row'];
export type DbNotificationInsert = Database['public']['Tables']['notifications']['Insert'];
export type DbNotificationUpdate = Database['public']['Tables']['notifications']['Update'];

export type DbAppointmentReschedule = Database['public']['Tables']['appointment_reschedules']['Row'];
export type DbAppointmentRescheduleInsert = Database['public']['Tables']['appointment_reschedules']['Insert'];
export type DbAppointmentRescheduleUpdate = Database['public']['Tables']['appointment_reschedules']['Update'];

export type DbReferralCode = Database['public']['Tables']['referral_codes']['Row'];
export type DbReferral = Database['public']['Tables']['referrals']['Row'];
export type DbCommission = Database['public']['Tables']['commissions']['Row'];
export type DbReferralSettings = Database['public']['Tables']['referral_settings']['Row'];

// ===== ENUMS =====

export type AppointmentStatus = Database['public']['Enums']['appointment_status'];
export type LocationType = Database['public']['Enums']['location_type'];
export type PaymentMethod = Database['public']['Enums']['payment_method'];
export type UserType = Database['public']['Enums']['user_type'];

// ===== TIPOS AUXILIARES =====

/**
 * Formato de pagamento aceito
 */
export type AcceptedPaymentMethods = {
  pix?: boolean;
  card?: boolean;
  cash?: boolean;
};

/**
 * Dias de trabalho
 */
export type WorkDays = Record<string, { start: string; end: string; active?: boolean }>;

// ===== TIPOS ESTENDIDOS PARA UI =====

/**
 * Appointment com dados de join (service e business)
 */
export type Appointment = DbAppointment & {
  service?: {
    id: number;
    name: string;
    duration_minutes?: number;
    price?: number;
  };
  business?: {
    id: number;
    business_name: string;
    logo_url: string | null;
    address?: string | null;
    work_days?: WorkDays | Json;
  };
};

/**
 * Service com dados de join (category e business)
 */
export type Service = DbService & {
  categories?: {
    id: number;
    name: string;
  } | null;
  business_profiles?: {
    business_name: string;
    logo_url: string | null;
  } | null;
  rating?: number;
  review_count?: number;
  recommendation_score?: number;
};

/**
 * BusinessProfile com dados de join (category e services)
 */
export type BusinessProfile = DbBusinessProfile & {
  categories?: {
    id: number;
    name: string;
  } | null;
  services?: Array<{
    id: number;
    name: string;
    price?: number;
  }>;
};

/**
 * Business - tipo mais flexível para uso em contextos onde não temos todos os campos
 */
export type Business = {
  id: number;
  business_name: string;
  logo_url: string | null;
  description: string | null;
  address?: string | null;
  banner_url?: string | null;
  category_id?: number | null;
  accepted_payment_methods?: AcceptedPaymentMethods | Json | null;
  work_days?: WorkDays | Json | null;
  services?: Array<{ id: number; name: string; price?: number }>;
  categories?: {
    id: number;
    name: string;
  } | null;
};

/**
 * Category (já é simples no banco, mas exportamos para consistência)
 */
export type Category = DbCategory;

/**
 * Review com dados de join
 */
export type Review = DbReview & {
  client?: {
    full_name: string | null;
    avatar_url: string | null;
  };
  service?: {
    name: string;
  };
};

/**
 * Profile (usuário base)
 */
export type Profile = DbProfile;

/**
 * ClientProfile com dados de profile
 */
export type ClientProfile = DbClientProfile & {
  profile?: Profile;
};

/**
 * Notification
 */
export type Notification = DbNotification;

/**
 * AppointmentReschedule com dados de appointment
 */
export type AppointmentReschedule = DbAppointmentReschedule & {
  appointment?: Appointment;
};

/**
 * Business com todos os dados populados (para uso em páginas de loja)
 */
export type BusinessWithDetails = BusinessProfile & {
  category?: string | null;
  accepted_payment_methods: AcceptedPaymentMethods | null;
  work_days: WorkDays | null;
};

/**
 * Referral com detalhes do usuário indicado
 */
export type ReferralWithDetails = DbReferral & {
  referred: {
    full_name: string | null;
    avatar_url: string | null;
  };
};

/**
 * Resumo de comissões
 */
export type CommissionSummary = {
  totalEarned: number;
  availableBalance: number;
  pendingBalance: number;
  referralCount: number;
  paidAmount: number;
};


