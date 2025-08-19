import { promises as fs } from 'fs'
import { join, dirname } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { Result, tryCatch } from '@/types'

/**
 * Base database error classes
 */
export class DatabaseError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message)
    this.name = 'DatabaseError'
  }
}

export class ValidationError extends DatabaseError {
  constructor(message: string, public readonly issues: z.ZodIssue[]) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class RecordNotFoundError extends DatabaseError {
  constructor(id: string, entityType: string) {
    super(`${entityType} with ID ${id} not found`)
    this.name = 'RecordNotFoundError'
  }
}

export class FileOperationError extends DatabaseError {
  public readonly originalCause: Error
  
  constructor(operation: string, filePath: string, cause: Error) {
    super(`Failed to ${operation} file at ${filePath}: ${cause.message}`)
    this.name = 'FileOperationError'
    this.originalCause = cause
  }
}


/**
 * Base interface for all database entities
 */
export interface BaseEntity {
  id: string
  createdAt: string
  updatedAt: string
}

/**
 * Database configuration options
 */
export interface DatabaseConfig {
  dataPath: string
  backupRetentionCount?: number
  enableAutoBackup?: boolean
}

/**
 * Abstract base class for all database operations
 */
export abstract class BaseDB<T extends BaseEntity> {
  protected readonly entityName: string
  protected readonly dataPath: string
  protected readonly backupRetentionCount: number
  protected readonly enableAutoBackup: boolean

  constructor(
    entityName: string,
    config: DatabaseConfig,
    protected readonly schema: z.ZodSchema<T>
  ) {
    this.entityName = entityName
    this.dataPath = config.dataPath
    this.backupRetentionCount = config.backupRetentionCount ?? 10
    this.enableAutoBackup = config.enableAutoBackup ?? true
  }

  /**
   * Create a new record
   */
  async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<Result<T, DatabaseError>> {
    return tryCatch(async () => {
      const record = this.addTimestamps(data) as T
      const validatedRecord = this.validateData(record)
      
      await this.ensureDirectoryExists()
      const filePath = this.getFilePath(validatedRecord.id)
      
      // Check if record already exists
      if (await this.fileExists(filePath)) {
        throw new DatabaseError(`${this.entityName} with ID ${validatedRecord.id} already exists`)
      }
      
      await this.writeFile(filePath, validatedRecord)
      return validatedRecord
    })
  }

  /**
   * Find a record by ID
   */
  async findById(id: string): Promise<Result<T | null, DatabaseError>> {
    return tryCatch(async () => {
      const filePath = this.getFilePath(id)
      
      if (!(await this.fileExists(filePath))) {
        return null
      }
      
      const data = await this.readFile(filePath)
      return this.validateData(data)
    })
  }

  /**
   * Find all records with optional filtering
   */
  async findAll(filters?: Partial<Record<keyof T, unknown>>): Promise<Result<T[], DatabaseError>> {
    return tryCatch(async () => {
      await this.ensureDirectoryExists()
      const files = await fs.readdir(this.dataPath)
      const jsonFiles = files.filter(file => file.endsWith('.json'))
      
      const records: T[] = []
      const errors: string[] = []
      
      for (const file of jsonFiles) {
        try {
          const filePath = join(this.dataPath, file)
          const data = await this.readFile(filePath)
          const record = this.validateData(data)
          
          if (this.matchesFilters(record, filters)) {
            records.push(record)
          }
        } catch (error) {
          const errorMsg = `Failed to process file ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`
          errors.push(errorMsg)
          console.warn(errorMsg, error)
        }
      }
      
      // If too many files failed to process, this might indicate a systemic issue
      if (errors.length > 0 && errors.length >= jsonFiles.length / 2) {
        throw new DatabaseError(`Too many file processing errors (${errors.length}/${jsonFiles.length}): ${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''}`)
      }
      
      return records.sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
    })
  }

  /**
   * Update an existing record
   */
  async update(id: string, updateData: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<Result<T, DatabaseError>> {
    return tryCatch(async () => {
      const existingResult = await this.findById(id)
      if (existingResult.error) {
        throw existingResult.error
      }
      
      if (!existingResult.data) {
        throw new RecordNotFoundError(id, this.entityName)
      }
      
      const existing = existingResult.data
      
      // Create backup before update if enabled
      if (this.enableAutoBackup) {
        const backupResult = await this.backup(id)
        if (backupResult.error) {
          console.warn(`Failed to create backup for ${id}: ${backupResult.error.message}`, backupResult.error)
          // Continue with update even if backup fails, but log the issue
        }
      }
      
      const updatedRecord = {
        ...existing,
        ...updateData,
        id, // Ensure ID cannot be changed
        updatedAt: new Date().toISOString()
      } as T
      
      const validatedRecord = this.validateData(updatedRecord)
      const filePath = this.getFilePath(id)
      
      await this.writeFile(filePath, validatedRecord)
      return validatedRecord
    })
  }

  /**
   * Delete a record (soft delete - move to archive)
   */
  async delete(id: string): Promise<Result<void, DatabaseError>> {
    return tryCatch(async () => {
      const existingResult = await this.findById(id)
      if (existingResult.error) {
        throw existingResult.error
      }
      
      if (!existingResult.data) {
        throw new RecordNotFoundError(id, this.entityName)
      }
      
      // Create backup before delete if enabled
      if (this.enableAutoBackup) {
        const backupResult = await this.backup(id)
        if (backupResult.error) {
          throw new DatabaseError(`Failed to create backup before deletion: ${backupResult.error.message}`, backupResult.error)
        }
      }
      
      const filePath = this.getFilePath(id)
      const archivePath = this.getArchivePath(id)
      
      // Ensure archive directory exists
      await this.ensureDirectoryExists(dirname(archivePath))
      
      // Move file to archive instead of deleting
      await fs.rename(filePath, archivePath)
    })
  }

  /**
   * Create backup of a record
   */
  async backup(id: string): Promise<Result<void, DatabaseError>> {
    return tryCatch(async () => {
      const existingResult = await this.findById(id)
      if (existingResult.error) {
        throw existingResult.error
      }
      
      if (!existingResult.data) {
        throw new RecordNotFoundError(id, this.entityName)
      }
      
      const existing = existingResult.data
      const backupPath = this.getBackupPath(id)
      await this.ensureDirectoryExists(dirname(backupPath))
      
      await this.writeFile(backupPath, existing)
      
      // Clean up old backups - don't fail the backup if cleanup fails
      try {
        await this.cleanupOldBackups(id)
      } catch (cleanupError) {
        console.warn(`Failed to cleanup old backups for ${id}:`, cleanupError)
        // Continue - backup was successful even if cleanup failed
      }
    })
  }

  /**
   * Restore a record from backup
   */
  async restore(id: string, timestamp?: string): Promise<Result<T, DatabaseError>> {
    return tryCatch(async () => {
      let backupPath: string
      
      if (timestamp) {
        backupPath = this.getBackupPath(id, timestamp)
      } else {
        // Find the most recent backup
        const backupDir = dirname(this.getBackupPath(id))
        const backupFiles = await fs.readdir(backupDir)
        const entityBackups = backupFiles
          .filter(file => file.startsWith(`${id}-`) && file.endsWith('.json'))
          .sort()
          .reverse()
        
        if (entityBackups.length === 0) {
          throw new DatabaseError(`No backups found for ${this.entityName} with ID ${id}`)
        }
        
        backupPath = join(backupDir, entityBackups[0])
      }
      
      if (!(await this.fileExists(backupPath))) {
        throw new DatabaseError(`Backup not found: ${backupPath}`)
      }
      
      const backupData = await this.readFile(backupPath)
      const validatedRecord = this.validateData(backupData)
      
      // Restore to main location
      const mainPath = this.getFilePath(id)
      await this.writeFile(mainPath, validatedRecord)
      
      return validatedRecord
    })
  }

  /**
   * Get the count of records matching filters
   */
  async count(filters?: Partial<Record<keyof T, unknown>>): Promise<Result<number, DatabaseError>> {
    return tryCatch(async () => {
      const recordsResult = await this.findAll(filters)
      if (recordsResult.error) {
        throw recordsResult.error
      }
      return recordsResult.data.length
    })
  }

  /**
   * Check if a record exists
   */
  async exists(id: string): Promise<Result<boolean, DatabaseError>> {
    return tryCatch(async () => {
      const recordResult = await this.findById(id)
      if (recordResult.error) {
        throw recordResult.error
      }
      return recordResult.data !== null
    })
  }

  // Protected utility methods

  /**
   * Generate a unique ID for new records
   */
  protected generateId(): string {
    return uuidv4()
  }

  /**
   * Get the file path for a record
   */
  protected getFilePath(id: string): string {
    // Sanitize ID to prevent path traversal attacks
    const sanitizedId = id.replace(/[^a-zA-Z0-9-_]/g, '')
    if (!sanitizedId || sanitizedId !== id) {
      throw new DatabaseError(`Invalid ID format: ID must contain only alphanumeric characters, hyphens, and underscores`)
    }
    if (sanitizedId.length > 255) {
      throw new DatabaseError('ID too long: maximum 255 characters allowed')
    }
    return join(this.dataPath, `${sanitizedId}.json`)
  }

  /**
   * Get the archive path for a deleted record
   */
  protected getArchivePath(id: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    return join(this.dataPath, '..', 'archived', `${id}-${timestamp}.json`)
  }

  /**
   * Get the backup path for a record
   */
  protected getBackupPath(id: string, timestamp?: string): string {
    const backupTimestamp = timestamp || new Date().toISOString().replace(/[:.]/g, '-')
    return join('data', 'system', 'backup', this.entityName, `${id}-${backupTimestamp}.json`)
  }

  /**
   * Ensure directory exists, create if not
   */
  protected async ensureDirectoryExists(path?: string): Promise<void> {
    const dirPath = path || this.dataPath
    try {
      await fs.access(dirPath)
    } catch {
      await fs.mkdir(dirPath, { recursive: true })
    }
  }

  /**
   * Check if file exists
   */
  protected async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Read and parse JSON file
   */
  protected async readFile(filePath: string): Promise<unknown> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      throw new FileOperationError('read', filePath, error as Error)
    }
  }

  /**
   * Write object to JSON file
   */
  protected async writeFile(filePath: string, data: T): Promise<void> {
    try {
      const content = JSON.stringify(data, null, 2)
      await fs.writeFile(filePath, content, 'utf-8')
    } catch (error) {
      throw new FileOperationError('write', filePath, error as Error)
    }
  }

  /**
   * Validate data against schema
   */
  protected validateData(data: unknown): T {
    const result = this.schema.safeParse(data)
    if (!result.success) {
      throw new ValidationError(
        `Validation failed for ${this.entityName}`,
        result.error.issues
      )
    }
    return result.data
  }

  /**
   * Add timestamps to new records
   */
  protected addTimestamps(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): T {
    const timestamp = new Date().toISOString()
    return {
      ...data,
      id: this.generateId(),
      createdAt: timestamp,
      updatedAt: timestamp
    } as T
  }

  /**
   * Check if record matches filters
   */
  protected matchesFilters(record: T, filters?: Partial<Record<keyof T, unknown>>): boolean {
    if (!filters || Object.keys(filters).length === 0) {
      return true
    }

    return Object.entries(filters).every(([key, value]) => {
      const recordValue = record[key as keyof T]
      
      // Handle array filters (e.g., status: ['active', 'completed'])
      if (Array.isArray(value)) {
        return value.includes(recordValue)
      }
      
      // Handle string filters with partial matching
      if (typeof value === 'string' && typeof recordValue === 'string') {
        return recordValue.toLowerCase().includes(value.toLowerCase())
      }
      
      // Handle number range filters {min: number, max: number}
      if (typeof value === 'object' && value !== null && 'min' in value && 'max' in value) {
        const numValue = recordValue as number
        const range = value as { min: number; max: number }
        return numValue >= range.min && numValue <= range.max
      }
      
      // Exact match for other types
      return recordValue === value
    })
  }

  /**
   * Clean up old backup files
   */
  protected async cleanupOldBackups(id: string): Promise<void> {
    try {
      const backupDir = dirname(this.getBackupPath(id))
      const backupFiles = await fs.readdir(backupDir)
      const entityBackups = backupFiles
        .filter(file => file.startsWith(`${id}-`) && file.endsWith('.json'))
        .sort()
      
      // Keep only the most recent N backups
      const filesToDelete = entityBackups.slice(0, -this.backupRetentionCount)
      
      for (const file of filesToDelete) {
        const filePath = join(backupDir, file)
        await fs.unlink(filePath)
      }
    } catch (error) {
      // Log warning but don't throw - backup cleanup is not critical
      console.warn(`Failed to clean up backups for ${id}:`, error)
    }
  }

  /**
   * Handle and transform errors
   */
  protected handleError(operation: string, error: unknown): DatabaseError {
    if (error instanceof DatabaseError) {
      return error
    }
    
    if (error instanceof Error) {
      return new DatabaseError(
        `Failed to ${operation} ${this.entityName}: ${error.message}`,
        error
      )
    }
    
    return new DatabaseError(
      `Failed to ${operation} ${this.entityName}: Unknown error`
    )
  }
}