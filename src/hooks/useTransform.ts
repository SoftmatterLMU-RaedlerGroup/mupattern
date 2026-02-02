import { useState, useCallback } from 'react'
import { Transform, DEFAULT_TRANSFORM } from '../types'

export function useTransform() {
  const [transform, setTransform] = useState<Transform>(DEFAULT_TRANSFORM)

  const updateTransform = useCallback((updates: Partial<Transform>) => {
    setTransform(prev => ({ ...prev, ...updates }))
  }, [])

  const reset = useCallback(() => {
    setTransform(DEFAULT_TRANSFORM)
  }, [])

  const exportJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify(transform, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'transform.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [transform])

  return {
    transform,
    updateTransform,
    reset,
    exportJSON,
  }
}
