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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      alert_events: {
        Row: {
          created_at: string
          cycle_key: string
          error_message: string | null
          id: string
          organization_id: string
          recipient: string
          status: string
          type: string
        }
        Insert: {
          created_at?: string
          cycle_key: string
          error_message?: string | null
          id?: string
          organization_id: string
          recipient: string
          status: string
          type: string
        }
        Update: {
          created_at?: string
          cycle_key?: string
          error_message?: string | null
          id?: string
          organization_id?: string
          recipient?: string
          status?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string
          id: string
          organization_id: string | null
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type: string
          id?: string
          organization_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string
          id?: string
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          budget_cents: number | null
          cost_per_result_cents: number | null
          delivery_status: string
          ends_on: string | null
          external_campaign_id: string
          id: string
          impressions: number
          meta_account_id: string
          name: string
          organization_id: string
          reach: number
          result_type: string
          results: number
          spent_cents: number | null
          starts_on: string | null
          updated_at: string
        }
        Insert: {
          budget_cents?: number | null
          cost_per_result_cents?: number | null
          delivery_status: string
          ends_on?: string | null
          external_campaign_id: string
          id?: string
          impressions?: number
          meta_account_id: string
          name: string
          organization_id: string
          reach?: number
          result_type: string
          results?: number
          spent_cents?: number | null
          starts_on?: string | null
          updated_at?: string
        }
        Update: {
          budget_cents?: number | null
          cost_per_result_cents?: number | null
          delivery_status?: string
          ends_on?: string | null
          external_campaign_id?: string
          id?: string
          impressions?: number
          meta_account_id?: string
          name?: string
          organization_id?: string
          reach?: number
          result_type?: string
          results?: number
          spent_cents?: number | null
          starts_on?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_meta_account_id_fkey"
            columns: ["meta_account_id"]
            isOneToOne: false
            referencedRelation: "meta_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          due_day: number
          ends_on: string | null
          external_subscription_id: string | null
          fine_percent: number
          id: string
          interest_percent_monthly: number
          monthly_fee_cents: number
          organization_id: string
          starts_on: string
          updated_at: string
        }
        Insert: {
          due_day: number
          ends_on?: string | null
          external_subscription_id?: string | null
          fine_percent?: number
          id?: string
          interest_percent_monthly?: number
          monthly_fee_cents: number
          organization_id: string
          starts_on: string
          updated_at?: string
        }
        Update: {
          due_day?: number
          ends_on?: string | null
          external_subscription_id?: string | null
          fine_percent?: number
          id?: string
          interest_percent_monthly?: number
          monthly_fee_cents?: number
          organization_id?: string
          starts_on?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_files: {
        Row: {
          created_at: string
          created_by: string
          folder_id: string | null
          id: string
          mime_type: string
          name: string
          organization_id: string
          size_bytes: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          created_by: string
          folder_id?: string | null
          id?: string
          mime_type: string
          name: string
          organization_id: string
          size_bytes: number
          storage_path: string
        }
        Update: {
          created_at?: string
          created_by?: string
          folder_id?: string | null
          id?: string
          mime_type?: string
          name?: string
          organization_id?: string
          size_bytes?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_files_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "creative_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_files_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_folders: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          organization_id: string
          parent_id: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          organization_id: string
          parent_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          organization_id?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creative_folders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "creative_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          base_amount_cents: number
          competence: string
          contract_id: string
          due_date: string
          external_charge_id: string | null
          id: string
          invoice_url: string | null
          organization_id: string
          paid_at: string | null
          penalties_waived: boolean
          pix_code: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          total_amount_cents: number
          updated_at: string
        }
        Insert: {
          base_amount_cents: number
          competence: string
          contract_id: string
          due_date: string
          external_charge_id?: string | null
          id?: string
          invoice_url?: string | null
          organization_id: string
          paid_at?: string | null
          penalties_waived?: boolean
          pix_code?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          total_amount_cents: number
          updated_at?: string
        }
        Update: {
          base_amount_cents?: number
          competence?: string
          contract_id?: string
          due_date?: string
          external_charge_id?: string | null
          id?: string
          invoice_url?: string | null
          organization_id?: string
          paid_at?: string | null
          penalties_waived?: boolean
          pix_code?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          total_amount_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_connections: {
        Row: {
          access_token_encrypted: string | null
          connected_at: string | null
          connected_by: string | null
          id: string
          last_error: string | null
          last_sync_at: string | null
          meta_user_id: string | null
          organization_id: string
          status: string
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token_encrypted?: string | null
          connected_at?: string | null
          connected_by?: string | null
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          meta_user_id?: string | null
          organization_id: string
          status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token_encrypted?: string | null
          connected_at?: string | null
          connected_by?: string | null
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          meta_user_id?: string | null
          organization_id?: string
          status?: string
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      meta_oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          organization_id: string
          state: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          organization_id: string
          state: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          organization_id?: string
          state?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      meta_accounts: {
        Row: {
          balance_cents: number
          balance_url: string | null
          prepaid_ledger: Json | null
          currency: string
          account_status: string | null
          connection_id: string | null
          external_account_id: string
          id: string
          last_synced_at: string | null
          name: string
          organization_id: string
          portfolio_id: string | null
          selected: boolean
          sync_status: string
        }
        Insert: {
          account_status?: string | null
          balance_cents?: number
          balance_url?: string | null
          connection_id?: string | null
          currency?: string
          external_account_id: string
          prepaid_ledger?: Json | null
          id?: string
          last_synced_at?: string | null
          name: string
          organization_id: string
          portfolio_id?: string | null
          selected?: boolean
          sync_status?: string
        }
        Update: {
          account_status?: string | null
          balance_cents?: number
          balance_url?: string | null
          connection_id?: string | null
          currency?: string
          external_account_id?: string
          prepaid_ledger?: Json | null
          id?: string
          last_synced_at?: string | null
          name?: string
          organization_id?: string
          portfolio_id?: string | null
          selected?: boolean
          sync_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_accounts_organization_id_fkey"
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
          document: string
          finance_phone: string
          id: string
          legal_name: string
          meta_low_balance_alerted_at: string | null
          responsible_email: string
          responsible_name: string
          responsible_phone: string
          status: Database["public"]["Enums"]["client_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          document: string
          finance_phone: string
          id?: string
          legal_name: string
          meta_low_balance_alerted_at?: string | null
          responsible_email: string
          responsible_name: string
          responsible_phone: string
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          document?: string
          finance_phone?: string
          id?: string
          legal_name?: string
          meta_low_balance_alerted_at?: string | null
          responsible_email?: string
          responsible_name?: string
          responsible_phone?: string
          status?: Database["public"]["Enums"]["client_status"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          finance_email: string | null
          finance_email_same: boolean
          full_name: string
          id: string
          is_blocked: boolean
          organization_id: string | null
          owner_id: string | null
          theme: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          finance_email?: string | null
          finance_email_same?: boolean
          full_name: string
          id: string
          is_blocked?: boolean
          organization_id?: string | null
          owner_id?: string | null
          theme?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          finance_email?: string | null
          finance_email_same?: boolean
          full_name?: string
          id?: string
          is_blocked?: boolean
          organization_id?: string | null
          owner_id?: string | null
          theme?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_permissions: {
        Row: {
          can_add_meta_credit: boolean
          can_manage_users: boolean
          can_view_campaigns: boolean
          can_view_meta_balance: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          can_add_meta_credit?: boolean
          can_manage_users?: boolean
          can_view_campaigns?: boolean
          can_view_meta_balance?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          can_add_meta_credit?: boolean
          can_manage_users?: boolean
          can_view_campaigns?: boolean
          can_view_meta_balance?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_organization_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_master: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "master" | "client_admin" | "client_user"
      client_status:
        | "active"
        | "overdue"
        | "blocked"
        | "contract_ended"
        | "disabled"
      invoice_status: "pending" | "overdue" | "paid" | "cancelled"
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
  public: {
    Enums: {
      app_role: ["master", "client_admin", "client_user"],
      client_status: [
        "active",
        "overdue",
        "blocked",
        "contract_ended",
        "disabled",
      ],
      invoice_status: ["pending", "overdue", "paid", "cancelled"],
    },
  },
} as const
