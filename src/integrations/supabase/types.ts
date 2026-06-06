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
      alert_actions: {
        Row: {
          action: Database["public"]["Enums"]["alert_action_kind"]
          actor_id: string
          alert_id: string
          created_at: string
          id: string
          note: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["alert_action_kind"]
          actor_id: string
          alert_id: string
          created_at?: string
          id?: string
          note?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["alert_action_kind"]
          actor_id?: string
          alert_id?: string
          created_at?: string
          id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alert_actions_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          assigned_role: Database["public"]["Enums"]["alert_assigned_role"]
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          payload: Json | null
          priority: Database["public"]["Enums"]["alert_priority"]
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          source_id: string | null
          source_module: string
          status: Database["public"]["Enums"]["alert_status"]
          title: string
          trailer_id: string | null
          type: Database["public"]["Enums"]["alert_type"]
          updated_at: string
        }
        Insert: {
          assigned_role?: Database["public"]["Enums"]["alert_assigned_role"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          payload?: Json | null
          priority?: Database["public"]["Enums"]["alert_priority"]
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source_id?: string | null
          source_module: string
          status?: Database["public"]["Enums"]["alert_status"]
          title: string
          trailer_id?: string | null
          type: Database["public"]["Enums"]["alert_type"]
          updated_at?: string
        }
        Update: {
          assigned_role?: Database["public"]["Enums"]["alert_assigned_role"]
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          payload?: Json | null
          priority?: Database["public"]["Enums"]["alert_priority"]
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source_id?: string | null
          source_module?: string
          status?: Database["public"]["Enums"]["alert_status"]
          title?: string
          trailer_id?: string | null
          type?: Database["public"]["Enums"]["alert_type"]
          updated_at?: string
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
      cash_drawer_sessions: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          counted_amount: number | null
          created_at: string
          drawer_id: string
          expected_amount: number | null
          id: string
          opened_at: string
          opened_by: string
          owner_note: string | null
          owner_review: Database["public"]["Enums"]["cash_owner_review"]
          owner_reviewed_at: string | null
          owner_reviewed_by: string | null
          starting_float: number
          status: Database["public"]["Enums"]["cash_session_status"]
          total_cash_sales: number | null
          trailer_id: string
          updated_at: string
          variance: number | null
          variance_reason: string | null
          verification: Database["public"]["Enums"]["cash_verification"]
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          counted_amount?: number | null
          created_at?: string
          drawer_id: string
          expected_amount?: number | null
          id?: string
          opened_at?: string
          opened_by: string
          owner_note?: string | null
          owner_review?: Database["public"]["Enums"]["cash_owner_review"]
          owner_reviewed_at?: string | null
          owner_reviewed_by?: string | null
          starting_float?: number
          status?: Database["public"]["Enums"]["cash_session_status"]
          total_cash_sales?: number | null
          trailer_id: string
          updated_at?: string
          variance?: number | null
          variance_reason?: string | null
          verification?: Database["public"]["Enums"]["cash_verification"]
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          counted_amount?: number | null
          created_at?: string
          drawer_id?: string
          expected_amount?: number | null
          id?: string
          opened_at?: string
          opened_by?: string
          owner_note?: string | null
          owner_review?: Database["public"]["Enums"]["cash_owner_review"]
          owner_reviewed_at?: string | null
          owner_reviewed_by?: string | null
          starting_float?: number
          status?: Database["public"]["Enums"]["cash_session_status"]
          total_cash_sales?: number | null
          trailer_id?: string
          updated_at?: string
          variance?: number | null
          variance_reason?: string | null
          verification?: Database["public"]["Enums"]["cash_verification"]
        }
        Relationships: [
          {
            foreignKeyName: "cash_drawer_sessions_drawer_id_fkey"
            columns: ["drawer_id"]
            isOneToOne: false
            referencedRelation: "cash_drawers"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_drawers: {
        Row: {
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          name: string
          starting_float: number
          trailer_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          name: string
          starting_float?: number
          trailer_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          name?: string
          starting_float?: number
          trailer_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      cash_drops: {
        Row: {
          amount: number
          created_at: string
          drawer_id: string
          drop_code: string
          id: string
          notes: string | null
          reason: string | null
          session_id: string
          submitted_at: string
          submitted_by: string
          trailer_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          drawer_id: string
          drop_code: string
          id?: string
          notes?: string | null
          reason?: string | null
          session_id: string
          submitted_at?: string
          submitted_by: string
          trailer_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          drawer_id?: string
          drop_code?: string
          id?: string
          notes?: string | null
          reason?: string | null
          session_id?: string
          submitted_at?: string
          submitted_by?: string
          trailer_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_drops_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cash_drawer_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      change_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          reason: string | null
          summary: string | null
          trailer_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          reason?: string | null
          summary?: string | null
          trailer_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          reason?: string | null
          summary?: string | null
          trailer_id?: string | null
        }
        Relationships: []
      }
      daily_recaps: {
        Row: {
          created_at: string
          crew: Json
          hosp_complaints: string | null
          hosp_feedback: string | null
          hosp_wins: string | null
          id: string
          inv_concerns: string | null
          inv_low_stock: string | null
          inv_orders: string | null
          labor_attendance: string | null
          labor_performance: string | null
          labor_staffing: string | null
          location: string | null
          manager_id: string
          next_shift_notes: string | null
          ops_attention: string | null
          ops_slowed: string | null
          ops_went_well: string | null
          owner_comment: string | null
          recap_date: string
          reviewed_at: string | null
          reviewed_by: string | null
          shift_id: string | null
          shift_score: number | null
          status: Database["public"]["Enums"]["recap_status"]
          submitted_at: string | null
          trailer_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          crew?: Json
          hosp_complaints?: string | null
          hosp_feedback?: string | null
          hosp_wins?: string | null
          id?: string
          inv_concerns?: string | null
          inv_low_stock?: string | null
          inv_orders?: string | null
          labor_attendance?: string | null
          labor_performance?: string | null
          labor_staffing?: string | null
          location?: string | null
          manager_id: string
          next_shift_notes?: string | null
          ops_attention?: string | null
          ops_slowed?: string | null
          ops_went_well?: string | null
          owner_comment?: string | null
          recap_date?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          shift_id?: string | null
          shift_score?: number | null
          status?: Database["public"]["Enums"]["recap_status"]
          submitted_at?: string | null
          trailer_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          crew?: Json
          hosp_complaints?: string | null
          hosp_feedback?: string | null
          hosp_wins?: string | null
          id?: string
          inv_concerns?: string | null
          inv_low_stock?: string | null
          inv_orders?: string | null
          labor_attendance?: string | null
          labor_performance?: string | null
          labor_staffing?: string | null
          location?: string | null
          manager_id?: string
          next_shift_notes?: string | null
          ops_attention?: string | null
          ops_slowed?: string | null
          ops_went_well?: string | null
          owner_comment?: string | null
          recap_date?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          shift_id?: string | null
          shift_score?: number | null
          status?: Database["public"]["Enums"]["recap_status"]
          submitted_at?: string | null
          trailer_id?: string | null
          updated_at?: string
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
          estimated_cost: number
          id: string
          last_ordered_at: string | null
          last_received_at: string | null
          low_threshold: number
          minimum_qty: number
          name: string
          pack_size: string | null
          par_level: number
          preferred_order_qty: number
          store_id: string
          trailer_id: string | null
          unit: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["inventory_category"]
          cost_per_unit?: number
          created_at?: string
          current_qty?: number
          estimated_cost?: number
          id?: string
          last_ordered_at?: string | null
          last_received_at?: string | null
          low_threshold?: number
          minimum_qty?: number
          name: string
          pack_size?: string | null
          par_level?: number
          preferred_order_qty?: number
          store_id: string
          trailer_id?: string | null
          unit?: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["inventory_category"]
          cost_per_unit?: number
          created_at?: string
          current_qty?: number
          estimated_cost?: number
          id?: string
          last_ordered_at?: string | null
          last_received_at?: string | null
          low_threshold?: number
          minimum_qty?: number
          name?: string
          pack_size?: string | null
          par_level?: number
          preferred_order_qty?: number
          store_id?: string
          trailer_id?: string | null
          unit?: string
          updated_at?: string
          vendor?: string | null
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
      inventory_order_items: {
        Row: {
          category: string | null
          created_at: string
          current_qty: number
          id: string
          item_id: string | null
          item_name: string
          notes: string | null
          order_id: string
          par_qty: number
          reason: string | null
          requested_qty: number
          unit: string | null
          urgency: Database["public"]["Enums"]["inventory_order_urgency"]
        }
        Insert: {
          category?: string | null
          created_at?: string
          current_qty?: number
          id?: string
          item_id?: string | null
          item_name: string
          notes?: string | null
          order_id: string
          par_qty?: number
          reason?: string | null
          requested_qty: number
          unit?: string | null
          urgency?: Database["public"]["Enums"]["inventory_order_urgency"]
        }
        Update: {
          category?: string | null
          created_at?: string
          current_qty?: number
          id?: string
          item_id?: string | null
          item_name?: string
          notes?: string | null
          order_id?: string
          par_qty?: number
          reason?: string | null
          requested_qty?: number
          unit?: string | null
          urgency?: Database["public"]["Enums"]["inventory_order_urgency"]
        }
        Relationships: [
          {
            foreignKeyName: "inventory_order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "inventory_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_orders: {
        Row: {
          created_at: string
          created_by: string
          decided_at: string | null
          decided_by: string | null
          id: string
          notes: string | null
          ordered_at: string | null
          owner_comment: string | null
          received_at: string | null
          status: Database["public"]["Enums"]["inventory_order_status"]
          submitted_at: string | null
          trailer_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          notes?: string | null
          ordered_at?: string | null
          owner_comment?: string | null
          received_at?: string | null
          status?: Database["public"]["Enums"]["inventory_order_status"]
          submitted_at?: string | null
          trailer_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          notes?: string | null
          ordered_at?: string | null
          owner_comment?: string | null
          received_at?: string | null
          status?: Database["public"]["Enums"]["inventory_order_status"]
          submitted_at?: string | null
          trailer_id?: string | null
          updated_at?: string
        }
        Relationships: []
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
      shift_notes: {
        Row: {
          author_id: string
          created_at: string
          employee_id: string
          for_date: string | null
          id: string
          note: string
          punch_id: string | null
          schedule_shift_id: string | null
          trailer_id: string | null
          visibility: string
        }
        Insert: {
          author_id: string
          created_at?: string
          employee_id: string
          for_date?: string | null
          id?: string
          note: string
          punch_id?: string | null
          schedule_shift_id?: string | null
          trailer_id?: string | null
          visibility?: string
        }
        Update: {
          author_id?: string
          created_at?: string
          employee_id?: string
          for_date?: string | null
          id?: string
          note?: string
          punch_id?: string | null
          schedule_shift_id?: string | null
          trailer_id?: string | null
          visibility?: string
        }
        Relationships: []
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
      tab_permissions: {
        Row: {
          access_level: string
          enabled: boolean
          id: string
          scope_id: string
          scope_type: string
          tab_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          access_level?: string
          enabled?: boolean
          id?: string
          scope_id: string
          scope_type: string
          tab_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          access_level?: string
          enabled?: boolean
          id?: string
          scope_id?: string
          scope_type?: string
          tab_key?: string
          updated_at?: string
          updated_by?: string | null
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
      time_audit: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string
          entity_id: string
          id: string
          new_value: Json | null
          old_value: Json | null
          reason: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity: string
          entity_id: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
        }
        Relationships: []
      }
      time_corrections: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          employee_id: string
          for_date: string
          id: string
          punch_id: string | null
          reason: string
          requested_in: string | null
          requested_out: string | null
          schedule_shift_id: string | null
          status: Database["public"]["Enums"]["request_status"]
          trailer_id: string | null
          type: Database["public"]["Enums"]["correction_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          employee_id: string
          for_date: string
          id?: string
          punch_id?: string | null
          reason: string
          requested_in?: string | null
          requested_out?: string | null
          schedule_shift_id?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          trailer_id?: string | null
          type: Database["public"]["Enums"]["correction_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          employee_id?: string
          for_date?: string
          id?: string
          punch_id?: string | null
          reason?: string
          requested_in?: string | null
          requested_out?: string | null
          schedule_shift_id?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          trailer_id?: string | null
          type?: Database["public"]["Enums"]["correction_type"]
          updated_at?: string
        }
        Relationships: []
      }
      time_off_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          employee_id: string
          end_date: string
          end_time: string | null
          full_day: boolean
          id: string
          notes: string | null
          reason: string
          start_date: string
          start_time: string | null
          status: Database["public"]["Enums"]["request_status"]
          trailer_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          employee_id: string
          end_date: string
          end_time?: string | null
          full_day?: boolean
          id?: string
          notes?: string | null
          reason: string
          start_date: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          trailer_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          employee_id?: string
          end_date?: string
          end_time?: string | null
          full_day?: boolean
          id?: string
          notes?: string | null
          reason?: string
          start_date?: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          trailer_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      time_punches: {
        Row: {
          break_minutes: number
          clock_in_at: string
          clock_out_at: string | null
          created_at: string
          device_info: Json | null
          edited_at: string | null
          edited_by: string | null
          employee_id: string
          id: string
          notes: string | null
          schedule_shift_id: string | null
          status: Database["public"]["Enums"]["punch_status"]
          trailer_id: string | null
          updated_at: string
        }
        Insert: {
          break_minutes?: number
          clock_in_at?: string
          clock_out_at?: string | null
          created_at?: string
          device_info?: Json | null
          edited_at?: string | null
          edited_by?: string | null
          employee_id: string
          id?: string
          notes?: string | null
          schedule_shift_id?: string | null
          status?: Database["public"]["Enums"]["punch_status"]
          trailer_id?: string | null
          updated_at?: string
        }
        Update: {
          break_minutes?: number
          clock_in_at?: string
          clock_out_at?: string | null
          created_at?: string
          device_info?: Json | null
          edited_at?: string | null
          edited_by?: string | null
          employee_id?: string
          id?: string
          notes?: string | null
          schedule_shift_id?: string | null
          status?: Database["public"]["Enums"]["punch_status"]
          trailer_id?: string | null
          updated_at?: string
        }
        Relationships: []
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
      payroll_week_start: { Args: { _d: string }; Returns: string }
    }
    Enums: {
      alert_action_kind:
        | "comment"
        | "approve"
        | "decline"
        | "request_changes"
        | "mark_ordered"
        | "mark_received"
        | "escalate"
        | "resolve"
        | "review"
      alert_assigned_role: "manager" | "owner"
      alert_priority: "critical" | "high" | "normal" | "low"
      alert_status: "open" | "pending" | "approved" | "declined" | "resolved"
      alert_type:
        | "missed_clock_out"
        | "missed_clock_in"
        | "time_adjustment"
        | "time_off"
        | "inventory_order"
        | "low_stock"
        | "critical_stock"
        | "checklist_failure"
        | "manager_note"
        | "schedule_approval"
        | "maintenance"
        | "manager_recap"
      app_role:
        | "owner"
        | "manager"
        | "shift_lead"
        | "grill"
        | "prep"
        | "cashier"
      cash_owner_review: "pending" | "approved" | "correction" | "flagged"
      cash_session_status: "open" | "pending" | "closed"
      cash_verification: "self" | "requested" | "verified"
      correction_type:
        | "missed_in"
        | "missed_out"
        | "wrong_time"
        | "extra_time"
        | "left_early"
        | "stayed_late"
        | "other"
      incident_severity: "low" | "medium" | "high"
      inventory_category:
        | "protein"
        | "bun"
        | "produce"
        | "sauce"
        | "packaging"
        | "supplies"
      inventory_order_status:
        | "draft"
        | "submitted"
        | "pending_owner_review"
        | "approved"
        | "declined"
        | "changes_requested"
        | "ordered"
        | "received"
        | "cancelled"
      inventory_order_urgency:
        | "normal"
        | "needed_soon"
        | "critical"
        | "emergency"
      punch_status: "open" | "closed" | "edited" | "voided"
      recap_status: "draft" | "submitted" | "reviewed" | "archived"
      request_status: "pending" | "approved" | "declined" | "info_requested"
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
      alert_action_kind: [
        "comment",
        "approve",
        "decline",
        "request_changes",
        "mark_ordered",
        "mark_received",
        "escalate",
        "resolve",
        "review",
      ],
      alert_assigned_role: ["manager", "owner"],
      alert_priority: ["critical", "high", "normal", "low"],
      alert_status: ["open", "pending", "approved", "declined", "resolved"],
      alert_type: [
        "missed_clock_out",
        "missed_clock_in",
        "time_adjustment",
        "time_off",
        "inventory_order",
        "low_stock",
        "critical_stock",
        "checklist_failure",
        "manager_note",
        "schedule_approval",
        "maintenance",
        "manager_recap",
      ],
      app_role: ["owner", "manager", "shift_lead", "grill", "prep", "cashier"],
      cash_owner_review: ["pending", "approved", "correction", "flagged"],
      cash_session_status: ["open", "pending", "closed"],
      cash_verification: ["self", "requested", "verified"],
      correction_type: [
        "missed_in",
        "missed_out",
        "wrong_time",
        "extra_time",
        "left_early",
        "stayed_late",
        "other",
      ],
      incident_severity: ["low", "medium", "high"],
      inventory_category: [
        "protein",
        "bun",
        "produce",
        "sauce",
        "packaging",
        "supplies",
      ],
      inventory_order_status: [
        "draft",
        "submitted",
        "pending_owner_review",
        "approved",
        "declined",
        "changes_requested",
        "ordered",
        "received",
        "cancelled",
      ],
      inventory_order_urgency: [
        "normal",
        "needed_soon",
        "critical",
        "emergency",
      ],
      punch_status: ["open", "closed", "edited", "voided"],
      recap_status: ["draft", "submitted", "reviewed", "archived"],
      request_status: ["pending", "approved", "declined", "info_requested"],
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
