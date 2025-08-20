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

export class SingleEliminationHandler extends BaseFormatHandler {
  readonly formatType: TournamentType = 'single-elimination'
  readonly constraints: FormatConstraints = {
    minTeams: 2,
    maxTeams: 1024, // Practical limit
    preferredTeamCounts: [4, 8, 16, 32, 64, 128, 256], // Powers of 2
    supportsOddTeamCount: true,
    supportsByes: true,
    maxRounds: 10 // log2(1024)
  }

  async generateBracket(
    tournament: Tournament,
    teams: Team[],
    options: BracketGenerationOptions
  ): Promise<BracketResult> {
    // Validate input
    const validation = this.validateInput(tournament, teams)
    if (!validation.isValid) {
      throw new Error(`Invalid input for single elimination: ${validation.errors.join(', ')}`)
    }

    // Calculate bracket size (next power of 2)
    const bracketSize = this.calculateBracketSize(teams.length)
    const totalRounds = this.calculateEliminationRounds(bracketSize)

    // Handle byes if needed
    const { teams: participatingTeams, byes: byeTeams } = this.assignByes(teams, bracketSize)

    // Generate all bracket nodes
    const bracketStructure = this.generateBracketStructure(bracketSize, totalRounds)

    // Generate matches for all rounds
    const matches = this.generateMatches(
      tournament,
      participatingTeams,
      byeTeams,
      bracketStructure,
      totalRounds
    )

    // Assign teams to first round matches
    this.assignTeamsToMatches(matches, participatingTeams, byeTeams)

    const metadata: BracketMetadata = {
      format: 'Single Elimination',
      totalRounds,
      totalMatches: matches.length,
      estimatedDuration: this.estimateDuration(tournament, matches.length),
      minPlayers: this.constraints.minTeams,
      maxPlayers: bracketSize,
      supportsByes: true,
      supportsConsolation: false
    }

    return {
      matches,
      bracketStructure,
      metadata,
      seededTeams: teams,
      byeTeams: byeTeams.length > 0 ? byeTeams : undefined
    }
  }

  async updateProgression(
    completedMatch: Match,
    tournament: Tournament,
    allMatches: Match[]
  ): Promise<ProgressionResult> {
    const affectedMatches: Match[] = [completedMatch]
    const newMatches: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[] = []
    let updatedBracketStructure: BracketNode[] = []

    if (completedMatch.status !== 'completed' || !completedMatch.winner) {
      return {
        affectedMatches,
        newMatches,
        updatedBracketStructure,
        isComplete: false
      }
    }

    // Find the winning team
    const winnerTeam = completedMatch.team1.id === completedMatch.winner 
      ? completedMatch.team1 
      : completedMatch.team2

    // Find next round match
    const nextRoundMatch = this.findNextRoundMatch(completedMatch, allMatches)

    if (nextRoundMatch) {
      // Advance winner to next round
      const updatedMatch = this.advanceWinner(nextRoundMatch, winnerTeam, completedMatch)
      affectedMatches.push(updatedMatch)
    }

    // Check if tournament is complete
    const isComplete = this.isComplete(tournament, allMatches)
    let finalRankings: TeamRanking[] | undefined

    if (isComplete) {
      finalRankings = await this.generateFinalRankings(tournament, allMatches)
    }

    // Update bracket structure
    updatedBracketStructure = this.updateBracketStructure(allMatches)

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
    const teamStats = new Map<string, {
      team: Team
      wins: number
      losses: number
      matches: number
      eliminated: boolean
      currentRound: number
    }>()

    // Initialize all teams
    const allTeams = this.extractAllTeams(matches)
    allTeams.forEach(team => {
      teamStats.set(team.id, {
        team,
        wins: 0,
        losses: 0,
        matches: 0,
        eliminated: false,
        currentRound: 1
      })
    })

    // Process completed matches
    const completedMatches = matches.filter(m => m.status === 'completed')
    completedMatches.forEach(match => {
      if (match.winner && match.team1.id && match.team2.id) {
        const winnerStats = teamStats.get(match.winner)
        const loserTeam = match.team1.id === match.winner ? match.team2 : match.team1
        const loserStats = teamStats.get(loserTeam.id)

        if (winnerStats && loserStats) {
          winnerStats.wins++
          winnerStats.matches++
          winnerStats.currentRound = Math.max(winnerStats.currentRound, match.round + 1)

          loserStats.losses++
          loserStats.matches++
          loserStats.eliminated = true
        }
      }
    })

    // Convert to rankings
    const rankings: TeamRanking[] = Array.from(teamStats.values()).map((stats, index) => ({
      rank: 0, // Will be calculated below
      team: stats.team,
      wins: stats.wins,
      losses: stats.losses,
      points: this.calculateTeamPoints(stats.team, completedMatches),
      pointsDifferential: this.calculatePointsDifferential(stats.team, completedMatches),
      tieBreaker: stats.currentRound
    }))

    // Sort rankings (higher rounds = better, then by wins, then by points differential)
    rankings.sort((a, b) => {
      if (a.tieBreaker !== b.tieBreaker) {
        return b.tieBreaker - a.tieBreaker
      }
      if (a.wins !== b.wins) {
        return b.wins - a.wins
      }
      return b.pointsDifferential - a.pointsDifferential
    })

    // Assign ranks
    rankings.forEach((ranking, index) => {
      ranking.rank = index + 1
    })

    return {
      rankings,
      tieBreakers: [
        { method: 'head-to-head', description: 'Current tournament round' },
        { method: 'points-differential', description: 'Total wins in tournament' },
        { method: 'points-against', description: 'Points differential' }
      ],
      metadata: {
        lastUpdated: new Date().toISOString(),
        totalMatches: matches.length,
        completedMatches: completedMatches.length,
        pendingMatches: matches.filter(m => m.status === 'scheduled' || m.status === 'active').length
      }
    }
  }

  isComplete(tournament: Tournament, matches: Match[]): boolean {
    const completedMatches = matches.filter(m => m.status === 'completed')
    const finalMatch = matches.find(m => this.isFinalMatch(m, matches))
    
    return finalMatch ? finalMatch.status === 'completed' : false
  }

  private calculateBracketSize(teamCount: number): number {
    return Math.pow(2, Math.ceil(Math.log2(teamCount)))
  }

  private generateBracketStructure(bracketSize: number, totalRounds: number): BracketNode[] {
    const nodes: BracketNode[] = []

    for (let round = 1; round <= totalRounds; round++) {
      const matchesInRound = bracketSize / Math.pow(2, round)
      
      for (let position = 1; position <= matchesInRound; position++) {
        const node: BracketNode = {
          id: `se-${round}-${position}`,
          round,
          position,
          bracketType: 'winner',
          children: round > 1 ? [
            `se-${round - 1}-${(position - 1) * 2 + 1}`,
            `se-${round - 1}-${(position - 1) * 2 + 2}`
          ] : undefined
        }
        nodes.push(node)
      }
    }

    return nodes
  }

  private generateMatches(
    tournament: Tournament,
    teams: Team[],
    byes: Team[],
    bracketStructure: BracketNode[],
    totalRounds: number
  ): Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[] {
    const matches: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[] = []

    for (let round = 1; round <= totalRounds; round++) {
      const roundNodes = bracketStructure.filter(node => node.round === round)
      
      roundNodes.forEach((node, index) => {
        const match: Omit<Match, 'id' | 'createdAt' | 'updatedAt'> = {
          tournamentId: tournament.id,
          round,
          roundName: this.getRoundName(round, totalRounds),
          bracketType: 'winner',
          team1: {} as Team, // Will be assigned later
          team2: {} as Team, // Will be assigned later
          score: { team1: 0, team2: 0, isComplete: false },
          status: round === 1 ? 'scheduled' : 'scheduled',
          ends: []
        }
        matches.push(match)
      })
    }

    return matches
  }

  private assignTeamsToMatches(
    matches: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[],
    teams: Team[],
    byes: Team[]
  ): void {
    const firstRoundMatches = matches.filter(m => m.round === 1)
    
    // Assign teams to first round matches
    for (let i = 0; i < firstRoundMatches.length && i * 2 < teams.length; i++) {
      const match = firstRoundMatches[i]
      match.team1 = teams[i * 2]
      
      if (i * 2 + 1 < teams.length) {
        match.team2 = teams[i * 2 + 1]
      } else {
        // This should not happen if byes are handled correctly
        match.team2 = this.createByeTeam(teams[i * 2])
      }
    }

    // Handle bye advancement automatically
    byes.forEach(byeTeam => {
      // Find the match where this team should advance to round 2
      const nextRoundMatch = this.findByeAdvancementMatch(byeTeam, matches)
      if (nextRoundMatch) {
        if (!nextRoundMatch.team1.id) {
          nextRoundMatch.team1 = byeTeam
        } else if (!nextRoundMatch.team2.id) {
          nextRoundMatch.team2 = byeTeam
        }
      }
    })
  }

  private findNextRoundMatch(
    completedMatch: Match,
    allMatches: Match[]
  ): Match | undefined {
    const nextRound = completedMatch.round + 1
    const nextRoundMatches = allMatches.filter(m => m.round === nextRound)
    
    // In single elimination, each match feeds into a specific next round match
    // The position in the current round determines the next match
    const currentPosition = this.getMatchPositionInRound(completedMatch, allMatches)
    const nextPosition = Math.ceil(currentPosition / 2)
    
    return nextRoundMatches.find(m => 
      this.getMatchPositionInRound(m, allMatches) === nextPosition
    )
  }

  private advanceWinner(
    nextRoundMatch: Match,
    winner: Team,
    completedMatch: Match
  ): Match {
    // Determine which position the winner should take in the next match
    const updatedMatch = { ...nextRoundMatch }
    
    if (!updatedMatch.team1.id) {
      updatedMatch.team1 = winner
    } else if (!updatedMatch.team2.id) {
      updatedMatch.team2 = winner
    }
    
    return updatedMatch
  }

  private updateBracketStructure(matches: Match[]): BracketNode[] {
    // Update bracket structure with current match results
    const nodes: BracketNode[] = []
    
    matches.forEach(match => {
      const node: BracketNode = {
        id: `se-${match.round}-${this.getMatchPositionInRound(match, matches)}`,
        matchId: match.id,
        team1: match.team1,
        team2: match.team2,
        winner: match.winner,
        round: match.round,
        position: this.getMatchPositionInRound(match, matches),
        bracketType: 'winner'
      }
      nodes.push(node)
    })
    
    return nodes
  }

  private getMatchPositionInRound(match: Match, allMatches: Match[]): number {
    const roundMatches = allMatches
      .filter(m => m.round === match.round)
      .sort((a, b) => (a.id || '').localeCompare(b.id || ''))
    
    return roundMatches.findIndex(m => m.id === match.id) + 1
  }

  private isFinalMatch(match: Match, allMatches: Match[]): boolean {
    const maxRound = Math.max(...allMatches.map(m => m.round))
    return match.round === maxRound
  }

  private findByeAdvancementMatch(
    byeTeam: Team,
    matches: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[]
  ): Omit<Match, 'id' | 'createdAt' | 'updatedAt'> | undefined {
    // Find the round 2 match where this bye team should advance
    const round2Matches = matches.filter(m => m.round === 2)
    return round2Matches.find(m => !m.team1.id || !m.team2.id)
  }

  private extractAllTeams(matches: Match[]): Team[] {
    const teamSet = new Set<string>()
    const teams: Team[] = []
    
    matches.forEach(match => {
      if (match.team1.id && !teamSet.has(match.team1.id)) {
        teamSet.add(match.team1.id)
        teams.push(match.team1)
      }
      if (match.team2.id && !teamSet.has(match.team2.id)) {
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

  private async generateFinalRankings(
    tournament: Tournament,
    matches: Match[]
  ): Promise<TeamRanking[]> {
    const standings = await this.calculateStandings(tournament, matches)
    return standings.rankings
  }
}