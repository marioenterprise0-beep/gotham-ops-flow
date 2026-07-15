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
      _org_resolution: {
        Row: {
          fk_column: string | null
          fk_pk: string
          fk_table: string | null
          table_name: string
        }
        Insert: {
          fk_column?: string | null
          fk_pk?: string
          fk_table?: string | null
          table_name: string
        }
        Update: {
          fk_column?: string | null
          fk_pk?: string
          fk_table?: string | null
          table_name?: string
        }
        Relationships: []
      }
      access_log: {
        Row: {
          created_at: string
          event: string
          id: string
          ip: string | null
          organization_id: string
          payload: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          ip?: string | null
          organization_id?: string
          payload?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          ip?: string | null
          organization_id?: string
          payload?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      active_location_grants: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          organization_id: string
          request_id: string | null
          trailer_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          organization_id?: string
          request_id?: string | null
          trailer_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          organization_id?: string
          request_id?: string | null
          trailer_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "active_location_grants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "active_location_grants_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "location_access_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_actions: {
        Row: {
          action: Database["public"]["Enums"]["alert_action_kind"]
          actor_id: string
          alert_id: string
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          created_at: string
          id: string
          note: string | null
          organization_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["alert_action_kind"]
          actor_id: string
          alert_id: string
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          organization_id?: string
        }
        Update: {
          action?: Database["public"]["Enums"]["alert_action_kind"]
          actor_id?: string
          alert_id?: string
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_actions_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alert_actions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_category_reads: {
        Row: {
          category: string
          last_seen_at: string
          organization_id: string
          user_id: string
        }
        Insert: {
          category: string
          last_seen_at?: string
          organization_id?: string
          user_id: string
        }
        Update: {
          category?: string
          last_seen_at?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_category_reads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          assigned_role: Database["public"]["Enums"]["alert_assigned_role"]
          assigned_user_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          email_error: string | null
          email_message_id: string | null
          email_sent_at: string | null
          email_status: Database["public"]["Enums"]["alert_email_status"]
          email_template: string | null
          id: string
          organization_id: string
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
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          assigned_role?: Database["public"]["Enums"]["alert_assigned_role"]
          assigned_user_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          email_error?: string | null
          email_message_id?: string | null
          email_sent_at?: string | null
          email_status?: Database["public"]["Enums"]["alert_email_status"]
          email_template?: string | null
          id?: string
          organization_id?: string
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
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          assigned_role?: Database["public"]["Enums"]["alert_assigned_role"]
          assigned_user_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          email_error?: string | null
          email_message_id?: string | null
          email_sent_at?: string | null
          email_status?: Database["public"]["Enums"]["alert_email_status"]
          email_template?: string | null
          id?: string
          organization_id?: string
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
        Relationships: [
          {
            foreignKeyName: "alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          organization_id: string
          payload: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          organization_id?: string
          payload?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          organization_id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_settings: {
        Row: {
          auto_clock_out_enabled: boolean
          created_at: string
          email_enabled: boolean
          id: string
          kiosk_device_required: boolean
          manager_self_approval: boolean
          organization_id: string
          rollover_enabled: boolean
          rollover_hour: number
          scope: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auto_clock_out_enabled?: boolean
          created_at?: string
          email_enabled?: boolean
          id?: string
          kiosk_device_required?: boolean
          manager_self_approval?: boolean
          organization_id?: string
          rollover_enabled?: boolean
          rollover_hour?: number
          scope?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auto_clock_out_enabled?: boolean
          created_at?: string
          email_enabled?: boolean
          id?: string
          kiosk_device_required?: boolean
          manager_self_approval?: boolean
          organization_id?: string
          rollover_enabled?: boolean
          rollover_hour?: number
          scope?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_blocks: {
        Row: {
          all_day: boolean
          block_date: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          organization_id: string
          reason: string | null
          schedule_id: string | null
          status: string
          trailer_id: string | null
          user_id: string
        }
        Insert: {
          all_day?: boolean
          block_date: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          organization_id?: string
          reason?: string | null
          schedule_id?: string | null
          status?: string
          trailer_id?: string | null
          user_id: string
        }
        Update: {
          all_day?: boolean
          block_date?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          organization_id?: string
          reason?: string | null
          schedule_id?: string | null
          status?: string
          trailer_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_blocks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_blocks_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_blocks_trailer_id_fkey"
            columns: ["trailer_id"]
            isOneToOne: false
            referencedRelation: "trailers"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_drawer_sessions: {
        Row: {
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          closed_at: string | null
          closed_by: string | null
          counted_amount: number | null
          created_at: string
          drawer_id: string
          expected_amount: number | null
          id: string
          opened_at: string
          opened_by: string
          organization_id: string
          owner_note: string | null
          owner_review: Database["public"]["Enums"]["cash_owner_review"]
          owner_reviewed_at: string | null
          owner_reviewed_by: string | null
          pdf_path: string | null
          pdf_uploaded_at: string | null
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
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          closed_at?: string | null
          closed_by?: string | null
          counted_amount?: number | null
          created_at?: string
          drawer_id: string
          expected_amount?: number | null
          id?: string
          opened_at?: string
          opened_by: string
          organization_id?: string
          owner_note?: string | null
          owner_review?: Database["public"]["Enums"]["cash_owner_review"]
          owner_reviewed_at?: string | null
          owner_reviewed_by?: string | null
          pdf_path?: string | null
          pdf_uploaded_at?: string | null
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
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          closed_at?: string | null
          closed_by?: string | null
          counted_amount?: number | null
          created_at?: string
          drawer_id?: string
          expected_amount?: number | null
          id?: string
          opened_at?: string
          opened_by?: string
          organization_id?: string
          owner_note?: string | null
          owner_review?: Database["public"]["Enums"]["cash_owner_review"]
          owner_reviewed_at?: string | null
          owner_reviewed_by?: string | null
          pdf_path?: string | null
          pdf_uploaded_at?: string | null
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
          {
            foreignKeyName: "cash_drawer_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_drawers: {
        Row: {
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          name: string
          organization_id: string
          starting_float: number
          trailer_id: string
          updated_at: string
        }
        Insert: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          name: string
          organization_id?: string
          starting_float?: number
          trailer_id: string
          updated_at?: string
        }
        Update: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          name?: string
          organization_id?: string
          starting_float?: number
          trailer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_drawers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_drops: {
        Row: {
          amount: number
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          created_at: string
          drawer_id: string
          drop_code: string
          id: string
          notes: string | null
          organization_id: string
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
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          drawer_id: string
          drop_code: string
          id?: string
          notes?: string | null
          organization_id?: string
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
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          drawer_id?: string
          drop_code?: string
          id?: string
          notes?: string | null
          organization_id?: string
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
            foreignKeyName: "cash_drops_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
          reason?: string | null
          summary?: string | null
          trailer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "change_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_sessions: {
        Row: {
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          created_at: string
          created_by: string | null
          employee_name: string | null
          end_at: string | null
          id: string
          manager_initials: string | null
          manager_name: string | null
          notes: string | null
          organization_id: string
          phase: Database["public"]["Enums"]["shift_phase"]
          shift_id: string
          start_at: string | null
          trailer_id: string | null
          updated_at: string
        }
        Insert: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by?: string | null
          employee_name?: string | null
          end_at?: string | null
          id?: string
          manager_initials?: string | null
          manager_name?: string | null
          notes?: string | null
          organization_id?: string
          phase: Database["public"]["Enums"]["shift_phase"]
          shift_id: string
          start_at?: string | null
          trailer_id?: string | null
          updated_at?: string
        }
        Update: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by?: string | null
          employee_name?: string | null
          end_at?: string | null
          id?: string
          manager_initials?: string | null
          manager_name?: string | null
          notes?: string | null
          organization_id?: string
          phase?: Database["public"]["Enums"]["shift_phase"]
          shift_id?: string
          start_at?: string | null
          trailer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_dispatch_config: {
        Row: {
          app_url: string
          id: number
          rollover_key: string | null
          updated_at: string
        }
        Insert: {
          app_url: string
          id?: number
          rollover_key?: string | null
          updated_at?: string
        }
        Update: {
          app_url?: string
          id?: number
          rollover_key?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      daily_recaps: {
        Row: {
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          created_at: string
          crew: Json
          crew_summary: string | null
          hosp_complaints: string | null
          hosp_feedback: string | null
          hosp_wins: string | null
          id: string
          inv_concerns: string | null
          inv_low_stock: string | null
          inv_orders: string | null
          kind: string
          labor_attendance: string | null
          labor_performance: string | null
          labor_staffing: string | null
          location: string | null
          manager_id: string
          next_shift_notes: string | null
          ops_attention: string | null
          ops_slowed: string | null
          ops_went_well: string | null
          organization_id: string
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
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          crew?: Json
          crew_summary?: string | null
          hosp_complaints?: string | null
          hosp_feedback?: string | null
          hosp_wins?: string | null
          id?: string
          inv_concerns?: string | null
          inv_low_stock?: string | null
          inv_orders?: string | null
          kind?: string
          labor_attendance?: string | null
          labor_performance?: string | null
          labor_staffing?: string | null
          location?: string | null
          manager_id: string
          next_shift_notes?: string | null
          ops_attention?: string | null
          ops_slowed?: string | null
          ops_went_well?: string | null
          organization_id?: string
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
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          crew?: Json
          crew_summary?: string | null
          hosp_complaints?: string | null
          hosp_feedback?: string | null
          hosp_wins?: string | null
          id?: string
          inv_concerns?: string | null
          inv_low_stock?: string | null
          inv_orders?: string | null
          kind?: string
          labor_attendance?: string | null
          labor_performance?: string | null
          labor_staffing?: string | null
          location?: string | null
          manager_id?: string
          next_shift_notes?: string | null
          ops_attention?: string | null
          ops_slowed?: string | null
          ops_went_well?: string | null
          organization_id?: string
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
        Relationships: [
          {
            foreignKeyName: "daily_recaps_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_dispatch_config: {
        Row: {
          created_at: string
          dispatch_key: string
          id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          dispatch_key: string
          id?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          dispatch_key?: string
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          alert_id: string | null
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          opened_at: string | null
          organization_id: string | null
          recipient_email: string
          retry_count: number
          source_id: string | null
          source_module: string | null
          status: string
          subject: string | null
          template_name: string
        }
        Insert: {
          alert_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          opened_at?: string | null
          organization_id?: string | null
          recipient_email: string
          retry_count?: number
          source_id?: string | null
          source_module?: string | null
          status: string
          subject?: string | null
          template_name: string
        }
        Update: {
          alert_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          opened_at?: string | null
          organization_id?: string | null
          recipient_email?: string
          retry_count?: number
          source_id?: string | null
          source_module?: string | null
          status?: string
          subject?: string | null
          template_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_send_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      employee_pins: {
        Row: {
          created_at: string
          organization_id: string
          pin_hash: string
          set_by: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          organization_id?: string
          pin_hash: string
          set_by?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          pin_hash?: string
          set_by?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_pins_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      handbook_acknowledgements: {
        Row: {
          acknowledged_at: string
          full_name_typed: string
          handbook_version: number
          id: string
          organization_id: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string
          full_name_typed: string
          handbook_version: number
          id?: string
          organization_id?: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string
          full_name_typed?: string
          handbook_version?: number
          id?: string
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "handbook_acknowledgements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      handbook_sections: {
        Row: {
          body_blocks: Json
          display_order: number
          id: string
          is_policy: boolean
          organization_id: string
          part_number: number
          part_title: string
          section_number: number
          section_title: string
          updated_at: string
          version: number
        }
        Insert: {
          body_blocks: Json
          display_order: number
          id?: string
          is_policy?: boolean
          organization_id?: string
          part_number: number
          part_title: string
          section_number: number
          section_title: string
          updated_at?: string
          version?: number
        }
        Update: {
          body_blocks?: Json
          display_order?: number
          id?: string
          is_policy?: boolean
          organization_id?: string
          part_number?: number
          part_title?: string
          section_number?: number
          section_title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "handbook_sections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hospitality_incidents: {
        Row: {
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          id: string
          logged_at: string
          logged_by: string | null
          notes: string | null
          organization_id: string
          recovery_action: string | null
          severity: Database["public"]["Enums"]["incident_severity"]
          shift_id: string | null
          trailer_id: string | null
          type: string
        }
        Insert: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          id?: string
          logged_at?: string
          logged_by?: string | null
          notes?: string | null
          organization_id?: string
          recovery_action?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          shift_id?: string | null
          trailer_id?: string | null
          type: string
        }
        Update: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          id?: string
          logged_at?: string
          logged_by?: string | null
          notes?: string | null
          organization_id?: string
          recovery_action?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          shift_id?: string | null
          trailer_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "hospitality_incidents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hospitality_incidents_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_document_assignments: {
        Row: {
          assigned_at: string
          assigned_by: string
          body_blocks: Json | null
          category: Database["public"]["Enums"]["hr_doc_category"] | null
          completed_at: string | null
          completed_pdf_path: string | null
          created_at: string
          custom_content_type: string | null
          custom_storage_path: string | null
          due_date: string | null
          employee_id: string
          field_values: Json
          id: string
          organization_id: string
          required_signer_roles: string[]
          status: Database["public"]["Enums"]["hr_assignment_status"]
          template_id: string | null
          title: string
          trailer_id: string | null
          viewed_at: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          body_blocks?: Json | null
          category?: Database["public"]["Enums"]["hr_doc_category"] | null
          completed_at?: string | null
          completed_pdf_path?: string | null
          created_at?: string
          custom_content_type?: string | null
          custom_storage_path?: string | null
          due_date?: string | null
          employee_id: string
          field_values?: Json
          id?: string
          organization_id?: string
          required_signer_roles?: string[]
          status?: Database["public"]["Enums"]["hr_assignment_status"]
          template_id?: string | null
          title: string
          trailer_id?: string | null
          viewed_at?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          body_blocks?: Json | null
          category?: Database["public"]["Enums"]["hr_doc_category"] | null
          completed_at?: string | null
          completed_pdf_path?: string | null
          created_at?: string
          custom_content_type?: string | null
          custom_storage_path?: string | null
          due_date?: string | null
          employee_id?: string
          field_values?: Json
          id?: string
          organization_id?: string
          required_signer_roles?: string[]
          status?: Database["public"]["Enums"]["hr_assignment_status"]
          template_id?: string | null
          title?: string
          trailer_id?: string | null
          viewed_at?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_document_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_document_assignments_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "hr_document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_document_signatures: {
        Row: {
          assignment_id: string
          id: string
          organization_id: string
          signed_at: string | null
          signer_role_label: string
          signer_user_id: string | null
          typed_full_name: string | null
        }
        Insert: {
          assignment_id: string
          id?: string
          organization_id?: string
          signed_at?: string | null
          signer_role_label: string
          signer_user_id?: string | null
          typed_full_name?: string | null
        }
        Update: {
          assignment_id?: string
          id?: string
          organization_id?: string
          signed_at?: string | null
          signer_role_label?: string
          signer_user_id?: string | null
          typed_full_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hr_document_signatures_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "hr_document_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_document_signatures_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_document_template_versions: {
        Row: {
          body_blocks: Json
          edited_at: string
          edited_by: string | null
          id: string
          organization_id: string
          signer_roles: string[]
          template_id: string
          title: string
          version: number
        }
        Insert: {
          body_blocks: Json
          edited_at?: string
          edited_by?: string | null
          id?: string
          organization_id?: string
          signer_roles: string[]
          template_id: string
          title: string
          version: number
        }
        Update: {
          body_blocks?: Json
          edited_at?: string
          edited_by?: string | null
          id?: string
          organization_id?: string
          signer_roles?: string[]
          template_id?: string
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "hr_document_template_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hr_document_template_versions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "hr_document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_document_templates: {
        Row: {
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          body_blocks: Json
          category: Database["public"]["Enums"]["hr_doc_category"]
          created_at: string
          doc_code: string
          id: string
          organization_id: string
          owner_only: boolean
          signer_roles: string[]
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          body_blocks: Json
          category: Database["public"]["Enums"]["hr_doc_category"]
          created_at?: string
          doc_code: string
          id?: string
          organization_id?: string
          owner_only?: boolean
          signer_roles?: string[]
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          body_blocks?: Json
          category?: Database["public"]["Enums"]["hr_doc_category"]
          created_at?: string
          doc_code?: string
          id?: string
          organization_id?: string
          owner_only?: boolean
          signer_roles?: string[]
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "hr_document_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_categories: {
        Row: {
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          created_at: string
          created_by: string | null
          id: string
          key: string
          label: string
          organization_id: string
          sort_order: number
        }
        Insert: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          key: string
          label: string
          organization_id?: string
          sort_order?: number
        }
        Update: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          key?: string
          label?: string
          organization_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_change_requests: {
        Row: {
          action: Database["public"]["Enums"]["inventory_change_action"]
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          organization_id: string
          payload: Json
          reason: string | null
          requested_by: string
          status: Database["public"]["Enums"]["inventory_change_status"]
          target_item_id: string | null
          trailer_id: string | null
          updated_at: string
        }
        Insert: {
          action: Database["public"]["Enums"]["inventory_change_action"]
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          organization_id?: string
          payload?: Json
          reason?: string | null
          requested_by: string
          status?: Database["public"]["Enums"]["inventory_change_status"]
          target_item_id?: string | null
          trailer_id?: string | null
          updated_at?: string
        }
        Update: {
          action?: Database["public"]["Enums"]["inventory_change_action"]
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          organization_id?: string
          payload?: Json
          reason?: string | null
          requested_by?: string
          status?: Database["public"]["Enums"]["inventory_change_status"]
          target_item_id?: string | null
          trailer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_change_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_counts: {
        Row: {
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          count_qty: number
          counted_at: string
          counted_by: string | null
          expected_qty: number | null
          id: string
          item_id: string
          organization_id: string
          shift_id: string | null
          trailer_id: string | null
          variance: number | null
        }
        Insert: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          count_qty: number
          counted_at?: string
          counted_by?: string | null
          expected_qty?: number | null
          id?: string
          item_id: string
          organization_id?: string
          shift_id?: string | null
          trailer_id?: string | null
          variance?: number | null
        }
        Update: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          count_qty?: number
          counted_at?: string
          counted_by?: string | null
          expected_qty?: number | null
          id?: string
          item_id?: string
          organization_id?: string
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
            foreignKeyName: "inventory_counts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          category: string
          cost_per_unit: number
          count_instructions: string | null
          created_at: string
          current_qty: number
          estimated_cost: number
          id: string
          image_url: string | null
          last_ordered_at: string | null
          last_received_at: string | null
          low_threshold: number
          minimum_qty: number
          name: string
          organization_id: string
          pack_size: string | null
          par_level: number
          preferred_order_qty: number
          storage_location: string | null
          store_id: string
          trailer_id: string | null
          unit: string
          updated_at: string
          vendor: string | null
        }
        Insert: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          category: string
          cost_per_unit?: number
          count_instructions?: string | null
          created_at?: string
          current_qty?: number
          estimated_cost?: number
          id?: string
          image_url?: string | null
          last_ordered_at?: string | null
          last_received_at?: string | null
          low_threshold?: number
          minimum_qty?: number
          name: string
          organization_id?: string
          pack_size?: string | null
          par_level?: number
          preferred_order_qty?: number
          storage_location?: string | null
          store_id: string
          trailer_id?: string | null
          unit?: string
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          category?: string
          cost_per_unit?: number
          count_instructions?: string | null
          created_at?: string
          current_qty?: number
          estimated_cost?: number
          id?: string
          image_url?: string | null
          last_ordered_at?: string | null
          last_received_at?: string | null
          low_threshold?: number
          minimum_qty?: number
          name?: string
          organization_id?: string
          pack_size?: string | null
          par_level?: number
          preferred_order_qty?: number
          storage_location?: string | null
          store_id?: string
          trailer_id?: string | null
          unit?: string
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          category: string | null
          created_at: string
          current_qty: number
          id: string
          item_id: string | null
          item_name: string
          notes: string | null
          order_id: string
          organization_id: string
          par_qty: number
          reason: string | null
          requested_qty: number
          unit: string | null
          urgency: Database["public"]["Enums"]["inventory_order_urgency"]
        }
        Insert: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          category?: string | null
          created_at?: string
          current_qty?: number
          id?: string
          item_id?: string | null
          item_name: string
          notes?: string | null
          order_id: string
          organization_id?: string
          par_qty?: number
          reason?: string | null
          requested_qty: number
          unit?: string | null
          urgency?: Database["public"]["Enums"]["inventory_order_urgency"]
        }
        Update: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          category?: string | null
          created_at?: string
          current_qty?: number
          id?: string
          item_id?: string | null
          item_name?: string
          notes?: string | null
          order_id?: string
          organization_id?: string
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
          {
            foreignKeyName: "inventory_order_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_orders: {
        Row: {
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          created_at: string
          created_by: string
          decided_at: string | null
          decided_by: string | null
          id: string
          notes: string | null
          ordered_at: string | null
          organization_id: string
          owner_comment: string | null
          received_at: string | null
          status: Database["public"]["Enums"]["inventory_order_status"]
          submitted_at: string | null
          trailer_id: string | null
          updated_at: string
        }
        Insert: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          notes?: string | null
          ordered_at?: string | null
          organization_id?: string
          owner_comment?: string | null
          received_at?: string | null
          status?: Database["public"]["Enums"]["inventory_order_status"]
          submitted_at?: string | null
          trailer_id?: string | null
          updated_at?: string
        }
        Update: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          notes?: string | null
          ordered_at?: string | null
          organization_id?: string
          owner_comment?: string | null
          received_at?: string | null
          status?: Database["public"]["Enums"]["inventory_order_status"]
          submitted_at?: string | null
          trailer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_receipts: {
        Row: {
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          id: string
          item_id: string
          notes: string | null
          organization_id: string
          qty: number
          received_at: string
          received_by: string | null
          supplier: string | null
        }
        Insert: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          id?: string
          item_id: string
          notes?: string | null
          organization_id?: string
          qty: number
          received_at?: string
          received_by?: string | null
          supplier?: string | null
        }
        Update: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          id?: string
          item_id?: string
          notes?: string | null
          organization_id?: string
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
          {
            foreignKeyName: "inventory_receipts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          trailer_id?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_codes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_codes_trailer_id_fkey"
            columns: ["trailer_id"]
            isOneToOne: false
            referencedRelation: "trailers"
            referencedColumns: ["id"]
          },
        ]
      }
      location_access_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          code_expires_at: string | null
          code_hash: string | null
          created_at: string
          current_trailer_id: string | null
          decision_note: string | null
          duration_minutes: number
          id: string
          organization_id: string
          reason: string | null
          requested_by: string
          requested_trailer_id: string
          status: Database["public"]["Enums"]["location_request_status"]
          updated_at: string
          used_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          code_expires_at?: string | null
          code_hash?: string | null
          created_at?: string
          current_trailer_id?: string | null
          decision_note?: string | null
          duration_minutes?: number
          id?: string
          organization_id?: string
          reason?: string | null
          requested_by: string
          requested_trailer_id: string
          status?: Database["public"]["Enums"]["location_request_status"]
          updated_at?: string
          used_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          code_expires_at?: string | null
          code_hash?: string | null
          created_at?: string
          current_trailer_id?: string | null
          decision_note?: string | null
          duration_minutes?: number
          id?: string
          organization_id?: string
          reason?: string | null
          requested_by?: string
          requested_trailer_id?: string
          status?: Database["public"]["Enums"]["location_request_status"]
          updated_at?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "location_access_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_requests: {
        Row: {
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          created_at: string
          description: string | null
          id: string
          organization_id: string
          photo_url: string | null
          priority: Database["public"]["Enums"]["alert_priority"]
          reported_by: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["maintenance_status"]
          title: string
          trailer_id: string | null
          updated_at: string
        }
        Insert: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          organization_id?: string
          photo_url?: string | null
          priority?: Database["public"]["Enums"]["alert_priority"]
          reported_by: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          title: string
          trailer_id?: string | null
          updated_at?: string
        }
        Update: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          organization_id?: string
          photo_url?: string | null
          priority?: Database["public"]["Enums"]["alert_priority"]
          reported_by?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["maintenance_status"]
          title?: string
          trailer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_requests_trailer_id_fkey"
            columns: ["trailer_id"]
            isOneToOne: false
            referencedRelation: "trailers"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          categories: Json
          created_at: string
          email_enabled: boolean
          frequency: Database["public"]["Enums"]["email_frequency"]
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          quiet_hours_timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          categories?: Json
          created_at?: string
          email_enabled?: boolean
          frequency?: Database["public"]["Enums"]["email_frequency"]
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          quiet_hours_timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          categories?: Json
          created_at?: string
          email_enabled?: boolean
          frequency?: Database["public"]["Enums"]["email_frequency"]
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          quiet_hours_timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          org_role: Database["public"]["Enums"]["org_role"]
          organization_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_role?: Database["public"]["Enums"]["org_role"]
          organization_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_role?: Database["public"]["Enums"]["org_role"]
          organization_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string | null
          status: Database["public"]["Enums"]["org_billing_status"]
          trial_ends_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug?: string | null
          status?: Database["public"]["Enums"]["org_billing_status"]
          trial_ends_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string | null
          status?: Database["public"]["Enums"]["org_billing_status"]
          trial_ends_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      prep_log: {
        Row: {
          archived_at: string | null
          category: string
          created_at: string
          id: string
          item_name: string
          logged_at: string
          logged_by: string
          notes: string | null
          organization_id: string
          quantity: number
          shift_id: string | null
          trailer_id: string | null
          unit: string
        }
        Insert: {
          archived_at?: string | null
          category?: string
          created_at?: string
          id?: string
          item_name: string
          logged_at?: string
          logged_by: string
          notes?: string | null
          organization_id?: string
          quantity: number
          shift_id?: string | null
          trailer_id?: string | null
          unit?: string
        }
        Update: {
          archived_at?: string | null
          category?: string
          created_at?: string
          id?: string
          item_name?: string
          logged_at?: string
          logged_by?: string
          notes?: string | null
          organization_id?: string
          quantity?: number
          shift_id?: string | null
          trailer_id?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "prep_log_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prep_log_logged_by_fkey"
            columns: ["logged_by"]
            isOneToOne: false
            referencedRelation: "profiles_with_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prep_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prep_log_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prep_log_trailer_id_fkey"
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
          active_organization_id: string | null
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          created_at: string
          display_name: string
          email: string | null
          handbook_acknowledged_at: string | null
          id: string
          is_super_admin: boolean
          last_login_at: string | null
          pay_rate: number | null
          sop_accepted_at: string | null
          store_id: string | null
          trailer_id: string | null
          training_completed_at: string | null
          updated_at: string
          weekly_hours: number
        }
        Insert: {
          active?: boolean
          active_organization_id?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          handbook_acknowledged_at?: string | null
          id: string
          is_super_admin?: boolean
          last_login_at?: string | null
          pay_rate?: number | null
          sop_accepted_at?: string | null
          store_id?: string | null
          trailer_id?: string | null
          training_completed_at?: string | null
          updated_at?: string
          weekly_hours?: number
        }
        Update: {
          active?: boolean
          active_organization_id?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          display_name?: string
          email?: string | null
          handbook_acknowledged_at?: string | null
          id?: string
          is_super_admin?: boolean
          last_login_at?: string | null
          pay_rate?: number | null
          sop_accepted_at?: string | null
          store_id?: string | null
          trailer_id?: string | null
          training_completed_at?: string | null
          updated_at?: string
          weekly_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_organization_id_fkey"
            columns: ["active_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
      role_email_policies: {
        Row: {
          category: string
          created_at: string
          enabled: boolean
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category: string
          created_at?: string
          enabled?: boolean
          id?: string
          organization_id?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          enabled?: boolean
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_email_policies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      rollover_runs: {
        Row: {
          alerts_archived: number
          as_of: string
          id: string
          notes: string | null
          organization_id: string
          punches_auto_closed: number
          ran_at: string
          shifts_closed: number
          tasks_missed: number
          trailer_id: string | null
        }
        Insert: {
          alerts_archived?: number
          as_of: string
          id?: string
          notes?: string | null
          organization_id?: string
          punches_auto_closed?: number
          ran_at?: string
          shifts_closed?: number
          tasks_missed?: number
          trailer_id?: string | null
        }
        Update: {
          alerts_archived?: number
          as_of?: string
          id?: string
          notes?: string | null
          organization_id?: string
          punches_auto_closed?: number
          ran_at?: string
          shifts_closed?: number
          tasks_missed?: number
          trailer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rollover_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_shifts: {
        Row: {
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          break_minutes: number
          created_at: string
          created_by: string | null
          employee_id: string | null
          end_time: string
          id: string
          notes: string | null
          organization_id: string
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
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          break_minutes?: number
          created_at?: string
          created_by?: string | null
          employee_id?: string | null
          end_time: string
          id?: string
          notes?: string | null
          organization_id?: string
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
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          break_minutes?: number
          created_at?: string
          created_by?: string | null
          employee_id?: string | null
          end_time?: string
          id?: string
          notes?: string | null
          organization_id?: string
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
            foreignKeyName: "schedule_shifts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          lock_reason: string | null
          locked_at: string | null
          locked_by: string | null
          name: string
          notes: string | null
          organization_id: string
          published_at: string | null
          published_by: string | null
          sales_target: number | null
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
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          lock_reason?: string | null
          locked_at?: string | null
          locked_by?: string | null
          name: string
          notes?: string | null
          organization_id?: string
          published_at?: string | null
          published_by?: string | null
          sales_target?: number | null
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
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          lock_reason?: string | null
          locked_at?: string | null
          locked_by?: string | null
          name?: string
          notes?: string | null
          organization_id?: string
          published_at?: string | null
          published_by?: string | null
          sales_target?: number | null
          start_date?: string
          status?: Database["public"]["Enums"]["schedule_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          trailer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_trailer_id_fkey"
            columns: ["trailer_id"]
            isOneToOne: false
            referencedRelation: "trailers"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_claim_requests: {
        Row: {
          archived_at: string | null
          claimant_id: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          organization_id: string
          reason: string | null
          schedule_shift_id: string
          status: string
          trailer_id: string | null
        }
        Insert: {
          archived_at?: string | null
          claimant_id: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          organization_id?: string
          reason?: string | null
          schedule_shift_id: string
          status?: string
          trailer_id?: string | null
        }
        Update: {
          archived_at?: string | null
          claimant_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          organization_id?: string
          reason?: string | null
          schedule_shift_id?: string
          status?: string
          trailer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_claim_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_claim_requests_schedule_shift_id_fkey"
            columns: ["schedule_shift_id"]
            isOneToOne: false
            referencedRelation: "schedule_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_claim_requests_trailer_id_fkey"
            columns: ["trailer_id"]
            isOneToOne: false
            referencedRelation: "trailers"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_notes: {
        Row: {
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          author_id: string
          created_at: string
          employee_id: string
          for_date: string | null
          id: string
          note: string
          organization_id: string
          punch_id: string | null
          schedule_shift_id: string | null
          trailer_id: string | null
          visibility: string
        }
        Insert: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          author_id: string
          created_at?: string
          employee_id: string
          for_date?: string | null
          id?: string
          note: string
          organization_id?: string
          punch_id?: string | null
          schedule_shift_id?: string | null
          trailer_id?: string | null
          visibility?: string
        }
        Update: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          author_id?: string
          created_at?: string
          employee_id?: string
          for_date?: string | null
          id?: string
          note?: string
          organization_id?: string
          punch_id?: string | null
          schedule_shift_id?: string | null
          trailer_id?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_swap_requests: {
        Row: {
          archived_at: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          organization_id: string
          reason: string | null
          requester_id: string
          schedule_shift_id: string
          status: string
          target_employee_id: string | null
          trailer_id: string | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          organization_id?: string
          reason?: string | null
          requester_id: string
          schedule_shift_id: string
          status?: string
          target_employee_id?: string | null
          trailer_id?: string | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          organization_id?: string
          reason?: string | null
          requester_id?: string
          schedule_shift_id?: string
          status?: string
          target_employee_id?: string | null
          trailer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_swap_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles_with_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_schedule_shift_id_fkey"
            columns: ["schedule_shift_id"]
            isOneToOne: false
            referencedRelation: "schedule_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_target_employee_id_fkey"
            columns: ["target_employee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_target_employee_id_fkey"
            columns: ["target_employee_id"]
            isOneToOne: false
            referencedRelation: "profiles_with_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shift_swap_requests_trailer_id_fkey"
            columns: ["trailer_id"]
            isOneToOne: false
            referencedRelation: "trailers"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_templates: {
        Row: {
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          break_minutes: number
          created_at: string
          created_by: string | null
          end_time: string
          id: string
          name: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          segment: Database["public"]["Enums"]["shift_segment"]
          start_time: string
          trailer_id: string | null
        }
        Insert: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          break_minutes?: number
          created_at?: string
          created_by?: string | null
          end_time: string
          id?: string
          name: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          segment?: Database["public"]["Enums"]["shift_segment"]
          start_time: string
          trailer_id?: string | null
        }
        Update: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          break_minutes?: number
          created_at?: string
          created_by?: string | null
          end_time?: string
          id?: string
          name?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          segment?: Database["public"]["Enums"]["shift_segment"]
          start_time?: string
          trailer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shift_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          closed_at: string | null
          closed_by: string | null
          id: string
          notes: string | null
          opened_at: string
          opened_by: string | null
          organization_id: string
          phase: Database["public"]["Enums"]["shift_phase"]
          shift_date: string
          status: Database["public"]["Enums"]["shift_status"]
          store_id: string
          trailer_id: string | null
        }
        Insert: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          closed_at?: string | null
          closed_by?: string | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          organization_id?: string
          phase?: Database["public"]["Enums"]["shift_phase"]
          shift_date?: string
          status?: Database["public"]["Enums"]["shift_status"]
          store_id: string
          trailer_id?: string | null
        }
        Update: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          closed_at?: string | null
          closed_by?: string | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string | null
          organization_id?: string
          phase?: Database["public"]["Enums"]["shift_phase"]
          shift_date?: string
          status?: Database["public"]["Enums"]["shift_status"]
          store_id?: string
          trailer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sop_acknowledgements: {
        Row: {
          acknowledged_at: string
          id: string
          organization_id: string
          sop_id: string
          user_id: string
          version: number
        }
        Insert: {
          acknowledged_at?: string
          id?: string
          organization_id?: string
          sop_id: string
          user_id: string
          version: number
        }
        Update: {
          acknowledged_at?: string
          id?: string
          organization_id?: string
          sop_id?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "sop_acknowledgements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sop_acknowledgements_sop_id_fkey"
            columns: ["sop_id"]
            isOneToOne: false
            referencedRelation: "sops"
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
          organization_id: string
          sop_id: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          id?: string
          label?: string | null
          organization_id?: string
          sop_id: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          content_type?: string | null
          created_at?: string
          id?: string
          label?: string | null
          organization_id?: string
          sop_id?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sop_attachments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
          pass_standard?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          sop_id?: string
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "sop_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sop_versions_sop_id_fkey"
            columns: ["sop_id"]
            isOneToOne: false
            referencedRelation: "sops"
            referencedColumns: ["id"]
          },
        ]
      }
      sop_views: {
        Row: {
          id: string
          organization_id: string
          sop_id: string
          user_id: string
          viewed_at: string
        }
        Insert: {
          id?: string
          organization_id?: string
          sop_id: string
          user_id: string
          viewed_at?: string
        }
        Update: {
          id?: string
          organization_id?: string
          sop_id?: string
          user_id?: string
          viewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sop_views_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sop_views_sop_id_fkey"
            columns: ["sop_id"]
            isOneToOne: false
            referencedRelation: "sops"
            referencedColumns: ["id"]
          },
        ]
      }
      sops: {
        Row: {
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          body: string
          category: string
          created_at: string
          id: string
          organization_id: string
          pass_standard: string | null
          role: Database["public"]["Enums"]["app_role"] | null
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          body: string
          category: string
          created_at?: string
          id?: string
          organization_id?: string
          pass_standard?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          body?: string
          category?: string
          created_at?: string
          id?: string
          organization_id?: string
          pass_standard?: string | null
          role?: Database["public"]["Enums"]["app_role"] | null
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "sops_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          accent_color: string | null
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          bg_color: string | null
          created_at: string
          fg_color: string | null
          id: string
          location: string | null
          name: string
          organization_id: string
          short_name: string | null
          support_email: string | null
          tagline: string | null
        }
        Insert: {
          accent_color?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          bg_color?: string | null
          created_at?: string
          fg_color?: string | null
          id?: string
          location?: string | null
          name: string
          organization_id?: string
          short_name?: string | null
          support_email?: string | null
          tagline?: string | null
        }
        Update: {
          accent_color?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          bg_color?: string | null
          created_at?: string
          fg_color?: string | null
          id?: string
          location?: string | null
          name?: string
          organization_id?: string
          short_name?: string | null
          support_email?: string | null
          tagline?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stores_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tab_permissions: {
        Row: {
          access_level: string
          enabled: boolean
          id: string
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
          scope_id?: string
          scope_type?: string
          tab_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tab_permissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      task_template_versions: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          changed_at: string
          changed_fields: string[]
          id: string
          organization_id: string
          template_id: string
          version: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          changed_at?: string
          changed_fields?: string[]
          id?: string
          organization_id?: string
          template_id: string
          version: number
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          changed_at?: string
          changed_fields?: string[]
          id?: string
          organization_id?: string
          template_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "task_template_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          active: boolean
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          organization_id: string
          phase: Database["public"]["Enums"]["shift_phase"]
          position: number
          requires_signoff: boolean
          role: Database["public"]["Enums"]["app_role"]
          title: string
          trailer_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          organization_id?: string
          phase: Database["public"]["Enums"]["shift_phase"]
          position?: number
          requires_signoff?: boolean
          role: Database["public"]["Enums"]["app_role"]
          title: string
          trailer_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          organization_id?: string
          phase?: Database["public"]["Enums"]["shift_phase"]
          position?: number
          requires_signoff?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          title?: string
          trailer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_templates_trailer_id_fkey"
            columns: ["trailer_id"]
            isOneToOne: false
            referencedRelation: "trailers"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          assignee_role: Database["public"]["Enums"]["app_role"] | null
          assignee_user_id: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          id: string
          numeric_value: number | null
          organization_id: string
          owner_id: string | null
          phase: Database["public"]["Enums"]["shift_phase"]
          photo_url: string | null
          requires_signoff: boolean
          shift_id: string
          signed_off_at: string | null
          signed_off_by: string | null
          status: Database["public"]["Enums"]["task_status"]
          template_id: string | null
          text_value: string | null
          title: string
          trailer_id: string | null
        }
        Insert: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          assignee_role?: Database["public"]["Enums"]["app_role"] | null
          assignee_user_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          numeric_value?: number | null
          organization_id?: string
          owner_id?: string | null
          phase: Database["public"]["Enums"]["shift_phase"]
          photo_url?: string | null
          requires_signoff?: boolean
          shift_id: string
          signed_off_at?: string | null
          signed_off_by?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          template_id?: string | null
          text_value?: string | null
          title: string
          trailer_id?: string | null
        }
        Update: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          assignee_role?: Database["public"]["Enums"]["app_role"] | null
          assignee_user_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          id?: string
          numeric_value?: number | null
          organization_id?: string
          owner_id?: string | null
          phase?: Database["public"]["Enums"]["shift_phase"]
          photo_url?: string | null
          requires_signoff?: boolean
          shift_id?: string
          signed_off_at?: string | null
          signed_off_by?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          template_id?: string | null
          text_value?: string | null
          title?: string
          trailer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "task_templates"
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
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_audit_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      time_corrections: {
        Row: {
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          employee_id: string
          for_date: string
          id: string
          organization_id: string
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
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          employee_id: string
          for_date: string
          id?: string
          organization_id?: string
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
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          employee_id?: string
          for_date?: string
          id?: string
          organization_id?: string
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
        Relationships: [
          {
            foreignKeyName: "time_corrections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      time_off_requests: {
        Row: {
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
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
          organization_id: string
          reason: string
          start_date: string
          start_time: string | null
          status: Database["public"]["Enums"]["request_status"]
          trailer_id: string | null
          updated_at: string
        }
        Insert: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
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
          organization_id?: string
          reason: string
          start_date: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          trailer_id?: string | null
          updated_at?: string
        }
        Update: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
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
          organization_id?: string
          reason?: string
          start_date?: string
          start_time?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          trailer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_off_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      time_punches: {
        Row: {
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          break_minutes: number
          clock_device_id: string | null
          clock_in_at: string
          clock_out_at: string | null
          created_at: string
          created_by: string | null
          device_info: Json | null
          edited_at: string | null
          edited_by: string | null
          employee_id: string
          id: string
          notes: string | null
          organization_id: string
          schedule_shift_id: string | null
          status: Database["public"]["Enums"]["punch_status"]
          trailer_id: string | null
          updated_at: string
        }
        Insert: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          break_minutes?: number
          clock_device_id?: string | null
          clock_in_at?: string
          clock_out_at?: string | null
          created_at?: string
          created_by?: string | null
          device_info?: Json | null
          edited_at?: string | null
          edited_by?: string | null
          employee_id: string
          id?: string
          notes?: string | null
          organization_id?: string
          schedule_shift_id?: string | null
          status?: Database["public"]["Enums"]["punch_status"]
          trailer_id?: string | null
          updated_at?: string
        }
        Update: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          break_minutes?: number
          clock_device_id?: string | null
          clock_in_at?: string
          clock_out_at?: string | null
          created_at?: string
          created_by?: string | null
          device_info?: Json | null
          edited_at?: string | null
          edited_by?: string | null
          employee_id?: string
          id?: string
          notes?: string | null
          organization_id?: string
          schedule_shift_id?: string | null
          status?: Database["public"]["Enums"]["punch_status"]
          trailer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_punches_clock_device_id_fkey"
            columns: ["clock_device_id"]
            isOneToOne: false
            referencedRelation: "trusted_clock_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_punches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trailers: {
        Row: {
          active: boolean
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          created_at: string
          geofence_lat: number | null
          geofence_lng: number | null
          geofence_radius_m: number
          id: string
          location: string | null
          name: string
          organization_id: string
          timezone: string
        }
        Insert: {
          active?: boolean
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          geofence_lat?: number | null
          geofence_lng?: number | null
          geofence_radius_m?: number
          id?: string
          location?: string | null
          name: string
          organization_id?: string
          timezone?: string
        }
        Update: {
          active?: boolean
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          created_at?: string
          geofence_lat?: number | null
          geofence_lng?: number | null
          geofence_radius_m?: number
          id?: string
          location?: string | null
          name?: string
          organization_id?: string
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "trailers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      trusted_clock_devices: {
        Row: {
          approved_at: string
          approved_by: string
          created_at: string
          id: string
          label: string
          last_used_at: string | null
          last_used_ip: string | null
          organization_id: string
          revoked_at: string | null
          revoked_by: string | null
          token_hash: string
          trailer_id: string
          updated_at: string
        }
        Insert: {
          approved_at?: string
          approved_by: string
          created_at?: string
          id?: string
          label: string
          last_used_at?: string | null
          last_used_ip?: string | null
          organization_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          token_hash: string
          trailer_id: string
          updated_at?: string
        }
        Update: {
          approved_at?: string
          approved_by?: string
          created_at?: string
          id?: string
          label?: string
          last_used_at?: string | null
          last_used_ip?: string | null
          organization_id?: string
          revoked_at?: string | null
          revoked_by?: string | null
          token_hash?: string
          trailer_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trusted_clock_devices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trusted_clock_devices_trailer_id_fkey"
            columns: ["trailer_id"]
            isOneToOne: false
            referencedRelation: "trailers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      waste_log: {
        Row: {
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          id: string
          item_id: string
          logged_at: string
          logged_by: string | null
          organization_id: string
          photo_url: string | null
          qty: number
          reason: string
          trailer_id: string | null
        }
        Insert: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          id?: string
          item_id: string
          logged_at?: string
          logged_by?: string | null
          organization_id?: string
          photo_url?: string | null
          qty: number
          reason: string
          trailer_id?: string | null
        }
        Update: {
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          id?: string
          item_id?: string
          logged_at?: string
          logged_by?: string | null
          organization_id?: string
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
          {
            foreignKeyName: "waste_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_rollup_runs: {
        Row: {
          enqueued: number
          id: string
          notes: string | null
          ran_at: string
          recipients: number
          week_start: string
        }
        Insert: {
          enqueued?: number
          id?: string
          notes?: string | null
          ran_at?: string
          recipients?: number
          week_start: string
        }
        Update: {
          enqueued?: number
          id?: string
          notes?: string | null
          ran_at?: string
          recipients?: number
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      profiles_with_email: {
        Row: {
          active: boolean | null
          created_at: string | null
          display_name: string | null
          email: string | null
          id: string | null
          last_login_at: string | null
          sop_accepted_at: string | null
          store_id: string | null
          trailer_id: string | null
          training_completed_at: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string | null
          last_login_at?: string | null
          sop_accepted_at?: string | null
          store_id?: string | null
          trailer_id?: string | null
          training_completed_at?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          display_name?: string | null
          email?: string | null
          id?: string | null
          last_login_at?: string | null
          sop_accepted_at?: string | null
          store_id?: string | null
          trailer_id?: string | null
          training_completed_at?: string | null
          updated_at?: string | null
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
    }
    Functions: {
      _has_open_alert: {
        Args: {
          _source_id: string
          _type: Database["public"]["Enums"]["alert_type"]
        }
        Returns: boolean
      }
      consume_invite_code: {
        Args: { _code: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      current_organization_id: { Args: never; Returns: string }
      current_user_trailer: { Args: never; Returns: string }
      decide_availability_atomic: {
        Args: { _decision: string; _id: string; _note: string }
        Returns: {
          all_day: boolean
          block_date: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          organization_id: string
          reason: string | null
          schedule_id: string | null
          status: string
          trailer_id: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "availability_blocks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      dispatch_daily_rollover: { Args: { _now?: string }; Returns: number }
      email_queue_depths: {
        Args: never
        Returns: {
          depth: number
          queue_name: string
        }[]
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_trailer_geofence: {
        Args: { _trailer_id: string }
        Returns: {
          geofence_lat: number
          geofence_lng: number
          geofence_radius_m: number
          id: string
          name: string
        }[]
      }
      has_org_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["org_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role:
        | {
            Args: {
              _org_id: string
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
        | {
            Args: {
              _role: Database["public"]["Enums"]["app_role"]
              _user_id: string
            }
            Returns: boolean
          }
      is_manager:
        | { Args: { _user_id: string }; Returns: boolean }
        | { Args: { _org_id: string; _user_id: string }; Returns: boolean }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id?: string }; Returns: boolean }
      kiosk_device_required: { Args: never; Returns: boolean }
      list_trailer_geofences: {
        Args: never
        Returns: {
          active: boolean
          geofence_lat: number
          geofence_lng: number
          geofence_radius_m: number
          id: string
          name: string
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      my_active_org_roles: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      my_email: { Args: never; Returns: string }
      my_trailer_id: { Args: never; Returns: string }
      payroll_week_start: { Args: { _d: string }; Returns: string }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      request_availability_atomic: {
        Args: {
          _block_date: string
          _employee_name: string
          _reason: string
          _requires_approval: boolean
          _schedule_id: string
          _schedule_name: string
          _schedule_status: string
          _trailer_id: string
        }
        Returns: {
          all_day: boolean
          block_date: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          organization_id: string
          reason: string | null
          schedule_id: string | null
          status: string
          trailer_id: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "availability_blocks"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      run_clock_sweep: { Args: never; Returns: undefined }
      run_daily_rollover: {
        Args: { _as_of?: string; _trailer_id: string }
        Returns: {
          alerts_archived: number
          as_of: string
          id: string
          notes: string | null
          organization_id: string
          punches_auto_closed: number
          ran_at: string
          shifts_closed: number
          tasks_missed: number
          trailer_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "rollover_runs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_active_org_context: { Args: never; Returns: undefined }
      sweep_missed_clock_in: { Args: never; Returns: undefined }
      sweep_missed_clock_out: { Args: never; Returns: undefined }
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
      alert_assigned_role: "manager" | "owner" | "all"
      alert_email_status:
        | "none"
        | "queued"
        | "sent"
        | "failed"
        | "suppressed"
        | "skipped"
      alert_priority: "critical" | "high" | "normal" | "low"
      alert_status:
        | "open"
        | "pending"
        | "approved"
        | "declined"
        | "resolved"
        | "archived"
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
        | "announcement"
        | "hr_document"
        | "hr_document_signed"
        | "time_off_decided"
        | "time_adjustment_decided"
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
      email_frequency: "immediate" | "daily_digest" | "critical_only" | "off"
      hr_assignment_status: "pending" | "viewed" | "signed" | "voided"
      hr_doc_category: "onboarding" | "training" | "hr" | "operations"
      incident_severity: "low" | "medium" | "high"
      inventory_change_action: "create" | "update" | "delete" | "archive"
      inventory_change_status: "pending" | "approved" | "declined" | "cancelled"
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
      location_request_status:
        | "pending"
        | "approved"
        | "declined"
        | "cancelled"
        | "used"
        | "expired"
      maintenance_status: "open" | "in_progress" | "resolved"
      org_billing_status:
        | "trialing"
        | "trial_expired"
        | "active"
        | "past_due_locked"
        | "suspended"
        | "cancelled"
      org_role: "org_owner" | "org_admin" | "org_member"
      punch_status: "open" | "closed" | "edited" | "voided" | "auto_closed"
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
      task_status:
        | "todo"
        | "in_progress"
        | "done"
        | "signed_off"
        | "blocked"
        | "missed"
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
      alert_assigned_role: ["manager", "owner", "all"],
      alert_email_status: [
        "none",
        "queued",
        "sent",
        "failed",
        "suppressed",
        "skipped",
      ],
      alert_priority: ["critical", "high", "normal", "low"],
      alert_status: [
        "open",
        "pending",
        "approved",
        "declined",
        "resolved",
        "archived",
      ],
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
        "announcement",
        "hr_document",
        "hr_document_signed",
        "time_off_decided",
        "time_adjustment_decided",
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
      email_frequency: ["immediate", "daily_digest", "critical_only", "off"],
      hr_assignment_status: ["pending", "viewed", "signed", "voided"],
      hr_doc_category: ["onboarding", "training", "hr", "operations"],
      incident_severity: ["low", "medium", "high"],
      inventory_change_action: ["create", "update", "delete", "archive"],
      inventory_change_status: ["pending", "approved", "declined", "cancelled"],
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
      location_request_status: [
        "pending",
        "approved",
        "declined",
        "cancelled",
        "used",
        "expired",
      ],
      maintenance_status: ["open", "in_progress", "resolved"],
      org_billing_status: [
        "trialing",
        "trial_expired",
        "active",
        "past_due_locked",
        "suspended",
        "cancelled",
      ],
      org_role: ["org_owner", "org_admin", "org_member"],
      punch_status: ["open", "closed", "edited", "voided", "auto_closed"],
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
      task_status: [
        "todo",
        "in_progress",
        "done",
        "signed_off",
        "blocked",
        "missed",
      ],
    },
  },
} as const
