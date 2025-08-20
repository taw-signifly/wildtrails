'use client'

import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { TournamentType, GameFormat } from '@/types'

interface TournamentTypeOption {
  type: TournamentType
  name: string
  description: string
  minPlayers: number
  maxPlayers: number
  estimatedDuration: string
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced'
  pros: string[]
  cons: string[]
}

interface GameFormatOption {
  format: GameFormat
  name: string
  description: string
  playersPerTeam: number
  courtSize: string
}

const TOURNAMENT_TYPES: TournamentTypeOption[] = [
  {
    type: 'single-elimination',
    name: 'Single Elimination',
    description: 'Teams are eliminated after one loss. Fast-paced with clear progression.',
    minPlayers: 8,
    maxPlayers: 128,
    estimatedDuration: '4-6 hours',
    difficulty: 'Beginner',
    pros: ['Quick completion', 'Easy to understand', 'High excitement'],
    cons: ['No second chances', 'Some teams play few games']
  },
  {
    type: 'double-elimination',
    name: 'Double Elimination',
    description: 'Teams get a second chance in the loser bracket. More games for everyone.',
    minPlayers: 8,
    maxPlayers: 64,
    estimatedDuration: '6-8 hours',
    difficulty: 'Intermediate',
    pros: ['Second chances', 'More games per team', 'Fairer results'],
    cons: ['Longer duration', 'More complex bracket']
  },
  {
    type: 'swiss',
    name: 'Swiss System',
    description: 'Teams play multiple rounds against similarly skilled opponents.',
    minPlayers: 8,
    maxPlayers: 200,
    estimatedDuration: '5-7 hours',
    difficulty: 'Advanced',
    pros: ['Everyone plays same number of games', 'Balanced matchups', 'No elimination'],
    cons: ['Complex scoring', 'Requires experience to manage']
  },
  {
    type: 'round-robin',
    name: 'Round Robin',
    description: 'Every team plays every other team once.',
    minPlayers: 6,
    maxPlayers: 16,
    estimatedDuration: '6-10 hours',
    difficulty: 'Intermediate',
    pros: ['Fairest format', 'Many games per team', 'Clear winner'],
    cons: ['Very long for large groups', 'Fixed schedule']
  }
]

const GAME_FORMATS: GameFormatOption[] = [
  {
    format: 'singles',
    name: 'Singles',
    description: 'Individual players compete head-to-head',
    playersPerTeam: 1,
    courtSize: 'Standard (15m x 4m)'
  },
  {
    format: 'doubles',
    name: 'Doubles',
    description: 'Two-player teams, most common format',
    playersPerTeam: 2,
    courtSize: 'Standard (15m x 4m)'
  },
  {
    format: 'triples',
    name: 'Triples',
    description: 'Three-player teams, traditional format',
    playersPerTeam: 3,
    courtSize: 'Large (15m x 4m)'
  }
]

interface Props {
  selectedType?: TournamentType
  selectedFormat?: GameFormat
  onTypeSelect: (type: TournamentType) => void
  onFormatSelect: (format: GameFormat) => void
}

export function TournamentTypeSelector({
  selectedType,
  selectedFormat,
  onTypeSelect,
  onFormatSelect
}: Props) {
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner': return 'bg-green-100 text-green-800'
      case 'Intermediate': return 'bg-yellow-100 text-yellow-800'
      case 'Advanced': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Tournament Type Selection */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium">Select Tournament Type</h4>
        <div className="grid gap-4 md:grid-cols-2">
          {TOURNAMENT_TYPES.map((option) => (
            <Card
              key={option.type}
              className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                selectedType === option.type
                  ? 'ring-2 ring-primary bg-primary/5'
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => onTypeSelect(option.type)}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h5 className="font-medium">{option.name}</h5>
                    <p className="text-sm text-muted-foreground mt-1">
                      {option.description}
                    </p>
                  </div>
                  <Badge className={getDifficultyColor(option.difficulty)}>
                    {option.difficulty}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="font-medium">Players:</span> {option.minPlayers}-{option.maxPlayers}
                  </div>
                  <div>
                    <span className="font-medium">Duration:</span> {option.estimatedDuration}
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <span className="text-xs font-medium text-green-700">Pros:</span>
                    <ul className="text-xs text-muted-foreground ml-2">
                      {option.pros.map((pro, index) => (
                        <li key={index}>• {pro}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-red-700">Cons:</span>
                    <ul className="text-xs text-muted-foreground ml-2">
                      {option.cons.map((con, index) => (
                        <li key={index}>• {con}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Game Format Selection */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium">Select Game Format</h4>
        <div className="grid gap-4 md:grid-cols-3">
          {GAME_FORMATS.map((option) => (
            <Card
              key={option.format}
              className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                selectedFormat === option.format
                  ? 'ring-2 ring-primary bg-primary/5'
                  : 'hover:bg-muted/50'
              }`}
              onClick={() => onFormatSelect(option.format)}
            >
              <div className="space-y-2 text-center">
                <h5 className="font-medium">{option.name}</h5>
                <p className="text-sm text-muted-foreground">
                  {option.description}
                </p>
                <div className="space-y-1 text-xs">
                  <div>
                    <span className="font-medium">Team Size:</span> {option.playersPerTeam} player{option.playersPerTeam > 1 ? 's' : ''}
                  </div>
                  <div>
                    <span className="font-medium">Court:</span> {option.courtSize}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Recommendation Panel */}
      {selectedType && selectedFormat && (
        <Card className="p-4 bg-blue-50 border-blue-200">
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-blue-900">Recommendation</h4>
            <p className="text-sm text-blue-800">
              {selectedType === 'single-elimination' && selectedFormat === 'doubles' && 
                'Great choice for beginners! This format is easy to manage and keeps games moving quickly.'}
              {selectedType === 'swiss' && 
                'Swiss system works best with experienced tournament organizers. Consider having a backup plan for time management.'}
              {selectedType === 'round-robin' && 
                'Perfect for smaller groups where everyone wants to play multiple games. Allow extra time for completion.'}
              {selectedFormat === 'triples' && 
                'Traditional Petanque format! Make sure you have enough space for larger team areas.'}
            </p>
          </div>
        </Card>
      )}
    </div>
  )
}