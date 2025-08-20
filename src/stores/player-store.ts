import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { persist } from 'zustand/middleware'
import { Player } from '@/types'
import { PlayerSupabaseDB } from '@/lib/db/players-supabase'
import { createClientComponentClient } from '@/lib/db/supabase'

export interface PlayerFilter {
  search?: string
  club?: string
  ratingRange?: { min: number; max: number }
  activeOnly?: boolean
}

export interface PlayerStoreState {
  // Player data
  players: Player[]
  currentPlayer: Player | null
  
  // UI state
  loading: boolean
  error: string | null
  
  // Filters and pagination
  filters: PlayerFilter
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

export interface PlayerStoreActions {
  // Player CRUD operations
  createPlayer: (playerData: Omit<Player, 'id' | 'created_at' | 'updated_at'>) => Promise<Player | null>
  updatePlayer: (id: string, updates: Partial<Player>) => Promise<Player | null>
  deletePlayer: (id: string) => Promise<boolean>
  deactivatePlayer: (id: string) => Promise<Player | null>
  reactivatePlayer: (id: string) => Promise<Player | null>
  
  // Player queries
  loadPlayers: (refresh?: boolean) => Promise<void>
  loadPlayer: (id: string) => Promise<Player | null>
  searchPlayers: (query: string) => Promise<void>
  findPlayersByClub: (club: string) => Promise<void>
  findPlayerByEmail: (email: string) => Promise<Player | null>
  
  // Pagination and filtering
  setFilters: (filters: Partial<PlayerFilter>) => void
  clearFilters: () => void
  loadMore: () => Promise<void>
  setCurrentPage: (page: number) => Promise<void>
  
  // Current player management
  setCurrentPlayer: (player: Player | null) => void
  getCurrentPlayerStats: (id: string) => Promise<any>
  
  // Real-time updates
  startRealTimeUpdates: () => void
  stopRealTimeUpdates: () => void
  
  // Error handling
  clearError: () => void
  setError: (error: string) => void
  
  // Optimistic updates
  optimisticUpdate: (id: string, updates: Partial<Player>) => void
  rollbackOptimisticUpdate: (id: string, originalData: Player) => void
}

export type PlayerStore = PlayerStoreState & PlayerStoreActions

const db = new PlayerSupabaseDB()
const supabase = createClientComponentClient()

export const usePlayerStore = create<PlayerStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // Initial state
        players: [],
        currentPlayer: null,
        loading: false,
        error: null,
        filters: { activeOnly: true },
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          hasMore: false
        },
        isConnected: false,
        lastUpdated: null,

        // Player CRUD operations
        createPlayer: async (playerData) => {
          set({ loading: true, error: null })
          
          try {
            const result = await db.create(playerData)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            const newPlayer = result.data
            
            set(state => ({
              players: [newPlayer, ...state.players],
              pagination: {
                ...state.pagination,
                total: state.pagination.total + 1
              },
              loading: false,
              lastUpdated: new Date().toISOString()
            }))
            
            return newPlayer
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to create player'
            set({ error: errorMessage, loading: false })
            return null
          }
        },

        updatePlayer: async (id: string, updates: Partial<Player>) => {
          const originalPlayer = get().players.find(p => p.id === id)
          if (!originalPlayer) {
            set({ error: 'Player not found' })
            return null
          }

          // Optimistic update
          get().optimisticUpdate(id, updates)
          
          try {
            const result = await db.update(id, updates)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            const updatedPlayer = result.data
            
            set(state => ({
              players: state.players.map(p => 
                p.id === id ? updatedPlayer : p
              ),
              currentPlayer: state.currentPlayer?.id === id ? updatedPlayer : state.currentPlayer,
              lastUpdated: new Date().toISOString()
            }))
            
            return updatedPlayer
          } catch (error) {
            // Rollback optimistic update
            get().rollbackOptimisticUpdate(id, originalPlayer)
            const errorMessage = error instanceof Error ? error.message : 'Failed to update player'
            set({ error: errorMessage })
            return null
          }
        },

        deletePlayer: async (id: string) => {
          const originalPlayers = get().players
          
          // Optimistic removal
          set(state => ({
            players: state.players.filter(p => p.id !== id),
            currentPlayer: state.currentPlayer?.id === id ? null : state.currentPlayer,
            pagination: {
              ...state.pagination,
              total: Math.max(0, state.pagination.total - 1)
            }
          }))
          
          try {
            const result = await db.delete(id)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            set({ lastUpdated: new Date().toISOString() })
            return true
          } catch (error) {
            // Rollback optimistic removal
            set({ players: originalPlayers })
            const errorMessage = error instanceof Error ? error.message : 'Failed to delete player'
            set({ error: errorMessage })
            return false
          }
        },

        deactivatePlayer: async (id: string) => {
          return get().updatePlayer(id, { is_active: false })
        },

        reactivatePlayer: async (id: string) => {
          return get().updatePlayer(id, { is_active: true })
        },

        // Player queries
        loadPlayers: async (refresh = false) => {
          const state = get()
          
          if (state.loading) return
          if (!refresh && state.players.length > 0) return
          
          set({ loading: true, error: null })
          
          try {
            const result = await db.findPaginated(
              state.pagination.page,
              state.pagination.limit,
              state.filters
            )
            
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            const { players, total, hasMore } = result.data
            
            set({
              players: refresh ? players : [...state.players, ...players],
              pagination: {
                ...state.pagination,
                total,
                hasMore
              },
              loading: false,
              lastUpdated: new Date().toISOString()
            })
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load players'
            set({ error: errorMessage, loading: false })
          }
        },

        loadPlayer: async (id: string) => {
          try {
            const result = await db.findById(id)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            const player = result.data
            if (!player) {
              throw new Error('Player not found')
            }
            
            // Update in players list if present
            set(state => ({
              players: state.players.map(p => 
                p.id === id ? player : p
              ),
              currentPlayer: player,
              lastUpdated: new Date().toISOString()
            }))
            
            return player
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load player'
            set({ error: errorMessage })
            return null
          }
        },

        searchPlayers: async (query: string) => {
          set({ loading: true, error: null, filters: { ...get().filters, search: query } })
          
          try {
            const result = await db.search(query)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            set({
              players: result.data,
              pagination: { ...get().pagination, page: 1, total: result.data.length, hasMore: false },
              loading: false,
              lastUpdated: new Date().toISOString()
            })
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to search players'
            set({ error: errorMessage, loading: false })
          }
        },

        findPlayersByClub: async (club: string) => {
          set({ loading: true, error: null })
          
          try {
            const result = await db.findByClub(club)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            set({
              players: result.data,
              filters: { ...get().filters, club },
              pagination: { ...get().pagination, page: 1, total: result.data.length, hasMore: false },
              loading: false,
              lastUpdated: new Date().toISOString()
            })
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to find players by club'
            set({ error: errorMessage, loading: false })
          }
        },

        findPlayerByEmail: async (email: string) => {
          try {
            const result = await db.findByEmail(email)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            return result.data
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to find player by email'
            set({ error: errorMessage })
            return null
          }
        },

        // Pagination and filtering
        setFilters: (filters: Partial<PlayerFilter>) => {
          set(state => ({ 
            filters: { ...state.filters, ...filters },
            pagination: { ...state.pagination, page: 1 }
          }))
          get().loadPlayers(true)
        },

        clearFilters: () => {
          set({ 
            filters: { activeOnly: true },
            pagination: { ...get().pagination, page: 1 }
          })
          get().loadPlayers(true)
        },

        loadMore: async () => {
          const state = get()
          if (!state.pagination.hasMore || state.loading) return
          
          set(state => ({
            pagination: { ...state.pagination, page: state.pagination.page + 1 }
          }))
          
          await get().loadPlayers()
        },

        setCurrentPage: async (page: number) => {
          set(state => ({
            pagination: { ...state.pagination, page },
            players: []
          }))
          await get().loadPlayers(true)
        },

        // Current player management
        setCurrentPlayer: (player: Player | null) => {
          set({ currentPlayer: player })
        },

        getCurrentPlayerStats: async (id: string) => {
          try {
            const result = await db.getPlayerStats(id)
            return result.error ? null : result.data
          } catch (error) {
            set({ error: 'Failed to load player statistics' })
            return null
          }
        },

        // Real-time updates
        startRealTimeUpdates: () => {
          const subscription = supabase
            .channel('players_changes')
            .on('postgres_changes', 
              { event: '*', schema: 'public', table: 'players' }, 
              (payload) => {
                const { eventType, new: newRecord, old: oldRecord } = payload
                
                set(state => {
                  let newPlayers = [...state.players]
                  
                  switch (eventType) {
                    case 'INSERT':
                      if (newRecord) {
                        newPlayers = [newRecord as Player, ...newPlayers]
                      }
                      break
                    case 'UPDATE':
                      if (newRecord) {
                        newPlayers = newPlayers.map(p => 
                          p.id === newRecord.id ? newRecord as Player : p
                        )
                      }
                      break
                    case 'DELETE':
                      if (oldRecord) {
                        newPlayers = newPlayers.filter(p => p.id !== oldRecord.id)
                      }
                      break
                  }
                  
                  return {
                    players: newPlayers,
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
          supabase.removeAllChannels()
          set({ isConnected: false })
        },

        // Error handling
        clearError: () => set({ error: null }),
        setError: (error: string) => set({ error }),

        // Optimistic updates
        optimisticUpdate: (id: string, updates: Partial<Player>) => {
          set(state => ({
            players: state.players.map(p => 
              p.id === id ? { ...p, ...updates } : p
            ),
            currentPlayer: state.currentPlayer?.id === id 
              ? { ...state.currentPlayer, ...updates } 
              : state.currentPlayer
          }))
        },

        rollbackOptimisticUpdate: (id: string, originalData: Player) => {
          set(state => ({
            players: state.players.map(p => 
              p.id === id ? originalData : p
            ),
            currentPlayer: state.currentPlayer?.id === id 
              ? originalData 
              : state.currentPlayer
          }))
        }
      }),
      {
        name: 'player-store',
        partialize: (state) => ({
          // Only persist essential data, not loading states
          players: state.players.slice(0, 100), // Limit cached players
          currentPlayer: state.currentPlayer,
          filters: state.filters,
          pagination: state.pagination
        })
      }
    )
  )
)

// Selector hooks for optimized re-renders
export const usePlayers = () => usePlayerStore(state => state.players)
export const useCurrentPlayer = () => usePlayerStore(state => state.currentPlayer)
export const usePlayerLoading = () => usePlayerStore(state => state.loading)
export const usePlayerError = () => usePlayerStore(state => state.error)