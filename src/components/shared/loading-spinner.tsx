import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  label?: string
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8'
}

export function LoadingSpinner({ 
  size = 'md', 
  className, 
  label = 'Loading...' 
}: LoadingSpinnerProps) {
  return (
    <div 
      className={cn("flex items-center justify-center", className)}
      role="status"
      aria-label={label}
    >
      <Loader2 className={cn("animate-spin", sizeClasses[size])} />
      <span className="sr-only">{label}</span>
    </div>
  )
}

interface FullPageLoadingProps {
  label?: string
  description?: string
}

export function FullPageLoading({ 
  label = "Loading...", 
  description 
}: FullPageLoadingProps) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <LoadingSpinner size="lg" label={label} />
        {description && (
          <p className="text-sm text-muted-foreground text-center max-w-md">
            {description}
          </p>
        )}
      </div>
    </div>
  )
}

interface InlineLoadingProps {
  label?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function InlineLoading({ 
  label = "Loading...", 
  size = 'sm',
  className 
}: InlineLoadingProps) {
  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <LoadingSpinner size={size} label={label} />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  )
}