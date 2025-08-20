'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.props.onError?.(error, errorInfo)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <Card className="p-8 text-center">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-destructive">Something went wrong</h2>
            <p className="text-muted-foreground">
              An error occurred while loading this component. Please try again.
            </p>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="text-left text-sm bg-muted p-4 rounded">
                <summary className="cursor-pointer font-medium">Error Details</summary>
                <pre className="mt-2 text-xs overflow-x-auto">
                  {this.state.error.message}
                  {'\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            <div className="flex justify-center space-x-2">
              <Button onClick={this.handleReset} variant="outline">
                Try Again
              </Button>
              <Button onClick={() => window.location.reload()} variant="default">
                Reload Page
              </Button>
            </div>
          </div>
        </Card>
      )
    }

    return this.props.children
  }
}

// Convenience wrapper for tournament-specific errors
interface TournamentErrorBoundaryProps {
  children: ReactNode
}

export function TournamentErrorBoundary({ children }: TournamentErrorBoundaryProps) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // Log tournament-specific errors
        console.error('Tournament wizard error:', {
          error: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString()
        })
      }}
      fallback={
        <Card className="p-8 text-center">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-destructive">Tournament Setup Error</h2>
            <p className="text-muted-foreground">
              There was a problem with the tournament setup wizard. Your progress has been saved.
            </p>
            <div className="flex justify-center space-x-2">
              <Button 
                onClick={() => window.location.reload()} 
                variant="default"
              >
                Restart Setup
              </Button>
              <Button 
                onClick={() => window.history.back()} 
                variant="outline"
              >
                Go Back
              </Button>
            </div>
          </div>
        </Card>
      }
    >
      {children}
    </ErrorBoundary>
  )
}

// Specialized error boundary for live scoring
interface LiveScoringErrorBoundaryProps {
  children: ReactNode
}

export function LiveScoringErrorBoundary({ children }: LiveScoringErrorBoundaryProps) {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // Log live scoring specific errors
        console.error('Live Scoring Error:', {
          error: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
          url: typeof window !== 'undefined' ? window.location.href : 'unknown'
        })
      }}
      fallback={
        <Card className="p-8 text-center border-red-300 bg-red-50">
          <div className="space-y-4">
            <div className="text-red-500 text-4xl">🎯</div>
            <h2 className="text-lg font-semibold text-red-800">Live Scoring Error</h2>
            <p className="text-red-700">
              There was a problem with the live scoring interface. This could be due to:
            </p>
            <ul className="text-sm text-red-700 text-left max-w-md mx-auto space-y-1">
              <li>• Network connectivity issues</li>
              <li>• Real-time connection problems</li>
              <li>• Match data synchronization errors</li>
            </ul>
            <div className="flex justify-center space-x-2">
              <Button 
                onClick={() => window.location.reload()} 
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-100"
              >
                Reload Interface
              </Button>
              <Button 
                onClick={() => window.history.back()} 
                variant="outline"
                className="border-red-300 text-red-700 hover:bg-red-100"
              >
                Return to Tournament
              </Button>
            </div>
          </div>
        </Card>
      }
    >
      {children}
    </ErrorBoundary>
  )
}