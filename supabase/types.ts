export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      account_deletion_requests: {
        Row: {
          id: number
          processed_at: string | null
          reason: string | null
          requested_at: string
          status: string
          user_id: string
        }
        Insert: {
          id?: number
          processed_at?: string | null
          reason?: string | null
          requested_at?: string
          status?: string
          user_id: string
        }
        Update: {
          id?: number
          processed_at?: string | null
          reason?: string | null
          requested_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      appointment_reschedules: {
        Row: {
          accepted_at: string | null
          appointment_id: number
          created_at: string
          id: number
          justification: string | null
          new_end_time: string
          new_start_time: string
          original_end_time: string
          original_start_time: string
          rejected_at: string | null
          rejected_reason: string | null
          requested_by: string
          requested_by_type: string
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          appointment_id: number
          created_at?: string
          id?: number
          justification?: string | null
          new_end_time: string
          new_start_time: string
          original_end_time: string
          original_start_time: string
          rejected_at?: string | null
          rejected_reason?: string | null
          requested_by: string
          requested_by_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          appointment_id?: number
          created_at?: string
          id?: number
          justification?: string | null
          new_end_time?: string
          new_start_time?: string
          original_end_time?: string
          original_start_time?: string
          rejected_at?: string | null
          rejected_reason?: string | null
          requested_by?: string
          requested_by_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointment_reschedules_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          business_id: number
          client_id: string
          client_notes: string | null
          created_at: string
          end_time: string
          id: number
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          reschedule_justification: string | null
          service_id: number
          start_time: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          business_id: number
          client_id: string
          client_notes?: string | null
          created_at?: string
          end_time: string
          id?: number
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          reschedule_justification?: string | null
          service_id: number
          start_time: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          business_id?: number
          client_id?: string
          client_notes?: string | null
          created_at?: string
          end_time?: string
          id?: number
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          reschedule_justification?: string | null
          service_id?: number
          start_time?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      business_availability_slots: {
        Row: {
          business_id: number | null
          created_at: string | null
          date: string
          end_time: string
          id: number
          is_available: boolean | null
          reason: string | null
          start_time: string
        }
        Insert: {
          business_id?: number | null
          created_at?: string | null
          date: string
          end_time: string
          id?: number
          is_available?: boolean | null
          reason?: string | null
          start_time: string
        }
        Update: {
          business_id?: number | null
          created_at?: string | null
          date?: string
          end_time?: string
          id?: number
          is_available?: boolean | null
          reason?: string | null
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_availability_slots_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      business_profiles: {
        Row: {
          accepted_payment_methods: Json | null
          address: string | null
          banner_url: string | null
          business_name: string
          business_time: string | null
          category_id: number | null
          created_at: string
          description: string | null
          id: number
          is_public: boolean
          logo_url: string | null
          lunch_break_end: string | null
          lunch_break_start: string | null
          owner_id: string
          share_slug: string | null
          signup_complete: boolean
          updated_at: string
          work_days: Json | null
        }
        Insert: {
          accepted_payment_methods?: Json | null
          address?: string | null
          banner_url?: string | null
          business_name: string
          business_time?: string | null
          category_id?: number | null
          created_at?: string
          description?: string | null
          id?: number
          is_public?: boolean
          logo_url?: string | null
          lunch_break_end?: string | null
          lunch_break_start?: string | null
          owner_id: string
          share_slug?: string | null
          signup_complete?: boolean
          updated_at?: string
          work_days?: Json | null
        }
        Update: {
          accepted_payment_methods?: Json | null
          address?: string | null
          banner_url?: string | null
          business_name?: string
          business_time?: string | null
          category_id?: number | null
          created_at?: string
          description?: string | null
          id?: number
          is_public?: boolean
          logo_url?: string | null
          lunch_break_end?: string | null
          lunch_break_start?: string | null
          owner_id?: string
          share_slug?: string | null
          signup_complete?: boolean
          updated_at?: string
          work_days?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "business_profiles_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_business_profiles_category"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string | null
          id: number
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: number
          name: string
        }
        Update: {
          created_at?: string | null
          id?: number
          name?: string
        }
        Relationships: []
      }
      client_profiles: {
        Row: {
          address: string | null
          created_at: string | null
          id: string
          owner_id: string
          signup_complete: boolean
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          id?: string
          owner_id: string
          signup_complete?: boolean
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          id?: string
          owner_id?: string
          signup_complete?: boolean
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_profiles_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          amount: number
          commission_rate: number | null
          created_at: string | null
          id: number
          paid_at: string | null
          referral_id: number
          referrer_id: string
          source_amount: number | null
          source_transaction_id: string | null
          status: string | null
        }
        Insert: {
          amount: number
          commission_rate?: number | null
          created_at?: string | null
          id?: number
          paid_at?: string | null
          referral_id: number
          referrer_id: string
          source_amount?: number | null
          source_transaction_id?: string | null
          status?: string | null
        }
        Update: {
          amount?: number
          commission_rate?: number | null
          created_at?: string | null
          id?: number
          paid_at?: string | null
          referral_id?: number
          referrer_id?: string
          source_amount?: number | null
          source_transaction_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commissions_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referrals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      faq_entries: {
        Row: {
          answer: string
          audience: string
          created_at: string
          id: number
          is_active: boolean
          question: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          answer: string
          audience: string
          created_at?: string
          id?: number
          is_active?: boolean
          question: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          answer?: string
          audience?: string
          created_at?: string
          id?: number
          is_active?: boolean
          question?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      legal_documents: {
        Row: {
          audience: string
          content_md: string
          created_at: string
          doc_type: string
          id: number
          is_active: boolean
          published_at: string
          title: string
          version: number
        }
        Insert: {
          audience: string
          content_md: string
          created_at?: string
          doc_type: string
          id?: number
          is_active?: boolean
          published_at?: string
          title: string
          version: number
        }
        Update: {
          audience?: string
          content_md?: string
          created_at?: string
          doc_type?: string
          id?: number
          is_active?: boolean
          published_at?: string
          title?: string
          version?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: number
          message: string
          read: boolean | null
          related_appointment_id: number | null
          related_id: number | null
          related_reschedule_id: number | null
          title: string
          type: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          message: string
          read?: boolean | null
          related_appointment_id?: number | null
          related_id?: number | null
          related_reschedule_id?: number | null
          title: string
          type?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          message?: string
          read?: boolean | null
          related_appointment_id?: number | null
          related_id?: number | null
          related_reschedule_id?: number | null
          title?: string
          type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          last_signup_step: string | null
          referral_code: string | null
          referred_by: string | null
          signup_complete: boolean
          signup_completed_at: string | null
          signup_started_at: string | null
          updated_at: string
          user_type: Database["public"]["Enums"]["user_type"]
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          last_signup_step?: string | null
          referral_code?: string | null
          referred_by?: string | null
          signup_complete?: boolean
          signup_completed_at?: string | null
          signup_started_at?: string | null
          updated_at?: string
          user_type?: Database["public"]["Enums"]["user_type"]
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          last_signup_step?: string | null
          referral_code?: string | null
          referred_by?: string | null
          signup_complete?: boolean
          signup_completed_at?: string | null
          signup_started_at?: string | null
          updated_at?: string
          user_type?: Database["public"]["Enums"]["user_type"]
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string | null
          id: number
          is_active: boolean | null
          updated_at: string | null
          user_id: string
          uses_count: number | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          updated_at?: string | null
          user_id: string
          uses_count?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: number
          is_active?: boolean | null
          updated_at?: string | null
          user_id?: string
          uses_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "referral_codes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_settings: {
        Row: {
          commission_rate: number | null
          commission_type: string | null
          created_at: string | null
          eligibility_months: number | null
          id: number
          is_active: boolean | null
          min_withdrawal: number | null
          updated_at: string | null
        }
        Insert: {
          commission_rate?: number | null
          commission_type?: string | null
          created_at?: string | null
          eligibility_months?: number | null
          id?: number
          is_active?: boolean | null
          min_withdrawal?: number | null
          updated_at?: string | null
        }
        Update: {
          commission_rate?: number | null
          commission_type?: string | null
          created_at?: string | null
          eligibility_months?: number | null
          id?: number
          is_active?: boolean | null
          min_withdrawal?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          converted_at: string | null
          created_at: string | null
          id: number
          referral_code_id: number | null
          referred_id: string
          referrer_id: string
          status: string | null
        }
        Insert: {
          converted_at?: string | null
          created_at?: string | null
          id?: number
          referral_code_id?: number | null
          referred_id: string
          referrer_id: string
          status?: string | null
        }
        Update: {
          converted_at?: string | null
          created_at?: string | null
          id?: number
          referral_code_id?: number | null
          referred_id?: string
          referrer_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referral_code_id_fkey"
            columns: ["referral_code_id"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referred_id_fkey"
            columns: ["referred_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_id_fkey"
            columns: ["referrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          appointment_id: number | null
          business_id: number | null
          client_id: string | null
          comment: string | null
          created_at: string | null
          id: number
          rating: number | null
          service_id: number | null
          updated_at: string | null
        }
        Insert: {
          appointment_id?: number | null
          business_id?: number | null
          client_id?: string | null
          comment?: string | null
          created_at?: string | null
          id?: number
          rating?: number | null
          service_id?: number | null
          updated_at?: string | null
        }
        Update: {
          appointment_id?: number | null
          business_id?: number | null
          client_id?: string | null
          comment?: string | null
          created_at?: string | null
          id?: number
          rating?: number | null
          service_id?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          business_id: number
          category_id: number | null
          created_at: string
          description: string | null
          duration_minutes: number
          id: number
          is_active: boolean
          is_featured: boolean | null
          is_trending: boolean | null
          location_type: Database["public"]["Enums"]["location_type"]
          name: string
          photos: string[] | null
          price: number
          price_type: string | null
          updated_at: string
        }
        Insert: {
          business_id: number
          category_id?: number | null
          created_at?: string
          description?: string | null
          duration_minutes: number
          id?: number
          is_active?: boolean
          is_featured?: boolean | null
          is_trending?: boolean | null
          location_type: Database["public"]["Enums"]["location_type"]
          name: string
          photos?: string[] | null
          price: number
          price_type?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: number
          category_id?: number | null
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: number
          is_active?: boolean
          is_featured?: boolean | null
          is_trending?: boolean | null
          location_type?: Database["public"]["Enums"]["location_type"]
          name?: string
          photos?: string[] | null
          price?: number
          price_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_services_category"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "business_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_legal_acceptances: {
        Row: {
          accepted_at: string
          audience: string
          doc_type: string
          id: number
          user_id: string
          version: number
        }
        Insert: {
          accepted_at?: string
          audience: string
          doc_type: string
          id?: number
          user_id: string
          version: number
        }
        Update: {
          accepted_at?: string
          audience?: string
          doc_type?: string
          id?: number
          user_id?: string
          version?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_profile_integrity: {
        Args: {
          user_id: string
        }
        Returns: boolean
      }
      create_referral_code_on_signup: {
        Args: Record<PropertyKey, never>
        Returns: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          last_signup_step: string | null
          referral_code: string | null
          referred_by: string | null
          signup_complete: boolean
          signup_completed_at: string | null
          signup_started_at: string | null
          updated_at: string
          user_type: Database["public"]["Enums"]["user_type"]
        }
      }
      generate_referral_code: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      insert_notification: {
        Args: {
          p_message: string
          p_related_appointment_id?: number
          p_related_reschedule_id?: number
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: Json
      }
      process_referral: {
        Args: {
          p_referred_id: string
          p_referral_code: string
        }
        Returns: boolean
      }
    }
    Enums: {
      appointment_status: "pending" | "confirmed" | "completed" | "canceled"
      location_type: "shop" | "home"
      payment_method: "pix" | "card" | "cash"
      user_type: "client" | "merchant"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
  | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
    DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
  ? R
  : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
    DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] &
    DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
  ? R
  : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Insert: infer I
  }
  ? I
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Insert: infer I
  }
  ? I
  : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
  | keyof DefaultSchema["Tables"]
  | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
  : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
    Update: infer U
  }
  ? U
  : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
    Update: infer U
  }
  ? U
  : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
  | keyof DefaultSchema["Enums"]
  | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
  : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
  | keyof DefaultSchema["CompositeTypes"]
  | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
  ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
  : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  public: {
    Enums: {
      appointment_status: ["pending", "confirmed", "completed", "canceled"],
      location_type: ["shop", "home"],
      payment_method: ["pix", "card", "cash"],
      user_type: ["client", "merchant"],
    },
  },
} as const
