'use client'

import React, { Component, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: string | null
  retryCount: number
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: string) => void
  maxRetries?: number
  showDetails?: boolean
}

/**
 * Comprehensive Error Boundary for Dashboard Components
 * Handles both JavaScript errors and provides fallback UI
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: NodeJS.Timeout | null = null
  
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Update state with error details
    this.setState({
      errorInfo: errorInfo.componentStack || null
    })

    // Log the error
    console.error('Dashboard Error Boundary caught an error:', error, errorInfo)
    
    // Call optional error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo.componentStack || '')
    }

    // Log structured error for monitoring
    if (typeof window !== 'undefined') {
      window.console.error('Error Boundary:', {
        error: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href
      })
    }
  }

  handleRetry = () => {
    const { maxRetries = 3 } = this.props
    const { retryCount } = this.state
    
    if (retryCount < maxRetries) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: retryCount + 1
      })
      
      // Add a small delay to prevent immediate re-error
      this.retryTimeoutId = setTimeout(() => {
        // Force a re-render of the component tree
        this.forceUpdate()
      }, 100)
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId)
    }
  }

  render() {
    const { hasError, error, errorInfo, retryCount } = this.state
    const { children, fallback, maxRetries = 3, showDetails = false } = this.props

    if (hasError && error) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback
      }

      // Default error UI
      return (
        <Card className="border-destructive bg-destructive/5">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Something went wrong
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              We encountered an error while loading this section. Please try refreshing or go back to the home page.
            </div>
            
            {showDetails && process.env.NODE_ENV === 'development' && (
              <div className="space-y-2">
                <details className="text-xs">
                  <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
                    Error Details (Development Only)
                  </summary>
                  <div className="mt-2 space-y-2 rounded bg-muted p-3">
                    <div>
                      <span className="font-semibold">Error:</span> {error.message}
                    </div>
                    {error.stack && (
                      <div>
                        <span className="font-semibold">Stack:</span>
                        <pre className="mt-1 whitespace-pre-wrap text-xs">{error.stack}</pre>
                      </div>
                    )}
                    {errorInfo && (
                      <div>
                        <span className="font-semibold">Component Stack:</span>
                        <pre className="mt-1 whitespace-pre-wrap text-xs">{errorInfo}</pre>
                      </div>
                    )}
                  </div>
                </details>
              </div>
            )}
            
            <div className="flex gap-2">
              {retryCount < maxRetries && (
                <Button 
                  onClick={this.handleRetry} 
                  size="sm" 
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try Again ({maxRetries - retryCount} attempts left)
                </Button>
              )}
              
              <Link href="/">
                <Button size="sm" variant="default" className="flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  Go Home
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )
    }

    return children
  }
}

/**
 * Specialized Dashboard Error Boundary
 * Pre-configured for dashboard component needs
 */
interface DashboardErrorBoundaryProps {
  children: ReactNode
  section?: string
}

export function DashboardErrorBoundary({ children, section }: DashboardErrorBoundaryProps) {
  return (
    <ErrorBoundary
      maxRetries={2}
      showDetails={process.env.NODE_ENV === 'development'}
      onError={(error, errorInfo) => {
        // Log dashboard-specific errors
        console.error(`Dashboard ${section || 'component'} error:`, {
          error: error.message,
          section,
          timestamp: new Date().toISOString(),
          errorInfo
        })
      }}
      fallback={
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center space-y-3">
              <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
              <div className="space-y-1">
                <h3 className="font-semibold text-destructive">
                  Failed to load {section || 'dashboard component'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Please refresh the page or try again later
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      }
    >
      {children}
    </ErrorBoundary>
  )
}

/**
 * HOC for wrapping components with error boundaries
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`
  return WrappedComponent
}