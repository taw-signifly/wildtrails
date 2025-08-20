'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Match } from '@/types'
import { BracketUpdateEvent, LiveBracketData } from '@/types/bracket'

interface UseBracketUpdatesProps {
  tournamentId: string
  initialData?: LiveBracketData
  onUpdate?: (data: LiveBracketData) => void
  onError?: (error: string) => void
}

interface UseBracketUpdatesReturn {
  data: LiveBracketData | null
  isConnected: boolean
  isLoading: boolean
  error: string | null
  reconnect: () => void
  disconnect: () => void
}

/**
 * Custom hook for real-time bracket updates via Server-Sent Events
 */
export function useBracketUpdates({
  tournamentId,
  initialData,
  onUpdate,
  onError
}: UseBracketUpdatesProps): UseBracketUpdatesReturn {
  const [data, setData] = useState<LiveBracketData | null>(initialData || null)
  const [isConnected, setIsConnected] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttempts = useRef(0)
  const maxReconnectAttempts = 5

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    
    setIsConnected(false)
    reconnectAttempts.current = 0
  }, [])

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      disconnect()
    }

    try {
      setIsLoading(true)
      setError(null)
      
      const eventSource = new EventSource(`/api/live/bracket/${tournamentId}`)
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        setIsConnected(true)
        setIsLoading(false)
        setError(null)
        reconnectAttempts.current = 0
      }

      eventSource.onerror = () => {
        setIsConnected(false)
        setIsLoading(false)
        
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.pow(2, reconnectAttempts.current) * 1000 // Exponential backoff
          reconnectAttempts.current++
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, delay)
        } else {
          const errorMsg = 'Failed to connect to live updates after multiple attempts'
          setError(errorMsg)
          onError?.(errorMsg)
        }
      }

      // Handle bracket update events
      eventSource.addEventListener('bracket_update', (event) => {
        try {
          const updateEvent: BracketUpdateEvent = JSON.parse(event.data)
          
          setData(prevData => {
            const updatedData: LiveBracketData = {
              matches: updateEvent.data.matches || prevData?.matches || [],
              bracketStructure: updateEvent.data.bracketStructure || prevData?.bracketStructure || [],
              lastUpdated: updateEvent.timestamp,
              isComplete: updateEvent.data.isComplete || false
            }
            
            onUpdate?.(updatedData)
            return updatedData
          })
        } catch (err) {
          console.error('Error parsing bracket update:', err)
        }
      })

      // Handle match completion events
      eventSource.addEventListener('match_completed', (event) => {
        try {
          const updateEvent: BracketUpdateEvent = JSON.parse(event.data)
          const completedMatch: Match = updateEvent.data.match
          
          setData(prevData => {
            if (!prevData) return prevData
            
            const updatedMatches = prevData.matches.map(match => 
              match.id === completedMatch.id ? completedMatch : match
            )
            
            const updatedData: LiveBracketData = {
              ...prevData,
              matches: updatedMatches,
              lastUpdated: updateEvent.timestamp
            }
            
            onUpdate?.(updatedData)
            return updatedData
          })
        } catch (err) {
          console.error('Error parsing match completion:', err)
        }
      })

      // Handle bracket advancement events
      eventSource.addEventListener('bracket_advanced', (event) => {
        try {
          const updateEvent: BracketUpdateEvent = JSON.parse(event.data)
          
          setData(prevData => {
            if (!prevData) return prevData
            
            const updatedData: LiveBracketData = {
              matches: updateEvent.data.matches || prevData.matches,
              bracketStructure: updateEvent.data.bracketStructure || prevData.bracketStructure,
              lastUpdated: updateEvent.timestamp,
              isComplete: updateEvent.data.isComplete || prevData.isComplete
            }
            
            onUpdate?.(updatedData)
            return updatedData
          })
        } catch (err) {
          console.error('Error parsing bracket advancement:', err)
        }
      })

      // Handle tournament completion events
      eventSource.addEventListener('tournament_completed', (event) => {
        try {
          const updateEvent: BracketUpdateEvent = JSON.parse(event.data)
          
          setData(prevData => {
            if (!prevData) return prevData
            
            const updatedData: LiveBracketData = {
              ...prevData,
              isComplete: true,
              lastUpdated: updateEvent.timestamp
            }
            
            onUpdate?.(updatedData)
            return updatedData
          })
        } catch (err) {
          console.error('Error parsing tournament completion:', err)
        }
      })

      // Handle general message events
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          // Handle initial data load
          if (data.type === 'initial_data') {
            const initialBracketData: LiveBracketData = {
              matches: data.matches || [],
              bracketStructure: data.bracketStructure || [],
              lastUpdated: data.timestamp,
              isComplete: data.isComplete || false
            }
            
            setData(initialBracketData)
            onUpdate?.(initialBracketData)
          }
        } catch (err) {
          console.error('Error parsing SSE message:', err)
        }
      }

    } catch (err) {
      const errorMsg = 'Failed to establish SSE connection'
      setError(errorMsg)
      setIsLoading(false)
      onError?.(errorMsg)
    }
  }, [tournamentId, onUpdate, onError, disconnect])

  const reconnect = useCallback(() => {
    reconnectAttempts.current = 0
    connect()
  }, [connect])

  // Initialize connection and handle cleanup
  useEffect(() => {
    if (tournamentId) {
      connect()
    }

    // Single cleanup function to prevent memory leaks
    return () => {
      disconnect()
    }
  }, [tournamentId]) // Remove connect/disconnect from deps to avoid stale closures

  return {
    data,
    isConnected,
    isLoading,
    error,
    reconnect,
    disconnect
  }
}

/**
 * Simplified hook for bracket updates without real-time features
 */
export function useStaticBracketData(
  matches: Match[],
  bracketStructure: any[]
): LiveBracketData {
  return {
    matches,
    bracketStructure,
    lastUpdated: new Date().toISOString(),
    isComplete: matches.every(match => match.status === 'completed')
  }
}