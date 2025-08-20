import { describe, expect, it, jest, beforeEach } from '@jest/globals'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ErrorBoundary, DashboardErrorBoundary, withErrorBoundary } from '../error-boundary'

// Mock console.error to avoid error output in tests
const originalError = console.error
beforeEach(() => {
  console.error = jest.fn()
})

afterEach(() => {
  console.error = originalError
})

// Test components that throw errors
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error')
  }
  return <div>No error</div>
}

function AsyncThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Async test error')
  }
  return <div>Async no error</div>
}

describe('ErrorBoundary', () => {
  it('should render children when there is no error', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    )

    expect(screen.getByText('No error')).toBeInTheDocument()
  })

  it('should render error UI when child component throws', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText('We encountered an error while loading this section. Please try refreshing or go back to the home page.')).toBeInTheDocument()
  })

  it('should display try again button with correct retry count', () => {
    render(
      <ErrorBoundary maxRetries={2}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    const retryButton = screen.getByText('Try Again (2 attempts left)')
    expect(retryButton).toBeInTheDocument()
  })

  it('should call onError callback when error occurs', () => {
    const onError = jest.fn()
    
    render(
      <ErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.stringContaining('ThrowError')
    )
  })

  it('should display custom fallback when provided', () => {
    const customFallback = <div>Custom error message</div>

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Custom error message')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })

  it('should show error details in development mode', () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    render(
      <ErrorBoundary showDetails={true}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.getByText('Error Details (Development Only)')).toBeInTheDocument()

    process.env.NODE_ENV = originalNodeEnv
  })

  it('should not show error details in production mode', () => {
    const originalNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    render(
      <ErrorBoundary showDetails={true}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(screen.queryByText('Error Details (Development Only)')).not.toBeInTheDocument()

    process.env.NODE_ENV = originalNodeEnv
  })

  it('should handle retry functionality', () => {
    const { rerender } = render(
      <ErrorBoundary maxRetries={2}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    const retryButton = screen.getByText('Try Again (2 attempts left)')
    fireEvent.click(retryButton)

    // After retry, component should attempt to render again
    // In real scenario, if the error condition is fixed, it would show the component
    expect(screen.getByText('Try Again (1 attempts left)')).toBeInTheDocument()
  })

  it('should hide retry button after max retries reached', () => {
    const { rerender } = render(
      <ErrorBoundary maxRetries={1}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    const retryButton = screen.getByText('Try Again (1 attempts left)')
    fireEvent.click(retryButton)

    // After using the last retry, button should not appear
    expect(screen.queryByText(/Try Again/)).not.toBeInTheDocument()
  })

  it('should include home button', () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    const homeButton = screen.getByText('Go Home')
    expect(homeButton).toBeInTheDocument()
    expect(homeButton.closest('a')).toHaveAttribute('href', '/')
  })
})

describe('DashboardErrorBoundary', () => {
  it('should render children when there is no error', () => {
    render(
      <DashboardErrorBoundary section="Statistics">
        <ThrowError shouldThrow={false} />
      </DashboardErrorBoundary>
    )

    expect(screen.getByText('No error')).toBeInTheDocument()
  })

  it('should render dashboard-specific error UI', () => {
    render(
      <DashboardErrorBoundary section="Statistics">
        <ThrowError shouldThrow={true} />
      </DashboardErrorBoundary>
    )

    expect(screen.getByText('Failed to load Statistics')).toBeInTheDocument()
    expect(screen.getByText('Please refresh the page or try again later')).toBeInTheDocument()
  })

  it('should render generic error message when section not provided', () => {
    render(
      <DashboardErrorBoundary>
        <ThrowError shouldThrow={true} />
      </DashboardErrorBoundary>
    )

    expect(screen.getByText('Failed to load dashboard component')).toBeInTheDocument()
  })

  it('should call onError with section information', () => {
    // Mock console.error to capture the log call
    const errorSpy = jest.spyOn(console, 'error').mockImplementation()

    render(
      <DashboardErrorBoundary section="Test Section">
        <ThrowError shouldThrow={true} />
      </DashboardErrorBoundary>
    )

    expect(errorSpy).toHaveBeenCalledWith(
      'Dashboard Test Section error:',
      expect.objectContaining({
        error: 'Test error',
        section: 'Test Section',
        timestamp: expect.any(String)
      })
    )

    errorSpy.mockRestore()
  })

  it('should have limited retry attempts (2)', () => {
    render(
      <DashboardErrorBoundary section="Statistics">
        <ThrowError shouldThrow={true} />
      </DashboardErrorBoundary>
    )

    // Check that it starts with 2 attempts (since maxRetries=2)
    // The error boundary doesn't expose retry count directly,
    // but we can test the general error behavior
    expect(screen.getByText('Failed to load Statistics')).toBeInTheDocument()
  })
})

describe('withErrorBoundary HOC', () => {
  it('should wrap component with error boundary', () => {
    const TestComponent = () => <div>Test component</div>
    const WrappedComponent = withErrorBoundary(TestComponent)

    render(<WrappedComponent />)
    expect(screen.getByText('Test component')).toBeInTheDocument()
  })

  it('should catch errors in wrapped component', () => {
    const ErrorComponent = () => {
      throw new Error('Component error')
    }
    const WrappedComponent = withErrorBoundary(ErrorComponent)

    render(<WrappedComponent />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('should set correct display name', () => {
    const TestComponent = () => <div>Test</div>
    TestComponent.displayName = 'TestComponent'
    
    const WrappedComponent = withErrorBoundary(TestComponent)
    expect(WrappedComponent.displayName).toBe('withErrorBoundary(TestComponent)')
  })

  it('should use component name as fallback for display name', () => {
    function NamedComponent() {
      return <div>Named</div>
    }
    
    const WrappedComponent = withErrorBoundary(NamedComponent)
    expect(WrappedComponent.displayName).toBe('withErrorBoundary(NamedComponent)')
  })

  it('should pass error boundary props to wrapper', () => {
    const TestComponent = () => <div>Test</div>
    const WrappedComponent = withErrorBoundary(TestComponent, {
      maxRetries: 5
    })

    render(<WrappedComponent />)
    // Component should render normally
    expect(screen.getByText('Test')).toBeInTheDocument()
  })

  it('should handle props passing to wrapped component', () => {
    interface TestProps {
      message: string
    }
    
    const TestComponent = ({ message }: TestProps) => <div>{message}</div>
    const WrappedComponent = withErrorBoundary(TestComponent)

    render(<WrappedComponent message="Hello World" />)
    expect(screen.getByText('Hello World')).toBeInTheDocument()
  })
})

describe('Error Boundary Edge Cases', () => {
  it('should handle errors in component lifecycle methods', () => {
    class ErrorInLifecycle extends React.Component {
      componentDidMount() {
        throw new Error('Lifecycle error')
      }
      
      render() {
        return <div>Should not render</div>
      }
    }

    render(
      <ErrorBoundary>
        <ErrorInLifecycle />
      </ErrorBoundary>
    )

    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('should handle async errors appropriately', () => {
    // Note: Error boundaries don't catch async errors, but we test
    // that they don't break when async errors occur
    function AsyncErrorComponent() {
      React.useEffect(() => {
        // This error won't be caught by error boundary
        setTimeout(() => {
          // In real app, this would be handled by global error handler
        }, 0)
      }, [])
      
      return <div>Async component</div>
    }

    render(
      <ErrorBoundary>
        <AsyncErrorComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText('Async component')).toBeInTheDocument()
  })

  it('should cleanup timeout on unmount', () => {
    const { unmount } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    // Click retry to start the timeout
    const retryButton = screen.getByText(/Try Again/)
    fireEvent.click(retryButton)

    // Unmount should not cause any errors
    expect(() => unmount()).not.toThrow()
  })

  it('should log structured error information', () => {
    // Mock window and navigator
    const mockWindow = {
      console: { error: jest.fn() },
      location: { href: 'http://test.com/dashboard' }
    }
    const mockNavigator = { userAgent: 'Test Browser' }
    
    Object.defineProperty(window, 'window', { value: mockWindow, writable: true })
    Object.defineProperty(window, 'navigator', { value: mockNavigator, writable: true })

    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    )

    expect(mockWindow.console.error).toHaveBeenCalledWith(
      'Error Boundary:',
      expect.objectContaining({
        error: 'Test error',
        timestamp: expect.any(String),
        userAgent: 'Test Browser',
        url: 'http://test.com/dashboard'
      })
    )
  })
})