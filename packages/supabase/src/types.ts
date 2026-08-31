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
      activity_reinforcements: {
        Row: {
          class_activity_id: string
          created_at: string
          id: string
          note: string
          shadow_teacher_id: string
          student_id: string
        }
        Insert: {
          class_activity_id: string
          created_at?: string
          id?: string
          note: string
          shadow_teacher_id: string
          student_id: string
        }
        Update: {
          class_activity_id?: string
          created_at?: string
          id?: string
          note?: string
          shadow_teacher_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_reinforcements_class_activity_id_fkey"
            columns: ["class_activity_id"]
            isOneToOne: false
            referencedRelation: "class_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_reinforcements_shadow_teacher_id_fkey"
            columns: ["shadow_teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_reinforcements_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          body: string
          created_at: string
          id: string
          posted_by: string
          school_id: string
          target_parents: boolean
          target_staff: boolean
          target_students: boolean
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          posted_by: string
          school_id: string
          target_parents?: boolean
          target_staff?: boolean
          target_students?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          posted_by?: string
          school_id?: string
          target_parents?: boolean
          target_staff?: boolean
          target_students?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_episodes: {
        Row: {
          ai_suggested_at: string | null
          approved_level: Database["public"]["Enums"]["class_level"] | null
          approved_subjects: Json | null
          class_assigned_at: string | null
          class_assigned_by: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          episode_number: number
          form1_approved_at: string | null
          form1_approved_by: string | null
          form1_submitted_at: string | null
          form2_submitted_at: string | null
          id: string
          school_id: string
          shadow_teacher_assigned_at: string | null
          shadow_teacher_assigned_by: string | null
          status: Database["public"]["Enums"]["assessment_episode_status"]
          student_id: string
          suggested_level: Database["public"]["Enums"]["class_level"] | null
          suggested_subjects: Json | null
        }
        Insert: {
          ai_suggested_at?: string | null
          approved_level?: Database["public"]["Enums"]["class_level"] | null
          approved_subjects?: Json | null
          class_assigned_at?: string | null
          class_assigned_by?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          episode_number: number
          form1_approved_at?: string | null
          form1_approved_by?: string | null
          form1_submitted_at?: string | null
          form2_submitted_at?: string | null
          id?: string
          school_id: string
          shadow_teacher_assigned_at?: string | null
          shadow_teacher_assigned_by?: string | null
          status?: Database["public"]["Enums"]["assessment_episode_status"]
          student_id: string
          suggested_level?: Database["public"]["Enums"]["class_level"] | null
          suggested_subjects?: Json | null
        }
        Update: {
          ai_suggested_at?: string | null
          approved_level?: Database["public"]["Enums"]["class_level"] | null
          approved_subjects?: Json | null
          class_assigned_at?: string | null
          class_assigned_by?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          episode_number?: number
          form1_approved_at?: string | null
          form1_approved_by?: string | null
          form1_submitted_at?: string | null
          form2_submitted_at?: string | null
          id?: string
          school_id?: string
          shadow_teacher_assigned_at?: string | null
          shadow_teacher_assigned_by?: string | null
          status?: Database["public"]["Enums"]["assessment_episode_status"]
          student_id?: string
          suggested_level?: Database["public"]["Enums"]["class_level"] | null
          suggested_subjects?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_episodes_class_assigned_by_fkey"
            columns: ["class_assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_episodes_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_episodes_form1_approved_by_fkey"
            columns: ["form1_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_episodes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_episodes_shadow_teacher_assigned_by_fkey"
            columns: ["shadow_teacher_assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_episodes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
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
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          school_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          school_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      class_activities: {
        Row: {
          class_id: string
          created_at: string
          created_by: string
          date: string
          id: string
          notes: string | null
          school_id: string
          subject_id: string
          topic: string
          updated_at: string
        }
        Insert: {
          class_id: string
          created_at?: string
          created_by: string
          date: string
          id?: string
          notes?: string | null
          school_id: string
          subject_id: string
          topic: string
          updated_at?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          created_by?: string
          date?: string
          id?: string
          notes?: string | null
          school_id?: string
          subject_id?: string
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_activities_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_activities_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_activities_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      class_subjects: {
        Row: {
          class_id: string
          created_at: string
          id: string
          subject_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          subject_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_subjects_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      class_work: {
        Row: {
          assigned_by: string
          class_id: string
          created_at: string
          due_date: string | null
          id: string
          quiz_id: string
          school_id: string
        }
        Insert: {
          assigned_by: string
          class_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          quiz_id: string
          school_id: string
        }
        Update: {
          assigned_by?: string
          class_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          quiz_id?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_work_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_work_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_work_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_work_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      class_work_assignees: {
        Row: {
          class_work_id: string
          id: string
          student_id: string
        }
        Insert: {
          class_work_id: string
          id?: string
          student_id: string
        }
        Update: {
          class_work_id?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_work_assignees_class_work_id_fkey"
            columns: ["class_work_id"]
            isOneToOne: false
            referencedRelation: "class_work"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_work_assignees_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
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
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          parent_id: string
          parent_last_read_at: string | null
          school_id: string
          shadow_teacher_id: string
          shadow_teacher_last_read_at: string | null
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          parent_id: string
          parent_last_read_at?: string | null
          school_id: string
          shadow_teacher_id: string
          shadow_teacher_last_read_at?: string | null
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          parent_id?: string
          parent_last_read_at?: string | null
          school_id?: string
          shadow_teacher_id?: string
          shadow_teacher_last_read_at?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_shadow_teacher_id_fkey"
            columns: ["shadow_teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
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
          pdf_filename: string | null
          pdf_uploaded_at: string | null
          pdf_url: string | null
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
          pdf_filename?: string | null
          pdf_uploaded_at?: string | null
          pdf_url?: string | null
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
          pdf_filename?: string | null
          pdf_uploaded_at?: string | null
          pdf_url?: string | null
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
          is_archived: boolean
          is_open_amount: boolean
          name: string
          school_id: string
          term_id: string
        }
        Insert: {
          amount: number
          class_id?: string | null
          created_at?: string
          id?: string
          is_archived?: boolean
          is_open_amount?: boolean
          name: string
          school_id: string
          term_id: string
        }
        Update: {
          amount?: number
          class_id?: string | null
          created_at?: string
          id?: string
          is_archived?: boolean
          is_open_amount?: boolean
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
      form1_submissions: {
        Row: {
          consents: Json
          created_at: string
          episode_id: string
          id: string
          part_a: Json
          part_b: Json
          school_id: string
          student_id: string
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          consents?: Json
          created_at?: string
          episode_id: string
          id?: string
          part_a?: Json
          part_b?: Json
          school_id: string
          student_id: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          consents?: Json
          created_at?: string
          episode_id?: string
          id?: string
          part_a?: Json
          part_b?: Json
          school_id?: string
          student_id?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form1_submissions_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: true
            referencedRelation: "assessment_episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form1_submissions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form1_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form1_submissions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      form2_submissions: {
        Row: {
          created_at: string
          domains: Json
          episode_id: string
          id: string
          observation_info: Json
          protocol_notes: Json
          school_id: string
          student_id: string
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          domains?: Json
          episode_id: string
          id?: string
          observation_info?: Json
          protocol_notes?: Json
          school_id: string
          student_id: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          domains?: Json
          episode_id?: string
          id?: string
          observation_info?: Json
          protocol_notes?: Json
          school_id?: string
          student_id?: string
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form2_submissions_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: true
            referencedRelation: "assessment_episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form2_submissions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form2_submissions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form2_submissions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          class_id: string
          content_type: Database["public"]["Enums"]["lesson_content_type"]
          created_at: string
          created_by: string
          extracted_text: string | null
          id: string
          pdf_storage_path: string | null
          school_id: string
          subject_id: string
          title: string
          video_id: string | null
        }
        Insert: {
          class_id: string
          content_type: Database["public"]["Enums"]["lesson_content_type"]
          created_at?: string
          created_by: string
          extracted_text?: string | null
          id?: string
          pdf_storage_path?: string | null
          school_id: string
          subject_id: string
          title: string
          video_id?: string | null
        }
        Update: {
          class_id?: string
          content_type?: Database["public"]["Enums"]["lesson_content_type"]
          created_at?: string
          created_by?: string
          extracted_text?: string | null
          id?: string
          pdf_storage_path?: string | null
          school_id?: string
          subject_id?: string
          title?: string
          video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lessons_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
          sender_role: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
          sender_role: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      news_posts: {
        Row: {
          body: string
          created_at: string
          excerpt: string
          id: string
          image_url: string | null
          posted_by: string
          published: boolean
          school_id: string
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          excerpt: string
          id?: string
          image_url?: string | null
          posted_by: string
          published?: boolean
          school_id: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          excerpt?: string
          id?: string
          image_url?: string | null
          posted_by?: string
          published?: boolean
          school_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_posts_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_posts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          pushed_at: string | null
          read_at: string | null
          recipient_id: string
          related_entity_id: string | null
          related_entity_type: string | null
          school_id: string
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          pushed_at?: string | null
          read_at?: string | null
          recipient_id: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          school_id: string
          title: string
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          pushed_at?: string | null
          read_at?: string | null
          recipient_id?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          school_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_student_links: {
        Row: {
          created_at: string
          id: string
          parent_id: string
          relationship: string | null
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parent_id: string
          relationship?: string | null
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parent_id?: string
          relationship?: string | null
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
      payment_transactions: {
        Row: {
          amount: number
          created_at: string
          failure_reason: string | null
          fee_type_id: string
          id: string
          initiated_by: string | null
          order_id: string
          partnership_tier: string | null
          remita_transaction_id: string | null
          rrr: string | null
          school_id: string
          status: string
          student_id: string
          term_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          failure_reason?: string | null
          fee_type_id: string
          id?: string
          initiated_by?: string | null
          order_id: string
          partnership_tier?: string | null
          remita_transaction_id?: string | null
          rrr?: string | null
          school_id: string
          status?: string
          student_id: string
          term_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          failure_reason?: string | null
          fee_type_id?: string
          id?: string
          initiated_by?: string | null
          order_id?: string
          partnership_tier?: string | null
          remita_transaction_id?: string | null
          rrr?: string | null
          school_id?: string
          status?: string
          student_id?: string
          term_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_transactions_fee_type_id_fkey"
            columns: ["fee_type_id"]
            isOneToOne: false
            referencedRelation: "fee_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_transactions_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      partnership_pledges: {
        Row: {
          created_at: string
          id: string
          note: string | null
          parent_id: string
          school_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          parent_id: string
          school_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          parent_id?: string
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partnership_pledges_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partnership_pledges_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partnership_pledges_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          created_at: string
          deactivated_at: string | null
          full_name: string
          id: string
          is_active: boolean
          must_change_password: boolean
          phone: string | null
          photo_url: string | null
          role: Database["public"]["Enums"]["staff_role"]
          school_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          deactivated_at?: string | null
          full_name: string
          id: string
          is_active?: boolean
          must_change_password?: boolean
          phone?: string | null
          photo_url?: string | null
          role: Database["public"]["Enums"]["staff_role"]
          school_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          deactivated_at?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          must_change_password?: boolean
          phone?: string | null
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
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      quarterly_subject_scores: {
        Row: {
          attempt_count: number
          average_score: number
          finalized_at: string
          finalized_by: string
          id: string
          quarter_number: number
          school_id: string
          student_id: string
          subject_id: string
          year: number
        }
        Insert: {
          attempt_count: number
          average_score: number
          finalized_at?: string
          finalized_by: string
          id?: string
          quarter_number: number
          school_id: string
          student_id: string
          subject_id: string
          year: number
        }
        Update: {
          attempt_count?: number
          average_score?: number
          finalized_at?: string
          finalized_by?: string
          id?: string
          quarter_number?: number
          school_id?: string
          student_id?: string
          subject_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "quarterly_subject_scores_finalized_by_fkey"
            columns: ["finalized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quarterly_subject_scores_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quarterly_subject_scores_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quarterly_subject_scores_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_answers: {
        Row: {
          attempt_id: string
          id: string
          is_correct: boolean | null
          marks_awarded: number | null
          question_id: string
          student_answer: string | null
        }
        Insert: {
          attempt_id: string
          id?: string
          is_correct?: boolean | null
          marks_awarded?: number | null
          question_id: string
          student_answer?: string | null
        }
        Update: {
          attempt_id?: string
          id?: string
          is_correct?: boolean | null
          marks_awarded?: number | null
          question_id?: string
          student_answer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "quiz_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          id: string
          quiz_id: string
          score: number | null
          started_at: string
          status: Database["public"]["Enums"]["quiz_attempt_status"]
          student_id: string
          submitted_at: string | null
          total_marks: number | null
        }
        Insert: {
          id?: string
          quiz_id: string
          score?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["quiz_attempt_status"]
          student_id: string
          submitted_at?: string | null
          total_marks?: number | null
        }
        Update: {
          id?: string
          quiz_id?: string
          score?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["quiz_attempt_status"]
          student_id?: string
          submitted_at?: string | null
          total_marks?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          correct_answer: string
          created_at: string
          id: string
          marks: number
          options: Json | null
          order_index: number
          question_text: string
          question_type: Database["public"]["Enums"]["quiz_question_type"]
          quiz_id: string
        }
        Insert: {
          correct_answer: string
          created_at?: string
          id?: string
          marks?: number
          options?: Json | null
          order_index: number
          question_text: string
          question_type: Database["public"]["Enums"]["quiz_question_type"]
          quiz_id: string
        }
        Update: {
          correct_answer?: string
          created_at?: string
          id?: string
          marks?: number
          options?: Json | null
          order_index?: number
          question_text?: string
          question_type?: Database["public"]["Enums"]["quiz_question_type"]
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          created_at: string
          created_by: string
          difficulty: Database["public"]["Enums"]["quiz_difficulty"]
          error_message: string | null
          id: string
          lesson_id: string
          school_id: string
          status: Database["public"]["Enums"]["quiz_status"]
        }
        Insert: {
          created_at?: string
          created_by: string
          difficulty: Database["public"]["Enums"]["quiz_difficulty"]
          error_message?: string | null
          id?: string
          lesson_id: string
          school_id: string
          status?: Database["public"]["Enums"]["quiz_status"]
        }
        Update: {
          created_at?: string
          created_by?: string
          difficulty?: Database["public"]["Enums"]["quiz_difficulty"]
          error_message?: string | null
          id?: string
          lesson_id?: string
          school_id?: string
          status?: Database["public"]["Enums"]["quiz_status"]
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
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
          address: string | null
          contact_email: string | null
          created_at: string
          financial_model: string
          id: string
          is_active: boolean
          logo_url: string | null
          motto: string | null
          name: string
          phone_1: string | null
          phone_2: string | null
          principal_name: string | null
          subscription_fee: number | null
          website: string | null
          year_established: number | null
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          created_at?: string
          financial_model?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          motto?: string | null
          name: string
          phone_1?: string | null
          phone_2?: string | null
          principal_name?: string | null
          subscription_fee?: number | null
          website?: string | null
          year_established?: number | null
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          created_at?: string
          financial_model?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          motto?: string | null
          name?: string
          phone_1?: string | null
          phone_2?: string | null
          principal_name?: string | null
          subscription_fee?: number | null
          website?: string | null
          year_established?: number | null
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
      student_badges: {
        Row: {
          badge_key: string
          earned_at: string
          id: string
          school_id: string
          student_id: string
        }
        Insert: {
          badge_key: string
          earned_at?: string
          id?: string
          school_id: string
          student_id: string
        }
        Update: {
          badge_key?: string
          earned_at?: string
          id?: string
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_badges_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_badges_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      student_subjects: {
        Row: {
          assessment_episode_id: string | null
          assigned_at: string
          assigned_by: string | null
          id: string
          school_id: string
          student_id: string
          subject_id: string
        }
        Insert: {
          assessment_episode_id?: string | null
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          school_id: string
          student_id: string
          subject_id: string
        }
        Update: {
          assessment_episode_id?: string | null
          assigned_at?: string
          assigned_by?: string | null
          id?: string
          school_id?: string
          student_id?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_subjects_assessment_episode_id_fkey"
            columns: ["assessment_episode_id"]
            isOneToOne: false
            referencedRelation: "assessment_episodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subjects_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subjects_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          address: string | null
          bio: string | null
          class_id: string | null
          created_at: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          emergency_contact_phone_alt: string | null
          full_name: string
          id: string
          onboarding_status: Database["public"]["Enums"]["student_onboarding_status"]
          phone: string | null
          photo_url: string | null
          profile_id: string | null
          school_id: string
          unique_student_id: string | null
        }
        Insert: {
          address?: string | null
          bio?: string | null
          class_id?: string | null
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_phone_alt?: string | null
          full_name: string
          id?: string
          onboarding_status?: Database["public"]["Enums"]["student_onboarding_status"]
          phone?: string | null
          photo_url?: string | null
          profile_id?: string | null
          school_id: string
          unique_student_id?: string | null
        }
        Update: {
          address?: string | null
          bio?: string | null
          class_id?: string | null
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          emergency_contact_phone_alt?: string | null
          full_name?: string
          id?: string
          onboarding_status?: Database["public"]["Enums"]["student_onboarding_status"]
          phone?: string | null
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
      subscription_invoices: {
        Row: {
          amount_due: number
          amount_paid: number
          created_at: string
          due_date: string | null
          id: string
          school_id: string
          term_id: string
          updated_at: string
        }
        Insert: {
          amount_due: number
          amount_paid?: number
          created_at?: string
          due_date?: string | null
          id?: string
          school_id: string
          term_id: string
          updated_at?: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          created_at?: string
          due_date?: string | null
          id?: string
          school_id?: string
          term_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_invoices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_invoices_term_id_fkey"
            columns: ["term_id"]
            isOneToOne: false
            referencedRelation: "terms"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_payment_transactions: {
        Row: {
          amount: number
          created_at: string
          failure_reason: string | null
          id: string
          initiated_by: string | null
          invoice_id: string
          order_id: string
          remita_transaction_id: string | null
          rrr: string | null
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          failure_reason?: string | null
          id?: string
          initiated_by?: string | null
          invoice_id: string
          order_id: string
          remita_transaction_id?: string | null
          rrr?: string | null
          school_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          failure_reason?: string | null
          id?: string
          initiated_by?: string | null
          invoice_id?: string
          order_id?: string
          remita_transaction_id?: string | null
          rrr?: string | null
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_payment_transactions_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "subscription_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_payment_transactions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
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
      assessment_episode_status:
        | "form1_draft"
        | "form1_submitted"
        | "form1_approved"
        | "form2_draft"
        | "form2_submitted"
        | "ai_suggested"
        | "completed"
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
      lesson_content_type: "pdf" | "video"
      quiz_attempt_status: "in_progress" | "submitted"
      quiz_difficulty: "easy" | "normal" | "hard"
      quiz_question_type: "multiple_choice" | "fill_in_blank"
      quiz_status: "generating" | "ready" | "failed"
      staff_role:
        | "super_admin"
        | "school_admin"
        | "class_teacher"
        | "shadow_teacher"
        | "parent"
        | "student"
        | "finance_manager"
      student_onboarding_status:
        | "pending_password_reset"
        | "pending_intake_form"
        | "pending_review"
        | "approved"
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
      assessment_episode_status: [
        "form1_draft",
        "form1_submitted",
        "form1_approved",
        "form2_draft",
        "form2_submitted",
        "ai_suggested",
        "completed",
      ],
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
      lesson_content_type: ["pdf", "video"],
      quiz_attempt_status: ["in_progress", "submitted"],
      quiz_difficulty: ["easy", "normal", "hard"],
      quiz_question_type: ["multiple_choice", "fill_in_blank"],
      quiz_status: ["generating", "ready", "failed"],
      staff_role: [
        "super_admin",
        "school_admin",
        "class_teacher",
        "shadow_teacher",
        "parent",
        "student",
        "finance_manager",
      ],
      student_onboarding_status: [
        "pending_password_reset",
        "pending_intake_form",
        "pending_review",
        "approved",
      ],
    },
  },
} as const
