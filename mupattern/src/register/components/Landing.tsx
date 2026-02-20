import { useState, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { HexBackground } from "@/components/HexBackground"
import { ImageIcon } from "lucide-react"
import * as UTIF from "utif2"
import { ThemeToggle } from "@/components/ThemeToggle"
import { useTheme } from "@/components/ThemeProvider"

const ACCEPTED_TYPES = new Set(["image/png", "image/tiff", "image/tif"])
const TIFF_TYPES = new Set(["image/tiff", "image/tif"])

function isTiff(file: File): boolean {
  return TIFF_TYPES.has(file.type) || /\.tiff?$/i.test(file.name)
}

function stripExtension(filename: string): string {
  return filename.replace(/\.[^.]+$/, "")
}

export interface StartConfig {
  kind: "image"
  image: HTMLImageElement
  filename: string
}

interface LandingProps {
  onStart: (config: StartConfig) => void
}

export function Landing({ onStart }: LandingProps) {
  const { theme } = useTheme()
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleImageReady = useCallback(
    (img: HTMLImageElement, filename: string) => {
      setLoading(false)
      onStart({ kind: "image", image: img, filename })
    },
    [onStart]
  )

  const loadTiff = useCallback(
    (file: File) => {
      const baseName = stripExtension(file.name)
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer
          const ifds = UTIF.decode(buffer)
          if (ifds.length === 0) {
            setError("Could not decode TIFF file")
            setLoading(false)
            return
          }
          UTIF.decodeImage(buffer, ifds[0])
          const rgba = UTIF.toRGBA8(ifds[0])
          const w = ifds[0].width
          const h = ifds[0].height

          const canvas = document.createElement("canvas")
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext("2d")!
          const imageData = new ImageData(
            new Uint8ClampedArray(rgba.buffer as ArrayBuffer),
            w,
            h
          )
          ctx.putImageData(imageData, 0, 0)

          const img = new Image()
          img.onload = () => handleImageReady(img, baseName)
          img.src = canvas.toDataURL("image/png")
        } catch {
          setError("Failed to decode TIFF file")
          setLoading(false)
        }
      }
      reader.readAsArrayBuffer(file)
    },
    [handleImageReady]
  )

  const loadPng = useCallback(
    (file: File) => {
      const baseName = stripExtension(file.name)
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => handleImageReady(img, baseName)
        img.src = e.target?.result as string
      }
      reader.readAsDataURL(file)
    },
    [handleImageReady]
  )

  const loadImage = useCallback(
    (file: File) => {
      setLoading(true)
      if (isTiff(file)) {
        setError(null)
        loadTiff(file)
      } else if (ACCEPTED_TYPES.has(file.type)) {
        setError(null)
        loadPng(file)
      } else {
        setError("Only PNG and TIFF files are accepted")
        setLoading(false)
      }
    },
    [loadTiff, loadPng]
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) loadImage(file)
    },
    [loadImage]
  )

  return (
    <div className="relative flex flex-col items-center justify-center h-screen gap-8 p-6">
      <HexBackground theme={theme} />

      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <div className="text-center">
        <h1
          className="text-4xl tracking-tight"
          style={{ fontFamily: '"Bitcount", monospace' }}
        >
          MuRegister
        </h1>
        <p className="text-muted-foreground mt-1 text-center max-w-md">
          Microscopy pattern-to-image registration
        </p>
      </div>

      <div className="border rounded-lg p-8 backdrop-blur-sm bg-background/80 max-w-md w-full">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/tiff,.tif,.tiff"
          onChange={handleChange}
          className="hidden"
        />
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex items-center justify-center gap-4">
            <ImageIcon className="size-12 text-muted-foreground flex-shrink-0" />
            <p className="font-medium">
              {loading ? "Loading..." : "Load image"}
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            Open a PNG or TIFF microscopy image.
          </p>
          <Button onClick={() => inputRef.current?.click()} disabled={loading}>
            Choose file
          </Button>
        </div>
      </div>

      {error && (
        <p className="text-destructive text-sm max-w-md text-center">
          {error}
        </p>
      )}
    </div>
  )
}
