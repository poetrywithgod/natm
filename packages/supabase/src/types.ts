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
    PostgrestVersion: "14.15"
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
      academic_sessions: {
        Row: {
          created_at: string
          id: string
          is_current: boolean
          name: string
          school_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_current?: boolean
          name: string
          school_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_current?: boolean
          name?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          class_id: string
          created_at: string
          date: string
          id: string
          marked_by: string
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          term_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          date: string
          id?: string
          marked_by: string
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
          term_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          date?: string
          id?: string
          marked_by?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
          term_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_marked_by_fkey"
            columns: ["marked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          class_teacher_id: string | null
          created_at: string
          id: string
          level: Database["public"]["Enums"]["class_level"] | null
          name: string
          school_id: string
        }
        Insert: {
          class_teacher_id?: string | null
          created_at?: string
          id?: string
          level?: Database["public"]["Enums"]["class_level"] | null
          name: string
          school_id: string
        }
        Update: {
          class_teacher_id?: string | null
          created_at?: string
          id?: string
          level?: Database["public"]["Enums"]["class_level"] | null
          name?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_class_teacher_id_fkey"
            columns: ["class_teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_documents: {
        Row: {
          ai_recommendation_rules: string | null
          assessment_evidence: string | null
          created_at: string
          domain_purpose: string | null
          id: string
          learning_outcomes: string[] | null
          learning_resources: string | null
          level: Database["public"]["Enums"]["class_level"]
          portfolio_evidence: string | null
          subject_id: string
          teacher_reflection: string | null
          term_number: number
          updated_at: string
        }
        Insert: {
          ai_recommendation_rules?: string | null
          assessment_evidence?: string | null
          created_at?: string
          domain_purpose?: string | null
          id?: string
          learning_outcomes?: string[] | null
          learning_resources?: string | null
          level: Database["public"]["Enums"]["class_level"]
          portfolio_evidence?: string | null
          subject_id: string
          teacher_reflection?: string | null
          term_number: number
          updated_at?: string
        }
        Update: {
          ai_recommendation_rules?: string | null
          assessment_evidence?: string | null
          created_at?: string
          domain_purpose?: string | null
          id?: string
          learning_outcomes?: string[] | null
          learning_resources?: string | null
          level?: Database["public"]["Enums"]["class_level"]
          portfolio_evidence?: string | null
          subject_id?: string
          teacher_reflection?: string | null
          term_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_documents_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_weeks: {
        Row: {
          curriculum_document_id: string
          detail: Json | null
          id: string
          learning_goal: string | null
          natm_approach: string | null
          topic: string
          week_number: number
        }
        Insert: {
          curriculum_document_id: string
          detail?: Json | null
          id?: string
          learning_goal?: string | null
          natm_approach?: string | null
          topic: string
          week_number: number
        }
        Update: {
          curriculum_document_id?: string
          detail?: Json | null
          id?: string
          learning_goal?: string | null
          natm_approach?: string | null
          topic?: string
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_weeks_curriculum_document_id_fkey"
            columns: ["curriculum_document_id"]
            isOneToOne: false
            referencedRelation: "curriculum_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_types: {
        Row: {
          amount: number
          class_id: string | null
          created_at: string
          id: string
          name: string
          school_id: string
          term_id: string
        }
        Insert: {
          amount: number
          class_id?: string | null
          created_at?: string
          id?: string
          name: string
          school_id: string
          term_id: string
        }
        Update: {
          amount?: number
          class_id?: string | null
          created_at?: string
          id?: string
          name?: string
          school_id?: string
          term_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_types_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_types_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_types_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_student_links: {
        Row: {
          created_at: string
          id: string
          parent_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parent_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parent_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_student_links_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_student_links_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          deactivated_at: string | null
          full_name: string
          id: string
          is_active: boolean
          photo_url: string | null
          role: Database["public"]["Enums"]["staff_role"]
          school_id: string | null
        }
        Insert: {
          created_at?: string
          deactivated_at?: string | null
          full_name: string
          id: string
          is_active?: boolean
          photo_url?: string | null
          role: Database["public"]["Enums"]["staff_role"]
          school_id?: string | null
        }
        Update: {
          created_at?: string
          deactivated_at?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          photo_url?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          academic_session_id: string
          created_at: string
          decision: string
          from_class_id: string | null
          id: string
          promoted_by: string
          school_id: string
          student_id: string
          to_class_id: string
        }
        Insert: {
          academic_session_id: string
          created_at?: string
          decision: string
          from_class_id?: string | null
          id?: string
          promoted_by: string
          school_id: string
          student_id: string
          to_class_id: string
        }
        Update: {
          academic_session_id?: string
          created_at?: string
          decision?: string
          from_class_id?: string | null
          id?: string
          promoted_by?: string
          school_id?: string
          student_id?: string
          to_class_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotions_academic_session_id_fkey"
            columns: ["academic_session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_from_class_id_fkey"
            columns: ["from_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_promoted_by_fkey"
            columns: ["promoted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotions_to_class_id_fkey"
            columns: ["to_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      school_student_id_counters: {
        Row: {
          next_number: number
          school_id: string
        }
        Insert: {
          next_number?: number
          school_id: string
        }
        Update: {
          next_number?: number
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_student_id_counters_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          contact_email: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      shadow_teacher_assignments: {
        Row: {
          assigned_at: string
          ended_at: string | null
          id: string
          is_active: boolean
          shadow_teacher_id: string
          student_id: string
        }
        Insert: {
          assigned_at?: string
          ended_at?: string | null
          id?: string
          is_active?: boolean
          shadow_teacher_id: string
          student_id: string
        }
        Update: {
          assigned_at?: string
          ended_at?: string | null
          id?: string
          is_active?: boolean
          shadow_teacher_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shadow_teacher_assignments_shadow_teacher_id_fkey"
            columns: ["shadow_teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shadow_teacher_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_fees: {
        Row: {
          amount_due: number
          amount_paid: number
          fee_type_id: string | null
          id: string
          is_paid: boolean | null
          school_id: string
          student_id: string
          term_id: string
          updated_at: string
        }
        Insert: {
          amount_due?: number
          amount_paid?: number
          fee_type_id?: string | null
          id?: string
          is_paid?: boolean | null
          school_id: string
          student_id: string
          term_id: string
          updated_at?: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          fee_type_id?: string | null
          id?: string
          is_paid?: boolean | null
          school_id?: string
          student_id?: string
          term_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_fees_fee_type_id_fkey"
            columns: ["fee_type_id"]
            isOneToOne: false
            referencedRelation: "fee_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_fees_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_fees_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_fees_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      student_subject_carryovers: {
        Row: {
          academic_session_id: string
          carryover_class_id: string
          created_at: string
          id: string
          school_id: string
          student_id: string
          subject_id: string
        }
        Insert: {
          academic_session_id: string
          carryover_class_id: string
          created_at?: string
          id?: string
          school_id: string
          student_id: string
          subject_id: string
        }
        Update: {
          academic_session_id?: string
          carryover_class_id?: string
          created_at?: string
          id?: string
          school_id?: string
          student_id?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_subject_carryovers_academic_session_id_fkey"
            columns: ["academic_session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subject_carryovers_carryover_class_id_fkey"
            columns: ["carryover_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subject_carryovers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subject_carryovers_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subject_carryovers_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          class_id: string | null
          created_at: string
          full_name: string
          id: string
          photo_url: string | null
          profile_id: string | null
          school_id: string
          unique_student_id: string | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          full_name: string
          id?: string
          photo_url?: string | null
          profile_id?: string | null
          school_id: string
          unique_student_id?: string | null
        }
        Update: {
          class_id?: string | null
          created_at?: string
          full_name?: string
          id?: string
          photo_url?: string | null
          profile_id?: string | null
          school_id?: string
          unique_student_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      terms: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          is_current: boolean
          session_id: string
          start_date: string | null
          term_number: number
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          is_current?: boolean
          session_id: string
          start_date?: string | null
          term_number: number
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          is_current?: boolean
          session_id?: string
          start_date?: string | null
          term_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "terms_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      timetable_entries: {
        Row: {
          class_id: string
          created_at: string
          day_of_week: number
          id: string
          period_id: string
          school_id: string
          subject_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          day_of_week: number
          id?: string
          period_id: string
          school_id: string
          subject_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          day_of_week?: number
          id?: string
          period_id?: string
          school_id?: string
          subject_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timetable_entries_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_entries_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "timetable_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_entries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_entries_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timetable_entries_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      timetable_periods: {
        Row: {
          created_at: string
          end_time: string
          id: string
          label: string
          period_number: number
          school_id: string
          start_time: string
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          label: string
          period_number: number
          school_id: string
          start_time: string
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          label?: string
          period_number?: number
          school_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "timetable_periods_school_id_fkey"
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
      [_ in never]: never
    }
    Enums: {
      attendance_status: "present" | "absent" | "late"
      class_level:
        | "primary_1"
        | "primary_2"
        | "primary_3"
        | "primary_4"
        | "primary_5"
        | "primary_6"
        | "jss_1"
        | "jss_2"
        | "jss_3"
        | "ss_1"
        | "ss_2"
        | "ss_3"
      staff_role:
        | "super_admin"
        | "school_admin"
        | "class_teacher"
        | "shadow_teacher"
        | "parent"
        | "student"
        | "finance_manager"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      attendance_status: ["present", "absent", "late"],
      class_level: [
        "primary_1",
        "primary_2",
        "primary_3",
        "primary_4",
        "primary_5",
        "primary_6",
        "jss_1",
        "jss_2",
        "jss_3",
        "ss_1",
        "ss_2",
        "ss_3",
      ],
      staff_role: [
        "super_admin",
        "school_admin",
        "class_teacher",
        "shadow_teacher",
        "parent",
        "student",
        "finance_manager",
      ],
    },
  },
} as const
