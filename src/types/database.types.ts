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
    PostgrestVersion: "14.4"
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
      account_profiles: {
        Row: {
          created_at: string
          email: string | null
          managed_by_teacher_id: number | null
          role: string
          user_id: string
          username: string | null
          username_key: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          managed_by_teacher_id?: number | null
          role: string
          user_id: string
          username?: string | null
          username_key?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          managed_by_teacher_id?: number | null
          role?: string
          user_id?: string
          username?: string | null
          username_key?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "account_profiles_managed_by_teacher_id_fkey"
            columns: ["managed_by_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      admins: {
        Row: {
          admin_id: number
          created_at: string
          email: string | null
          user_id: string
        }
        Insert: {
          admin_id?: never
          created_at?: string
          email?: string | null
          user_id: string
        }
        Update: {
          admin_id?: never
          created_at?: string
          email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      quiz_answers: {
        Row: {
          attempt_id: string | null
          created_at: string
          participant_username: string
          question_id: string
          session_id: string
          user_answer: string
        }
        Insert: {
          attempt_id?: string | null
          created_at?: string
          participant_username: string
          question_id: string
          session_id: string
          user_answer: string
        }
        Update: {
          attempt_id?: string | null
          created_at?: string
          participant_username?: string
          question_id?: string
          session_id?: string
          user_answer?: string
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          account_id: string | null
          attempt_id: string
          attempt_number: number
          created_at: string
          participant_username: string
          session_id: string
        }
        Insert: {
          account_id?: string | null
          attempt_id?: string
          attempt_number: number
          created_at?: string
          participant_username: string
          session_id: string
        }
        Update: {
          account_id?: string | null
          attempt_id?: string
          attempt_number?: number
          created_at?: string
          participant_username?: string
          session_id?: string
        }
        Relationships: []
      }
      quiz_questions: {
        Row: {
          choices: Json
          correct_answer: string
          created_at: string | null
          id: number
          question_id: string
          question_text: string
          session_id: string
        }
        Insert: {
          choices: Json
          correct_answer: string
          created_at?: string | null
          id?: number
          question_id: string
          question_text: string
          session_id: string
        }
        Update: {
          choices?: Json
          correct_answer?: string
          created_at?: string | null
          id?: number
          question_id?: string
          question_text?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "quiz_sessions"
            referencedColumns: ["session_id"]
          },
        ]
      }
      quiz_results: {
        Row: {
          account_id: string | null
          answered_count: number
          attempt_id: string
          attempt_number: number
          completed_at: string
          correct_count: number
          final_score: string | null
          participant_username: string
          percentage: number
          recorded_at: string
          session_id: string
          share_code: string | null
          started_at: string
          teacher_id: string | null
          teacher_username: string | null
          title: string
          total_questions: number
        }
        Insert: {
          account_id?: string | null
          answered_count: number
          attempt_id: string
          attempt_number: number
          completed_at: string
          correct_count: number
          final_score?: string | null
          participant_username: string
          percentage: number
          recorded_at?: string
          session_id: string
          share_code?: string | null
          started_at: string
          teacher_id?: string | null
          teacher_username?: string | null
          title: string
          total_questions: number
        }
        Update: {
          account_id?: string | null
          answered_count?: number
          attempt_id?: string
          attempt_number?: number
          completed_at?: string
          correct_count?: number
          final_score?: string | null
          participant_username?: string
          percentage?: number
          recorded_at?: string
          session_id?: string
          share_code?: string | null
          started_at?: string
          teacher_id?: string | null
          teacher_username?: string | null
          title?: string
          total_questions?: number
        }
        Relationships: []
      }
      quiz_sessions: {
        Row: {
          created_at: string | null
          error_message: string | null
          game_mode: string | null
          is_time_attack: boolean | null
          max_attempts: number | null
          requested_question_count: number | null
          revision: number
          session_id: string
          share_code: string | null
          status: string
          teacher_id: string | null
          teacher_username: string | null
          time_attack_seconds: number | null
          title: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          game_mode?: string | null
          is_time_attack?: boolean | null
          max_attempts?: number | null
          requested_question_count?: number | null
          revision?: number
          session_id: string
          share_code?: string | null
          status?: string
          teacher_id?: string | null
          teacher_username?: string | null
          time_attack_seconds?: number | null
          title?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          game_mode?: string | null
          is_time_attack?: boolean | null
          max_attempts?: number | null
          requested_question_count?: number | null
          revision?: number
          session_id?: string
          share_code?: string | null
          status?: string
          teacher_id?: string | null
          teacher_username?: string | null
          time_attack_seconds?: number | null
          title?: string | null
        }
        Relationships: []
      }
      quizzes: {
        Row: {
          created_at: string
          error_message: string | null
          game_mode: string
          is_time_attack: boolean
          max_attempts: number | null
          requested_question_count: number | null
          revision: number
          session_id: string
          share_code: string | null
          status: string
          teacher_id: number | null
          time_attack_seconds: number | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          game_mode?: string
          is_time_attack?: boolean
          max_attempts?: number | null
          requested_question_count?: number | null
          revision?: number
          session_id: string
          share_code?: string | null
          status?: string
          teacher_id?: number | null
          time_attack_seconds?: number | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          game_mode?: string
          is_time_attack?: boolean
          max_attempts?: number | null
          requested_question_count?: number | null
          revision?: number
          session_id?: string
          share_code?: string | null
          status?: string
          teacher_id?: number | null
          time_attack_seconds?: number | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          created_at: string
          id: number
          session_id: string
          username: string
        }
        Insert: {
          created_at?: string
          id?: never
          session_id: string
          username: string
        }
        Update: {
          created_at?: string
          id?: never
          session_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["session_id"]
          },
        ]
      }
      teachers: {
        Row: {
          created_at: string
          email: string | null
          id: number
          school_id: string | null
          status: string
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: never
          school_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: never
          school_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      user_answers: {
        Row: {
          id: number
          question_id: string
          session_id: string
          submitted_at: string | null
          user_answer_index: string
        }
        Insert: {
          id?: number
          question_id: string
          session_id: string
          submitted_at?: string | null
          user_answer_index: string
        }
        Update: {
          id?: number
          question_id?: string
          session_id?: string
          submitted_at?: string | null
          user_answer_index?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_answers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "quiz_sessions"
            referencedColumns: ["session_id"]
          },
        ]
      }
    }
    Views: {
      my_quiz_history: {
        Row: {
          answered_count: number | null
          attempt_id: string | null
          attempt_number: number | null
          completed_at: string | null
          correct_count: number | null
          duration_seconds: number | null
          final_score: string | null
          percentage: number | null
          quiz_title: string | null
          session_id: string | null
          started_at: string | null
          total_questions: number | null
        }
        Insert: {
          answered_count?: number | null
          attempt_id?: string | null
          attempt_number?: number | null
          completed_at?: string | null
          correct_count?: number | null
          duration_seconds?: never
          final_score?: string | null
          percentage?: number | null
          quiz_title?: string | null
          session_id?: string | null
          started_at?: string | null
          total_questions?: number | null
        }
        Update: {
          answered_count?: number | null
          attempt_id?: string | null
          attempt_number?: number | null
          completed_at?: string | null
          correct_count?: number | null
          duration_seconds?: never
          final_score?: string | null
          percentage?: number | null
          quiz_title?: string | null
          session_id?: string | null
          started_at?: string | null
          total_questions?: number | null
        }
        Relationships: []
      }
      teacher_student_scores: {
        Row: {
          answered_count: number | null
          attempt_id: string | null
          attempt_number: number | null
          completed_at: string | null
          correct_count: number | null
          duration_seconds: number | null
          final_score: string | null
          percentage: number | null
          quiz_title: string | null
          session_id: string | null
          started_at: string | null
          student_email: string | null
          student_user_id: string | null
          student_username: string | null
          total_questions: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      current_teacher_id: { Args: never; Returns: number }
      finalize_quiz_result: {
        Args: { p_attempt_id: string }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      norm_answer: { Args: { t: string }; Returns: string }
      normalized_quiz_title: { Args: { value: string }; Returns: string }
      owns_quiz: { Args: { p_session_id: string }; Returns: boolean }
      publish_generated_quiz: {
        Args: { p_questions: Json; p_session_id: string }
        Returns: undefined
      }
      start_account_quiz_attempt: {
        Args: { p_account_id: string; p_session_id: string; p_username: string }
        Returns: Json
      }
      teacher_can_view_account: {
        Args: { p_user_id: string }
        Returns: boolean
      }
      teacher_manages_account: { Args: { p_user_id: string }; Returns: boolean }
      teacher_quiz_results: {
        Args: {
          p_include_teacher?: boolean
          p_session_id?: string
          p_teacher_id: string
        }
        Returns: {
          answered_count: number
          attempt_id: string
          attempt_number: number
          completed: boolean
          correct_count: number
          participant_username: string
          percentage: number
          quiz_title: string
          session_id: string
          share_code: string
          started_at: string
          total_questions: number
        }[]
      }
      teacher_review_quiz: {
        Args: {
          p_action: string
          p_session_id?: string
          p_teacher_id: string
          p_values?: Json
        }
        Returns: Json
      }
      valid_review_question: {
        Args: { item: Json; mode: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
