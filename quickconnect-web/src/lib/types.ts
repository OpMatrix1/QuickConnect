import type { Database } from './database.types'

export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type ServiceProvider = Database['public']['Tables']['service_providers']['Row']
export type ServiceProviderInsert = Database['public']['Tables']['service_providers']['Insert']

export type ServiceCategory = Database['public']['Tables']['service_categories']['Row']

export type Service = Database['public']['Tables']['services']['Row']
export type ServiceInsert = Database['public']['Tables']['services']['Insert']

export type ServiceArea = Database['public']['Tables']['service_areas']['Row']

export type LookingForPost = Database['public']['Tables']['looking_for_posts']['Row']
export type LookingForPostInsert = Database['public']['Tables']['looking_for_posts']['Insert']

export type LookingForResponse = Database['public']['Tables']['looking_for_responses']['Row']
export type LookingForResponseInsert = Database['public']['Tables']['looking_for_responses']['Insert']

export type Booking = Database['public']['Tables']['bookings']['Row']
export type BookingInsert = Database['public']['Tables']['bookings']['Insert']
export type BookingUpdate = Database['public']['Tables']['bookings']['Update']

export type Conversation = Database['public']['Tables']['conversations']['Row']

export type Message = Database['public']['Tables']['messages']['Row']
export type MessageInsert = Database['public']['Tables']['messages']['Insert']

export type Payment = Database['public']['Tables']['payments']['Row']
export type PaymentInsert = Database['public']['Tables']['payments']['Insert']

export type Review = Database['public']['Tables']['reviews']['Row']
export type ReviewInsert = Database['public']['Tables']['reviews']['Insert']

export type Notification = Database['public']['Tables']['notifications']['Row']

export type BookingStatus = 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
export type PostStatus = 'active' | 'matched' | 'expired' | 'cancelled'
export type Urgency = 'low' | 'medium' | 'high' | 'emergency'
export type PaymentMethod = 'orange_money' | 'btc_myzaka' | 'mascom_myzaka'
export type PriceType = 'fixed' | 'hourly' | 'quote'
export type UserRole = 'customer' | 'provider' | 'admin'

export interface ProviderWithProfile extends ServiceProvider {
  profiles: Profile
  services?: Service[]
  service_areas?: ServiceArea[]
}

export interface PostWithDetails extends LookingForPost {
  profiles: Profile
  service_categories: ServiceCategory
  looking_for_responses?: ResponseWithProvider[]
}

export interface ResponseWithProvider extends LookingForResponse {
  service_providers: ServiceProvider & {
    profiles: Profile
  }
}

export interface BookingWithDetails extends Booking {
  profiles: Profile
  service_providers: ServiceProvider & {
    profiles: Profile
  }
  services: Service | null
  payments?: Payment
  reviews?: Review
}

export interface ConversationWithDetails extends Conversation {
  participant_1_profile: Profile
  participant_2_profile: Profile
  last_message?: Message
}
