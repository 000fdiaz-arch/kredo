export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type ClientStatus = "current" | "interest_pending" | "late" | "no_movements" | "inactive";

export type Database = {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string;
          user_id: string;
          client_code: string;
          full_name: string;
          identification: string | null;
          phone: string | null;
          address: string | null;
          reference_name: string | null;
          reference_phone: string | null;
          status: ClientStatus;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          client_code: string;
          full_name: string;
          identification?: string | null;
          phone?: string | null;
          address?: string | null;
          reference_name?: string | null;
          reference_phone?: string | null;
          status?: ClientStatus;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          client_code?: string;
          full_name?: string;
          identification?: string | null;
          phone?: string | null;
          address?: string | null;
          reference_name?: string | null;
          reference_phone?: string | null;
          status?: ClientStatus;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      cycles: {
        Row: {
          id: string;
          user_id: string;
          start_date: string;
          end_date: string;
          status: "open" | "closed";
          capital_initial_cents: number;
          new_loans_cents: number;
          interest_generated_cents: number;
          payments_received_cents: number;
          interest_collected_cents: number;
          principal_recovered_cents: number;
          capital_final_cents: number;
          interest_pending_final_cents: number;
          closed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          start_date: string;
          end_date: string;
          status?: "open" | "closed";
          capital_initial_cents?: number;
          new_loans_cents?: number;
          interest_generated_cents?: number;
          payments_received_cents?: number;
          interest_collected_cents?: number;
          principal_recovered_cents?: number;
          capital_final_cents?: number;
          interest_pending_final_cents?: number;
          closed_at?: string | null;
          created_at?: string;
        };
        Update: {
          status?: "open" | "closed";
          capital_initial_cents?: number;
          new_loans_cents?: number;
          interest_generated_cents?: number;
          payments_received_cents?: number;
          interest_collected_cents?: number;
          principal_recovered_cents?: number;
          capital_final_cents?: number;
          interest_pending_final_cents?: number;
          closed_at?: string | null;
        };
        Relationships: [];
      };
      loans: {
        Row: {
          id: string;
          user_id: string;
          client_id: string;
          cycle_id: string;
          loan_date: string;
          principal_amount_cents: number;
          interest_rate_bps: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
          voided_at: string | null;
          voided_by: string | null;
          void_reason: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          client_id: string;
          cycle_id: string;
          loan_date: string;
          principal_amount_cents: number;
          interest_rate_bps: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          voided_at?: string | null;
          voided_by?: string | null;
          void_reason?: string | null;
        };
        Update: {
          notes?: string | null;
          updated_at?: string;
          voided_at?: string | null;
          voided_by?: string | null;
          void_reason?: string | null;
        };
        Relationships: [];
      };
      interest_charges: {
        Row: {
          id: string;
          user_id: string;
          client_id: string;
          cycle_id: string;
          principal_base_cents: number;
          interest_rate_bps: number;
          interest_amount_cents: number;
          generated_at: string;
          voided_at: string | null;
          voided_by: string | null;
          void_reason: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          client_id: string;
          cycle_id: string;
          principal_base_cents: number;
          interest_rate_bps: number;
          interest_amount_cents: number;
          generated_at?: string;
          voided_at?: string | null;
          voided_by?: string | null;
          void_reason?: string | null;
        };
        Update: {
          voided_at?: string | null;
          voided_by?: string | null;
          void_reason?: string | null;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string;
          entity_type: string;
          entity_id: string;
          action: "create" | "update" | "void" | "close_cycle" | "generate_interest";
          previous_data: Json | null;
          new_data: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          entity_type: string;
          entity_id: string;
          action: "create" | "update" | "void" | "close_cycle" | "generate_interest";
          previous_data?: Json | null;
          new_data?: Json | null;
          created_at?: string;
        };
        Update: {
          previous_data?: Json | null;
          new_data?: Json | null;
        };
        Relationships: [];
      };
    };
    Views: {
      client_balances: {
        Row: {
          user_id: string;
          client_id: string;
          principal_balance_cents: number;
          interest_balance_cents: number;
          total_balance_cents: number;
        };
        Relationships: [];
      };
      client_movements: {
        Row: {
          user_id: string;
          client_id: string;
          movement_id: string;
          movement_date: string;
          movement_type: "loan" | "payment" | "interest_charge" | "adjustment" | "note";
          amount_cents: number;
          principal_amount_cents: number;
          interest_amount_cents: number;
          cycle_id: string | null;
          notes: string | null;
          voided_at: string | null;
          created_at: string;
        };
        Relationships: [];
      };
    };
    Functions: Record<string, never>;
    Enums: {
      client_status: ClientStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
