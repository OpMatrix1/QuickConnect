export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          role: 'customer' | 'provider' | 'admin'
          full_name: string
          phone: string | null
          avatar_url: string | null
          city: string | null
          bio: string | null
          location: unknown | null
          email_verified: boolean
          is_active: boolean
          two_fa_enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          role: 'customer' | 'provider' | 'admin'
          full_name: string
          phone?: string | null
          avatar_url?: string | null
          city?: string | null
          bio?: string | null
          location?: unknown | null
          email_verified?: boolean
          is_active?: boolean
          two_fa_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          role?: 'customer' | 'provider' | 'admin'
          full_name?: string
          phone?: string | null
          avatar_url?: string | null
          city?: string | null
          bio?: string | null
          location?: unknown | null
          email_verified?: boolean
          is_active?: boolean
          two_fa_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      service_providers: {
        Row: {
          id: string
          profile_id: string
          business_name: string
          description: string | null
          rating_avg: number
          review_count: number
          response_time_avg: number | null
          completion_rate: number | null
          is_verified: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profile_id: string
          business_name: string
          description?: string | null
          rating_avg?: number
          review_count?: number
          response_time_avg?: number | null
          completion_rate?: number | null
          is_verified?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profile_id?: string
          business_name?: string
          description?: string | null
          rating_avg?: number
          review_count?: number
          response_time_avg?: number | null
          completion_rate?: number | null
          is_verified?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_providers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      service_categories: {
        Row: {
          id: string
          name: string
          icon: string | null
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          icon?: string | null
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          icon?: string | null
          description?: string | null
        }
        Relationships: []
      }
      services: {
        Row: {
          id: string
          provider_id: string
          category_id: string
          title: string
          description: string | null
          price_min: number | null
          price_max: number | null
          price_type: 'fixed' | 'hourly' | 'quote'
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          provider_id: string
          category_id: string
          title: string
          description?: string | null
          price_min?: number | null
          price_max?: number | null
          price_type?: 'fixed' | 'hourly' | 'quote'
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          provider_id?: string
          category_id?: string
          title?: string
          description?: string | null
          price_min?: number | null
          price_max?: number | null
          price_type?: 'fixed' | 'hourly' | 'quote'
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "services_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          }
        ]
      }
      service_areas: {
        Row: {
          id: string
          provider_id: string
          city: string
          area_name: string | null
          radius_km: number | null
          center: unknown | null
          created_at: string
        }
        Insert: {
          id?: string
          provider_id: string
          city: string
          area_name?: string | null
          radius_km?: number | null
          center?: unknown | null
          created_at?: string
        }
        Update: {
          id?: string
          provider_id?: string
          city?: string
          area_name?: string | null
          radius_km?: number | null
          center?: unknown | null
        }
        Relationships: [
          {
            foreignKeyName: "service_areas_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          }
        ]
      }
      looking_for_posts: {
        Row: {
          id: string
          customer_id: string
          category_id: string
          title: string
          description: string
          budget_min: number | null
          budget_max: number | null
          location: unknown | null
          location_address: string | null
          preferred_date: string | null
          preferred_time: string | null
          urgency: 'low' | 'medium' | 'high' | 'emergency'
          status: 'active' | 'matched' | 'expired' | 'cancelled'
          images: string[] | null
          expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          category_id: string
          title: string
          description: string
          budget_min?: number | null
          budget_max?: number | null
          location?: unknown | null
          location_address?: string | null
          preferred_date?: string | null
          preferred_time?: string | null
          urgency?: 'low' | 'medium' | 'high' | 'emergency'
          status?: 'active' | 'matched' | 'expired' | 'cancelled'
          images?: string[] | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          category_id?: string
          title?: string
          description?: string
          budget_min?: number | null
          budget_max?: number | null
          location?: unknown | null
          location_address?: string | null
          preferred_date?: string | null
          preferred_time?: string | null
          urgency?: 'low' | 'medium' | 'high' | 'emergency'
          status?: 'active' | 'matched' | 'expired' | 'cancelled'
          images?: string[] | null
          expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "looking_for_posts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "looking_for_posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "service_categories"
            referencedColumns: ["id"]
          }
        ]
      }
      looking_for_responses: {
        Row: {
          id: string
          post_id: string
          provider_id: string
          quoted_price: number
          message: string | null
          estimated_duration: string | null
          available_date: string | null
          available_time: string | null
          status: 'pending' | 'accepted' | 'rejected'
          created_at: string
        }
        Insert: {
          id?: string
          post_id: string
          provider_id: string
          quoted_price: number
          message?: string | null
          estimated_duration?: string | null
          available_date?: string | null
          available_time?: string | null
          status?: 'pending' | 'accepted' | 'rejected'
          created_at?: string
        }
        Update: {
          id?: string
          post_id?: string
          provider_id?: string
          quoted_price?: number
          message?: string | null
          estimated_duration?: string | null
          available_date?: string | null
          available_time?: string | null
          status?: 'pending' | 'accepted' | 'rejected'
        }
        Relationships: [
          {
            foreignKeyName: "looking_for_responses_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "looking_for_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "looking_for_responses_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          }
        ]
      }
      bookings: {
        Row: {
          id: string
          customer_id: string
          provider_id: string
          service_id: string | null
          looking_for_response_id: string | null
          status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
          scheduled_date: string | null
          scheduled_time: string | null
          location: unknown | null
          location_address: string | null
          agreed_price: number | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          provider_id: string
          service_id?: string | null
          looking_for_response_id?: string | null
          status?: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
          scheduled_date?: string | null
          scheduled_time?: string | null
          location?: unknown | null
          location_address?: string | null
          agreed_price?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          provider_id?: string
          service_id?: string | null
          looking_for_response_id?: string | null
          status?: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
          scheduled_date?: string | null
          scheduled_time?: string | null
          location?: unknown | null
          location_address?: string | null
          agreed_price?: number | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_looking_for_response_id_fkey"
            columns: ["looking_for_response_id"]
            isOneToOne: false
            referencedRelation: "looking_for_responses"
            referencedColumns: ["id"]
          }
        ]
      }
      conversations: {
        Row: {
          id: string
          participant_1: string
          participant_2: string
          booking_id: string | null
          looking_for_post_id: string | null
          last_message_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          participant_1: string
          participant_2: string
          booking_id?: string | null
          looking_for_post_id?: string | null
          last_message_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          participant_1?: string
          participant_2?: string
          booking_id?: string | null
          looking_for_post_id?: string | null
          last_message_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_participant_1_fkey"
            columns: ["participant_1"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_participant_2_fkey"
            columns: ["participant_2"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_looking_for_post_id_fkey"
            columns: ["looking_for_post_id"]
            isOneToOne: false
            referencedRelation: "looking_for_posts"
            referencedColumns: ["id"]
          }
        ]
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string
          receiver_id: string
          content: string
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_id: string
          receiver_id: string
          content: string
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_id?: string
          receiver_id?: string
          content?: string
          is_read?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      payments: {
        Row: {
          id: string
          booking_id: string
          amount: number
          method: 'orange_money' | 'btc_myzaka' | 'mascom_myzaka' | 'wallet' | null
          status: 'pending' | 'held' | 'released' | 'refunded' | 'failed' | 'disputed'
          transaction_ref: string | null
          customer_confirmed: boolean
          provider_confirmed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          booking_id: string
          amount: number
          method?: 'orange_money' | 'btc_myzaka' | 'mascom_myzaka' | 'wallet' | null
          status?: 'pending' | 'held' | 'released' | 'refunded' | 'failed' | 'disputed'
          transaction_ref?: string | null
          customer_confirmed?: boolean
          provider_confirmed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          booking_id?: string
          amount?: number
          method?: 'orange_money' | 'btc_myzaka' | 'mascom_myzaka' | 'wallet' | null
          status?: 'pending' | 'held' | 'released' | 'refunded' | 'failed' | 'disputed'
          transaction_ref?: string | null
          customer_confirmed?: boolean
          provider_confirmed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          }
        ]
      }
      reviews: {
        Row: {
          id: string
          booking_id: string
          customer_id: string
          provider_id: string
          rating: number
          comment: string | null
          created_at: string
        }
        Insert: {
          id?: string
          booking_id: string
          customer_id: string
          provider_id: string
          rating: number
          comment?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          booking_id?: string
          customer_id?: string
          provider_id?: string
          rating?: number
          comment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: true
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          }
        ]
      }
      category_requests: {
        Row: {
          id: string
          requested_by: string
          name: string
          icon: string | null
          description: string | null
          status: 'pending' | 'approved' | 'declined'
          admin_feedback: string | null
          reviewed_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          requested_by: string
          name: string
          icon?: string | null
          description?: string | null
          status?: 'pending' | 'approved' | 'declined'
          admin_feedback?: string | null
          reviewed_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          requested_by?: string
          name?: string
          icon?: string | null
          description?: string | null
          status?: 'pending' | 'approved' | 'declined'
          admin_feedback?: string | null
          reviewed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "category_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          body: string | null
          data: Json | null
          is_read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          body?: string | null
          data?: Json | null
          is_read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          body?: string | null
          data?: Json | null
          is_read?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      wallets: {
        Row: {
          id: string
          user_id: string
          balance: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          balance?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          balance?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      wallet_transactions: {
        Row: {
          id: string
          wallet_id: string
          type: 'top_up' | 'payment_hold' | 'payment_release' | 'payment_refund' | 'withdrawal'
          direction: 'credit' | 'debit'
          amount: number
          reference_id: string | null
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          wallet_id: string
          type: 'top_up' | 'payment_hold' | 'payment_release' | 'payment_refund' | 'withdrawal'
          direction: 'credit' | 'debit'
          amount: number
          reference_id?: string | null
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          wallet_id?: string
          type?: 'top_up' | 'payment_hold' | 'payment_release' | 'payment_refund' | 'withdrawal'
          direction?: 'credit' | 'debit'
          amount?: number
          reference_id?: string | null
          description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          }
        ]
      }
      quotes: {
        Row: {
          id: string
          customer_id: string
          provider_id: string
          service_description: string
          budget_min: number | null
          budget_max: number | null
          customer_message: string | null
          quoted_amount: number | null
          provider_message: string | null
          status: 'requested' | 'quoted' | 'accepted' | 'rejected' | 'expired'
          booking_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          provider_id: string
          service_description: string
          budget_min?: number | null
          budget_max?: number | null
          customer_message?: string | null
          quoted_amount?: number | null
          provider_message?: string | null
          status?: 'requested' | 'quoted' | 'accepted' | 'rejected' | 'expired'
          booking_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          provider_id?: string
          service_description?: string
          budget_min?: number | null
          budget_max?: number | null
          customer_message?: string | null
          quoted_amount?: number | null
          provider_message?: string | null
          status?: 'requested' | 'quoted' | 'accepted' | 'rejected' | 'expired'
          booking_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "service_providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          }
        ]
      }
      reports: {
        Row: {
          id: string
          reporter_id: string
          reported_user_id: string
          reason: 'spam' | 'harassment' | 'fraud' | 'inappropriate_content' | 'fake_profile' | 'other'
          description: string | null
          status: 'pending' | 'reviewed' | 'resolved' | 'dismissed'
          admin_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          reporter_id: string
          reported_user_id: string
          reason: 'spam' | 'harassment' | 'fraud' | 'inappropriate_content' | 'fake_profile' | 'other'
          description?: string | null
          status?: 'pending' | 'reviewed' | 'resolved' | 'dismissed'
          admin_notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          reporter_id?: string
          reported_user_id?: string
          reason?: 'spam' | 'harassment' | 'fraud' | 'inappropriate_content' | 'fake_profile' | 'other'
          description?: string | null
          status?: 'pending' | 'reviewed' | 'resolved' | 'dismissed'
          admin_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
