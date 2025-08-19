import { promises as fs } from 'fs'
import { join, basename, dirname } from 'path'
import { DatabaseError, FileOperationError } from './base'

/**
 * Backup metadata interface
 */
export interface BackupMetadata {
  id: string
  entityType: string
  entityId: string
  timestamp: string
  filePath: string
  fileSize: number
  checksum?: string
}

/**
 * Backup operation result
 */
export interface BackupResult {
  success: boolean
  backupsCreated: number
  backupsDeleted: number
  totalSize: number
  errors: string[]
}

/**
 * Backup configuration
 */
export interface BackupConfig {
  retentionDays?: number
  retentionCount?: number
  enableCompression?: boolean
  generateChecksums?: boolean
}

/**
 * Backup utility class for managing system-wide backups
 */
export class BackupManager {
  private readonly backupPath: string
  private readonly config: Required<BackupConfig>

  constructor(backupPath = 'data/system/backup', config: BackupConfig = {}) {
    this.backupPath = backupPath
    this.config = {
      retentionDays: config.retentionDays ?? 30,
      retentionCount: config.retentionCount ?? 10,
      enableCompression: config.enableCompression ?? false,
      generateChecksums: config.generateChecksums ?? true
    }
  }

  /**
   * Create a full system backup
   */
  async createSystemBackup(): Promise<BackupResult> {
    const result: BackupResult = {
      success: true,
      backupsCreated: 0,
      backupsDeleted: 0,
      totalSize: 0,
      errors: []
    }

    try {
      const dataPath = 'data'
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const systemBackupPath = join(this.backupPath, 'system', timestamp)
      
      await this.ensureDirectoryExists(systemBackupPath)

      // Backup all entity directories
      const entityDirs = ['tournaments', 'players', 'matches', 'courts']
      
      for (const entityDir of entityDirs) {
        const sourcePath = join(dataPath, entityDir)
        const targetPath = join(systemBackupPath, entityDir)
        
        try {
          if (await this.directoryExists(sourcePath)) {
            await this.copyDirectory(sourcePath, targetPath)
            const dirSize = await this.getDirectorySize(targetPath)
            result.totalSize += dirSize
            result.backupsCreated++
          }
        } catch (error) {
          result.errors.push(`Failed to backup ${entityDir}: ${error}`)
        }
      }

      // Create backup metadata
      const metadata = {
        timestamp,
        version: '1.0.0',
        entities: entityDirs,
        totalSize: result.totalSize,
        backupsCreated: result.backupsCreated
      }

      await this.writeFile(
        join(systemBackupPath, 'metadata.json'),
        JSON.stringify(metadata, null, 2)
      )

      // Clean up old system backups
      await this.cleanupOldSystemBackups()
      
      result.success = result.errors.length === 0
      return result
    } catch (error) {
      result.success = false
      result.errors.push(`System backup failed: ${error}`)
      return result
    }
  }

  /**
   * Restore from system backup
   */
  async restoreSystemBackup(timestamp: string): Promise<BackupResult> {
    const result: BackupResult = {
      success: true,
      backupsCreated: 0,
      backupsDeleted: 0,
      totalSize: 0,
      errors: []
    }

    try {
      const systemBackupPath = join(this.backupPath, 'system', timestamp)
      
      if (!(await this.directoryExists(systemBackupPath))) {
        throw new DatabaseError(`System backup not found: ${timestamp}`)
      }

      // Read backup metadata
      const metadataPath = join(systemBackupPath, 'metadata.json')
      const metadata = JSON.parse(await this.readFile(metadataPath))

      // Create backup of current state before restore
      await this.createSystemBackup()

      const dataPath = 'data'
      
      for (const entityDir of metadata.entities || []) {
        const sourcePath = join(systemBackupPath, entityDir)
        const targetPath = join(dataPath, entityDir)
        
        try {
          // Remove existing data
          if (await this.directoryExists(targetPath)) {
            await this.removeDirectory(targetPath)
          }
          
          // Restore from backup
          if (await this.directoryExists(sourcePath)) {
            await this.copyDirectory(sourcePath, targetPath)
            result.backupsCreated++
          }
        } catch (error) {
          result.errors.push(`Failed to restore ${entityDir}: ${error}`)
        }
      }

      result.success = result.errors.length === 0
      return result
    } catch (error) {
      result.success = false
      result.errors.push(`System restore failed: ${error}`)
      return result
    }
  }

  /**
   * List available system backups
   */
  async listSystemBackups(): Promise<BackupMetadata[]> {
    try {
      const systemBackupPath = join(this.backupPath, 'system')
      
      if (!(await this.directoryExists(systemBackupPath))) {
        return []
      }

      const backupDirs = await fs.readdir(systemBackupPath)
      const backups: BackupMetadata[] = []

      for (const dir of backupDirs) {
        const backupPath = join(systemBackupPath, dir)
        const metadataPath = join(backupPath, 'metadata.json')
        
        try {
          if (await this.fileExists(metadataPath)) {
            const metadata = JSON.parse(await this.readFile(metadataPath))
            const dirSize = await this.getDirectorySize(backupPath)
            
            backups.push({
              id: dir,
              entityType: 'system',
              entityId: 'system',
              timestamp: metadata.timestamp || dir,
              filePath: backupPath,
              fileSize: dirSize
            })
          }
        } catch (error) {
          console.warn(`Failed to read backup metadata for ${dir}:`, error)
        }
      }

      return backups.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
    } catch (error) {
      throw new DatabaseError(`Failed to list system backups: ${error}`)
    }
  }

  /**
   * List backups for a specific entity
   */
  async listEntityBackups(entityType: string, entityId?: string): Promise<BackupMetadata[]> {
    try {
      const entityBackupPath = join(this.backupPath, entityType)
      
      if (!(await this.directoryExists(entityBackupPath))) {
        return []
      }

      const backupFiles = await fs.readdir(entityBackupPath)
      const backups: BackupMetadata[] = []

      for (const file of backupFiles) {
        if (!file.endsWith('.json')) continue
        
        const filePath = join(entityBackupPath, file)
        const fileName = basename(file, '.json')
        const [fileEntityId, timestamp] = fileName.split('-', 2)
        
        // Filter by entity ID if specified
        if (entityId && fileEntityId !== entityId) continue
        
        try {
          const stats = await fs.stat(filePath)
          
          backups.push({
            id: fileName,
            entityType,
            entityId: fileEntityId,
            timestamp: timestamp || stats.mtime.toISOString(),
            filePath,
            fileSize: stats.size
          })
        } catch (error) {
          console.warn(`Failed to read backup file stats for ${file}:`, error)
        }
      }

      return backups.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
    } catch (error) {
      throw new DatabaseError(`Failed to list entity backups: ${error}`)
    }
  }

  /**
   * Delete old backups based on retention policies
   */
  async cleanupOldBackups(entityType?: string): Promise<BackupResult> {
    const result: BackupResult = {
      success: true,
      backupsCreated: 0,
      backupsDeleted: 0,
      totalSize: 0,
      errors: []
    }

    try {
      if (entityType) {
        // Clean up specific entity backups
        await this.cleanupEntityBackups(entityType, result)
      } else {
        // Clean up all entity backups
        const entityTypes = ['tournaments', 'players', 'matches', 'courts']
        for (const type of entityTypes) {
          await this.cleanupEntityBackups(type, result)
        }
        
        // Clean up system backups
        await this.cleanupOldSystemBackups()
      }

      result.success = result.errors.length === 0
      return result
    } catch (error) {
      result.success = false
      result.errors.push(`Backup cleanup failed: ${error}`)
      return result
    }
  }

  /**
   * Get backup statistics
   */
  async getBackupStats(): Promise<{
    totalBackups: number
    totalSize: number
    entityCounts: Record<string, number>
    oldestBackup?: string
    newestBackup?: string
  }> {
    try {
      const stats = {
        totalBackups: 0,
        totalSize: 0,
        entityCounts: {} as Record<string, number>,
        oldestBackup: undefined as string | undefined,
        newestBackup: undefined as string | undefined
      }

      const entityTypes = ['tournaments', 'players', 'matches', 'courts']
      const allTimestamps: string[] = []

      for (const entityType of entityTypes) {
        const backups = await this.listEntityBackups(entityType)
        stats.entityCounts[entityType] = backups.length
        stats.totalBackups += backups.length
        
        for (const backup of backups) {
          stats.totalSize += backup.fileSize
          allTimestamps.push(backup.timestamp)
        }
      }

      // System backups
      const systemBackups = await this.listSystemBackups()
      stats.entityCounts.system = systemBackups.length
      stats.totalBackups += systemBackups.length
      
      for (const backup of systemBackups) {
        stats.totalSize += backup.fileSize
        allTimestamps.push(backup.timestamp)
      }

      if (allTimestamps.length > 0) {
        allTimestamps.sort()
        stats.oldestBackup = allTimestamps[0]
        stats.newestBackup = allTimestamps[allTimestamps.length - 1]
      }

      return stats
    } catch (error) {
      throw new DatabaseError(`Failed to get backup stats: ${error}`)
    }
  }

  // Private utility methods

  private async cleanupEntityBackups(entityType: string, result: BackupResult): Promise<void> {
    try {
      const backups = await this.listEntityBackups(entityType)
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays)

      // Group backups by entity ID
      const backupsByEntity = backups.reduce((acc, backup) => {
        if (!acc[backup.entityId]) {
          acc[backup.entityId] = []
        }
        acc[backup.entityId].push(backup)
        return acc
      }, {} as Record<string, BackupMetadata[]>)

      // Clean up each entity's backups
      for (const [entityId, entityBackups] of Object.entries(backupsByEntity)) {
        // Sort by timestamp (newest first)
        entityBackups.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )

        // Keep the most recent N backups
        const backupsToKeep = entityBackups.slice(0, this.config.retentionCount)
        const backupsToDelete = entityBackups.slice(this.config.retentionCount)

        // Also delete backups older than retention days
        for (const backup of backupsToKeep) {
          if (new Date(backup.timestamp) < cutoffDate) {
            backupsToDelete.push(backup)
          }
        }

        // Delete old backups
        for (const backup of backupsToDelete) {
          try {
            await fs.unlink(backup.filePath)
            result.backupsDeleted++
          } catch (error) {
            result.errors.push(`Failed to delete backup ${backup.id}: ${error}`)
          }
        }
      }
    } catch (error) {
      result.errors.push(`Failed to cleanup ${entityType} backups: ${error}`)
    }
  }

  private async cleanupOldSystemBackups(): Promise<void> {
    try {
      const systemBackups = await this.listSystemBackups()
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays)

      // Keep the most recent N system backups
      const backupsToKeep = systemBackups.slice(0, this.config.retentionCount)
      const backupsToDelete = systemBackups.slice(this.config.retentionCount)

      // Also delete backups older than retention days
      for (const backup of backupsToKeep) {
        if (new Date(backup.timestamp) < cutoffDate) {
          backupsToDelete.push(backup)
        }
      }

      // Delete old system backups
      for (const backup of backupsToDelete) {
        try {
          await this.removeDirectory(backup.filePath)
        } catch (error) {
          console.warn(`Failed to delete system backup ${backup.id}:`, error)
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup old system backups:', error)
    }
  }

  // File system utilities

  private async ensureDirectoryExists(path: string): Promise<void> {
    try {
      await fs.access(path)
    } catch {
      await fs.mkdir(path, { recursive: true })
    }
  }

  private async directoryExists(path: string): Promise<boolean> {
    try {
      const stats = await fs.stat(path)
      return stats.isDirectory()
    } catch {
      return false
    }
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await fs.access(path)
      return true
    } catch {
      return false
    }
  }

  private async readFile(path: string): Promise<string> {
    try {
      return await fs.readFile(path, 'utf-8')
    } catch (error) {
      throw new FileOperationError('read', path, error as Error)
    }
  }

  private async writeFile(path: string, content: string): Promise<void> {
    try {
      await fs.writeFile(path, content, 'utf-8')
    } catch (error) {
      throw new FileOperationError('write', path, error as Error)
    }
  }

  private async copyDirectory(source: string, target: string): Promise<void> {
    await this.ensureDirectoryExists(target)
    
    const entries = await fs.readdir(source, { withFileTypes: true })
    
    for (const entry of entries) {
      const sourcePath = join(source, entry.name)
      const targetPath = join(target, entry.name)
      
      if (entry.isDirectory()) {
        await this.copyDirectory(sourcePath, targetPath)
      } else {
        await fs.copyFile(sourcePath, targetPath)
      }
    }
  }

  private async removeDirectory(path: string): Promise<void> {
    try {
      await fs.rm(path, { recursive: true, force: true })
    } catch (error) {
      throw new FileOperationError('remove', path, error as Error)
    }
  }

  private async getDirectorySize(path: string): Promise<number> {
    let totalSize = 0
    
    try {
      const entries = await fs.readdir(path, { withFileTypes: true })
      
      for (const entry of entries) {
        const fullPath = join(path, entry.name)
        
        if (entry.isDirectory()) {
          totalSize += await this.getDirectorySize(fullPath)
        } else {
          const stats = await fs.stat(fullPath)
          totalSize += stats.size
        }
      }
    } catch (error) {
      console.warn(`Failed to calculate directory size for ${path}:`, error)
    }
    
    return totalSize
  }
}

/**
 * Default backup manager instance
 */
export const backupManager = new BackupManager()

/**
 * Utility functions for backup operations
 */
export const BackupUtils = {
  /**
   * Create a system-wide backup
   */
  createSystemBackup: () => backupManager.createSystemBackup(),

  /**
   * List all available backups
   */
  listAllBackups: async () => {
    const entityTypes = ['tournaments', 'players', 'matches', 'courts']
    const allBackups: BackupMetadata[] = []
    
    for (const entityType of entityTypes) {
      const backups = await backupManager.listEntityBackups(entityType)
      allBackups.push(...backups)
    }
    
    const systemBackups = await backupManager.listSystemBackups()
    allBackups.push(...systemBackups)
    
    return allBackups.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
  },

  /**
   * Get backup statistics
   */
  getBackupStats: () => backupManager.getBackupStats(),

  /**
   * Clean up old backups
   */
  cleanupOldBackups: () => backupManager.cleanupOldBackups(),

  /**
   * Restore from the most recent system backup
   */
  restoreLatestBackup: async () => {
    const systemBackups = await backupManager.listSystemBackups()
    if (systemBackups.length === 0) {
      throw new DatabaseError('No system backups available')
    }
    
    return backupManager.restoreSystemBackup(systemBackups[0].timestamp)
  }
}