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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          points: number
          tournament_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          points?: number
          tournament_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          points?: number
          tournament_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "achievements_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          created_at: string | null
          is_admin: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          is_admin?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          is_admin?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      bracket_matches: {
        Row: {
          competition_id: string
          created_at: string
          id: string
          participant1_id: string | null
          participant2_id: string | null
          position: number
          reported_at: string | null
          reported_by: string | null
          round: number
          status: string
          updated_at: string
          winner_participant_id: string | null
        }
        Insert: {
          competition_id: string
          created_at?: string
          id?: string
          participant1_id?: string | null
          participant2_id?: string | null
          position: number
          reported_at?: string | null
          reported_by?: string | null
          round: number
          status?: string
          updated_at?: string
          winner_participant_id?: string | null
        }
        Update: {
          competition_id?: string
          created_at?: string
          id?: string
          participant1_id?: string | null
          participant2_id?: string | null
          position?: number
          reported_at?: string | null
          reported_by?: string | null
          round?: number
          status?: string
          updated_at?: string
          winner_participant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bracket_matches_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "bracket_tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bracket_matches_participant1_id_fkey"
            columns: ["participant1_id"]
            isOneToOne: false
            referencedRelation: "bracket_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bracket_matches_participant2_id_fkey"
            columns: ["participant2_id"]
            isOneToOne: false
            referencedRelation: "bracket_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bracket_matches_winner_participant_id_fkey"
            columns: ["winner_participant_id"]
            isOneToOne: false
            referencedRelation: "bracket_participants"
            referencedColumns: ["id"]
          },
        ]
      }
      bracket_participants: {
        Row: {
          competition_id: string
          created_at: string
          display_name: string
          id: string
          seed: number | null
          user_id: string | null
        }
        Insert: {
          competition_id: string
          created_at?: string
          display_name: string
          id?: string
          seed?: number | null
          user_id?: string | null
        }
        Update: {
          competition_id?: string
          created_at?: string
          display_name?: string
          id?: string
          seed?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bracket_participants_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "bracket_tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      bracket_tournaments: {
        Row: {
          bracket_type: string
          created_at: string
          created_by: string
          id: string
          is_locked: boolean
          is_public: boolean
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          bracket_type?: string
          created_at?: string
          created_by: string
          id?: string
          is_locked?: boolean
          is_public?: boolean
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          bracket_type?: string
          created_at?: string
          created_by?: string
          id?: string
          is_locked?: boolean
          is_public?: boolean
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      games: {
        Row: {
          created_at: string
          description: string | null
          id: string
          include_in_challenge: boolean
          is_active: boolean
          logo_url: string | null
          name: string
          tournament_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          include_in_challenge?: boolean
          is_active?: boolean
          logo_url?: string | null
          name: string
          tournament_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          include_in_challenge?: boolean
          is_active?: boolean
          logo_url?: string | null
          name?: string
          tournament_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      player_achievements: {
        Row: {
          achievement_id: string
          created_at: string
          earned_at: string
          id: string
          player_name: string
          tournament_id: string | null
        }
        Insert: {
          achievement_id: string
          created_at?: string
          earned_at?: string
          id?: string
          player_name: string
          tournament_id?: string | null
        }
        Update: {
          achievement_id?: string
          created_at?: string
          earned_at?: string
          id?: string
          player_name?: string
          tournament_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_achievements_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      scores: {
        Row: {
          created_at: string
          game_id: string
          id: string
          player_name: string
          score: number
          tournament_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          player_name: string
          score: number
          tournament_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          player_name?: string
          score?: number
          tournament_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scores_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_members: {
        Row: {
          id: string
          is_active: boolean | null
          joined_at: string | null
          role: string
          tournament_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          id?: string
          is_active?: boolean | null
          joined_at?: string | null
          role?: string
          tournament_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          id?: string
          is_active?: boolean | null
          joined_at?: string | null
          role?: string
          tournament_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_members_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          is_public: boolean
          name: string
          scores_locked: boolean
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_public?: boolean
          name: string
          scores_locked?: boolean
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          is_public?: boolean
          name?: string
          scores_locked?: boolean
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_role_cache: {
        Row: {
          is_admin: boolean
          last_updated: string | null
          user_id: string
        }
        Insert: {
          is_admin?: boolean
          last_updated?: string | null
          user_id: string
        }
        Update: {
          is_admin?: boolean
          last_updated?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_user_role_access: {
        Args: { check_user_id: string }
        Returns: boolean
      }
      get_auth_user_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_current_user: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      is_admin: {
        Args: { check_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
