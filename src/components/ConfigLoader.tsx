import { useCallback, useRef, useState } from "react"
import { FileText, Check } from "lucide-react"
import { parseYAMLConfig } from "@/lib/units"
import type { PatternConfigUm, Calibration } from "@/types"

interface ConfigLoaderProps {
  onLoad: (config: PatternConfigUm) => void
  onCalibrationLoad?: (cal: Calibration) => void
}

export function ConfigLoader({ onLoad, onCalibrationLoad }: ConfigLoaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [filename, setFilename] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFile = useCallback((file: File) => {
    setError(null)
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const { pattern, calibration } = parseYAMLConfig(text)
        onLoad(pattern)
        if (calibration) onCalibrationLoad?.(calibration)
        setFilename(file.name)
      } catch {
        setError("Invalid YAML config file")
        setFilename(null)
      }
    }
    reader.readAsText(file)
  }, [onLoad, onCalibrationLoad])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  return (
    <div>
      <div
        className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors ${
          filename
            ? "border-primary/50 bg-primary/5"
            : "border-border hover:border-muted-foreground"
        }`}
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".yaml,.yml"
          onChange={handleChange}
          className="hidden"
        />
        <div className="flex items-center justify-center gap-2 text-base">
          {filename ? (
            <>
              <Check className="h-4 w-4 text-primary" />
              <span className="text-foreground font-medium truncate">{filename}</span>
            </>
          ) : (
            <>
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Load config YAML</span>
            </>
          )}
        </div>
      </div>
      {error && <p className="text-base text-destructive mt-1">{error}</p>}
    </div>
  )
}
