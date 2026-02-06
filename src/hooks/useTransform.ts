import { useState, useCallback } from "react"
import type { Transform } from "@/types"
import { DEFAULT_TRANSFORM } from "@/types"

export function useTransform() {
  const [transform, setTransform] = useState<Transform>(DEFAULT_TRANSFORM)

  const updateTransform = useCallback((updates: Partial<Transform>) => {
    setTransform((prev) => ({ ...prev, ...updates }))
  }, [])

  const reset = useCallback(() => {
    setTransform(DEFAULT_TRANSFORM)
  }, [])

  return { transform, updateTransform, reset }
}
