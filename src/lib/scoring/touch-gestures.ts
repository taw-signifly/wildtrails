/**
 * Touch Gesture Handling for Live Scoring Interface
 * Provides optimized touch interactions for mobile and tablet scoring
 */

// Touch event types
export type TouchGestureType = 
  | 'tap' 
  | 'long_press' 
  | 'swipe_left' 
  | 'swipe_right' 
  | 'swipe_up' 
  | 'swipe_down'
  | 'pinch'
  | 'spread'

export interface TouchPoint {
  x: number
  y: number
  timestamp: number
}

export interface TouchGestureEvent {
  type: TouchGestureType
  startPoint: TouchPoint
  endPoint: TouchPoint
  duration: number
  distance: number
  velocity: number
  direction?: 'up' | 'down' | 'left' | 'right'
  scale?: number // For pinch/spread gestures
}

export interface TouchGestureOptions {
  // Tap configuration
  tapTimeThreshold: number // Maximum time for tap (ms)
  tapDistanceThreshold: number // Maximum movement for tap (px)
  
  // Long press configuration
  longPressTimeThreshold: number // Minimum time for long press (ms)
  longPressDistanceThreshold: number // Maximum movement for long press (px)
  
  // Swipe configuration
  swipeMinDistance: number // Minimum distance for swipe (px)
  swipeMaxTime: number // Maximum time for swipe (ms)
  swipeMinVelocity: number // Minimum velocity for swipe (px/ms)
  
  // Pinch/spread configuration
  pinchMinScale: number // Minimum scale change for pinch
  pinchMaxScale: number // Maximum scale change for spread
  
  // Haptic feedback
  enableHapticFeedback: boolean
  
  // Visual feedback
  enableVisualFeedback: boolean
}

export const defaultTouchOptions: TouchGestureOptions = {
  tapTimeThreshold: 200,
  tapDistanceThreshold: 10,
  longPressTimeThreshold: 500,
  longPressDistanceThreshold: 10,
  swipeMinDistance: 50,
  swipeMaxTime: 300,
  swipeMinVelocity: 0.3,
  pinchMinScale: 0.8,
  pinchMaxScale: 1.2,
  enableHapticFeedback: true,
  enableVisualFeedback: true
}

/**
 * Touch Gesture Handler Class
 */
export class TouchGestureHandler {
  private element: HTMLElement
  private options: TouchGestureOptions
  private startTouch: TouchPoint | null = null
  private currentTouch: TouchPoint | null = null
  private longPressTimer: NodeJS.Timeout | null = null
  private isLongPress = false
  private gestureCallbacks: Map<TouchGestureType, (event: TouchGestureEvent) => void> = new Map()

  constructor(element: HTMLElement, options: Partial<TouchGestureOptions> = {}) {
    this.element = element
    this.options = { ...defaultTouchOptions, ...options }
    this.attachEventListeners()
  }

  /**
   * Register callback for specific gesture type
   */
  on(gestureType: TouchGestureType, callback: (event: TouchGestureEvent) => void): void {
    this.gestureCallbacks.set(gestureType, callback)
  }

  /**
   * Remove callback for specific gesture type
   */
  off(gestureType: TouchGestureType): void {
    this.gestureCallbacks.delete(gestureType)
  }

  /**
   * Trigger haptic feedback if supported and enabled
   */
  private triggerHapticFeedback(intensity: 'light' | 'medium' | 'heavy' = 'light'): void {
    if (!this.options.enableHapticFeedback) return

    // Check if haptic feedback is supported
    if ('vibrate' in navigator) {
      const duration = intensity === 'light' ? 10 : intensity === 'medium' ? 20 : 50
      navigator.vibrate(duration)
    }

    // Use Haptic API if available (iOS Safari)
    if ('ontouchstart' in window && 'webkitTapHighlightColor' in document.documentElement.style) {
      try {
        // @ts-ignore - WebKit specific API
        if (window.navigator.vibrate) {
          const duration = intensity === 'light' ? 10 : intensity === 'medium' ? 20 : 50
          window.navigator.vibrate(duration)
        }
      } catch (error) {
        // Silently fail if haptic feedback is not supported
      }
    }
  }

  /**
   * Add visual feedback to element
   */
  private addVisualFeedback(): void {
    if (!this.options.enableVisualFeedback) return

    this.element.style.transform = 'scale(0.98)'
    this.element.style.opacity = '0.8'
    this.element.style.transition = 'transform 0.1s ease, opacity 0.1s ease'
  }

  /**
   * Remove visual feedback from element
   */
  private removeVisualFeedback(): void {
    if (!this.options.enableVisualFeedback) return

    this.element.style.transform = 'scale(1)'
    this.element.style.opacity = '1'
    
    // Clear transition after animation
    setTimeout(() => {
      this.element.style.transition = ''
    }, 100)
  }

  /**
   * Calculate distance between two points
   */
  private calculateDistance(point1: TouchPoint, point2: TouchPoint): number {
    const dx = point2.x - point1.x
    const dy = point2.y - point1.y
    return Math.sqrt(dx * dx + dy * dy)
  }

  /**
   * Calculate velocity between two points
   */
  private calculateVelocity(point1: TouchPoint, point2: TouchPoint): number {
    const distance = this.calculateDistance(point1, point2)
    const time = point2.timestamp - point1.timestamp
    return time > 0 ? distance / time : 0
  }

  /**
   * Determine swipe direction
   */
  private getSwipeDirection(point1: TouchPoint, point2: TouchPoint): 'up' | 'down' | 'left' | 'right' {
    const dx = point2.x - point1.x
    const dy = point2.y - point1.y
    
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left'
    } else {
      return dy > 0 ? 'down' : 'up'
    }
  }

  /**
   * Create touch point from touch event
   */
  private createTouchPoint(touch: Touch): TouchPoint {
    return {
      x: touch.clientX,
      y: touch.clientY,
      timestamp: Date.now()
    }
  }

  /**
   * Handle touch start event
   */
  private handleTouchStart = (event: TouchEvent): void => {
    if (event.touches.length !== 1) return

    const touch = event.touches[0]
    this.startTouch = this.createTouchPoint(touch)
    this.currentTouch = this.startTouch
    this.isLongPress = false

    // Add visual feedback
    this.addVisualFeedback()

    // Start long press timer
    this.longPressTimer = setTimeout(() => {
      if (this.startTouch && this.currentTouch) {
        const distance = this.calculateDistance(this.startTouch, this.currentTouch)
        
        if (distance <= this.options.longPressDistanceThreshold) {
          this.isLongPress = true
          this.triggerHapticFeedback('medium')
          
          const gestureEvent: TouchGestureEvent = {
            type: 'long_press',
            startPoint: this.startTouch,
            endPoint: this.currentTouch,
            duration: this.currentTouch.timestamp - this.startTouch.timestamp,
            distance,
            velocity: 0
          }
          
          this.gestureCallbacks.get('long_press')?.(gestureEvent)
        }
      }
    }, this.options.longPressTimeThreshold)
  }

  /**
   * Handle touch move event
   */
  private handleTouchMove = (event: TouchEvent): void => {
    if (event.touches.length !== 1 || !this.startTouch) return

    const touch = event.touches[0]
    this.currentTouch = this.createTouchPoint(touch)

    // Check if movement exceeds long press threshold
    const distance = this.calculateDistance(this.startTouch, this.currentTouch)
    if (distance > this.options.longPressDistanceThreshold && this.longPressTimer) {
      clearTimeout(this.longPressTimer)
      this.longPressTimer = null
    }
  }

  /**
   * Handle touch end event
   */
  private handleTouchEnd = (event: TouchEvent): void => {
    // Remove visual feedback
    this.removeVisualFeedback()

    // Clear long press timer
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer)
      this.longPressTimer = null
    }

    if (!this.startTouch || !this.currentTouch || this.isLongPress) {
      this.cleanup()
      return
    }

    const duration = this.currentTouch.timestamp - this.startTouch.timestamp
    const distance = this.calculateDistance(this.startTouch, this.currentTouch)
    const velocity = this.calculateVelocity(this.startTouch, this.currentTouch)

    // Determine gesture type
    let gestureType: TouchGestureType | null = null
    let gestureEvent: TouchGestureEvent | null = null

    // Check for tap
    if (duration <= this.options.tapTimeThreshold && 
        distance <= this.options.tapDistanceThreshold) {
      gestureType = 'tap'
      this.triggerHapticFeedback('light')
    }
    // Check for swipe
    else if (distance >= this.options.swipeMinDistance &&
             duration <= this.options.swipeMaxTime &&
             velocity >= this.options.swipeMinVelocity) {
      
      const direction = this.getSwipeDirection(this.startTouch, this.currentTouch)
      gestureType = `swipe_${direction}` as TouchGestureType
      this.triggerHapticFeedback('medium')
    }

    // Create gesture event if we have a valid gesture
    if (gestureType) {
      gestureEvent = {
        type: gestureType,
        startPoint: this.startTouch,
        endPoint: this.currentTouch,
        duration,
        distance,
        velocity,
        direction: gestureType.startsWith('swipe_') ? 
          gestureType.split('_')[1] as 'up' | 'down' | 'left' | 'right' : undefined
      }

      // Call registered callback
      this.gestureCallbacks.get(gestureType)?.(gestureEvent)
    }

    this.cleanup()
  }

  /**
   * Handle touch cancel event
   */
  private handleTouchCancel = (): void => {
    this.removeVisualFeedback()
    this.cleanup()
  }

  /**
   * Clean up gesture state
   */
  private cleanup(): void {
    this.startTouch = null
    this.currentTouch = null
    this.isLongPress = false
    
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer)
      this.longPressTimer = null
    }
  }

  /**
   * Attach event listeners to element
   */
  private attachEventListeners(): void {
    this.element.addEventListener('touchstart', this.handleTouchStart, { passive: false })
    this.element.addEventListener('touchmove', this.handleTouchMove, { passive: false })
    this.element.addEventListener('touchend', this.handleTouchEnd, { passive: false })
    this.element.addEventListener('touchcancel', this.handleTouchCancel, { passive: false })
  }

  /**
   * Remove event listeners from element
   */
  private detachEventListeners(): void {
    this.element.removeEventListener('touchstart', this.handleTouchStart)
    this.element.removeEventListener('touchmove', this.handleTouchMove)
    this.element.removeEventListener('touchend', this.handleTouchEnd)
    this.element.removeEventListener('touchcancel', this.handleTouchCancel)
  }

  /**
   * Destroy gesture handler and clean up
   */
  destroy(): void {
    this.detachEventListeners()
    this.cleanup()
    this.gestureCallbacks.clear()
  }
}

/**
 * React hook for touch gestures
 */
export function useTouchGestures(
  ref: React.RefObject<HTMLElement>,
  options: Partial<TouchGestureOptions> = {}
) {
  const gestureHandler = React.useRef<TouchGestureHandler | null>(null)

  React.useEffect(() => {
    if (ref.current) {
      gestureHandler.current = new TouchGestureHandler(ref.current, options)
      
      return () => {
        gestureHandler.current?.destroy()
        gestureHandler.current = null
      }
    }
  }, [ref, options])

  const addGestureListener = React.useCallback(
    (gestureType: TouchGestureType, callback: (event: TouchGestureEvent) => void) => {
      gestureHandler.current?.on(gestureType, callback)
    },
    []
  )

  const removeGestureListener = React.useCallback(
    (gestureType: TouchGestureType) => {
      gestureHandler.current?.off(gestureType)
    },
    []
  )

  return {
    addGestureListener,
    removeGestureListener
  }
}

// Add React import for the hook
import * as React from 'react'

/**
 * Utility functions for touch optimization
 */
export const TouchUtils = {
  /**
   * Check if device supports touch
   */
  isTouchDevice(): boolean {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0
  },

  /**
   * Check if device is likely a tablet
   */
  isTabletDevice(): boolean {
    const userAgent = navigator.userAgent.toLowerCase()
    const isTablet = /ipad|android|windows/.test(userAgent) && 
                    window.innerWidth >= 768 && 
                    window.innerWidth <= 1024
    return isTablet || (this.isTouchDevice() && window.innerWidth >= 768)
  },

  /**
   * Get recommended touch target size for current device
   */
  getRecommendedTouchSize(): number {
    if (this.isTabletDevice()) {
      return 48 // 48px for tablets
    } else if (this.isTouchDevice()) {
      return 44 // 44px for phones
    } else {
      return 32 // 32px for desktop
    }
  },

  /**
   * Disable text selection for better touch experience
   */
  disableTextSelection(element: HTMLElement): void {
    element.style.webkitUserSelect = 'none'
    element.style.userSelect = 'none'
    element.style.webkitTouchCallout = 'none'
    element.style.webkitTapHighlightColor = 'transparent'
  },

  /**
   * Enable text selection
   */
  enableTextSelection(element: HTMLElement): void {
    element.style.webkitUserSelect = 'text'
    element.style.userSelect = 'text'
    element.style.webkitTouchCallout = 'default'
    element.style.webkitTapHighlightColor = ''
  }
}