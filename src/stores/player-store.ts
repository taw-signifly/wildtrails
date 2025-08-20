import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { persist } from 'zustand/middleware'
import { Player, GameFormat } from '@/types'
import { PlayerSupabaseDB } from '@/lib/db/players-supabase'
import { createClientComponentClient } from '@/lib/db/supabase'

export interface PlayerFilter {
  tournamentId?: string
  club?: string
  format?: GameFormat
  search?: string
  isCheckedIn?: boolean
  isEliminated?: boolean
}

export interface PlayerStoreState {
  // Player data
  players: Player[]
  currentPlayer: Player | null
  checkedInPlayers: Player[] // players checked in for current tournament
  activePlayers: Player[] // players still in tournament (not eliminated)
  
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
  
  // Tournament-specific state
  selectedTournamentId: string | null
  checkInStatus: Record<string, boolean> // playerId -> checked in status
  eliminationStatus: Record<string, boolean> // playerId -> elimination status
}

export interface PlayerStoreActions {
  // Player CRUD operations
  createPlayer: (playerData: Partial<Player>) => Promise<Player | null>
  updatePlayer: (id: string, updates: Partial<Player>) => Promise<Player | null>
  deletePlayer: (id: string) => Promise<boolean>
  
  // Player queries
  loadPlayers: (refresh?: boolean) => Promise<void>
  loadPlayer: (id: string) => Promise<Player | null>
  loadPlayersByTournament: (tournamentId: string) => Promise<void>
  searchPlayers: (query: string) => Promise<void>
  
  // Tournament-specific operations
  checkInPlayer: (playerId: string, tournamentId: string) => Promise<boolean>
  checkOutPlayer: (playerId: string, tournamentId: string) => Promise<boolean>
  eliminatePlayer: (playerId: string, tournamentId: string, reason?: string) => Promise<boolean>
  reinstatePlayer: (playerId: string, tournamentId: string) => Promise<boolean>
  
  // Team formation
  getAvailablePlayersForTeam: (format: GameFormat, excludePlayerIds?: string[]) => Player[]
  
  // Pagination and filtering
  setFilters: (filters: Partial<PlayerFilter>) => void
  clearFilters: () => void
  loadMore: () => Promise<void>
  setCurrentPage: (page: number) => Promise<void>
  
  // Current player management
  setCurrentPlayer: (player: Player | null) => void
  setSelectedTournament: (tournamentId: string | null) => void
  
  // Real-time updates
  startRealTimeUpdates: (tournamentId?: string) => void
  stopRealTimeUpdates: () => void
  
  // Error handling
  clearError: () => void
  setError: (error: string) => void
  
  // Optimistic updates
  optimisticUpdate: (id: string, updates: Partial<Player>) => void
  rollbackOptimisticUpdate: (id: string, originalData: Player) => void
}

export type PlayerStore = PlayerStoreState & PlayerStoreActions

// Lazy initialization for database and client
let _db: PlayerSupabaseDB | null = null;
let _supabase: ReturnType<typeof createClientComponentClient> | null = null;

const getDB = () => {
  if (!_db) {
    _db = new PlayerSupabaseDB();
  }
  return _db;
}

const getSupabase = () => {
  if (!_supabase) {
    _supabase = createClientComponentClient();
  }
  return _supabase;
}

export const usePlayerStore = create<PlayerStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // Initial state
        players: [],
        currentPlayer: null,
        checkedInPlayers: [],
        activePlayers: [],
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
        selectedTournamentId: null,
        checkInStatus: {},
        eliminationStatus: {},

        // Player CRUD operations
        createPlayer: async (playerData: Partial<Player>) => {
          set({ loading: true, error: null })
          
          try {
            const result = await getDB().create(playerData as Player)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            const newPlayer = result.data
            
            // Add to store with optimistic update
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
            const result = await getDB().update(id, updates)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            const updatedPlayer = result.data
            
            set(state => ({
              players: state.players.map(p => 
                p.id === id ? updatedPlayer : p
              ),
              checkedInPlayers: state.checkedInPlayers.map(p => 
                p.id === id ? updatedPlayer : p
              ),
              activePlayers: state.activePlayers.map(p => 
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
            checkedInPlayers: state.checkedInPlayers.filter(p => p.id !== id),
            activePlayers: state.activePlayers.filter(p => p.id !== id),
            currentPlayer: state.currentPlayer?.id === id ? null : state.currentPlayer,
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
            set({ players: originalPlayers })
            const errorMessage = error instanceof Error ? error.message : 'Failed to delete player'
            set({ error: errorMessage })
            return false
          }
        },

        // Player queries
        loadPlayers: async (refresh = false) => {
          const state = get()
          
          if (state.loading) return
          if (!refresh && state.players.length > 0) return
          
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
            const result = await getDB().findById(id)
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

        loadPlayersByTournament: async (tournamentId: string) => {
          set({ loading: true, error: null, selectedTournamentId: tournamentId })
          
          try {
            const result = await getDB().findByTournament(tournamentId)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            const players = result.data
            const checkedInPlayers = players.filter(p => 
              get().checkInStatus[p.id] === true
            )
            const activePlayers = players.filter(p => 
              get().eliminationStatus[p.id] !== true
            )
            
            set({
              players,
              checkedInPlayers,
              activePlayers,
              pagination: { ...get().pagination, total: players.length, hasMore: false },
              loading: false,
              lastUpdated: new Date().toISOString()
            })
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load tournament players'
            set({ error: errorMessage, loading: false })
          }
        },

        searchPlayers: async (query: string) => {
          set({ loading: true, error: null, filters: { ...get().filters, search: query } })
          
          try {
            const result = await getDB().search(query)
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

        // Tournament-specific operations
        checkInPlayer: async (playerId: string, tournamentId: string) => {
          try {
            const result = await getDB().checkIn(playerId, tournamentId)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            set(state => {
              const player = state.players.find(p => p.id === playerId)
              return {
                checkInStatus: { ...state.checkInStatus, [playerId]: true },
                checkedInPlayers: player && !state.checkedInPlayers.some(p => p.id === playerId)
                  ? [...state.checkedInPlayers, player]
                  : state.checkedInPlayers,
                lastUpdated: new Date().toISOString()
              }
            })
            
            return true
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to check in player'
            set({ error: errorMessage })
            return false
          }
        },

        checkOutPlayer: async (playerId: string, tournamentId: string) => {
          try {
            const result = await getDB().checkOut(playerId, tournamentId)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            set(state => ({
              checkInStatus: { ...state.checkInStatus, [playerId]: false },
              checkedInPlayers: state.checkedInPlayers.filter(p => p.id !== playerId),
              lastUpdated: new Date().toISOString()
            }))
            
            return true
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to check out player'
            set({ error: errorMessage })
            return false
          }
        },

        eliminatePlayer: async (playerId: string, tournamentId: string, reason?: string) => {
          try {
            const result = await getDB().eliminate(playerId, tournamentId, reason)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            set(state => ({
              eliminationStatus: { ...state.eliminationStatus, [playerId]: true },
              activePlayers: state.activePlayers.filter(p => p.id !== playerId),
              lastUpdated: new Date().toISOString()
            }))
            
            return true
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to eliminate player'
            set({ error: errorMessage })
            return false
          }
        },

        reinstatePlayer: async (playerId: string, tournamentId: string) => {
          try {
            const result = await getDB().reinstate(playerId, tournamentId)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            set(state => {
              const player = state.players.find(p => p.id === playerId)
              return {
                eliminationStatus: { ...state.eliminationStatus, [playerId]: false },
                activePlayers: player && !state.activePlayers.some(p => p.id === playerId)
                  ? [...state.activePlayers, player]
                  : state.activePlayers,
                lastUpdated: new Date().toISOString()
              }
            })
            
            return true
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to reinstate player'
            set({ error: errorMessage })
            return false
          }
        },

        // Team formation
        getAvailablePlayersForTeam: (format: GameFormat, excludePlayerIds?: string[]) => {
          const state = get()
          const excludeSet = new Set(excludePlayerIds || [])
          
          return state.activePlayers.filter(player => 
            !excludeSet.has(player.id) &&
            (player.preferences.preferredFormat === format || player.preferences.preferredFormat === 'singles') // Singles players can play any format
          )
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
            filters: {},
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

        setSelectedTournament: (tournamentId: string | null) => {
          set({ selectedTournamentId: tournamentId })
        },

        // Real-time updates
        startRealTimeUpdates: (tournamentId?: string) => {
          const subscription = getSupabase()
            .channel('players_changes')
            .on('postgres_changes', 
              { event: '*', schema: 'public', table: 'players' }, 
              (payload) => {
                const { eventType, new: newRecord, old: oldRecord } = payload
                
                set(state => {
                  let newPlayers = [...state.players]
                  let newCheckedInPlayers = [...state.checkedInPlayers]
                  let newActivePlayers = [...state.activePlayers]
                  
                  switch (eventType) {
                    case 'INSERT':
                      if (newRecord) {
                        const player = newRecord as Player
                        newPlayers = [player, ...newPlayers]
                      }
                      break
                    case 'UPDATE':
                      if (newRecord) {
                        const player = newRecord as Player
                        newPlayers = newPlayers.map(p => 
                          p.id === player.id ? player : p
                        )
                        newCheckedInPlayers = newCheckedInPlayers.map(p => 
                          p.id === player.id ? player : p
                        )
                        newActivePlayers = newActivePlayers.map(p => 
                          p.id === player.id ? player : p
                        )
                      }
                      break
                    case 'DELETE':
                      if (oldRecord) {
                        newPlayers = newPlayers.filter(p => p.id !== oldRecord.id)
                        newCheckedInPlayers = newCheckedInPlayers.filter(p => p.id !== oldRecord.id)
                        newActivePlayers = newActivePlayers.filter(p => p.id !== oldRecord.id)
                      }
                      break
                  }
                  
                  return {
                    players: newPlayers,
                    checkedInPlayers: newCheckedInPlayers,
                    activePlayers: newActivePlayers,
                    lastUpdated: new Date().toISOString(),
                    isConnected: true
                  }
                })
              }
            )
            .on('postgres_changes', 
              { event: '*', schema: 'public', table: 'tournament_players' }, 
              (payload) => {
                const { eventType, new: newRecord, old: oldRecord } = payload
                
                // Handle tournament-specific player updates (check-in, elimination, etc.)
                if (tournamentId && 
                    ((newRecord && newRecord.tournament_id === tournamentId) ||
                     (oldRecord && oldRecord.tournament_id === tournamentId))) {
                  
                  set(state => {
                    const playerId = newRecord?.player_id || oldRecord?.player_id
                    if (!playerId) return state
                    
                    let updates: Partial<PlayerStoreState> = {
                      lastUpdated: new Date().toISOString()
                    }
                    
                    if (eventType === 'INSERT' || eventType === 'UPDATE') {
                      if (newRecord?.checked_in) {
                        updates.checkInStatus = { ...state.checkInStatus, [playerId]: true }
                        const player = state.players.find(p => p.id === playerId)
                        if (player && !state.checkedInPlayers.some(p => p.id === playerId)) {
                          updates.checkedInPlayers = [...state.checkedInPlayers, player]
                        }
                      }
                      
                      if (newRecord?.eliminated) {
                        updates.eliminationStatus = { ...state.eliminationStatus, [playerId]: true }
                        updates.activePlayers = state.activePlayers.filter(p => p.id !== playerId)
                      }
                    }
                    
                    return { ...state, ...updates }
                  })
                }
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
        optimisticUpdate: (id: string, updates: Partial<Player>) => {
          set(state => ({
            players: state.players.map(p => 
              p.id === id ? { ...p, ...updates } : p
            ),
            checkedInPlayers: state.checkedInPlayers.map(p => 
              p.id === id ? { ...p, ...updates } : p
            ),
            activePlayers: state.activePlayers.map(p => 
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
            checkedInPlayers: state.checkedInPlayers.map(p => 
              p.id === id ? originalData : p
            ),
            activePlayers: state.activePlayers.map(p => 
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
          players: state.players.slice(0, 200), // Limit cached players
          currentPlayer: state.currentPlayer,
          filters: state.filters,
          pagination: state.pagination,
          selectedTournamentId: state.selectedTournamentId,
          checkInStatus: state.checkInStatus,
          eliminationStatus: state.eliminationStatus
        })
      }
    )
  )
)

// Selector hooks for optimized re-renders
export const usePlayers = () => usePlayerStore(state => state.players)
export const useCheckedInPlayers = () => usePlayerStore(state => state.checkedInPlayers)
export const useActivePlayers = () => usePlayerStore(state => state.activePlayers)
export const useCurrentPlayer = () => usePlayerStore(state => state.currentPlayer)
export const usePlayerLoading = () => usePlayerStore(state => state.loading)
export const usePlayerError = () => usePlayerStore(state => state.error)
export const usePlayerConnection = () => usePlayerStore(state => state.isConnected)
export const useSelectedTournamentId = () => usePlayerStore(state => state.selectedTournamentId)