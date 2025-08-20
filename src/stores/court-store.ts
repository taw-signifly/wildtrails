import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { persist } from 'zustand/middleware'
import { Court, CourtStatus } from '@/types'
import { CourtSupabaseDB } from '@/lib/db/courts-supabase'
import { createClientComponentClient } from '@/lib/db/supabase'

export interface CourtFilter {
  status?: CourtStatus[]
  surface?: string[]
  lighting?: boolean
  covered?: boolean
  location?: string
  search?: string
}

export interface CourtStoreState {
  // Court data
  courts: Court[]
  currentCourt: Court | null
  availableCourts: Court[] // courts with status 'available'
  occupiedCourts: Court[] // courts with active matches
  
  // UI state
  loading: boolean
  error: string | null
  
  // Filters and pagination
  filters: CourtFilter
  pagination: {
    page: number
    limit: number
    total: number
    hasMore: boolean
  }
  
  // Real-time connection
  isConnected: boolean
  lastUpdated: string | null
  
  // Court assignment state
  courtAssignments: Record<string, string> // courtId -> matchId
  courtSchedule: Record<string, string[]> // courtId -> array of scheduled match IDs
}

export interface CourtStoreActions {
  // Court CRUD operations
  createCourt: (courtData: Partial<Court>) => Promise<Court | null>
  updateCourt: (id: string, updates: Partial<Court>) => Promise<Court | null>
  deleteCourt: (id: string) => Promise<boolean>
  
  // Court queries
  loadCourts: (refresh?: boolean) => Promise<void>
  loadCourt: (id: string) => Promise<Court | null>
  loadAvailableCourts: () => Promise<void>
  searchCourts: (query: string) => Promise<void>
  
  // Court management
  assignMatch: (courtId: string, matchId: string) => Promise<Court | null>
  unassignMatch: (courtId: string) => Promise<Court | null>
  setCourtStatus: (courtId: string, status: CourtStatus, reason?: string) => Promise<Court | null>
  scheduleMatch: (courtId: string, matchId: string, position?: number) => Promise<boolean>
  unscheduleMatch: (courtId: string, matchId: string) => Promise<boolean>
  
  // Court availability
  getAvailableCourtsByTime: (timeSlot: string) => Court[]
  getOptimalCourtAssignment: (matchIds: string[]) => Record<string, string> // matchId -> courtId
  
  // Maintenance and status
  setMaintenanceMode: (courtId: string, reason: string) => Promise<Court | null>
  clearMaintenance: (courtId: string) => Promise<Court | null>
  reserveCourt: (courtId: string, reason: string, duration?: number) => Promise<Court | null>
  
  // Pagination and filtering
  setFilters: (filters: Partial<CourtFilter>) => void
  clearFilters: () => void
  loadMore: () => Promise<void>
  setCurrentPage: (page: number) => Promise<void>
  
  // Current court management
  setCurrentCourt: (court: Court | null) => void
  
  // Real-time updates
  startRealTimeUpdates: () => void
  stopRealTimeUpdates: () => void
  
  // Error handling
  clearError: () => void
  setError: (error: string) => void
  
  // Optimistic updates
  optimisticUpdate: (id: string, updates: Partial<Court>) => void
  rollbackOptimisticUpdate: (id: string, originalData: Court) => void
}

export type CourtStore = CourtStoreState & CourtStoreActions

// Lazy initialization for database and client
let _db: CourtSupabaseDB | null = null;
let _supabase: ReturnType<typeof createClientComponentClient> | null = null;

const getDB = () => {
  if (!_db) {
    _db = new CourtSupabaseDB();
  }
  return _db;
}

const getSupabase = () => {
  if (!_supabase) {
    _supabase = createClientComponentClient();
  }
  return _supabase;
}

export const useCourtStore = create<CourtStore>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        // Initial state
        courts: [],
        currentCourt: null,
        availableCourts: [],
        occupiedCourts: [],
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
        courtAssignments: {},
        courtSchedule: {},

        // Court CRUD operations
        createCourt: async (courtData: Partial<Court>) => {
          set({ loading: true, error: null })
          
          try {
            const result = await getDB().create(courtData as Court)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            const newCourt = result.data
            
            // Add to store with optimistic update
            set(state => ({
              courts: [newCourt, ...state.courts],
              availableCourts: newCourt.status === 'available' 
                ? [newCourt, ...state.availableCourts]
                : state.availableCourts,
              pagination: {
                ...state.pagination,
                total: state.pagination.total + 1
              },
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
            const result = await getDB().update(id, updates)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            const updatedCourt = result.data
            
            set(state => {
              const newAvailableCourts = updatedCourt.status === 'available'
                ? state.availableCourts.some(c => c.id === id)
                  ? state.availableCourts.map(c => c.id === id ? updatedCourt : c)
                  : [updatedCourt, ...state.availableCourts.filter(c => c.id !== id)]
                : state.availableCourts.filter(c => c.id !== id)
              
              const newOccupiedCourts = updatedCourt.status === 'occupied'
                ? state.occupiedCourts.some(c => c.id === id)
                  ? state.occupiedCourts.map(c => c.id === id ? updatedCourt : c)
                  : [updatedCourt, ...state.occupiedCourts.filter(c => c.id !== id)]
                : state.occupiedCourts.filter(c => c.id !== id)
              
              return {
                courts: state.courts.map(c => c.id === id ? updatedCourt : c),
                availableCourts: newAvailableCourts,
                occupiedCourts: newOccupiedCourts,
                currentCourt: state.currentCourt?.id === id ? updatedCourt : state.currentCourt,
                lastUpdated: new Date().toISOString()
              }
            })
            
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
          
          // Optimistic removal
          set(state => ({
            courts: state.courts.filter(c => c.id !== id),
            availableCourts: state.availableCourts.filter(c => c.id !== id),
            occupiedCourts: state.occupiedCourts.filter(c => c.id !== id),
            currentCourt: state.currentCourt?.id === id ? null : state.currentCourt,
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
            set({ courts: originalCourts })
            const errorMessage = error instanceof Error ? error.message : 'Failed to delete court'
            set({ error: errorMessage })
            return false
          }
        },

        // Court queries
        loadCourts: async (refresh = false) => {
          const state = get()
          
          if (state.loading) return
          if (!refresh && state.courts.length > 0) return
          
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
            
            const { courts, total, hasMore } = result.data
            
            set({
              courts: refresh ? courts : [...state.courts, ...courts],
              availableCourts: courts.filter(c => c.status === 'available'),
              occupiedCourts: courts.filter(c => c.status === 'occupied'),
              pagination: {
                ...state.pagination,
                total,
                hasMore
              },
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
            const result = await getDB().findById(id)
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

        loadAvailableCourts: async () => {
          try {
            const result = await getDB().findByStatus('available')
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

        searchCourts: async (query: string) => {
          set({ loading: true, error: null, filters: { ...get().filters, search: query } })
          
          try {
            const result = await getDB().search(query)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            const courts = result.data
            set({
              courts,
              availableCourts: courts.filter(c => c.status === 'available'),
              occupiedCourts: courts.filter(c => c.status === 'occupied'),
              pagination: { ...get().pagination, page: 1, total: courts.length, hasMore: false },
              loading: false,
              lastUpdated: new Date().toISOString()
            })
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to search courts'
            set({ error: errorMessage, loading: false })
          }
        },

        // Court management
        assignMatch: async (courtId: string, matchId: string) => {
          const updates = { 
            status: 'occupied' as CourtStatus, 
            currentMatch: matchId,
            updated_at: new Date().toISOString()
          }
          
          const result = await get().updateCourt(courtId, updates)
          if (result) {
            set(state => ({
              courtAssignments: { ...state.courtAssignments, [courtId]: matchId }
            }))
          }
          return result
        },

        unassignMatch: async (courtId: string) => {
          const updates = { 
            status: 'available' as CourtStatus, 
            currentMatch: undefined,
            updated_at: new Date().toISOString()
          }
          
          const result = await get().updateCourt(courtId, updates)
          if (result) {
            set(state => {
              const newAssignments = { ...state.courtAssignments }
              delete newAssignments[courtId]
              return { courtAssignments: newAssignments }
            })
          }
          return result
        },

        setCourtStatus: async (courtId: string, status: CourtStatus, reason?: string) => {
          return get().updateCourt(courtId, { 
            status, 
            updated_at: new Date().toISOString()
          })
        },

        scheduleMatch: async (courtId: string, matchId: string, position?: number) => {
          try {
            const result = await getDB().scheduleMatch(courtId, matchId, position)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            set(state => {
              const currentSchedule = state.courtSchedule[courtId] || []
              const newSchedule = position !== undefined 
                ? [...currentSchedule.slice(0, position), matchId, ...currentSchedule.slice(position)]
                : [...currentSchedule, matchId]
              
              return {
                courtSchedule: { ...state.courtSchedule, [courtId]: newSchedule },
                lastUpdated: new Date().toISOString()
              }
            })
            
            return true
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to schedule match'
            set({ error: errorMessage })
            return false
          }
        },

        unscheduleMatch: async (courtId: string, matchId: string) => {
          try {
            const result = await getDB().unscheduleMatch(courtId, matchId)
            if (result.error) {
              throw new Error(result.error.message)
            }
            
            set(state => ({
              courtSchedule: {
                ...state.courtSchedule,
                [courtId]: (state.courtSchedule[courtId] || []).filter(id => id !== matchId)
              },
              lastUpdated: new Date().toISOString()
            }))
            
            return true
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to unschedule match'
            set({ error: errorMessage })
            return false
          }
        },

        // Court availability
        getAvailableCourtsByTime: (timeSlot: string) => {
          const state = get()
          return state.availableCourts.filter(court => {
            const schedule = state.courtSchedule[court.id] || []
            // Simple availability check - in practice this would consider actual match times
            return schedule.length < 3 // Allow up to 3 scheduled matches
          })
        },

        getOptimalCourtAssignment: (matchIds: string[]) => {
          const state = get()
          const assignments: Record<string, string> = {}
          const availableCourts = [...state.availableCourts]
          
          // Simple greedy assignment - in practice this would be more sophisticated
          for (let i = 0; i < matchIds.length && i < availableCourts.length; i++) {
            assignments[matchIds[i]] = availableCourts[i].id
          }
          
          return assignments
        },

        // Maintenance and status
        setMaintenanceMode: async (courtId: string, reason: string) => {
          return get().updateCourt(courtId, { 
            status: 'maintenance' as CourtStatus,
            updated_at: new Date().toISOString()
          })
        },

        clearMaintenance: async (courtId: string) => {
          return get().updateCourt(courtId, { 
            status: 'available' as CourtStatus,
            updated_at: new Date().toISOString()
          })
        },

        reserveCourt: async (courtId: string, reason: string, duration?: number) => {
          return get().updateCourt(courtId, { 
            status: 'reserved' as CourtStatus,
            updated_at: new Date().toISOString()
          })
        },

        // Pagination and filtering
        setFilters: (filters: Partial<CourtFilter>) => {
          set(state => ({ 
            filters: { ...state.filters, ...filters },
            pagination: { ...state.pagination, page: 1 }
          }))
          get().loadCourts(true)
        },

        clearFilters: () => {
          set({ 
            filters: {},
            pagination: { ...get().pagination, page: 1 }
          })
          get().loadCourts(true)
        },

        loadMore: async () => {
          const state = get()
          if (!state.pagination.hasMore || state.loading) return
          
          set(state => ({
            pagination: { ...state.pagination, page: state.pagination.page + 1 }
          }))
          
          await get().loadCourts()
        },

        setCurrentPage: async (page: number) => {
          set(state => ({
            pagination: { ...state.pagination, page },
            courts: []
          }))
          await get().loadCourts(true)
        },

        // Current court management
        setCurrentCourt: (court: Court | null) => {
          set({ currentCourt: court })
        },

        // Real-time updates
        startRealTimeUpdates: () => {
          const subscription = getSupabase()
            .channel('courts_changes')
            .on('postgres_changes', 
              { event: '*', schema: 'public', table: 'courts' }, 
              (payload) => {
                const { eventType, new: newRecord, old: oldRecord } = payload
                
                set(state => {
                  let newCourts = [...state.courts]
                  let newAvailableCourts = [...state.availableCourts]
                  let newOccupiedCourts = [...state.occupiedCourts]
                  
                  switch (eventType) {
                    case 'INSERT':
                      if (newRecord) {
                        const court = newRecord as Court
                        newCourts = [court, ...newCourts]
                        if (court.status === 'available') {
                          newAvailableCourts = [court, ...newAvailableCourts]
                        } else if (court.status === 'occupied') {
                          newOccupiedCourts = [court, ...newOccupiedCourts]
                        }
                      }
                      break
                    case 'UPDATE':
                      if (newRecord) {
                        const court = newRecord as Court
                        newCourts = newCourts.map(c => c.id === court.id ? court : c)
                        
                        // Update available courts
                        if (court.status === 'available') {
                          newAvailableCourts = newAvailableCourts.some(c => c.id === court.id)
                            ? newAvailableCourts.map(c => c.id === court.id ? court : c)
                            : [court, ...newAvailableCourts]
                          newOccupiedCourts = newOccupiedCourts.filter(c => c.id !== court.id)
                        } else if (court.status === 'occupied') {
                          newOccupiedCourts = newOccupiedCourts.some(c => c.id === court.id)
                            ? newOccupiedCourts.map(c => c.id === court.id ? court : c)
                            : [court, ...newOccupiedCourts]
                          newAvailableCourts = newAvailableCourts.filter(c => c.id !== court.id)
                        } else {
                          // Court is in maintenance or reserved
                          newAvailableCourts = newAvailableCourts.filter(c => c.id !== court.id)
                          newOccupiedCourts = newOccupiedCourts.filter(c => c.id !== court.id)
                        }
                        
                        // Update court assignments
                        if (court.currentMatch) {
                          state.courtAssignments[court.id] = court.currentMatch
                        } else {
                          delete state.courtAssignments[court.id]
                        }
                      }
                      break
                    case 'DELETE':
                      if (oldRecord) {
                        newCourts = newCourts.filter(c => c.id !== oldRecord.id)
                        newAvailableCourts = newAvailableCourts.filter(c => c.id !== oldRecord.id)
                        newOccupiedCourts = newOccupiedCourts.filter(c => c.id !== oldRecord.id)
                        delete state.courtAssignments[oldRecord.id]
                        delete state.courtSchedule[oldRecord.id]
                      }
                      break
                  }
                  
                  return {
                    courts: newCourts,
                    availableCourts: newAvailableCourts,
                    occupiedCourts: newOccupiedCourts,
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
        optimisticUpdate: (id: string, updates: Partial<Court>) => {
          set(state => {
            const updatedCourt = state.courts.find(c => c.id === id)
            if (!updatedCourt) return state
            
            const newCourt = { ...updatedCourt, ...updates }
            
            return {
              courts: state.courts.map(c => c.id === id ? newCourt : c),
              availableCourts: newCourt.status === 'available'
                ? state.availableCourts.some(c => c.id === id)
                  ? state.availableCourts.map(c => c.id === id ? newCourt : c)
                  : [newCourt, ...state.availableCourts.filter(c => c.id !== id)]
                : state.availableCourts.filter(c => c.id !== id),
              occupiedCourts: newCourt.status === 'occupied'
                ? state.occupiedCourts.some(c => c.id === id)
                  ? state.occupiedCourts.map(c => c.id === id ? newCourt : c)
                  : [newCourt, ...state.occupiedCourts.filter(c => c.id !== id)]
                : state.occupiedCourts.filter(c => c.id !== id),
              currentCourt: state.currentCourt?.id === id ? newCourt : state.currentCourt
            }
          })
        },

        rollbackOptimisticUpdate: (id: string, originalData: Court) => {
          set(state => ({
            courts: state.courts.map(c => c.id === id ? originalData : c),
            availableCourts: originalData.status === 'available'
              ? state.availableCourts.map(c => c.id === id ? originalData : c)
              : state.availableCourts.filter(c => c.id !== id),
            occupiedCourts: originalData.status === 'occupied'
              ? state.occupiedCourts.map(c => c.id === id ? originalData : c)
              : state.occupiedCourts.filter(c => c.id !== id),
            currentCourt: state.currentCourt?.id === id ? originalData : state.currentCourt
          }))
        }
      }),
      {
        name: 'court-store',
        partialize: (state) => ({
          // Only persist essential data, not loading states
          courts: state.courts.slice(0, 100), // Limit cached courts
          currentCourt: state.currentCourt,
          filters: state.filters,
          pagination: state.pagination,
          courtAssignments: state.courtAssignments,
          courtSchedule: state.courtSchedule
        })
      }
    )
  )
)

// Selector hooks for optimized re-renders
export const useCourts = () => useCourtStore(state => state.courts)
export const useAvailableCourts = () => useCourtStore(state => state.availableCourts)
export const useOccupiedCourts = () => useCourtStore(state => state.occupiedCourts)
export const useCurrentCourt = () => useCourtStore(state => state.currentCourt)
export const useCourtLoading = () => useCourtStore(state => state.loading)
export const useCourtError = () => useCourtStore(state => state.error)
export const useCourtConnection = () => useCourtStore(state => state.isConnected)
export const useCourtAssignments = () => useCourtStore(state => state.courtAssignments)