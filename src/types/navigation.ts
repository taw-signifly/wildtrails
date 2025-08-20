import { LucideIcon } from 'lucide-react'

export interface NavigationItem {
  name: string
  href: string
  icon: LucideIcon
  description?: string
}

export interface NavigationGroup {
  name: string
  items: NavigationItem[]
}

export interface NavigationProps {
  currentPath?: string
  onItemClick?: (item: NavigationItem) => void
}