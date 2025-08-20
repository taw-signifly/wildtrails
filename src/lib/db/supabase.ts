import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export type Database = {
  public: {
    Tables: {
      tournaments: {
        Row: {
          id: string
          name: string
          description: string | null
          format: 'single_elimination' | 'double_elimination' | 'round_robin' | 'swiss' | 'barrage'
          status: 'draft' | 'registration' | 'in_progress' | 'completed' | 'cancelled'
          max_players: number
          current_players: number
          start_date: string | null
          end_date: string | null
          registration_deadline: string | null
          location: string | null
          settings: any
          bracket_data: any
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          format: 'single_elimination' | 'double_elimination' | 'round_robin' | 'swiss' | 'barrage'
          status?: 'draft' | 'registration' | 'in_progress' | 'completed' | 'cancelled'
          max_players: number
          current_players?: number
          start_date?: string | null
          end_date?: string | null
          registration_deadline?: string | null
          location?: string | null
          settings?: any
          bracket_data?: any
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          format?: 'single_elimination' | 'double_elimination' | 'round_robin' | 'swiss' | 'barrage'
          status?: 'draft' | 'registration' | 'in_progress' | 'completed' | 'cancelled'
          max_players?: number
          current_players?: number
          start_date?: string | null
          end_date?: string | null
          registration_deadline?: string | null
          location?: string | null
          settings?: any
          bracket_data?: any
          created_at?: string
          updated_at?: string
        }
      }
      players: {
        Row: {
          id: string
          name: string
          email: string | null
          phone: string | null
          club: string | null
          rating: number | null
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          email?: string | null
          phone?: string | null
          club?: string | null
          rating?: number | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string | null
          phone?: string | null
          club?: string | null
          rating?: number | null
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      teams: {
        Row: {
          id: string
          tournament_id: string
          name: string
          type: 'singles' | 'doubles' | 'triples'
          status: 'registered' | 'checked_in' | 'active' | 'eliminated'
          seed: number | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tournament_id: string
          name: string
          type: 'singles' | 'doubles' | 'triples'
          status?: 'registered' | 'checked_in' | 'active' | 'eliminated'
          seed?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tournament_id?: string
          name?: string
          type?: 'singles' | 'doubles' | 'triples'
          status?: 'registered' | 'checked_in' | 'active' | 'eliminated'
          seed?: number | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      team_members: {
        Row: {
          id: string
          team_id: string
          player_id: string
          role: 'player' | 'captain' | 'substitute'
          joined_at: string
        }
        Insert: {
          id?: string
          team_id: string
          player_id: string
          role?: 'player' | 'captain' | 'substitute'
          joined_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          player_id?: string
          role?: 'player' | 'captain' | 'substitute'
          joined_at?: string
        }
      }
      courts: {
        Row: {
          id: string
          tournament_id: string
          name: string
          status: 'available' | 'occupied' | 'maintenance'
          location: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tournament_id: string
          name: string
          status?: 'available' | 'occupied' | 'maintenance'
          location?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tournament_id?: string
          name?: string
          status?: 'available' | 'occupied' | 'maintenance'
          location?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      matches: {
        Row: {
          id: string
          tournament_id: string
          round: number
          match_number: number
          team1_id: string | null
          team2_id: string | null
          winner_id: string | null
          court_id: string | null
          status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
          score: any
          start_time: string | null
          end_time: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tournament_id: string
          round: number
          match_number: number
          team1_id?: string | null
          team2_id?: string | null
          winner_id?: string | null
          court_id?: string | null
          status?: 'pending' | 'in_progress' | 'completed' | 'cancelled'
          score?: any
          start_time?: string | null
          end_time?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tournament_id?: string
          round?: number
          match_number?: number
          team1_id?: string | null
          team2_id?: string | null
          winner_id?: string | null
          court_id?: string | null
          status?: 'pending' | 'in_progress' | 'completed' | 'cancelled'
          score?: any
          start_time?: string | null
          end_time?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      match_games: {
        Row: {
          id: string
          match_id: string
          game_number: number
          team1_score: number
          team2_score: number
          winner_id: string | null
          ends: any
          completed_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          match_id: string
          game_number: number
          team1_score?: number
          team2_score?: number
          winner_id?: string | null
          ends?: any
          completed_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          match_id?: string
          game_number?: number
          team1_score?: number
          team2_score?: number
          winner_id?: string | null
          ends?: any
          completed_at?: string | null
          created_at?: string
        }
      }
    }
  }
}

// Client-side Supabase client
export const createClientComponentClient = () => {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Server-side Supabase client for Server Components
export const createServerComponentClient = () => {
  const cookieStore = cookies()
  
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return (cookieStore as any).get(name)?.value
        },
      },
    }
  )
}

// Server-side Supabase client for Server Actions (with service role key)
export const createServiceRoleClient = () => {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

// Default export for general use
export const supabase = createClientComponentClient()