import { useCallback, useRef, useState } from "react"
import { ImageIcon, Check } from "lucide-react"

interface ImageLoaderProps {
  onLoad: (image: HTMLImageElement) => void
  loaded: boolean
}

export function ImageLoader({ onLoad, loaded }: ImageLoaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadImage = useCallback((file: File) => {
    if (file.type !== "image/png") {
      setError("Only PNG files are accepted")
      return
    }
    setError(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => onLoad(img)
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }, [onLoad])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) loadImage(file)
  }, [loadImage])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) loadImage(file)
  }, [loadImage])

  return (
    <div>
      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
          loaded
            ? "border-primary/50 bg-primary/5"
            : dragOver
              ? "border-primary bg-primary/10"
              : "border-border hover:border-muted-foreground"
        }`}
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/png"
          onChange={handleChange}
          className="hidden"
        />
        <div className="flex items-center justify-center gap-2 text-base">
          {loaded ? (
            <>
              <Check className="h-4 w-4 text-primary" />
              <span className="text-foreground font-medium">Image loaded</span>
            </>
          ) : (
            <>
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Load image PNG</span>
            </>
          )}
        </div>
      </div>
      {error && <p className="text-base text-destructive mt-1">{error}</p>}
    </div>
  )
}
