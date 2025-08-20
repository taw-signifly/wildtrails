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