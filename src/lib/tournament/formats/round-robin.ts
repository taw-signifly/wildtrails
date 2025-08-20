import { Tournament, Team, Match, BracketNode, TournamentType } from '@/types'
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

export class RoundRobinHandler extends BaseFormatHandler {
  readonly formatType: TournamentType = 'round-robin'
  readonly constraints: FormatConstraints = {
    minTeams: 3,
    maxTeams: 20, // Practical limit for single group
    preferredTeamCounts: [], // Any number works
    supportsOddTeamCount: true,
    supportsByes: false, // Not needed in round-robin
    maxRounds: 1 // All matches are effectively "round 1"
  }

  async generateBracket(
    tournament: Tournament,
    teams: Team[],
    options: BracketGenerationOptions
  ): Promise<BracketResult> {
    // Validate input
    const validation = this.validateInput(tournament, teams)
    if (!validation.isValid) {
      throw new Error(`Invalid input for round-robin: ${validation.errors.join(', ')}`)
    }

    // For large tournaments, consider multiple groups
    const useMultipleGroups = teams.length > 12
    const groups = useMultipleGroups ? this.divideIntoGroups(teams) : [teams]
    
    const allMatches: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[] = []
    const bracketStructure: BracketNode[] = []
    
    // Generate matches for each group
    groups.forEach((group, groupIndex) => {
      const groupMatches = this.generateGroupMatches(tournament, group, groupIndex)
      const groupNodes = this.generateGroupBracketStructure(group, groupIndex)
      
      allMatches.push(...groupMatches)
      bracketStructure.push(...groupNodes)
    })

    // Add cross-group playoff matches if multiple groups
    if (useMultipleGroups) {
      const playoffMatches = this.generatePlayoffMatches(tournament, groups)
      const playoffNodes = this.generatePlayoffBracketStructure(groups)
      
      allMatches.push(...playoffMatches)
      bracketStructure.push(...playoffNodes)
    }

    const totalMatches = this.calculateTotalMatches(teams.length, useMultipleGroups)

    const metadata: BracketMetadata = {
      format: useMultipleGroups ? 'Round-Robin with Playoffs' : 'Round-Robin',
      totalRounds: useMultipleGroups ? 2 : 1,
      totalMatches,
      estimatedDuration: this.estimateDuration(tournament, totalMatches),
      minPlayers: this.constraints.minTeams,
      maxPlayers: this.constraints.maxTeams!,
      supportsByes: false,
      supportsConsolation: false
    }

    return {
      matches: allMatches,
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
    const newMatches: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[] = []

    // In round-robin, match completion doesn't create new matches
    // unless we're dealing with playoffs after group stage
    
    const isGroupStageComplete = this.isGroupStageComplete(allMatches)
    const hasPlayoffs = this.hasPlayoffMatches(allMatches)
    
    if (isGroupStageComplete && hasPlayoffs) {
      // Check if we need to seed playoff matches
      const playoffMatches = allMatches.filter(m => m.roundName?.includes('Playoff'))
      const unseededPlayoffMatches = playoffMatches.filter(m => !m.team1.id || !m.team2.id)
      
      if (unseededPlayoffMatches.length > 0) {
        // Seed playoff matches based on group standings
        const groupStandings = await this.calculateGroupStandings(tournament, allMatches)
        this.seedPlayoffMatches(unseededPlayoffMatches, groupStandings)
        affectedMatches.push(...unseededPlayoffMatches)
      }
    }

    const isComplete = this.isComplete(tournament, allMatches)
    let finalRankings: TeamRanking[] | undefined

    if (isComplete) {
      const standings = await this.calculateStandings(tournament, allMatches)
      finalRankings = standings.rankings
    }

    const updatedBracketStructure = this.updateBracketStructure(allMatches)

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
      draws: number
      points: number
      goalsFor: number
      goalsAgainst: number
      goalDifferential: number
      headToHead: Map<string, { wins: number; losses: number; draws: number }>
    }>()

    // Initialize all teams
    const allTeams = this.extractAllTeams(matches)
    allTeams.forEach(team => {
      teamStats.set(team.id, {
        team,
        wins: 0,
        losses: 0,
        draws: 0,
        points: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifferential: 0,
        headToHead: new Map()
      })
    })

    // Process completed matches
    const completedMatches = matches.filter(m => m.status === 'completed')
    completedMatches.forEach(match => {
      const team1Stats = teamStats.get(match.team1.id)
      const team2Stats = teamStats.get(match.team2.id)

      if (team1Stats && team2Stats && match.score) {
        const team1Score = match.score.team1
        const team2Score = match.score.team2

        // Update goals
        team1Stats.goalsFor += team1Score
        team1Stats.goalsAgainst += team2Score
        team2Stats.goalsFor += team2Score
        team2Stats.goalsAgainst += team1Score

        // Update goal differential
        team1Stats.goalDifferential = team1Stats.goalsFor - team1Stats.goalsAgainst
        team2Stats.goalDifferential = team2Stats.goalsFor - team2Stats.goalsAgainst

        // Update wins/losses/draws and points
        if (team1Score > team2Score) {
          // Team 1 wins
          team1Stats.wins++
          team1Stats.points += 3 // 3 points for win
          team2Stats.losses++
          // Team 2 gets 0 points for loss
        } else if (team2Score > team1Score) {
          // Team 2 wins
          team2Stats.wins++
          team2Stats.points += 3 // 3 points for win
          team1Stats.losses++
          // Team 1 gets 0 points for loss
        } else {
          // Draw (though rare in Petanque)
          team1Stats.draws++
          team1Stats.points += 1 // 1 point for draw
          team2Stats.draws++
          team2Stats.points += 1 // 1 point for draw
        }

        // Update head-to-head records
        if (!team1Stats.headToHead.has(match.team2.id)) {
          team1Stats.headToHead.set(match.team2.id, { wins: 0, losses: 0, draws: 0 })
        }
        if (!team2Stats.headToHead.has(match.team1.id)) {
          team2Stats.headToHead.set(match.team1.id, { wins: 0, losses: 0, draws: 0 })
        }

        const team1H2H = team1Stats.headToHead.get(match.team2.id)!
        const team2H2H = team2Stats.headToHead.get(match.team1.id)!

        if (team1Score > team2Score) {
          team1H2H.wins++
          team2H2H.losses++
        } else if (team2Score > team1Score) {
          team2H2H.wins++
          team1H2H.losses++
        } else {
          team1H2H.draws++
          team2H2H.draws++
        }
      }
    })

    // Convert to rankings with tie-breaking
    const rankings: TeamRanking[] = Array.from(teamStats.values()).map(stats => ({
      rank: 0, // Will be calculated below
      team: stats.team,
      wins: stats.wins,
      losses: stats.losses,
      points: stats.points,
      pointsDifferential: stats.goalDifferential,
      tieBreaker: this.calculateTieBreaker(stats, teamStats)
    }))

    // Sort with comprehensive tie-breaking
    rankings.sort((a, b) => {
      // Primary: Points
      if (a.points !== b.points) {
        return b.points - a.points
      }

      // Secondary: Goal differential
      if (a.pointsDifferential !== b.pointsDifferential) {
        return b.pointsDifferential - a.pointsDifferential
      }

      // Tertiary: Head-to-head record
      const h2h = this.compareHeadToHead(a.team, b.team, teamStats)
      if (h2h !== 0) {
        return h2h
      }

      // Quaternary: Goals for
      const aStats = teamStats.get(a.team.id)!
      const bStats = teamStats.get(b.team.id)!
      if (aStats.goalsFor !== bStats.goalsFor) {
        return bStats.goalsFor - aStats.goalsFor
      }

      // Final: Goals against (fewer is better)
      return aStats.goalsAgainst - bStats.goalsAgainst
    })

    // Assign ranks
    rankings.forEach((ranking, index) => {
      ranking.rank = index + 1
    })

    return {
      rankings,
      tieBreakers: [
        { method: 'points-differential', description: 'Points earned (3 for win, 1 for draw)' },
        { method: 'points-against', description: 'Goal differential' },
        { method: 'head-to-head', description: 'Head-to-head record' },
        { method: 'points-differential', description: 'Goals scored' },
        { method: 'points-against', description: 'Goals conceded' }
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
    // Tournament is complete when all matches are finished
    return matches.every(match => 
      match.status === 'completed' || match.status === 'cancelled'
    )
  }

  private divideIntoGroups(teams: Team[]): Team[][] {
    const groupSize = Math.ceil(teams.length / Math.ceil(teams.length / 6)) // Target ~6 teams per group
    const groups: Team[][] = []
    
    for (let i = 0; i < teams.length; i += groupSize) {
      groups.push(teams.slice(i, i + groupSize))
    }
    
    return groups
  }

  private generateGroupMatches(
    tournament: Tournament,
    teams: Team[],
    groupIndex: number
  ): Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[] {
    const matches: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[] = []
    
    // Generate all possible pairings within the group
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const match: Omit<Match, 'id' | 'createdAt' | 'updatedAt'> = {
          tournamentId: tournament.id,
          round: 1,
          roundName: `Group ${String.fromCharCode(65 + groupIndex)} - Round Robin`,
          bracketType: 'winner',
          team1: teams[i],
          team2: teams[j],
          score: { team1: 0, team2: 0, isComplete: false },
          status: 'scheduled',
          ends: []
        }
        matches.push(match)
      }
    }
    
    return matches
  }

  private generateGroupBracketStructure(teams: Team[], groupIndex: number): BracketNode[] {
    const nodes: BracketNode[] = []
    let matchIndex = 1
    
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const node: BracketNode = {
          id: `rr-group-${groupIndex}-match-${matchIndex}`,
          team1: teams[i],
          team2: teams[j],
          round: 1,
          position: matchIndex,
          bracketType: 'winner'
        }
        nodes.push(node)
        matchIndex++
      }
    }
    
    return nodes
  }

  private generatePlayoffMatches(
    tournament: Tournament,
    groups: Team[][]
  ): Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[] {
    const matches: Omit<Match, 'id' | 'createdAt' | 'updatedAt'>[] = []
    
    // Generate playoff bracket for group winners
    // This is a simplified version - could be more sophisticated
    const playoffTeamCount = Math.min(groups.length * 2, 8) // Top 2 from each group, max 8 teams
    
    for (let i = 0; i < playoffTeamCount; i += 2) {
      const match: Omit<Match, 'id' | 'createdAt' | 'updatedAt'> = {
        tournamentId: tournament.id,
        round: 2,
        roundName: `Playoff Round ${Math.floor(i / 2) + 1}`,
        bracketType: 'winner',
        team1: {} as Team, // Will be seeded later
        team2: {} as Team, // Will be seeded later
        score: { team1: 0, team2: 0, isComplete: false },
        status: 'scheduled',
        ends: []
      }
      matches.push(match)
    }
    
    return matches
  }

  private generatePlayoffBracketStructure(groups: Team[][]): BracketNode[] {
    const nodes: BracketNode[] = []
    const playoffTeamCount = Math.min(groups.length * 2, 8)
    
    for (let i = 0; i < playoffTeamCount / 2; i++) {
      const node: BracketNode = {
        id: `rr-playoff-${i + 1}`,
        round: 2,
        position: i + 1,
        bracketType: 'winner'
      }
      nodes.push(node)
    }
    
    return nodes
  }

  private calculateTotalMatches(teamCount: number, useMultipleGroups: boolean): number {
    if (!useMultipleGroups) {
      // n*(n-1)/2 for single round-robin
      return teamCount * (teamCount - 1) / 2
    }
    
    // For multiple groups, calculate group matches + playoff matches
    const groupSize = Math.ceil(teamCount / Math.ceil(teamCount / 6))
    const groupCount = Math.ceil(teamCount / groupSize)
    const groupMatches = groupCount * (groupSize * (groupSize - 1) / 2)
    const playoffMatches = Math.min(groupCount * 2, 8) - 1 // Playoff bracket matches
    
    return groupMatches + playoffMatches
  }

  private isGroupStageComplete(matches: Match[]): boolean {
    const groupMatches = matches.filter(m => m.roundName?.includes('Group'))
    return groupMatches.every(m => m.status === 'completed' || m.status === 'cancelled')
  }

  private hasPlayoffMatches(matches: Match[]): boolean {
    return matches.some(m => m.roundName?.includes('Playoff'))
  }

  private async calculateGroupStandings(
    tournament: Tournament,
    matches: Match[]
  ): Promise<Map<number, TeamRanking[]>> {
    const groupStandings = new Map<number, TeamRanking[]>()
    
    // Extract group information from matches
    const groups = new Map<number, Match[]>()
    matches.forEach(match => {
      if (match.roundName?.includes('Group')) {
        const groupMatch = match.roundName.match(/Group ([A-Z])/)
        if (groupMatch) {
          const groupIndex = groupMatch[1].charCodeAt(0) - 65
          if (!groups.has(groupIndex)) {
            groups.set(groupIndex, [])
          }
          groups.get(groupIndex)!.push(match)
        }
      }
    })
    
    // Calculate standings for each group
    for (const [groupIndex, groupMatches] of groups) {
      const groupStandings_ = await this.calculateStandings(tournament, groupMatches)
      groupStandings.set(groupIndex, groupStandings_.rankings)
    }
    
    return groupStandings
  }

  private seedPlayoffMatches(
    playoffMatches: Match[],
    groupStandings: Map<number, TeamRanking[]>
  ): void {
    // Seed playoff matches with top teams from each group
    const qualifiedTeams: Team[] = []
    
    // Get top 2 teams from each group
    groupStandings.forEach(standings => {
      qualifiedTeams.push(standings[0].team) // Group winner
      if (standings.length > 1) {
        qualifiedTeams.push(standings[1].team) // Runner-up
      }
    })
    
    // Assign teams to playoff matches
    for (let i = 0; i < playoffMatches.length && i * 2 < qualifiedTeams.length; i++) {
      const match = playoffMatches[i]
      match.team1 = qualifiedTeams[i * 2]
      if (i * 2 + 1 < qualifiedTeams.length) {
        match.team2 = qualifiedTeams[i * 2 + 1]
      }
    }
  }

  private updateBracketStructure(matches: Match[]): BracketNode[] {
    const nodes: BracketNode[] = []
    
    matches.forEach((match, index) => {
      const isGroupMatch = match.roundName?.includes('Group')
      const isPlayoffMatch = match.roundName?.includes('Playoff')
      
      const node: BracketNode = {
        id: isGroupMatch ? `rr-group-${index}` : `rr-playoff-${index}`,
        matchId: match.id,
        team1: match.team1,
        team2: match.team2,
        winner: match.winner,
        round: match.round,
        position: index + 1,
        bracketType: 'winner'
      }
      nodes.push(node)
    })
    
    return nodes
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

  private calculateTieBreaker(
    stats: any,
    allStats: Map<string, any>
  ): number {
    // For round-robin, tie-breaker is typically points, then goal differential
    return stats.points * 1000 + stats.goalDifferential
  }

  private compareHeadToHead(
    teamA: Team,
    teamB: Team,
    teamStats: Map<string, any>
  ): number {
    const statsA = teamStats.get(teamA.id)
    const statsB = teamStats.get(teamB.id)
    
    if (!statsA || !statsB) return 0
    
    const h2hA = statsA.headToHead.get(teamB.id)
    const h2hB = statsB.headToHead.get(teamA.id)
    
    if (!h2hA || !h2hB) return 0
    
    // Compare head-to-head wins
    return h2hA.wins - h2hA.losses - (h2hB.wins - h2hB.losses)
  }
}