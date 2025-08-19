/**
 * Tournament Management Server Actions
 * Centralized exports for all tournament-related server actions
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

// Re-export types for convenience
export type {
  ActionResult,
  ActionState,
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
  CancelTournamentAction
} from '@/types/actions'