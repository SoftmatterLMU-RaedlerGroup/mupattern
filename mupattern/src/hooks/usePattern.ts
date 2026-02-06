import { useState, useCallback } from "react"
import type { PatternConfigUm, Lattice } from "@/types"
import { DEFAULT_PATTERN_UM } from "@/types"

export function usePattern() {
  const [pattern, setPattern] = useState<PatternConfigUm>(DEFAULT_PATTERN_UM)

  const updateLattice = useCallback((updates: Partial<Lattice>) => {
    setPattern((prev) => ({
      ...prev,
      lattice: { ...prev.lattice, ...updates },
    }))
  }, [])

  const updateSquareSize = useCallback((squareSize: number) => {
    setPattern((prev) => ({ ...prev, squareSize }))
  }, [])

  const scalePattern = useCallback((factor: number) => {
    setPattern((prev) => ({
      ...prev,
      lattice: {
        ...prev.lattice,
        a: prev.lattice.a * factor,
        b: prev.lattice.b * factor,
      },
      squareSize: prev.squareSize * factor,
    }))
  }, [])

  const rotatePattern = useCallback((deltaRad: number) => {
    setPattern((prev) => ({
      ...prev,
      lattice: {
        ...prev.lattice,
        alpha: prev.lattice.alpha + deltaRad,
        beta: prev.lattice.beta + deltaRad,
      },
    }))
  }, [])

  const loadConfig = useCallback((config: PatternConfigUm) => {
    setPattern(config)
  }, [])

  const reset = useCallback(() => {
    setPattern(DEFAULT_PATTERN_UM)
  }, [])

  return { pattern, updateLattice, updateSquareSize, scalePattern, rotatePattern, loadConfig, reset }
}
