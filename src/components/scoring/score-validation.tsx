'use client'

import { useState, useEffect } from 'react'
import { Match } from '@/types'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { validateMatchScore } from '@/lib/actions/live-scoring'
import type { ActionResult } from '@/types/actions'

interface ScoreValidationDisplayProps {
  match: Match
  lastError?: string | null
}

// Match the actual server action return type
interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export function ScoreValidationDisplay({ 
  match, 
  lastError 
}: ScoreValidationDisplayProps) {
  const [validation, setValidation] = useState<ValidationResult | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  // Validate match score whenever match updates
  useEffect(() => {
    const validateMatch = async () => {
      setIsValidating(true)
      try {
        const result = await validateMatchScore(match.id, match.score!)
        if (result.success && result.data) {
          // result.data is now properly typed as ValidationResult
          setValidation(result.data)
        } else {
          console.warn('Validation failed:', result.success === false ? result.error : 'Unknown error')
          setValidation(null)
        }
      } catch (error) {
        console.error('Validation error:', error)
        setValidation(null)
      } finally {
        setIsValidating(false)
      }
    }

    if (match && match.id) {
      validateMatch()
    }
  }, [match.id, match.score, match.ends?.length])

  // Don't render if no validation data and no errors
  if (!validation && !lastError && !isValidating) {
    return null
  }

  return (
    <div className="space-y-3">
      {/* Last Error Display */}
      {lastError && (
        <Card className="p-4 border-red-300 bg-red-50">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 text-red-500 text-xl">❌</div>
            <div className="flex-1">
              <h4 className="font-medium text-red-800 mb-1">Scoring Error</h4>
              <p className="text-sm text-red-700">{lastError}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Validation Status */}
      {validation && (
        <Card className={`p-4 transition-colors ${
          validation.valid 
            ? 'border-green-300 bg-green-50' 
            : validation.errors.length > 0
            ? 'border-red-300 bg-red-50'
            : 'border-orange-300 bg-orange-50'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Status Indicator */}
              <div className={`flex items-center gap-2 ${
                validation.valid ? 'text-green-700' : 'text-red-700'
              }`}>
                <span className="text-lg">
                  {validation.valid ? '✅' : '⚠️'}
                </span>
                <span className="font-medium">
                  {validation.valid ? 'Score Valid' : 'Validation Issues'}
                </span>
              </div>

              {/* Issue Counts */}
              {(!validation.valid || validation.warnings.length > 0) && (
                <div className="flex items-center gap-2">
                  {validation.errors.length > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {validation.errors.length} error{validation.errors.length > 1 ? 's' : ''}
                    </Badge>
                  )}
                  {validation.warnings.length > 0 && (
                    <Badge className="text-xs bg-orange-100 text-orange-800 border-orange-300">
                      {validation.warnings.length} warning{validation.warnings.length > 1 ? 's' : ''}
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Toggle Details Button */}
            {(validation.errors.length > 0 || validation.warnings.length > 0) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs"
              >
                {showDetails ? 'Hide Details' : 'Show Details'}
              </Button>
            )}
          </div>

          {/* Validation Details */}
          {showDetails && (
            <div className="mt-4 space-y-3">
              {/* Errors */}
              {validation.errors.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-red-800 flex items-center gap-1">
                    <span>🔴</span>
                    <span>Errors</span>
                  </h5>
                  <ul className="space-y-1">
                    {validation.errors.map((error, index) => (
                      <li key={index} className="text-sm text-red-700 flex items-start gap-2">
                        <span className="text-red-500 text-xs mt-0.5">•</span>
                        <span>{error}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Warnings */}
              {validation.warnings.length > 0 && (
                <div className="space-y-2">
                  <h5 className="text-sm font-medium text-orange-800 flex items-center gap-1">
                    <span>🟡</span>
                    <span>Warnings</span>
                  </h5>
                  <ul className="space-y-1">
                    {validation.warnings.map((warning, index) => (
                      <li key={index} className="text-sm text-orange-700 flex items-start gap-2">
                        <span className="text-orange-500 text-xs mt-0.5">•</span>
                        <span>{warning}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            </div>
          )}
        </Card>
      )}

      {/* Loading State */}
      {isValidating && !validation && (
        <Card className="p-4 border-blue-300 bg-blue-50">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-blue-700">Validating score...</span>
          </div>
        </Card>
      )}
    </div>
  )
}