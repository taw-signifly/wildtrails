import Link from 'next/link'
import { Trophy, Github, ExternalLink } from 'lucide-react'

export function Footer() {
  const currentYear = new Date().getFullYear()
  
  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-4 py-8 md:h-16 md:flex-row md:py-0">
          {/* Brand and Copyright */}
          <div className="flex flex-col items-center gap-4 px-8 md:flex-row md:gap-2 md:px-0">
            <div className="flex items-center space-x-2">
              <Trophy className="h-5 w-5 text-primary" />
              <span className="font-semibold">WildTrails</span>
            </div>
            <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
              © {currentYear} WildTrails. Professional Petanque tournament management.
            </p>
          </div>

          {/* Links */}
          <div className="flex items-center space-x-4">
            <Link
              href="/about"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              About
            </Link>
            <Link
              href="/docs"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
            >
              Documentation
              <ExternalLink className="h-3 w-3" />
            </Link>
            <Link
              href="/support"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Support
            </Link>
            
            {/* Future: Social links */}
            <div className="flex items-center space-x-2">
              {/* Placeholder for future social media links */}
              <Link
                href="https://github.com/taw-signifly/wildtrails"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="GitHub repository"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}