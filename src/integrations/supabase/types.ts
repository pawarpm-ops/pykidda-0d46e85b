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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_mock_attempts: {
        Row: {
          answers: Json
          grade: string
          id: string
          marks_obtained: number
          percentage: number
          started_at: string
          submission_type: string
          submitted_at: string | null
          test_id: string
          time_taken_sec: number
          total_marks: number
          user_id: string
          violation_reason: string | null
        }
        Insert: {
          answers?: Json
          grade?: string
          id?: string
          marks_obtained?: number
          percentage?: number
          started_at?: string
          submission_type?: string
          submitted_at?: string | null
          test_id: string
          time_taken_sec?: number
          total_marks?: number
          user_id: string
          violation_reason?: string | null
        }
        Update: {
          answers?: Json
          grade?: string
          id?: string
          marks_obtained?: number
          percentage?: number
          started_at?: string
          submission_type?: string
          submitted_at?: string | null
          test_id?: string
          time_taken_sec?: number
          total_marks?: number
          user_id?: string
          violation_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_mock_attempts_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "ai_mock_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_mock_questions: {
        Row: {
          code_tests: Json
          correct_answer: string
          created_at: string
          explanation: string
          id: string
          marks: number
          options: Json
          order_index: number
          prompt: string
          starter_code: string
          test_id: string
          type: string
        }
        Insert: {
          code_tests?: Json
          correct_answer?: string
          created_at?: string
          explanation?: string
          id?: string
          marks?: number
          options?: Json
          order_index?: number
          prompt: string
          starter_code?: string
          test_id: string
          type: string
        }
        Update: {
          code_tests?: Json
          correct_answer?: string
          created_at?: string
          explanation?: string
          id?: string
          marks?: number
          options?: Json
          order_index?: number
          prompt?: string
          starter_code?: string
          test_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_mock_questions_test_id_fkey"
            columns: ["test_id"]
            isOneToOne: false
            referencedRelation: "ai_mock_tests"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_mock_tests: {
        Row: {
          admin_id: string | null
          created_at: string
          description: string
          duration_sec: number
          id: string
          published_at: string | null
          question_count: number
          results_visibility: string
          schedule_instructions: string
          scheduled_end_at: string | null
          scheduled_start_at: string | null
          status: string
          syllabus_snippet: string
          test_kind: string
          title: string
          total_marks: number
          updated_at: string
        }
        Insert: {
          admin_id?: string | null
          created_at?: string
          description?: string
          duration_sec?: number
          id?: string
          published_at?: string | null
          question_count?: number
          results_visibility?: string
          schedule_instructions?: string
          scheduled_end_at?: string | null
          scheduled_start_at?: string | null
          status?: string
          syllabus_snippet?: string
          test_kind?: string
          title: string
          total_marks?: number
          updated_at?: string
        }
        Update: {
          admin_id?: string | null
          created_at?: string
          description?: string
          duration_sec?: number
          id?: string
          published_at?: string | null
          question_count?: number
          results_visibility?: string
          schedule_instructions?: string
          scheduled_end_at?: string | null
          scheduled_start_at?: string | null
          status?: string
          syllabus_snippet?: string
          test_kind?: string
          title?: string
          total_marks?: number
          updated_at?: string
        }
        Relationships: []
      }
      announcement_reads: {
        Row: {
          announcement_id: string
          dismissed_at: string | null
          id: string
          read_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          dismissed_at?: string | null
          id?: string
          read_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          dismissed_at?: string | null
          id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          action_url: string | null
          author_id: string
          body: string
          created_at: string
          id: string
          priority: string
          scheduled_at: string | null
          target_user_id: string | null
          title: string
        }
        Insert: {
          action_url?: string | null
          author_id: string
          body: string
          created_at?: string
          id?: string
          priority?: string
          scheduled_at?: string | null
          target_user_id?: string | null
          title: string
        }
        Update: {
          action_url?: string | null
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          priority?: string
          scheduled_at?: string | null
          target_user_id?: string | null
          title?: string
        }
        Relationships: []
      }
      assignment_submissions: {
        Row: {
          answer_text: string | null
          assignment_id: string
          code_answer: string | null
          code_output: string | null
          created_at: string
          id: string
          is_late: boolean
          marks_obtained: number | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          student_id: string
          submitted_at: string | null
          teacher_feedback: string | null
          updated_at: string
        }
        Insert: {
          answer_text?: string | null
          assignment_id: string
          code_answer?: string | null
          code_output?: string | null
          created_at?: string
          id?: string
          is_late?: boolean
          marks_obtained?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_id: string
          submitted_at?: string | null
          teacher_feedback?: string | null
          updated_at?: string
        }
        Update: {
          answer_text?: string | null
          assignment_id?: string
          code_answer?: string | null
          code_output?: string | null
          created_at?: string
          id?: string
          is_late?: boolean
          marks_obtained?: number | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          student_id?: string
          submitted_at?: string | null
          teacher_feedback?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_submissions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          ai_prompt_summary: string | null
          allow_late_submission: boolean
          assignment_type: string
          constraints: string | null
          created_at: string
          created_by: string
          description: string
          difficulty: string
          due_at: string | null
          expected_output: string | null
          hints: string | null
          id: string
          input_format: string | null
          instructions: string | null
          output_format: string | null
          question_source: string
          refined_by_ai: boolean
          sample_input: string | null
          sample_output: string | null
          starter_code: string | null
          status: string
          submission_mode: string
          test_cases: Json
          title: string
          topic: string | null
          total_marks: number
          unit: number | null
          updated_at: string
        }
        Insert: {
          ai_prompt_summary?: string | null
          allow_late_submission?: boolean
          assignment_type?: string
          constraints?: string | null
          created_at?: string
          created_by: string
          description?: string
          difficulty?: string
          due_at?: string | null
          expected_output?: string | null
          hints?: string | null
          id?: string
          input_format?: string | null
          instructions?: string | null
          output_format?: string | null
          question_source?: string
          refined_by_ai?: boolean
          sample_input?: string | null
          sample_output?: string | null
          starter_code?: string | null
          status?: string
          submission_mode?: string
          test_cases?: Json
          title: string
          topic?: string | null
          total_marks?: number
          unit?: number | null
          updated_at?: string
        }
        Update: {
          ai_prompt_summary?: string | null
          allow_late_submission?: boolean
          assignment_type?: string
          constraints?: string | null
          created_at?: string
          created_by?: string
          description?: string
          difficulty?: string
          due_at?: string | null
          expected_output?: string | null
          hints?: string | null
          id?: string
          input_format?: string | null
          instructions?: string | null
          output_format?: string | null
          question_source?: string
          refined_by_ai?: boolean
          sample_input?: string | null
          sample_output?: string | null
          starter_code?: string | null
          status?: string
          submission_mode?: string
          test_cases?: Json
          title?: string
          topic?: string | null
          total_marks?: number
          unit?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      leaderboard_scores: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          mock_best: number
          mocks_taken: number
          score: number
          solved_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          display_name?: string | null
          mock_best?: number
          mocks_taken?: number
          score?: number
          solved_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          display_name?: string | null
          mock_best?: number
          mocks_taken?: number
          score?: number
          solved_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mock_results: {
        Row: {
          created_at: string
          grade: string
          id: string
          marks_obtained: number
          percentage: number
          student_name: string | null
          submission_type: string
          submitted_at: string
          test_id: string
          test_name: string
          time_taken_sec: number
          total_marks: number
          total_questions: number
          user_id: string
          violation_reason: string | null
        }
        Insert: {
          created_at?: string
          grade?: string
          id?: string
          marks_obtained?: number
          percentage?: number
          student_name?: string | null
          submission_type?: string
          submitted_at?: string
          test_id: string
          test_name: string
          time_taken_sec?: number
          total_marks?: number
          total_questions?: number
          user_id: string
          violation_reason?: string | null
        }
        Update: {
          created_at?: string
          grade?: string
          id?: string
          marks_obtained?: number
          percentage?: number
          student_name?: string | null
          submission_type?: string
          submitted_at?: string
          test_id?: string
          test_name?: string
          time_taken_sec?: number
          total_marks?: number
          total_questions?: number
          user_id?: string
          violation_reason?: string | null
        }
        Relationships: []
      }
      mock_test_attempt_comments: {
        Row: {
          attempt_id: string
          attempt_kind: string
          comment_text: string
          created_at: string
          id: string
          student_id: string
          teacher_id: string
          test_id: string
          updated_at: string
        }
        Insert: {
          attempt_id: string
          attempt_kind: string
          comment_text?: string
          created_at?: string
          id?: string
          student_id: string
          teacher_id: string
          test_id: string
          updated_at?: string
        }
        Update: {
          attempt_id?: string
          attempt_kind?: string
          comment_text?: string
          created_at?: string
          id?: string
          student_id?: string
          teacher_id?: string
          test_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      practice_attempts: {
        Row: {
          attempted_at: string
          created_at: string
          id: string
          passed: number
          question_id: string
          solved: boolean
          total: number
          unit: number
          user_id: string
        }
        Insert: {
          attempted_at?: string
          created_at?: string
          id?: string
          passed?: number
          question_id: string
          solved?: boolean
          total?: number
          unit: number
          user_id: string
        }
        Update: {
          attempted_at?: string
          created_at?: string
          id?: string
          passed?: number
          question_id?: string
          solved?: boolean
          total?: number
          unit?: number
          user_id?: string
        }
        Relationships: []
      }
      problem_reports: {
        Row: {
          admin_remarks: string | null
          admin_response: string | null
          browser_info: string | null
          created_at: string
          description: string
          id: string
          page_url: string | null
          priority: string
          problem_type: string
          question_id: string | null
          question_number: string | null
          related_section: string
          resolved_at: string | null
          roll_number: string | null
          screenshot_url: string | null
          status: string
          student_email: string | null
          student_name: string | null
          subject: string
          test_id: string | null
          topic: string | null
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_remarks?: string | null
          admin_response?: string | null
          browser_info?: string | null
          created_at?: string
          description: string
          id?: string
          page_url?: string | null
          priority?: string
          problem_type: string
          question_id?: string | null
          question_number?: string | null
          related_section: string
          resolved_at?: string | null
          roll_number?: string | null
          screenshot_url?: string | null
          status?: string
          student_email?: string | null
          student_name?: string | null
          subject: string
          test_id?: string | null
          topic?: string | null
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_remarks?: string | null
          admin_response?: string | null
          browser_info?: string | null
          created_at?: string
          description?: string
          id?: string
          page_url?: string | null
          priority?: string
          problem_type?: string
          question_id?: string | null
          question_number?: string | null
          related_section?: string
          resolved_at?: string | null
          roll_number?: string | null
          screenshot_url?: string | null
          status?: string
          student_email?: string | null
          student_name?: string | null
          subject?: string
          test_id?: string | null
          topic?: string | null
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number | null
          avatar_url: string | null
          bio: string | null
          birth_date: string | null
          college_name: string | null
          contact_number: string | null
          created_at: string
          display_name: string | null
          full_name: string | null
          gender: string | null
          id: string
          onboarded: boolean
          public_profile_id: string | null
          public_profile_settings: Json
          qr_created_at: string | null
          qr_enabled: boolean
          qr_updated_at: string | null
          student_unique_id: string | null
          tutorial_status: string
          updated_at: string
        }
        Insert: {
          age?: number | null
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          college_name?: string | null
          contact_number?: string | null
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          gender?: string | null
          id: string
          onboarded?: boolean
          public_profile_id?: string | null
          public_profile_settings?: Json
          qr_created_at?: string | null
          qr_enabled?: boolean
          qr_updated_at?: string | null
          student_unique_id?: string | null
          tutorial_status?: string
          updated_at?: string
        }
        Update: {
          age?: number | null
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          college_name?: string | null
          contact_number?: string | null
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          onboarded?: boolean
          public_profile_id?: string | null
          public_profile_settings?: Json
          qr_created_at?: string | null
          qr_enabled?: boolean
          qr_updated_at?: string | null
          student_unique_id?: string | null
          tutorial_status?: string
          updated_at?: string
        }
        Relationships: []
      }
      streak_activity_logs: {
        Row: {
          activity_date: string
          activity_reference_id: string | null
          activity_type: string
          created_at: string
          id: string
          points_earned: number
          streak_count_after_activity: number
          user_id: string
        }
        Insert: {
          activity_date: string
          activity_reference_id?: string | null
          activity_type: string
          created_at?: string
          id?: string
          points_earned?: number
          streak_count_after_activity?: number
          user_id: string
        }
        Update: {
          activity_date?: string
          activity_reference_id?: string | null
          activity_type?: string
          created_at?: string
          id?: string
          points_earned?: number
          streak_count_after_activity?: number
          user_id?: string
        }
        Relationships: []
      }
      student_streaks: {
        Row: {
          created_at: string
          current_streak: number
          id: string
          last_activity_date: string | null
          longest_streak: number
          streak_freezes_available: number
          streak_freezes_used: number
          today_completed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number
          id?: string
          last_activity_date?: string | null
          longest_streak?: number
          streak_freezes_available?: number
          streak_freezes_used?: number
          today_completed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number
          id?: string
          last_activity_date?: string | null
          longest_streak?: number
          streak_freezes_available?: number
          streak_freezes_used?: number
          today_completed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_reviews: {
        Row: {
          category: string | null
          created_at: string
          device_info: string | null
          id: string
          is_important: boolean
          page_url: string | null
          quick_reaction: string | null
          rating: number
          review_text: string | null
          roll_number: string | null
          status: string
          student_email: string | null
          student_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          device_info?: string | null
          id?: string
          is_important?: boolean
          page_url?: string | null
          quick_reaction?: string | null
          rating: number
          review_text?: string | null
          roll_number?: string | null
          status?: string
          student_email?: string | null
          student_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          device_info?: string | null
          id?: string
          is_important?: boolean
          page_url?: string | null
          quick_reaction?: string | null
          rating?: number
          review_text?: string | null
          roll_number?: string | null
          status?: string
          student_email?: string | null
          student_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_seen_updates: {
        Row: {
          id: string
          item_id: string
          item_type: string
          seen_at: string
          user_id: string
        }
        Insert: {
          id?: string
          item_id: string
          item_type: string
          seen_at?: string
          user_id: string
        }
        Update: {
          id?: string
          item_id?: string
          item_type?: string
          seen_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_public_profile_id: { Args: never; Returns: string }
      generate_student_unique_id: { Args: never; Returns: string }
      get_public_student_profile: {
        Args: { _public_id: string }
        Returns: Json
      }
      get_student_directory: {
        Args: { _ids: string[] }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
          public_profile_id: string
          qr_enabled: boolean
          student_unique_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      record_streak_activity: {
        Args: { _activity_type: string; _reference_id?: string }
        Returns: {
          current_streak: number
          is_new_day: boolean
          longest_streak: number
          today_completed: boolean
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "student"
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
      app_role: ["admin", "student"],
    },
  },
} as const
