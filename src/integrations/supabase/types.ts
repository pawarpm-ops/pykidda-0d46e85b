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
      admin_activity_logs: {
        Row: {
          action_description: string
          action_type: string
          actor_email: string | null
          actor_id: string
          actor_name: string | null
          actor_role: string | null
          created_at: string
          id: string
          metadata: Json | null
          module_name: string
          new_value: Json | null
          old_value: Json | null
          related_student_id: string | null
          status: string
          target_id: string | null
          target_title: string | null
        }
        Insert: {
          action_description: string
          action_type: string
          actor_email?: string | null
          actor_id: string
          actor_name?: string | null
          actor_role?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          module_name: string
          new_value?: Json | null
          old_value?: Json | null
          related_student_id?: string | null
          status?: string
          target_id?: string | null
          target_title?: string | null
        }
        Update: {
          action_description?: string
          action_type?: string
          actor_email?: string | null
          actor_id?: string
          actor_name?: string | null
          actor_role?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          module_name?: string
          new_value?: Json | null
          old_value?: Json | null
          related_student_id?: string | null
          status?: string
          target_id?: string | null
          target_title?: string | null
        }
        Relationships: []
      }
      ai_mock_attempts: {
        Row: {
          answers: Json
          auto_marks_obtained: number
          auto_percentage: number
          grade: string
          grading_status: string
          id: string
          marks_obtained: number
          percentage: number
          reviewed_at: string | null
          reviewed_by: string | null
          started_at: string
          submission_type: string
          submitted_at: string | null
          teacher_feedback: string | null
          test_id: string
          time_taken_sec: number
          total_marks: number
          user_id: string
          violation_reason: string | null
        }
        Insert: {
          answers?: Json
          auto_marks_obtained?: number
          auto_percentage?: number
          grade?: string
          grading_status?: string
          id?: string
          marks_obtained?: number
          percentage?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          started_at?: string
          submission_type?: string
          submitted_at?: string | null
          teacher_feedback?: string | null
          test_id: string
          time_taken_sec?: number
          total_marks?: number
          user_id: string
          violation_reason?: string | null
        }
        Update: {
          answers?: Json
          auto_marks_obtained?: number
          auto_percentage?: number
          grade?: string
          grading_status?: string
          id?: string
          marks_obtained?: number
          percentage?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          started_at?: string
          submission_type?: string
          submitted_at?: string | null
          teacher_feedback?: string | null
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
      badges: {
        Row: {
          badge_key: string
          badge_name: string
          category: string
          created_at: string
          description: string
          icon: string
          id: string
          is_secret: boolean
          motivational_message: string | null
          rarity: string
          rule_type: string
          sort_order: number
          target_value: number | null
          threshold: number | null
          tier: string
          unlock_hint: string | null
        }
        Insert: {
          badge_key: string
          badge_name: string
          category?: string
          created_at?: string
          description: string
          icon: string
          id?: string
          is_secret?: boolean
          motivational_message?: string | null
          rarity?: string
          rule_type: string
          sort_order?: number
          target_value?: number | null
          threshold?: number | null
          tier?: string
          unlock_hint?: string | null
        }
        Update: {
          badge_key?: string
          badge_name?: string
          category?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_secret?: boolean
          motivational_message?: string | null
          rarity?: string
          rule_type?: string
          sort_order?: number
          target_value?: number | null
          threshold?: number | null
          tier?: string
          unlock_hint?: string | null
        }
        Relationships: []
      }
      homework: {
        Row: {
          allow_late_submission: boolean
          created_at: string
          created_by: string
          description: string
          due_at: string | null
          estimated_minutes: number | null
          id: string
          instructions: string | null
          status: string
          title: string
          total_marks: number
          updated_at: string
        }
        Insert: {
          allow_late_submission?: boolean
          created_at?: string
          created_by: string
          description?: string
          due_at?: string | null
          estimated_minutes?: number | null
          id?: string
          instructions?: string | null
          status?: string
          title: string
          total_marks?: number
          updated_at?: string
        }
        Update: {
          allow_late_submission?: boolean
          created_at?: string
          created_by?: string
          description?: string
          due_at?: string | null
          estimated_minutes?: number | null
          id?: string
          instructions?: string | null
          status?: string
          title?: string
          total_marks?: number
          updated_at?: string
        }
        Relationships: []
      }
      homework_question_answers: {
        Row: {
          auto_check_result: Json | null
          checked_status: string
          created_at: string
          execution_output: string | null
          homework_question_id: string
          id: string
          marks_awarded: number | null
          student_answer: string | null
          student_code: string | null
          submission_id: string
          teacher_comment: string | null
          updated_at: string
        }
        Insert: {
          auto_check_result?: Json | null
          checked_status?: string
          created_at?: string
          execution_output?: string | null
          homework_question_id: string
          id?: string
          marks_awarded?: number | null
          student_answer?: string | null
          student_code?: string | null
          submission_id: string
          teacher_comment?: string | null
          updated_at?: string
        }
        Update: {
          auto_check_result?: Json | null
          checked_status?: string
          created_at?: string
          execution_output?: string | null
          homework_question_id?: string
          id?: string
          marks_awarded?: number | null
          student_answer?: string | null
          student_code?: string | null
          submission_id?: string
          teacher_comment?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_question_answers_homework_question_id_fkey"
            columns: ["homework_question_id"]
            isOneToOne: false
            referencedRelation: "homework_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "homework_question_answers_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "homework_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_questions: {
        Row: {
          created_at: string
          description: string
          difficulty: string
          hints: string | null
          homework_id: string
          id: string
          input_format: string | null
          marks: number
          mcq_correct: string | null
          mcq_options: Json | null
          output_format: string | null
          question_order: number
          question_type: string
          sample_input: string | null
          sample_output: string | null
          starter_code: string | null
          test_cases: Json
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          difficulty?: string
          hints?: string | null
          homework_id: string
          id?: string
          input_format?: string | null
          marks?: number
          mcq_correct?: string | null
          mcq_options?: Json | null
          output_format?: string | null
          question_order?: number
          question_type: string
          sample_input?: string | null
          sample_output?: string | null
          starter_code?: string | null
          test_cases?: Json
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          difficulty?: string
          hints?: string | null
          homework_id?: string
          id?: string
          input_format?: string | null
          marks?: number
          mcq_correct?: string | null
          mcq_options?: Json | null
          output_format?: string | null
          question_order?: number
          question_type?: string
          sample_input?: string | null
          sample_output?: string | null
          starter_code?: string | null
          test_cases?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_questions_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homework"
            referencedColumns: ["id"]
          },
        ]
      }
      homework_submissions: {
        Row: {
          checked_at: string | null
          checked_by: string | null
          created_at: string
          homework_id: string
          id: string
          is_late: boolean
          status: string
          student_id: string
          submitted_at: string | null
          teacher_feedback: string | null
          total_marks_obtained: number | null
          updated_at: string
        }
        Insert: {
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          homework_id: string
          id?: string
          is_late?: boolean
          status?: string
          student_id: string
          submitted_at?: string | null
          teacher_feedback?: string | null
          total_marks_obtained?: number | null
          updated_at?: string
        }
        Update: {
          checked_at?: string | null
          checked_by?: string | null
          created_at?: string
          homework_id?: string
          id?: string
          is_late?: boolean
          status?: string
          student_id?: string
          submitted_at?: string | null
          teacher_feedback?: string | null
          total_marks_obtained?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "homework_submissions_homework_id_fkey"
            columns: ["homework_id"]
            isOneToOne: false
            referencedRelation: "homework"
            referencedColumns: ["id"]
          },
        ]
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
          details: Json | null
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
          details?: Json | null
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
          details?: Json | null
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
      practice_questions: {
        Row: {
          created_at: string
          created_by: string | null
          difficulty: string | null
          hint: string | null
          id: string
          marks: number
          prompt: string
          solution: string | null
          starter_code: string
          status: string
          tests: Json
          title: string
          unit: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          difficulty?: string | null
          hint?: string | null
          id?: string
          marks?: number
          prompt: string
          solution?: string | null
          starter_code?: string
          status?: string
          tests?: Json
          title: string
          unit: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          difficulty?: string | null
          hint?: string | null
          id?: string
          marks?: number
          prompt?: string
          solution?: string | null
          starter_code?: string
          status?: string
          tests?: Json
          title?: string
          unit?: number
          updated_at?: string
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
          presence_status: string
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
          presence_status?: string
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
          presence_status?: string
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
      pyko_assessment_sessions: {
        Row: {
          assessment_id: string
          assessment_type: string
          completed_at: string | null
          expires_at: string | null
          id: string
          last_activity_at: string
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          assessment_id: string
          assessment_type: string
          completed_at?: string | null
          expires_at?: string | null
          id?: string
          last_activity_at?: string
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          assessment_id?: string
          assessment_type?: string
          completed_at?: string | null
          expires_at?: string | null
          id?: string
          last_activity_at?: string
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      pyko_budget_counters: {
        Row: {
          day: string
          minute_bucket: string | null
          minute_count: number
          request_count: number
          token_count: number
          tokens_in: number
          tokens_out: number
          updated_at: string
          user_id: string
        }
        Insert: {
          day: string
          minute_bucket?: string | null
          minute_count?: number
          request_count?: number
          token_count?: number
          tokens_in?: number
          tokens_out?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          day?: string
          minute_bucket?: string | null
          minute_count?: number
          request_count?: number
          token_count?: number
          tokens_in?: number
          tokens_out?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pyko_conversations: {
        Row: {
          archived: boolean
          created_at: string
          id: string
          mode: string
          page_context: Json
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          id?: string
          mode: string
          page_context?: Json
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          id?: string
          mode?: string
          page_context?: Json
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pyko_feature_flags: {
        Row: {
          config: Json
          description: string | null
          enabled: boolean
          key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config?: Json
          description?: string | null
          enabled?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config?: Json
          description?: string | null
          enabled?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      pyko_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          feedback: string | null
          id: string
          latency_ms: number | null
          mode: string
          model: string | null
          prompt_version: string | null
          role: string
          safe_source_ids: Json | null
          tool_calls: Json | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          feedback?: string | null
          id?: string
          latency_ms?: number | null
          mode: string
          model?: string | null
          prompt_version?: string | null
          role: string
          safe_source_ids?: Json | null
          tool_calls?: Json | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          feedback?: string | null
          id?: string
          latency_ms?: number | null
          mode?: string
          model?: string | null
          prompt_version?: string | null
          role?: string
          safe_source_ids?: Json | null
          tool_calls?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pyko_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "pyko_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      pyko_telemetry: {
        Row: {
          created_at: string
          error_message: string | null
          feedback_status: string | null
          id: string
          latency_ms: number | null
          mode: string
          model: string | null
          prompt_version: string | null
          provider: string | null
          response_status: string | null
          safe_source_ids: Json | null
          tool_names: string[] | null
          trace_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          feedback_status?: string | null
          id?: string
          latency_ms?: number | null
          mode: string
          model?: string | null
          prompt_version?: string | null
          provider?: string | null
          response_status?: string | null
          safe_source_ids?: Json | null
          tool_names?: string[] | null
          trace_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          feedback_status?: string | null
          id?: string
          latency_ms?: number | null
          mode?: string
          model?: string | null
          prompt_version?: string | null
          provider?: string | null
          response_status?: string | null
          safe_source_ids?: Json | null
          tool_names?: string[] | null
          trace_id?: string
          user_id?: string | null
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
      student_badges: {
        Row: {
          badge_id: string
          created_at: string
          earned_at: string
          id: string
          metric_value: number | null
          source_id: string | null
          source_type: string | null
          student_id: string
          trigger_activity: string | null
        }
        Insert: {
          badge_id: string
          created_at?: string
          earned_at?: string
          id?: string
          metric_value?: number | null
          source_id?: string | null
          source_type?: string | null
          student_id: string
          trigger_activity?: string | null
        }
        Update: {
          badge_id?: string
          created_at?: string
          earned_at?: string
          id?: string
          metric_value?: number | null
          source_id?: string | null
          source_type?: string | null
          student_id?: string
          trigger_activity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      student_streaks: {
        Row: {
          created_at: string
          current_streak: number
          id: string
          last_activity_date: string | null
          last_freeze_grant_month: string | null
          last_freeze_used_at: string | null
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
          last_freeze_grant_month?: string | null
          last_freeze_used_at?: string | null
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
          last_freeze_grant_month?: string | null
          last_freeze_used_at?: string | null
          longest_streak?: number
          streak_freezes_available?: number
          streak_freezes_used?: number
          today_completed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      system_health_logs: {
        Row: {
          category: string
          created_at: string
          device_info: Json | null
          duration_ms: number | null
          error_details: Json | null
          error_message: string
          id: string
          module_name: string | null
          page_route: string | null
          resolved_at: string | null
          resolved_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          severity: string
          status: string
          status_code: number | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          category: string
          created_at?: string
          device_info?: Json | null
          duration_ms?: number | null
          error_details?: Json | null
          error_message: string
          id?: string
          module_name?: string | null
          page_route?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          status?: string
          status_code?: number | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          device_info?: Json | null
          duration_ms?: number | null
          error_details?: Json | null
          error_message?: string
          id?: string
          module_name?: string | null
          page_route?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          severity?: string
          status?: string
          status_code?: number | null
          user_email?: string | null
          user_id?: string | null
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
      admin_badge_overview: { Args: never; Returns: Json }
      admin_resend_announcement: {
        Args: { _id: string; _scheduled_at?: string }
        Returns: undefined
      }
      assign_user_role: {
        Args: {
          _action?: string
          _role: Database["public"]["Enums"]["app_role"]
          _target_user: string
        }
        Returns: undefined
      }
      compute_badge_metrics: {
        Args: { _user_id: string }
        Returns: {
          all_rounder: boolean
          bug_hunter_count: number
          clean_sweep_count: number
          comeback: boolean
          diff_mix: number
          distinct_units: number
          first_activity: number
          first_code_run: number
          hard_solved: number
          homework_complete: number
          homework_correction: number
          homework_early: number
          homework_on_time: number
          homework_perfect: number
          longest_streak: number
          mock_best: number
          mock_count: number
          mock_improve_15: number
          mock_personal_best: boolean
          mock_rising: number
          never_give_up: boolean
          practice_solved: number
          tests_passed: number
        }[]
      }
      evaluate_and_award_badges: {
        Args: { _event_type?: string }
        Returns: {
          badge_key: string
          badge_name: string
          description: string
          earned_at: string
          icon: string
        }[]
      }
      generate_public_profile_id: { Args: never; Returns: string }
      generate_student_unique_id: { Args: never; Returns: string }
      get_badge_progress: {
        Args: { _user_id?: string }
        Returns: {
          badge_key: string
          badge_name: string
          category: string
          current_value: number
          description: string
          earned: boolean
          earned_at: string
          icon: string
          is_secret: boolean
          motivational_message: string
          progress_pct: number
          rarity: string
          sort_order: number
          target_value: number
          tier: string
          unlock_hint: string
        }[]
      }
      get_next_badge_targets: {
        Args: { _limit?: number }
        Returns: {
          badge_key: string
          badge_name: string
          category: string
          current_value: number
          icon: string
          motivational_message: string
          progress_pct: number
          target_value: number
          tier: string
          unlock_hint: string
        }[]
      }
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
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      list_badges_for_student: {
        Args: { _student_id: string }
        Returns: {
          badge_key: string
          badge_name: string
          description: string
          earned: boolean
          earned_at: string
          icon: string
          rule_type: string
          sort_order: number
          threshold: number
        }[]
      }
      log_admin_activity: {
        Args: {
          _action_description: string
          _action_type: string
          _metadata?: Json
          _module_name: string
          _new_value?: Json
          _old_value?: Json
          _related_student_id?: string
          _status?: string
          _target_id?: string
          _target_title?: string
        }
        Returns: string
      }
      log_system_health_event: {
        Args: {
          _category: string
          _device_info?: Json
          _duration_ms?: number
          _error_details?: Json
          _error_message: string
          _module_name?: string
          _page_route?: string
          _severity?: string
          _status_code?: number
          _user_email?: string
        }
        Returns: string
      }
      pyko_end_assessment: {
        Args: { _assessment_id: string; _reason?: string }
        Returns: undefined
      }
      pyko_has_active_assessment: {
        Args: { _user_id: string }
        Returns: boolean
      }
      pyko_start_assessment: {
        Args: {
          _assessment_id: string
          _duration_minutes?: number
          _type: string
        }
        Returns: string
      }
      pyko_touch_budget: {
        Args: {
          _day: string
          _limit: number
          _per_minute_limit: number
          _user_id: string
        }
        Returns: {
          allowed: boolean
          per_minute_used: number
          reason: string
          used: number
        }[]
      }
      record_streak_activity: {
        Args: { _activity_type: string; _reference_id?: string }
        Returns: {
          current_streak: number
          freeze_used: boolean
          freezes_available: number
          is_new_day: boolean
          longest_streak: number
          today_completed: boolean
        }[]
      }
      reset_teacher_dashboard_data: { Args: never; Returns: Json }
      system_health_summary: {
        Args: never
        Returns: {
          category: string
          count_7d: number
          count_today: number
          critical_today: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "student" | "teacher" | "super_admin"
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
      app_role: ["admin", "student", "teacher", "super_admin"],
    },
  },
} as const
