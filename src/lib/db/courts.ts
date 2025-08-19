import { BaseDB, DatabaseConfig, RecordNotFoundError, DatabaseError } from './base'
import { Court, Result, tryCatch } from '@/types'
import { CourtSchema } from '@/lib/validation/match'

/**
 * Court status type for availability tracking
 */
export type CourtStatus = 'available' | 'in-use' | 'maintenance' | 'reserved'

/**
 * Court surface type
 */
export type CourtSurface = 'gravel' | 'sand' | 'dirt' | 'artificial'

/**
 * Court creation data interface
 */
export interface CourtCreateData {
  name: string
  location: string
  dimensions: {
    length: number
    width: number
    throwingDistance: number
  }
  surface: CourtSurface
  lighting: boolean
  covered: boolean
  amenities?: string[]
}

/**
 * Court-specific database operations
 */
export class CourtDB extends BaseDB<Court> {
  constructor(config?: Partial<DatabaseConfig>) {
    super(
      'courts',
      {
        dataPath: 'data/courts',
        ...config
      },
      CourtSchema
    )
  }

  /**
   * Create a new court
   */
  async create(courtData: CourtCreateData): Promise<Result<Court, DatabaseError>> {
    return tryCatch(async () => {
      const fullCourtData: Omit<Court, 'id' | 'createdAt' | 'updatedAt'> = {
        name: courtData.name,
        location: courtData.location,
        dimensions: courtData.dimensions,
        surface: courtData.surface,
        lighting: courtData.lighting,
        covered: courtData.covered,
        status: 'available',
        currentMatch: undefined,
        nextMatch: undefined,
        amenities: courtData.amenities || []
      }

      const result = await super.create(fullCourtData)
      if (result.error) {
        throw result.error
      }
      return result.data
    })
  }

  /**
   * Find available courts
   */
  async findAvailable(): Promise<Result<Court[], DatabaseError>> {
    return this.findAll({ status: 'available' })
  }

  /**
   * Find courts in use
   */
  async findInUse(): Promise<Result<Court[], DatabaseError>> {
    return this.findAll({ status: 'in-use' })
  }

  /**
   * Find courts by surface type
   */
  async findBySurface(surface: CourtSurface): Promise<Result<Court[], DatabaseError>> {
    return this.findAll({ surface })
  }

  /**
   * Find courts by location
   */
  async findByLocation(location: string): Promise<Result<Court[], DatabaseError>> {
    return tryCatch(async () => {
      const courtsResult = await this.findAll()
      if (courtsResult.error) {
        throw courtsResult.error
      }
      
      return courtsResult.data.filter(court => 
        court.location.toLowerCase().includes(location.toLowerCase())
      )
    })
  }

  /**
   * Find courts with specific amenities
   */
  async findWithAmenities(amenities: string[]): Promise<Result<Court[], DatabaseError>> {
    return tryCatch(async () => {
      const courtsResult = await this.findAll()
      if (courtsResult.error) {
        throw courtsResult.error
      }
      
      return courtsResult.data.filter(court => 
        amenities.every(amenity => 
          court.amenities.some(courtAmenity => 
            courtAmenity.toLowerCase().includes(amenity.toLowerCase())
          )
        )
      )
    })
  }

  /**
   * Find courts with lighting
   */
  async findWithLighting(): Promise<Result<Court[], DatabaseError>> {
    return this.findAll({ lighting: true })
  }

  /**
   * Find covered courts
   */
  async findCovered(): Promise<Result<Court[], DatabaseError>> {
    return this.findAll({ covered: true })
  }

  /**
   * Update court status
   */
  async updateStatus(id: string, status: CourtStatus): Promise<Result<Court, DatabaseError>> {
    return this.update(id, { status })
  }

  /**
   * Reserve a court for a match
   */
  async reserveForMatch(id: string, matchId: string): Promise<Result<Court, DatabaseError>> {
    return tryCatch(async () => {
      const courtResult = await this.findById(id)
      if (courtResult.error) {
        throw courtResult.error
      }
      
      if (!courtResult.data) {
        throw new RecordNotFoundError(id, this.entityName)
      }

      const court = courtResult.data
      if (court.status !== 'available') {
        throw new Error(`Court is not available (current status: ${court.status})`)
      }

      const updateResult = await this.update(id, {
        status: 'reserved',
        nextMatch: matchId
      })
      
      if (updateResult.error) {
        throw updateResult.error
      }
      
      return updateResult.data
    })
  }

  /**
   * Assign a match to a court (start using the court)
   */
  async assignMatch(id: string, matchId: string): Promise<Result<Court, DatabaseError>> {
    return tryCatch(async () => {
      const courtResult = await this.findById(id)
      if (courtResult.error) {
        throw courtResult.error
      }
      
      if (!courtResult.data) {
        throw new RecordNotFoundError(id, this.entityName)
      }

      const court = courtResult.data
      if (court.status === 'in-use' && court.currentMatch) {
        throw new Error('Court is already in use by another match')
      }

      if (court.status === 'maintenance') {
        throw new Error('Court is under maintenance and cannot be used')
      }

      const updateResult = await this.update(id, {
        status: 'in-use',
        currentMatch: matchId,
        nextMatch: undefined
      })
      
      if (updateResult.error) {
        throw updateResult.error
      }
      
      return updateResult.data
    })
  }

  /**
   * Release a court from a match (make available again)
   */
  async releaseFromMatch(id: string): Promise<Result<Court, DatabaseError>> {
    return tryCatch(async () => {
      const courtResult = await this.findById(id)
      if (courtResult.error) {
        throw courtResult.error
      }
      
      if (!courtResult.data) {
        throw new RecordNotFoundError(id, this.entityName)
      }

      const updateResult = await this.update(id, {
        status: 'available',
        currentMatch: undefined
      })
      
      if (updateResult.error) {
        throw updateResult.error
      }
      
      return updateResult.data
    })
  }

  /**
   * Schedule next match on a court
   */
  async scheduleNextMatch(id: string, matchId: string): Promise<Result<Court, DatabaseError>> {
    return tryCatch(async () => {
      const courtResult = await this.findById(id)
      if (courtResult.error) {
        throw courtResult.error
      }
      
      if (!courtResult.data) {
        throw new RecordNotFoundError(id, this.entityName)
      }

      const updateResult = await this.update(id, { nextMatch: matchId })
      if (updateResult.error) {
        throw updateResult.error
      }
      
      return updateResult.data
    })
  }

  /**
   * Put court into maintenance mode
   */
  async setMaintenance(id: string, reason?: string): Promise<Result<Court, DatabaseError>> {
    return tryCatch(async () => {
      const courtResult = await this.findById(id)
      if (courtResult.error) {
        throw courtResult.error
      }
      
      if (!courtResult.data) {
        throw new RecordNotFoundError(id, this.entityName)
      }

      const court = courtResult.data
      if (court.status === 'in-use') {
        throw new Error('Cannot set maintenance mode while court is in use')
      }

      // Add maintenance reason to amenities temporarily for tracking
      const updatedAmenities = reason 
        ? [...court.amenities, `Maintenance: ${reason}`]
        : court.amenities

      const updateResult = await this.update(id, {
        status: 'maintenance',
        currentMatch: undefined,
        nextMatch: undefined,
        amenities: updatedAmenities
      })
      
      if (updateResult.error) {
        throw updateResult.error
      }
      
      return updateResult.data
    })
  }

  /**
   * Remove court from maintenance mode
   */
  async removeMaintenance(id: string): Promise<Result<Court, DatabaseError>> {
    return tryCatch(async () => {
      const courtResult = await this.findById(id)
      if (courtResult.error) {
        throw courtResult.error
      }
      
      if (!courtResult.data) {
        throw new RecordNotFoundError(id, this.entityName)
      }

      const court = courtResult.data
      // Remove maintenance-related amenities
      const updatedAmenities = court.amenities.filter(amenity => 
        !amenity.toLowerCase().startsWith('maintenance:')
      )

      const updateResult = await this.update(id, {
        status: 'available',
        amenities: updatedAmenities
      })
      
      if (updateResult.error) {
        throw updateResult.error
      }
      
      return updateResult.data
    })
  }

  /**
   * Update court amenities
   */
  async updateAmenities(id: string, amenities: string[]): Promise<Result<Court, DatabaseError>> {
    return tryCatch(async () => {
      if (amenities.length > 20) {
        throw new Error('Maximum 20 amenities allowed per court')
      }

      // Validate amenity length
      const invalidAmenities = amenities.filter(amenity => amenity.length > 50)
      if (invalidAmenities.length > 0) {
        throw new Error('Amenities must be 50 characters or less')
      }

      const updateResult = await this.update(id, { amenities })
      if (updateResult.error) {
        throw updateResult.error
      }
      
      return updateResult.data
    })
  }

  /**
   * Add amenity to court
   */
  async addAmenity(id: string, amenity: string): Promise<Result<Court, DatabaseError>> {
    return tryCatch(async () => {
      const courtResult = await this.findById(id)
      if (courtResult.error) {
        throw courtResult.error
      }
      
      if (!courtResult.data) {
        throw new RecordNotFoundError(id, this.entityName)
      }

      const court = courtResult.data
      if (court.amenities.includes(amenity)) {
        throw new Error('Amenity already exists')
      }

      if (court.amenities.length >= 20) {
        throw new Error('Maximum 20 amenities allowed per court')
      }

      if (amenity.length > 50) {
        throw new Error('Amenity must be 50 characters or less')
      }

      const updatedAmenities = [...court.amenities, amenity]
      const updateResult = await this.update(id, { amenities: updatedAmenities })
      
      if (updateResult.error) {
        throw updateResult.error
      }
      
      return updateResult.data
    })
  }

  /**
   * Remove amenity from court
   */
  async removeAmenity(id: string, amenity: string): Promise<Result<Court, DatabaseError>> {
    return tryCatch(async () => {
      const courtResult = await this.findById(id)
      if (courtResult.error) {
        throw courtResult.error
      }
      
      if (!courtResult.data) {
        throw new RecordNotFoundError(id, this.entityName)
      }

      const court = courtResult.data
      const updatedAmenities = court.amenities.filter(a => a !== amenity)
      const updateResult = await this.update(id, { amenities: updatedAmenities })
      
      if (updateResult.error) {
        throw updateResult.error
      }
      
      return updateResult.data
    })
  }

  /**
   * Update court dimensions
   */
  async updateDimensions(id: string, dimensions: {
    length: number
    width: number
    throwingDistance: number
  }): Promise<Result<Court, DatabaseError>> {
    return tryCatch(async () => {
      // Validate standard Petanque court dimensions
      if (dimensions.length < 12 || dimensions.length > 15) {
        throw new Error('Court length must be between 12-15 meters')
      }
      if (dimensions.width < 3 || dimensions.width > 5) {
        throw new Error('Court width must be between 3-5 meters')
      }
      if (dimensions.throwingDistance < 6 || dimensions.throwingDistance > 10) {
        throw new Error('Throwing distance must be between 6-10 meters')
      }

      const updateResult = await this.update(id, { dimensions })
      if (updateResult.error) {
        throw updateResult.error
      }
      
      return updateResult.data
    })
  }

  /**
   * Get court utilization statistics
   */
  async getUtilizationStats(): Promise<Result<{
    total: number
    available: number
    inUse: number
    maintenance: number
    reserved: number
    utilizationRate: number
    byLocation: Record<string, number>
    bySurface: Record<CourtSurface, number>
  }, DatabaseError>> {
    return tryCatch(async () => {
      const courtsResult = await this.findAll()
      if (courtsResult.error) {
        throw courtsResult.error
      }
      
      const courts = courtsResult.data
      const stats = {
        total: courts.length,
        available: 0,
        inUse: 0,
        maintenance: 0,
        reserved: 0,
        utilizationRate: 0,
        byLocation: {} as Record<string, number>,
        bySurface: {
          gravel: 0,
          sand: 0,
          dirt: 0,
          artificial: 0
        } as Record<CourtSurface, number>
      }

      courts.forEach(court => {
        // Count by status
        switch (court.status) {
          case 'available':
            stats.available++
            break
          case 'in-use':
            stats.inUse++
            break
          case 'maintenance':
            stats.maintenance++
            break
          case 'reserved':
            stats.reserved++
            break
        }

        // Count by location
        stats.byLocation[court.location] = (stats.byLocation[court.location] || 0) + 1

        // Count by surface
        stats.bySurface[court.surface]++
      })

      // Calculate utilization rate (in-use + reserved / total)
      stats.utilizationRate = courts.length > 0 
        ? Math.round(((stats.inUse + stats.reserved) / courts.length) * 100)
        : 0

      return stats
    })
  }

  /**
   * Find suitable courts for tournament
   */
  async findSuitableForTournament(requirements: {
    minCourts?: number
    preferredSurface?: CourtSurface
    requireLighting?: boolean
    requireCovered?: boolean
    requiredAmenities?: string[]
    excludeInMaintenance?: boolean
  }): Promise<Result<Court[], DatabaseError>> {
    return tryCatch(async () => {
      const courtsResult = await this.findAll()
      if (courtsResult.error) {
        throw courtsResult.error
      }
      
      const courts = courtsResult.data
      
      return courts.filter(court => {
        // Exclude maintenance courts if requested
        if (requirements.excludeInMaintenance && court.status === 'maintenance') {
          return false
        }

        // Check surface preference
        if (requirements.preferredSurface && court.surface !== requirements.preferredSurface) {
          return false
        }

        // Check lighting requirement
        if (requirements.requireLighting && !court.lighting) {
          return false
        }

        // Check covered requirement
        if (requirements.requireCovered && !court.covered) {
          return false
        }

        // Check required amenities
        if (requirements.requiredAmenities && requirements.requiredAmenities.length > 0) {
          const hasAllAmenities = requirements.requiredAmenities.every(required =>
            court.amenities.some(amenity => 
              amenity.toLowerCase().includes(required.toLowerCase())
            )
          )
          if (!hasAllAmenities) {
            return false
          }
        }

        return true
      })
    })
  }

  /**
   * Get court schedule (current and next matches)
   */
  async getSchedule(id: string): Promise<Result<{
    court: Court
    currentMatch?: string
    nextMatch?: string
    status: CourtStatus
    estimatedAvailableTime?: Date
  }, DatabaseError>> {
    return tryCatch(async () => {
      const courtResult = await this.findById(id)
      if (courtResult.error) {
        throw courtResult.error
      }
      
      if (!courtResult.data) {
        throw new RecordNotFoundError(id, this.entityName)
      }

      const court = courtResult.data
      const schedule = {
        court,
        currentMatch: court.currentMatch,
        nextMatch: court.nextMatch,
        status: court.status,
        estimatedAvailableTime: undefined as Date | undefined
      }

      // If court is in use, estimate when it might be available
      // This is a simple estimation - could be enhanced with actual match data
      if (court.status === 'in-use' && court.currentMatch) {
        // Assume average match duration of 90 minutes
        schedule.estimatedAvailableTime = new Date(Date.now() + 90 * 60 * 1000)
      }

      return schedule
    })
  }

  /**
   * Bulk update court statuses
   */
  async bulkUpdateStatus(courtIds: string[], status: CourtStatus): Promise<Result<{
    successful: Court[]
    failed: { id: string; error: string }[]
  }, DatabaseError>> {
    return tryCatch(async () => {
      const result = {
        successful: [] as Court[],
        failed: [] as { id: string; error: string }[]
      }

      for (const courtId of courtIds) {
        const updateResult = await this.updateStatus(courtId, status)
        if (updateResult.error) {
          result.failed.push({
            id: courtId,
            error: updateResult.error.message
          })
        } else {
          result.successful.push(updateResult.data)
        }
      }

      return result
    })
  }

  /**
   * Search courts by name or location
   */
  async search(query: string): Promise<Result<Court[], DatabaseError>> {
    return tryCatch(async () => {
      const courtsResult = await this.findAll()
      if (courtsResult.error) {
        throw courtsResult.error
      }
      
      const courts = courtsResult.data
      const lowerQuery = query.toLowerCase()
      
      return courts.filter(court => 
        court.name.toLowerCase().includes(lowerQuery) ||
        court.location.toLowerCase().includes(lowerQuery) ||
        court.amenities.some(amenity => amenity.toLowerCase().includes(lowerQuery))
      )
    })
  }
}

// Export default instance
export const courtDB = new CourtDB()

// Export utility functions
export const CourtUtils = {
  /**
   * Check if court can be assigned to match
   */
  canAssignMatch: (court: Court): { canAssign: boolean; reason?: string } => {
    if (court.status === 'in-use' && court.currentMatch) {
      return { canAssign: false, reason: 'Court is already in use' }
    }
    
    if (court.status === 'maintenance') {
      return { canAssign: false, reason: 'Court is under maintenance' }
    }
    
    return { canAssign: true }
  },

  /**
   * Check if court can be reserved
   */
  canReserve: (court: Court): { canReserve: boolean; reason?: string } => {
    if (court.status !== 'available') {
      return { canReserve: false, reason: `Court is not available (status: ${court.status})` }
    }
    
    return { canReserve: true }
  },

  /**
   * Calculate court area
   */
  getArea: (court: Court): number => {
    return Math.round(court.dimensions.length * court.dimensions.width * 10) / 10
  },

  /**
   * Check if court meets standard dimensions
   */
  meetsStandards: (court: Court): boolean => {
    const { dimensions } = court
    return (
      dimensions.length >= 12 && dimensions.length <= 15 &&
      dimensions.width >= 3 && dimensions.width <= 5 &&
      dimensions.throwingDistance >= 6 && dimensions.throwingDistance <= 10
    )
  },

  /**
   * Get court description
   */
  getDescription: (court: Court): string => {
    const features: string[] = []
    
    if (court.lighting) features.push('Lighting')
    if (court.covered) features.push('Covered')
    
    const amenityCount = court.amenities.length
    if (amenityCount > 0) features.push(`${amenityCount} amenities`)
    
    const featuresText = features.length > 0 ? ` (${features.join(', ')})` : ''
    
    return `${court.name} - ${court.surface} surface, ${court.dimensions.length}x${court.dimensions.width}m${featuresText}`
  },

  /**
   * Get court status color (for UI)
   */
  getStatusColor: (status: CourtStatus): string => {
    switch (status) {
      case 'available':
        return 'green'
      case 'in-use':
        return 'blue'
      case 'reserved':
        return 'orange'
      case 'maintenance':
        return 'red'
      default:
        return 'gray'
    }
  },

  /**
   * Validate court dimensions for Petanque standards
   */
  validateDimensions: (dimensions: {
    length: number
    width: number
    throwingDistance: number
  }): { isValid: boolean; errors: string[] } => {
    const errors: string[] = []
    
    if (dimensions.length < 12 || dimensions.length > 15) {
      errors.push('Length must be between 12-15 meters')
    }
    
    if (dimensions.width < 3 || dimensions.width > 5) {
      errors.push('Width must be between 3-5 meters')
    }
    
    if (dimensions.throwingDistance < 6 || dimensions.throwingDistance > 10) {
      errors.push('Throwing distance must be between 6-10 meters')
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }
}