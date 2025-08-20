import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { persist } from 'zustand/middleware'
import { Match, MatchStatus } from '@/types'
import { MatchSupabaseDB } from '@/lib/db/matches-supabase'
import { createClientComponentClient } from '@/lib/db/supabase'

export interface MatchFilter {
  tournamentId?: string
  status?: MatchStatus[]
  round?: number
  teamId?: string
  courtId?: string
}

export interface MatchStoreState {
  // Match data
  matches: Match[]
  currentMatch: Match | null
  activeMatches: Match[]
  
  // UI state
  loading: boolean
  error: string | null
  
  // Filters and context
  filters: MatchFilter
  selectedTournamentId: string | null
  
  // Real-time connection
  isConnected: boolean
  lastUpdated: string | null
}

export interface MatchStoreActions {
  // Match CRUD operations
  createMatch: (matchData: Omit<Match, 'id' | 'created_at' | 'updated_at'>) => Promise<Match | null>
  updateMatch: (id: string, updates: Partial<Match>) => Promise<Match | null>
  deleteMatch: (id: string) => Promise<boolean>
  
  // Match status operations
  startMatch: (id: string) => Promise<Match | null>
  completeMatch: (id: string, winnerId: string, score: any) => Promise<Match | null>
  cancelMatch: (id: string) => Promise<Match | null>
  
  // Match queries
  loadMatches: (filters?: MatchFilter, refresh?: boolean) => Promise<void>
  loadMatch: (id: string) => Promise<Match | null>
  loadMatchesByTournament: (tournamentId: string) => Promise<void>
  loadMatchesByRound: (tournamentId: string, round: number) => Promise<void>
  loadMatchesByTeam: (teamId: string) => Promise<void>
  loadActiveMatches: () => Promise<void>
  
  // Match management
  assignToCourt: (matchId: string, courtId: string) => Promise<Match | null>
  removeCourtAssignment: (matchId: string) => Promise<Match | null>
  updateScore: (id: string, score: any) => Promise<Match | null>
  
  // Bracket operations
  createRoundMatches: (tournamentId: string, round: number, matchesData: any[]) => Promise<Match[]>
  
  // Context management
  setSelectedTournament: (tournamentId: string | null) => void
  setCurrentMatch: (match: Match | null) => void
  setFilters: (filters: Partial<MatchFilter>) => void
  clearFilters: () => void
  
  // Statistics
  getMatchStats: (tournamentId: string) => Promise<any>
  
  // Real-time updates
  startRealTimeUpdates: () => void
  stopRealTimeUpdates: () => void
  
  // Error handling
  clearError: () => void
  setError: (error: string) => void
  
  // Optimistic updates
  optimisticUpdate: (id: string, updates: Partial<Match>) => void
  rollbackOptimisticUpdate: (id: string, originalData: Match) => void
}

export type MatchStore = MatchStoreState & MatchStoreActions

const db = new MatchSupabaseDB()
const supabase = createClientComponentClient()

export const useMatchStore = create<MatchStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // Initial state
        matches: [],
        currentMatch: null,
        activeMatches: [],
        loading: false,
        error: null,
        filters: {},
        selectedTournamentId: null,
        isConnected: false,
        lastUpdated: null,

        // Match CRUD operations
        createMatch: async (matchData) => {
          set({ loading: true, error: null })
          
          try {
            const result = await db.create(matchData)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            const newMatch = result.data
            
            set(state => ({
              matches: [...state.matches, newMatch],
              loading: false,
              lastUpdated: new Date().toISOString()
            }))
            
            return newMatch
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to create match'
            set({ error: errorMessage, loading: false })
            return null
          }
        },

        updateMatch: async (id: string, updates: Partial<Match>) => {
          const originalMatch = get().matches.find(m => m.id === id)
          if (!originalMatch) {
            set({ error: 'Match not found' })
            return null
          }

          // Optimistic update
          get().optimisticUpdate(id, updates)
          
          try {
            const result = await db.update(id, updates)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            const updatedMatch = result.data
            
            set(state => ({
              matches: state.matches.map(m => 
                m.id === id ? updatedMatch : m
              ),
              activeMatches: state.activeMatches.map(m => 
                m.id === id ? updatedMatch : m
              ),
              currentMatch: state.currentMatch?.id === id ? updatedMatch : state.currentMatch,
              lastUpdated: new Date().toISOString()
            }))
            
            return updatedMatch
          } catch (error) {
            // Rollback optimistic update
            get().rollbackOptimisticUpdate(id, originalMatch)
            const errorMessage = error instanceof Error ? error.message : 'Failed to update match'
            set({ error: errorMessage })
            return null
          }
        },

        deleteMatch: async (id: string) => {
          const originalMatches = get().matches
          
          // Optimistic removal
          set(state => ({
            matches: state.matches.filter(m => m.id !== id),
            activeMatches: state.activeMatches.filter(m => m.id !== id),
            currentMatch: state.currentMatch?.id === id ? null : state.currentMatch
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
            set({ matches: originalMatches })
            const errorMessage = error instanceof Error ? error.message : 'Failed to delete match'
            set({ error: errorMessage })
            return false
          }
        },

        // Match status operations
        startMatch: async (id: string) => {
          return get().updateMatch(id, { 
            status: 'in_progress',
            start_time: new Date().toISOString()
          })
        },

        completeMatch: async (id: string, winnerId: string, score: any) => {
          return get().updateMatch(id, { 
            status: 'completed',
            winner_id: winnerId,
            score,
            end_time: new Date().toISOString()
          })
        },

        cancelMatch: async (id: string) => {
          return get().updateMatch(id, { status: 'cancelled' })
        },

        // Match queries
        loadMatches: async (filters?: MatchFilter, refresh = false) => {
          const state = get()
          
          if (state.loading) return
          if (!refresh && state.matches.length > 0 && !filters) return
          
          set({ loading: true, error: null })
          
          if (filters) {
            set(state => ({ filters: { ...state.filters, ...filters } }))
          }
          
          try {
            let result
            const currentFilters = filters || state.filters

            if (currentFilters.tournamentId) {
              result = await db.findByTournament(currentFilters.tournamentId)
            } else if (currentFilters.status) {
              result = await db.findByStatus(currentFilters.status)
            } else if (currentFilters.teamId) {
              result = await db.findByTeam(currentFilters.teamId)
            } else if (currentFilters.courtId) {
              result = await db.findByCourt(currentFilters.courtId)
            } else {
              result = await db.findAll()
            }
            
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            set({
              matches: result.data,
              loading: false,
              lastUpdated: new Date().toISOString()
            })
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load matches'
            set({ error: errorMessage, loading: false })
          }
        },

        loadMatch: async (id: string) => {
          try {
            const result = await db.findById(id)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            const match = result.data
            if (!match) {
              throw new Error('Match not found')
            }
            
            // Update in matches list if present
            set(state => ({
              matches: state.matches.map(m => 
                m.id === id ? match : m
              ),
              currentMatch: match,
              lastUpdated: new Date().toISOString()
            }))
            
            return match
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load match'
            set({ error: errorMessage })
            return null
          }
        },

        loadMatchesByTournament: async (tournamentId: string) => {
          await get().loadMatches({ tournamentId }, true)
        },

        loadMatchesByRound: async (tournamentId: string, round: number) => {
          set({ loading: true, error: null })
          
          try {
            const result = await db.findByRound(tournamentId, round)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            set({
              matches: result.data,
              filters: { ...get().filters, tournamentId, round },
              loading: false,
              lastUpdated: new Date().toISOString()
            })
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load matches by round'
            set({ error: errorMessage, loading: false })
          }
        },

        loadMatchesByTeam: async (teamId: string) => {
          await get().loadMatches({ teamId }, true)
        },

        loadActiveMatches: async () => {
          try {
            const result = await db.findActive()
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            set({
              activeMatches: result.data,
              lastUpdated: new Date().toISOString()
            })
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load active matches'
            set({ error: errorMessage })
          }
        },

        // Match management
        assignToCourt: async (matchId: string, courtId: string) => {
          return get().updateMatch(matchId, { court_id: courtId })
        },

        removeCourtAssignment: async (matchId: string) => {
          return get().updateMatch(matchId, { court_id: null })
        },

        updateScore: async (id: string, score: any) => {
          return get().updateMatch(id, { score })
        },

        // Bracket operations
        createRoundMatches: async (tournamentId: string, round: number, matchesData: any[]) => {
          set({ loading: true, error: null })
          
          try {
            const result = await db.createRoundMatches(tournamentId, round, matchesData)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            const newMatches = result.data
            
            set(state => ({
              matches: [...state.matches, ...newMatches],
              loading: false,
              lastUpdated: new Date().toISOString()
            }))
            
            return newMatches
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to create round matches'
            set({ error: errorMessage, loading: false })
            return []
          }
        },

        // Context management
        setSelectedTournament: (tournamentId: string | null) => {
          set({ selectedTournamentId: tournamentId })
          if (tournamentId) {
            get().loadMatchesByTournament(tournamentId)
          }
        },

        setCurrentMatch: (match: Match | null) => {
          set({ currentMatch: match })
        },

        setFilters: (filters: Partial<MatchFilter>) => {
          set(state => ({ filters: { ...state.filters, ...filters } }))
          get().loadMatches(undefined, true)
        },

        clearFilters: () => {
          set({ filters: {} })
          get().loadMatches(undefined, true)
        },

        // Statistics
        getMatchStats: async (tournamentId: string) => {
          try {
            const result = await db.getTournamentMatchStats(tournamentId)
            return result.error ? null : result.data
          } catch (error) {
            set({ error: 'Failed to load match statistics' })
            return null
          }
        },

        // Real-time updates
        startRealTimeUpdates: () => {
          const subscription = supabase
            .channel('matches_changes')
            .on('postgres_changes', 
              { event: '*', schema: 'public', table: 'matches' }, 
              (payload) => {
                const { eventType, new: newRecord, old: oldRecord } = payload
                
                set(state => {
                  let newMatches = [...state.matches]
                  let newActiveMatches = [...state.activeMatches]
                  
                  switch (eventType) {
                    case 'INSERT':
                      if (newRecord) {
                        const match = newRecord as Match
                        newMatches = [...newMatches, match]
                        if (match.status === 'in_progress') {
                          newActiveMatches = [...newActiveMatches, match]
                        }
                      }
                      break
                    case 'UPDATE':
                      if (newRecord) {
                        const match = newRecord as Match
                        newMatches = newMatches.map(m => 
                          m.id === match.id ? match : m
                        )
                        
                        // Update active matches
                        if (match.status === 'in_progress') {
                          newActiveMatches = newActiveMatches.map(m => 
                            m.id === match.id ? match : m
                          )
                          if (!newActiveMatches.find(m => m.id === match.id)) {
                            newActiveMatches = [...newActiveMatches, match]
                          }
                        } else {
                          newActiveMatches = newActiveMatches.filter(m => m.id !== match.id)
                        }
                      }
                      break
                    case 'DELETE':
                      if (oldRecord) {
                        newMatches = newMatches.filter(m => m.id !== oldRecord.id)
                        newActiveMatches = newActiveMatches.filter(m => m.id !== oldRecord.id)
                      }
                      break
                  }
                  
                  return {
                    matches: newMatches,
                    activeMatches: newActiveMatches,
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
        optimisticUpdate: (id: string, updates: Partial<Match>) => {
          set(state => ({
            matches: state.matches.map(m => 
              m.id === id ? { ...m, ...updates } : m
            ),
            activeMatches: state.activeMatches.map(m => 
              m.id === id ? { ...m, ...updates } : m
            ),
            currentMatch: state.currentMatch?.id === id 
              ? { ...state.currentMatch, ...updates } 
              : state.currentMatch
          }))
        },

        rollbackOptimisticUpdate: (id: string, originalData: Match) => {
          set(state => ({
            matches: state.matches.map(m => 
              m.id === id ? originalData : m
            ),
            activeMatches: state.activeMatches.map(m => 
              m.id === id ? originalData : m
            ),
            currentMatch: state.currentMatch?.id === id 
              ? originalData 
              : state.currentMatch
          }))
        }
      }),
      {
        name: 'match-store',
        partialize: (state) => ({
          // Only persist essential data, not loading states
          matches: state.matches.slice(-50), // Keep recent matches
          currentMatch: state.currentMatch,
          filters: state.filters,
          selectedTournamentId: state.selectedTournamentId
        })
      }
    )
  )
)

// Selector hooks for optimized re-renders
export const useMatches = () => useMatchStore(state => state.matches)
export const useActiveMatches = () => useMatchStore(state => state.activeMatches)
export const useCurrentMatch = () => useMatchStore(state => state.currentMatch)
export const useMatchLoading = () => useMatchStore(state => state.loading)
export const useMatchError = () => useMatchStore(state => state.error)