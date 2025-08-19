import { promises as fs } from 'fs'
import { join, dirname } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'

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
 * Database operation result types
 */
export interface DatabaseResult<T> {
  success: boolean
  data?: T
  error?: {
    type: string
    message: string
    details?: unknown
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
  async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    try {
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
    } catch (error) {
      throw this.handleError('create', error)
    }
  }

  /**
   * Find a record by ID
   */
  async findById(id: string): Promise<T | null> {
    try {
      const filePath = this.getFilePath(id)
      
      if (!(await this.fileExists(filePath))) {
        return null
      }
      
      const data = await this.readFile(filePath)
      return this.validateData(data)
    } catch (error) {
      throw this.handleError('findById', error)
    }
  }

  /**
   * Find all records with optional filtering
   */
  async findAll(filters?: Record<string, unknown>): Promise<T[]> {
    try {
      await this.ensureDirectoryExists()
      const files = await fs.readdir(this.dataPath)
      const jsonFiles = files.filter(file => file.endsWith('.json'))
      
      const records: T[] = []
      
      for (const file of jsonFiles) {
        try {
          const filePath = join(this.dataPath, file)
          const data = await this.readFile(filePath)
          const record = this.validateData(data)
          
          if (this.matchesFilters(record, filters)) {
            records.push(record)
          }
        } catch (error) {
          // Log warning but continue processing other files
          console.warn(`Failed to process file ${file}:`, error)
        }
      }
      
      return records.sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
    } catch (error) {
      throw this.handleError('findAll', error)
    }
  }

  /**
   * Update an existing record
   */
  async update(id: string, updateData: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<T> {
    try {
      const existing = await this.findById(id)
      if (!existing) {
        throw new RecordNotFoundError(id, this.entityName)
      }
      
      // Create backup before update if enabled
      if (this.enableAutoBackup) {
        await this.backup(id)
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
    } catch (error) {
      throw this.handleError('update', error)
    }
  }

  /**
   * Delete a record (soft delete - move to archive)
   */
  async delete(id: string): Promise<void> {
    try {
      const existing = await this.findById(id)
      if (!existing) {
        throw new RecordNotFoundError(id, this.entityName)
      }
      
      // Create backup before delete if enabled
      if (this.enableAutoBackup) {
        await this.backup(id)
      }
      
      const filePath = this.getFilePath(id)
      const archivePath = this.getArchivePath(id)
      
      // Ensure archive directory exists
      await this.ensureDirectoryExists(dirname(archivePath))
      
      // Move file to archive instead of deleting
      await fs.rename(filePath, archivePath)
    } catch (error) {
      throw this.handleError('delete', error)
    }
  }

  /**
   * Create backup of a record
   */
  async backup(id: string): Promise<void> {
    try {
      const existing = await this.findById(id)
      if (!existing) {
        throw new RecordNotFoundError(id, this.entityName)
      }
      
      const backupPath = this.getBackupPath(id)
      await this.ensureDirectoryExists(dirname(backupPath))
      
      await this.writeFile(backupPath, existing)
      
      // Clean up old backups
      await this.cleanupOldBackups(id)
    } catch (error) {
      throw this.handleError('backup', error)
    }
  }

  /**
   * Restore a record from backup
   */
  async restore(id: string, timestamp?: string): Promise<T> {
    try {
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
    } catch (error) {
      throw this.handleError('restore', error)
    }
  }

  /**
   * Get the count of records matching filters
   */
  async count(filters?: Record<string, unknown>): Promise<number> {
    const records = await this.findAll(filters)
    return records.length
  }

  /**
   * Check if a record exists
   */
  async exists(id: string): Promise<boolean> {
    const record = await this.findById(id)
    return record !== null
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
    return join(this.dataPath, `${id}.json`)
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
  protected matchesFilters(record: T, filters?: Record<string, unknown>): boolean {
    if (!filters || Object.keys(filters).length === 0) {
      return true
    }

    return Object.entries(filters).every(([key, value]) => {
      const recordValue = (record as Record<string, unknown>)[key]
      
      // Handle array filters (e.g., status: ['active', 'completed'])
      if (Array.isArray(value)) {
        return value.includes(recordValue)
      }
      
      // Handle string filters with partial matching
      if (typeof value === 'string' && typeof recordValue === 'string') {
        return recordValue.toLowerCase().includes(value.toLowerCase())
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