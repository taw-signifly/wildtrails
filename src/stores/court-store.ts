import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { persist } from 'zustand/middleware'
import { Court, CourtStatus } from '@/types'
import { CourtSupabaseDB } from '@/lib/db/courts-supabase'
import { createClientComponentClient } from '@/lib/db/supabase'

export interface CourtFilter {
  tournamentId?: string
  status?: CourtStatus[]
  search?: string
  location?: string
}

export interface CourtStoreState {
  // Court data
  courts: Court[]
  currentCourt: Court | null
  availableCourts: Court[]
  
  // UI state
  loading: boolean
  error: string | null
  
  // Filters and context
  filters: CourtFilter
  selectedTournamentId: string | null
  
  // Real-time connection
  isConnected: boolean
  lastUpdated: string | null
  realtimeSubscription: any
  matchAssignmentSubscriptions: Map<string, any>
}

export interface CourtStoreActions {
  // Court CRUD operations
  createCourt: (courtData: Omit<Court, 'id' | 'created_at' | 'updated_at'>) => Promise<Court | null>
  updateCourt: (id: string, updates: Partial<Court>) => Promise<Court | null>
  deleteCourt: (id: string) => Promise<boolean>
  
  // Court status operations
  updateCourtStatus: (id: string, status: CourtStatus) => Promise<Court | null>
  markCourtOccupied: (id: string) => Promise<Court | null>
  markCourtAvailable: (id: string) => Promise<Court | null>
  markCourtMaintenance: (id: string) => Promise<Court | null>
  
  // Court queries
  loadCourts: (filters?: CourtFilter, refresh?: boolean) => Promise<void>
  loadCourt: (id: string) => Promise<Court | null>
  loadCourtsByTournament: (tournamentId: string) => Promise<void>
  loadAvailableCourts: (tournamentId: string) => Promise<void>
  loadCourtsWithMatches: (tournamentId: string) => Promise<void>
  
  // Court management
  assignMatchToCourt: (courtId: string, matchId: string) => Promise<void>
  releaseCourt: (courtId: string, matchId: string) => Promise<void>
  findNextAvailableCourt: (tournamentId: string) => Promise<Court | null>
  
  // Bulk operations
  createMultipleCourts: (tournamentId: string, courtData: Array<{name: string, location?: string, notes?: string}>) => Promise<Court[]>
  
  // Context management
  setSelectedTournament: (tournamentId: string | null) => void
  setCurrentCourt: (court: Court | null) => void
  setFilters: (filters: Partial<CourtFilter>) => void
  clearFilters: () => void
  
  // Statistics
  getCourtStats: (courtId: string) => Promise<any>
  getTournamentCourtStats: (tournamentId: string) => Promise<any>
  
  // Real-time updates
  startRealTimeUpdates: (tournamentId?: string) => void
  stopRealTimeUpdates: () => void
  
  // Court assignment broadcasts
  broadcastCourtAssignment: (courtId: string, matchId: string) => void
  broadcastCourtRelease: (courtId: string, matchId: string) => void
  
  // Error handling
  clearError: () => void
  setError: (error: string) => void
  
  // Optimistic updates
  optimisticUpdate: (id: string, updates: Partial<Court>) => void
  rollbackOptimisticUpdate: (id: string, originalData: Court) => void
}

export type CourtStore = CourtStoreState & CourtStoreActions

const db = new CourtSupabaseDB()
const supabase = createClientComponentClient()

export const useCourtStore = create<CourtStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // Initial state
        courts: [],
        currentCourt: null,
        availableCourts: [],
        loading: false,
        error: null,
        filters: {},
        selectedTournamentId: null,
        isConnected: false,
        lastUpdated: null,
        realtimeSubscription: null,
        matchAssignmentSubscriptions: new Map(),

        // Court CRUD operations
        createCourt: async (courtData) => {
          set({ loading: true, error: null })
          
          try {
            const result = await db.create(courtData)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            const newCourt = result.data
            
            set(state => ({
              courts: [...state.courts, newCourt],
              availableCourts: newCourt.status === 'available' 
                ? [...state.availableCourts, newCourt]
                : state.availableCourts,
              loading: false,
              lastUpdated: new Date().toISOString()
            }))
            
            return newCourt
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to create court'
            set({ error: errorMessage, loading: false })
            return null
          }
        },

        updateCourt: async (id: string, updates: Partial<Court>) => {
          const originalCourt = get().courts.find(c => c.id === id)
          if (!originalCourt) {
            set({ error: 'Court not found' })
            return null
          }

          // Optimistic update
          get().optimisticUpdate(id, updates)
          
          try {
            const result = await db.update(id, updates)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            const updatedCourt = result.data
            
            set(state => ({
              courts: state.courts.map(c => 
                c.id === id ? updatedCourt : c
              ),
              availableCourts: state.availableCourts.map(c => 
                c.id === id ? updatedCourt : c
              ).filter(c => c.status === 'available'),
              currentCourt: state.currentCourt?.id === id ? updatedCourt : state.currentCourt,
              lastUpdated: new Date().toISOString()
            }))
            
            return updatedCourt
          } catch (error) {
            // Rollback optimistic update
            get().rollbackOptimisticUpdate(id, originalCourt)
            const errorMessage = error instanceof Error ? error.message : 'Failed to update court'
            set({ error: errorMessage })
            return null
          }
        },

        deleteCourt: async (id: string) => {
          const originalCourts = get().courts
          const originalAvailable = get().availableCourts
          
          // Optimistic removal
          set(state => ({
            courts: state.courts.filter(c => c.id !== id),
            availableCourts: state.availableCourts.filter(c => c.id !== id),
            currentCourt: state.currentCourt?.id === id ? null : state.currentCourt
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
            set({ courts: originalCourts, availableCourts: originalAvailable })
            const errorMessage = error instanceof Error ? error.message : 'Failed to delete court'
            set({ error: errorMessage })
            return false
          }
        },

        // Court status operations
        updateCourtStatus: async (id: string, status: CourtStatus) => {
          return get().updateCourt(id, { status })
        },

        markCourtOccupied: async (id: string) => {
          return get().updateCourtStatus(id, 'occupied')
        },

        markCourtAvailable: async (id: string) => {
          return get().updateCourtStatus(id, 'available')
        },

        markCourtMaintenance: async (id: string) => {
          return get().updateCourtStatus(id, 'maintenance')
        },

        // Court queries
        loadCourts: async (filters?: CourtFilter, refresh = false) => {
          const state = get()
          
          if (state.loading) return
          if (!refresh && state.courts.length > 0 && !filters) return
          
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
            } else {
              result = await db.findAll()
            }
            
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            const courts = result.data
            const availableCourts = courts.filter(c => c.status === 'available')
            
            set({
              courts,
              availableCourts,
              loading: false,
              lastUpdated: new Date().toISOString()
            })
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load courts'
            set({ error: errorMessage, loading: false })
          }
        },

        loadCourt: async (id: string) => {
          try {
            const result = await db.findById(id)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            const court = result.data
            if (!court) {
              throw new Error('Court not found')
            }
            
            // Update in courts list if present
            set(state => ({
              courts: state.courts.map(c => 
                c.id === id ? court : c
              ),
              availableCourts: state.availableCourts.map(c => 
                c.id === id ? court : c
              ).filter(c => c.status === 'available'),
              currentCourt: court,
              lastUpdated: new Date().toISOString()
            }))
            
            return court
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load court'
            set({ error: errorMessage })
            return null
          }
        },

        loadCourtsByTournament: async (tournamentId: string) => {
          await get().loadCourts({ tournamentId }, true)
        },

        loadAvailableCourts: async (tournamentId: string) => {
          try {
            const result = await db.findAvailable(tournamentId)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            set({
              availableCourts: result.data,
              lastUpdated: new Date().toISOString()
            })
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load available courts'
            set({ error: errorMessage })
          }
        },

        loadCourtsWithMatches: async (tournamentId: string) => {
          try {
            const result = await db.findWithCurrentMatches(tournamentId)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            set({
              courts: result.data,
              lastUpdated: new Date().toISOString()
            })
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load courts with matches'
            set({ error: errorMessage })
          }
        },

        // Court management
        assignMatchToCourt: async (courtId: string, matchId: string) => {
          try {
            const result = await db.assignMatch(courtId, matchId)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            // Optimistically update court status
            get().optimisticUpdate(courtId, { status: 'occupied' })
            
            // Broadcast the assignment
            get().broadcastCourtAssignment(courtId, matchId)
            
            set({ lastUpdated: new Date().toISOString() })
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to assign match to court'
            set({ error: errorMessage })
          }
        },

        releaseCourt: async (courtId: string, matchId: string) => {
          try {
            const result = await db.releaseFromMatch(courtId, matchId)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            // Optimistically update court status
            get().optimisticUpdate(courtId, { status: 'available' })
            
            // Broadcast the release
            get().broadcastCourtRelease(courtId, matchId)
            
            set({ lastUpdated: new Date().toISOString() })
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to release court'
            set({ error: errorMessage })
          }
        },

        findNextAvailableCourt: async (tournamentId: string) => {
          try {
            const result = await db.findNextAvailable(tournamentId)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            return result.data
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to find next available court'
            set({ error: errorMessage })
            return null
          }
        },

        // Bulk operations
        createMultipleCourts: async (tournamentId: string, courtData) => {
          set({ loading: true, error: null })
          
          try {
            const result = await db.createMultiple(tournamentId, courtData)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            const newCourts = result.data
            const availableNewCourts = newCourts.filter(c => c.status === 'available')
            
            set(state => ({
              courts: [...state.courts, ...newCourts],
              availableCourts: [...state.availableCourts, ...availableNewCourts],
              loading: false,
              lastUpdated: new Date().toISOString()
            }))
            
            return newCourts
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to create multiple courts'
            set({ error: errorMessage, loading: false })
            return []
          }
        },

        // Context management
        setSelectedTournament: (tournamentId: string | null) => {
          set({ selectedTournamentId: tournamentId })
          if (tournamentId) {
            get().loadCourtsByTournament(tournamentId)
          }
        },

        setCurrentCourt: (court: Court | null) => {
          set({ currentCourt: court })
        },

        setFilters: (filters: Partial<CourtFilter>) => {
          set(state => ({ filters: { ...state.filters, ...filters } }))
          get().loadCourts(undefined, true)
        },

        clearFilters: () => {
          set({ filters: {} })
          get().loadCourts(undefined, true)
        },

        // Statistics
        getCourtStats: async (courtId: string) => {
          try {
            const result = await db.getCourtStats(courtId)
            return result.error ? null : result.data
          } catch (error) {
            set({ error: 'Failed to load court statistics' })
            return null
          }
        },

        getTournamentCourtStats: async (tournamentId: string) => {
          try {
            const result = await db.getTournamentCourtStats(tournamentId)
            return result.error ? null : result.data
          } catch (error) {
            set({ error: 'Failed to load tournament court statistics' })
            return null
          }
        },

        // Real-time updates
        startRealTimeUpdates: (tournamentId?: string) => {
          // Stop existing subscriptions
          get().stopRealTimeUpdates()
          
          const channelName = tournamentId ? `courts_tournament_${tournamentId}` : 'courts_all'
          
          const subscription = supabase
            .channel(channelName)
            .on('postgres_changes', 
              { 
                event: '*', 
                schema: 'public', 
                table: 'courts',
                filter: tournamentId ? `tournament_id=eq.${tournamentId}` : undefined
              }, 
              (payload) => {
                const { eventType, new: newRecord, old: oldRecord } = payload
                
                set(state => {
                  let newCourts = [...state.courts]
                  let newAvailableCourts = [...state.availableCourts]
                  
                  switch (eventType) {
                    case 'INSERT':
                      if (newRecord) {
                        const court = newRecord as Court
                        if (!newCourts.find(c => c.id === court.id)) {
                          newCourts = [...newCourts, court]
                        }
                        if (court.status === 'available' && !newAvailableCourts.find(c => c.id === court.id)) {
                          newAvailableCourts = [...newAvailableCourts, court]
                        }
                      }
                      break
                    case 'UPDATE':
                      if (newRecord) {
                        const court = newRecord as Court
                        newCourts = newCourts.map(c => 
                          c.id === court.id ? court : c
                        )
                        
                        // Update available courts based on status
                        if (court.status === 'available') {
                          newAvailableCourts = newAvailableCourts.map(c => 
                            c.id === court.id ? court : c
                          )
                          if (!newAvailableCourts.find(c => c.id === court.id)) {
                            newAvailableCourts = [...newAvailableCourts, court]
                          }
                        } else {
                          newAvailableCourts = newAvailableCourts.filter(c => c.id !== court.id)
                        }
                        
                        // Update current court if it's the same
                        if (state.currentCourt?.id === court.id) {
                          set({ currentCourt: court })
                        }
                      }
                      break
                    case 'DELETE':
                      if (oldRecord) {
                        newCourts = newCourts.filter(c => c.id !== oldRecord.id)
                        newAvailableCourts = newAvailableCourts.filter(c => c.id !== oldRecord.id)
                        
                        // Clear current court if it was deleted
                        if (state.currentCourt?.id === oldRecord.id) {
                          set({ currentCourt: null })
                        }
                      }
                      break
                  }
                  
                  return {
                    courts: newCourts,
                    availableCourts: newAvailableCourts,
                    lastUpdated: new Date().toISOString(),
                    isConnected: true
                  }
                })
              }
            )
            .on('broadcast', 
              { event: 'court_event' }, 
              (payload) => {
                const { type, courtId, matchId, data } = payload.payload
                
                switch (type) {
                  case 'court_assigned':
                    console.log('Court assigned:', courtId, 'to match:', matchId)
                    break
                  case 'court_released':
                    console.log('Court released:', courtId, 'from match:', matchId)
                    break
                  case 'court_maintenance':
                    console.log('Court maintenance:', courtId, data)
                    break
                }
              }
            )
            .subscribe((status) => {
              set({ 
                isConnected: status === 'SUBSCRIBED',
                realtimeSubscription: status === 'SUBSCRIBED' ? subscription : null
              })
            })
            
          // Subscribe to match changes for court assignments
          if (tournamentId) {
            const matchSubscription = supabase
              .channel(`match_court_assignments_${tournamentId}`)
              .on('postgres_changes',
                { 
                  event: 'UPDATE', 
                  schema: 'public', 
                  table: 'matches',
                  filter: `tournament_id=eq.${tournamentId}`
                },
                (payload) => {
                  const { new: newMatch, old: oldMatch } = payload
                  
                  // Handle court assignment changes
                  if (newMatch?.court_id !== oldMatch?.court_id) {
                    console.log('Match court assignment changed:', newMatch.id, 
                      'from:', oldMatch?.court_id, 'to:', newMatch?.court_id)
                    set({ lastUpdated: new Date().toISOString() })
                  }
                }
              )
              .subscribe()
              
            set(state => {
              const newSubscriptions = new Map(state.matchAssignmentSubscriptions)
              newSubscriptions.set(tournamentId, matchSubscription)
              return { matchAssignmentSubscriptions: newSubscriptions }
            })
          }
        },

        stopRealTimeUpdates: () => {
          const state = get()
          
          // Remove all channels
          supabase.removeAllChannels()
          
          // Clear match assignment subscriptions
          state.matchAssignmentSubscriptions.clear()
          
          set({ 
            isConnected: false,
            realtimeSubscription: null,
            matchAssignmentSubscriptions: new Map()
          })
        },
        
        // Court assignment broadcasts
        broadcastCourtAssignment: (courtId: string, matchId: string) => {
          const state = get()
          if (!state.realtimeSubscription) return
          
          state.realtimeSubscription.send({
            type: 'broadcast',
            event: 'court_event',
            payload: {
              type: 'court_assigned',
              courtId,
              matchId,
              timestamp: new Date().toISOString()
            }
          })
        },
        
        broadcastCourtRelease: (courtId: string, matchId: string) => {
          const state = get()
          if (!state.realtimeSubscription) return
          
          state.realtimeSubscription.send({
            type: 'broadcast',
            event: 'court_event',
            payload: {
              type: 'court_released',
              courtId,
              matchId,
              timestamp: new Date().toISOString()
            }
          })
        },

        // Error handling
        clearError: () => set({ error: null }),
        setError: (error: string) => set({ error }),

        // Optimistic updates
        optimisticUpdate: (id: string, updates: Partial<Court>) => {
          set(state => ({
            courts: state.courts.map(c => 
              c.id === id ? { ...c, ...updates } : c
            ),
            availableCourts: state.availableCourts
              .map(c => c.id === id ? { ...c, ...updates } : c)
              .filter(c => c.status === 'available'),
            currentCourt: state.currentCourt?.id === id 
              ? { ...state.currentCourt, ...updates } 
              : state.currentCourt
          }))
        },

        rollbackOptimisticUpdate: (id: string, originalData: Court) => {
          set(state => ({
            courts: state.courts.map(c => 
              c.id === id ? originalData : c
            ),
            availableCourts: state.availableCourts
              .map(c => c.id === id ? originalData : c)
              .filter(c => c.status === 'available'),
            currentCourt: state.currentCourt?.id === id 
              ? originalData 
              : state.currentCourt
          }))
        }
      }),
      {
        name: 'court-store',
        partialize: (state) => ({
          // Only persist essential data, not loading states or real-time connections
          courts: state.courts.slice(-30), // Keep recent courts
          currentCourt: state.currentCourt,
          filters: state.filters,
          selectedTournamentId: state.selectedTournamentId
          // Don't persist: isConnected, realtimeSubscription, matchAssignmentSubscriptions
        })
      }
    )
  )
)

// Selector hooks for optimized re-renders
export const useCourts = () => useCourtStore(state => state.courts)
export const useAvailableCourts = () => useCourtStore(state => state.availableCourts)
export const useCurrentCourt = () => useCourtStore(state => state.currentCourt)
export const useCourtLoading = () => useCourtStore(state => state.loading)
export const useCourtError = () => useCourtStore(state => state.error)