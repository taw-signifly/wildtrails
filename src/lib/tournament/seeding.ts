import { Team } from '@/types'
import { SeedingOptions } from './types'

export class Seeder {
  /**
   * Seed teams based on specified options
   */
  seedTeams(teams: Team[], options: SeedingOptions): Team[] {
    const clonedTeams = [...teams]
    
    switch (options.method) {
      case 'ranked':
        return this.rankedSeeding(clonedTeams, options)
      case 'random':
        return this.randomSeeding(clonedTeams, options)
      case 'club-balanced':
        return this.clubBalancedSeeding(clonedTeams, options)
      case 'geographic':
        return this.geographicSeeding(clonedTeams, options)
      case 'skill-balanced':
        return this.skillBalancedSeeding(clonedTeams, options)
      default:
        throw new Error(`Unsupported seeding method: ${options.method}`)
    }
  }

  /**
   * Rank-based seeding (highest ranked teams get best seeds)
   */
  private rankedSeeding(teams: Team[], options: SeedingOptions): Team[] {
    return teams.sort((a, b) => {
      // Primary sort by ranking (lower ranking number = better)
      const aRanking = this.getTeamRanking(a)
      const bRanking = this.getTeamRanking(b)
      
      if (aRanking !== bRanking) {
        return aRanking - bRanking
      }
      
      // Secondary sort by win percentage
      const aWinRate = this.getTeamWinRate(a)
      const bWinRate = this.getTeamWinRate(b)
      
      if (aWinRate !== bWinRate) {
        return bWinRate - aWinRate
      }
      
      // Tertiary sort by points differential
      const aDiff = this.getTeamPointsDifferential(a)
      const bDiff = this.getTeamPointsDifferential(b)
      
      return bDiff - aDiff
    })
  }

  /**
   * Random seeding with optional reproducible seed
   */
  private randomSeeding(teams: Team[], options: SeedingOptions): Team[] {
    const rng = options.randomSeed ? this.createSeededRNG(options.randomSeed) : Math.random
    
    // Fisher-Yates shuffle with optional seeded random
    for (let i = teams.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[teams[i], teams[j]] = [teams[j], teams[i]]
    }
    
    return teams
  }

  /**
   * Club-balanced seeding (avoid same club members facing each other early)
   */
  private clubBalancedSeeding(teams: Team[], options: SeedingOptions): Team[] {
    // First, group teams by club
    const clubGroups = new Map<string, Team[]>()
    const noClubTeams: Team[] = []
    
    teams.forEach(team => {
      const club = this.getTeamClub(team)
      if (club) {
        if (!clubGroups.has(club)) {
          clubGroups.set(club, [])
        }
        clubGroups.get(club)!.push(team)
      } else {
        noClubTeams.push(team)
      }
    })
    
    // Sort teams within each club by ranking
    clubGroups.forEach(clubTeams => {
      clubTeams.sort((a, b) => this.getTeamRanking(a) - this.getTeamRanking(b))
    })
    
    // Sort no-club teams by ranking
    noClubTeams.sort((a, b) => this.getTeamRanking(a) - this.getTeamRanking(b))
    
    // Distribute teams to maximize separation of club members
    const result: Team[] = []
    const clubTeamsCopy = new Map(Array.from(clubGroups.entries()).map(([k, v]) => [k, [...v]]))
    
    // Use round-robin distribution to spread club members
    while (result.length < teams.length) {
      let addedThisRound = false
      
      // First, add one team from each club that still has teams
      for (const [club, clubTeams] of clubTeamsCopy) {
        if (clubTeams.length > 0) {
          result.push(clubTeams.shift()!)
          addedThisRound = true
          
          if (clubTeams.length === 0) {
            clubTeamsCopy.delete(club)
          }
        }
      }
      
      // Then add no-club teams
      while (noClubTeams.length > 0 && clubTeamsCopy.size === 0) {
        result.push(noClubTeams.shift()!)
        addedThisRound = true
        break
      }
      
      if (!addedThisRound) break
    }
    
    // Add any remaining no-club teams
    result.push(...noClubTeams)
    
    return result
  }

  /**
   * Geographic seeding (distribute teams from different regions)
   */
  private geographicSeeding(teams: Team[], options: SeedingOptions): Team[] {
    // Group teams by geographic region
    const regionGroups = new Map<string, Team[]>()
    
    teams.forEach(team => {
      const region = this.getTeamRegion(team)
      if (!regionGroups.has(region)) {
        regionGroups.set(region, [])
      }
      regionGroups.get(region)!.push(team)
    })
    
    // Sort teams within each region by ranking
    regionGroups.forEach(regionTeams => {
      regionTeams.sort((a, b) => this.getTeamRanking(a) - this.getTeamRanking(b))
    })
    
    // Distribute teams similar to club-balanced seeding
    const result: Team[] = []
    const regionTeamsCopy = new Map(Array.from(regionGroups.entries()).map(([k, v]) => [k, [...v]]))
    
    while (result.length < teams.length) {
      let addedThisRound = false
      
      for (const [region, regionTeams] of regionTeamsCopy) {
        if (regionTeams.length > 0) {
          result.push(regionTeams.shift()!)
          addedThisRound = true
          
          if (regionTeams.length === 0) {
            regionTeamsCopy.delete(region)
          }
        }
      }
      
      if (!addedThisRound) break
    }
    
    return result
  }

  /**
   * Skill-balanced seeding (distribute skill levels evenly across bracket)
   */
  private skillBalancedSeeding(teams: Team[], options: SeedingOptions): Team[] {
    // First sort by skill/ranking
    const rankedTeams = this.rankedSeeding([...teams], options)
    
    switch (options.skillDistribution) {
      case 'snake':
        return this.snakeDistribution(rankedTeams)
      case 'even':
        return this.evenDistribution(rankedTeams)
      case 'random':
      default:
        return this.randomSkillDistribution(rankedTeams, options)
    }
  }

  /**
   * Snake distribution (1, 4, 5, 8, 9, 12, etc. for even distribution)
   */
  private snakeDistribution(rankedTeams: Team[]): Team[] {
    const result: Team[] = []
    const brackets: Team[][] = []
    const bracketSize = Math.ceil(Math.sqrt(rankedTeams.length))
    
    // Create brackets
    for (let i = 0; i < bracketSize; i++) {
      brackets.push([])
    }
    
    // Fill brackets in snake pattern
    let currentBracket = 0
    let direction = 1
    
    rankedTeams.forEach(team => {
      brackets[currentBracket].push(team)
      
      currentBracket += direction
      
      if (currentBracket >= bracketSize || currentBracket < 0) {
        direction *= -1
        currentBracket += direction
      }
    })
    
    // Flatten brackets
    brackets.forEach(bracket => result.push(...bracket))
    
    return result
  }

  /**
   * Even distribution (spread skill levels evenly)
   */
  private evenDistribution(rankedTeams: Team[]): Team[] {
    const numGroups = Math.ceil(rankedTeams.length / 4)
    const groups: Team[][] = Array.from({ length: numGroups }, () => [])
    
    rankedTeams.forEach((team, index) => {
      groups[index % numGroups].push(team)
    })
    
    return groups.flat()
  }

  /**
   * Random skill distribution with constraints
   */
  private randomSkillDistribution(rankedTeams: Team[], options: SeedingOptions): Team[] {
    // Divide into skill tiers
    const tierSize = Math.ceil(rankedTeams.length / 4)
    const tiers: Team[][] = []
    
    for (let i = 0; i < rankedTeams.length; i += tierSize) {
      tiers.push(rankedTeams.slice(i, i + tierSize))
    }
    
    // Randomly distribute within tiers
    const result: Team[] = []
    const rng = options.randomSeed ? this.createSeededRNG(options.randomSeed) : Math.random
    
    while (result.length < rankedTeams.length) {
      for (const tier of tiers) {
        if (tier.length > 0) {
          const randomIndex = Math.floor(rng() * tier.length)
          result.push(tier.splice(randomIndex, 1)[0])
        }
      }
    }
    
    return result
  }

  /**
   * Assign byes to seeded teams
   */
  assignByes(seededTeams: Team[], targetBracketSize: number): { teams: Team[], byes: Team[] } {
    const byeCount = targetBracketSize - seededTeams.length
    
    if (byeCount <= 0) {
      return { teams: seededTeams, byes: [] }
    }
    
    // Top seeds get byes
    const byes = seededTeams.slice(0, byeCount)
    const teams = seededTeams.slice(byeCount)
    
    return { teams, byes }
  }

  /**
   * Helper methods to extract team properties
   */
  private getTeamRanking(team: Team): number {
    // Calculate team ranking based on individual player rankings
    if (team.players.length === 0) return 9999
    
    const totalRanking = team.players.reduce((sum, player) => {
      return sum + (player.ranking || 9999)
    }, 0)
    
    return totalRanking / team.players.length
  }

  private getTeamWinRate(team: Team): number {
    if (team.players.length === 0) return 0
    
    const totalWinRate = team.players.reduce((sum, player) => {
      return sum + player.stats.winPercentage
    }, 0)
    
    return totalWinRate / team.players.length
  }

  private getTeamPointsDifferential(team: Team): number {
    if (team.players.length === 0) return 0
    
    const totalDiff = team.players.reduce((sum, player) => {
      return sum + player.stats.pointsDifferential
    }, 0)
    
    return totalDiff / team.players.length
  }

  private getTeamClub(team: Team): string {
    // Return the most common club among team members
    if (team.players.length === 0) return ''
    
    const clubs = team.players
      .map(p => p.club || '')
      .filter(club => club !== '')
    
    if (clubs.length === 0) return ''
    
    // Find most frequent club
    const clubCounts = new Map<string, number>()
    clubs.forEach(club => {
      clubCounts.set(club, (clubCounts.get(club) || 0) + 1)
    })
    
    let mostCommonClub = ''
    let maxCount = 0
    
    clubCounts.forEach((count, club) => {
      if (count > maxCount) {
        maxCount = count
        mostCommonClub = club
      }
    })
    
    return mostCommonClub
  }

  private getTeamRegion(team: Team): string {
    // Extract region from team/player information
    // This could be based on club location, player location, etc.
    // For now, use club as a proxy for region
    const club = this.getTeamClub(team)
    return club ? this.extractRegionFromClub(club) : 'Unknown'
  }

  private extractRegionFromClub(club: string): string {
    // Simple region extraction - in practice this would use
    // a more sophisticated mapping of clubs to regions
    const regionKeywords = {
      'North': ['north', 'northern'],
      'South': ['south', 'southern'],
      'East': ['east', 'eastern'],
      'West': ['west', 'western'],
      'Central': ['central', 'center']
    }
    
    const lowerClub = club.toLowerCase()
    
    for (const [region, keywords] of Object.entries(regionKeywords)) {
      if (keywords.some(keyword => lowerClub.includes(keyword))) {
        return region
      }
    }
    
    return 'Other'
  }

  /**
   * Create a seeded random number generator for reproducible results
   */
  private createSeededRNG(seed: number): () => number {
    let value = seed
    return () => {
      value = (value * 16807) % 2147483647
      return (value - 1) / 2147483646
    }
  }
}