import { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react'
import { Pattern, Transform } from '../types'

interface PatternCanvasProps {
  pattern: Pattern
  background: HTMLImageElement | null
  backgroundTransform: Transform
  onBackgroundTransformUpdate: (updates: Partial<Transform>) => void
}

export interface PatternCanvasRef {
  exportPNG: () => void
}

export const PatternCanvas = forwardRef<PatternCanvasRef, PatternCanvasProps>(
  function PatternCanvas({ pattern, background, backgroundTransform, onBackgroundTransformUpdate }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const isDragging = useRef(false)
    const isRotating = useRef(false)
    const lastPos = useRef({ x: 0, y: 0 })

    const drawPattern = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, withBackground: boolean) => {
      // Clear canvas (black for export, dark for preview)
      ctx.fillStyle = withBackground ? '#18181b' : '#000000'
      ctx.fillRect(0, 0, width, height)

      // Draw background with transform if present and requested
      if (withBackground && background) {
        const { tx, ty, rotation, scale } = backgroundTransform
        ctx.save()
        ctx.globalAlpha = 0.5
        ctx.translate(width / 2, height / 2)
        ctx.rotate(rotation)
        ctx.scale(scale, scale)
        ctx.translate(tx, ty)
        ctx.drawImage(background, -background.width / 2, -background.height / 2)
        ctx.restore()
      }

      // Calculate basis vectors from polar coordinates
      const { lattice, squareSize } = pattern
      const vec1 = {
        x: lattice.a * Math.cos(lattice.alpha),
        y: lattice.a * Math.sin(lattice.alpha),
      }
      const vec2 = {
        x: lattice.b * Math.cos(lattice.beta),
        y: lattice.b * Math.sin(lattice.beta),
      }

      // Calculate how many lattice points we need to cover the canvas
      const maxDim = Math.max(width, height) * 1.5
      const maxRange = Math.ceil(maxDim / Math.min(lattice.a, lattice.b)) + 2

      // Center of canvas
      const cx = width / 2
      const cy = height / 2

      // Draw lattice points (white on black for export to match phase contrast)
      ctx.fillStyle = withBackground ? 'rgba(59, 130, 246, 0.8)' : '#ffffff'
      const halfSize = squareSize / 2

      for (let i = -maxRange; i <= maxRange; i++) {
        for (let j = -maxRange; j <= maxRange; j++) {
          const x = cx + i * vec1.x + j * vec2.x
          const y = cy + i * vec1.y + j * vec2.y

          // Only draw if within canvas bounds (with padding)
          if (x >= -squareSize && x <= width + squareSize &&
              y >= -squareSize && y <= height + squareSize) {
            ctx.fillRect(x - halfSize, y - halfSize, squareSize, squareSize)
          }
        }
      }

      // Draw visual aids (only in preview mode with background)
      if (withBackground) {
        // Draw origin marker
        ctx.beginPath()
        ctx.arc(cx, cy, 4, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
        ctx.fill()

        // Draw basis vectors
        ctx.strokeStyle = 'rgba(255, 100, 100, 0.8)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + vec1.x, cy + vec1.y)
        ctx.stroke()

        // Arrow head for vec1
        const angle1 = Math.atan2(vec1.y, vec1.x)
        ctx.beginPath()
        ctx.moveTo(cx + vec1.x, cy + vec1.y)
        ctx.lineTo(cx + vec1.x - 8 * Math.cos(angle1 - 0.3), cy + vec1.y - 8 * Math.sin(angle1 - 0.3))
        ctx.moveTo(cx + vec1.x, cy + vec1.y)
        ctx.lineTo(cx + vec1.x - 8 * Math.cos(angle1 + 0.3), cy + vec1.y - 8 * Math.sin(angle1 + 0.3))
        ctx.stroke()

        ctx.strokeStyle = 'rgba(100, 255, 100, 0.8)'
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + vec2.x, cy + vec2.y)
        ctx.stroke()

        // Arrow head for vec2
        const angle2 = Math.atan2(vec2.y, vec2.x)
        ctx.beginPath()
        ctx.moveTo(cx + vec2.x, cy + vec2.y)
        ctx.lineTo(cx + vec2.x - 8 * Math.cos(angle2 - 0.3), cy + vec2.y - 8 * Math.sin(angle2 - 0.3))
        ctx.moveTo(cx + vec2.x, cy + vec2.y)
        ctx.lineTo(cx + vec2.x - 8 * Math.cos(angle2 + 0.3), cy + vec2.y - 8 * Math.sin(angle2 + 0.3))
        ctx.stroke()

        // Draw crosshair
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(cx, 0)
        ctx.lineTo(cx, height)
        ctx.moveTo(0, cy)
        ctx.lineTo(width, cy)
        ctx.stroke()
      }
    }, [pattern, background, backgroundTransform])

    const draw = useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      drawPattern(ctx, canvas.width, canvas.height, true)
    }, [drawPattern])

    useEffect(() => {
      draw()
    }, [draw])

    // Resize canvas when background loads
    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return

      if (background) {
        canvas.width = background.width
        canvas.height = background.height
      } else {
        canvas.width = 800
        canvas.height = 600
      }
      draw()
    }, [background, draw])

    // Export PNG (pattern only, no background)
    const exportPNG = useCallback(() => {
      const canvas = canvasRef.current
      if (!canvas) return

      // Create a temporary canvas for export
      const exportCanvas = document.createElement('canvas')
      exportCanvas.width = canvas.width
      exportCanvas.height = canvas.height
      const ctx = exportCanvas.getContext('2d')
      if (!ctx) return

      // Draw pattern without background
      drawPattern(ctx, exportCanvas.width, exportCanvas.height, false)

      // Export
      const link = document.createElement('a')
      link.download = 'pattern-template.png'
      link.href = exportCanvas.toDataURL('image/png')
      link.click()
    }, [drawPattern])

    // Expose export function via ref
    useImperativeHandle(ref, () => ({
      exportPNG,
    }), [exportPNG])

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
      if (!background) return
      if (e.shiftKey) {
        isRotating.current = true
      } else {
        isDragging.current = true
      }
      lastPos.current = { x: e.clientX, y: e.clientY }
    }, [background])

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
      if (!isDragging.current && !isRotating.current) return

      const dx = e.clientX - lastPos.current.x
      const dy = e.clientY - lastPos.current.y
      lastPos.current = { x: e.clientX, y: e.clientY }

      if (isRotating.current) {
        onBackgroundTransformUpdate({ rotation: backgroundTransform.rotation + dx * 0.01 })
      } else if (isDragging.current) {
        // Transform is applied in scaled space, so divide by scale
        const scale = backgroundTransform.scale
        onBackgroundTransformUpdate({
          tx: backgroundTransform.tx + dx / scale,
          ty: backgroundTransform.ty + dy / scale,
        })
      }
    }, [backgroundTransform, onBackgroundTransformUpdate])

    const handleMouseUp = useCallback(() => {
      isDragging.current = false
      isRotating.current = false
    }, [])

    const handleWheel = useCallback((e: React.WheelEvent) => {
      if (!background) return
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.95 : 1.05
      const newScale = Math.max(0.1, Math.min(5.0, backgroundTransform.scale * delta))
      onBackgroundTransformUpdate({ scale: newScale })
    }, [background, backgroundTransform.scale, onBackgroundTransformUpdate])

    return (
      <div className="flex-1 overflow-auto bg-zinc-900 rounded-lg p-2">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className={`max-w-full h-auto ${background ? 'cursor-move' : 'cursor-default'}`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        />
      </div>
    )
  }
)
