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

// ===== TIPOS PARA LISTAGENS E TELAS =====

/**
 * Helper para joins do Supabase que podem retornar objeto ou array
 */
export type RawSupabaseJoin<T> = T | T[];

/**
 * Appointment para listagem do cliente (com service e business)
 */
export type ClientAppointmentListItem = {
  id: number;
  start_time: string;
  end_time: string;
  status: string;
  payment_method: string;
  service: RawSupabaseJoin<{
    id: number;
    name: string;
    price: number;
    photos: string[] | string | null;
  }>;
  business: RawSupabaseJoin<{
    id: number;
    business_name: string;
    logo_url: string | null;
  }>;
  hasPendingReschedule?: boolean;
};

/**
 * ClientAppointmentListItem normalizado (após processar arrays de join)
 */
export type NormalizedClientAppointmentListItem = Omit<ClientAppointmentListItem, 'service' | 'business'> & {
  service: {
    id: number;
    name: string;
    price: number;
    photos: string[] | string | null;
  };
  business: {
    id: number;
    business_name: string;
    logo_url: string | null;
  };
};

/**
 * Appointment para dashboard do merchant (com service e client como join)
 */
export type MerchantDashboardAppointment = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_method: string;
  client_notes: string | null;
  service: RawSupabaseJoin<{
    id: string;
    name: string;
    price: number;
    price_type: string;
    duration_minutes: number;
    photos: string[] | string | null;
  }>;
  client: RawSupabaseJoin<{
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  }>;
};

/**
 * Appointment com detalhes completos para tela de detalhe do merchant
 */
export type MerchantDetailAppointment = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  payment_method: string;
  client_notes: string | null;
  service: {
    id: string;
    name: string;
    price: number;
    price_type: string;
    duration_minutes: number;
    photos: string[] | string | null;
  };
  client: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    email?: string | null;
  };
  business: {
    id: string;
    business_name: string;
    address: string | null;
  };
  business_id?: string | number;
  pending_reschedules?: AppointmentRescheduleItem[];
  merchant_pending_reschedules?: AppointmentRescheduleItem[];
  accepted_reschedules?: AppointmentRescheduleItem[];
  rejected_reschedules?: AppointmentRescheduleItem[];
  created_at: string;
};

/**
 * Item de reagendamento para uso em UI
 */
export type AppointmentRescheduleItem = {
  id: number;
  appointment_id: number;
  requested_by: string;
  requested_by_type: 'client' | 'merchant';
  original_start_time: string;
  original_end_time: string;
  new_start_time: string;
  new_end_time: string;
  justification?: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  created_at: string;
  accepted_at?: string | null;
  rejected_at?: string | null;
  rejected_reason?: string | null;
};

/**
 * Appointment para tela de reagendamento do merchant (com work_days)
 */
export type MerchantRescheduleAppointment = {
  id: string;
  business_id: string;
  service_id: string;
  start_time: string;
  end_time: string;
  business: {
    id: string;
    business_name: string;
    work_days: WorkDays;
  };
  service: {
    id: string;
    name: string;
    duration_minutes: number;
  };
};

/**
 * Appointment para listagem mensal do merchant
 */
export type MerchantMonthAppointment = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  service: {
    id: string;
    name: string;
  };
  client: {
    id: string;
    full_name: string | null;
  };
};

/**
 * Service para listagem (merchant profile, services index, share)
 */
export type ServiceListItem = {
  id: number | string;
  name: string;
  description?: string | null;
  price: number;
  photos: string[] | string | null;
  duration_minutes?: number | null;
  category?: string | null;
  rating?: number;
  review_count?: number;
  categories?: {
    id: number;
    name: string;
  } | null;
};

/**
 * Review para listagem
 */
export type ReviewListItem = {
  id: number;
  rating: number;
  comment: string | null;
  created_at: string | null;
  client: {
    full_name: string | null;
  } | null;
  service: {
    name: string;
  } | null;
};

/**
 * Estatísticas de avaliações
 */
export type ReviewStats = {
  average_rating: number;
  total_reviews: number;
};
