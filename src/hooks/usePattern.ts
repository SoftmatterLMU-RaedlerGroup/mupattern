import { useState, useCallback } from 'react'
import { Pattern, Lattice, DEFAULT_PATTERN } from '../types'

export function usePattern() {
  const [pattern, setPattern] = useState<Pattern>(DEFAULT_PATTERN)

  const updateLattice = useCallback((updates: Partial<Lattice>) => {
    setPattern(prev => ({
      ...prev,
      lattice: { ...prev.lattice, ...updates },
    }))
  }, [])

  const updateSquareSize = useCallback((squareSize: number) => {
    setPattern(prev => ({ ...prev, squareSize }))
  }, [])

  const reset = useCallback(() => {
    setPattern(DEFAULT_PATTERN)
  }, [])

  const exportConfig = useCallback(() => {
    const blob = new Blob([JSON.stringify(pattern, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pattern-config.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [pattern])

  return {
    pattern,
    updateLattice,
    updateSquareSize,
    reset,
    exportConfig,
  }
}
