/**
 * Database Layer Index
 * 
 * Central export point for all database operations and utilities for the
 * WildTrails Petanque Tournament Management System.
 */

// Export base database classes and types
export {
  BaseDB,
  DatabaseError,
  ValidationError,
  RecordNotFoundError,
  FileOperationError,
  type DatabaseResult,
  type BaseEntity,
  type DatabaseConfig
} from './base'

// Export backup utilities
export {
  BackupManager,
  backupManager,
  BackupUtils,
  type BackupMetadata,
  type BackupResult,
  type BackupConfig
} from './backup'

// Export entity database classes
export {
  TournamentDB,
  tournamentDB,
  TournamentUtils
} from './tournaments'

export {
  PlayerDB,
  playerDB,
  PlayerUtils
} from './players'

export {
  MatchDB,
  matchDB,
  MatchUtils
} from './matches'

export {
  CourtDB,
  courtDB,
  CourtUtils,
  type CourtStatus,
  type CourtSurface,
  type CourtCreateData
} from './courts'

// Re-export types from validation schemas
export type {
  Tournament,
  TournamentFormData,
  TournamentStatus,
  TournamentType,
  GameFormat,
  TournamentSettings,
  TournamentStats,
  Player,
  PlayerFormData,
  PlayerStats,
  PlayerPreferences,
  Team,
  Match,
  MatchFormData,
  MatchStatus,
  Score,
  End,
  Boule,
  Position,
  Court,
  BracketType
} from '@/types'

// Import required classes for DatabaseManager
import { TournamentDB, tournamentDB } from './tournaments'
import { PlayerDB, playerDB } from './players'
import { MatchDB, matchDB } from './matches'
import { CourtDB, courtDB } from './courts'
import { BackupManager, backupManager } from './backup'

/**
 * Database Manager - Central coordinator for all database operations
 */
export class DatabaseManager {
  public readonly tournaments: TournamentDB
  public readonly players: PlayerDB
  public readonly matches: MatchDB
  public readonly courts: CourtDB
  public readonly backup: BackupManager

  constructor() {
    this.tournaments = tournamentDB
    this.players = playerDB
    this.matches = matchDB
    this.courts = courtDB
    this.backup = backupManager
  }

  /**
   * Initialize all database directories
   */
  async initialize(): Promise<void> {
    const databases = [this.tournaments, this.players, this.matches, this.courts]
    
    await Promise.all(
      databases.map(db => (db as BaseDB<any>).ensureDirectoryExists())
    )
  }

  /**
   * Perform health check on all databases
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy'
    databases: {
      tournaments: { status: string; count: number }
      players: { status: string; count: number }
      matches: { status: string; count: number }
      courts: { status: string; count: number }
    }
    backup: {
      status: string
      lastBackup?: string
      totalSize: number
    }
  }> {
    const result = {
      status: 'healthy' as const,
      databases: {
        tournaments: { status: 'unknown', count: 0 },
        players: { status: 'unknown', count: 0 },
        matches: { status: 'unknown', count: 0 },
        courts: { status: 'unknown', count: 0 }
      },
      backup: {
        status: 'unknown',
        totalSize: 0
      }
    }

    const databases = [
      { name: 'tournaments', db: this.tournaments },
      { name: 'players', db: this.players },
      { name: 'matches', db: this.matches },
      { name: 'courts', db: this.courts }
    ]

    let healthyCount = 0

    // Check each database
    for (const { name, db } of databases) {
      try {
        const count = await db.count()
        result.databases[name as keyof typeof result.databases] = {
          status: 'healthy',
          count
        }
        healthyCount++
      } catch (error) {
        result.databases[name as keyof typeof result.databases] = {
          status: 'error',
          count: 0
        }
        console.error(`Database ${name} health check failed:`, error)
      }
    }

    // Check backup system
    try {
      const backupStats = await this.backup.getBackupStats()
      result.backup = {
        status: 'healthy',
        lastBackup: backupStats.newestBackup,
        totalSize: backupStats.totalSize
      }
    } catch (error) {
      result.backup = {
        status: 'error',
        totalSize: 0
      }
      console.error('Backup system health check failed:', error)
    }

    // Determine overall status
    if (healthyCount === databases.length && result.backup.status === 'healthy') {
      result.status = 'healthy'
    } else if (healthyCount >= databases.length / 2) {
      result.status = 'degraded'
    } else {
      result.status = 'unhealthy'
    }

    return result
  }

  /**
   * Get system statistics
   */
  async getSystemStats(): Promise<{
    tournaments: {
      total: number
      active: number
      completed: number
      totalPlayers: number
    }
    players: {
      total: number
      active: number
      totalMatches: number
    }
    matches: {
      total: number
      completed: number
      active: number
    }
    courts: {
      total: number
      available: number
      inUse: number
    }
    storage: {
      backupCount: number
      backupSize: number
    }
  }> {
    const [
      tournamentStats,
      playerStats,
      courtStats,
      backupStats
    ] = await Promise.all([
      this.tournaments.getStatsSummary(),
      this.players.getStatsSummary(),
      this.courts.getUtilizationStats(),
      this.backup.getBackupStats()
    ])

    // Get actual match stats
    const totalMatches = await this.matches.count()
    const activeMatches = await this.matches.count({ status: 'active' })
    const completedMatches = await this.matches.count({ status: 'completed' })

    return {
      tournaments: {
        total: tournamentStats.total,
        active: tournamentStats.byStatus.active || 0,
        completed: tournamentStats.byStatus.completed || 0,
        totalPlayers: tournamentStats.totalPlayers
      },
      players: {
        total: playerStats.totalPlayers,
        active: playerStats.totalPlayers, // All players considered active
        totalMatches: playerStats.totalMatches
      },
      matches: {
        total: totalMatches,
        completed: completedMatches,
        active: activeMatches
      },
      courts: {
        total: courtStats.total,
        available: courtStats.available,
        inUse: courtStats.inUse
      },
      storage: {
        backupCount: backupStats.totalBackups,
        backupSize: backupStats.totalSize
      }
    }
  }

  /**
   * Perform full system backup
   */
  async createSystemBackup(): Promise<{
    success: boolean
    backupId?: string
    error?: string
  }> {
    try {
      const result = await this.backup.createSystemBackup()
      
      if (result.success) {
        return {
          success: true,
          backupId: new Date().toISOString()
        }
      } else {
        return {
          success: false,
          error: result.errors.join(', ')
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Clean up old data and backups
   */
  async performMaintenance(): Promise<{
    backupsDeleted: number
    errors: string[]
  }> {
    try {
      const result = await this.backup.cleanupOldBackups()
      return {
        backupsDeleted: result.backupsDeleted,
        errors: result.errors
      }
    } catch (error) {
      return {
        backupsDeleted: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }
    }
  }

  /**
   * Reset all data (for testing purposes)
   */
  async resetAllData(): Promise<void> {
    const databases = [this.tournaments, this.players, this.matches, this.courts]
    
    for (const db of databases) {
      const records = await db.findAll()
      for (const record of records) {
        await db.delete(record.id)
      }
    }
  }

  /**
   * Seed database with sample data (for development/testing)
   */
  async seedSampleData(): Promise<void> {
    // Create sample courts
    const court1 = await this.courts.create({
      name: 'Court A',
      location: 'Main Field',
      dimensions: {
        length: 14,
        width: 4,
        throwingDistance: 8
      },
      surface: 'gravel',
      lighting: true,
      covered: false,
      amenities: ['Seating', 'Scoreboard']
    })

    const court2 = await this.courts.create({
      name: 'Court B',
      location: 'Main Field',
      dimensions: {
        length: 13,
        width: 4,
        throwingDistance: 7
      },
      surface: 'sand',
      lighting: true,
      covered: true,
      amenities: ['Seating', 'Water Station']
    })

    // Create sample players
    const players = await Promise.all([
      this.players.create({
        firstName: 'Alice',
        lastName: 'Johnson',
        email: 'alice.johnson@example.com',
        phone: '+1234567890',
        club: 'Downtown Petanque Club'
      }),
      this.players.create({
        firstName: 'Bob',
        lastName: 'Smith',
        email: 'bob.smith@example.com',
        phone: '+1234567891',
        club: 'Downtown Petanque Club'
      }),
      this.players.create({
        firstName: 'Carol',
        lastName: 'Williams',
        email: 'carol.williams@example.com',
        phone: '+1234567892',
        club: 'Riverside Petanque'
      }),
      this.players.create({
        firstName: 'David',
        lastName: 'Brown',
        email: 'david.brown@example.com',
        phone: '+1234567893',
        club: 'Riverside Petanque'
      })
    ])

    // Create sample tournament
    const tournament = await this.tournaments.create({
      name: 'Spring Championship 2025',
      type: 'single-elimination',
      format: 'doubles',
      maxPoints: 13,
      shortForm: false,
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      description: 'Annual spring tournament for all skill levels',
      location: 'Main Field',
      organizer: 'Tournament Committee',
      maxPlayers: 16
    })

    console.log('Sample data seeded successfully:', {
      courts: [court1.id, court2.id],
      players: players.map(p => p.id),
      tournament: tournament.id
    })
  }
}

// Export default instance
export const db = new DatabaseManager()

// Export convenience functions
export const DatabaseUtils = {
  /**
   * Initialize all databases
   */
  initialize: () => db.initialize(),

  /**
   * Get system health status
   */
  healthCheck: () => db.healthCheck(),

  /**
   * Get system statistics
   */
  getStats: () => db.getSystemStats(),

  /**
   * Create full system backup
   */
  backup: () => db.createSystemBackup(),

  /**
   * Perform system maintenance
   */
  maintenance: () => db.performMaintenance(),

  /**
   * Seed sample data for development
   */
  seed: () => db.seedSampleData(),

  /**
   * Reset all data (use with caution)
   */
  reset: () => db.resetAllData()
}

// Type exports for external usage
export type DatabaseManagerType = DatabaseManager

// Default export for convenience
export default db