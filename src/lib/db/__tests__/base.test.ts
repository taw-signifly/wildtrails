/**
 * @jest-environment node
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import { z } from 'zod'
import { BaseDB, DatabaseError, ValidationError, RecordNotFoundError } from '../base'

// Test entity schema
const TestEntitySchema = z.object({
  id: z.string(),
  name: z.string(),
  value: z.number(),
  createdAt: z.string(),
  updatedAt: z.string()
})

type TestEntity = z.infer<typeof TestEntitySchema>

// Concrete implementation for testing
class TestDB extends BaseDB<TestEntity> {
  constructor(testPath = 'test-data') {
    super('test', { dataPath: testPath }, TestEntitySchema)
  }
}

describe('BaseDB', () => {
  let db: TestDB
  let testPath: string

  beforeEach(async () => {
    testPath = join(__dirname, 'test-data-' + Date.now())
    db = new TestDB(testPath)
    await db.ensureDirectoryExists()
  })

  afterEach(async () => {
    // Clean up test data
    try {
      await fs.rm(testPath, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('create', () => {
    it('should create a new record with generated ID and timestamps', async () => {
      const data = { name: 'Test Item', value: 42 }
      const result = await db.create(data)

      expect(result.id).toBeDefined()
      expect(result.name).toBe('Test Item')
      expect(result.value).toBe(42)
      expect(result.createdAt).toBeDefined()
      expect(result.updatedAt).toBeDefined()
      expect(new Date(result.createdAt)).toBeInstanceOf(Date)
      expect(new Date(result.updatedAt)).toBeInstanceOf(Date)
    })

    it('should validate data before creation', async () => {
      const invalidData = { name: 'Test', value: 'not a number' as unknown as number }
      
      await expect(db.create(invalidData)).rejects.toThrow(ValidationError)
    })

    it('should save record to file system', async () => {
      const data = { name: 'Test Item', value: 42 }
      const result = await db.create(data)

      const filePath = join(testPath, `${result.id}.json`)
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false)
      expect(fileExists).toBe(true)

      const fileContent = await fs.readFile(filePath, 'utf-8')
      const savedData = JSON.parse(fileContent)
      expect(savedData.name).toBe('Test Item')
    })
  })

  describe('findById', () => {
    it('should return record when it exists', async () => {
      const created = await db.create({ name: 'Test Item', value: 42 })
      const found = await db.findById(created.id)

      expect(found).not.toBeNull()
      expect(found!.id).toBe(created.id)
      expect(found!.name).toBe('Test Item')
    })

    it('should return null when record does not exist', async () => {
      const found = await db.findById('non-existent-id')
      expect(found).toBeNull()
    })

    it('should validate data when reading from file', async () => {
      // Create a file with invalid data
      const filePath = join(testPath, 'invalid.json')
      await fs.writeFile(filePath, JSON.stringify({ name: 'Test', value: 'invalid' }))

      await expect(db.findById('invalid')).rejects.toThrow(ValidationError)
    })
  })

  describe('findAll', () => {
    it('should return empty array when no records exist', async () => {
      const result = await db.findAll()
      expect(result).toEqual([])
    })

    it('should return all records sorted by updatedAt', async () => {
      const item1 = await db.create({ name: 'Item 1', value: 1 })
      await new Promise(resolve => setTimeout(resolve, 10)) // Small delay
      const item2 = await db.create({ name: 'Item 2', value: 2 })

      const result = await db.findAll()
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe(item2.id) // Newest first
      expect(result[1].id).toBe(item1.id)
    })

    it('should filter records when filters are provided', async () => {
      await db.create({ name: 'Item A', value: 1 })
      await db.create({ name: 'Item B', value: 2 })
      await db.create({ name: 'Another A', value: 1 })

      const result = await db.findAll({ value: 1 })
      expect(result).toHaveLength(2)
      expect(result.every(item => item.value === 1)).toBe(true)
    })

    it('should handle array filters', async () => {
      await db.create({ name: 'Item 1', value: 1 })
      await db.create({ name: 'Item 2', value: 2 })
      await db.create({ name: 'Item 3', value: 3 })

      const result = await db.findAll({ value: [1, 3] })
      expect(result).toHaveLength(2)
      expect(result.some(item => item.value === 1)).toBe(true)
      expect(result.some(item => item.value === 3)).toBe(true)
    })

    it('should handle partial string matching', async () => {
      await db.create({ name: 'Apple', value: 1 })
      await db.create({ name: 'Banana', value: 2 })
      await db.create({ name: 'Pineapple', value: 3 })

      const result = await db.findAll({ name: 'apple' })
      expect(result).toHaveLength(2) // Apple and Pineapple
    })
  })

  describe('update', () => {
    it('should update existing record', async () => {
      const created = await db.create({ name: 'Original', value: 1 })
      const updated = await db.update(created.id, { name: 'Updated', value: 2 })

      expect(updated.id).toBe(created.id)
      expect(updated.name).toBe('Updated')
      expect(updated.value).toBe(2)
      expect(updated.createdAt).toBe(created.createdAt)
      expect(updated.updatedAt).not.toBe(created.updatedAt)
    })

    it('should throw error when record does not exist', async () => {
      await expect(db.update('non-existent', { name: 'Test' }))
        .rejects.toThrow(RecordNotFoundError)
    })

    it('should validate updated data', async () => {
      const created = await db.create({ name: 'Test', value: 1 })
      
      await expect(db.update(created.id, { value: 'invalid' as unknown as number }))
        .rejects.toThrow(ValidationError)
    })

    it('should preserve ID even if provided in update data', async () => {
      const created = await db.create({ name: 'Test', value: 1 })
      const updated = await db.update(created.id, { 
        name: 'Updated' 
      })

      expect(updated.id).toBe(created.id)
      expect(updated.name).toBe('Updated')
    })

    it('should create backup before update when enabled', async () => {
      const created = await db.create({ name: 'Test', value: 1 })
      await db.update(created.id, { name: 'Updated' })

      // Check if backup was created
      const backupPath = join('data', 'system', 'backup', 'test')
      const backupExists = await fs.access(backupPath).then(() => true).catch(() => false)
      expect(backupExists).toBe(true)
    })
  })

  describe('delete', () => {
    it('should move record to archive instead of deleting', async () => {
      const created = await db.create({ name: 'Test', value: 1 })
      await db.delete(created.id)

      // Original file should not exist
      const originalPath = join(testPath, `${created.id}.json`)
      const originalExists = await fs.access(originalPath).then(() => true).catch(() => false)
      expect(originalExists).toBe(false)

      // Should not be found by findById
      const found = await db.findById(created.id)
      expect(found).toBeNull()
    })

    it('should throw error when record does not exist', async () => {
      await expect(db.delete('non-existent'))
        .rejects.toThrow(RecordNotFoundError)
    })
  })

  describe('backup and restore', () => {
    it('should create backup of record', async () => {
      const created = await db.create({ name: 'Test', value: 1 })
      await db.backup(created.id)

      const backupPath = join('data', 'system', 'backup', 'test')
      const backupExists = await fs.access(backupPath).then(() => true).catch(() => false)
      expect(backupExists).toBe(true)
    })

    it('should restore record from backup', async () => {
      const created = await db.create({ name: 'Original', value: 1 })
      await db.backup(created.id)
      
      // Update record
      const updated = await db.update(created.id, { name: 'Updated' })
      expect(updated.name).toBe('Updated')
      
      // Restore from backup
      const restored = await db.restore(created.id)
      expect(restored.name).toBe('Original')
    })

    it('should throw error when backing up non-existent record', async () => {
      await expect(db.backup('non-existent'))
        .rejects.toThrow(RecordNotFoundError)
    })

    it('should throw error when restoring with no backups', async () => {
      await expect(db.restore('non-existent'))
        .rejects.toThrow(DatabaseError)
    })
  })

  describe('count', () => {
    it('should return 0 when no records exist', async () => {
      const count = await db.count()
      expect(count).toBe(0)
    })

    it('should return correct count of records', async () => {
      await db.create({ name: 'Item 1', value: 1 })
      await db.create({ name: 'Item 2', value: 2 })
      await db.create({ name: 'Item 3', value: 3 })

      const count = await db.count()
      expect(count).toBe(3)
    })

    it('should return filtered count when filters are provided', async () => {
      await db.create({ name: 'Item A', value: 1 })
      await db.create({ name: 'Item B', value: 2 })
      await db.create({ name: 'Item C', value: 1 })

      const count = await db.count({ value: 1 })
      expect(count).toBe(2)
    })
  })

  describe('exists', () => {
    it('should return true when record exists', async () => {
      const created = await db.create({ name: 'Test', value: 1 })
      const exists = await db.exists(created.id)
      expect(exists).toBe(true)
    })

    it('should return false when record does not exist', async () => {
      const exists = await db.exists('non-existent')
      expect(exists).toBe(false)
    })
  })

  describe('error handling', () => {
    it('should handle file system errors gracefully', async () => {
      // Create db with invalid path
      const invalidDB = new TestDB('/invalid-path/that/does/not/exist')
      
      await expect(invalidDB.create({ name: 'Test', value: 1 }))
        .rejects.toThrow(DatabaseError)
    })

    it('should wrap unknown errors in DatabaseError', async () => {
      // Mock file system error
      jest.spyOn(fs, 'readFile').mockRejectedValueOnce(new Error('Mock error'))

      const created = await db.create({ name: 'Test', value: 1 })
      
      await expect(db.findById(created.id)).rejects.toThrow(DatabaseError)
      
      // Restore original function
      jest.restoreAllMocks()
    })
  })

  describe('utility methods', () => {
    it('should generate unique IDs', async () => {
      const db1 = new TestDB()
      const db2 = new TestDB()
      
      // Access protected method through casting
      const id1 = (db1 as unknown as { generateId(): string }).generateId()
      const id2 = (db2 as unknown as { generateId(): string }).generateId()
      
      expect(id1).toBeDefined()
      expect(id2).toBeDefined()
      expect(id1).not.toBe(id2)
      expect(typeof id1).toBe('string')
      expect(typeof id2).toBe('string')
    })

    it('should generate correct file paths', async () => {
      const path = (db as unknown as { getFilePath(id: string): string }).getFilePath('test-id')
      expect(path).toBe(join(testPath, 'test-id.json'))
    })

    it('should add timestamps correctly', async () => {
      const data = { name: 'Test', value: 1 }
      const timestamped = (db as unknown as { addTimestamps(data: unknown): TestEntity }).addTimestamps(data)
      
      expect(timestamped.id).toBeDefined()
      expect(timestamped.createdAt).toBeDefined()
      expect(timestamped.updatedAt).toBeDefined()
      expect(timestamped.name).toBe('Test')
      expect(timestamped.value).toBe(1)
    })

    it('should match filters correctly', async () => {
      const record = { name: 'Test Item', value: 42, id: '1', createdAt: '2024-01-01', updatedAt: '2024-01-01' }
      const matchesFilters = (db as unknown as { matchesFilters(record: TestEntity, filters?: Record<string, unknown>): boolean }).matchesFilters
      
      expect(matchesFilters(record, {})).toBe(true)
      expect(matchesFilters(record, { name: 'test' })).toBe(true)
      expect(matchesFilters(record, { value: 42 })).toBe(true)
      expect(matchesFilters(record, { value: [40, 42, 44] })).toBe(true)
      expect(matchesFilters(record, { name: 'other' })).toBe(false)
      expect(matchesFilters(record, { value: 99 })).toBe(false)
    })
  })
})