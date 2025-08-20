import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { persist } from 'zustand/middleware'
import { Tournament, TournamentStatus, TournamentFormData, TournamentStats } from '@/types'
import { TournamentSupabaseDB } from '@/lib/db/tournaments-supabase'
import { createClientComponentClient } from '@/lib/db/supabase'

export interface TournamentFilter {
  status?: TournamentStatus[]
  format?: string
  search?: string
  dateRange?: {
    start: string
    end: string
  }
}

export interface TournamentStoreState {
  // Tournament data
  tournaments: Tournament[]
  currentTournament: Tournament | null
  
  // UI state
  loading: boolean
  error: string | null
  
  // Filters and pagination
  filters: TournamentFilter
  pagination: {
    page: number
    limit: number
    total: number
    hasMore: boolean
  }
  
  // Real-time connection
  isConnected: boolean
  lastUpdated: string | null
}

export interface TournamentStoreActions {
  // Tournament CRUD operations
  createTournament: (formData: TournamentFormData) => Promise<Tournament | null>
  updateTournament: (id: string, updates: Partial<Tournament>) => Promise<Tournament | null>
  deleteTournament: (id: string) => Promise<boolean>
  
  // Tournament queries
  loadTournaments: (refresh?: boolean) => Promise<void>
  loadTournament: (id: string) => Promise<Tournament | null>
  searchTournaments: (query: string) => Promise<void>
  
  // Tournament management
  updateTournamentStatus: (id: string, status: TournamentStatus) => Promise<Tournament | null>
  updateTournamentSettings: (id: string, settings: Partial<Tournament['settings']>) => Promise<Tournament | null>
  
  // Pagination and filtering
  setFilters: (filters: Partial<TournamentFilter>) => void
  clearFilters: () => void
  loadMore: () => Promise<void>
  setCurrentPage: (page: number) => Promise<void>
  
  // Current tournament management
  setCurrentTournament: (tournament: Tournament | null) => void
  getCurrentTournamentStats: () => Promise<TournamentStats | null>
  
  // Real-time updates
  startRealTimeUpdates: () => void
  stopRealTimeUpdates: () => void
  
  // Error handling
  clearError: () => void
  setError: (error: string) => void
  
  // Optimistic updates
  optimisticUpdate: (id: string, updates: Partial<Tournament>) => void
  rollbackOptimisticUpdate: (id: string, originalData: Tournament) => void
}

export type TournamentStore = TournamentStoreState & TournamentStoreActions

// Lazy initialization for database and client
let _db: TournamentSupabaseDB | null = null;
let _supabase: ReturnType<typeof createClientComponentClient> | null = null;

const getDB = () => {
  if (!_db) {
    _db = new TournamentSupabaseDB();
  }
  return _db;
}

const getSupabase = () => {
  if (!_supabase) {
    _supabase = createClientComponentClient();
  }
  return _supabase;
}

export const useTournamentStore = create<TournamentStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // Initial state
        tournaments: [],
        currentTournament: null,
        loading: false,
        error: null,
        filters: {},
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          hasMore: false
        },
        isConnected: false,
        lastUpdated: null,

        // Tournament CRUD operations
        createTournament: async (formData: TournamentFormData) => {
          set({ loading: true, error: null })
          
          try {
            const result = await getDB().create(formData)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            const newTournament = result.data
            
            // Add to store with optimistic update
            set(state => ({
              tournaments: [newTournament, ...state.tournaments],
              pagination: {
                ...state.pagination,
                total: state.pagination.total + 1
              },
              loading: false,
              lastUpdated: new Date().toISOString()
            }))
            
            return newTournament
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to create tournament'
            set({ error: errorMessage, loading: false })
            return null
          }
        },

        updateTournament: async (id: string, updates: Partial<Tournament>) => {
          const originalTournament = get().tournaments.find(t => t.id === id)
          if (!originalTournament) {
            set({ error: 'Tournament not found' })
            return null
          }

          // Optimistic update
          get().optimisticUpdate(id, updates)
          
          try {
            const result = await getDB().update(id, updates)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            const updatedTournament = result.data
            
            set(state => ({
              tournaments: state.tournaments.map(t => 
                t.id === id ? updatedTournament : t
              ),
              currentTournament: state.currentTournament?.id === id ? updatedTournament : state.currentTournament,
              lastUpdated: new Date().toISOString()
            }))
            
            return updatedTournament
          } catch (error) {
            // Rollback optimistic update
            get().rollbackOptimisticUpdate(id, originalTournament)
            const errorMessage = error instanceof Error ? error.message : 'Failed to update tournament'
            set({ error: errorMessage })
            return null
          }
        },

        deleteTournament: async (id: string) => {
          const originalTournaments = get().tournaments
          
          // Optimistic removal
          set(state => ({
            tournaments: state.tournaments.filter(t => t.id !== id),
            currentTournament: state.currentTournament?.id === id ? null : state.currentTournament,
            pagination: {
              ...state.pagination,
              total: Math.max(0, state.pagination.total - 1)
            }
          }))
          
          try {
            const result = await getDB().delete(id)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            set({ lastUpdated: new Date().toISOString() })
            return true
          } catch (error) {
            // Rollback optimistic removal
            set({ tournaments: originalTournaments })
            const errorMessage = error instanceof Error ? error.message : 'Failed to delete tournament'
            set({ error: errorMessage })
            return false
          }
        },

        // Tournament queries
        loadTournaments: async (refresh = false) => {
          const state = get()
          
          if (state.loading) return
          if (!refresh && state.tournaments.length > 0) return
          
          set({ loading: true, error: null })
          
          try {
            const result = await getDB().findPaginated(
              state.pagination.page,
              state.pagination.limit,
              state.filters
            )
            
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            const { tournaments, total, hasMore } = result.data
            
            set({
              tournaments: refresh ? tournaments : [...state.tournaments, ...tournaments],
              pagination: {
                ...state.pagination,
                total,
                hasMore
              },
              loading: false,
              lastUpdated: new Date().toISOString()
            })
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load tournaments'
            set({ error: errorMessage, loading: false })
          }
        },

        loadTournament: async (id: string) => {
          try {
            const result = await getDB().findById(id)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            const tournament = result.data
            if (!tournament) {
              throw new Error('Tournament not found')
            }
            
            // Update in tournaments list if present
            set(state => ({
              tournaments: state.tournaments.map(t => 
                t.id === id ? tournament : t
              ),
              currentTournament: tournament,
              lastUpdated: new Date().toISOString()
            }))
            
            return tournament
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load tournament'
            set({ error: errorMessage })
            return null
          }
        },

        searchTournaments: async (query: string) => {
          set({ loading: true, error: null, filters: { ...get().filters, search: query } })
          
          try {
            const result = await getDB().search(query)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            set({
              tournaments: result.data,
              pagination: { ...get().pagination, page: 1, total: result.data.length, hasMore: false },
              loading: false,
              lastUpdated: new Date().toISOString()
            })
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to search tournaments'
            set({ error: errorMessage, loading: false })
          }
        },

        // Tournament management
        updateTournamentStatus: async (id: string, status: TournamentStatus) => {
          return get().updateTournament(id, { status })
        },

        updateTournamentSettings: async (id: string, settings: Partial<Tournament['settings']>) => {
          return get().updateTournament(id, { settings })
        },

        // Pagination and filtering
        setFilters: (filters: Partial<TournamentFilter>) => {
          set(state => ({ 
            filters: { ...state.filters, ...filters },
            pagination: { ...state.pagination, page: 1 }
          }))
          get().loadTournaments(true)
        },

        clearFilters: () => {
          set({ 
            filters: {},
            pagination: { ...get().pagination, page: 1 }
          })
          get().loadTournaments(true)
        },

        loadMore: async () => {
          const state = get()
          if (!state.pagination.hasMore || state.loading) return
          
          set(state => ({
            pagination: { ...state.pagination, page: state.pagination.page + 1 }
          }))
          
          await get().loadTournaments()
        },

        setCurrentPage: async (page: number) => {
          set(state => ({
            pagination: { ...state.pagination, page },
            tournaments: []
          }))
          await get().loadTournaments(true)
        },

        // Current tournament management
        setCurrentTournament: (tournament: Tournament | null) => {
          set({ currentTournament: tournament })
        },

        getCurrentTournamentStats: async () => {
          const currentTournament = get().currentTournament
          if (!currentTournament) return null
          
          try {
            const result = await getDB().getStats(currentTournament.id)
            return result.error ? null : result.data
          } catch (error) {
            set({ error: 'Failed to load tournament statistics' })
            return null
          }
        },

        // Real-time updates
        startRealTimeUpdates: () => {
          const subscription = getSupabase()
            .channel('tournaments_changes')
            .on('postgres_changes', 
              { event: '*', schema: 'public', table: 'tournaments' }, 
              (payload) => {
                const { eventType, new: newRecord, old: oldRecord } = payload
                
                set(state => {
                  let newTournaments = [...state.tournaments]
                  
                  switch (eventType) {
                    case 'INSERT':
                      if (newRecord) {
                        newTournaments = [newRecord as Tournament, ...newTournaments]
                      }
                      break
                    case 'UPDATE':
                      if (newRecord) {
                        newTournaments = newTournaments.map(t => 
                          t.id === newRecord.id ? newRecord as Tournament : t
                        )
                      }
                      break
                    case 'DELETE':
                      if (oldRecord) {
                        newTournaments = newTournaments.filter(t => t.id !== oldRecord.id)
                      }
                      break
                  }
                  
                  return {
                    tournaments: newTournaments,
                    lastUpdated: new Date().toISOString(),
                    isConnected: true
                  }
                })
              }
            )
            .subscribe((status) => {
              set({ isConnected: status === 'SUBSCRIBED' })
            })
        },

        stopRealTimeUpdates: () => {
          getSupabase().removeAllChannels()
          set({ isConnected: false })
        },

        // Error handling
        clearError: () => set({ error: null }),
        setError: (error: string) => set({ error }),

        // Optimistic updates
        optimisticUpdate: (id: string, updates: Partial<Tournament>) => {
          set(state => ({
            tournaments: state.tournaments.map(t => 
              t.id === id ? { ...t, ...updates } : t
            ),
            currentTournament: state.currentTournament?.id === id 
              ? { ...state.currentTournament, ...updates } 
              : state.currentTournament
          }))
        },

        rollbackOptimisticUpdate: (id: string, originalData: Tournament) => {
          set(state => ({
            tournaments: state.tournaments.map(t => 
              t.id === id ? originalData : t
            ),
            currentTournament: state.currentTournament?.id === id 
              ? originalData 
              : state.currentTournament
          }))
        }
      }),
      {
        name: 'tournament-store',
        partialize: (state) => ({
          // Only persist essential data, not loading states
          tournaments: state.tournaments.slice(0, 50), // Limit cached tournaments
          currentTournament: state.currentTournament,
          filters: state.filters,
          pagination: state.pagination
        })
      }
    )
  )
)

// Selector hooks for optimized re-renders
export const useTournaments = () => useTournamentStore(state => state.tournaments)
export const useCurrentTournament = () => useTournamentStore(state => state.currentTournament)
export const useTournamentLoading = () => useTournamentStore(state => state.loading)
export const useTournamentError = () => useTournamentStore(state => state.error)