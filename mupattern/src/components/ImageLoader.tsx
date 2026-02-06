import { useCallback, useRef, useState } from "react"
import { ImageIcon, Check } from "lucide-react"
import * as UTIF from "utif2"

interface ImageLoaderProps {
  onLoad: (image: HTMLImageElement, filename: string) => void
  loaded: boolean
}

const ACCEPTED_TYPES = new Set(["image/png", "image/tiff", "image/tif"])
const TIFF_TYPES = new Set(["image/tiff", "image/tif"])

function isTiff(file: File): boolean {
  return TIFF_TYPES.has(file.type) || /\.tiff?$/i.test(file.name)
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, "")
}

export function ImageLoader({ onLoad, loaded }: ImageLoaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadTiff = useCallback((file: File) => {
    const baseName = stripExtension(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer
        const ifds = UTIF.decode(buffer)
        if (ifds.length === 0) {
          setError("Could not decode TIFF file")
          return
        }
        UTIF.decodeImage(buffer, ifds[0])
        const rgba = UTIF.toRGBA8(ifds[0])
        const w = ifds[0].width
        const h = ifds[0].height

        // Draw RGBA data to an offscreen canvas, then create an HTMLImageElement
        const canvas = document.createElement("canvas")
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext("2d")!
        const imageData = new ImageData(new Uint8ClampedArray(rgba.buffer as ArrayBuffer), w, h)
        ctx.putImageData(imageData, 0, 0)

        const img = new Image()
        img.onload = () => onLoad(img, baseName)
        img.src = canvas.toDataURL("image/png")
      } catch {
        setError("Failed to decode TIFF file")
      }
    }
    reader.readAsArrayBuffer(file)
  }, [onLoad])

  const loadPng = useCallback((file: File) => {
    const baseName = stripExtension(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => onLoad(img, baseName)
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }, [onLoad])

  const loadImage = useCallback((file: File) => {
    if (isTiff(file)) {
      setError(null)
      loadTiff(file)
    } else if (ACCEPTED_TYPES.has(file.type)) {
      setError(null)
      loadPng(file)
    } else {
      setError("Only PNG and TIFF files are accepted")
    }
  }, [loadTiff, loadPng])

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
          accept="image/png,image/tiff,.tif,.tiff"
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
              <span className="text-muted-foreground">Load image (PNG / TIF)</span>
            </>
          )}
        </div>
      </div>
      {error && <p className="text-base text-destructive mt-1">{error}</p>}
    </div>
  )
}
