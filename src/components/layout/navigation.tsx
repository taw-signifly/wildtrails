'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  Trophy, 
  Users, 
  Activity, 
  BarChart3, 
  Settings,
  Menu,
  X 
} from 'lucide-react'
import { useState, useCallback, memo } from 'react'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { NavigationItem } from '@/types/navigation'
import { cn } from '@/lib/utils'

const navigationItems: NavigationItem[] = [
  {
    name: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    description: 'Main overview and tournament dashboard'
  },
  {
    name: 'Tournaments',
    href: '/tournaments',
    icon: Trophy,
    description: 'Tournament management and listing'
  },
  {
    name: 'Players',
    href: '/players',
    icon: Users,
    description: 'Player profiles and team management'
  },
  {
    name: 'Live',
    href: '/live',
    icon: Activity,
    description: 'Active tournament monitoring'
  },
  {
    name: 'Statistics',
    href: '/statistics',
    icon: BarChart3,
    description: 'Tournament analytics and reports'
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    description: 'Application configuration'
  }
]

interface NavigationProps {
  className?: string
}

// Memoized navigation item component for performance
const NavigationItemComponent = memo(function NavigationItemComponent({ 
  item, 
  isActive, 
  className 
}: { 
  item: NavigationItem
  isActive: boolean
  className?: string 
}) {
  const Icon = item.icon
  
  return (
    <Link
      href={item.href}
      className={className}
      aria-current={isActive ? 'page' : undefined}
      title={item.description}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline-block">{item.name}</span>
    </Link>
  )
})

// Memoized mobile navigation item component
const MobileNavigationItemComponent = memo(function MobileNavigationItemComponent({
  item,
  isActive,
  onClick,
  className
}: {
  item: NavigationItem
  isActive: boolean
  onClick: () => void
  className?: string
}) {
  const Icon = item.icon
  
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={className}
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon className="h-5 w-5" />
      <div className="flex flex-col">
        <span>{item.name}</span>
        {item.description && (
          <span className="text-xs text-muted-foreground">
            {item.description}
          </span>
        )}
      </div>
    </Link>
  )
})

export const Navigation = memo(function Navigation({ className }: NavigationProps) {
  const pathname = usePathname()
  
  return (
    <nav className={cn("flex items-center space-x-4 lg:space-x-6", className)} role="navigation">
      {navigationItems.map((item) => {
        const isActive = pathname === item.href
        
        return (
          <NavigationItemComponent
            key={item.href}
            item={item}
            isActive={isActive}
            className={cn(
              "flex items-center space-x-2 text-sm font-medium transition-colors hover:text-primary",
              isActive
                ? "text-foreground"
                : "text-muted-foreground"
            )}
          />
        )
      })}
    </nav>
  )
})

export const MobileNavigation = memo(function MobileNavigation() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  const handleItemClick = useCallback(() => {
    setIsOpen(false)
  }, [])

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation menu">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[300px] sm:w-[400px]">
        <nav className="flex flex-col space-y-4" role="navigation">
          <div className="flex items-center justify-between pb-4">
            <h2 className="text-lg font-semibold">Navigation</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              aria-label="Close navigation menu"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {navigationItems.map((item) => {
            const isActive = pathname === item.href
            
            return (
              <MobileNavigationItemComponent
                key={item.href}
                item={item}
                isActive={isActive}
                onClick={handleItemClick}
                className={cn(
                  "flex items-center space-x-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              />
            )
          })}
        </nav>
      </SheetContent>
    </Sheet>
  )
})