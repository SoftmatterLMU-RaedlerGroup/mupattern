import { useState, useCallback, useEffect } from "react"
import type { Calibration } from "@/types"
import { DEFAULT_CALIBRATION } from "@/types"

const STORAGE_KEY = "mupattern-calibration"

function loadStored(): Calibration {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Calibration
      if (parsed.umPerPixel > 0) return parsed
    }
  } catch { /* use default */ }
  return DEFAULT_CALIBRATION
}

export function useCalibration() {
  const [calibration, setCalibration] = useState<Calibration>(loadStored)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(calibration))
  }, [calibration])

  const update = useCallback((cal: Calibration) => {
    if (cal.umPerPixel > 0) setCalibration(cal)
  }, [])

  return { calibration, setCalibration: update }
}
