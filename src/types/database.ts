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
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      absence_excuses: {
        Row: {
          absence_date: string
          created_at: string
          created_by: string
          id: string
          profile_id: string
          reason: string
          slot_id: string
          status: string
        }
        Insert: {
          absence_date: string
          created_at?: string
          created_by: string
          id?: string
          profile_id: string
          reason: string
          slot_id: string
          status?: string
        }
        Update: {
          absence_date?: string
          created_at?: string
          created_by?: string
          id?: string
          profile_id?: string
          reason?: string
          slot_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "absence_excuses_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absence_excuses_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "time_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_attempts: {
        Row: {
          attempted_at: string
          id: number
          profile_id: string
          school_id: string
          succeeded: boolean
        }
        Insert: {
          attempted_at?: string
          id?: never
          profile_id: string
          school_id: string
          succeeded: boolean
        }
        Update: {
          attempted_at?: string
          id?: never
          profile_id?: string
          school_id?: string
          succeeded?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "attendance_attempts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_attempts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_reviews: {
        Row: {
          attendance_id: string
          comment: string | null
          decision: string
          id: string
          reviewed_at: string
          reviewed_by: string
        }
        Insert: {
          attendance_id: string
          comment?: string | null
          decision: string
          id?: string
          reviewed_at?: string
          reviewed_by: string
        }
        Update: {
          attendance_id?: string
          comment?: string | null
          decision?: string
          id?: string
          reviewed_at?: string
          reviewed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_reviews_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: true
            referencedRelation: "attendances"
            referencedColumns: ["id"]
          },
        ]
      }
      attendances: {
        Row: {
          accuracy_m: number | null
          attendance_date: string
          distance_m: number | null
          id: string
          late_minutes: number
          latitude: number | null
          location_result: string
          longitude: number | null
          profile_id: string
          recorded_at: string
          school_id: string
          slot_id: string
          status: string
        }
        Insert: {
          accuracy_m?: number | null
          attendance_date: string
          distance_m?: number | null
          id?: string
          late_minutes?: number
          latitude?: number | null
          location_result: string
          longitude?: number | null
          profile_id: string
          recorded_at?: string
          school_id: string
          slot_id: string
          status: string
        }
        Update: {
          accuracy_m?: number | null
          attendance_date?: string
          distance_m?: number | null
          id?: string
          late_minutes?: number
          latitude?: number | null
          location_result?: string
          longitude?: number | null
          profile_id?: string
          recorded_at?: string
          school_id?: string
          slot_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendances_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendances_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendances_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "time_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_clerk_id: string | null
          created_at: string
          details: Json
          entity: string
          entity_id: string | null
          id: number
        }
        Insert: {
          action: string
          actor_clerk_id?: string | null
          created_at?: string
          details?: Json
          entity: string
          entity_id?: string | null
          id?: never
        }
        Update: {
          action?: string
          actor_clerk_id?: string | null
          created_at?: string
          details?: Json
          entity?: string
          entity_id?: string | null
          id?: never
        }
        Relationships: []
      }
      closed_days: {
        Row: {
          closed_date: string
          created_at: string
          created_by: string
          id: string
          reason: string
          school_id: string | null
          status: string
        }
        Insert: {
          closed_date: string
          created_at?: string
          created_by: string
          id?: string
          reason: string
          school_id?: string | null
          status?: string
        }
        Update: {
          closed_date?: string
          created_at?: string
          created_by?: string
          id?: string
          reason?: string
          school_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "closed_days_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_codes: {
        Row: {
          code: string
          code_date: string
          created_at: string
          generated_by: string | null
          id: string
          school_id: string
          status: string
        }
        Insert: {
          code: string
          code_date: string
          created_at?: string
          generated_by?: string | null
          id?: string
          school_id: string
          status?: string
        }
        Update: {
          code?: string
          code_date?: string
          created_at?: string
          generated_by?: string | null
          id?: string
          school_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_codes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_reports: {
        Row: {
          attendance_id: string
          classes: string
          course_theme: string
          created_at: string
          equipment_issues: Json
          equipment_ok: boolean
          id: string
          profile_id: string
          report_date: string
          review_comment: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          school_id: string
          slot_id: string
          status: string
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          attendance_id: string
          classes?: string
          course_theme?: string
          created_at?: string
          equipment_issues?: Json
          equipment_ok?: boolean
          id?: string
          profile_id: string
          report_date: string
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id: string
          slot_id: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          attendance_id?: string
          classes?: string
          course_theme?: string
          created_at?: string
          equipment_issues?: Json
          equipment_ok?: boolean
          id?: string
          profile_id?: string
          report_date?: string
          review_comment?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string
          slot_id?: string
          status?: string
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_reports_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: true
            referencedRelation: "attendances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reports_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_reports_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "time_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      document_acceptances: {
        Row: {
          accepted_at: string
          id: string
          profile_id: string
          rules_id: string
        }
        Insert: {
          accepted_at?: string
          id?: string
          profile_id: string
          rules_id: string
        }
        Update: {
          accepted_at?: string
          id?: string
          profile_id?: string
          rules_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_acceptances_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_acceptances_rules_id_fkey"
            columns: ["rules_id"]
            isOneToOne: false
            referencedRelation: "internal_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_rules: {
        Row: {
          content: string
          id: string
          published_at: string
          published_by: string | null
          title: string
          version: number
        }
        Insert: {
          content: string
          id?: string
          published_at?: string
          published_by?: string | null
          title: string
          version?: never
        }
        Update: {
          content?: string
          id?: string
          published_at?: string
          published_by?: string | null
          title?: string
          version?: never
        }
        Relationships: []
      }
      monthly_programs: {
        Row: {
          file_name: string
          id: string
          program_month: string
          published_at: string
          published_by: string
          size_bytes: number
          status: string
          storage_path: string
          title: string
        }
        Insert: {
          file_name: string
          id?: string
          program_month: string
          published_at?: string
          published_by: string
          size_bytes: number
          status?: string
          storage_path: string
          title: string
        }
        Update: {
          file_name?: string
          id?: string
          program_month?: string
          published_at?: string
          published_by?: string
          size_bytes?: number
          status?: string
          storage_path?: string
          title?: string
        }
        Relationships: []
      }
      organization_settings: {
        Row: {
          academic_year: string
          created_at: string
          current_semester: number
          id: boolean
          organization_name: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          academic_year: string
          created_at?: string
          current_semester?: number
          id?: boolean
          organization_name: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          academic_year?: string
          created_at?: string
          current_semester?: number
          id?: boolean
          organization_name?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          clerk_user_id: string | null
          contract_type: string | null
          created_at: string
          created_by: string | null
          email: string
          full_name: string
          hire_date: string | null
          id: string
          invitation_id: string | null
          invited_at: string | null
          job_title: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: string
          status_changed_at: string | null
          status_changed_by: string | null
          status_reason: string | null
          updated_at: string
        }
        Insert: {
          clerk_user_id?: string | null
          contract_type?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          full_name: string
          hire_date?: string | null
          id?: string
          invitation_id?: string | null
          invited_at?: string | null
          job_title?: string | null
          phone?: string | null
          role: Database["public"]["Enums"]["user_role"]
          status?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          status_reason?: string | null
          updated_at?: string
        }
        Update: {
          clerk_user_id?: string | null
          contract_type?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          full_name?: string
          hire_date?: string | null
          id?: string
          invitation_id?: string | null
          invited_at?: string | null
          job_title?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          status?: string
          status_changed_at?: string | null
          status_changed_by?: string | null
          status_reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      report_revisions: {
        Row: {
          author: string
          comment: string | null
          created_at: string
          id: string
          kind: string
          report_id: string
          snapshot: Json
          version: number
        }
        Insert: {
          author: string
          comment?: string | null
          created_at?: string
          id?: string
          kind: string
          report_id: string
          snapshot: Json
          version: number
        }
        Update: {
          author?: string
          comment?: string | null
          created_at?: string
          id?: string
          kind?: string
          report_id?: string
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "report_revisions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "daily_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      school_directors: {
        Row: {
          created_at: string
          profile_id: string
          school_id: string
          status: string
        }
        Insert: {
          created_at?: string
          profile_id: string
          school_id: string
          status?: string
        }
        Update: {
          created_at?: string
          profile_id?: string
          school_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_directors_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_directors_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          id: string
          late_tolerance_minutes: number
          latitude: number | null
          longitude: number | null
          name: string
          position_accuracy_m: number | null
          position_set_at: string | null
          position_set_by: string | null
          position_source: string | null
          radius_m: number
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          late_tolerance_minutes?: number
          latitude?: number | null
          longitude?: number | null
          name: string
          position_accuracy_m?: number | null
          position_set_at?: string | null
          position_set_by?: string | null
          position_source?: string | null
          radius_m?: number
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          late_tolerance_minutes?: number
          latitude?: number | null
          longitude?: number | null
          name?: string
          position_accuracy_m?: number | null
          position_set_at?: string | null
          position_set_by?: string | null
          position_source?: string | null
          radius_m?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      slot_assignments: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          slot_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          slot_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          slot_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "slot_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_assignments_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "time_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_documents: {
        Row: {
          created_at: string
          file_name: string
          id: string
          kind: string
          mime_type: string
          profile_id: string
          review_reason: string | null
          review_status: string
          reviewed_at: string | null
          reviewed_by: string | null
          size_bytes: number
          status: string
          storage_path: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          kind: string
          mime_type: string
          profile_id: string
          review_reason?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          size_bytes: number
          status?: string
          storage_path: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          kind?: string
          mime_type?: string
          profile_id?: string
          review_reason?: string | null
          review_status?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          size_bytes?: number
          status?: string
          storage_path?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_documents_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_notes: {
        Row: {
          content: string
          created_at: string
          profile_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: string
          created_at?: string
          profile_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          profile_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_notes_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      time_slots: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          label: string | null
          school_id: string
          starts_at: string
          status: string
          updated_at: string
          weekday: number
        }
        Insert: {
          created_at?: string
          ends_at: string
          id?: string
          label?: string | null
          school_id: string
          starts_at: string
          status?: string
          updated_at?: string
          weekday: number
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          label?: string | null
          school_id?: string
          starts_at?: string
          status?: string
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "time_slots_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_clerk_id: { Args: never; Returns: string }
      current_profile_id: { Args: never; Returns: string }
      current_user_role: { Args: never; Returns: string }
      is_pedagogy_manager: { Args: never; Returns: boolean }
      is_rh_manageable_role: {
        Args: { value: Database["public"]["Enums"]["user_role"] }
        Returns: boolean
      }
      replace_daily_code: {
        Args: { p_code: string; p_code_date: string; p_school_id: string }
        Returns: string
      }
      replace_monthly_program: {
        Args: {
          p_file_name: string
          p_month: string
          p_size_bytes: number
          p_storage_path: string
          p_title: string
        }
        Returns: string
      }
      review_daily_report: {
        Args: {
          p_classes?: string
          p_comment?: string
          p_course_theme?: string
          p_decision: string
          p_equipment_issues?: Json
          p_equipment_ok?: boolean
          p_report_id: string
        }
        Returns: number
      }
      submit_daily_report: {
        Args: { p_report_id: string }
        Returns: number
      }
      set_school_position: {
        Args: {
          p_accuracy_m: number
          p_latitude: number
          p_longitude: number
          p_school_id: string
        }
        Returns: undefined
      }
      verify_attendance_code: {
        Args: {
          p_code: string
          p_code_date: string
          p_profile_id: string
          p_school_id: string
        }
        Returns: {
          minutes_left: number
          outcome: string
          remaining: number
        }[]
      }
      pedagogy_staff_directory: {
        Args: never
        Returns: {
          full_name: string
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          status: string
        }[]
      }
    }
    Enums: {
      user_role:
        | "formateur"
        | "maintenancier"
        | "directeur_partenaire"
        | "admin_pedagogie"
        | "admin_rh"
        | "admin_maintenance"
        | "super_admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      user_role: [
        "formateur",
        "maintenancier",
        "directeur_partenaire",
        "admin_pedagogie",
        "admin_rh",
        "admin_maintenance",
        "super_admin",
      ],
    },
  },
} as const
