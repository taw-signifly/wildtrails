import { Tournament, Team, Match, BracketNode, TournamentType } from '@/types'
import { BaseFormatHandler } from './base'
import { 
  BracketResult, 
  ProgressionResult, 
  Standings, 
  FormatConstraints,
  BracketGenerationOptions,
  TeamRanking,
  BracketMetadata,
  PairingOptions,
  PairingResult,
  TeamPairing
} from '../types'

interface SwissTeamStats {
  team: Team
  points: number
  wins: number
  losses: number
  draws: number
  buchholz: number
  sonnebornBerger: number
  opponents: Set<string>
  colors: { white: number; black: number } // For games where color matters
}

export class SwissSystemHandler extends BaseFormatHandler {
  readonly formatType: TournamentType = 'swiss'
  readonly constraints: FormatConstraints = {
    minTeams: 4,
    maxTeams: 200, // Can handle very large tournaments
    preferredTeamCounts: [], // Any even number is ideal, but odd works too
    supportsOddTeamCount: true,
    supportsByes: true, // For odd numbers or dropped players
    maxRounds: 15 // Practical limit
  }

  private readonly DEFAULT_ROUNDS = 7 // Standard Swiss tournament length

  async generateBracket(
    tournament: Tournament,
    teams: Team[],
    options: BracketGenerationOptions
  ): Promise<BracketResult> {
    // Validate input
    const validation = this.validateInput(tournament, teams)
    if (!validation.isValid) {
      throw new Error(`Invalid input for Swiss system: ${validation.errors.join(', ')}`)
    }

    const rounds = this.calculateOptimalRounds(teams.length)
    
    // Generate first round pairings only
    const firstRoundMatches = this.generateFirstRoundMatches(tournament, teams)
    const bracketStructure = this.generateInitialBracketStructure(teams, rounds)

    const totalMatches = this.calculateTotalMatches(teams.length, rounds)

    const metadata: BracketMetadata = {
      format: 'Swiss System',
      totalRounds: rounds,
      totalMatches,
      estimatedDuration: this.estimateDuration(tournament, totalMatches),
      minPlayers: this.constraints.minTeams,
      maxPlayers: this.constraints.maxTeams!,
      supportsByes: true,
      supportsConsolation: false
    }

    return {
      matches: firstRoundMatches,
      bracketStructure,
      metadata,
      seededTeams: teams
    }
  }

  async updateProgression(
    completedMatch: Match,
    tournament: Tournament,
    allMatches: Match[]
  ): Promise<ProgressionResult> {
    const affectedMatches: Match[] = [completedMatch]
    let newMatches: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[] = []

    // Check if round is complete and generate next round
    const currentRound = completedMatch.round
    const isRoundComplete = this.isRoundComplete(currentRound, allMatches)
    
    if (isRoundComplete) {
      const totalRounds = this.calculateOptimalRounds(this.extractAllTeams(allMatches).length)
      const nextRound = currentRound + 1
      
      if (nextRound <= totalRounds) {
        // Generate next round pairings
        const standings = await this.calculateCurrentStandings(tournament, allMatches)
        const nextRoundMatches = await this.generateNextRoundPairings(
          tournament,
          standings,
          nextRound,
          allMatches
        )
        newMatches = nextRoundMatches
      }
    }

    const isComplete = this.isComplete(tournament, allMatches.concat(newMatches as Match[]))
    let finalRankings: TeamRanking[] | undefined

    if (isComplete) {
      const standings = await this.calculateStandings(tournament, allMatches)
      finalRankings = standings.rankings
    }

    const updatedBracketStructure = this.updateBracketStructure(
      allMatches.concat(newMatches as Match[])
    )

    return {
      affectedMatches,
      newMatches,
      updatedBracketStructure,
      isComplete,
      finalRankings
    }
  }

  async calculateStandings(
    tournament: Tournament,
    matches: Match[]
  ): Promise<Standings> {
    const teamStats = this.calculateTeamStats(matches)
    
    // Calculate tiebreakers
    this.calculateBuchholz(teamStats, matches)
    this.calculateSonnebornBerger(teamStats, matches)

    // Convert to rankings
    const rankings: TeamRanking[] = Array.from(teamStats.values()).map(stats => ({
      rank: 0, // Will be calculated below
      team: stats.team,
      wins: stats.wins,
      losses: stats.losses,
      points: stats.points,
      pointsDifferential: this.calculatePointsDifferential(stats.team, matches),
      tieBreaker: stats.buchholz
    }))

    // Sort with Swiss system tie-breaking rules
    rankings.sort((a, b) => {
      const statsA = teamStats.get(a.team.id)!
      const statsB = teamStats.get(b.team.id)!

      // Primary: Tournament points
      if (statsA.points !== statsB.points) {
        return statsB.points - statsA.points
      }

      // Secondary: Buchholz score (sum of opponents' scores)
      if (statsA.buchholz !== statsB.buchholz) {
        return statsB.buchholz - statsA.buchholz
      }

      // Tertiary: Sonneborn-Berger score
      if (statsA.sonnebornBerger !== statsB.sonnebornBerger) {
        return statsB.sonnebornBerger - statsA.sonnebornBerger
      }

      // Quaternary: Points differential
      if (a.pointsDifferential !== b.pointsDifferential) {
        return b.pointsDifferential - a.pointsDifferential
      }

      // Final: Number of wins (in case of draws)
      return statsB.wins - statsA.wins
    })

    // Assign ranks
    rankings.forEach((ranking, index) => {
      ranking.rank = index + 1
    })

    return {
      rankings,
      tieBreakers: [
        { method: 'points-differential', description: 'Tournament points' },
        { method: 'buchholz', description: 'Buchholz score (opponents\' total scores)' },
        { method: 'sonneborn-berger', description: 'Sonneborn-Berger score' },
        { method: 'points-against', description: 'Points differential' },
        { method: 'head-to-head', description: 'Number of wins' }
      ],
      metadata: {
        lastUpdated: new Date().toISOString(),
        totalMatches: matches.length,
        completedMatches: matches.filter(m => m.status === 'completed').length,
        pendingMatches: matches.filter(m => m.status === 'scheduled' || m.status === 'active').length
      }
    }
  }

  isComplete(tournament: Tournament, matches: Match[]): boolean {
    const totalRounds = this.calculateOptimalRounds(this.extractAllTeams(matches).length)
    const completedRounds = Math.max(...matches.map(m => m.round))
    
    return completedRounds >= totalRounds && 
           matches.filter(m => m.round === completedRounds).every(m => 
             m.status === 'completed' || m.status === 'cancelled'
           )
  }

  private calculateOptimalRounds(teamCount: number): number {
    // Standard formula: ceil(log2(n)) but with practical considerations
    const idealRounds = Math.ceil(Math.log2(teamCount))
    
    // For smaller tournaments, use more rounds for better differentiation
    if (teamCount <= 8) return Math.min(teamCount - 1, 7)
    if (teamCount <= 16) return Math.max(idealRounds, 5)
    if (teamCount <= 32) return Math.max(idealRounds, 6)
    
    // For larger tournaments, cap at reasonable number
    return Math.min(idealRounds, this.DEFAULT_ROUNDS)
  }

  private generateFirstRoundMatches(
    tournament: Tournament,
    teams: Team[]
  ): Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[] {
    const matches: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[] = []
    
    // First round: random or seeded pairings
    const shuffledTeams = [...teams]
    
    // If teams have rankings, do seeded pairings
    const hasRankings = teams.some(team => 
      team.players.some(player => player.ranking)
    )
    
    if (hasRankings) {
      // Sort by average ranking for seeded first round
      shuffledTeams.sort((a, b) => this.getTeamRanking(a) - this.getTeamRanking(b))
    } else {
      // Random pairings for first round
      this.shuffleArray(shuffledTeams)
    }

    // Create pairings
    let byeTeam: Team | undefined
    const pairingTeams = [...shuffledTeams]
    
    if (pairingTeams.length % 2 === 1) {
      byeTeam = pairingTeams.pop() // Last team gets bye
    }

    for (let i = 0; i < pairingTeams.length; i += 2) {
      const match: Omit<Match, 'id' | 'createdAt' | 'updatedAt'> = {
        tournamentId: tournament.id,
        round: 1,
        roundName: 'Swiss Round 1',
        bracketType: 'winner',
        team1: pairingTeams[i],
        team2: pairingTeams[i + 1],
        score: { team1: 0, team2: 0, isComplete: false },
        status: 'scheduled',
        ends: []
      }
      matches.push(match)
    }

    // Handle bye if needed
    if (byeTeam) {
      const byeMatch: Omit<Match, 'id' | 'createdAt' | 'updatedAt'> = {
        tournamentId: tournament.id,
        round: 1,
        roundName: 'Swiss Round 1',
        bracketType: 'winner',
        team1: byeTeam,
        team2: this.createByeTeam(byeTeam),
        score: { team1: tournament.maxPoints, team2: 0, isComplete: true },
        status: 'completed',
        winner: byeTeam.id,
        ends: []
      }
      matches.push(byeMatch)
    }

    return matches
  }

  private async generateNextRoundPairings(
    tournament: Tournament,
    standings: Standings,
    round: number,
    previousMatches: Match[]
  ): Promise<Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[]> {
    const teamStats = this.calculateTeamStats(previousMatches)
    const pairingOptions: PairingOptions = {
      avoidRematches: true,
      balanceColors: true,
      strengthBased: true,
      randomization: 0.1 // Small amount of randomness
    }

    const pairingResult = this.generatePairings(
      Array.from(teamStats.values()),
      pairingOptions,
      previousMatches
    )

    const matches: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[] = []

    // Create matches from pairings
    pairingResult.pairings.forEach(pairing => {
      const match: Omit<Match, 'id' | 'createdAt' | 'updatedAt'> = {
        tournamentId: tournament.id,
        round,
        roundName: `Swiss Round ${round}`,
        bracketType: 'winner',
        team1: pairing.team1,
        team2: pairing.team2,
        score: { team1: 0, team2: 0, isComplete: false },
        status: 'scheduled',
        ends: []
      }
      matches.push(match)
    })

    // Handle bye if needed
    if (pairingResult.byeTeam) {
      const byeMatch: Omit<Match, 'id' | 'createdAt' | 'updatedAt'> = {
        tournamentId: tournament.id,
        round,
        roundName: `Swiss Round ${round}`,
        bracketType: 'winner',
        team1: pairingResult.byeTeam,
        team2: this.createByeTeam(pairingResult.byeTeam),
        score: { team1: tournament.maxPoints, team2: 0, isComplete: true },
        status: 'completed',
        winner: pairingResult.byeTeam.id,
        ends: []
      }
      matches.push(byeMatch)
    }

    return matches
  }

  private generatePairings(
    teamStats: SwissTeamStats[],
    options: PairingOptions,
    previousMatches: Match[]
  ): PairingResult {
    // Sort teams by current standings
    const sortedTeams = [...teamStats].sort((a, b) => {
      if (a.points !== b.points) return b.points - a.points
      if (a.buchholz !== b.buchholz) return b.buchholz - a.buchholz
      return b.sonnebornBerger - a.sonnebornBerger
    })

    const pairings: TeamPairing[] = []
    const unpaired: Team[] = []
    const paired = new Set<string>()
    let byeTeam: Team | undefined

    // Handle odd number of teams
    if (sortedTeams.length % 2 === 1) {
      // Give bye to lowest-ranked team who hasn't had one
      byeTeam = this.findByeCandidate(sortedTeams, previousMatches)
      if (byeTeam) {
        paired.add(byeTeam.team.id)
      }
    }

    // Main pairing algorithm
    for (let i = 0; i < sortedTeams.length; i++) {
      const team1Stats = sortedTeams[i]
      if (paired.has(team1Stats.team.id)) continue

      let bestOpponent: SwissTeamStats | undefined
      let bestScore = -1

      for (let j = i + 1; j < sortedTeams.length; j++) {
        const team2Stats = sortedTeams[j]
        if (paired.has(team2Stats.team.id)) continue

        // Check if pairing is valid
        if (options.avoidRematches && team1Stats.opponents.has(team2Stats.team.id)) {
          continue // Skip if they've played before
        }

        // Calculate pairing score
        const score = this.calculatePairingScore(team1Stats, team2Stats, options)
        if (score > bestScore) {
          bestScore = score
          bestOpponent = team2Stats
        }
      }

      if (bestOpponent) {
        pairings.push({
          team1: team1Stats.team,
          team2: bestOpponent.team,
          expectedResult: this.calculateExpectedResult(team1Stats, bestOpponent),
          round: 0 // Will be set by caller
        })
        paired.add(team1Stats.team.id)
        paired.add(bestOpponent.team.id)
      } else {
        unpaired.push(team1Stats.team)
      }
    }

    return { pairings, unpaired, byeTeam }
  }

  private calculatePairingScore(
    team1: SwissTeamStats,
    team2: SwissTeamStats,
    options: PairingOptions
  ): number {
    let score = 0

    // Prefer similar scores (strength-based pairing)
    if (options.strengthBased) {
      const scoreDiff = Math.abs(team1.points - team2.points)
      score += (10 - scoreDiff) * 10 // Higher score for closer point totals
    }

    // Color balance bonus
    if (options.balanceColors) {
      const colorBalance = Math.abs(
        (team1.colors.white - team1.colors.black) -
        (team2.colors.white - team2.colors.black)
      )
      score += (5 - colorBalance) * 5
    }

    // Small random component if requested
    if (options.randomization && options.randomization > 0) {
      score += Math.random() * options.randomization * 10
    }

    return score
  }

  private calculateExpectedResult(
    team1: SwissTeamStats,
    team2: SwissTeamStats
  ): number {
    // Simple expected result based on current points
    const pointDiff = team1.points - team2.points
    if (pointDiff === 0) return 0.5
    return pointDiff > 0 ? 0.6 : 0.4
  }

  private findByeCandidate(
    sortedTeams: SwissTeamStats[],
    previousMatches: Match[]
  ): SwissTeamStats | undefined {
    // Find team with lowest score who hasn't had a bye
    const byeCounts = this.countByes(previousMatches)
    
    for (let i = sortedTeams.length - 1; i >= 0; i--) {
      const team = sortedTeams[i]
      const byeCount = byeCounts.get(team.team.id) || 0
      if (byeCount === 0) {
        return team
      }
    }
    
    // If everyone has had a bye, give it to lowest score
    return sortedTeams[sortedTeams.length - 1]
  }

  private countByes(matches: Match[]): Map<string, number> {
    const byeCounts = new Map<string, number>()
    
    matches.forEach(match => {
      if (match.team2.isBye) {
        const teamId = match.team1.id
        byeCounts.set(teamId, (byeCounts.get(teamId) || 0) + 1)
      }
    })
    
    return byeCounts
  }

  private calculateTeamStats(matches: Match[]): Map<string, SwissTeamStats> {
    const stats = new Map<string, SwissTeamStats>()
    const allTeams = this.extractAllTeams(matches)

    // Initialize stats
    allTeams.forEach(team => {
      stats.set(team.id, {
        team,
        points: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        buchholz: 0,
        sonnebornBerger: 0,
        opponents: new Set(),
        colors: { white: 0, black: 0 }
      })
    })

    // Process completed matches
    const completedMatches = matches.filter(m => m.status === 'completed')
    completedMatches.forEach(match => {
      const team1Stats = stats.get(match.team1.id)
      const team2Stats = stats.get(match.team2.id)

      if (team1Stats && team2Stats && match.score) {
        // Track opponents
        if (!match.team2.isBye) {
          team1Stats.opponents.add(match.team2.id)
          team2Stats.opponents.add(match.team1.id)
        }

        // Update scores and wins/losses
        const team1Score = match.score.team1
        const team2Score = match.score.team2

        if (team1Score > team2Score) {
          team1Stats.wins++
          team1Stats.points += 1
          team2Stats.losses++
        } else if (team2Score > team1Score) {
          team2Stats.wins++
          team2Stats.points += 1
          team1Stats.losses++
        } else {
          team1Stats.draws++
          team1Stats.points += 0.5
          team2Stats.draws++
          team2Stats.points += 0.5
        }

        // Update color tracking (simplified - in practice this would be more sophisticated)
        team1Stats.colors.white++
        team2Stats.colors.black++
      }
    })

    return stats
  }

  private calculateBuchholz(
    teamStats: Map<string, SwissTeamStats>,
    matches: Match[]
  ): void {
    teamStats.forEach(stats => {
      let buchholzSum = 0
      stats.opponents.forEach(opponentId => {
        const opponentStats = teamStats.get(opponentId)
        if (opponentStats) {
          buchholzSum += opponentStats.points
        }
      })
      stats.buchholz = buchholzSum
    })
  }

  private calculateSonnebornBerger(
    teamStats: Map<string, SwissTeamStats>,
    matches: Match[]
  ): void {
    const completedMatches = matches.filter(m => m.status === 'completed')
    
    teamStats.forEach(stats => {
      let sbSum = 0
      
      completedMatches.forEach(match => {
        const isTeam1 = match.team1.id === stats.team.id
        const isTeam2 = match.team2.id === stats.team.id
        
        if (isTeam1 || isTeam2) {
          const opponentId = isTeam1 ? match.team2.id : match.team1.id
          const opponentStats = teamStats.get(opponentId)
          
          if (opponentStats && match.score) {
            const teamScore = isTeam1 ? match.score.team1 : match.score.team2
            const opponentScore = isTeam1 ? match.score.team2 : match.score.team1
            
            if (teamScore > opponentScore) {
              // Win: add opponent's total points
              sbSum += opponentStats.points
            } else if (teamScore === opponentScore) {
              // Draw: add half of opponent's points
              sbSum += opponentStats.points * 0.5
            }
            // Loss: add nothing
          }
        }
      })
      
      stats.sonnebornBerger = sbSum
    })
  }

  private async calculateCurrentStandings(
    tournament: Tournament,
    matches: Match[]
  ): Promise<Standings> {
    return this.calculateStandings(tournament, matches)
  }

  private isRoundComplete(round: number, matches: Match[]): boolean {
    const roundMatches = matches.filter(m => m.round === round)
    return roundMatches.length > 0 && 
           roundMatches.every(m => m.status === 'completed' || m.status === 'cancelled')
  }

  private generateInitialBracketStructure(teams: Team[], rounds: number): BracketNode[] {
    const nodes: BracketNode[] = []
    
    // Swiss system doesn't have a traditional bracket structure
    // We'll create nodes for visualization purposes
    for (let round = 1; round <= rounds; round++) {
      const node: BracketNode = {
        id: `swiss-round-${round}`,
        round,
        position: 1,
        bracketType: 'winner'
      }
      nodes.push(node)
    }
    
    return nodes
  }

  private updateBracketStructure(matches: Match[]): BracketNode[] {
    const nodes: BracketNode[] = []
    const rounds = new Set(matches.map(m => m.round))
    
    rounds.forEach(round => {
      const roundMatches = matches.filter(m => m.round === round)
      roundMatches.forEach((match, index) => {
        const node: BracketNode = {
          id: `swiss-${round}-${index + 1}`,
          matchId: match.id,
          team1: match.team1,
          team2: match.team2,
          winner: match.winner,
          round,
          position: index + 1,
          bracketType: 'winner'
        }
        nodes.push(node)
      })
    })
    
    return nodes
  }

  private calculateTotalMatches(teamCount: number, rounds: number): number {
    // In Swiss system, each round has ~n/2 matches
    return Math.floor(teamCount / 2) * rounds
  }

  private extractAllTeams(matches: Match[]): Team[] {
    const teamSet = new Set<string>()
    const teams: Team[] = []
    
    matches.forEach(match => {
      if (match.team1.id && !teamSet.has(match.team1.id) && !match.team1.isBye) {
        teamSet.add(match.team1.id)
        teams.push(match.team1)
      }
      if (match.team2.id && !teamSet.has(match.team2.id) && !match.team2.isBye) {
        teamSet.add(match.team2.id)
        teams.push(match.team2)
      }
    })
    
    return teams
  }

  private getTeamRanking(team: Team): number {
    if (team.players.length === 0) return 9999
    
    const totalRanking = team.players.reduce((sum, player) => {
      return sum + (player.ranking || 9999)
    }, 0)
    
    return totalRanking / team.players.length
  }

  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[array[i], array[j]] = [array[j], array[i]]
    }
  }

  private calculatePointsDifferential(team: Team, matches: Match[]): number {
    return matches
      .filter(m => m.team1.id === team.id || m.team2.id === team.id)
      .reduce((total, match) => {
        if (match.team1.id === team.id) {
          return total + (match.score?.team1 || 0) - (match.score?.team2 || 0)
        } else if (match.team2.id === team.id) {
          return total + (match.score?.team2 || 0) - (match.score?.team1 || 0)
        }
        return total
      }, 0)
  }
}