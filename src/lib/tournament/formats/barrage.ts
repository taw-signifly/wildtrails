import { Tournament, Team, Match, TournamentType } from '@/types'
import type { BracketNode } from '@/lib/actions/bracket-management'
import { BaseFormatHandler } from './base'
import { 
  BracketResult, 
  ProgressionResult, 
  Standings, 
  FormatConstraints,
  BracketGenerationOptions,
  TeamRanking,
  BracketMetadata
} from '../types'

interface BarrageTeamStatus {
  team: Team
  wins: number
  losses: number
  status: 'active' | 'qualified' | 'eliminated'
  currentMatch?: string
}

export class BarrageHandler extends BaseFormatHandler {
  readonly formatType: TournamentType = 'barrage'
  readonly constraints: FormatConstraints = {
    minTeams: 4,
    maxTeams: 100, // Practical limit for barrage
    preferredTeamCounts: [], // Any number works
    supportsOddTeamCount: true,
    supportsByes: true, // For odd numbers
    maxRounds: 10 // Theoretical max, depends on tournament size
  }

  private readonly WINS_TO_QUALIFY = 2
  private readonly LOSSES_TO_ELIMINATE = 2

  async generateBracket(
    tournament: Tournament,
    teams: Team[],
    _options: BracketGenerationOptions
  ): Promise<BracketResult> {
    // Validate input
    const validation = this.validateInput(tournament, teams)
    if (!validation.isValid) {
      throw new Error(`Invalid input for barrage: ${validation.errors.join(', ')}`)
    }

    // Initialize first round matches
    const firstRoundMatches = this.generateFirstRoundMatches(tournament, teams)
    const bracketStructure = this.generateInitialBracketStructure(teams)

    const estimatedMatches = this.estimateBarrageMatches(teams.length)

    const metadata: BracketMetadata = {
      format: 'Barrage Qualification',
      totalRounds: this.estimateMaxRounds(teams.length),
      totalMatches: estimatedMatches,
      estimatedDuration: this.estimateDuration(tournament, estimatedMatches),
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

    // Update team statuses based on completed match
    const teamStatuses = this.calculateTeamStatuses(allMatches)
    
    // Generate new matches for teams that need them
    const pendingMatches = this.generatePendingMatches(
      tournament,
      teamStatuses,
      allMatches
    )
    newMatches = pendingMatches

    const isComplete = this.isComplete(tournament, allMatches.concat(newMatches as Match[]))
    let finalRankings: TeamRanking[] | undefined

    if (isComplete) {
      finalRankings = await this.generateFinalRankings(tournament, teamStatuses)
    }

    const updatedBracketStructure = this.updateBracketStructure(
      allMatches.concat(newMatches as Match[]),
      teamStatuses
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
    const teamStatuses = this.calculateTeamStatuses(matches)
    
    // Convert to rankings
    const rankings: TeamRanking[] = Array.from(teamStatuses.values()).map(status => ({
      rank: 0, // Will be calculated below
      team: status.team,
      wins: status.wins,
      losses: status.losses,
      points: this.calculateTeamPoints(status.team, matches),
      pointsDifferential: this.calculatePointsDifferential(status.team, matches),
      tieBreaker: this.calculateStatusScore(status)
    }))

    // Sort by barrage-specific criteria
    rankings.sort((a, b) => {
      const statusA = teamStatuses.get(a.team.id)!
      const statusB = teamStatuses.get(b.team.id)!

      // Primary: Status (qualified > active > eliminated)
      const statusScoreA = this.calculateStatusScore(statusA)
      const statusScoreB = this.calculateStatusScore(statusB)
      if (statusScoreA !== statusScoreB) {
        return statusScoreB - statusScoreA
      }

      // Secondary: Wins
      if (statusA.wins !== statusB.wins) {
        return statusB.wins - statusA.wins
      }

      // Tertiary: Fewer losses
      if (statusA.losses !== statusB.losses) {
        return statusA.losses - statusB.losses
      }

      // Quaternary: Points differential
      if (a.pointsDifferential !== b.pointsDifferential) {
        return b.pointsDifferential - a.pointsDifferential
      }

      // Final: Total points scored
      return b.points - a.points
    })

    // Assign ranks
    rankings.forEach((ranking, index) => {
      ranking.rank = index + 1
    })

    return {
      rankings,
      tieBreakers: [
        { method: 'head-to-head', description: 'Qualification status' },
        { method: 'points-differential', description: 'Number of wins' },
        { method: 'points-against', description: 'Number of losses' },
        { method: 'points-differential', description: 'Points differential' },
        { method: 'points-differential', description: 'Total points scored' }
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
    const teamStatuses = this.calculateTeamStatuses(matches)
    
    // Tournament is complete when all teams are either qualified or eliminated
    return Array.from(teamStatuses.values()).every(status => 
      status.status === 'qualified' || status.status === 'eliminated'
    )
  }

  private generateFirstRoundMatches(
    tournament: Tournament,
    teams: Team[]
  ): Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[] {
    const matches: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[] = []
    const shuffledTeams = [...teams]
    
    // Random pairings for first round
    this.shuffleArray(shuffledTeams)

    let byeTeam: Team | undefined
    const pairingTeams = [...shuffledTeams]
    
    if (pairingTeams.length % 2 === 1) {
      byeTeam = pairingTeams.pop() // Last team gets bye
    }

    // Create first round matches
    for (let i = 0; i < pairingTeams.length; i += 2) {
      const match: Omit<Match, 'id' | 'createdAt' | 'updatedAt'> = {
        tournamentId: tournament.id,
        round: 1,
        roundName: 'Barrage Round 1',
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
        roundName: 'Barrage Round 1',
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

  private calculateTeamStatuses(matches: Match[]): Map<string, BarrageTeamStatus> {
    const statuses = new Map<string, BarrageTeamStatus>()
    const allTeams = this.extractAllTeams(matches)

    // Initialize statuses
    allTeams.forEach(team => {
      statuses.set(team.id, {
        team,
        wins: 0,
        losses: 0,
        status: 'active'
      })
    })

    // Process completed matches
    const completedMatches = matches.filter(m => m.status === 'completed')
    completedMatches.forEach(match => {
      if (match.winner && match.team1.id && match.team2.id) {
        const winnerStatus = statuses.get(match.winner)
        const loserTeam = match.team1.id === match.winner ? match.team2 : match.team1
        const loserStatus = statuses.get(loserTeam.id)

        if (winnerStatus && loserStatus) {
          winnerStatus.wins++
          loserStatus.losses++

          // Update qualification status
          if (winnerStatus.wins >= this.WINS_TO_QUALIFY) {
            winnerStatus.status = 'qualified'
          }
          if (loserStatus.losses >= this.LOSSES_TO_ELIMINATE) {
            loserStatus.status = 'eliminated'
          }
        }
      }
    })

    // Check for teams currently in matches
    const activeMatches = matches.filter(m => m.status === 'active')
    activeMatches.forEach(match => {
      const team1Status = statuses.get(match.team1.id)
      const team2Status = statuses.get(match.team2.id)
      
      if (team1Status) team1Status.currentMatch = match.id
      if (team2Status) team2Status.currentMatch = match.id
    })

    return statuses
  }

  private generatePendingMatches(
    tournament: Tournament,
    teamStatuses: Map<string, BarrageTeamStatus>,
    existingMatches: Match[]
  ): Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[] {
    const newMatches: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[] = []
    
    // Find teams that need matches (active status and no current match)
    const availableTeams = Array.from(teamStatuses.values()).filter(status => 
      status.status === 'active' && !status.currentMatch
    )

    if (availableTeams.length < 2) {
      return newMatches // Not enough teams for new matches
    }

    // Group teams by their current record for better pairing
    const recordGroups = new Map<string, BarrageTeamStatus[]>()
    
    availableTeams.forEach(status => {
      const record = `${status.wins}-${status.losses}`
      if (!recordGroups.has(record)) {
        recordGroups.set(record, [])
      }
      recordGroups.get(record)!.push(status)
    })

    const currentRound = this.getCurrentRound(existingMatches) + 1

    // Create pairings within same record groups first
    recordGroups.forEach(teams => {
      this.shuffleArray(teams)
      
      for (let i = 0; i < teams.length - 1; i += 2) {
        const match: Omit<Match, 'id' | 'createdAt' | 'updatedAt'> = {
          tournamentId: tournament.id,
          round: currentRound,
          roundName: `Barrage Round ${currentRound}`,
          bracketType: 'winner',
          team1: teams[i].team,
          team2: teams[i + 1].team,
          score: { team1: 0, team2: 0, isComplete: false },
          status: 'scheduled',
          ends: []
        }
        newMatches.push(match)
        
        // Mark teams as having current match
        teams[i].currentMatch = 'pending'
        teams[i + 1].currentMatch = 'pending'
      }
    })

    // Handle remaining unpaired teams across record groups
    const unpairedTeams = availableTeams.filter(status => !status.currentMatch)
    
    if (unpairedTeams.length >= 2) {
      this.shuffleArray(unpairedTeams)
      
      for (let i = 0; i < unpairedTeams.length - 1; i += 2) {
        const match: Omit<Match, 'id' | 'createdAt' | 'updatedAt'> = {
          tournamentId: tournament.id,
          round: currentRound,
          roundName: `Barrage Round ${currentRound}`,
          bracketType: 'winner',
          team1: unpairedTeams[i].team,
          team2: unpairedTeams[i + 1].team,
          score: { team1: 0, team2: 0, isComplete: false },
          status: 'scheduled',
          ends: []
        }
        newMatches.push(match)
      }
    }

    // Handle final bye if odd number of unpaired teams
    if (unpairedTeams.length % 2 === 1) {
      const byeTeam = unpairedTeams[unpairedTeams.length - 1]
      const byeMatch: Omit<Match, 'id' | 'createdAt' | 'updatedAt'> = {
        tournamentId: tournament.id,
        round: currentRound,
        roundName: `Barrage Round ${currentRound}`,
        bracketType: 'winner',
        team1: byeTeam.team,
        team2: this.createByeTeam(byeTeam.team),
        score: { team1: tournament.maxPoints, team2: 0, isComplete: true },
        status: 'completed',
        winner: byeTeam.team.id,
        ends: []
      }
      newMatches.push(byeMatch)
    }

    return newMatches
  }

  private getCurrentRound(matches: Match[]): number {
    if (matches.length === 0) return 0
    return Math.max(...matches.map(m => m.round))
  }

  private generateInitialBracketStructure(teams: Team[]): BracketNode[] {
    const nodes: BracketNode[] = []
    
    // Barrage doesn't have a traditional bracket structure
    // Create nodes for visualization of the qualification process
    teams.forEach((team, index) => {
      const node: BracketNode = {
        id: `barrage-team-${team.id}`,
        team1: team,
        round: 1,
        position: index + 1,
        bracketType: 'winner'
      }
      nodes.push(node)
    })
    
    return nodes
  }

  private updateBracketStructure(
    matches: Match[],
    teamStatuses: Map<string, BarrageTeamStatus>
  ): BracketNode[] {
    const nodes: BracketNode[] = []
    
    // Create nodes showing current team statuses
    teamStatuses.forEach((status, teamId) => {
      const node: BracketNode = {
        id: `barrage-status-${teamId}`,
        team1: status.team,
        round: status.wins + status.losses + 1, // Current "round" for this team
        position: this.calculateStatusScore(status),
        bracketType: status.status === 'qualified' ? 'winner' : 
                     status.status === 'eliminated' ? 'loser' : 'winner'
      }
      nodes.push(node)
    })
    
    return nodes
  }

  private async generateFinalRankings(
    tournament: Tournament,
    teamStatuses: Map<string, BarrageTeamStatus>
  ): Promise<TeamRanking[]> {
    const qualifiedTeams: TeamRanking[] = []
    const eliminatedTeams: TeamRanking[] = []
    
    teamStatuses.forEach((status) => {
      const ranking: TeamRanking = {
        rank: 0, // Will be calculated
        team: status.team,
        wins: status.wins,
        losses: status.losses,
        points: 0, // Will be calculated
        pointsDifferential: 0, // Will be calculated
        tieBreaker: this.calculateStatusScore(status)
      }
      
      if (status.status === 'qualified') {
        qualifiedTeams.push(ranking)
      } else {
        eliminatedTeams.push(ranking)
      }
    })
    
    // Sort qualified teams (better records first)
    qualifiedTeams.sort((a, b) => {
      if (a.wins !== b.wins) return b.wins - a.wins
      if (a.losses !== b.losses) return a.losses - b.losses
      return b.pointsDifferential - a.pointsDifferential
    })
    
    // Sort eliminated teams (better records first among eliminated)
    eliminatedTeams.sort((a, b) => {
      if (a.wins !== b.wins) return b.wins - a.wins
      if (a.losses !== b.losses) return a.losses - b.losses
      return b.pointsDifferential - a.pointsDifferential
    })
    
    // Assign ranks
    const allRankings = [...qualifiedTeams, ...eliminatedTeams]
    allRankings.forEach((ranking, index) => {
      ranking.rank = index + 1
    })
    
    return allRankings
  }

  private calculateStatusScore(status: BarrageTeamStatus): number {
    // Higher score for better status
    switch (status.status) {
      case 'qualified': return 1000 + status.wins * 10 - status.losses
      case 'active': return 500 + status.wins * 10 - status.losses
      case 'eliminated': return status.wins * 10 - status.losses
      default: return 0
    }
  }

  private estimateBarrageMatches(teamCount: number): number {
    // Rough estimate: each team plays 2-4 matches on average
    return Math.ceil(teamCount * 2.5)
  }

  private estimateMaxRounds(teamCount: number): number {
    // In worst case, could take several rounds
    return Math.min(Math.ceil(teamCount / 2) + 2, 8)
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

  private calculateTeamPoints(team: Team, matches: Match[]): number {
    return matches
      .filter(m => m.team1.id === team.id || m.team2.id === team.id)
      .reduce((total, match) => {
        if (match.team1.id === team.id) {
          return total + (match.score?.team1 || 0)
        } else if (match.team2.id === team.id) {
          return total + (match.score?.team2 || 0)
        }
        return total
      }, 0)
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

  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[array[i], array[j]] = [array[j], array[i]]
    }
  }
}