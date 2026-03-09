// Auto-generated from Supabase schema — do not edit manually
// Run: supabase gen types typescript --project-id otolaopaqpeljpfhdkhm > src/types/database.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          role: 'admin' | 'analyst' | 'viewer'
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      properties: {
        Row: {
          id: string
          user_id: string
          group_id: string | null
          name: string
          address: string
          city: string
          state: string
          zip: string
          lat: number | null
          lng: number | null
          property_type: string
          units: number | null
          sf: number | null
          year_built: number | null
          status: 'active' | 'pipeline' | 'closed' | 'dead'
          stage: string | null
          purchase_price: number | null
          current_value: number | null
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['properties']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['properties']['Insert']>
      }
      property_groups: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['property_groups']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['property_groups']['Insert']>
      }
      deals: {
        Row: {
          id: string
          property_id: string
          user_id: string
          stage: 'sourced' | 'screening' | 'loi' | 'due_diligence' | 'closing' | 'closed' | 'dead'
          priority: 'high' | 'medium' | 'low'
          assigned_to: string | null
          source: string | null
          broker_name: string | null
          broker_email: string | null
          asking_price: number | null
          target_close_date: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['deals']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['deals']['Insert']>
      }
      unit_mix: {
        Row: {
          id: string
          property_id: string
          unit_type: string
          units: number
          sf: number
          market_rent: number
          in_place_rent: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['unit_mix']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['unit_mix']['Insert']>
      }
      rent_roll: {
        Row: {
          id: string
          property_id: string
          unit_number: string
          unit_type: string
          tenant_name: string | null
          lease_start: string | null
          lease_end: string | null
          monthly_rent: number
          sqft: number | null
          status: 'occupied' | 'vacant' | 'notice' | 'model'
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['rent_roll']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['rent_roll']['Insert']>
      }
      annual_pro_forma: {
        Row: {
          id: string
          property_id: string
          year: number
          gpi: number
          vacancy_loss: number
          egi: number
          operating_expenses: number
          noi: number
          debt_service: number
          cash_flow: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['annual_pro_forma']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['annual_pro_forma']['Insert']>
      }
      debt_tranches: {
        Row: {
          id: string
          property_id: string
          tranche_name: string
          loan_amount: number
          rate: number
          rate_type: 'fixed' | 'floating'
          spread: number | null
          index: string | null
          amortization: number
          io_period: number
          maturity_date: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['debt_tranches']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['debt_tranches']['Insert']>
      }
      waterfall_structure: {
        Row: {
          id: string
          property_id: string
          preferred_return: number
          gp_promote: number
          hurdle_1: number
          hurdle_1_split_lp: number
          hurdle_2: number | null
          hurdle_2_split_lp: number | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['waterfall_structure']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['waterfall_structure']['Insert']>
      }
      irr_sensitivity: {
        Row: {
          id: string
          property_id: string
          exit_cap_rate: number
          rent_growth: number
          irr: number
          equity_multiple: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['irr_sensitivity']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['irr_sensitivity']['Insert']>
      }
      uw_checklist_items: {
        Row: {
          id: string
          deal_id: string
          category: string
          item: string
          status: 'pending' | 'in_review' | 'complete' | 'na'
          notes: string | null
          completed_by: string | null
          completed_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['uw_checklist_items']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['uw_checklist_items']['Insert']>
      }
      email_connections: {
        Row: {
          id: string
          user_id: string
          provider: 'gmail' | 'outlook'
          email: string
          access_token: string
          refresh_token: string | null
          token_expiry: string | null
          watch_expiry: string | null
          is_active: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['email_connections']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['email_connections']['Insert']>
      }
      email_inbox: {
        Row: {
          id: string
          user_id: string
          connection_id: string
          message_id: string
          thread_id: string | null
          from_email: string
          from_name: string | null
          subject: string
          body_text: string | null
          body_html: string | null
          received_at: string
          ai_score: number | null
          ai_summary: string | null
          ai_category: string | null
          deal_id: string | null
          processed: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['email_inbox']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['email_inbox']['Insert']>
      }
      scrape_jobs: {
        Row: {
          id: string
          property_id: string
          user_id: string
          source: string
          status: 'pending' | 'running' | 'complete' | 'failed'
          started_at: string | null
          completed_at: string | null
          error: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['scrape_jobs']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['scrape_jobs']['Insert']>
      }
      scraped_data: {
        Row: {
          id: string
          job_id: string
          property_id: string
          source: string
          data_type: string
          data: Json
          source_url: string | null
          scraped_at: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['scraped_data']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['scraped_data']['Insert']>
      }
      market_rates: {
        Row: {
          id: string
          series_id: string
          series_name: string
          value: number
          observation_date: string
          fetched_at: string
        }
        Insert: Omit<Database['public']['Tables']['market_rates']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['market_rates']['Insert']>
      }
      sofr_forward_curve: {
        Row: {
          id: string
          tenor_months: number
          rate: number
          fetched_at: string
        }
        Insert: Omit<Database['public']['Tables']['sofr_forward_curve']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['sofr_forward_curve']['Insert']>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}
