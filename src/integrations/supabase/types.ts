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
          badge_color: string
          badge_icon: string
          created_at: string | null
          created_by: string
          criteria: Json
          description: string
          id: string
          is_active: boolean
          name: string
          points: number
          tournament_id: string
          type: Database["public"]["Enums"]["achievement_type"]
          updated_at: string | null
        }
        Insert: {
          badge_color: string
          badge_icon: string
          created_at?: string | null
          created_by: string
          criteria: Json
          description: string
          id?: string
          is_active?: boolean
          name: string
          points?: number
          tournament_id: string
          type: Database["public"]["Enums"]["achievement_type"]
          updated_at?: string | null
        }
        Update: {
          badge_color?: string
          badge_icon?: string
          created_at?: string | null
          created_by?: string
          criteria?: Json
          description?: string
          id?: string
          is_active?: boolean
          name?: string
          points?: number
          tournament_id?: string
          type?: Database["public"]["Enums"]["achievement_type"]
          updated_at?: string | null
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
      achievements_backup_20240910: {
        Row: {
          badge_color: string | null
          badge_icon: string | null
          created_at: string | null
          criteria: Json | null
          description: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          points: number | null
          tournament_id: string | null
          type: Database["public"]["Enums"]["achievement_type"] | null
          updated_at: string | null
        }
        Insert: {
          badge_color?: string | null
          badge_icon?: string | null
          created_at?: string | null
          criteria?: Json | null
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          points?: number | null
          tournament_id?: string | null
          type?: Database["public"]["Enums"]["achievement_type"] | null
          updated_at?: string | null
        }
        Update: {
          badge_color?: string | null
          badge_icon?: string | null
          created_at?: string | null
          criteria?: Json | null
          description?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          points?: number | null
          tournament_id?: string | null
          type?: Database["public"]["Enums"]["achievement_type"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      competition_games: {
        Row: {
          competition_id: string | null
          created_at: string | null
          game_logo_url: string | null
          game_name: string
          id: string
          tournament_id: string
        }
        Insert: {
          competition_id?: string | null
          created_at?: string | null
          game_logo_url?: string | null
          game_name: string
          id?: string
          tournament_id: string
        }
        Update: {
          competition_id?: string | null
          created_at?: string | null
          game_logo_url?: string | null
          game_name?: string
          id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_games_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competition_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_games_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_history: {
        Row: {
          competition_name: string
          created_at: string | null
          end_date: string
          id: string
          start_date: string
          total_games: number
          total_players: number
          total_scores: number
          tournament_id: string
          updated_at: string | null
        }
        Insert: {
          competition_name: string
          created_at?: string | null
          end_date: string
          id?: string
          start_date: string
          total_games?: number
          total_players?: number
          total_scores?: number
          tournament_id: string
          updated_at?: string | null
        }
        Update: {
          competition_name?: string
          created_at?: string | null
          end_date?: string
          id?: string
          start_date?: string
          total_games?: number
          total_players?: number
          total_scores?: number
          tournament_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_history_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_players: {
        Row: {
          best_rank: number | null
          competition_id: string | null
          created_at: string | null
          final_rank: number | null
          games_played: number
          id: string
          player_name: string
          total_ranking_points: number
          total_score: number
          tournament_id: string
        }
        Insert: {
          best_rank?: number | null
          competition_id?: string | null
          created_at?: string | null
          final_rank?: number | null
          games_played?: number
          id?: string
          player_name: string
          total_ranking_points?: number
          total_score?: number
          tournament_id: string
        }
        Update: {
          best_rank?: number | null
          competition_id?: string | null
          created_at?: string | null
          final_rank?: number | null
          games_played?: number
          id?: string
          player_name?: string
          total_ranking_points?: number
          total_score?: number
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_players_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competition_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_players_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_scores: {
        Row: {
          competition_id: string | null
          created_at: string | null
          game_name: string
          id: string
          player_name: string
          rank_in_game: number | null
          ranking_points: number | null
          score: number
          tournament_id: string
        }
        Insert: {
          competition_id?: string | null
          created_at?: string | null
          game_name: string
          id?: string
          player_name: string
          rank_in_game?: number | null
          ranking_points?: number | null
          score: number
          tournament_id: string
        }
        Update: {
          competition_id?: string | null
          created_at?: string | null
          game_name?: string
          id?: string
          player_name?: string
          rank_in_game?: number | null
          ranking_points?: number | null
          score?: number
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competition_scores_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competition_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_scores_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
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
          tournament_id: string
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
          tournament_id: string
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
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "games_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      player_achievements: {
        Row: {
          achievement_id: string
          created_at: string | null
          id: string
          player_name: string
          score_id: string | null
          tournament_id: string | null
          unlocked_at: string | null
          user_id: string | null
        }
        Insert: {
          achievement_id: string
          created_at?: string | null
          id?: string
          player_name: string
          score_id?: string | null
          tournament_id?: string | null
          unlocked_at?: string | null
          user_id?: string | null
        }
        Update: {
          achievement_id?: string
          created_at?: string | null
          id?: string
          player_name?: string
          score_id?: string | null
          tournament_id?: string | null
          unlocked_at?: string | null
          user_id?: string | null
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
            foreignKeyName: "player_achievements_score_id_fkey"
            columns: ["score_id"]
            isOneToOne: false
            referencedRelation: "scores"
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
      player_stats: {
        Row: {
          created_at: string | null
          current_streak: number
          first_place_count: number
          highest_score: number
          id: string
          last_score_date: string | null
          longest_streak: number
          player_name: string
          total_competitions: number
          total_games_played: number
          total_scores: number
          tournament_id: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          current_streak?: number
          first_place_count?: number
          highest_score?: number
          id?: string
          last_score_date?: string | null
          longest_streak?: number
          player_name: string
          total_competitions?: number
          total_games_played?: number
          total_scores?: number
          tournament_id: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          current_streak?: number
          first_place_count?: number
          highest_score?: number
          id?: string
          last_score_date?: string | null
          longest_streak?: number
          player_name?: string
          total_competitions?: number
          total_games_played?: number
          total_scores?: number
          tournament_id?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_stats_tournament_id_fkey"
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
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      role_audit_log: {
        Row: {
          action: string
          changed_by: string | null
          created_at: string
          id: string
          new_role: Database["public"]["Enums"]["app_role"] | null
          old_role: Database["public"]["Enums"]["app_role"] | null
          user_id: string
        }
        Insert: {
          action: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_role?: Database["public"]["Enums"]["app_role"] | null
          old_role?: Database["public"]["Enums"]["app_role"] | null
          user_id: string
        }
        Update: {
          action?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          new_role?: Database["public"]["Enums"]["app_role"] | null
          old_role?: Database["public"]["Enums"]["app_role"] | null
          user_id?: string
        }
        Relationships: []
      }
      score_submission_rate_limit: {
        Row: {
          created_at: string
          id: string
          ip_address: unknown | null
          submission_count: number
          user_id: string | null
          window_start: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address?: unknown | null
          submission_count?: number
          user_id?: string | null
          window_start?: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: unknown | null
          submission_count?: number
          user_id?: string | null
          window_start?: string
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
          tournament_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          player_name: string
          score: number
          tournament_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          player_name?: string
          score?: number
          tournament_id?: string
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
          {
            foreignKeyName: "scores_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      signup_trigger_logs: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      tournament_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["tournament_role"]
          token: string
          tournament_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string | null
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["tournament_role"]
          token: string
          tournament_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["tournament_role"]
          token?: string
          tournament_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_invitations_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_members: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean
          joined_at: string | null
          role: Database["public"]["Enums"]["tournament_role"]
          tournament_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          joined_at?: string | null
          role?: Database["public"]["Enums"]["tournament_role"]
          tournament_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          joined_at?: string | null
          role?: Database["public"]["Enums"]["tournament_role"]
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
          created_at: string | null
          created_by: string | null
          demolition_man_active: boolean | null
          description: string | null
          id: string
          is_public: boolean
          name: string
          scores_locked: boolean
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          demolition_man_active?: boolean | null
          description?: string | null
          id?: string
          is_public?: boolean
          name: string
          scores_locked?: boolean
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          demolition_man_active?: boolean | null
          description?: string | null
          id?: string
          is_public?: boolean
          name?: string
          scores_locked?: boolean
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      webhook_config: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          events: string[] | null
          id: string
          platform: string
          updated_at: string | null
          user_id: string
          webhook_url: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          events?: string[] | null
          id?: string
          platform: string
          updated_at?: string | null
          user_id: string
          webhook_url?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          events?: string[] | null
          id?: string
          platform?: string
          updated_at?: string | null
          user_id?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      webhook_config_backup: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          events: string[] | null
          id: string
          platform: string
          updated_at: string | null
          webhook_url: string | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          events?: string[] | null
          id?: string
          platform: string
          updated_at?: string | null
          webhook_url?: string | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          events?: string[] | null
          id?: string
          platform?: string
          updated_at?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_achievement_name_constraint: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      archive_current_competition: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      check_and_award_achievements: {
        Args: {
          p_game_id: string
          p_is_first_place?: boolean
          p_player_name: string
          p_score: number
        }
        Returns: Json
      }
      check_and_award_achievements_for_player: {
        Args:
          | {
              p_game_id: string
              p_is_first_place?: boolean
              p_player_name: string
              p_score: number
              p_score_id?: string
              p_tournament_id: string
            }
          | {
              p_game_id: string
              p_is_first_place?: boolean
              p_player_name: string
              p_score: number
              p_tournament_id: string
            }
        Returns: Json
      }
      check_and_award_achievements_for_user: {
        Args:
          | {
              p_game_id: string
              p_is_first_place?: boolean
              p_player_name: string
              p_score: number
              p_score_id?: string
              p_tournament_id: string
              p_user_id: string
            }
          | {
              p_game_id: string
              p_is_first_place?: boolean
              p_player_name: string
              p_score: number
              p_tournament_id: string
              p_user_id: string
            }
        Returns: Json
      }
      check_score_submission_rate_limit: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      create_default_achievements_for_tournament: {
        Args: { p_tournament_id: string }
        Returns: undefined
      }
      create_tournament_achievement: {
        Args: {
          p_badge_color?: string
          p_badge_icon?: string
          p_criteria?: Json
          p_description: string
          p_name: string
          p_points?: number
          p_tournament_id: string
          p_type: Database["public"]["Enums"]["achievement_type"]
        }
        Returns: string
      }
      delete_tournament_achievement: {
        Args: { p_achievement_id: string }
        Returns: boolean
      }
      ensure_demolition_man_game: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      find_duplicate_achievements: {
        Args: Record<PropertyKey, never>
        Returns: {
          count: number
          name: string
          tournament_id: string
        }[]
      }
      get_public_username: {
        Args: { user_uuid: string }
        Returns: string
      }
      get_recent_achievements: {
        Args: { p_player_name: string; p_since_minutes?: number }
        Returns: {
          achievement_description: string
          achievement_id: string
          achievement_name: string
          badge_color: string
          badge_icon: string
          points: number
          unlocked_at: string
        }[]
      }
      get_recent_achievements_by_tournament: {
        Args: {
          p_player_name: string
          p_since_minutes?: number
          p_tournament_id: string
        }
        Returns: {
          achievement_description: string
          achievement_id: string
          achievement_name: string
          badge_color: string
          badge_icon: string
          points: number
          unlocked_at: string
        }[]
      }
      get_recent_achievements_for_user: {
        Args: {
          p_since_minutes?: number
          p_tournament_id: string
          p_user_id: string
        }
        Returns: {
          achievement_description: string
          achievement_id: string
          achievement_name: string
          badge_color: string
          badge_icon: string
          points: number
          unlocked_at: string
        }[]
      }
      get_tournament_achievements: {
        Args: { p_tournament_id: string }
        Returns: {
          badge_color: string
          badge_icon: string
          created_at: string | null
          created_by: string
          criteria: Json
          description: string
          id: string
          is_active: boolean
          name: string
          points: number
          tournament_id: string
          type: Database["public"]["Enums"]["achievement_type"]
          updated_at: string | null
        }[]
      }
      get_user_role: {
        Args: { user_id: string }
        Returns: string
      }
      get_user_tournament_role: {
        Args: { tournament_id: string; user_id: string }
        Returns: Database["public"]["Enums"]["tournament_role"]
      }
      initialize_user_webhooks: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      is_admin: {
        Args: { user_id: string }
        Returns: boolean
      }
      is_tournament_member: {
        Args: { p_roles?: string[]; p_tournament: string; p_user: string }
        Returns: boolean
      }
      populate_default_achievements: {
        Args: { p_tournament_id: string }
        Returns: undefined
      }
      update_tournament_achievement: {
        Args: {
          p_achievement_id: string
          p_badge_color?: string
          p_badge_icon?: string
          p_criteria?: Json
          p_description?: string
          p_is_active?: boolean
          p_name?: string
          p_points?: number
        }
        Returns: boolean
      }
      update_user_webhook_config: {
        Args: {
          p_enabled?: boolean
          p_platform: string
          p_user_id: string
          p_webhook_url: string
        }
        Returns: undefined
      }
      update_webhook_config: {
        Args: { p_enabled?: boolean; p_platform: string; p_webhook_url: string }
        Returns: undefined
      }
      user_is_member: {
        Args: { p_tournament_id: string }
        Returns: boolean
      }
    }
    Enums: {
      achievement_type:
        | "first_score"
        | "first_place"
        | "score_milestone"
        | "game_master"
        | "streak_master"
        | "competition_winner"
        | "high_scorer"
        | "consistent_player"
        | "speed_demon"
        | "perfectionist"
      app_role: "admin" | "user"
      tournament_role: "owner" | "admin" | "member"
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
      achievement_type: [
        "first_score",
        "first_place",
        "score_milestone",
        "game_master",
        "streak_master",
        "competition_winner",
        "high_scorer",
        "consistent_player",
        "speed_demon",
        "perfectionist",
      ],
      app_role: ["admin", "user"],
      tournament_role: ["owner", "admin", "member"],
    },
  },
} as const
