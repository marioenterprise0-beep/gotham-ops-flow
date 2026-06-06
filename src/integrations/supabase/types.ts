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
      access_log: {
        Row: {
          created_at: string
          event: string
          id: string
          ip: string | null
          payload: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          ip?: string | null
          payload?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          ip?: string | null
          payload?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          payload: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          payload?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          payload?: Json | null
        }
        Relationships: []
      }
      hospitality_incidents: {
        Row: {
          id: string
          logged_at: string
          logged_by: string | null
          notes: string | null
          recovery_action: string | null
          severity: Database["public"]["Enums"]["incident_severity"]
          shift_id: string | null
          trailer_id: string | null
          type: string
        }
        Insert: {
          id?: string
          logged_at?: string
          logged_by?: string | null
          notes?: string | null
          recovery_action?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          shift_id?: string | null
          trailer_id?: string | null
          type: string
        }
        Update: {
          id?: string
          logged_at?: string
          logged_by?: string | null
          notes?: string | null
          recovery_action?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          shift_id?: string | null
          trailer_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "hospitality_incidents_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_counts: {
        Row: {
          count_qty: number
          counted_at: string
          counted_by: string | null
          expected_qty: number | null
          id: string
          item_id: string
          shift_id: string | null
          trailer_id: string | null
          variance: number | null
        }
        Insert: {
          count_qty: number
          counted_at?: string
          counted_by?: string | null
          expected_qty?: number | null
          id?: string
          item_id: string
          shift_id?: string | null
          trailer_id?: string | null
          variance?: number | null
        }
        Update: {
          count_qty?: number
          counted_at?: string
          counted_by?: string | null
          expected_qty?: number | null
          id?: string
          item_id?: string
          shift_id?: string | null
          trailer_id?: string | null
          variance?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_counts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_counts_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          category: Database["public"]["Enums"]["inventory_category"]
          cost_per_unit: number
          created_at: string
          current_qty: number
          id: string
          low_threshold: number
          name: string
          par_level: number
          store_id: string
          trailer_id: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["inventory_category"]
          cost_per_unit?: number
          created_at?: string
          current_qty?: number
          id?: string
          low_threshold?: number
          name: string
          par_level?: number
          store_id: string
          trailer_id?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["inventory_category"]
          cost_per_unit?: number
          created_at?: string
          current_qty?: number
          id?: string
          low_threshold?: number
          name?: string
          par_level?: number
          store_id?: string
          trailer_id?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_receipts: {
        Row: {
          id: string
          item_id: string
          notes: string | null
          qty: number
          received_at: string
          received_by: string | null
          supplier: string | null
        }
        Insert: {
          id?: string
          item_id: string
          notes?: string | null
          qty: number
          received_at?: string
          received_by?: string | null
          supplier?: string | null
        }
        Update: {
          id?: string
          item_id?: string
          notes?: string | null
          qty?: number
          received_at?: string
          received_by?: string | null
          supplier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_receipts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          disabled_at: string | null
          expires_at: string
          expires_hours: number | null
          id: string
          note: string | null
          role: Database["public"]["Enums"]["app_role"]
          trailer_id: string | null
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          disabled_at?: string | null
          expires_at?: string
          expires_hours?: number | null
          id?: string
          note?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          trailer_id?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          disabled_at?: string | null
          expires_at?: string
          expires_hours?: number | null
          id?: string
          note?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          trailer_id?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_codes_trailer_id_fkey"
            columns: ["trailer_id"]
            isOneToOne: false
            referencedRelation: "trailers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          display_name: string
          id: string
          last_login_at: string | null
          sop_accepted_at: string | null
          store_id: string | null
          trailer_id: string | null
          training_completed_at: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name?: string
          id: string
          last_login_at?: string | null
          sop_accepted_at?: string | null
          store_id?: string | null
          trailer_id?: string | null
          training_completed_at?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string
          id?: string
          last_login_at?: string | null
          sop_accepted_at?: string | null
          store_id?: string | null
          trailer_id?: string | null
          training_completed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_trailer_id_fkey"
            columns: ["trailer_id"]
            isOneToOne: false
            referencedRelation: "trailers"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_shifts: {
        Row: {
          break_minutes: number
          created_at: string
          created_by: string | null
          employee_id: string | null
          end_time: string
          id: string
          notes: string | null
          repeat_weekly: boolean
          role: Database["public"]["Enums"]["app_role"]
          schedule_id: string
          segment: Database["public"]["Enums"]["shift_segment"]
          shift_date: string
          start_time: string
          trailer_id: string | null
          updated_at: string
        }
        Insert: {
          break_minutes?: number
          created_at?: string
          created_by?: string | null
          employee_id?: string | null
          end_time: string
          id?: string
          notes?: string | null
          repeat_weekly?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          schedule_id: string
          segment?: Database["public"]["Enums"]["shift_segment"]
          shift_date: string
          start_time: string
          trailer_id?: string | null
          updated_at?: string
        }
        Update: {
          break_minutes?: number
          created_at?: string
          created_by?: string | null
          employee_id?: string | null
          end_time?: string
          id?: string
          notes?: string | null
          repeat_weekly?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          schedule_id?: string
          segment?: Database["public"]["Enums"]["shift_segment"]
          shift_date?: string
          start_time?: string
          trailer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_shifts_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_shifts_trailer_id_fkey"
            columns: ["trailer_id"]
            isOneToOne: false
            referencedRelation: "trailers"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          lock_reason: string | null
          locked_at: string | null
          locked_by: string | null
          name: string
          notes: string | null
          published_at: string | null
          published_by: string | null
          start_date: string
          status: Database["public"]["Enums"]["schedule_status"]
          submitted_at: string | null
          submitted_by: string | null
          trailer_id: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          lock_reason?: string | null
          locked_at?: string | null
          locked_by?: string | null
          name: string
          notes?: string | null
          published_at?: string | null
          published_by?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["schedule_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          trailer_id?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          lock_reason?: string | null
          locked_at?: string | null
          locked_by?: string | null
          name?: string
          notes?: string | null
          published_at?: string | null
          published_by?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["schedule_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          trailer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_trailer_id_fkey"
            columns: ["trailer_id"]
            isOneToOne: false
            referencedRelation: "trailers"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_templates: {
        Row: {
          break_minutes: number
          created_at: string
          created_by: string | null
          end_time: string
          id: string
          name: string
          role: Database["public"]["Enums"]["app_role"]
          segment: Database["public"]["Enums"]["shift_segment"]
          start_time: string
          trailer_id: string | null
        }
        Insert: {
          break_minutes?: number
          created_at?: string
          created_by?: string | null
          end_time: string
          id?: string
          name: string
          role?: Database["public"]["Enums"]["app_role"]
          segment?: Database["public"]["Enums"]["shift_segment"]
          start_time: string
          trailer_id?: string | null
        }
        Update: {
          break_minutes?: number
          created_at?: string
          created_by?: string | null
          end_time?: string
          id?: string
          name?: string
          role?: Database["public"]["Enums"]["app_role"]
          segment?: Database["public"]["Enums"]["shift_segment"]
          start_time?: string
          trailer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_templates_trailer_id_fkey"
            columns: ["trailer_id"]
            isOneToOne: false
            referencedRelation: "trailers"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          id: string
          notes: string | null
          opened_at: string
          opened_by: string | null
          phase: Database["public"]["Enums"]["shift_phase"]
          shift_date: string
          status: Database["public"]["Enums"]["shift_status"]
          store_id: string
          trailer_id: string | null
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          phase?: Database["public"]["Enums"]["shift_phase"]
          shift_date?: string
          status?: Database["public"]["Enums"]["shift_status"]
          store_id: string
          trailer_id?: string | null
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          phase?: Database["public"]["Enums"]["shift_phase"]
          shift_date?: string
          status?: Database["public"]["Enums"]["shift_status"]
          store_id?: string
          trailer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sop_attachments: {
        Row: {
          content_type: string | null
          created_at: string
          id: string
          label: string | null
          sop_id: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          id?: string
          label?: string | null
          sop_id: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          content_type?: string | null
          created_at?: string
          id?: string
          label?: string | null
          sop_id?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sop_attachments_sop_id_fkey"
            columns: ["sop_id"]
            isOneToOne: false
            referencedRelation: "sops"
            referencedColumns: ["id"]
          },
        ]
      }
      sop_versions: {
        Row: {
          body: string
          category: string
          edited_at: string
          edited_by: string | null
          id: string
          pass_standard: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          sop_id: string
          title: string
          version: number
        }
        Insert: {
          body: string
          category: string
          edited_at?: string
          edited_by?: string | null
          id?: string
          pass_standard?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          sop_id: string
          title: string
          version: number
        }
        Update: {
          body?: string
          category?: string
          edited_at?: string
          edited_by?: string | null
          id?: string
          pass_standard?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          sop_id?: string
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "sop_versions_sop_id_fkey"
            columns: ["sop_id"]
            isOneToOne: false
            referencedRelation: "sops"
            referencedColumns: ["id"]
          },
        ]
      }
      sops: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          pass_standard: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          body: string
          category: string
          created_at?: string
          id?: string
          pass_standard?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          pass_standard?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      stores: {
        Row: {
          created_at: string
          id: string
          location: string | null
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          location?: string | null
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          location?: string | null
          name?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assignee_role: Database["public"]["Enums"]["app_role"] | null
          assignee_user_id: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          numeric_value: number | null
          owner_id: string | null
          phase: Database["public"]["Enums"]["shift_phase"]
          photo_url: string | null
          requires_signoff: boolean
          shift_id: string
          signed_off_at: string | null
          signed_off_by: string | null
          status: Database["public"]["Enums"]["task_status"]
          text_value: string | null
          title: string
          trailer_id: string | null
        }
        Insert: {
          assignee_role?: Database["public"]["Enums"]["app_role"] | null
          assignee_user_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          numeric_value?: number | null
          owner_id?: string | null
          phase: Database["public"]["Enums"]["shift_phase"]
          photo_url?: string | null
          requires_signoff?: boolean
          shift_id: string
          signed_off_at?: string | null
          signed_off_by?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          text_value?: string | null
          title: string
          trailer_id?: string | null
        }
        Update: {
          assignee_role?: Database["public"]["Enums"]["app_role"] | null
          assignee_user_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          numeric_value?: number | null
          owner_id?: string | null
          phase?: Database["public"]["Enums"]["shift_phase"]
          photo_url?: string | null
          requires_signoff?: boolean
          shift_id?: string
          signed_off_at?: string | null
          signed_off_by?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          text_value?: string | null
          title?: string
          trailer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      trailers: {
        Row: {
          active: boolean
          created_at: string
          id: string
          location: string | null
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          location?: string | null
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          location?: string | null
          name?: string
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
      waste_log: {
        Row: {
          id: string
          item_id: string
          logged_at: string
          logged_by: string | null
          photo_url: string | null
          qty: number
          reason: string
          trailer_id: string | null
        }
        Insert: {
          id?: string
          item_id: string
          logged_at?: string
          logged_by?: string | null
          photo_url?: string | null
          qty: number
          reason: string
          trailer_id?: string | null
        }
        Update: {
          id?: string
          item_id?: string
          logged_at?: string
          logged_by?: string | null
          photo_url?: string | null
          qty?: number
          reason?: string
          trailer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waste_log_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_invite_code: {
        Args: { _code: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      current_user_trailer: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_manager: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "owner"
        | "manager"
        | "shift_lead"
        | "grill"
        | "prep"
        | "cashier"
      incident_severity: "low" | "medium" | "high"
      inventory_category:
        | "protein"
        | "bun"
        | "produce"
        | "sauce"
        | "packaging"
        | "supplies"
      schedule_status:
        | "draft"
        | "submitted"
        | "approved"
        | "locked"
        | "published"
      shift_phase: "opening" | "mid" | "closing" | "emergency"
      shift_segment: "open" | "mid" | "close" | "custom"
      shift_status: "active" | "closed"
      task_status: "todo" | "in_progress" | "done" | "signed_off" | "blocked"
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
      app_role: ["owner", "manager", "shift_lead", "grill", "prep", "cashier"],
      incident_severity: ["low", "medium", "high"],
      inventory_category: [
        "protein",
        "bun",
        "produce",
        "sauce",
        "packaging",
        "supplies",
      ],
      schedule_status: [
        "draft",
        "submitted",
        "approved",
        "locked",
        "published",
      ],
      shift_phase: ["opening", "mid", "closing", "emergency"],
      shift_segment: ["open", "mid", "close", "custom"],
      shift_status: ["active", "closed"],
      task_status: ["todo", "in_progress", "done", "signed_off", "blocked"],
    },
  },
} as const
