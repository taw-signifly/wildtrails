import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { persist } from 'zustand/middleware'
import { Match, MatchStatus, Score, Team } from '@/types'
import { MatchSupabaseDB } from '@/lib/db/matches-supabase'
import { createClientComponentClient } from '@/lib/db/supabase'

export interface MatchFilter {
  status?: MatchStatus[]
  tournamentId?: string
  courtId?: string
  round?: number
  teamId?: string
}

export interface MatchStoreState {
  // Match data
  matches: Match[]
  currentMatch: Match | null
  liveMatches: Match[] // matches with status 'active'
  
  // UI state
  loading: boolean
  error: string | null
  
  // Filters and pagination
  filters: MatchFilter
  pagination: {
    page: number
    limit: number
    total: number
    hasMore: boolean
  }
  
  // Real-time connection
  isConnected: boolean
  lastUpdated: string | null
  
  // Live scoring state
  selectedMatchId: string | null
  liveScore: Score | null
}

export interface MatchStoreActions {
  // Match CRUD operations
  createMatch: (matchData: Partial<Match>) => Promise<Match | null>
  updateMatch: (id: string, updates: Partial<Match>) => Promise<Match | null>
  deleteMatch: (id: string) => Promise<boolean>
  
  // Match queries
  loadMatches: (refresh?: boolean) => Promise<void>
  loadMatch: (id: string) => Promise<Match | null>
  loadMatchesByTournament: (tournamentId: string) => Promise<void>
  loadMatchesByCourt: (courtId: string) => Promise<void>
  loadLiveMatches: () => Promise<void>
  
  // Match management
  startMatch: (id: string) => Promise<Match | null>
  completeMatch: (id: string, finalScore: Score, winner: string) => Promise<Match | null>
  cancelMatch: (id: string) => Promise<Match | null>
  assignCourt: (matchId: string, courtId: string) => Promise<Match | null>
  
  // Live scoring
  updateScore: (matchId: string, score: Score) => Promise<Match | null>
  setSelectedMatch: (matchId: string | null) => void
  
  // Pagination and filtering
  setFilters: (filters: Partial<MatchFilter>) => void
  clearFilters: () => void
  loadMore: () => Promise<void>
  setCurrentPage: (page: number) => Promise<void>
  
  // Current match management
  setCurrentMatch: (match: Match | null) => void
  
  // Real-time updates
  startRealTimeUpdates: (tournamentId?: string) => void
  stopRealTimeUpdates: () => void
  
  // Broadcast events for live scoring
  broadcastScore: (matchId: string, score: Score) => void
  
  // Error handling
  clearError: () => void
  setError: (error: string) => void
  
  // Optimistic updates
  optimisticUpdate: (id: string, updates: Partial<Match>) => void
  rollbackOptimisticUpdate: (id: string, originalData: Match) => void
}

export type MatchStore = MatchStoreState & MatchStoreActions

// Lazy initialization for database and client
let _db: MatchSupabaseDB | null = null;
let _supabase: ReturnType<typeof createClientComponentClient> | null = null;

const getDB = () => {
  if (!_db) {
    _db = new MatchSupabaseDB();
  }
  return _db;
}

const getSupabase = () => {
  if (!_supabase) {
    _supabase = createClientComponentClient();
  }
  return _supabase;
}

export const useMatchStore = create<MatchStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // Initial state
        matches: [],
        currentMatch: null,
        liveMatches: [],
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
        selectedMatchId: null,
        liveScore: null,

        // Match CRUD operations
        createMatch: async (matchData: Partial<Match>) => {
          set({ loading: true, error: null })
          
          try {
            const result = await getDB().create(matchData as Match)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            const newMatch = result.data
            
            // Add to store with optimistic update
            set(state => ({
              matches: [newMatch, ...state.matches],
              pagination: {
                ...state.pagination,
                total: state.pagination.total + 1
              },
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
            const result = await getDB().update(id, updates)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            const updatedMatch = result.data
            
            set(state => ({
              matches: state.matches.map(m => 
                m.id === id ? updatedMatch : m
              ),
              liveMatches: updatedMatch.status === 'active' 
                ? state.liveMatches.map(m => m.id === id ? updatedMatch : m)
                : state.liveMatches.filter(m => m.id !== id),
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
            liveMatches: state.liveMatches.filter(m => m.id !== id),
            currentMatch: state.currentMatch?.id === id ? null : state.currentMatch,
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
            set({ matches: originalMatches })
            const errorMessage = error instanceof Error ? error.message : 'Failed to delete match'
            set({ error: errorMessage })
            return false
          }
        },

        // Match queries
        loadMatches: async (refresh = false) => {
          const state = get()
          
          if (state.loading) return
          if (!refresh && state.matches.length > 0) return
          
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
            
            const { matches, total, hasMore } = result.data
            
            set({
              matches: refresh ? matches : [...state.matches, ...matches],
              liveMatches: matches.filter(m => m.status === 'active'),
              pagination: {
                ...state.pagination,
                total,
                hasMore
              },
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
            const result = await getDB().findById(id)
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
          set({ loading: true, error: null })
          
          try {
            const result = await getDB().findByTournament(tournamentId)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            const matches = result.data
            
            set({
              matches,
              liveMatches: matches.filter(m => m.status === 'active'),
              pagination: { ...get().pagination, total: matches.length, hasMore: false },
              loading: false,
              lastUpdated: new Date().toISOString()
            })
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load tournament matches'
            set({ error: errorMessage, loading: false })
          }
        },

        loadMatchesByCourt: async (courtId: string) => {
          set({ loading: true, error: null })
          
          try {
            const result = await getDB().findByCourt(courtId)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            const matches = result.data
            
            set({
              matches,
              liveMatches: matches.filter(m => m.status === 'active'),
              pagination: { ...get().pagination, total: matches.length, hasMore: false },
              loading: false,
              lastUpdated: new Date().toISOString()
            })
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load court matches'
            set({ error: errorMessage, loading: false })
          }
        },

        loadLiveMatches: async () => {
          try {
            const result = await getDB().findByStatus('active')
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            set({
              liveMatches: result.data,
              lastUpdated: new Date().toISOString()
            })
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load live matches'
            set({ error: errorMessage })
          }
        },

        // Match management
        startMatch: async (id: string) => {
          return get().updateMatch(id, { 
            status: 'active' as MatchStatus, 
            actual_start_time: new Date().toISOString() 
          })
        },

        completeMatch: async (id: string, finalScore: Score, winner: string) => {
          return get().updateMatch(id, { 
            status: 'completed' as MatchStatus,
            actual_end_time: new Date().toISOString(),
            score: finalScore,
            winner 
          })
        },

        cancelMatch: async (id: string) => {
          return get().updateMatch(id, { status: 'cancelled' as MatchStatus })
        },

        assignCourt: async (matchId: string, courtId: string) => {
          return get().updateMatch(matchId, { court_id: courtId })
        },

        // Live scoring
        updateScore: async (matchId: string, score: Score) => {
          // Broadcast immediately for real-time updates
          get().broadcastScore(matchId, score)
          
          // Update database
          return get().updateMatch(matchId, { score })
        },

        setSelectedMatch: (matchId: string | null) => {
          set({ selectedMatchId: matchId })
        },

        // Pagination and filtering
        setFilters: (filters: Partial<MatchFilter>) => {
          set(state => ({ 
            filters: { ...state.filters, ...filters },
            pagination: { ...state.pagination, page: 1 }
          }))
          get().loadMatches(true)
        },

        clearFilters: () => {
          set({ 
            filters: {},
            pagination: { ...get().pagination, page: 1 }
          })
          get().loadMatches(true)
        },

        loadMore: async () => {
          const state = get()
          if (!state.pagination.hasMore || state.loading) return
          
          set(state => ({
            pagination: { ...state.pagination, page: state.pagination.page + 1 }
          }))
          
          await get().loadMatches()
        },

        setCurrentPage: async (page: number) => {
          set(state => ({
            pagination: { ...state.pagination, page },
            matches: []
          }))
          await get().loadMatches(true)
        },

        // Current match management
        setCurrentMatch: (match: Match | null) => {
          set({ currentMatch: match })
        },

        // Real-time updates
        startRealTimeUpdates: (tournamentId?: string) => {
          const subscription = getSupabase()
            .channel('matches_changes')
            .on('postgres_changes', 
              { event: '*', schema: 'public', table: 'matches' }, 
              (payload) => {
                const { eventType, new: newRecord, old: oldRecord } = payload
                
                set(state => {
                  let newMatches = [...state.matches]
                  let newLiveMatches = [...state.liveMatches]
                  
                  switch (eventType) {
                    case 'INSERT':
                      if (newRecord && (!tournamentId || newRecord.tournament_id === tournamentId)) {
                        const match = newRecord as Match
                        newMatches = [match, ...newMatches]
                        if (match.status === 'active') {
                          newLiveMatches = [match, ...newLiveMatches]
                        }
                      }
                      break
                    case 'UPDATE':
                      if (newRecord && (!tournamentId || newRecord.tournament_id === tournamentId)) {
                        const match = newRecord as Match
                        newMatches = newMatches.map(m => 
                          m.id === match.id ? match : m
                        )
                        
                        // Update live matches
                        if (match.status === 'active') {
                          newLiveMatches = newLiveMatches.some(m => m.id === match.id)
                            ? newLiveMatches.map(m => m.id === match.id ? match : m)
                            : [match, ...newLiveMatches]
                        } else {
                          newLiveMatches = newLiveMatches.filter(m => m.id !== match.id)
                        }
                      }
                      break
                    case 'DELETE':
                      if (oldRecord && (!tournamentId || oldRecord.tournament_id === tournamentId)) {
                        newMatches = newMatches.filter(m => m.id !== oldRecord.id)
                        newLiveMatches = newLiveMatches.filter(m => m.id !== oldRecord.id)
                      }
                      break
                  }
                  
                  return {
                    matches: newMatches,
                    liveMatches: newLiveMatches,
                    lastUpdated: new Date().toISOString(),
                    isConnected: true
                  }
                })
              }
            )
            .on('broadcast', 
              { event: 'live_score' }, 
              (payload) => {
                const { matchId, score } = payload.payload
                set(state => ({
                  liveScore: state.selectedMatchId === matchId ? score : state.liveScore,
                  matches: state.matches.map(m => 
                    m.id === matchId ? { ...m, score } : m
                  ),
                  liveMatches: state.liveMatches.map(m => 
                    m.id === matchId ? { ...m, score } : m
                  ),
                  lastUpdated: new Date().toISOString()
                }))
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

        // Broadcast events for live scoring
        broadcastScore: (matchId: string, score: Score) => {
          getSupabase()
            .channel('matches_changes')
            .send({
              type: 'broadcast',
              event: 'live_score',
              payload: { matchId, score }
            })
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
            liveMatches: state.liveMatches.map(m => 
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
            liveMatches: state.liveMatches.map(m => 
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
          matches: state.matches.slice(0, 100), // Limit cached matches
          currentMatch: state.currentMatch,
          filters: state.filters,
          pagination: state.pagination,
          selectedMatchId: state.selectedMatchId
        })
      }
    )
  )
)

// Selector hooks for optimized re-renders
export const useMatches = () => useMatchStore(state => state.matches)
export const useLiveMatches = () => useMatchStore(state => state.liveMatches)
export const useCurrentMatch = () => useMatchStore(state => state.currentMatch)
export const useMatchLoading = () => useMatchStore(state => state.loading)
export const useMatchError = () => useMatchStore(state => state.error)
export const useMatchConnection = () => useMatchStore(state => state.isConnected)
export const useSelectedMatch = () => useMatchStore(state => state.selectedMatchId)
export const useLiveScore = () => useMatchStore(state => state.liveScore)