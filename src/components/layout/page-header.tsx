import { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface PageHeaderProps {
  title: string
  description?: string
  children?: ReactNode
  breadcrumbs?: BreadcrumbItem[]
  className?: string
}

export function PageHeader({
  title,
  description,
  children,
  breadcrumbs,
  className
}: PageHeaderProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex" role="navigation">
          <ol className="flex items-center space-x-2 text-sm text-muted-foreground">
            {breadcrumbs.map((item, index) => (
              <li key={index} className="flex items-center">
                {index > 0 && <ChevronRight className="mx-2 h-4 w-4" />}
                {item.href ? (
                  <Link 
                    href={item.href}
                    className="hover:text-foreground transition-colors"
                    aria-current={index === breadcrumbs.length - 1 ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span 
                    className={cn(
                      index === breadcrumbs.length - 1 && "text-foreground font-medium"
                    )}
                    aria-current={index === breadcrumbs.length - 1 ? 'page' : undefined}
                  >
                    {item.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      
      {/* Header Content */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}
        </div>
        
        {/* Action buttons area */}
        {children && (
          <div className="flex items-center space-x-2">
            {children}
          </div>
        )}
      </div>
      
      <Separator />
    </div>
  )
}