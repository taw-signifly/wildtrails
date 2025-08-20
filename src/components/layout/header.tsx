import Link from 'next/link'
import { Trophy } from 'lucide-react'

import { Navigation, MobileNavigation } from './navigation'

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 max-w-screen-2xl items-center px-4 sm:px-6 lg:px-8">
        {/* Logo and Brand */}
        <div className="mr-4 flex">
          <Link href="/" className="mr-6 flex items-center space-x-2" aria-label="WildTrails home">
            <Trophy className="h-6 w-6 text-primary" />
            <span className="hidden font-bold sm:inline-block">WildTrails</span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <Navigation className="mx-6 hidden lg:flex" />

        {/* Spacer */}
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          {/* Future: Search component could go here */}
          <div className="w-full flex-1 md:w-auto md:flex-none">
            {/* Placeholder for future search */}
          </div>

          {/* User Profile Section - Future Implementation */}
          <nav className="flex items-center space-x-2">
            {/* Future: User profile dropdown */}
            <div className="hidden md:flex md:items-center md:space-x-4">
              {/* Placeholder for user profile */}
            </div>
          </nav>
        </div>

        {/* Mobile Navigation */}
        <MobileNavigation />
      </div>
      
      {/* Mobile Navigation Bar - Show navigation items on mobile below header */}
      <div className="border-t lg:hidden">
        <div className="container mx-auto px-4 py-2">
          <Navigation className="flex justify-between overflow-x-auto" />
        </div>
      </div>
    </header>
  )
}