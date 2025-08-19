/**
 * Server Actions for Tournament Management System
 * Centralized exports for all server actions (tournaments, players, teams)
 */

// Core CRUD Actions
export {
  getTournaments,
  getTournamentById,
  createTournament,
  createTournamentData,
  updateTournament,
  updateTournamentData,
  deleteTournament,
  searchTournaments
} from './tournaments'

// Tournament Management Actions
export {
  startTournament,
  registerPlayerForTournament,
  removePlayerFromTournament,
  cancelTournament,
  completeTournament,
  updateTournamentStats,
  canStartTournament,
  canAddPlayerToTournament
} from './tournament-management'

// Utility Actions
export {
  getTournamentStatsSummary,
  getUpcomingTournaments,
  getActiveTournaments,
  getCompletedTournaments,
  getTournamentsInDateRange,
  createTournamentFromTemplate,
  getTournamentProgress,
  getTournamentDuration,
  validateTournamentFormData,
  getTournamentsByOrganizer,
  getTournamentTypesWithCounts
} from './tournament-utils'

// Player CRUD Actions
export {
  getPlayers,
  getPlayerById,
  createPlayer,
  createPlayerData,
  updatePlayer,
  updatePlayerData,
  deletePlayer,
  searchPlayers
} from './players'

// Player Statistics Actions
export {
  updatePlayerStats,
  getPlayerTournamentHistory,
  getPlayerPerformanceStats
} from './players'

// Team CRUD Actions
export {
  getTeams,
  getTeamById,
  createTeam,
  createTeamData,
  updateTeam,
  updateTeamData,
  deleteTeam
} from './teams'

// Team Management Actions
export {
  addPlayerToTeam,
  removePlayerFromTeam,
  validateTeamFormation,
  getTeamsByTournament,
  updateTeamStats
} from './teams'

// Re-export types for convenience
export type {
  ActionResult,
  ActionState,
  // Tournament action types
  CreateTournamentAction,
  CreateTournamentDataAction,
  UpdateTournamentAction,
  UpdateTournamentDataAction,
  DeleteTournamentAction,
  GetTournamentsAction,
  GetTournamentByIdAction,
  SearchTournamentsAction,
  StartTournamentAction,
  RegisterPlayerAction,
  RemovePlayerAction,
  CancelTournamentAction,
  // Player action types
  CreatePlayerAction,
  CreatePlayerDataAction,
  UpdatePlayerAction,
  UpdatePlayerDataAction,
  DeletePlayerAction,
  GetPlayersAction,
  GetPlayerByIdAction,
  SearchPlayersAction,
  UpdatePlayerStatsAction,
  GetPlayerTournamentHistoryAction,
  GetPlayerPerformanceStatsAction,
  // Team action types
  CreateTeamAction,
  CreateTeamDataAction,
  UpdateTeamAction,
  UpdateTeamDataAction,
  DeleteTeamAction,
  GetTeamsAction,
  GetTeamByIdAction,
  GetTeamsByTournamentAction,
  AddPlayerToTeamAction,
  RemovePlayerFromTeamAction,
  ValidateTeamFormationAction,
  UpdateTeamStatsAction,
  TeamFilters
} from '@/types/actions'

// Match CRUD Actions
export {
  getMatches,
  getMatchesByTournament,
  getMatchesByPlayer,
  getMatchById,
  createMatchData,
  updateMatch,
  updateMatchData,
  deleteMatch,
  searchMatches,
  startMatch,
  completeMatch,
  cancelMatch,
  getLiveMatches,
  getTournamentMatchStats
} from './matches'

// Live Scoring Actions
export {
  updateMatchScore,
  submitEndScore,
  addEndToMatch,
  updateEndScore,
  validateMatchScore,
  getMatchProgress,
  getMatchHistory,
  getEndByEndDetails,
  undoLastEnd,
  updateScoreForm
} from './live-scoring'

// Court Management Actions
export {
  getCourts,
  getCourtById,
  createCourt,
  updateCourtData,
  updateCourtStatus,
  assignMatchToCourt,
  releaseCourtAssignment,
  findAvailableCourt,
  getCourtAvailability,
  getCourtSchedule,
  reserveCourtForMatch,
  setCourtMaintenance,
  removeCourtMaintenance,
  getCourtUtilization,
  searchCourts
} from './courts'

// Bracket Management Actions
export {
  generateBracketMatches,
  updateBracketProgression,
  getActiveTournamentMatches,
  getBracketStructure,
  advanceWinnerToBracket,
  getBracketResults
} from './bracket-management'

// Types for bracket management
export type {
  BracketNode,
  BracketUpdate
} from './bracket-management'