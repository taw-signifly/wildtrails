import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageContainerProps {
  children: ReactNode
  className?: string
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

export function PageContainer({
  children,
  className,
  maxWidth = '2xl',
  padding = 'lg'
}: PageContainerProps) {
  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-screen-2xl',
    full: 'max-w-none'
  }

  const paddingClasses = {
    none: '',
    sm: 'px-4 py-4 sm:px-6',
    md: 'px-4 py-6 sm:px-6 lg:px-8',
    lg: 'px-4 py-8 sm:px-6 lg:px-8'
  }

  return (
    <div className={cn(
      "container mx-auto",
      maxWidthClasses[maxWidth],
      paddingClasses[padding],
      className
    )}>
      {children}
    </div>
  )
}