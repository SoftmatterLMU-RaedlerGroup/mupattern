import { useRef, useCallback } from 'react'

interface FileLoaderProps {
  onPhaseContrastLoad: (image: HTMLImageElement) => void
  onTemplateLoad: (image: HTMLImageElement) => void
  phaseContrastLoaded: boolean
  templateLoaded: boolean
}

export function FileLoader({
  onPhaseContrastLoad,
  onTemplateLoad,
  phaseContrastLoaded,
  templateLoaded,
}: FileLoaderProps) {
  const phaseInputRef = useRef<HTMLInputElement>(null)
  const templateInputRef = useRef<HTMLInputElement>(null)

  const loadImage = useCallback((file: File, onLoad: (img: HTMLImageElement) => void) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => onLoad(img)
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }, [])

  const handlePhaseChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) loadImage(file, onPhaseContrastLoad)
  }, [loadImage, onPhaseContrastLoad])

  const handleTemplateChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) loadImage(file, onTemplateLoad)
  }, [loadImage, onTemplateLoad])

  const handleDrop = useCallback((e: React.DragEvent, onLoad: (img: HTMLImageElement) => void) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      loadImage(file, onLoad)
    }
  }, [loadImage])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  return (
    <div className="flex gap-4 p-4 bg-zinc-800 rounded-lg">
      <div
        className={`flex-1 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          phaseContrastLoaded ? 'border-green-500 bg-green-500/10' : 'border-zinc-600 hover:border-zinc-500'
        }`}
        onClick={() => phaseInputRef.current?.click()}
        onDrop={(e) => handleDrop(e, onPhaseContrastLoad)}
        onDragOver={handleDragOver}
      >
        <input
          ref={phaseInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhaseChange}
          className="hidden"
        />
        <div className="text-zinc-300 text-sm font-medium">
          {phaseContrastLoaded ? '✓ Phase Contrast Loaded' : 'Load Phase Contrast'}
        </div>
        <div className="text-zinc-500 text-xs mt-1">Click or drag PNG</div>
      </div>

      <div
        className={`flex-1 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          templateLoaded ? 'border-green-500 bg-green-500/10' : 'border-zinc-600 hover:border-zinc-500'
        }`}
        onClick={() => templateInputRef.current?.click()}
        onDrop={(e) => handleDrop(e, onTemplateLoad)}
        onDragOver={handleDragOver}
      >
        <input
          ref={templateInputRef}
          type="file"
          accept="image/*"
          onChange={handleTemplateChange}
          className="hidden"
        />
        <div className="text-zinc-300 text-sm font-medium">
          {templateLoaded ? '✓ Template Loaded' : 'Load Template'}
        </div>
        <div className="text-zinc-500 text-xs mt-1">Click or drag PNG</div>
      </div>
    </div>
  )
}
