import { useRef, useEffect, useCallback } from 'react'
import { Transform } from '../types'

interface CanvasProps {
  phaseContrast: HTMLImageElement | null
  template: HTMLImageElement | null
  transform: Transform
  onTransformUpdate: (updates: Partial<Transform>) => void
}

export function RegistrationCanvas({ phaseContrast, template, transform, onTransformUpdate }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDragging = useRef(false)
  const isRotating = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = '#18181b'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw phase contrast as background
    if (phaseContrast) {
      ctx.drawImage(phaseContrast, 0, 0, canvas.width, canvas.height)
    }

    // Draw template with transform (3x3 tiled grid)
    if (template) {
      const { tx, ty, rotation, scale } = transform
      const tw = template.width * scale
      const th = template.height * scale

      ctx.globalAlpha = 0.6

      // Tile offsets: -1, 0, 1 in both directions
      for (let tileY = -1; tileY <= 1; tileY++) {
        for (let tileX = -1; tileX <= 1; tileX++) {
          ctx.save()

          // Translate to canvas center
          ctx.translate(canvas.width / 2, canvas.height / 2)

          // Apply rotation around center
          ctx.rotate(rotation)

          // Apply translation + tile offset
          const offsetX = tx + tileX * tw
          const offsetY = ty + tileY * th
          ctx.translate(offsetX, offsetY)

          // Draw template centered
          ctx.drawImage(template, -tw / 2, -th / 2, tw, th)

          ctx.restore()
        }
      }

      ctx.globalAlpha = 1.0
    }

    // Draw crosshair at center
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(canvas.width / 2, 0)
    ctx.lineTo(canvas.width / 2, canvas.height)
    ctx.moveTo(0, canvas.height / 2)
    ctx.lineTo(canvas.width, canvas.height / 2)
    ctx.stroke()
  }, [phaseContrast, template, transform])

  useEffect(() => {
    draw()
  }, [draw])

  // Resize canvas to match phase contrast image
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !phaseContrast) return

    canvas.width = phaseContrast.width
    canvas.height = phaseContrast.height
    draw()
  }, [phaseContrast, draw])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.shiftKey) {
      isRotating.current = true
    } else {
      isDragging.current = true
    }
    lastPos.current = { x: e.clientX, y: e.clientY }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current && !isRotating.current) return

    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    lastPos.current = { x: e.clientX, y: e.clientY }

    if (isRotating.current) {
      // Rotate based on horizontal drag
      onTransformUpdate({ rotation: transform.rotation + dx * 0.01 })
    } else if (isDragging.current) {
      // Pan
      onTransformUpdate({
        tx: transform.tx + dx,
        ty: transform.ty + dy,
      })
    }
  }, [transform, onTransformUpdate])

  const handleMouseUp = useCallback(() => {
    isDragging.current = false
    isRotating.current = false
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.95 : 1.05
    const newScale = Math.max(0.5, Math.min(2.0, transform.scale * delta))
    onTransformUpdate({ scale: newScale })
  }, [transform.scale, onTransformUpdate])

  return (
    <div className="flex-1 overflow-auto bg-zinc-900 rounded-lg p-2">
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="max-w-full h-auto cursor-move"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />
    </div>
  )
}
