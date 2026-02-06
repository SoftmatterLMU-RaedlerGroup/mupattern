import { useState, useCallback, useRef, useMemo } from "react"
import { Header } from "@/components/Header"
import { Sidebar } from "@/components/Sidebar"
import { UnifiedCanvas, type UnifiedCanvasRef } from "@/components/UnifiedCanvas"
import { Landing, type StartConfig } from "@/components/Landing"
import { usePattern } from "@/hooks/usePattern"
import { useTransform } from "@/hooks/useTransform"
import { useCalibration } from "@/hooks/useCalibration"
import { patternToPixels, patternToYAML } from "@/lib/units"

function App() {
  const canvasRef = useRef<UnifiedCanvasRef>(null)
  const [started, setStarted] = useState(false)
  const [phaseContrast, setPhaseContrast] = useState<HTMLImageElement | null>(null)
  const [imageBaseName, setImageBaseName] = useState<string>("pattern")
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({ width: 2048, height: 2048 })

  const { calibration, setCalibration } = useCalibration()
  const { pattern, updateLattice, updateSquareSize, scalePattern, rotatePattern, loadConfig, reset: resetPattern } = usePattern()
  const { transform, updateTransform, reset: resetTransform } = useTransform()
  const [sensitivity, setSensitivity] = useState(0.5)

  // Derive pixel-space pattern from µm config + calibration
  const patternPx = useMemo(
    () => patternToPixels(pattern, calibration),
    [pattern, calibration]
  )

  const handleStart = useCallback((config: StartConfig) => {
    if (config.kind === "image") {
      setPhaseContrast(config.image)
      setImageBaseName(config.filename)
      setCanvasSize({ width: config.image.width, height: config.image.height })
    } else {
      setPhaseContrast(null)
      setImageBaseName("pattern")
      setCanvasSize({ width: config.width, height: config.height })
    }
    setStarted(true)
  }, [])

  const handleImageLoad = useCallback((img: HTMLImageElement, filename: string) => {
    setPhaseContrast(img)
    setImageBaseName(filename)
    setCanvasSize({ width: img.width, height: img.height })
  }, [])

  const handleReset = useCallback(() => {
    resetPattern()
    resetTransform()
  }, [resetPattern, resetTransform])

  const handleExportYAML = useCallback(() => {
    const yaml = patternToYAML(pattern, calibration)
    const blob = new Blob([yaml], { type: "text/yaml" })
    const link = document.createElement("a")
    link.download = `${imageBaseName}_config.yaml`
    link.href = URL.createObjectURL(blob)
    link.click()
    URL.revokeObjectURL(link.href)
  }, [pattern, calibration, imageBaseName])

  const handleExport = useCallback(() => {
    canvasRef.current?.exportAll()
  }, [])

  if (!started) {
    return <Landing onStart={handleStart} />
  }

  return (
    <div className="flex h-screen flex-col">
        <Header
          imageBaseName={phaseContrast ? imageBaseName : null}
          onImageLoad={handleImageLoad}
          onConfigLoad={loadConfig}
          onCalibrationLoad={setCalibration}
        />
      <div className="flex flex-1 min-h-0">
        <UnifiedCanvas
          ref={canvasRef}
          phaseContrast={phaseContrast}
          canvasSize={canvasSize}
          imageBaseName={imageBaseName}
          patternPx={patternPx}
          transform={transform}
          onTransformUpdate={updateTransform}
          onZoom={scalePattern}
          onRotate={rotatePattern}
          sensitivity={sensitivity}
          onExportYAML={handleExportYAML}
        />
        <Sidebar
          calibration={calibration}
          onCalibrationChange={setCalibration}
          pattern={pattern}
          onLatticeUpdate={updateLattice}
          onSquareSizeUpdate={updateSquareSize}
          transform={transform}
          onTransformUpdate={updateTransform}
          sensitivity={sensitivity}
          onSensitivityChange={setSensitivity}
          onReset={handleReset}
          onExport={handleExport}
        />
      </div>
    </div>
  )
}

export default App
