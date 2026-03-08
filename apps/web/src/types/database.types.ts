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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          author: string
          body: string
          created_at: string
          id: string
          published: boolean
          title: string
          updated_at: string
        }
        Insert: {
          author?: string
          body: string
          created_at?: string
          id?: string
          published?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          author?: string
          body?: string
          created_at?: string
          id?: string
          published?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      background_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          job_type: string
          metadata: Json | null
          started_at: string | null
          status: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          job_type: string
          metadata?: Json | null
          started_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          job_type?: string
          metadata?: Json | null
          started_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "background_jobs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_history: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          description: string | null
          id: string
          invoice_pdf: string | null
          paid_at: string | null
          status: string
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          invoice_pdf?: string | null
          paid_at?: string | null
          status: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          invoice_pdf?: string | null
          paid_at?: string | null
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          arrival: string
          created_at: string | null
          departure: string
          id: string
          ownerrez_block_id: number
          property_id: number
          reason: string | null
          tenant_id: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          arrival: string
          created_at?: string | null
          departure: string
          id?: string
          ownerrez_block_id: number
          property_id: number
          reason?: string | null
          tenant_id: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          arrival?: string
          created_at?: string | null
          departure?: string
          id?: string
          ownerrez_block_id?: number
          property_id?: number
          reason?: string | null
          tenant_id?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blocks_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_charges: {
        Row: {
          amount: number
          booking_id: string
          created_at: string | null
          description: string | null
          id: string
          is_taxable: boolean | null
          position: number | null
          tax_id: string | null
          type: string
        }
        Insert: {
          amount: number
          booking_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_taxable?: boolean | null
          position?: number | null
          tax_id?: string | null
          type: string
        }
        Update: {
          amount?: number
          booking_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_taxable?: boolean | null
          position?: number | null
          tax_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_charges_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_tags: {
        Row: {
          booking_id: string
          created_at: string | null
          tag_id: string
        }
        Insert: {
          booking_id: string
          created_at?: string | null
          tag_id: string
        }
        Update: {
          booking_id?: string
          created_at?: string | null
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_tags_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          adults: number | null
          arrival: string
          booked_utc: string | null
          canceled_utc: string | null
          children: number | null
          created_at: string | null
          departure: string
          guest_email: string | null
          guest_listing_site_fee: number | null
          guest_name: string | null
          guest_phone: string | null
          host_service_fee: number | null
          id: string
          infants: number | null
          ownerrez_booking_id: string
          ownerrez_guest_id: string | null
          pets: number | null
          platform: string | null
          platform_reservation_number: string | null
          property_id: string
          status: string | null
          tenant_id: string
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          adults?: number | null
          arrival: string
          booked_utc?: string | null
          canceled_utc?: string | null
          children?: number | null
          created_at?: string | null
          departure: string
          guest_email?: string | null
          guest_listing_site_fee?: number | null
          guest_name?: string | null
          guest_phone?: string | null
          host_service_fee?: number | null
          id?: string
          infants?: number | null
          ownerrez_booking_id: string
          ownerrez_guest_id?: string | null
          pets?: number | null
          platform?: string | null
          platform_reservation_number?: string | null
          property_id: string
          status?: string | null
          tenant_id: string
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          adults?: number | null
          arrival?: string
          booked_utc?: string | null
          canceled_utc?: string | null
          children?: number | null
          created_at?: string | null
          departure?: string
          guest_email?: string | null
          guest_listing_site_fee?: number | null
          guest_name?: string | null
          guest_phone?: string | null
          host_service_fee?: number | null
          id?: string
          infants?: number | null
          ownerrez_booking_id?: string
          ownerrez_guest_id?: string | null
          pets?: number | null
          platform?: string | null
          platform_reservation_number?: string | null
          property_id?: string
          status?: string | null
          tenant_id?: string
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          amount: number
          budget_month: number | null
          budget_year: number
          category_id: string
          created_at: string | null
          id: string
          property_id: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          budget_month?: number | null
          budget_year: number
          category_id: string
          created_at?: string | null
          id?: string
          property_id?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          budget_month?: number | null
          budget_year?: number
          category_id?: string
          created_at?: string | null
          id?: string
          property_id?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budgets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_allocations: {
        Row: {
          allocated_amount: number
          allocation_percentage: number
          created_at: string | null
          expense_id: string
          id: string
          property_id: string
        }
        Insert: {
          allocated_amount: number
          allocation_percentage: number
          created_at?: string | null
          expense_id: string
          id?: string
          property_id: string
        }
        Update: {
          allocated_amount?: number
          allocation_percentage?: number
          created_at?: string | null
          expense_id?: string
          id?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_allocations_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_allocations_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_category_id: string | null
          tenant_id: string
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_category_id?: string | null
          tenant_id: string
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_category_id?: string | null
          tenant_id?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_parent_category_id_fkey"
            columns: ["parent_category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_templates: {
        Row: {
          amount: number
          category: string
          created_at: string | null
          description: string | null
          id: string
          property_id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          property_id: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          property_id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_templates_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          booking_id: string | null
          category_id: string
          created_at: string | null
          description: string | null
          expense_date: string
          id: string
          invoice_number: string | null
          is_recurring: boolean | null
          property_id: string | null
          recurrence_pattern: string | null
          tenant_id: string
          updated_at: string | null
          vendor_name: string | null
        }
        Insert: {
          amount: number
          booking_id?: string | null
          category_id: string
          created_at?: string | null
          description?: string | null
          expense_date: string
          id?: string
          invoice_number?: string | null
          is_recurring?: boolean | null
          property_id?: string | null
          recurrence_pattern?: string | null
          tenant_id: string
          updated_at?: string | null
          vendor_name?: string | null
        }
        Update: {
          amount?: number
          booking_id?: string | null
          category_id?: string
          created_at?: string | null
          description?: string | null
          expense_date?: string
          id?: string
          invoice_number?: string | null
          is_recurring?: boolean | null
          property_id?: string | null
          recurrence_pattern?: string | null
          tenant_id?: string
          updated_at?: string | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string | null
          id: string
          is_enabled: boolean
          metric_key: string
          period: string
          target_value: number
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_enabled?: boolean
          metric_key: string
          period?: string
          target_value: number
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_enabled?: boolean
          metric_key?: string
          period?: string
          target_value?: number
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_tags: {
        Row: {
          created_at: string | null
          guest_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string | null
          guest_id: string
          tag_id: string
        }
        Update: {
          created_at?: string | null
          guest_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_tags_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "guest_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          created_at: string | null
          data: Json | null
          email: string | null
          first_name: string | null
          full_name: string | null
          id: string
          last_name: string | null
          ownerrez_guest_id: number
          phone: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          ownerrez_guest_id: number
          phone?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          id?: string
          last_name?: string | null
          ownerrez_guest_id?: number
          phone?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiries: {
        Row: {
          arrival: string | null
          created_at: string | null
          data: Json | null
          departure: string | null
          guest_email: string | null
          guest_name: string | null
          id: string
          ownerrez_inquiry_id: number
          property_id: number | null
          status: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          arrival?: string | null
          created_at?: string | null
          data?: Json | null
          departure?: string | null
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          ownerrez_inquiry_id: number
          property_id?: number | null
          status?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          arrival?: string | null
          created_at?: string | null
          data?: Json | null
          departure?: string | null
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          ownerrez_inquiry_id?: number
          property_id?: number | null
          status?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inquiries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_states: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          tenant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_states_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_tokens: {
        Row: {
          access_token: string
          created_at: string | null
          expires_at: string
          id: string
          provider: string
          refresh_token: string | null
          scope: string | null
          tenant_id: string
          token_type: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          access_token: string
          created_at?: string | null
          expires_at: string
          id?: string
          provider?: string
          refresh_token?: string | null
          scope?: string | null
          tenant_id: string
          token_type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          provider?: string
          refresh_token?: string | null
          scope?: string | null
          tenant_id?: string
          token_type?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "oauth_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      operating_expenses: {
        Row: {
          amount: number
          category: string
          created_at: string | null
          description: string | null
          id: string
          month: number
          notes: string | null
          property_id: string
          tenant_id: string
          updated_at: string | null
          year: number
        }
        Insert: {
          amount: number
          category: string
          created_at?: string | null
          description?: string | null
          id?: string
          month: number
          notes?: string | null
          property_id: string
          tenant_id: string
          updated_at?: string | null
          year: number
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          month?: number
          notes?: string | null
          property_id?: string
          tenant_id?: string
          updated_at?: string | null
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "operating_expenses_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operating_expenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          brand: string | null
          created_at: string | null
          exp_month: number | null
          exp_year: number | null
          id: string
          is_default: boolean | null
          last4: string | null
          stripe_payment_method_id: string
          tenant_id: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          brand?: string | null
          created_at?: string | null
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean | null
          last4?: string | null
          stripe_payment_method_id: string
          tenant_id: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          brand?: string | null
          created_at?: string | null
          exp_month?: number | null
          exp_year?: number | null
          id?: string
          is_default?: boolean | null
          last4?: string | null
          stripe_payment_method_id?: string
          tenant_id?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_fee_entries: {
        Row: {
          api_sync_date: string | null
          booking_id: string | null
          created_at: string | null
          created_by: string | null
          data_source: string | null
          effective_tax_rate: number | null
          guest_service_fee: number | null
          host_service_fee: number | null
          id: string
          month: string
          notes: string | null
          platform: string
          platform_collected_tax: number | null
          platform_remits_tax: boolean | null
          platform_tax_remitted: number | null
          property_id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          api_sync_date?: string | null
          booking_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_source?: string | null
          effective_tax_rate?: number | null
          guest_service_fee?: number | null
          host_service_fee?: number | null
          id?: string
          month: string
          notes?: string | null
          platform: string
          platform_collected_tax?: number | null
          platform_remits_tax?: boolean | null
          platform_tax_remitted?: number | null
          property_id: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          api_sync_date?: string | null
          booking_id?: string | null
          created_at?: string | null
          created_by?: string | null
          data_source?: string | null
          effective_tax_rate?: number | null
          guest_service_fee?: number | null
          host_service_fee?: number | null
          id?: string
          month?: string
          notes?: string | null
          platform?: string
          platform_collected_tax?: number | null
          platform_remits_tax?: boolean | null
          platform_tax_remitted?: number | null
          property_id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_fee_entries_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_fee_entries_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_fee_entries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_guest_fees: {
        Row: {
          amount: number
          booking_id: string | null
          created_at: string | null
          guest_service_fee: number | null
          host_service_fee: number | null
          id: string
          month: number | null
          notes: string | null
          platform: string
          platform_tax_remitted: number | null
          property_id: string | null
          tenant_id: string
          updated_at: string | null
          year: number | null
        }
        Insert: {
          amount: number
          booking_id?: string | null
          created_at?: string | null
          guest_service_fee?: number | null
          host_service_fee?: number | null
          id?: string
          month?: number | null
          notes?: string | null
          platform: string
          platform_tax_remitted?: number | null
          property_id?: string | null
          tenant_id: string
          updated_at?: string | null
          year?: number | null
        }
        Update: {
          amount?: number
          booking_id?: string | null
          created_at?: string | null
          guest_service_fee?: number | null
          host_service_fee?: number | null
          id?: string
          month?: number | null
          notes?: string | null
          platform?: string
          platform_tax_remitted?: number | null
          property_id?: string | null
          tenant_id?: string
          updated_at?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "platform_guest_fees_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_guest_fees_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_guest_fees_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          active: boolean | null
          address: string | null
          bathrooms: number | null
          bedrooms: number | null
          city: string | null
          created_at: string | null
          deleted_at: string | null
          id: string
          internal_code: string | null
          latitude: number | null
          longitude: number | null
          max_guests: number | null
          name: string
          ownerrez_id: string
          postal_code: string | null
          public_url: string | null
          state: string | null
          tenant_id: string
          thumbnail_url: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          internal_code?: string | null
          latitude?: number | null
          longitude?: number | null
          max_guests?: number | null
          name: string
          ownerrez_id: string
          postal_code?: string | null
          public_url?: string | null
          state?: string | null
          tenant_id: string
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          internal_code?: string | null
          latitude?: number | null
          longitude?: number | null
          max_guests?: number | null
          name?: string
          ownerrez_id?: string
          postal_code?: string | null
          public_url?: string | null
          state?: string | null
          tenant_id?: string
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      property_tags: {
        Row: {
          created_at: string | null
          property_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string | null
          property_id: string
          tag_id: string
        }
        Update: {
          created_at?: string | null
          property_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_tags_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      property_tax_configs: {
        Row: {
          auto_detected: boolean | null
          config_name: string
          created_at: string | null
          effective_from: string
          effective_to: string | null
          id: string
          is_active: boolean | null
          jurisdictions: Json
          last_sync_date: string | null
          ownerrez_mappings: Json | null
          platform_settings: Json
          property_id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          auto_detected?: boolean | null
          config_name: string
          created_at?: string | null
          effective_from: string
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          jurisdictions: Json
          last_sync_date?: string | null
          ownerrez_mappings?: Json | null
          platform_settings: Json
          property_id: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          auto_detected?: boolean | null
          config_name?: string
          created_at?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          jurisdictions?: Json
          last_sync_date?: string | null
          ownerrez_mappings?: Json | null
          platform_settings?: Json
          property_id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_tax_configs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_tax_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          arrival: string | null
          created_at: string | null
          data: Json | null
          departure: string | null
          guest_email: string | null
          guest_name: string | null
          id: string
          ownerrez_quote_id: number
          property_id: number | null
          status: string | null
          tenant_id: string
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          arrival?: string | null
          created_at?: string | null
          data?: Json | null
          departure?: string | null
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          ownerrez_quote_id: number
          property_id?: number | null
          status?: string | null
          tenant_id: string
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          arrival?: string | null
          created_at?: string | null
          data?: Json | null
          departure?: string | null
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          ownerrez_quote_id?: number
          property_id?: number | null
          status?: string | null
          tenant_id?: string
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      refresh_tokens: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          token_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          token_hash: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          token_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      season_configurations: {
        Row: {
          created_at: string | null
          end_day: number
          end_month: number
          id: string
          is_active: boolean | null
          name: string
          start_day: number
          start_month: number
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          end_day: number
          end_month: number
          id?: string
          is_active?: boolean | null
          name: string
          start_day: number
          start_month: number
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          end_day?: number
          end_month?: number
          id?: string
          is_active?: boolean | null
          name?: string
          start_day?: number
          start_month?: number
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "season_configurations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_customers: {
        Row: {
          created_at: string | null
          email: string
          id: string
          stripe_customer_id: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          stripe_customer_id: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          stripe_customer_id?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stripe_customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          payload: Json | null
          processed: boolean | null
          processed_at: string | null
          processing_error: string | null
          stripe_event_id: string
          tenant_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          processed?: boolean | null
          processed_at?: string | null
          processing_error?: string | null
          stripe_event_id: string
          tenant_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          processed?: boolean | null
          processed_at?: string | null
          processing_error?: string | null
          stripe_event_id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stripe_webhook_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          billing_cycle: string | null
          cancel_at: string | null
          canceled_at: string | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string
          metadata: Json | null
          plan_id: string | null
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          tenant_id: string
          trial_end: string | null
          trial_start: string | null
          updated_at: string | null
        }
        Insert: {
          billing_cycle?: string | null
          cancel_at?: string | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          metadata?: Json | null
          plan_id?: string | null
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          tenant_id: string
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string | null
        }
        Update: {
          billing_cycle?: string | null
          cancel_at?: string | null
          canceled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          metadata?: Json | null
          plan_id?: string | null
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          tenant_id?: string
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_stripe_customer_id_fkey"
            columns: ["stripe_customer_id"]
            isOneToOne: false
            referencedRelation: "stripe_customers"
            referencedColumns: ["stripe_customer_id"]
          },
          {
            foreignKeyName: "subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_progress: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          metadata: Json | null
          processed_items: number | null
          started_at: string | null
          status: string
          sync_type: string
          tenant_id: string
          total_items: number | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          processed_items?: number | null
          started_at?: string | null
          status: string
          sync_type: string
          tenant_id: string
          total_items?: number | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          metadata?: Json | null
          processed_items?: number | null
          started_at?: string | null
          status?: string
          sync_type?: string
          tenant_id?: string
          total_items?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_progress_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_status: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          last_sync: string | null
          records_synced: number | null
          status: string | null
          sync_type: string
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_sync?: string | null
          records_synced?: number | null
          status?: string | null
          sync_type: string
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          last_sync?: string | null
          records_synced?: number | null
          status?: string | null
          sync_type?: string
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_status_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          ownerrez_id: string | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          ownerrez_id?: string | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          ownerrez_id?: string | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tags_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_platform_configs: {
        Row: {
          created_at: string | null
          id: string
          jurisdictions: Json | null
          notes: string | null
          platform: string
          remits_occupancy_tax: boolean | null
          remits_on_guest_fees: boolean | null
          tenant_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          jurisdictions?: Json | null
          notes?: string | null
          platform: string
          remits_occupancy_tax?: boolean | null
          remits_on_guest_fees?: boolean | null
          tenant_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          jurisdictions?: Json | null
          notes?: string | null
          platform?: string
          remits_occupancy_tax?: boolean | null
          remits_on_guest_fees?: boolean | null
          tenant_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_platform_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          company_name: string | null
          created_at: string | null
          email: string
          first_subscription_at: string | null
          id: string
          ownerrez_connected: boolean | null
          ownerrez_disconnected_at: string | null
          ownerrez_user_id: string | null
          subscription_ends_at: string | null
          subscription_exempt: boolean | null
          subscription_status: string | null
          trial_ends_at: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          company_name?: string | null
          created_at?: string | null
          email: string
          first_subscription_at?: string | null
          id?: string
          ownerrez_connected?: boolean | null
          ownerrez_disconnected_at?: string | null
          ownerrez_user_id?: string | null
          subscription_ends_at?: string | null
          subscription_exempt?: boolean | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          company_name?: string | null
          created_at?: string | null
          email?: string
          first_subscription_at?: string | null
          id?: string
          ownerrez_connected?: boolean | null
          ownerrez_disconnected_at?: string | null
          ownerrez_user_id?: string | null
          subscription_ends_at?: string | null
          subscription_exempt?: boolean | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      usage_metrics: {
        Row: {
          count: number
          created_at: string | null
          id: string
          metadata: Json | null
          metric_type: string
          period_end: string
          period_start: string
          tenant_id: string
        }
        Insert: {
          count?: number
          created_at?: string | null
          id?: string
          metadata?: Json | null
          metric_type: string
          period_end: string
          period_start: string
          tenant_id: string
        }
        Update: {
          count?: number
          created_at?: string | null
          id?: string
          metadata?: Json | null
          metric_type?: string
          period_end?: string
          period_start?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_metrics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          action: string
          categories: string[] | null
          created_at: string | null
          entity_id: string | null
          entity_type: string | null
          event_id: string
          id: string
          payload: Json | null
          processed: boolean | null
          processed_at: string | null
          tenant_id: string
        }
        Insert: {
          action: string
          categories?: string[] | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_id: string
          id?: string
          payload?: Json | null
          processed?: boolean | null
          processed_at?: string | null
          tenant_id: string
        }
        Update: {
          action?: string
          categories?: string[] | null
          created_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          event_id?: string
          id?: string
          payload?: Json | null
          processed?: boolean | null
          processed_at?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_occupancy: {
        Args: {
          p_end_date: string
          p_property_id?: string
          p_start_date: string
          p_tag_ids?: string[]
          p_tenant_id: string
        }
        Returns: {
          booked_nights: number
          occupancy_rate: number
          total_nights: number
        }[]
      }
      cleanup_expired_oauth_states: { Args: never; Returns: undefined }
      current_tenant_id: { Args: never; Returns: string }
      get_database_stats: {
        Args: never
        Returns: {
          row_count: number
          size_pretty: string
          table_name: string
        }[]
      }
      get_financial_summary: {
        Args: {
          p_end_date: string
          p_start_date: string
          p_tag_ids?: string[]
          p_tenant_id: string
        }
        Returns: {
          avg_booking_value: number
          booking_count: number
          net_income: number
          occupancy_rate: number
          total_expenses: number
          total_revenue: number
        }[]
      }
      get_guest_analytics: {
        Args: { p_end_date: string; p_start_date: string; p_tenant_id: string }
        Returns: {
          avg_stay_length: number
          repeat_guests: number
          repeat_rate: number
          top_guest_bookings: number
          top_guest_name: string
          total_guests: number
          unique_guests: number
        }[]
      }
      get_property_metrics: {
        Args: { p_end_date: string; p_start_date: string; p_tenant_id: string }
        Returns: {
          avg_nightly_rate: number
          bookings: number
          occupancy_rate: number
          property_id: string
          property_name: string
          revenue: number
        }[]
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
    Enums: {},
  },
} as const
